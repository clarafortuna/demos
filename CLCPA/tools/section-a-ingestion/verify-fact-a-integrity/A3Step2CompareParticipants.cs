using System.Globalization;
using System.Text;
using System.Text.Json;

internal static class A3Step2CompareParticipants
{
    /// <summary>
    /// STEP 2: Compare per-program A3 participant totals (legacy) vs sum of cf_participants on LEGACY_A1* + LEGACY_A2* facts (DAC + Non-DAC).
    /// Legacy JSON: <c>legacy-table-a3-extracted.json</c> in section-a-ingestion (Unified extract uses "2023"/"2024".programs; packaged CLCPA uses years2023/years2024.rows).
    /// </summary>
    public static async Task Run(HttpClient http, string legacyJsonPath)
    {
        if (!File.Exists(legacyJsonPath))
            throw new FileNotFoundException("Legacy A3 JSON not found.", legacyJsonPath);

        var legacyByYearProgram = LoadLegacyTotalsByYearProgram(legacyJsonPath);
        var periodYearById = await VerifyTools.LoadPeriodYears(http);
        var programNameById = await VerifyTools.LoadProgramNames(http);
        var facts = await VerifyTools.FetchLegacyFactsWithParticipants(http);

        var dvSum = new Dictionary<(int Year, string ProgKey), decimal>();
        foreach (var f in facts)
        {
            if (!f.Period.HasValue || !f.Program.HasValue) continue;
            if (!periodYearById.TryGetValue(f.Period.Value, out var year) || year is not (2023 or 2024)) continue;
            if (!programNameById.TryGetValue(f.Program.Value, out var pname) || string.IsNullOrWhiteSpace(pname)) continue;
            var key = (year, KeyName(pname));
            var add = f.Participants ?? 0;
            dvSum[key] = dvSum.GetValueOrDefault(key) + add;
        }

        var sb = new StringBuilder();
        sb.AppendLine("=== STEP 2 — Table A3 participants vs cf_factcleanenergyspending (LEGACY_A1* + LEGACY_A2*) ===");
        sb.AppendLine($"Legacy file: {legacyJsonPath}");
        sb.AppendLine("Ground truth: legacy **program-line** totals (2023 footer Total row is known inconsistent with lines).");
        sb.AppendLine();

        foreach (var year in new[] { 2023, 2024 })
        {
            var legacyPrograms = legacyByYearProgram.Where(kv => kv.Key.Year == year).OrderBy(kv => kv.Key.ProgKey).ToList();
            var legacyTotal = legacyPrograms.Sum(kv => kv.Value);

            var matched = 0;
            var mismatchLines = new List<string>();
            var legacyOnly = new List<string>();

            foreach (var ((y, progKey), legVal) in legacyPrograms)
            {
                if (!dvSum.TryGetValue((year, progKey), out var dvVal))
                {
                    legacyOnly.Add(
                        $"  legacy-only  year={year} program={Quote(progKey)} participants={Fmt(legVal)}");
                    continue;
                }

                if (Math.Abs((double)(dvVal - legVal)) < 0.5)
                    matched++;
                else
                {
                    mismatchLines.Add(
                        $"  MISMATCH year={year} program={Quote(progKey)} legacy={Fmt(legVal)} dvSum={Fmt(dvVal)} delta={Fmt(dvVal - legVal)}");
                }
            }

            var dvOnly = new List<string>();
            foreach (var ((y, progKey), dvVal) in dvSum.Where(kv => kv.Key.Year == year && kv.Value != 0).OrderBy(x => x.Key.ProgKey))
            {
                if (!legacyByYearProgram.ContainsKey((y, progKey)))
                    dvOnly.Add($"  dv-only      year={year} program={Quote(progKey)} dvSum={Fmt(dvVal)}");
            }

            var dvTotalForLegacyPrograms = legacyPrograms
                .Where(kv => dvSum.ContainsKey(kv.Key))
                .Sum(kv => dvSum[kv.Key]);

            sb.AppendLine($"--- {year} ---");
            sb.AppendLine($"Legacy program-line participant total: {Fmt(legacyTotal)}");
            sb.AppendLine($"Matched programs (dv sum ≈ legacy, tol=0.5): {matched} / {legacyPrograms.Count}");
            sb.AppendLine(
                $"Sum of DV totals for programs that exist in legacy A3: {Fmt(dvTotalForLegacyPrograms)} | delta vs legacy total: {Fmt(dvTotalForLegacyPrograms - legacyTotal)}");
            sb.AppendLine();

            if (mismatchLines.Count > 0)
            {
                sb.AppendLine("Per-program mismatches:");
                foreach (var m in mismatchLines)
                    sb.AppendLine(m);
                sb.AppendLine();
            }

            if (legacyOnly.Count > 0)
            {
                sb.AppendLine("In legacy A3 but no DV participant facts found for program name + year (after name norm):");
                foreach (var m in legacyOnly)
                    sb.AppendLine(m);
                sb.AppendLine();
            }

            if (dvOnly.Count > 0)
            {
                sb.AppendLine("DV has cf_participants sum but program+year not in legacy A3 extract (may be expected for non-A3 programs):");
                foreach (var m in dvOnly.Take(80))
                    sb.AppendLine(m);
                if (dvOnly.Count > 80)
                    sb.AppendLine($"  ... {dvOnly.Count - 80} more");
                sb.AppendLine();
            }
        }

        Console.WriteLine(sb.ToString());
    }

    static Dictionary<(int Year, string ProgKey), decimal> LoadLegacyTotalsByYearProgram(string path)
    {
        using var doc = JsonDocument.Parse(File.ReadAllText(path));
        var root = doc.RootElement;
        var d = new Dictionary<(int, string ProgKey), decimal>();

        void IngestArray(JsonElement arr, int yearFromCtx)
        {
            foreach (var row in arr.EnumerateArray())
            {
                if (!row.TryGetProperty("programName", out var nEl)) continue;
                var name = nEl.GetString()?.Trim() ?? "";
                if (string.IsNullOrEmpty(name)) continue;
                var y = yearFromCtx;
                if (row.TryGetProperty("year", out var yEl))
                {
                    var yr = VerifyTools.ParseYear(yEl);
                    if (yr > 0) y = yr;
                }

                if (y is not (2023 or 2024)) continue;
                decimal parts = 0;
                if (row.TryGetProperty("totalParticipants", out var pEl) && pEl.ValueKind == JsonValueKind.Number)
                    parts = pEl.GetDecimal();

                var key = (y, KeyName(name));
                d[key] = d.GetValueOrDefault(key) + parts;
            }
        }

        // Prefer flat "2023"/"2024" extract; else packaged years2023/years2024.
        if (root.TryGetProperty("2023", out var j2023) && j2023.TryGetProperty("programs", out var arr2023flat))
            IngestArray(arr2023flat, 2023);
        else if (root.TryGetProperty("years2023", out var bag23) && bag23.TryGetProperty("rows", out var rows23))
            IngestArray(rows23, 2023);

        if (root.TryGetProperty("2024", out var j2024) && j2024.TryGetProperty("programs", out var arr2024flat))
            IngestArray(arr2024flat, 2024);
        else if (root.TryGetProperty("years2024", out var bag24) && bag24.TryGetProperty("rows", out var rows24))
            IngestArray(rows24, 2024);

        if (d.Count == 0)
            throw new InvalidOperationException(
                "No A3 program rows parsed from JSON. Expected \"2023\".programs / \"2024\".programs or years2023.rows / years2024.rows.");

        return d;
    }

    static string KeyName(string s) => s.Trim().ToUpperInvariant();

    static string Fmt(decimal v) => v.ToString("0.##", CultureInfo.InvariantCulture);

    static string Quote(string s) => "\"" + s.Replace("\"", "\\\"") + "\"";
}
