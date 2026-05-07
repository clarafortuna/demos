using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

/// <summary>
/// STEP 3 (A3): PATCH <c>cf_participants</c> + <c>cf_participanttype</c> on active LEGACY_A1* / LEGACY_A2* facts (DAC split from Table A2 when available);
/// POST/PATCH <c>LEGACY_A3_*</c> pairs for Table A3 programs with no Section A legacy fact; ensure <c>cf_dimprogram.cf_reportingtable</c> includes A3.
/// Requires org schema <c>cf_factcleanenergyspending.cf_participanttype</c> (CLCPASectionAFieldsPatch 1.0.24+).
/// </summary>
internal static class LegacyA3Step3
{
    private sealed record A3Line(
        int Year,
        string ParticipantType,
        string ProgramName,
        int Participants,
        decimal TotalIncentive,
        decimal TotalMmbtu);

    private sealed record SectionAFactRow(
        Guid Id,
        int? Year,
        string ProgramName,
        Guid DacStatusId,
        string SourceTable,
        Guid ProgramDimId);

    private sealed class IntHolder
    {
        public int Value;
    }

    public static async Task Run(HttpClient http, string clcpaRepoRoot)
    {
        var legacyPath = Path.Combine(clcpaRepoRoot, "src", "WebResources", "cf_clcpa_dash_legacy");
        if (!File.Exists(legacyPath))
            throw new FileNotFoundException(legacyPath);

        var json = LegacyA1TableEnrichment.DecodeAtobJson(legacyPath);
        using var doc = JsonDocument.Parse(json);
        var a3Table = LegacyA1TableEnrichment.FindTable(doc.RootElement.GetProperty("sectionA").GetProperty("tables"), "A3");
        var a2Table = LegacyA1TableEnrichment.FindTable(doc.RootElement.GetProperty("sectionA").GetProperty("tables"), "A2");
        var a3Lines = ParseA3DetailLines(a3Table);
        var energy = LegacyA1TableEnrichment.ParseA2(a2Table);
        var aliasMap = LegacyA1TableEnrichment.LoadA1ToA2AliasMap(clcpaRepoRoot);
        var a1ByYear = LegacyA1TableEnrichment.LoadA1ChartProgramSets(doc.RootElement);

        var dacFlags = await VerifyTools.LoadDacFlags(http);
        var yearToPeriod = await ResolvePeriodGuidByYear(http);
        var codeToDac = await ResolveDacGuids(http);
        if (!codeToDac.TryGetValue("DAC", out var dacRowId))
            throw new InvalidOperationException("No active cf_dacstatus with code DAC.");
        if (!codeToDac.TryGetValue("NON_DAC", out var nonDacRowId))
            throw new InvalidOperationException("No active cf_dacstatus with code NON_DAC.");

        var a3NamesByYear = new Dictionary<int, HashSet<string>>();
        foreach (var y in new[] { 2023, 2024 })
            a3NamesByYear[y] = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var line in a3Lines)
            a3NamesByYear[line.Year].Add(line.ProgramName);

        var facts = await FetchLegacySectionAFacts(http);
        var coveredA3Programs = new HashSet<(int Year, string Program)>();

        var factsPatched = 0;
        var factsSkipped = 0;

        Console.WriteLine(
            "STEP 3 (A3): PATCH participants + participant type on LEGACY_A1/LEGACY_A2; then upsert LEGACY_A3 for unmatched Table A3 programs …");

        foreach (var row in facts)
        {
            if (row.Year is not (2023 or 2024))
            {
                factsSkipped++;
                continue;
            }

            var year = row.Year.Value;
            var pname = row.ProgramName?.Trim() ?? "";
            if (string.IsNullOrEmpty(pname))
            {
                factsSkipped++;
                continue;
            }

            if (!dacFlags.TryGetValue(row.DacStatusId, out var isDacRow))
            {
                Console.WriteLine($"  SKIP fact {row.Id}: unknown dac status");
                factsSkipped++;
                continue;
            }

            var matchName = PickA3ProgramName(year, pname, a3NamesByYear);
            if (matchName == null)
            {
                factsSkipped++;
                continue;
            }

            var lineMatch = a3Lines.FirstOrDefault(l =>
                l.Year == year && string.Equals(l.ProgramName, matchName, StringComparison.Ordinal));
            if (lineMatch == null)
            {
                factsSkipped++;
                continue;
            }

            var line = lineMatch;

            if (!TryGetA2EnergyForSplit(year, pname, row.SourceTable, energy, aliasMap, a1ByYear, out var totMmbtu,
                    out var dacMmbtu))
            {
                totMmbtu = null;
                dacMmbtu = null;
            }

            SplitByDacShare(
                isDacRow,
                line.Participants,
                line.TotalIncentive,
                line.TotalMmbtu,
                dacMmbtu,
                totMmbtu,
                out var pRow,
                out var incRow,
                out var mmbtuRow);

            await PatchFactParticipantsAndType(http, row.Id, pRow, line.ParticipantType.Trim());
            await EnsureReportingTableIncludesA3(http, row.ProgramDimId);
            coveredA3Programs.Add((year, matchName));
            factsPatched++;
            Console.WriteLine(
                $"  PATCH fact {row.Id} ({pname} → A3 {Quote(matchName)}, {(isDacRow ? "DAC" : "ND")}, {year}): participants={pRow}, type={Quote(line.ParticipantType.Trim())}");
        }

        var programCreates = new IntHolder();
        var a3Created = 0;
        var a3Patched = 0;

        foreach (var line in a3Lines)
        {
            if (coveredA3Programs.Contains((line.Year, line.ProgramName))) continue;
            if (!yearToPeriod.TryGetValue(line.Year, out var periodGuid))
                throw new InvalidOperationException($"Missing period for {line.Year}.");

            var programGuid = await EnsureProgramForA3Async(http, line.ProgramName, programCreates);
            await EnsureReportingTableIncludesA3(http, programGuid);

            var slug = Slug(line.ProgramName);
            var stDac = $"LEGACY_A3_{line.Year}_{slug}_DAC";
            var stNd = $"LEGACY_A3_{line.Year}_{slug}_ND";

            TryGetA2EnergyDirect(line.Year, line.ProgramName, energy, out var totMmbtuLine, out var dacMmbtuLine);
            ComputeDacNdShares(line.Participants, line.TotalIncentive, line.TotalMmbtu, dacMmbtuLine, totMmbtuLine,
                out var pDac, out var pNd, out var incDac, out var incNd, out var mmbtuDac, out var mmbtuNd);

            if (await UpsertLegacyA3Fact(http, stDac, periodGuid, programGuid, dacRowId, pDac, incDac, mmbtuDac,
                    line.ParticipantType.Trim()))
                a3Patched++;
            else
            {
                await CreateLegacyA3Fact(http, stDac, periodGuid, programGuid, dacRowId, pDac, incDac, mmbtuDac,
                    line.ParticipantType.Trim());
                a3Created++;
            }

            if (await UpsertLegacyA3Fact(http, stNd, periodGuid, programGuid, nonDacRowId, pNd, incNd, mmbtuNd,
                    line.ParticipantType.Trim()))
                a3Patched++;
            else
            {
                await CreateLegacyA3Fact(http, stNd, periodGuid, programGuid, nonDacRowId, pNd, incNd, mmbtuNd,
                    line.ParticipantType.Trim());
                a3Created++;
            }

            Console.WriteLine(
                $"  LEGACY_A3 {line.Year} {Quote(line.ProgramName)}: DAC p={pDac} ND p={pNd} ({stDac} / {stNd})");
        }

        Console.WriteLine(
            $"STEP 3 (A3) complete. Facts PATCHED={factsPatched}, skipped={factsSkipped}, new programs={programCreates.Value}, LEGACY_A3 facts created={a3Created}, patched={a3Patched}.");
    }

    private static bool TryGetA2EnergyDirect(int year, string programName,
        Dictionary<(int Year, string Program), (decimal Total, decimal Dac)> energy,
        out decimal? totalMmbtu,
        out decimal? dacMmbtu)
    {
        totalMmbtu = null;
        dacMmbtu = null;
        if (!energy.TryGetValue((year, programName), out var pair)) return false;
        totalMmbtu = pair.Total;
        dacMmbtu = pair.Dac;
        return true;
    }

    private static void ComputeDacNdShares(
        int totalP,
        decimal totalInc,
        decimal totalMmbtu,
        decimal? dacMmbtu,
        decimal? totMmbtu,
        out int pDac,
        out int pNd,
        out decimal incDac,
        out decimal incNd,
        out decimal mmbtuDac,
        out decimal mmbtuNd)
    {
        SplitByDacShare(true, totalP, totalInc, totalMmbtu, dacMmbtu, totMmbtu, out pDac, out incDac, out mmbtuDac);
        pNd = totalP - pDac;
        if (pNd < 0) pNd = 0;
        incNd = Math.Round(totalInc - incDac, 2, MidpointRounding.AwayFromZero);
        if (incNd < 0) incNd = 0;
        mmbtuNd = Math.Round(totalMmbtu - mmbtuDac, 2, MidpointRounding.AwayFromZero);
        if (mmbtuNd < 0) mmbtuNd = 0;
    }

    private static bool TryGetA2EnergyForSplit(int year, string factProgramName, string sourceTable,
        Dictionary<(int Year, string Program), (decimal Total, decimal Dac)> energy,
        Dictionary<(int Year, string A1Chart), string> aliasMap,
        Dictionary<int, HashSet<string>> a1ByYear,
        out decimal? totalMmbtu,
        out decimal? dacMmbtu)
    {
        totalMmbtu = null;
        dacMmbtu = null;

        if (sourceTable.StartsWith("LEGACY_A1", StringComparison.OrdinalIgnoreCase))
        {
            if (a1ByYear.TryGetValue(year, out var a1s) && a1s.Contains(factProgramName))
            {
                var a2row = LegacyA1TableEnrichment.ResolveA2TableRowName(year, factProgramName, aliasMap);
                if (energy.TryGetValue((year, a2row), out var pair))
                {
                    totalMmbtu = pair.Total;
                    dacMmbtu = pair.Dac;
                    return true;
                }
            }
        }

        var keys = energy.Keys.Where(k => k.Year == year).Select(k => k.Program).Distinct().ToList();
        var match = PickMatch(factProgramName, keys);
        if (match != null && energy.TryGetValue((year, match), out var p2))
        {
            totalMmbtu = p2.Total;
            dacMmbtu = p2.Dac;
            return true;
        }

        return false;
    }

    private static string? PickA3ProgramName(int year, string factProgramName, Dictionary<int, HashSet<string>> a3ByYear)
    {
        if (!a3ByYear.TryGetValue(year, out var set)) return null;
        var keys = set.ToList();
        return PickMatch(factProgramName, keys);
    }

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
        return candidates.OrderBy(s => s.Length).First();
    }

    private static void SplitByDacShare(
        bool isDacRow,
        int totalP,
        decimal totalInc,
        decimal lineMmbtuTotal,
        decimal? a2DacMmbtu,
        decimal? a2TotalMmbtu,
        out int pRow,
        out decimal incRow,
        out decimal mmbtuRow)
    {
        if (a2TotalMmbtu is > 0 && a2DacMmbtu.HasValue)
        {
            var share = a2DacMmbtu.Value / a2TotalMmbtu.Value;
            if (share < 0) share = 0;
            if (share > 1) share = 1;
            if (isDacRow)
            {
                pRow = (int)Math.Round(totalP * (double)share, MidpointRounding.AwayFromZero);
                if (pRow > totalP) pRow = totalP;
                incRow = Math.Round(totalInc * share, 2, MidpointRounding.AwayFromZero);
                mmbtuRow = Math.Round(lineMmbtuTotal * share, 2, MidpointRounding.AwayFromZero);
            }
            else
            {
                var dacP = (int)Math.Round(totalP * (double)share, MidpointRounding.AwayFromZero);
                if (dacP > totalP) dacP = totalP;
                pRow = totalP - dacP;
                var dacInc = Math.Round(totalInc * share, 2, MidpointRounding.AwayFromZero);
                incRow = Math.Round(totalInc - dacInc, 2, MidpointRounding.AwayFromZero);
                if (incRow < 0) incRow = 0;
                var dacM = Math.Round(lineMmbtuTotal * share, 2, MidpointRounding.AwayFromZero);
                mmbtuRow = Math.Round(lineMmbtuTotal - dacM, 2, MidpointRounding.AwayFromZero);
                if (mmbtuRow < 0) mmbtuRow = 0;
            }
        }
        else
        {
            if (isDacRow)
            {
                pRow = 0;
                incRow = 0;
                mmbtuRow = 0;
            }
            else
            {
                pRow = totalP;
                incRow = totalInc;
                mmbtuRow = lineMmbtuTotal;
            }
        }
    }

    private static List<A3Line> ParseA3DetailLines(JsonElement table)
    {
        var list = new List<A3Line>();
        foreach (var year in new[] { 2023, 2024 })
        {
            var key = "data_" + year.ToString(CultureInfo.InvariantCulture);
            if (!table.TryGetProperty(key, out var data) || data.ValueKind != JsonValueKind.Array) continue;
            var rows = data.EnumerateArray().Skip(1);
            foreach (var row in rows)
            {
                if (row.GetArrayLength() < 5) continue;
                var participantType = row[0].GetString()?.Trim() ?? "";
                var programName = row[1].GetString()?.Trim() ?? "";
                if (string.Equals(participantType, "Total", StringComparison.OrdinalIgnoreCase) ||
                    string.IsNullOrEmpty(programName))
                    continue;
                if (!TryParseInt(row[2], out var p)) continue;
                var avgInc = NumOrZero(row[3]);
                var avgMmbtu = NumOrZero(row[4]);
                list.Add(new A3Line(
                    year,
                    participantType,
                    programName,
                    p,
                    Math.Round(p * avgInc, 2, MidpointRounding.AwayFromZero),
                    Math.Round(p * avgMmbtu, 2, MidpointRounding.AwayFromZero)));
            }
        }

        return list;
    }

    private static decimal NumOrZero(JsonElement el)
    {
        return el.ValueKind switch
        {
            JsonValueKind.Number when el.TryGetDecimal(out var d) => d,
            JsonValueKind.String when decimal.TryParse(
                el.GetString()?.Replace(",", "", StringComparison.Ordinal) ?? "",
                NumberStyles.Any, CultureInfo.InvariantCulture, out var x) => x,
            _ when string.Equals(el.GetString(), "N/A", StringComparison.OrdinalIgnoreCase) => 0,
            _ => 0
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

    private static async Task PatchFactParticipantsAndType(HttpClient http, Guid id, int participants, string pType)
    {
        using var ms = new MemoryStream();
        await using (var w = new Utf8JsonWriter(ms))
        {
            w.WriteStartObject();
            w.WriteNumber("cf_participants", participants);
            w.WriteString("cf_participanttype", pType);
            w.WriteEndObject();
        }

        using var req = new HttpRequestMessage(new HttpMethod("PATCH"), $"cf_factcleanenergyspendings({id:D})")
        {
            Content = new ByteArrayContent(ms.ToArray())
        };
        req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        req.Headers.IfMatch.Add(EntityTagHeaderValue.Any);
        using var resp = await http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync();
            throw new HttpRequestException(
                $"PATCH cf_factcleanenergyspending {id:D} failed {(int)resp.StatusCode}: {err}\n" +
                "If cf_participanttype is unrecognized, import CLCPASectionAFieldsPatch 1.0.24+ first.");
        }
    }

    private static async Task<List<SectionAFactRow>> FetchLegacySectionAFacts(HttpClient http)
    {
        var list = new List<SectionAFactRow>();
        var next =
            "cf_factcleanenergyspendings?$select=cf_factcleanenergyspendingid,cf_sourcetable,_cf_period_value,_cf_program_value,_cf_dacstatus_value" +
            "&$expand=cf_period($select=cf_calendaryear),cf_program($select=cf_programname)" +
            "&$filter=statecode eq 0 and (startswith(cf_sourcetable,'LEGACY_A1') or startswith(cf_sourcetable,'LEGACY_A2'))";
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
                    var progRef = VerifyTools.ParseODataGuid(row, "_cf_program_value");
                    if (!progRef.HasValue) continue;
                    if (!row.TryGetProperty("cf_sourcetable", out var stEl) || stEl.ValueKind != JsonValueKind.String)
                        continue;
                    var st = stEl.GetString() ?? "";
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

                    list.Add(new SectionAFactRow(id, year, pname ?? "", dacId.Value, st, progRef.Value));
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        return list;
    }

    private static string MergeReportingAddA3(string? current)
    {
        var raw = (current ?? "").Trim();
        if (string.IsNullOrEmpty(raw)) return "A3";
        var parts = raw.Split(',', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries).ToList();
        if (parts.Any(p => string.Equals(p, "A3", StringComparison.OrdinalIgnoreCase))) return raw;
        return raw + ",A3";
    }

    private static async Task EnsureReportingTableIncludesA3(HttpClient http, Guid programId)
    {
        using var resp = await http.GetAsync($"cf_dimprograms({programId:D})?$select=cf_reportingtable");
        resp.EnsureSuccessStatusCode();
        using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
        var root = doc.RootElement;
        var current = root.TryGetProperty("cf_reportingtable", out var rt) && rt.ValueKind == JsonValueKind.String
            ? rt.GetString()
            : "";
        var merged = MergeReportingAddA3(current);
        if (string.Equals(merged.Trim(), current?.Trim(), StringComparison.Ordinal)) return;

        using var ms = new MemoryStream();
        await using (var w = new Utf8JsonWriter(ms))
        {
            w.WriteStartObject();
            w.WriteString("cf_reportingtable", merged);
            w.WriteEndObject();
        }

        using var req = new HttpRequestMessage(new HttpMethod("PATCH"), $"cf_dimprograms({programId:D})")
        {
            Content = new ByteArrayContent(ms.ToArray())
        };
        req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        req.Headers.IfMatch.Add(EntityTagHeaderValue.Any);
        using var resp2 = await http.SendAsync(req);
        if (!resp2.IsSuccessStatusCode)
        {
            var err = await resp2.Content.ReadAsStringAsync();
            throw new HttpRequestException($"PATCH cf_dimprogram reporting table {programId:D}: {err}");
        }
    }

    private static async Task<Guid> EnsureProgramForA3Async(HttpClient http, string programName, IntHolder created)
    {
        var filt = $"statecode eq 0 and cf_programname eq '{ODataEscape(programName)}'";
        var url = $"cf_dimprograms?$select=cf_dimprogramid&$filter={Uri.EscapeDataString(filt)}&$top=1";
        using (var resp = await http.GetAsync(url))
        {
            resp.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            if (doc.RootElement.TryGetProperty("value", out var arr) && arr.GetArrayLength() > 0)
            {
                var row = arr[0];
                if (row.TryGetProperty("cf_dimprogramid", out var idEl) &&
                    Guid.TryParse(idEl.GetString(), out var gid))
                    return gid;
            }
        }

        var code = "A3LG" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var shortLabel = programName.Length > 40 ? programName[..37] + "…" : programName;
        var body =
            "{" +
            $"\"cf_programname\":\"{JsonEncoded(programName)}\"," +
            $"\"cf_programcode\":\"{JsonEncoded(code)}\"," +
            $"\"cf_portal_short_label\":\"{JsonEncoded(shortLabel)}\"," +
            "\"cf_sectioncode\":\"A\"," +
            "\"cf_reportingtable\":\"A3\"," +
            "\"cf_isactive\":true" +
            "}";
        using var req = new HttpRequestMessage(HttpMethod.Post, "cf_dimprograms");
        req.Headers.TryAddWithoutValidation("Prefer", "return=representation");
        req.Content = new StringContent(body, Encoding.UTF8, "application/json");
        using var resp2 = await http.SendAsync(req);
        if (!resp2.IsSuccessStatusCode)
        {
            var err = await resp2.Content.ReadAsStringAsync();
            throw new HttpRequestException($"POST cf_dimprograms failed {(int)resp2.StatusCode}: {err}");
        }

        var text = await resp2.Content.ReadAsStringAsync();
        using var createdDoc = JsonDocument.Parse(text);
        if (!createdDoc.RootElement.TryGetProperty("cf_dimprogramid", out var nid) ||
            !Guid.TryParse(nid.GetString(), out var newId))
            throw new InvalidOperationException("POST cf_dimprograms: missing id.");
        created.Value++;
        return newId;
    }

    private static async Task<bool> UpsertLegacyA3Fact(HttpClient http, string sourceTable, Guid periodId,
        Guid programId, Guid dacStatusId, int participants, decimal incentive, decimal mmbtu, string pType)
    {
        var id = await FindActiveFactIdBySourceTable(http, sourceTable);
        if (!id.HasValue) return false;

        using (var patchDoc = new MemoryStream())
        {
            await using (var w = new Utf8JsonWriter(patchDoc))
            {
                w.WriteStartObject();
                w.WriteNumber("cf_participants", participants);
                w.WriteNumber("cf_incentivedollars", incentive);
                w.WriteNumber("cf_energysavingsmmbtu", mmbtu);
                w.WriteString("cf_participanttype", pType);
                w.WriteEndObject();
            }

            using var req = new HttpRequestMessage(new HttpMethod("PATCH"), $"cf_factcleanenergyspendings({id.Value:D})")
            {
                Content = new ByteArrayContent(patchDoc.ToArray())
            };
            req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
            req.Headers.IfMatch.Add(EntityTagHeaderValue.Any);
            using var resp = await http.SendAsync(req);
            resp.EnsureSuccessStatusCode();
        }

        return true;
    }

    private static async Task CreateLegacyA3Fact(HttpClient http, string sourceTable, Guid periodId, Guid programId,
        Guid dacStatusId, int participants, decimal incentive, decimal mmbtu, string pType)
    {
        var id = Guid.NewGuid();
        var body =
            "{" +
            $"\"cf_factcleanenergyspendingid\":\"{id:D}\"," +
            $"\"cf_sourcetable\":\"{JsonEncoded(sourceTable)}\"," +
            $"\"cf_period@odata.bind\":\"/cf_dimperiods({periodId:D})\"," +
            $"\"cf_program@odata.bind\":\"/cf_dimprograms({programId:D})\"," +
            $"\"cf_dacstatus@odata.bind\":\"/cf_dacstatuses({dacStatusId:D})\"," +
            "\"cf_customersegmentcode\":\"ALL\"," +
            $"\"cf_participants\":{participants}," +
            $"\"cf_incentivedollars\":{incentive.ToString(CultureInfo.InvariantCulture)}," +
            $"\"cf_energysavingsmmbtu\":{mmbtu.ToString(CultureInfo.InvariantCulture)}," +
            $"\"cf_participanttype\":\"{JsonEncoded(pType)}\"" +
            "}";
        using var req = new HttpRequestMessage(HttpMethod.Post, "cf_factcleanenergyspendings");
        req.Headers.TryAddWithoutValidation("Prefer", "return=representation");
        req.Content = new StringContent(body, Encoding.UTF8, "application/json");
        using var resp = await http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync();
            throw new HttpRequestException(
                $"POST cf_factcleanenergyspending {sourceTable} failed {(int)resp.StatusCode}: {err}");
        }
    }

    private static async Task<Guid?> FindActiveFactIdBySourceTable(HttpClient http, string sourceTable)
    {
        var filt = $"statecode eq 0 and cf_sourcetable eq '{ODataEscape(sourceTable)}'";
        var url = $"cf_factcleanenergyspendings?$select=cf_factcleanenergyspendingid&$filter={Uri.EscapeDataString(filt)}&$top=1";
        using var resp = await http.GetAsync(url);
        resp.EnsureSuccessStatusCode();
        using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
        if (!doc.RootElement.TryGetProperty("value", out var arr) || arr.GetArrayLength() == 0) return null;
        var row = arr[0];
        return row.TryGetProperty("cf_factcleanenergyspendingid", out var idEl) &&
               Guid.TryParse(idEl.GetString(), out var g)
            ? g
            : null;
    }

    private static async Task<Dictionary<int, Guid>> ResolvePeriodGuidByYear(HttpClient http)
    {
        var map = new Dictionary<int, Guid>();
        foreach (var year in new[] { 2023, 2024 })
        {
            var filt = $"statecode eq 0 and cf_calendaryear eq {year}";
            var url = "cf_dimperiods?$select=cf_dimperiodid,cf_calendaryear,cf_isreportperiod" +
                      $"&$filter={Uri.EscapeDataString(filt)}&$orderby=cf_isreportperiod desc,createdon desc&$top=1";
            using var resp = await http.GetAsync(url);
            resp.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            if (!doc.RootElement.TryGetProperty("value", out var arr) || arr.GetArrayLength() == 0)
                throw new InvalidOperationException($"No cf_dimperiod found for year {year}.");
            var row = arr[0];
            if (!row.TryGetProperty("cf_dimperiodid", out var idEl) || !Guid.TryParse(idEl.GetString(), out var gid))
                throw new InvalidOperationException($"cf_dimperiod id parse failed for year {year}.");
            map[year] = gid;
        }

        return map;
    }

    private static async Task<Dictionary<string, Guid>> ResolveDacGuids(HttpClient http)
    {
        var map = new Dictionary<string, Guid>(StringComparer.OrdinalIgnoreCase);
        string? next = "cf_dacstatuses?$select=cf_dacstatusid,cf_dacstatuscode&$filter=statecode eq 0";
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
                    if (!row.TryGetProperty("cf_dacstatusid", out var idEl) ||
                        !Guid.TryParse(idEl.GetString(), out var id)) continue;
                    var code = row.TryGetProperty("cf_dacstatuscode", out var c) ? (c.GetString() ?? "") : "";
                    if (string.IsNullOrEmpty(code)) continue;
                    map[code.Trim().ToUpperInvariant()] = id;
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        return map;
    }

    private static string Slug(string programName)
    {
        var s = Regex.Replace(programName.Trim(), @"[^a-zA-Z0-9]+", "_");
        if (s.Length > 36) s = s[..36];
        s = s.Trim('_');
        return s.Length > 0 ? s : "PROG";
    }

    private static string ODataEscape(string s) => s.Replace("'", "''", StringComparison.Ordinal);

    private static string JsonEncoded(string s) =>
        JsonSerializer.Serialize(s, (JsonSerializerOptions?)null)[1..^1];

    private static string Quote(string s) => "\"" + s.Replace("\"", "\\\"", StringComparison.Ordinal) + "\"";
}
