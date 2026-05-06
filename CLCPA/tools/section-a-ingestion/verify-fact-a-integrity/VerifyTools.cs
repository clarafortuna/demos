using System.Globalization;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

internal static class VerifyTools
{
    public static string FindClcpaRepoRoot(string searchStartDir)
    {
        var dir = searchStartDir;
        for (var i = 0; i < 20 && dir != null; i++)
        {
            var candidate = Path.Combine(dir, "src", "WebResources", "cf_clcpa_dash_legacy");
            if (File.Exists(candidate))
                return dir;
            dir = Directory.GetParent(dir)?.FullName;
        }

        throw new FileNotFoundException("Could not locate CLCPA repo root (cf_clcpa_dash_legacy).");
    }

    public static string FindIngestionToolDir()
    {
        var dir = AppContext.BaseDirectory;
        for (var i = 0; i < 22 && dir != null; i++)
        {
            if (File.Exists(Path.Combine(dir, "cf_FACT_legacyA1_demo.csv")))
                return dir;
            dir = Directory.GetParent(dir)?.FullName;
        }

        throw new FileNotFoundException("Could not find section-a-ingestion folder with cf_FACT_legacyA1_demo.csv.");
    }

    public static Dictionary<(int Year, string Name, bool IsDacRow), decimal> LoadLegacyExpectedFromRepo(string clcpaRepoRoot)
    {
        var legacyPath = Path.Combine(clcpaRepoRoot, "src", "WebResources", "cf_clcpa_dash_legacy");
        if (!File.Exists(legacyPath))
            throw new FileNotFoundException(legacyPath);

        var text = File.ReadAllText(legacyPath);
        var start = text.IndexOf("atob('", StringComparison.Ordinal);
        if (start < 0) throw new InvalidOperationException("atob not found in legacy web resource");
        start += "atob('".Length;
        var end = text.IndexOf("')", start, StringComparison.Ordinal);
        var b64 = text[start..end];
        var json = Encoding.UTF8.GetString(Convert.FromBase64String(b64));
        using var doc = JsonDocument.Parse(json);
        var charts = doc.RootElement.GetProperty("sectionA").GetProperty("charts");
        var expected = new Dictionary<(int, string, bool), decimal>();
        foreach (var prop in charts.EnumerateObject())
        {
            var m = Regex.Match(prop.Name, @"^A1_programs_(\d{4})$");
            if (!m.Success) continue;
            var year = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
            if (year != 2023 && year != 2024) continue;
            foreach (var row in prop.Value.EnumerateArray())
            {
                if (!row.TryGetProperty("name", out var nameEl)) continue;
                var name = nameEl.GetString() ?? "";
                if (string.IsNullOrWhiteSpace(name)) continue;
                if (!row.TryGetProperty("dac", out var dacEl) || !row.TryGetProperty("total", out var totEl)) continue;
                var dac = dacEl.GetDecimal();
                var total = totEl.GetDecimal();
                var nondac = total - dac;
                expected[(year, name, true)] = dac;
                expected[(year, name, false)] = nondac;
            }
        }

        return expected;
    }

    public static async Task<HashSet<Guid>> LoadActiveIdSet(HttpClient http, string set, string pk)
    {
        var ids = new HashSet<Guid>();
        var next = $"{set}?$select={pk}&$filter=statecode eq 0";
        while (next != null)
        {
            var isAbsolute = next.StartsWith("http", StringComparison.OrdinalIgnoreCase);
            using var resp = isAbsolute
                ? await http.GetAsync(next)
                : await http.GetAsync(next.TrimStart('/'));
            resp.EnsureSuccessStatusCode();
            using var stream = await resp.Content.ReadAsStreamAsync();
            using var doc = await JsonDocument.ParseAsync(stream);
            var root = doc.RootElement;
            if (root.TryGetProperty("value", out var arr))
            {
                foreach (var row in arr.EnumerateArray())
                {
                    if (TryGuid(row, pk, out var g))
                        ids.Add(g);
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        return ids;
    }

    public static async Task<Dictionary<Guid, int>> LoadPeriodYears(HttpClient httpMap)
    {
        var d = new Dictionary<Guid, int>();
        var next = "cf_dimperiods?$select=cf_dimperiodid,cf_calendaryear&$filter=statecode eq 0";
        while (next != null)
        {
            var isAbs = next.StartsWith("http", StringComparison.OrdinalIgnoreCase);
            using var resp = isAbs ? await httpMap.GetAsync(next) : await httpMap.GetAsync(next.TrimStart('/'));
            resp.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            var root = doc.RootElement;
            if (root.TryGetProperty("value", out var arr))
            {
                foreach (var row in arr.EnumerateArray())
                {
                    if (!TryGuid(row, "cf_dimperiodid", out var id)) continue;
                    if (!row.TryGetProperty("cf_calendaryear", out var yEl)) continue;
                    var y = ParseYear(yEl);
                    if (y > 0) d[id] = y;
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        return d;
    }

    public static async Task<Dictionary<Guid, string>> LoadProgramNames(HttpClient httpMap)
    {
        var d = new Dictionary<Guid, string>();
        var next = "cf_dimprograms?$select=cf_dimprogramid,cf_programname&$filter=statecode eq 0";
        while (next != null)
        {
            var isAbs = next.StartsWith("http", StringComparison.OrdinalIgnoreCase);
            using var resp = isAbs ? await httpMap.GetAsync(next) : await httpMap.GetAsync(next.TrimStart('/'));
            resp.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            var root = doc.RootElement;
            if (root.TryGetProperty("value", out var arr))
            {
                foreach (var row in arr.EnumerateArray())
                {
                    if (!TryGuid(row, "cf_dimprogramid", out var id)) continue;
                    if (!row.TryGetProperty("cf_programname", out var nEl)) continue;
                    var name = nEl.GetString();
                    if (!string.IsNullOrEmpty(name)) d[id] = name;
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        return d;
    }

    public static async Task<Dictionary<Guid, bool>> LoadDacFlags(HttpClient httpMap)
    {
        var d = new Dictionary<Guid, bool>();
        var next = "cf_dacstatuses?$select=cf_dacstatusid,cf_dacstatuscode,cf_dacstatuslabel&$filter=statecode eq 0";
        while (next != null)
        {
            var isAbs = next.StartsWith("http", StringComparison.OrdinalIgnoreCase);
            using var resp = isAbs ? await httpMap.GetAsync(next) : await httpMap.GetAsync(next.TrimStart('/'));
            resp.EnsureSuccessStatusCode();
            using var doc = await JsonDocument.ParseAsync(await resp.Content.ReadAsStreamAsync());
            var root = doc.RootElement;
            if (root.TryGetProperty("value", out var arr))
            {
                foreach (var row in arr.EnumerateArray())
                {
                    if (!TryGuid(row, "cf_dacstatusid", out var id)) continue;
                    var code = row.TryGetProperty("cf_dacstatuscode", out var cEl) ? (cEl.GetString() ?? "") : "";
                    var label = row.TryGetProperty("cf_dacstatuslabel", out var lEl) ? (lEl.GetString() ?? "") : "";
                    var blob = (code + " " + label).Trim();
                    if (string.Equals(code.Trim(), "NON_DAC", StringComparison.OrdinalIgnoreCase))
                    {
                        d[id] = false;
                        continue;
                    }

                    if (string.Equals(code.Trim(), "DAC", StringComparison.OrdinalIgnoreCase))
                    {
                        d[id] = true;
                        continue;
                    }

                    if (Regex.IsMatch(blob, @"NON[\s_-]*DAC|NON_DAC", RegexOptions.IgnoreCase))
                    {
                        d[id] = false;
                        continue;
                    }

                    var isDac = Regex.IsMatch(blob, @"\bDAC\b|DAC_|DISADVANTAGED|IN_DAC|INDAC|DAC_COMMUNITY", RegexOptions.IgnoreCase);
                    d[id] = isDac;
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        return d;
    }

    public static async Task<List<FactDto>> FetchFacts(HttpClient http)
    {
        var list = new List<FactDto>();
        var next =
            "cf_factcleanenergyspendings?$select=cf_factcleanenergyspendingid,cf_incentivedollars,_cf_period_value,_cf_program_value,_cf_dacstatus_value" +
            "&$filter=statecode eq 0";
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
                    if (!TryGuid(row, "cf_factcleanenergyspendingid", out var id)) continue;
                    row.TryGetProperty("_cf_period_value", out var pEl);
                    row.TryGetProperty("_cf_program_value", out var prEl);
                    row.TryGetProperty("_cf_dacstatus_value", out var dEl);
                    decimal? inc = null;
                    if (row.TryGetProperty("cf_incentivedollars", out var mEl) && mEl.ValueKind != JsonValueKind.Null)
                    {
                        if (mEl.ValueKind == JsonValueKind.Number)
                            inc = mEl.GetDecimal();
                        else if (mEl.ValueKind == JsonValueKind.String && decimal.TryParse(mEl.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out var dec))
                            inc = dec;
                    }

                    list.Add(new FactDto(
                        id,
                        ParseODataGuid(pEl),
                        ParseODataGuid(prEl),
                        ParseODataGuid(dEl),
                        inc));
                }
            }

            next = root.TryGetProperty("@odata.nextLink", out var nl) ? nl.GetString() : null;
        }

        return list;
    }

    public static Guid? ParseODataGuid(JsonElement root, string prop)
    {
        if (!root.TryGetProperty(prop, out var el)) return null;
        return ParseODataGuid(el);
    }

    public static Guid? ParseODataGuid(JsonElement el)
    {
        if (el.ValueKind == JsonValueKind.Null || el.ValueKind == JsonValueKind.Undefined)
            return null;
        if (el.ValueKind == JsonValueKind.String && Guid.TryParse(el.GetString(), out var g))
            return g;
        return null;
    }

    public static bool TryGuid(JsonElement row, string prop, out Guid g)
    {
        g = default;
        if (!row.TryGetProperty(prop, out var el)) return false;
        if (el.ValueKind == JsonValueKind.String && Guid.TryParse(el.GetString(), out g)) return true;
        return false;
    }

    public static int ParseYear(JsonElement yEl)
    {
        return yEl.ValueKind switch
        {
            JsonValueKind.Number when yEl.TryGetInt32(out var i) => i,
            JsonValueKind.String when int.TryParse(yEl.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var j) => j,
            _ => 0
        };
    }
}

internal readonly record struct FactDto(
    Guid Id,
    Guid? Period,
    Guid? Program,
    Guid? Dac,
    decimal? Incentive);
