using System.Globalization;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using Azure.Core;
using Azure.Identity;

// Usage:
//   dotnet run
//   dotnet run -- https://yourorg.crm.dynamics.com
//   dotnet run -- patch [optional org url]
//   dotnet run -- delete-ui-dupes [optional org url]
//   dotnet run -- enrich-legacy-a1 [optional org url]
//   dotnet run -- patch-legacy-a1-a2-mmbtu [optional org url]
//   dotnet run -- report-mmbtu-totals [optional org url]
//   dotnet run -- upsert-legacy-a2-mmbtu [optional org url]
//   dotnet run -- verify-a2-mmbtu-step4 [optional org url]
//   dotnet run -- delete-f444-portfolio [optional org url]
//   dotnet run -- populate-dimprogram-reporting-table [optional org url]
//   dotnet run -- compare-a3-participants-step2 [optional org url] [optional path to legacy-table-a3-extracted.json]
//   dotnet run -- upsert-legacy-a3-step3 [optional org url]
//
// patch: PATCH f55… legacy A1 facts (lookups + post-verify vs __LEGACY_DASH), then print full integrity report.
// delete-ui-dupes: DELETE four duplicate UI-SectionA fact rows (FIX 1 normalization).
// enrich-legacy-a1: PATCH LEGACY_A1 f55… rows with cf_energysavingsmmbtu (Table A2) and cf_participants (A3, split by A2 DAC share).
// patch-legacy-a1-a2-mmbtu: STEP 2 — PATCH cf_energysavingsmmbtu only from Table A2 using tools/clcpa/a1-a2-program-alias-map.json (strict A1 chart names; no fuzzy table match).
// upsert-legacy-a2-mmbtu: STEP 3 — POST/PATCH LEGACY_A2_* facts + cf_dimprogram rows for Table A2 programs not covered by A1 chart + alias map.
// verify-a2-mmbtu-step4: STEP 4 — validate fact counts, MMBtu totals vs Table A2 program lines, lookups, document 2023 footer discrepancy.
// delete-f444-portfolio: DELETE all active facts with id prefix f4444444 (portfolio roll-ups; chart grain is f55 LEGACY_A1 only).
// populate-dimprogram-reporting-table: set cf_reportingtable on cf_dimprogram from program code prefixes (A1LG*, A2LG*, etc.).
// compare-a3-participants-step2: STEP 2 (A3) — compare per-program participant totals vs legacy-table-a3-extracted.json (LEGACY_A1* + LEGACY_A2*).
// upsert-legacy-a3-step3: STEP 3 (A3) — PATCH cf_participants + cf_participanttype on LEGACY_A1/LEGACY_A2; POST/PATCH LEGACY_A3_* for remaining Table A3 programs; extend cf_reportingtable with A3.

var mode = "verify";
var url = "https://org9076e69b.crm.dynamics.com";

if (args.Length > 0)
{
    if (string.Equals(args[0], "patch", StringComparison.OrdinalIgnoreCase))
    {
        mode = "patch";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (string.Equals(args[0], "delete-ui-dupes", StringComparison.OrdinalIgnoreCase))
    {
        mode = "delete-ui-dupes";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (string.Equals(args[0], "enrich-legacy-a1", StringComparison.OrdinalIgnoreCase))
    {
        mode = "enrich-legacy-a1";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (string.Equals(args[0], "patch-legacy-a1-a2-mmbtu", StringComparison.OrdinalIgnoreCase))
    {
        mode = "patch-legacy-a1-a2-mmbtu";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (string.Equals(args[0], "report-mmbtu-totals", StringComparison.OrdinalIgnoreCase))
    {
        mode = "report-mmbtu-totals";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (string.Equals(args[0], "upsert-legacy-a2-mmbtu", StringComparison.OrdinalIgnoreCase))
    {
        mode = "upsert-legacy-a2-mmbtu";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (string.Equals(args[0], "verify-a2-mmbtu-step4", StringComparison.OrdinalIgnoreCase))
    {
        mode = "verify-a2-mmbtu-step4";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (string.Equals(args[0], "delete-f444-portfolio", StringComparison.OrdinalIgnoreCase))
    {
        mode = "delete-f444-portfolio";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (string.Equals(args[0], "populate-dimprogram-reporting-table", StringComparison.OrdinalIgnoreCase))
    {
        mode = "populate-dimprogram-reporting-table";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (string.Equals(args[0], "compare-a3-participants-step2", StringComparison.OrdinalIgnoreCase))
    {
        mode = "compare-a3-participants-step2";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (string.Equals(args[0], "upsert-legacy-a3-step3", StringComparison.OrdinalIgnoreCase))
    {
        mode = "upsert-legacy-a3-step3";
        if (args.Length > 1 && args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
            url = args[1].TrimEnd('/');
    }
    else if (args[0].StartsWith("http", StringComparison.OrdinalIgnoreCase))
    {
        url = args[0].TrimEnd('/');
    }
}

var apiRoot = $"{url}/api/data/v9.2/";

var credential = new ChainedTokenCredential(
    new VisualStudioCredential(),
    new AzureCliCredential(),
    new InteractiveBrowserCredential());

AccessToken tok;
try
{
    tok = await credential.GetTokenAsync(new TokenRequestContext(new[] { $"{url}/.default" }));
}
catch (Exception ex)
{
    Console.Error.WriteLine("Could not acquire token for Dataverse: " + ex.Message);
    Environment.Exit(2);
    throw;
}

using var http = new HttpClient { BaseAddress = new Uri(apiRoot) };
http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tok.Token);
http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
http.DefaultRequestHeaders.Add("OData-MaxVersion", "4.0");
http.DefaultRequestHeaders.Add("OData-Version", "4.0");

var ingestionDir = VerifyTools.FindIngestionToolDir();
if (mode == "patch")
    await LegacyA1FactPatch.Run(http, url, ingestionDir);

if (mode == "delete-ui-dupes")
{
    await DeleteUiSectionADupes.Run(http);
    Console.WriteLine("FIX 1 complete. Exiting (no full verify report).");
    return;
}

if (mode == "enrich-legacy-a1")
{
    var rootEarly = VerifyTools.FindClcpaRepoRoot(VerifyTools.FindIngestionToolDir());
    await LegacyA1TableEnrichment.Run(http, rootEarly);
    Console.WriteLine("Exiting after enrich-legacy-a1 (no full verify report).");
    return;
}

if (mode == "patch-legacy-a1-a2-mmbtu")
{
    var rootEarly = VerifyTools.FindClcpaRepoRoot(VerifyTools.FindIngestionToolDir());
    await LegacyA1TableEnrichment.RunA2MmbtuOnly(http, rootEarly);
    Console.WriteLine("Exiting after patch-legacy-a1-a2-mmbtu (no full verify report).");
    return;
}

if (mode == "report-mmbtu-totals")
{
    await MmbtuTotalsReport.Run(http);
    Console.WriteLine("Exiting after report-mmbtu-totals.");
    return;
}

if (mode == "upsert-legacy-a2-mmbtu")
{
    var rootEarly = VerifyTools.FindClcpaRepoRoot(VerifyTools.FindIngestionToolDir());
    await LegacyA2TableOnlyFacts.Run(http, rootEarly);
    Console.WriteLine("Exiting after upsert-legacy-a2-mmbtu.");
    return;
}

if (mode == "verify-a2-mmbtu-step4")
{
    await A2Step4Verify.Run(http);
    Console.WriteLine("Exiting after verify-a2-mmbtu-step4.");
    return;
}

if (mode == "delete-f444-portfolio")
{
    await DeleteF444PortfolioFacts.Run(http);
    Console.WriteLine("Exiting after delete-f444-portfolio.");
    return;
}

if (mode == "populate-dimprogram-reporting-table")
{
    await PopulateDimProgramReportingTable.Run(http);
    Console.WriteLine("Exiting after populate-dimprogram-reporting-table.");
    return;
}

if (mode == "compare-a3-participants-step2")
{
    string jsonPath;
    if (args.Length >= 3 && !args[2].StartsWith("http", StringComparison.OrdinalIgnoreCase))
        jsonPath = Path.GetFullPath(args[2]);
    else if (args.Length >= 2 && !args[1].StartsWith("http", StringComparison.OrdinalIgnoreCase))
        jsonPath = Path.GetFullPath(args[1]);
    else
        jsonPath = Path.Combine(ingestionDir, "legacy-table-a3-extracted.json");

    await A3Step2CompareParticipants.Run(http, jsonPath);
    Console.WriteLine("Exiting after compare-a3-participants-step2.");
    return;
}

if (mode == "upsert-legacy-a3-step3")
{
    var clcpaRootStep3 = VerifyTools.FindClcpaRepoRoot(ingestionDir);
    await LegacyA3Step3.Run(http, clcpaRootStep3);
    Console.WriteLine("Exiting after upsert-legacy-a3-step3.");
    return;
}

var clcpaRoot = VerifyTools.FindClcpaRepoRoot(ingestionDir);
var periodIds = await VerifyTools.LoadActiveIdSet(http, "cf_dimperiods", "cf_dimperiodid");
var programIds = await VerifyTools.LoadActiveIdSet(http, "cf_dimprograms", "cf_dimprogramid");
var dacIds = await VerifyTools.LoadActiveIdSet(http, "cf_dacstatuses", "cf_dacstatusid");

var facts = await VerifyTools.FetchFacts(http);
var total = facts.Count;
var validPeriod = 0;
var brokenPeriod = 0;
var validProgram = 0;
var brokenProgram = 0;
var validDac = 0;
var brokenDac = 0;

var rows = new List<FactRow>();
foreach (var f in facts)
{
    var pid = f.Period;
    var prid = f.Program;
    var did = f.Dac;
    var amt = f.Incentive;

    var okP = pid.HasValue && periodIds.Contains(pid.Value);
    var okPr = prid.HasValue && programIds.Contains(prid.Value);
    var okD = did.HasValue && dacIds.Contains(did.Value);
    if (okP) validPeriod++; else brokenPeriod++;
    if (okPr) validProgram++; else brokenProgram++;
    if (okD) validDac++; else brokenDac++;

    rows.Add(new FactRow(f.Id, pid, prid, did, amt, okP && okPr && okD));
}

var sb = new StringBuilder();
sb.AppendLine("=== cf_factcleanenergyspending dimensional integrity ===");
sb.AppendLine($"Org: {url}");
sb.AppendLine($"Active cf_dimperiod keys: {periodIds.Count}, cf_dimprogram: {programIds.Count}, cf_dacstatus: {dacIds.Count}");
sb.AppendLine();
sb.AppendLine($"Total fact rows (statecode=active): {total}");
sb.AppendLine($"  cf_period valid (resolves to active cf_dimperiod): {validPeriod} | broken or missing: {brokenPeriod}");
sb.AppendLine($"  cf_program valid (resolves to active cf_dimprogram): {validProgram} | broken or missing: {brokenProgram}");
sb.AppendLine($"  cf_dacstatus valid (resolves to active cf_dacstatus): {validDac} | broken or missing: {brokenDac}");
sb.AppendLine();
sb.AppendLine($"Rows with all three lookups valid (intersection): {rows.Count(r => r.AllOk)}");
sb.AppendLine();

var brokenRows = rows.Where(r => !r.AllOk || !r.PeriodId.HasValue || !r.ProgramId.HasValue || !r.DacId.HasValue).ToList();
if (brokenRows.Count > 0)
{
    sb.AppendLine("--- Rows with broken or missing lookups ---");
    foreach (var r in brokenRows.Take(200))
    {
        sb.AppendLine(
            $"  id={r.Id} period={(r.PeriodId?.ToString() ?? "NULL")} -> {(r.PeriodId.HasValue && periodIds.Contains(r.PeriodId.Value) ? "OK" : "BROKEN")} | " +
            $"program={(r.ProgramId?.ToString() ?? "NULL")} -> {(r.ProgramId.HasValue && programIds.Contains(r.ProgramId.Value) ? "OK" : "BROKEN")} | " +
            $"dacstatus={(r.DacId?.ToString() ?? "NULL")} -> {(r.DacId.HasValue && dacIds.Contains(r.DacId.Value) ? "OK" : "BROKEN")} | " +
            $"incentive={Fmt(r.Incentive)}");
    }

    if (brokenRows.Count > 200)
        sb.AppendLine($"  ... {brokenRows.Count - 200} more");
    sb.AppendLine();
}

var periodYearById = await VerifyTools.LoadPeriodYears(http);
var programNameById = await VerifyTools.LoadProgramNames(http);
var dacIsDacById = await VerifyTools.LoadDacFlags(http);

var legacy = VerifyTools.LoadLegacyExpectedFromRepo(clcpaRoot);
sb.AppendLine("=== Legacy A1 comparison (dimensionally valid rows, years 2023–2024 only) ===");
var mismatches = new List<string>();
var matched = 0;
foreach (var r in rows.Where(x => x.AllOk))
{
    if (!r.PeriodId.HasValue || !r.ProgramId.HasValue || !r.DacId.HasValue || !r.Incentive.HasValue)
        continue;
    if (!periodYearById.TryGetValue(r.PeriodId.Value, out var year) || year is not (2023 or 2024))
        continue;
    if (!programNameById.TryGetValue(r.ProgramId.Value, out var pname))
        continue;
    var isDacRow = dacIsDacById.GetValueOrDefault(r.DacId.Value, false);
    if (!legacy.TryGetValue((year, pname, isDacRow), out var expected))
    {
        mismatches.Add($"No legacy key for year={year} program={Quote(pname)} dacRow={(isDacRow ? "DAC" : "non-DAC")} dv={Fmt(r.Incentive)}");
        continue;
    }

    if (Math.Abs(r.Incentive.Value - expected) > 0.01m)
    {
        mismatches.Add($"MISMATCH year={year} name={Quote(pname)} dacRow={(isDacRow ? "DAC" : "non-DAC")} DV={Fmt(r.Incentive)} legacy={expected.ToString(CultureInfo.InvariantCulture)}");
    }
    else matched++;
}

sb.AppendLine($"Exact cf_incentivedollars matches vs legacy A1 (2023/2024, keyed by period year + program name + DAC vs non-DAC row): {matched}");
sb.AppendLine($"Issues (no legacy key or amount mismatch): {mismatches.Count}");
if (mismatches.Count > 0)
{
    sb.AppendLine("--- Details ---");
    foreach (var m in mismatches.Take(300))
        sb.AppendLine("  " + m);
    if (mismatches.Count > 300)
        sb.AppendLine($"  ... {mismatches.Count - 300} more");
}

Console.WriteLine(sb.ToString());

static string Fmt(decimal? v) => v.HasValue ? v.Value.ToString("0.##", CultureInfo.InvariantCulture) : "null";
static string Quote(string s) => "\"" + s.Replace("\"", "\\\"") + "\"";

readonly record struct FactRow(
    Guid Id,
    Guid? PeriodId,
    Guid? ProgramId,
    Guid? DacId,
    decimal? Incentive,
    bool AllOk);
