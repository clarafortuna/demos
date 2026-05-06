using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

internal static class PopulateDimProgramReportingTable
{
    /// <summary>
    /// Rules: A1LG* → A1,A2; A2LG* → A2; A_* (seed portfolio) → A1,A2.
    /// </summary>
    internal static string ComputeReportingTable(string? programCode)
    {
        if (string.IsNullOrWhiteSpace(programCode)) return "";
        var c = programCode.Trim();
        if (c.StartsWith("A1LG", StringComparison.OrdinalIgnoreCase)) return "A1,A2";
        if (c.StartsWith("A2LG", StringComparison.OrdinalIgnoreCase)) return "A2";
        if (c.StartsWith("A_", StringComparison.Ordinal)) return "A1,A2";
        return "";
    }

    internal static async Task Run(HttpClient http)
    {
        var rows = await FetchActivePrograms(http);
        var patched = 0;
        var skipped = 0;
        var unknown = new List<string>();

        foreach (var row in rows)
        {
            if (!row.Id.HasValue || string.IsNullOrWhiteSpace(row.Code)) continue;
            var want = ComputeReportingTable(row.Code);
            if (string.IsNullOrEmpty(want))
            {
                unknown.Add($"{row.Code}\t{row.Name}");
                continue;
            }

            var current = row.ReportingTable?.Trim() ?? "";
            if (string.Equals(current, want, StringComparison.Ordinal))
            {
                skipped++;
                continue;
            }

            await PatchProgram(http, row.Id.Value, want);
            patched++;
            Console.WriteLine($"PATCH {row.Id:D} {row.Code} -> {want} (was \"{current}\")");
        }

        Console.WriteLine();
        Console.WriteLine($"populate-dimprogram-reporting-table: rows={rows.Count}, patched={patched}, unchanged={skipped}, unknown_code_pattern={unknown.Count}");
        if (unknown.Count > 0)
        {
            Console.WriteLine("--- Programs with cf_programcode not matching A1LG*/A2LG*/A_* (not patched) ---");
            foreach (var u in unknown)
                Console.WriteLine("  " + u);
        }
    }

    private sealed record ProgramRow(Guid? Id, string Code, string Name, string? ReportingTable);

    private static async Task<List<ProgramRow>> FetchActivePrograms(HttpClient http)
    {
        var list = new List<ProgramRow>();
        string? next =
            "cf_dimprograms?$select=cf_dimprogramid,cf_programcode,cf_programname,cf_reportingtable&$filter=statecode eq 0&$orderby=cf_programcode";
        while (next != null)
        {
            var isAbs = next.StartsWith("http", StringComparison.OrdinalIgnoreCase);
            using var resp = isAbs
                ? await http.GetAsync(new Uri(next))
                : await http.GetAsync(next.TrimStart('/'));
            if (!resp.IsSuccessStatusCode)
            {
                var errBody = await resp.Content.ReadAsStringAsync();
                throw new HttpRequestException(
                    $"GET cf_dimprograms failed {(int)resp.StatusCode}: {errBody}\n" +
                    "If the error mentions cf_reportingtable, import the schema patch (cf_dimprogram.cf_reportingtable) first, then re-run.");
            }
            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            var root = doc.RootElement;
            if (root.TryGetProperty("value", out var arr))
            {
                foreach (var el in arr.EnumerateArray())
                {
                    Guid? id = null;
                    if (el.TryGetProperty("cf_dimprogramid", out var idEl) &&
                        Guid.TryParse(idEl.GetString(), out var gid))
                        id = gid;
                    var code = el.TryGetProperty("cf_programcode", out var cEl) && cEl.ValueKind == JsonValueKind.String
                        ? cEl.GetString() ?? ""
                        : "";
                    var name = el.TryGetProperty("cf_programname", out var nEl) && nEl.ValueKind == JsonValueKind.String
                        ? nEl.GetString() ?? ""
                        : "";
                    string? rt = null;
                    if (el.TryGetProperty("cf_reportingtable", out var rtEl) && rtEl.ValueKind == JsonValueKind.String)
                        rt = rtEl.GetString();
                    list.Add(new ProgramRow(id, code, name, rt));
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) && nl.ValueKind == JsonValueKind.String
                ? nl.GetString()
                : null;
        }

        return list;
    }

    private static async Task PatchProgram(HttpClient http, Guid id, string value)
    {
        using var ms = new MemoryStream();
        await using (var w = new Utf8JsonWriter(ms))
        {
            w.WriteStartObject();
            w.WriteString("cf_reportingtable", value);
            w.WriteEndObject();
        }

        using var req = new HttpRequestMessage(new HttpMethod("PATCH"), $"cf_dimprograms({id:D})")
        {
            Content = new ByteArrayContent(ms.ToArray())
        };
        req.Content.Headers.ContentType = new MediaTypeHeaderValue("application/json");
        req.Headers.IfMatch.Add(EntityTagHeaderValue.Any);
        using var resp = await http.SendAsync(req);
        if (!resp.IsSuccessStatusCode)
        {
            var err = await resp.Content.ReadAsStringAsync();
            throw new HttpRequestException($"PATCH cf_dimprograms({id:D}) failed {(int)resp.StatusCode}: {err}");
        }
    }
}
