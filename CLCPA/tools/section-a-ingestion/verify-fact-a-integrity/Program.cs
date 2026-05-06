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
//
// patch: PATCH f55… legacy A1 facts (lookups + post-verify vs __LEGACY_DASH), then print full integrity report.

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
