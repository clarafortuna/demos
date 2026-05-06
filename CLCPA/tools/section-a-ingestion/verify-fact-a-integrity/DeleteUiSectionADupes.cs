using System.Net.Http.Headers;

/// <summary>Removes duplicate facts created from the Section A UI (cf_sourcetable = UI-SectionA).</summary>
internal static class DeleteUiSectionADupes
{
    private static readonly Guid[] Ids =
    {
        Guid.Parse("5ec5f7c6-8449-f111-bec6-7c1e521713fd"),
        Guid.Parse("5fc5f7c6-8449-f111-bec6-7c1e521713fd"),
        Guid.Parse("66c5f7c6-8449-f111-bec6-7c1e521713fd"),
        Guid.Parse("67c5f7c6-8449-f111-bec6-7c1e521713fd"),
    };

    public static async Task Run(HttpClient http)
    {
        Console.WriteLine("FIX 1: DELETE cf_factcleanenergyspending rows (UI-SectionA duplicates) …");
        foreach (var id in Ids)
        {
            using var req = new HttpRequestMessage(HttpMethod.Delete, $"cf_factcleanenergyspendings({id})");
            req.Headers.IfMatch.Add(EntityTagHeaderValue.Any);
            using var resp = await http.SendAsync(req);
            if (resp.StatusCode == System.Net.HttpStatusCode.NotFound)
            {
                Console.WriteLine($"  {id} — already absent (404).");
                continue;
            }

            resp.EnsureSuccessStatusCode();
            Console.WriteLine($"  {id} — deleted ({(int)resp.StatusCode}).");
        }

        Console.WriteLine("Verify: query remaining UI-SectionA facts …");
        using (var check = await http.GetAsync(
                   "cf_factcleanenergyspendings?$select=cf_factcleanenergyspendingid&$filter=cf_sourcetable eq 'UI-SectionA' and statecode eq 0"))
        {
            check.EnsureSuccessStatusCode();
            var json = await check.Content.ReadAsStringAsync();
            if (json.Contains("\"value\":[]", StringComparison.Ordinal))
                Console.WriteLine("  OK: no active rows with cf_sourcetable = UI-SectionA.");
            else
                Console.WriteLine("  WARNING: unexpected rows: " + json);
        }
    }
}
