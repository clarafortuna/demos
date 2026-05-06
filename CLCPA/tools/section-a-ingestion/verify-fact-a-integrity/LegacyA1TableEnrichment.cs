using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

/// <summary>
/// PATCH f55… facts with cf_sourcetable start LEGACY_A1: cf_energysavingsmmbtu from legacy Table A2,
/// cf_participants from Table A3 (total summed by program), split across DAC / NON_DAC rows using A2 DAC share of energy.
/// </summary>
internal static class LegacyA1TableEnrichment
{
    public static async Task Run(HttpClient http, string clcpaRepoRoot)
    {
        var legacyPath = Path.Combine(clcpaRepoRoot, "src", "WebResources", "cf_clcpa_dash_legacy");
        if (!File.Exists(legacyPath))
            throw new FileNotFoundException(legacyPath);

        var json = DecodeAtobJson(legacyPath);
        using var doc = JsonDocument.Parse(json);
        var a2 = FindTable(doc.RootElement.GetProperty("sectionA").GetProperty("tables"), "A2");
        var a3 = FindTable(doc.RootElement.GetProperty("sectionA").GetProperty("tables"), "A3");

        var energyByYearProgram = ParseA2(a2);
        var participantsByYearProgram = ParseA3(a3);

        var dacFlags = await VerifyTools.LoadDacFlags(http);

        var rows = await FetchLegacyA1F55Rows(http);
        Console.WriteLine($"FIX 2: enrich {rows.Count} LEGACY_A1 f55… rows from Tables A2/A3 …");

        foreach (var row in rows)
        {
            if (row.Year is not (2023 or 2024)) continue;
            var year = row.Year.Value;
            if (!dacFlags.TryGetValue(row.DacStatusId, out var isDacRow))
            {
                Console.WriteLine($"  SKIP {row.Id}: unknown dac status id {row.DacStatusId}");
                continue;
            }

            var pname = row.ProgramName?.Trim() ?? "";
            if (string.IsNullOrEmpty(pname)) continue;

            TryMatchEnergy(year, pname, energyByYearProgram, out var totalMmbtu, out var dacMmbtu);
            TryMatchParticipants(year, pname, participantsByYearProgram, out var totalParticipants);

            decimal? mmbtuForRow = null;
            if (totalMmbtu.HasValue && dacMmbtu.HasValue)
            {
                var nondacMmbtu = totalMmbtu.Value - dacMmbtu.Value;
                if (nondacMmbtu < 0) nondacMmbtu = 0;
                mmbtuForRow = isDacRow ? dacMmbtu.Value : nondacMmbtu;
                mmbtuForRow = Math.Round(mmbtuForRow.Value, 2, MidpointRounding.AwayFromZero);
            }

            int? participantsForRow = null;
            if (totalParticipants.HasValue)
            {
                if (totalMmbtu is > 0 && dacMmbtu.HasValue)
                {
                    var share = dacMmbtu.Value / totalMmbtu.Value;
                    if (share < 0) share = 0;
                    if (share > 1) share = 1;
                    var dacP = (int)Math.Round(totalParticipants.Value * (double)share, MidpointRounding.AwayFromZero);
                    if (dacP > totalParticipants.Value) dacP = totalParticipants.Value;
                    var nondacP = totalParticipants.Value - dacP;
                    participantsForRow = isDacRow ? dacP : nondacP;
                }
                else
                {
                    // No A2 energy split: attribute all participants to the NON_DAC row (DAC row 0).
                    participantsForRow = isDacRow ? 0 : totalParticipants.Value;
                }
            }

            if (!mmbtuForRow.HasValue && !participantsForRow.HasValue)
            {
                Console.WriteLine($"  SKIP {row.Id} ({pname}, {year}): no A2/A3 match");
                continue;
            }

            byte[] body;
            using (var patchDoc = new MemoryStream())
            {
                using (var w = new Utf8JsonWriter(patchDoc))
                {
                    w.WriteStartObject();
                    if (mmbtuForRow.HasValue)
                        w.WriteNumber("cf_energysavingsmmbtu", mmbtuForRow.Value);
                    if (participantsForRow.HasValue)
                        w.WriteNumber("cf_participants", participantsForRow.Value);
                    w.WriteEndObject();
                }

                body = patchDoc.ToArray();
            }

            using var req = new HttpRequestMessage(new HttpMethod("PATCH"),
                $"cf_factcleanenergyspendings({row.Id})")
            {
                Content = new ByteArrayContent(body)
            };
            req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            req.Headers.IfMatch.Add(EntityTagHeaderValue.Any);
            using var resp = await http.SendAsync(req);
            resp.EnsureSuccessStatusCode();
            Console.WriteLine(
                $"  PATCH {row.Id} ({pname}, {(isDacRow ? "DAC" : "NON_DAC")}, {year}): MMBtu={FmtOpt(mmbtuForRow)}, participants={FmtOptInt(participantsForRow)}");
        }

        Console.WriteLine("FIX 2 complete.");
    }

    /// <summary>
    /// STEP 2: PATCH <c>cf_energysavingsmmbtu</c> only from Table A2 for active LEGACY_A1 f55… facts.
    /// Uses <c>tools/clcpa/a1-a2-program-alias-map.json</c> (explicit aliases) plus identity A1→A2 names.
    /// Restricts to programs listed in <c>A1_programs_{year}</c>; no fuzzy <see cref="NamesAlign"/> matching.
    /// </summary>
    public static async Task RunA2MmbtuOnly(HttpClient http, string clcpaRepoRoot)
    {
        var legacyPath = Path.Combine(clcpaRepoRoot, "src", "WebResources", "cf_clcpa_dash_legacy");
        if (!File.Exists(legacyPath))
            throw new FileNotFoundException(legacyPath);

        var json = DecodeAtobJson(legacyPath);
        using var legacyDoc = JsonDocument.Parse(json);
        var a2 = FindTable(legacyDoc.RootElement.GetProperty("sectionA").GetProperty("tables"), "A2");
        var energyByYearProgram = ParseA2(a2);
        var aliasMap = LoadA1ToA2AliasMap(clcpaRepoRoot);
        var a1ByYear = LoadA1ChartProgramSets(legacyDoc.RootElement);

        var dacFlags = await VerifyTools.LoadDacFlags(http);
        var rows = await FetchLegacyA1F55Rows(http);
        Console.WriteLine(
            $"STEP 2: PATCH cf_energysavingsmmbtu on LEGACY_A1 f55… rows (strict A1 + alias map, {rows.Count} candidate(s)) …");

        var patched = 0;
        var skipped = 0;

        foreach (var row in rows)
        {
            if (row.Year is not (2023 or 2024))
            {
                skipped++;
                continue;
            }

            var year = row.Year.Value;
            var pname = row.ProgramName?.Trim() ?? "";
            if (string.IsNullOrEmpty(pname))
            {
                skipped++;
                continue;
            }

            if (!a1ByYear.TryGetValue(year, out var a1Set) || !a1Set.Contains(pname))
            {
                Console.WriteLine($"  SKIP {row.Id}: program {Quote(pname)} not in A1_programs_{year}");
                skipped++;
                continue;
            }

            if (!dacFlags.TryGetValue(row.DacStatusId, out var isDacRow))
            {
                Console.WriteLine($"  SKIP {row.Id}: unknown dac status id {row.DacStatusId}");
                skipped++;
                continue;
            }

            if (!TryMatchEnergyStrict(year, pname, energyByYearProgram, aliasMap, out var totalMmbtu,
                    out var dacMmbtu) ||
                !totalMmbtu.HasValue || !dacMmbtu.HasValue)
            {
                Console.WriteLine(
                    $"  SKIP {row.Id} ({Quote(pname)}, {year}): no Table A2 row for resolved A2 name after alias map");
                skipped++;
                continue;
            }

            var nondacMmbtu = totalMmbtu.Value - dacMmbtu.Value;
            if (nondacMmbtu < 0) nondacMmbtu = 0;
            var mmbtuForRow = isDacRow ? dacMmbtu.Value : nondacMmbtu;
            mmbtuForRow = Math.Round(mmbtuForRow, 2, MidpointRounding.AwayFromZero);

            byte[] body;
            using (var patchDoc = new MemoryStream())
            {
                using (var w = new Utf8JsonWriter(patchDoc))
                {
                    w.WriteStartObject();
                    w.WriteNumber("cf_energysavingsmmbtu", mmbtuForRow);
                    w.WriteEndObject();
                }

                body = patchDoc.ToArray();
            }

            using var req = new HttpRequestMessage(new HttpMethod("PATCH"),
                $"cf_factcleanenergyspendings({row.Id})")
            {
                Content = new ByteArrayContent(body)
            };
            req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            req.Headers.IfMatch.Add(EntityTagHeaderValue.Any);
            using var resp = await http.SendAsync(req);
            resp.EnsureSuccessStatusCode();
            patched++;
            var a2Name = ResolveA2TableRowName(year, pname, aliasMap);
            Console.WriteLine(
                $"  PATCH {row.Id} ({Quote(pname)}→{Quote(a2Name)}, {(isDacRow ? "DAC" : "NON_DAC")}, {year}): cf_energysavingsmmbtu={mmbtuForRow.ToString("0.##", CultureInfo.InvariantCulture)}");
        }

        Console.WriteLine($"STEP 2 complete. Patched={patched}, skipped={skipped}.");
    }

    private static string Quote(string s) => "\"" + s.Replace("\"", "\\\"", StringComparison.Ordinal) + "\"";

    internal static Dictionary<(int Year, string A1Chart), string> LoadA1ToA2AliasMap(string clcpaRepoRoot)
    {
        var path = Path.Combine(clcpaRepoRoot, "tools", "clcpa", "a1-a2-program-alias-map.json");
        if (!File.Exists(path))
            throw new FileNotFoundException(
                "STEP 1 alias map not found. Expected: " + path);

        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var aliases = doc.RootElement.GetProperty("aliases");
        var d = new Dictionary<(int, string), string>();
        foreach (var el in aliases.EnumerateArray())
        {
            var a1 = el.GetProperty("a1ChartName").GetString() ?? "";
            var a2 = el.GetProperty("a2TableName").GetString() ?? "";
            if (string.IsNullOrWhiteSpace(a1) || string.IsNullOrWhiteSpace(a2)) continue;
            foreach (var y in el.GetProperty("years").EnumerateArray())
            {
                if (y.ValueKind != JsonValueKind.Number || !y.TryGetInt32(out var yi)) continue;
                d[(yi, a1)] = a2;
            }
        }

        return d;
    }

    internal static Dictionary<int, HashSet<string>> LoadA1ChartProgramSets(JsonElement legacyRoot)
    {
        var charts = legacyRoot.GetProperty("sectionA").GetProperty("charts");
        var res = new Dictionary<int, HashSet<string>>();
        foreach (var year in new[] { 2023, 2024 })
        {
            var prop = "A1_programs_" + year.ToString(CultureInfo.InvariantCulture);
            if (!charts.TryGetProperty(prop, out var arr) || arr.ValueKind != JsonValueKind.Array)
                continue;
            var set = new HashSet<string>(StringComparer.Ordinal);
            foreach (var el in arr.EnumerateArray())
            {
                if (!el.TryGetProperty("name", out var n) || n.ValueKind != JsonValueKind.String) continue;
                var s = n.GetString()?.Trim() ?? "";
                if (s.Length > 0) set.Add(s);
            }

            res[year] = set;
        }

        return res;
    }

    internal static string ResolveA2TableRowName(int year, string a1ChartProgram,
        Dictionary<(int Year, string A1Chart), string> aliasMap) =>
        aliasMap.TryGetValue((year, a1ChartProgram), out var a2) ? a2 : a1ChartProgram;

    /// <summary>Table A2 row labels that already receive MMBtu via LEGACY_A1 facts (STEP 2), including alias targets.</summary>
    internal static HashSet<string> GetA2RowNamesCoveredByA1Charts(int year,
        Dictionary<int, HashSet<string>> a1ByYear,
        Dictionary<(int Year, string A1Chart), string> aliasMap)
    {
        var covered = new HashSet<string>(StringComparer.Ordinal);
        if (!a1ByYear.TryGetValue(year, out var a1s)) return covered;
        foreach (var a1 in a1s)
            covered.Add(ResolveA2TableRowName(year, a1, aliasMap));
        return covered;
    }

    private static bool TryMatchEnergyStrict(int year, string a1ChartProgram,
        Dictionary<(int Year, string Program), (decimal Total, decimal Dac)> a2,
        Dictionary<(int Year, string A1Chart), string> aliasMap,
        out decimal? total, out decimal? dac)
    {
        total = null;
        dac = null;
        var a2Row = ResolveA2TableRowName(year, a1ChartProgram, aliasMap);
        if (!a2.TryGetValue((year, a2Row), out var pair)) return false;
        total = pair.Total;
        dac = pair.Dac;
        return true;
    }

    private static string FmtOpt(decimal? v) =>
        v.HasValue ? v.Value.ToString("0.##", CultureInfo.InvariantCulture) : "—";

    private static string FmtOptInt(int? v) => v.HasValue ? v.Value.ToString(CultureInfo.InvariantCulture) : "—";

    internal static string DecodeAtobJson(string legacyPath)
    {
        var text = File.ReadAllText(legacyPath);
        var start = text.IndexOf("atob('", StringComparison.Ordinal);
        if (start < 0) throw new InvalidOperationException("atob not found");
        start += "atob('".Length;
        var end = text.IndexOf("')", start, StringComparison.Ordinal);
        return Encoding.UTF8.GetString(Convert.FromBase64String(text[start..end]));
    }

    internal static JsonElement FindTable(JsonElement tablesArray, string id)
    {
        foreach (var t in tablesArray.EnumerateArray())
        {
            if (t.TryGetProperty("id", out var idEl) && string.Equals(idEl.GetString(), id, StringComparison.Ordinal))
                return t;
        }

        throw new InvalidOperationException($"Legacy JSON missing section A table {id}.");
    }

    internal static Dictionary<(int Year, string Program), (decimal Total, decimal Dac)> ParseA2(JsonElement table)
    {
        var d = new Dictionary<(int, string), (decimal, decimal)>();
        foreach (var year in new[] { 2023, 2024 })
        {
            var key = "data_" + year.ToString(CultureInfo.InvariantCulture);
            if (!table.TryGetProperty(key, out var data) || data.ValueKind != JsonValueKind.Array)
                continue;
            var rows = data.EnumerateArray().Skip(1);
            foreach (var row in rows)
            {
                if (row.GetArrayLength() < 3) continue;
                var prog = row[0].GetString()?.Trim() ?? "";
                if (string.IsNullOrEmpty(prog)) continue;
                if (string.Equals(prog, "Total", StringComparison.OrdinalIgnoreCase) ||
                    string.Equals(prog, "Grand Total", StringComparison.OrdinalIgnoreCase))
                    continue;
                if (!TryParseDec(row[1], out var tot) || !TryParseDec(row[2], out var dac))
                    continue;
                d[(year, prog)] = (tot, dac);
            }
        }

        return d;
    }

    private static Dictionary<(int Year, string Program), int> ParseA3(JsonElement table)
    {
        var acc = new Dictionary<(int, string), int>();
        foreach (var year in new[] { 2023, 2024 })
        {
            var key = "data_" + year.ToString(CultureInfo.InvariantCulture);
            if (!table.TryGetProperty(key, out var data) || data.ValueKind != JsonValueKind.Array)
                continue;
            var rows = data.EnumerateArray().Skip(1);
            foreach (var row in rows)
            {
                if (row.GetArrayLength() < 3) continue;
                var prog = row[1].GetString()?.Trim() ?? "";
                if (string.IsNullOrEmpty(prog)) continue;
                if (!TryParseInt(row[2], out var p)) continue;
                var k = (year, prog);
                acc[k] = acc.TryGetValue(k, out var cur) ? cur + p : p;
            }
        }

        return acc;
    }

    private static bool TryParseDec(JsonElement el, out decimal v)
    {
        v = default;
        return el.ValueKind switch
        {
            JsonValueKind.Number when el.TryGetDecimal(out v) => true,
            JsonValueKind.String => decimal.TryParse(
                el.GetString()?.Replace(",", "", StringComparison.Ordinal), NumberStyles.Any,
                CultureInfo.InvariantCulture, out v),
            _ => false
        };
    }

    private static bool TryParseInt(JsonElement el, out int v)
    {
        v = default;
        return el.ValueKind switch
        {
            JsonValueKind.Number when el.TryGetInt32(out v) => true,
            JsonValueKind.String => int.TryParse(
                el.GetString()?.Replace(",", "", StringComparison.Ordinal), NumberStyles.Any,
                CultureInfo.InvariantCulture, out v),
            _ => false
        };
    }

    /// <summary>Fact program names match A1 chart labels; A2/A3 often use longer "… - Electric &amp; Gas" suffixes.</summary>
    private static bool NamesAlign(string factName, string tableRowName)
    {
        var f = factName.Trim();
        var t = tableRowName.Trim();
        if (f.Length == 0 || t.Length == 0) return false;
        if (string.Equals(f, t, StringComparison.OrdinalIgnoreCase)) return true;
        if (t.StartsWith(f + " -", StringComparison.OrdinalIgnoreCase)) return true;
        if (t.StartsWith(f + " ", StringComparison.OrdinalIgnoreCase)) return true;
        if (f.StartsWith(t + " -", StringComparison.OrdinalIgnoreCase)) return true;
        if (f.StartsWith(t + " ", StringComparison.OrdinalIgnoreCase)) return true;
        return false;
    }

    private static string? PickMatch(string factProgram, IEnumerable<string> tablePrograms)
    {
        string? exact = null;
        var candidates = new List<string>();
        foreach (var tp in tablePrograms)
        {
            if (NamesAlign(factProgram, tp))
                candidates.Add(tp);
            if (string.Equals(factProgram, tp, StringComparison.OrdinalIgnoreCase))
                exact = tp;
        }

        if (candidates.Count == 0) return null;
        if (exact != null) return exact;
        if (candidates.Count == 1) return candidates[0];
        // Prefer shortest row label (e.g. "SMB Program" over longer substring collisions—rare)
        return candidates.OrderBy(s => s.Length).First();
    }

    private static bool TryMatchEnergy(int year, string factProgram,
        Dictionary<(int Year, string Program), (decimal Total, decimal Dac)> a2,
        out decimal? total, out decimal? dac)
    {
        total = null;
        dac = null;
        var keys = a2.Keys.Where(k => k.Year == year).Select(k => k.Program).Distinct().ToList();
        var match = PickMatch(factProgram, keys);
        if (match == null) return false;
        if (!a2.TryGetValue((year, match), out var pair)) return false;
        total = pair.Total;
        dac = pair.Dac;
        return true;
    }

    private static bool TryMatchParticipants(int year, string factProgram,
        Dictionary<(int Year, string Program), int> a3, out int? total)
    {
        total = null;
        var keys = a3.Keys.Where(k => k.Year == year).Select(k => k.Program).Distinct().ToList();
        var match = PickMatch(factProgram, keys);
        if (match == null) return false;
        if (!a3.TryGetValue((year, match), out var p)) return false;
        total = p;
        return true;
    }

    private static async Task<List<LegacyA1Row>> FetchLegacyA1F55Rows(HttpClient http)
    {
        var list = new List<LegacyA1Row>();
        var next =
            "cf_factcleanenergyspendings?$select=cf_factcleanenergyspendingid,cf_sourcetable,_cf_period_value,_cf_program_value,_cf_dacstatus_value" +
            "&$expand=cf_period($select=cf_calendaryear),cf_program($select=cf_programname)" +
            "&$filter=statecode eq 0 and startswith(cf_sourcetable,'LEGACY_A1')";
        while (next != null)
        {
            var isAbs = next.StartsWith("http", StringComparison.OrdinalIgnoreCase);
            using var resp = isAbs ? await http.GetAsync(new Uri(next)) : await http.GetAsync(next.TrimStart('/'));
            resp.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            var root = doc.RootElement;
            if (root.TryGetProperty("value", out var arr))
            {
                foreach (var row in arr.EnumerateArray())
                {
                    if (!VerifyTools.TryGuid(row, "cf_factcleanenergyspendingid", out var id)) continue;
                    if (!id.ToString("D", CultureInfo.InvariantCulture).StartsWith("f55aaaaa",
                            StringComparison.OrdinalIgnoreCase))
                        continue;
                    if (!row.TryGetProperty("cf_sourcetable", out var stEl) ||
                        stEl.ValueKind != JsonValueKind.String ||
                        !stEl.GetString()!.StartsWith("LEGACY_A1", StringComparison.Ordinal))
                        continue;
                    var dacId = VerifyTools.ParseODataGuid(row, "_cf_dacstatus_value");
                    if (!dacId.HasValue) continue;
                    int? year = null;
                    if (row.TryGetProperty("cf_period", out var per) && per.ValueKind == JsonValueKind.Object &&
                        per.TryGetProperty("cf_calendaryear", out var yEl))
                        year = VerifyTools.ParseYear(yEl);
                    string? pname = null;
                    if (row.TryGetProperty("cf_program", out var pr) && pr.ValueKind == JsonValueKind.Object &&
                        pr.TryGetProperty("cf_programname", out var nEl))
                        pname = nEl.GetString();

                    list.Add(new LegacyA1Row(id, year, pname ?? "", dacId.Value));
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        return list;
    }

    private readonly record struct LegacyA1Row(Guid Id, int? Year, string ProgramName, Guid DacStatusId);
}
