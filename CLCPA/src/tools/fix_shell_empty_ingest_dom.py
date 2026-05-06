"""Guard shell JS when legacy A–J form markup was removed (empty #ingest-editor-area + prototype)."""
from pathlib import Path

SHELL = Path(__file__).resolve().parents[1] / "WebResources" / "cf_clcpa_dac_shell"


def main():
    t = SHELL.read_text(encoding="utf-8")
    orig = t

    old_loop = """    ys.forEach(function (y) {
      var o = document.createElement('option');
      o.value = String(y);
      o.textContent = String(y);
      fy.appendChild(o.cloneNode(true));
      fl.appendChild(o.cloneNode(true));
      fyb.appendChild(o.cloneNode(true));
      fyc.appendChild(o.cloneNode(true));
      fyd.appendChild(o.cloneNode(true));
      fye.appendChild(o.cloneNode(true));
      fyf.appendChild(o.cloneNode(true));
      fyg.appendChild(o.cloneNode(true));
      fyh.appendChild(o.cloneNode(true));
      fyi.appendChild(o.cloneNode(true));
      fyj.appendChild(o.cloneNode(true));
      if (ingestIy) ingestIy.appendChild(o.cloneNode(true));
    });
    if (ys.length) {
      fl.value = String(ys[0]);
      fy.value = String(ys[0]);
      fyb.value = String(ys[0]);
      fyc.value = String(ys[0]);
      fyd.value = String(ys[0]);
      fye.value = String(ys[0]);
      fyf.value = String(ys[0]);
      fyg.value = String(ys[0]);
      fyh.value = String(ys[0]);
      fyi.value = String(ys[0]);
      fyj.value = String(ys[0]);
      if (ingestIy) ingestIy.value = String(ys[0]);
    }"""
    new_loop = """    ys.forEach(function (y) {
      var o = document.createElement('option');
      o.value = String(y);
      o.textContent = String(y);
      var yearTargets = [fy, fl, fyb, fyc, fyd, fye, fyf, fyg, fyh, fyi, fyj, ingestIy];
      yearTargets.forEach(function (sel) {
        if (sel) sel.appendChild(o.cloneNode(true));
      });
    });
    if (ys.length) {
      var y0 = String(ys[0]);
      if (fl) fl.value = y0;
      if (fy) fy.value = y0;
      if (fyb) fyb.value = y0;
      if (fyc) fyc.value = y0;
      if (fyd) fyd.value = y0;
      if (fye) fye.value = y0;
      if (fyf) fyf.value = y0;
      if (fyg) fyg.value = y0;
      if (fyh) fyh.value = y0;
      if (fyi) fyi.value = y0;
      if (fyj) fyj.value = y0;
      if (ingestIy) ingestIy.value = y0;
    }"""
    if old_loop not in t:
        raise SystemExit("fillYearSelects loop block not found")
    t = t.replace(old_loop, new_loop, 1)

    pairs = [
        ("syncPeriodDropdown", "f-period", "f-year"),
        ("syncPeriodDropdownB", "b-f-period", "b-f-year"),
        ("syncPeriodDropdownC", "c-f-period", "c-f-year"),
        ("syncPeriodDropdownD", "d-f-period", "d-f-year"),
        ("syncPeriodDropdownE", "e-f-period", "e-f-year"),
        ("syncPeriodDropdownF", "f-f-period", "f-f-year"),
        ("syncPeriodDropdownG", "g-f-period", "g-f-year"),
        ("syncPeriodDropdownH", "h-f-period", "h-f-year"),
        ("syncPeriodDropdownI", "i-f-period", "i-f-year"),
        ("syncPeriodDropdownJ", "j-f-period", "j-f-year"),
    ]
    for fn, period_id, year_id in pairs:
        old = """  function %s() {
    var sel = document.getElementById('%s');
    var y = document.getElementById('%s').value;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
""" % (fn, period_id, year_id)
        new = """  function %s() {
    var sel = document.getElementById('%s');
    var yEl = document.getElementById('%s');
    if (!sel || !yEl) return;
    var y = yEl.value;
    while (sel.firstChild) sel.removeChild(sel.firstChild);
""" % (fn, period_id, year_id)
        if old not in t:
            raise SystemExit("sync block not found: " + fn)
        t = t.replace(old, new, 1)

    simple_fills = [
        ("fillProgramsDropdown", "'f-program'"),
        ("fillDacDropdown", "'f-dac'"),
        ("fillDacDropdownB", "'b-f-dac'"),
        ("fillProgramsDropdownC", "'c-f-program'"),
        ("fillDacDropdownC", "'c-f-dac'"),
        ("fillDacDropdownD", "'d-f-dac'"),
        ("fillDacDropdownF", "'f-f-dac'"),
        ("fillDacDropdownG", "'g-f-dac'"),
        ("fillDacDropdownH", "'h-f-dac'"),
        ("fillGeographyDropdownF", "'f-f-geo'"),
        ("fillGeographyDropdownG", "'g-f-geo'"),
        ("fillGeographyDropdownH", "'h-f-geo'"),
        ("fillGeographyDropdownJ", "'j-f-geo'"),
    ]
    for fn, gid in simple_fills:
        old = "  function %s() {\n    var sel = document.getElementById(%s);\n    while (sel.firstChild)" % (
            fn,
            gid,
        )
        new = "  function %s() {\n    var sel = document.getElementById(%s);\n    if (!sel) return;\n    while (sel.firstChild)" % (
            fn,
            gid,
        )
        if old not in t:
            raise SystemExit("fill not found: " + fn)
        t = t.replace(old, new, 1)

    old_i = """  function fillProgramsDropdownI() {
    var sel = document.getElementById('i-f-program');
    var hint = document.getElementById('i-program-hint');
    while (sel.firstChild) sel.removeChild(sel.firstChild);"""
    new_i = """  function fillProgramsDropdownI() {
    var sel = document.getElementById('i-f-program');
    var hint = document.getElementById('i-program-hint');
    if (!sel) return;
    while (sel.firstChild) sel.removeChild(sel.firstChild);"""
    if old_i not in t:
        raise SystemExit("fillProgramsDropdownI not found")
    t = t.replace(old_i, new_i, 1)

    old_warn = """        var warn = [];
        if (!document.getElementById('f-program').options.length) {
          warn.push('Section A: no programs (cf_sectioncode = A).');
        }
        if (!document.getElementById('c-f-program').options.length) {
          warn.push('Section C: no programs (cf_sectioncode = C).');
        }"""
    new_warn = """        var warn = [];
        var fpA = document.getElementById('f-program');
        if (fpA && !fpA.options.length) {
          warn.push('Section A: no programs (cf_sectioncode = A).');
        }
        var fpC = document.getElementById('c-f-program');
        if (fpC && !fpC.options.length) {
          warn.push('Section C: no programs (cf_sectioncode = C).');
        }"""
    if old_warn not in t:
        raise SystemExit("boot warn block not found")
    t = t.replace(old_warn, new_warn, 1)

    marker = """    return (rep[0] || list[0]).cf_dimperiodid;
  }

  function odataFetchUrl(fullUrl) {"""
    inject = """    return (rep[0] || list[0]).cf_dimperiodid;
  }

  function reportingYearForDataLoad() {
    var el = document.getElementById('filter-year');
    if (el && el.value) return el.value;
    var best = null;
    periods.forEach(function (p) {
      if (p.cf_calendaryear == null) return;
      var y = parseInt(p.cf_calendaryear, 10);
      if (isNaN(y) || y < DASHBOARD_MIN_REPORTING_YEAR || y > 2100) return;
      if (best == null || y > best) best = y;
    });
    return best != null ? String(best) : '';
  }

  function odataFetchUrl(fullUrl) {"""
    if marker not in t:
        raise SystemExit("periodGuidForYear marker not found")
    if "function reportingYearForDataLoad()" not in t:
        t = t.replace(marker, inject, 1)

    t = t.replace(
        "var year = document.getElementById('filter-year').value;",
        "var year = reportingYearForDataLoad();",
    )
    t = t.replace(
        "var fy = document.getElementById('filter-year').value;",
        "var fy = reportingYearForDataLoad();",
    )

    refresh_snips = [
        (
            "refreshPlugDatalist",
            "document.getElementById('b-plug-list')",
        ),
        (
            "refreshDerDatalist",
            "document.getElementById('d-dertype-list')",
        ),
        (
            "refreshInvCategoryDatalist",
            "document.getElementById('e-category-list')",
        ),
        (
            "refreshPipeActionDatalist",
            "document.getElementById('g-pipe-list')",
        ),
        (
            "refreshLeakTypeDatalist",
            "document.getElementById('h-leak-list')",
        ),
    ]
    for fn, getid in refresh_snips:
        old = "  function %s() {\n    var dl = %s;\n    while (dl.firstChild)" % (fn, getid)
        new = "  function %s() {\n    var dl = %s;\n    if (!dl) return Promise.resolve();\n    while (dl.firstChild)" % (
            fn,
            getid,
        )
        if old not in t:
            raise SystemExit("refresh not found: " + fn)
        t = t.replace(old, new, 1)

    render_guard_old = """  function renderGrid() {
    var tb = document.getElementById('grid-body');
    if (!tb) return;
    var empty = document.getElementById('grid-empty');
    while (tb.firstChild) tb.removeChild(tb.firstChild);
    document.getElementById('row-count-badge').textContent = String(stateA.facts.length);
    if (!stateA.facts.length) {
      empty.style.display = 'block';
      document.getElementById('grid').style.display = 'none';
      return;
    }
    empty.style.display = 'none';
    document.getElementById('grid').style.display = ''"""
    render_guard_new = """  function renderGrid() {
    var tb = document.getElementById('grid-body');
    if (!tb) return;
    var empty = document.getElementById('grid-empty');
    var badge = document.getElementById('row-count-badge');
    var gridEl = document.getElementById('grid');
    while (tb.firstChild) tb.removeChild(tb.firstChild);
    if (badge) badge.textContent = String(stateA.facts.length);
    if (!stateA.facts.length) {
      if (empty) empty.style.display = 'block';
      if (gridEl) gridEl.style.display = 'none';
      return;
    }
    if (empty) empty.style.display = 'none';
    if (gridEl) gridEl.style.display = ''"""
    if render_guard_old in t:
        t = t.replace(render_guard_old, render_guard_new, 1)

    if t == orig:
        raise SystemExit("no changes applied (already patched?)")

    SHELL.write_text(t, encoding="utf-8", newline="\n")
    print("OK", SHELL)


if __name__ == "__main__":
    main()
