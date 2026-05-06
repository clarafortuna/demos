using System.Globalization;
using System.Text.Json;

/// <summary>Sums cf_energysavingsmmbtu on active facts by calendar year (cf_period).</summary>
internal static class MmbtuTotalsReport
{
    public static async Task Run(HttpClient http)
    {
        var flags = await VerifyTools.LoadDacFlags(http);

        decimal sum2023 = 0, sum2024 = 0, dac2023 = 0, nondac2023 = 0, dac2024 = 0, nondac2024 = 0;
        var count = 0;
        string? next =
            "cf_factcleanenergyspendings?$select=cf_energysavingsmmbtu,_cf_dacstatus_value" +
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
                    count++;
                    if (!row.TryGetProperty("cf_period", out var per) || per.ValueKind != JsonValueKind.Object ||
                        !per.TryGetProperty("cf_calendaryear", out var yEl))
                        continue;
                    var year = VerifyTools.ParseYear(yEl);
                    if (year is not (2023 or 2024)) continue;

                    decimal m = 0;
                    if (row.TryGetProperty("cf_energysavingsmmbtu", out var mEl) && mEl.ValueKind == JsonValueKind.Number)
                        m = mEl.GetDecimal();

                    var did = VerifyTools.ParseODataGuid(row, "_cf_dacstatus_value");
                    var isDac = did.HasValue && flags.TryGetValue(did.Value, out var d) && d;

                    if (year == 2023)
                    {
                        sum2023 += m;
                        if (isDac) dac2023 += m;
                        else nondac2023 += m;
                    }
                    else
                    {
                        sum2024 += m;
                        if (isDac) dac2024 += m;
                        else nondac2024 += m;
                    }
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl2) ? nl2.GetString() : null;
        }

        Console.WriteLine($"=== cf_energysavingsmmbtu totals (statecode=active), {count} fact row(s) in feed ===");
        Console.WriteLine(
            $"2023: total={sum2023.ToString("0.####", CultureInfo.InvariantCulture)} (DAC={dac2023.ToString("0.####", CultureInfo.InvariantCulture)}, non-DAC={nondac2023.ToString("0.####", CultureInfo.InvariantCulture)})");
        Console.WriteLine(
            $"2024: total={sum2024.ToString("0.####", CultureInfo.InvariantCulture)} (DAC={dac2024.ToString("0.####", CultureInfo.InvariantCulture)}, non-DAC={nondac2024.ToString("0.####", CultureInfo.InvariantCulture)})");
        Console.WriteLine(
            $"Combined 2023+2024: {(sum2023 + sum2024).ToString("0.####", CultureInfo.InvariantCulture)}");
    }
}
