using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

/// <summary>
/// STEP 3: Upsert <c>cf_FACTCLEANENERGYSPENDING</c> rows for Table A2 programs that are not covered by A1 chart facts
/// (after alias map). <c>cf_sourcetable</c> = LEGACY_A2_{year}_{slug}_DAC|ND; <c>cf_incentivedollars</c> null; MMBtu from A2.
/// </summary>
internal static class LegacyA2TableOnlyFacts
{
    public static async Task Run(HttpClient http, string clcpaRepoRoot)
    {
        var legacyPath = Path.Combine(clcpaRepoRoot, "src", "WebResources", "cf_clcpa_dash_legacy");
        if (!File.Exists(legacyPath))
            throw new FileNotFoundException(legacyPath);

        var json = LegacyA1TableEnrichment.DecodeAtobJson(legacyPath);
        using var legacyDoc = JsonDocument.Parse(json);
        var a2 = LegacyA1TableEnrichment.FindTable(legacyDoc.RootElement.GetProperty("sectionA").GetProperty("tables"),
            "A2");
        var energy = LegacyA1TableEnrichment.ParseA2(a2);
        var aliasMap = LegacyA1TableEnrichment.LoadA1ToA2AliasMap(clcpaRepoRoot);
        var a1ByYear = LegacyA1TableEnrichment.LoadA1ChartProgramSets(legacyDoc.RootElement);

        var yearToPeriod = await ResolvePeriodGuidByYear(http);
        var codeToDac = await ResolveDacGuids(http);
        if (!codeToDac.TryGetValue("DAC", out var dacRowId))
            throw new InvalidOperationException("No active cf_dacstatus with code DAC.");
        if (!codeToDac.TryGetValue("NON_DAC", out var nonDacRowId))
            throw new InvalidOperationException("No active cf_dacstatus with code NON_DAC.");

        var programCreateCount = new IntHolder();
        var factsCreated = 0;
        var factsPatched = 0;

        Console.WriteLine("STEP 3: upsert LEGACY_A2 facts for Table A2 rows not covered by A1 chart + alias map …");

        foreach (var year in new[] { 2023, 2024 })
        {
            var covered = LegacyA1TableEnrichment.GetA2RowNamesCoveredByA1Charts(year, a1ByYear, aliasMap);
            if (!yearToPeriod.TryGetValue(year, out var periodGuid))
                throw new InvalidOperationException($"Missing period for {year}.");

            foreach (var ((y, prog), pair) in energy)
            {
                if (y != year) continue;
                if (covered.Contains(prog)) continue;

                var programGuid = await EnsureProgramAsync(http, prog, programCreateCount);
                var nondac = pair.Total - pair.Dac;
                if (nondac < 0) nondac = 0;
                var dacMmbtu = Math.Round(pair.Dac, 2, MidpointRounding.AwayFromZero);
                var ndMmbtu = Math.Round(nondac, 2, MidpointRounding.AwayFromZero);

                var slug = Slug(prog);
                var stDac = $"LEGACY_A2_{year}_{slug}_DAC";
                var stNd = $"LEGACY_A2_{year}_{slug}_ND";

                if (await UpsertMmbtuFact(http, stDac, periodGuid, programGuid, dacRowId, dacMmbtu))
                    factsPatched++;
                else
                {
                    await CreateMmbtuFact(http, stDac, periodGuid, programGuid, dacRowId, dacMmbtu);
                    factsCreated++;
                }

                if (await UpsertMmbtuFact(http, stNd, periodGuid, programGuid, nonDacRowId, ndMmbtu))
                    factsPatched++;
                else
                {
                    await CreateMmbtuFact(http, stNd, periodGuid, programGuid, nonDacRowId, ndMmbtu);
                    factsCreated++;
                }

                Console.WriteLine($"  {year} {prog}: DAC MMBtu={dacMmbtu}, Non-DAC MMBtu={ndMmbtu} ({stDac} / {stNd})");
            }
        }

        Console.WriteLine(
            $"STEP 3 complete. New cf_dimprogram={programCreateCount.Value}, facts created={factsCreated}, facts patched={factsPatched}.");
    }

    private sealed class IntHolder
    {
        public int Value;
    }

    private static string Slug(string programName)
    {
        var s = Regex.Replace(programName.Trim(), @"[^a-zA-Z0-9]+", "_");
        if (s.Length > 36) s = s[..36];
        s = s.Trim('_');
        return s.Length > 0 ? s : "PROG";
    }

    private static string ODataEscape(string s) => s.Replace("'", "''", StringComparison.Ordinal);

    private static async Task<Guid> EnsureProgramAsync(HttpClient http, string programName, IntHolder programsCreated)
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

        var code = "A2LG" + Guid.NewGuid().ToString("N")[..8].ToUpperInvariant();
        var shortLabel = programName.Length > 40 ? programName[..37] + "…" : programName;
        var body =
            "{" +
            $"\"cf_programname\":\"{JsonEncoded(programName)}\"," +
            $"\"cf_programcode\":\"{JsonEncoded(code)}\"," +
            $"\"cf_portal_short_label\":\"{JsonEncoded(shortLabel)}\"," +
            "\"cf_sectioncode\":\"A\"," +
            "\"cf_reportingtable\":\"A2\"," +
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

        var respText = await resp2.Content.ReadAsStringAsync();
        if (string.IsNullOrWhiteSpace(respText))
            throw new InvalidOperationException(
                "POST cf_dimprograms returned empty body; re-run with Prefer: return=representation or inspect org OData settings.");

        using var created = JsonDocument.Parse(respText);
        var root = created.RootElement;
        if (!root.TryGetProperty("cf_dimprogramid", out var nid) ||
            !Guid.TryParse(nid.GetString(), out var newId))
            throw new InvalidOperationException("POST cf_dimprograms: missing cf_dimprogramid.");
        programsCreated.Value++;
        return newId;
    }

    private static string JsonEncoded(string s) =>
        JsonSerializer.Serialize(s, (JsonSerializerOptions?)null)[1..^1];

    private static async Task<bool> UpsertMmbtuFact(HttpClient http, string sourceTable, Guid periodId, Guid programId,
        Guid dacStatusId, decimal mmbtu)
    {
        var id = await FindActiveFactIdBySourceTable(http, sourceTable);
        if (!id.HasValue) return false;

        using (var patchDoc = new MemoryStream())
        {
            using (var w = new Utf8JsonWriter(patchDoc))
            {
                w.WriteStartObject();
                w.WriteNull("cf_incentivedollars");
                w.WriteNumber("cf_energysavingsmmbtu", mmbtu);
                w.WriteEndObject();
            }

            using var req = new HttpRequestMessage(new HttpMethod("PATCH"), $"cf_factcleanenergyspendings({id.Value})")
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

    private static async Task CreateMmbtuFact(HttpClient http, string sourceTable, Guid periodId, Guid programId,
        Guid dacStatusId, decimal mmbtu)
    {
        var id = Guid.NewGuid();
        var body =
            "{" +
            $"\"cf_factcleanenergyspendingid\":\"{id:D}\"," +
            $"\"cf_sourcetable\":\"{JsonEncoded(sourceTable)}\"," +
            $"\"cf_period@odata.bind\":\"/cf_dimperiods({periodId})\"," +
            $"\"cf_program@odata.bind\":\"/cf_dimprograms({programId})\"," +
            $"\"cf_dacstatus@odata.bind\":\"/cf_dacstatuses({dacStatusId})\"," +
            "\"cf_customersegmentcode\":\"ALL\"," +
            "\"cf_incentivedollars\":null," +
            $"\"cf_energysavingsmmbtu\":{mmbtu.ToString(CultureInfo.InvariantCulture)}" +
            "}";
        using var req = new HttpRequestMessage(HttpMethod.Post, "cf_factcleanenergyspendings");
        req.Headers.TryAddWithoutValidation("Prefer", "return=representation");
        req.Content = new StringContent(body, Encoding.UTF8, "application/json");
        using var resp = await http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync();
            throw new HttpRequestException($"POST cf_factcleanenergyspendings {sourceTable} failed {(int)resp.StatusCode}: {err}");
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
}
