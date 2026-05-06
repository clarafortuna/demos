using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

internal static class LegacyA1FactPatch
{
    private static readonly Regex LegacyYearRx = new(@"^LEGACY_A1_(\d{4})_", RegexOptions.Compiled);

    /// <summary>PATCH all f55… demo facts: resolve period by calendar year, program by exact name, DAC by cf_dacstatuscode.</summary>
    public static async Task Run(HttpClient http, string orgUrl, string ingestionDir)
    {
        var progPath = Path.Combine(ingestionDir, "cf_DIMPROGRAM_legacy23_demo.csv");
        var factPath = Path.Combine(ingestionDir, "cf_FACT_legacyA1_demo.csv");
        if (!File.Exists(progPath)) throw new FileNotFoundException(progPath);
        if (!File.Exists(factPath)) throw new FileNotFoundException(factPath);

        var seedProgIdToName = ParseProgramCsv(progPath);
        var factRows = ParseFactCsv(factPath).Where(r => r.Id.ToString().StartsWith("f55aaaaa", StringComparison.OrdinalIgnoreCase)).ToList();
        if (factRows.Count != 48)
            throw new InvalidOperationException($"Expected 48 legacy demo fact rows; found {factRows.Count}.");

        var yearToPeriod = await ResolvePeriodGuidByYear(http);
        var codeToDac = await ResolveDacGuids(http);
        var nameToProgram = await ResolveProgramByExactName(http, seedProgIdToName.Values.Distinct(StringComparer.Ordinal));

        if (!codeToDac.TryGetValue("DAC", out var dacId)) throw new InvalidOperationException("No active cf_dacstatus with code DAC.");
        if (!codeToDac.TryGetValue("NON_DAC", out var nonDacId)) throw new InvalidOperationException("No active cf_dacstatus with code NON_DAC.");

        Console.WriteLine("PATCH legacy A1 facts (48 rows) …");
        foreach (var row in factRows)
        {
            var m = LegacyYearRx.Match(row.SourceTable);
            if (!m.Success)
                throw new InvalidOperationException($"Cannot parse year from cf_sourcetable: {row.SourceTable}");
            var year = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            if (!yearToPeriod.TryGetValue(year, out var periodGuid))
                throw new InvalidOperationException($"No active cf_dimperiod for calendar year {year}.");

            if (!seedProgIdToName.TryGetValue(row.SeedProgramId, out var pname))
                throw new InvalidOperationException($"No program name for seed id {row.SeedProgramId}");
            if (!nameToProgram.TryGetValue(pname, out var programGuid))
                throw new InvalidOperationException($"No active cf_dimprogram with exact cf_programname: {pname}");

            var isDacRow = row.SourceTable.EndsWith("_DAC", StringComparison.Ordinal);
            var dacGuid = isDacRow ? dacId : nonDacId;

            var body =
                "{" +
                $"\"cf_period@odata.bind\":\"/cf_dimperiods({periodGuid})\"," +
                $"\"cf_program@odata.bind\":\"/cf_dimprograms({programGuid})\"," +
                $"\"cf_dacstatus@odata.bind\":\"/cf_dacstatuses({dacGuid})\"" +
                "}";

            using var req = new HttpRequestMessage(new HttpMethod("PATCH"), $"cf_factcleanenergyspendings({row.Id})");
            req.Headers.IfMatch.Add(EntityTagHeaderValue.Any);
            req.Content = new StringContent(body, Encoding.UTF8, "application/json");
            using var resp = await http.SendAsync(req);
            if (!resp.IsSuccessStatusCode)
            {
                var err = await resp.Content.ReadAsStringAsync();
                throw new HttpRequestException($"PATCH {row.Id} failed {(int)resp.StatusCode}: {err}");
            }
        }

        Console.WriteLine("PATCH completed successfully.");
        await VerifyPatch(http, factRows, seedProgIdToName, ingestionDir);
    }

    private static async Task VerifyPatch(
        HttpClient http,
        List<FactCsvRow> factRows,
        Dictionary<Guid, string> seedProgIdToName,
        string ingestionDir)
    {
        var legacy = VerifyTools.LoadLegacyExpectedFromRepo(VerifyTools.FindClcpaRepoRoot(ingestionDir));
        var periodYearById = await VerifyTools.LoadPeriodYears(http);
        var programNameById = await VerifyTools.LoadProgramNames(http);
        var codeToDacId = await ResolveDacGuids(http);
        if (!codeToDacId.TryGetValue("DAC", out var dacRowId) || !codeToDacId.TryGetValue("NON_DAC", out var nonDacRowId))
            throw new InvalidOperationException("Resolve DAC/NON_DAC status rows for verification.");
        var periodIds = await VerifyTools.LoadActiveIdSet(http, "cf_dimperiods", "cf_dimperiodid");
        var programIds = await VerifyTools.LoadActiveIdSet(http, "cf_dimprograms", "cf_dimprogramid");
        var dacIds = await VerifyTools.LoadActiveIdSet(http, "cf_dacstatuses", "cf_dacstatusid");

        foreach (var row in factRows)
        {
            using var resp = await http.GetAsync(
                $"cf_factcleanenergyspendings({row.Id})?$select=cf_factcleanenergyspendingid,cf_incentivedollars,_cf_period_value,_cf_program_value,_cf_dacstatus_value");
            resp.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            var o = doc.RootElement;
            var pid = VerifyTools.ParseODataGuid(o, "_cf_period_value");
            var prid = VerifyTools.ParseODataGuid(o, "_cf_program_value");
            var did = VerifyTools.ParseODataGuid(o, "_cf_dacstatus_value");
            if (!pid.HasValue || !periodIds.Contains(pid.Value))
                throw new InvalidOperationException($"Post-patch: fact {row.Id} missing valid cf_period.");
            if (!prid.HasValue || !programIds.Contains(prid.Value))
                throw new InvalidOperationException($"Post-patch: fact {row.Id} missing valid cf_program.");
            if (!did.HasValue || !dacIds.Contains(did.Value))
                throw new InvalidOperationException($"Post-patch: fact {row.Id} missing valid cf_dacstatus.");

            decimal? inc = null;
            if (o.TryGetProperty("cf_incentivedollars", out var incEl) && incEl.ValueKind == JsonValueKind.Number)
                inc = incEl.GetDecimal();

            if (!periodYearById.TryGetValue(pid.Value, out var year) || year is not (2023 or 2024))
                throw new InvalidOperationException($"Post-patch: fact {row.Id} period year unexpected.");
            if (!programNameById.TryGetValue(prid.Value, out var pname))
                throw new InvalidOperationException($"Post-patch: fact {row.Id} program name missing.");
            if (!seedProgIdToName.TryGetValue(row.SeedProgramId, out var expectName) || expectName != pname)
                throw new InvalidOperationException($"Post-patch: program name mismatch for {row.Id}: DV={pname} expected={expectName}");
            var isDacRow = row.SourceTable.EndsWith("_DAC", StringComparison.Ordinal);
            var expectStatusId = isDacRow ? dacRowId : nonDacRowId;
            if (did.Value != expectStatusId)
                throw new InvalidOperationException(
                    $"Post-patch: cf_dacstatus mismatch for {row.Id}: got {did} expected {(isDacRow ? "DAC" : "NON_DAC")} row {expectStatusId}.");

            if (!legacy.TryGetValue((year, pname, isDacRow), out var expectedInc))
                throw new InvalidOperationException($"Legacy key missing for {year} {pname} dacRow={isDacRow}");
            if (inc == null || Math.Abs(inc.Value - expectedInc) > 0.01m)
                throw new InvalidOperationException(
                    $"cf_incentivedollars mismatch fact {row.Id}: DV={inc} legacy={expectedInc} ({year}, {pname}, dacRow={isDacRow})");
        }

        Console.WriteLine("Post-patch verification: all 48 rows have valid lookups and incentives match __LEGACY_DASH A1.");
    }

    private static Dictionary<Guid, string> ParseProgramCsv(string path)
    {
        var lines = File.ReadAllLines(path);
        if (lines.Length < 2) throw new InvalidOperationException("Empty program CSV");
        var map = new Dictionary<Guid, string>();
        foreach (var line in lines.Skip(1))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var cols = SplitCsvLine(line);
            if (cols.Count < 3) continue;
            if (!Guid.TryParse(Norm(cols[0]), out var id)) continue;
            map[id] = Norm(cols[2]).Replace("\"\"", "\"");
        }

        return map;
    }

    private static List<FactCsvRow> ParseFactCsv(string path)
    {
        var lines = File.ReadAllLines(path);
        if (lines.Length < 2) throw new InvalidOperationException("Empty fact CSV");
        var list = new List<FactCsvRow>();
        foreach (var line in lines.Skip(1))
        {
            if (string.IsNullOrWhiteSpace(line)) continue;
            var cols = SplitCsvLine(line);
            if (cols.Count < 8) continue;
            var id = Guid.Parse(Norm(cols[0]));
            var st = Norm(cols[1]).Replace("\"\"", "\"");
            var seedProg = Guid.Parse(Norm(cols[3]));
            list.Add(new FactCsvRow(id, st, seedProg));
        }

        return list;
    }

    private static List<string> SplitCsvLine(string line)
    {
        var r = new List<string>();
        var cur = new StringBuilder();
        var q = false;
        for (var i = 0; i < line.Length; i++)
        {
            var c = line[i];
            if (c == '"')
            {
                if (q && i + 1 < line.Length && line[i + 1] == '"') { cur.Append('"'); i++; }
                else q = !q;
            }
            else if (c == ',' && !q)
            {
                r.Add(cur.ToString());
                cur.Clear();
            }
            else cur.Append(c);
        }

        r.Add(cur.ToString());
        return r;
    }

    private static string Norm(string s) => s.Trim().Trim('"');

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
        var next = "cf_dacstatuses?$select=cf_dacstatusid,cf_dacstatuscode&$filter=statecode eq 0";
        while (next != null)
        {
            var isAbs = next.StartsWith("http", StringComparison.OrdinalIgnoreCase);
            using var resp = isAbs ? await http.GetAsync(next) : await http.GetAsync(next.TrimStart('/'));
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

    private static async Task<Dictionary<string, Guid>> ResolveProgramByExactName(HttpClient http, IEnumerable<string> names)
    {
        var wanted = new HashSet<string>(names, StringComparer.Ordinal);
        var found = new Dictionary<string, Guid>(StringComparer.Ordinal);
        var next = "cf_dimprograms?$select=cf_dimprogramid,cf_programname&$filter=statecode eq 0";
        while (next != null)
        {
            var isAbs = next.StartsWith("http", StringComparison.OrdinalIgnoreCase);
            using var resp = isAbs ? await http.GetAsync(next) : await http.GetAsync(next.TrimStart('/'));
            resp.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            var root = doc.RootElement;
            if (root.TryGetProperty("value", out var arr))
            {
                foreach (var row in arr.EnumerateArray())
                {
                    if (!row.TryGetProperty("cf_dimprogramid", out var idEl) ||
                        !Guid.TryParse(idEl.GetString(), out var id)) continue;
                    var n = row.TryGetProperty("cf_programname", out var ne) ? (ne.GetString() ?? "") : "";
                    if (string.IsNullOrEmpty(n) || !wanted.Contains(n)) continue;
                    if (found.ContainsKey(n))
                        throw new InvalidOperationException($"Duplicate cf_programname in Dataverse: {n}");
                    found[n] = id;
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        foreach (var n in wanted)
        {
            if (!found.ContainsKey(n))
                throw new InvalidOperationException($"Missing cf_dimprogram with exact name: {n}");
        }

        return found;
    }

    private sealed record FactCsvRow(Guid Id, string SourceTable, Guid SeedProgramId);
}
