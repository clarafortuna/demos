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

    private static string FmtOpt(decimal? v) =>
        v.HasValue ? v.Value.ToString("0.##", CultureInfo.InvariantCulture) : "—";

    private static string FmtOptInt(int? v) => v.HasValue ? v.Value.ToString(CultureInfo.InvariantCulture) : "—";

    private static string DecodeAtobJson(string legacyPath)
    {
        var text = File.ReadAllText(legacyPath);
        var start = text.IndexOf("atob('", StringComparison.Ordinal);
        if (start < 0) throw new InvalidOperationException("atob not found");
        start += "atob('".Length;
        var end = text.IndexOf("')", start, StringComparison.Ordinal);
        return Encoding.UTF8.GetString(Convert.FromBase64String(text[start..end]));
    }

    private static JsonElement FindTable(JsonElement tablesArray, string id)
    {
        foreach (var t in tablesArray.EnumerateArray())
        {
            if (t.TryGetProperty("id", out var idEl) && string.Equals(idEl.GetString(), id, StringComparison.Ordinal))
                return t;
        }

        throw new InvalidOperationException($"Legacy JSON missing section A table {id}.");
    }

    private static Dictionary<(int Year, string Program), (decimal Total, decimal Dac)> ParseA2(JsonElement table)
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
