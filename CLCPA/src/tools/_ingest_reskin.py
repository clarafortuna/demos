# One-off: align cf_clcpa_dac_shell ingestion panels with New update / shared.css chart-card layout.
import re

path = r"C:\Users\EurisDiaz\OneDrive - Clara Fortuna\Documents\02. CLCPA\CLCPA-full-numeric-lookuptypes-noids-src\WebResources\cf_clcpa_dac_shell"

def main():
    with open(path, "r", encoding="utf-8") as f:
        t = f.read()

    t = t.replace("shell-submission-zone", "ingest-submission-zone")
    t = t.replace("shell-form-grid", "form-grid")
    t = t.replace('class="shell-data-table"', 'class="data-table"')

    hero_map = [
        ("Clean Energy Spending", "A"),
        ("EV Make Ready", "B"),
        ("Demand Response", "C"),
        ("Distributed Energy Resources", "D"),
        ("Strategic Capital Investments", "E"),
        ("Customer Outages", "F"),
        ("Main Replacement (Section G)", "G"),
        ("Leak Repairs (Section H)", "H"),
        ("Clean Energy Jobs (Section I)", "I"),
        ("Customer Operations (Section J)", "J"),
    ]
    for title, letter in hero_map:
        pat = (
            r'      <div class="shell-page-header">\s*\n\s*<h1>'
            + re.escape(title)
            + r"</h1>\s*\n\s*<p class=\"shell-page-sub\">([^<]*)</p>\s*\n\s*</div>"
        )
        new = (
            "      <div class=\"chart-card ingest-section-hero\">\n"
            "        <div class=\"chart-card-head\">\n"
            "          <div>\n"
            f"            <h3>{title}</h3>\n"
            "            <p class=\"chart-sub\">\\1</p>\n"
            "          </div>\n"
            f"          <span class=\"chart-tag\">Section {letter}</span>\n"
            "        </div>\n"
            "      </div>"
        )
        t2, n = re.subn(pat, new, t, count=1)
        if n != 1:
            raise SystemExit("hero replace failed for %r count=%s" % (title, n))
        t = t2

    form_open = [
        '<h2 id="form-heading">New fact row</h2>',
        '<h2 id="b-form-heading">New fact row</h2>',
        '<h2 id="c-form-heading">New fact row</h2>',
        '<h2 id="d-form-heading">New fact row</h2>',
        '<h2 id="e-form-heading">New fact row</h2>',
        '<h2 id="sect-f-heading">New fact row</h2>',
        '<h2 id="sect-g-heading">New fact row</h2>',
        '<h2 id="sect-h-heading">New fact row</h2>',
        '<h2 id="sect-i-heading">New metric trio</h2>',
        '<h2 id="sect-j-heading">New metric trio</h2>',
    ]
    for h2line in form_open:
        h3line = h2line.replace("<h2 ", "<h3 ").replace("</h2>", "</h3>")
        oldb = (
            '      <div class="layout-2col">\n'
            '        <div class="card">\n'
            "          " + h2line + "\n"
        )
        newb = (
            '      <div class="chart-row cols-2 ingest-form-row">\n'
            '        <div class="chart-card ingest-panel-form">\n'
            '          <div class="chart-card-head">\n'
            "            <div>" + h3line + "</div>\n"
            "          </div>\n"
            '          <div class="chart-body">\n'
        )
        if oldb not in t:
            raise SystemExit("missing form open for %r" % h2line)
        t = t.replace(oldb, newb, 1)

    pat_saved_a = (
        r'        </div>\n'
        r'        <div class="card">\n'
        r'          <h2>Saved entries <span class="shell-count-badge" id="row-count-badge">0</span></h2>\n'
        r'          <p style="font-size:12px;color:var\(--text-3\);margin-top:0;">Loaded via Web API for the selected filter year.</p>\n'
        r'          <div style="overflow-x:auto;max-height:420px;overflow-y:auto;">'
    )
    rep_saved_a = (
        "        </div>\n"
        '        <div class="chart-card ingest-panel-grid">\n'
        '          <div class="chart-card-head">\n'
        "            <div>\n"
        '              <h3>Saved entries <span class="shell-count-badge" id="row-count-badge">0</span></h3>\n'
        '              <p class="chart-sub">Loaded via Web API for the selected reporting year.</p>\n'
        "            </div>\n"
        "          </div>\n"
        '          <div class="chart-body">\n'
        '          <div class="ingest-table-scroll" style="overflow-x:auto;max-height:420px;overflow-y:auto;">'
    )
    t, n = re.subn(pat_saved_a, rep_saved_a, t, count=1)
    if n != 1:
        raise SystemExit("saved A failed %s" % n)

    saved_ids = [
        "b-row-count-badge",
        "c-row-count-badge",
        "d-row-count-badge",
        "e-row-count-badge",
        "f-row-count-badge",
        "g-row-count-badge",
        "h-row-count-badge",
        "i-row-count-badge",
        "j-row-count-badge",
    ]
    for bid in saved_ids:
        p2 = re.compile(
            r'        </div>\n'
            r'        <div class="card">\n'
            r'          <h2>Saved entries <span class="shell-count-badge" id="'
            + re.escape(bid)
            + r'">0</span></h2>\n'
            r'          <p style="font-size:12px;color:var\(--text-3\);margin-top:0;">([^<]*)</p>\n'
            r'          <div style="overflow-x:auto;max-height:420px;overflow-y:auto;">'
        )
        rep2 = (
            "        </div>\n"
            '        <div class="chart-card ingest-panel-grid">\n'
            '          <div class="chart-card-head">\n'
            "            <div>\n"
            '              <h3>Saved entries <span class="shell-count-badge" id="'
            + bid
            + '">0</span></h3>\n'
            "              <p class=\"chart-sub\">\\1</p>\n"
            "            </div>\n"
            "          </div>\n"
            '          <div class="chart-body">\n'
            '          <div class="ingest-table-scroll" style="overflow-x:auto;max-height:420px;overflow-y:auto;">'
        )
        t2, n = re.subn(p2, rep2, t, count=1)
        if n != 1:
            raise SystemExit("saved block failed %s" % bid)
        t = t2

    pat_form_close = re.compile(
        r"(</form>)\n" r"        </div>\n" r'        <div class="chart-card ingest-panel-grid">'
    )

    def _close_form_row(m):
        return (
            m.group(1)
            + "\n          </div>\n        </div>\n        "
            + '<div class="chart-card ingest-panel-grid">'
        )

    t, n = re.subn(pat_form_close, _close_form_row, t)
    if n != 10:
        raise SystemExit("form close inject count %s" % n)

    pat_grid_close = re.compile(
        r'(<div class="empty" id="(?:[a-z0-9-]+)?grid-empty"[^>]*>[^<]*</div>\n)'
        r"          </div>\n"
        r"        </div>\n"
        r"      </div>\n"
        r"      </div>"
    )
    t, n = re.subn(pat_grid_close, r"\1          </div>\n          </div>\n        </div>\n      </div>\n      </div>", t)
    if n != 10:
        raise SystemExit("grid close count %s" % n)

    t = t.replace('class="form-actions"', 'class="ingest-form-actions"')

    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(t)
    print("ingestion panels updated OK")


if __name__ == "__main__":
    main()
