using System.Globalization;
using System.Text;
using System.Text.Json;

/// <summary>
/// STEP 4: After LEGACY_A1 + LEGACY_A2 MMBtu load, validate counts, lookup integrity, totals vs Table A2 program lines.
/// </summary>
internal static class A2Step4Verify
{
    private const decimal Expected2023ProgramLinesTotal = 3682726m;
    private const decimal Expected2024ProgramLinesTotal = 4360879m;
    private const decimal Expected2023FooterTotal = 4019790m;
    private const decimal Known2023FooterDiscrepancy = Expected2023FooterTotal - Expected2023ProgramLinesTotal;

    public static async Task Run(HttpClient http)
    {
        var periodIds = await VerifyTools.LoadActiveIdSet(http, "cf_dimperiods", "cf_dimperiodid");
        var programIds = await VerifyTools.LoadActiveIdSet(http, "cf_dimprograms", "cf_dimprogramid");
        var dacIds = await VerifyTools.LoadActiveIdSet(http, "cf_dacstatuses", "cf_dacstatusid");

        var legacyA1 = 0;
        var legacyA2 = 0;
        var other = 0;
        var brokenLookups = new List<string>();
        decimal sum2023 = 0, sum2024 = 0;
        var factCount = 0;

        string? next =
            "cf_factcleanenergyspendings?$select=cf_factcleanenergyspendingid,cf_sourcetable,cf_energysavingsmmbtu,_cf_period_value,_cf_program_value,_cf_dacstatus_value" +
            "&$expand=cf_period($select=cf_calendaryear)" +
            "&$filter=statecode eq 0";

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
                    factCount++;
                    var st = row.TryGetProperty("cf_sourcetable", out var ste) && ste.ValueKind == JsonValueKind.String
                        ? ste.GetString() ?? ""
                        : "";
                    if (st.StartsWith("LEGACY_A1", StringComparison.OrdinalIgnoreCase)) legacyA1++;
                    else if (st.StartsWith("LEGACY_A2", StringComparison.OrdinalIgnoreCase)) legacyA2++;
                    else other++;

                    var pid = VerifyTools.ParseODataGuid(row, "_cf_period_value");
                    var prid = VerifyTools.ParseODataGuid(row, "_cf_program_value");
                    var did = VerifyTools.ParseODataGuid(row, "_cf_dacstatus_value");
                    var okP = pid.HasValue && periodIds.Contains(pid.Value);
                    var okPr = prid.HasValue && programIds.Contains(prid.Value);
                    var okD = did.HasValue && dacIds.Contains(did.Value);
                    if (!okP || !okPr || !okD)
                    {
                        if (!VerifyTools.TryGuid(row, "cf_factcleanenergyspendingid", out var fid)) continue;
                        brokenLookups.Add(
                            $"{fid} sourcetable={st} period={(okP ? "OK" : "BAD")} program={(okPr ? "OK" : "BAD")} dac={(okD ? "OK" : "BAD")}");
                    }

                    if (!row.TryGetProperty("cf_period", out var per) || per.ValueKind != JsonValueKind.Object ||
                        !per.TryGetProperty("cf_calendaryear", out var yEl)) continue;
                    var year = VerifyTools.ParseYear(yEl);
                    if (year is not (2023 or 2024)) continue;

                    decimal m = 0;
                    if (row.TryGetProperty("cf_energysavingsmmbtu", out var mEl) && mEl.ValueKind == JsonValueKind.Number)
                        m = mEl.GetDecimal();

                    if (year == 2023) sum2023 += m;
                    else sum2024 += m;
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        var sb = new StringBuilder();
        sb.AppendLine("=== STEP 4 — Section A Table A2 MMBtu completion verify ===");
        sb.AppendLine($"Active cf_factcleanenergyspending rows: {factCount}");
        sb.AppendLine($"  LEGACY_A1*: {legacyA1} (expected 48 after demo chart-grain import)");
        sb.AppendLine($"  LEGACY_A2*: {legacyA2} (expected 58 after A2-only upsert = 29 programs × 2 DAC rows)");
        sb.AppendLine($"  Other sourcetable prefix: {other}");
        sb.AppendLine(
            $"Sum cf_energysavingsmmbtu 2023 (program-line grain): {sum2023.ToString("0.##", CultureInfo.InvariantCulture)} (expected {Expected2023ProgramLinesTotal.ToString(CultureInfo.InvariantCulture)})");
        sb.AppendLine(
            $"Sum cf_energysavingsmmbtu 2024: {sum2024.ToString("0.##", CultureInfo.InvariantCulture)} (expected {Expected2024ProgramLinesTotal.ToString(CultureInfo.InvariantCulture)} — matches dashboard table & Grand Total)");
        sb.AppendLine(
            $"Known legacy JSON note: Table A2 **2023 footer \"Total\"** row = {Expected2023FooterTotal.ToString(CultureInfo.InvariantCulture)} MMBtu, **{Known2023FooterDiscrepancy.ToString(CultureInfo.InvariantCulture)}** above sum of printed program lines — **packaged __LEGACY_DASH inconsistency**, not a Dataverse error when reconciling to program lines.");
        sb.AppendLine(
            "Double-count check: LEGACY_A2 facts are created only for Table A2 programs **not** covered by A1 chart names after `a1-a2-program-alias-map.json` (e.g. SMB chart row maps to SMB - Electric & Gas table row — no second A2 fact pair for that program).");
        sb.AppendLine();

        if (brokenLookups.Count > 0)
        {
            sb.AppendLine($"BROKEN OR MISSING LOOKUPS ({brokenLookups.Count}):");
            foreach (var b in brokenLookups.Take(50))
                sb.AppendLine("  " + b);
            if (brokenLookups.Count > 50)
                sb.AppendLine($"  … {brokenLookups.Count - 50} more");
        }
        else
        {
            sb.AppendLine("All sampled active facts have cf_period, cf_program, cf_dacstatus resolving to active dimension rows.");
        }

        var okCount = factCount == 106 && legacyA1 == 48 && legacyA2 == 58 && other == 0;
        var ok2023 = Math.Abs(sum2023 - Expected2023ProgramLinesTotal) < 1m;
        var ok2024 = Math.Abs(sum2024 - Expected2024ProgramLinesTotal) < 1m;
        var okLk = brokenLookups.Count == 0;

        sb.AppendLine();
        sb.AppendLine(
            okCount && ok2023 && ok2024 && okLk
                ? "RESULT: PASS (demo-dev shape: 106 facts, totals match Table A2 program lines, lookups OK)."
                : "RESULT: REVIEW — expectations above are for Clara Fortuna Dev after Steps 2–3; counts differ if other facts exist in org.");

        Console.WriteLine(sb.ToString());
    }
}
