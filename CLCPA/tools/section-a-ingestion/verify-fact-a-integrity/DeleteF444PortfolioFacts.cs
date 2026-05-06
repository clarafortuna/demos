using System.Globalization;
using System.Net.Http.Headers;
using System.Text.Json;

/// <summary>Deletes all active facts whose primary key starts with f4444444 (portfolio roll-ups; not ConEd DAC report table grain).</summary>
internal static class DeleteF444PortfolioFacts
{
    public static async Task Run(HttpClient http)
    {
        const string prefix = "f4444444";
        var ids = new List<Guid>();
        var next = "cf_factcleanenergyspendings?$select=cf_factcleanenergyspendingid&$filter=statecode eq 0";
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
                    if (id.ToString("D", CultureInfo.InvariantCulture).StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                        ids.Add(id);
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        Console.WriteLine($"DELETE cf_factcleanenergyspending: {ids.Count} row(s) with id prefix {prefix} …");
        var deleted = 0;
        var notFound = 0;
        foreach (var id in ids)
        {
            using var req = new HttpRequestMessage(HttpMethod.Delete, $"cf_factcleanenergyspendings({id})");
            req.Headers.IfMatch.Add(EntityTagHeaderValue.Any);
            using var resp = await http.SendAsync(req);
            if (resp.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                notFound++;
                Console.WriteLine($"  {id} — already absent (404).");
                continue;
            }

            resp.EnsureSuccessStatusCode();
            deleted++;
            Console.WriteLine($"  {id} — deleted ({(int)resp.StatusCode}).");
        }

        Console.WriteLine($"Finished: deleted {deleted}, already absent {notFound}.");

        var activeTotal = await CountActiveFacts(http);
        var f444Remaining = await CountActiveByIdPrefix(http, prefix);
        Console.WriteLine($"Confirmation: active cf_factcleanenergyspending (statecode=0) = {activeTotal}; remaining id prefix {prefix} = {f444Remaining}.");
    }

    private static async Task<int> CountActiveFacts(HttpClient http)
    {
        var n = 0;
        var next = "cf_factcleanenergyspendings?$select=cf_factcleanenergyspendingid&$filter=statecode eq 0";
        while (next != null)
        {
            var isAbs = next.StartsWith("http", StringComparison.OrdinalIgnoreCase);
            using var resp = isAbs ? await http.GetAsync(new Uri(next)) : await http.GetAsync(next.TrimStart('/'));
            resp.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            var root = doc.RootElement;
            if (root.TryGetProperty("value", out var arr))
                n += arr.GetArrayLength();
            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        return n;
    }

    private static async Task<int> CountActiveByIdPrefix(HttpClient http, string prefix)
    {
        var n = 0;
        var next = "cf_factcleanenergyspendings?$select=cf_factcleanenergyspendingid&$filter=statecode eq 0";
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
                    if (id.ToString("D", CultureInfo.InvariantCulture).StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                        n++;
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        return n;
    }
}
