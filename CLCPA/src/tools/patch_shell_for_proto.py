from pathlib import Path

SHELL = Path(__file__).resolve().parents[1] / "WebResources" / "cf_clcpa_dac_shell"


def main():
    s = SHELL.read_text(encoding="utf-8")
    orig = s

    if "USE_PROTO_DATA_INGESTION" not in s:
        s = s.replace(
            "  var dashAssetsPromise = null;\n  window.__DAC_SHELL_API = {",
            "  var dashAssetsPromise = null;\n"
            "  /** New update 55-table editors (localStorage) — cf_clcpa_dash_data_ingestion_page */\n"
            "  var USE_PROTO_DATA_INGESTION = true;\n"
            "  window.__DAC_SHELL_API = {",
        )

    s = s.replace(
        "    var ingestIy = document.getElementById('ingest-year-select');\n"
        "    var allSels = [fy, fl, fyb, fyc, fyd, fye, fyf, fyg, fyh, fyi, fyj, ingestIy];",
        "    var ingestIy = USE_PROTO_DATA_INGESTION ? null : document.getElementById('ingest-year-select');\n"
        "    var allSels = [fy, fl, fyb, fyc, fyd, fye, fyf, fyg, fyh, fyi, fyj];\n"
        "    if (ingestIy) allSels.push(ingestIy);",
    )

    s = s.replace(
        "    var ids = ['ingest-year-select', 'filter-year', 'f-year', 'b-f-year', 'c-f-year', 'd-f-year', 'e-f-year', 'f-f-year', 'g-f-year', 'h-f-year', 'i-f-year', 'j-f-year'];",
        "    var ids = USE_PROTO_DATA_INGESTION\n"
        "      ? ['filter-year', 'f-year', 'b-f-year', 'c-f-year', 'd-f-year', 'e-f-year', 'f-f-year', 'g-f-year', 'h-f-year', 'i-f-year', 'j-f-year']\n"
        "      : ['ingest-year-select', 'filter-year', 'f-year', 'b-f-year', 'c-f-year', 'd-f-year', 'e-f-year', 'f-f-year', 'g-f-year', 'h-f-year', 'i-f-year', 'j-f-year'];",
    )

    s = s.replace(
        "    if (activeSection === 'ingestion') reloadIngestionForLetter(ingestionLetter);",
        "    if (activeSection === 'ingestion' && !USE_PROTO_DATA_INGESTION) reloadIngestionForLetter(ingestionLetter);",
    )

    s = s.replace(
        "  function syncIngestToolbarTableSelect() {\n    var sel = document.getElementById('ingest-table-select');",
        "  function syncIngestToolbarTableSelect() {\n    if (USE_PROTO_DATA_INGESTION) return;\n    var sel = document.getElementById('ingest-table-select');",
    )

    s = s.replace(
        "  function reloadIngestionForLetter(letter) {\n    if (letter === 'a') return loadFacts();",
        "  function reloadIngestionForLetter(letter) {\n    if (USE_PROTO_DATA_INGESTION) return;\n    if (letter === 'a') return loadFacts();",
        1,
    )

    s = s.replace(
        "  function setIngestionLetter(letter) {\n    ingestionLetter = letter;",
        "  function setIngestionLetter(letter) {\n    if (USE_PROTO_DATA_INGESTION) return;\n    ingestionLetter = letter;",
        1,
    )

    s = s.replace(
        "    if (section === 'ingestion') {\n      setIngestionLetter(ingestionLetter);\n      return;\n    }",
        "    if (section === 'ingestion') {\n      if (!USE_PROTO_DATA_INGESTION) setIngestionLetter(ingestionLetter);\n      return;\n    }",
        1,
    )

    s = s.replace(
        "  function refreshDashboardForActiveSectionAfterSave(savedLetter) {\n    loadDashScripts().then(function () {\n      if (activeSection === 'ingestion') {",
        "  function refreshDashboardForActiveSectionAfterSave(savedLetter) {\n    if (USE_PROTO_DATA_INGESTION) return;\n    loadDashScripts().then(function () {\n      if (activeSection === 'ingestion') {",
        1,
    )

    s = s.replace(
        "  function summarize() {\n    var tInc = 0, tMmbtu = 0, tPart = 0;",
        "  function summarize() {\n    if (!document.getElementById('sum-rows')) return;\n    var tInc = 0, tMmbtu = 0, tPart = 0;",
        1,
    )
    s = s.replace(
        "  function renderGrid() {\n    var tb = document.getElementById('grid-body');\n    var empty = document.getElementById('grid-empty');",
        "  function renderGrid() {\n    var tb = document.getElementById('grid-body');\n    if (!tb) return;\n    var empty = document.getElementById('grid-empty');",
        1,
    )

    pairs = [
        ("summarizeB", "b-sum-rows", "renderGridB", "b-grid-body"),
        ("summarizeC", "c-sum-rows", "renderGridC", "c-grid-body"),
        ("summarizeD", "d-sum-rows", "renderGridD", "d-grid-body"),
        ("summarizeE", "e-sum-rows", "renderGridE", "e-grid-body"),
        ("summarizeF", "f-sum-rows", "renderGridF", "f-grid-body"),
        ("summarizeG", "g-sum-rows", "renderGridG", "g-grid-body"),
        ("summarizeH", "h-sum-rows", "renderGridH", "h-grid-body"),
        ("summarizeI", "i-sum-rows", "renderGridI", "i-grid-body"),
        ("summarizeJ", "j-sum-rows", "renderGridJ", "j-grid-body"),
    ]
    for sn, sid, rn, rid in pairs:
        s = s.replace(
            "  function %s() {\n" % sn,
            "  function %s() {\n    if (!document.getElementById('%s')) return;\n" % (sn, sid),
            1,
        )
        s = s.replace(
            "  function %s() {\n    var tb = document.getElementById('%s');\n    var empty ="
            % (rn, rid),
            "  function %s() {\n    var tb = document.getElementById('%s');\n    if (!tb) return;\n    var empty ="
            % (rn, rid),
            1,
        )

    old_block = """  document.getElementById('f-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('b-f-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('c-f-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('d-f-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('e-f-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('f-f-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('g-f-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('h-f-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('i-f-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('j-f-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('filter-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  var ingestYearSel = document.getElementById('ingest-year-select');
  if (ingestYearSel) ingestYearSel.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
  document.getElementById('btn-export-pdf').addEventListener('click', function () {
    window.print();
  });
  document.getElementById('btn-refresh').addEventListener('click', function () {
    applyFilterOrReload();
  });
  document.getElementById('spend-form').addEventListener('submit', saveRecordA);
  document.getElementById('btn-new').addEventListener('click', clearFormA);
  document.getElementById('ev-form').addEventListener('submit', saveRecordB);
  document.getElementById('b-btn-new').addEventListener('click', clearFormB);
  document.getElementById('dr-form').addEventListener('submit', saveRecordC);
  document.getElementById('c-btn-new').addEventListener('click', clearFormC);
  document.getElementById('der-form').addEventListener('submit', saveRecordD);
  document.getElementById('d-btn-new').addEventListener('click', clearFormD);
  document.getElementById('cap-form').addEventListener('submit', saveRecordE);
  document.getElementById('e-btn-new').addEventListener('click', clearFormE);
  document.getElementById('outage-form').addEventListener('submit', saveRecordF);
  document.getElementById('sect-f-btn-new').addEventListener('click', clearFormF);
  document.getElementById('mainrepl-form').addEventListener('submit', saveRecordG);
  document.getElementById('sect-g-btn-new').addEventListener('click', clearFormG);
  document.getElementById('leak-form').addEventListener('submit', saveRecordH);
  document.getElementById('sect-h-btn-new').addEventListener('click', clearFormH);
  document.getElementById('jobs-form').addEventListener('submit', saveRecordI);
  document.getElementById('sect-i-btn-new').addEventListener('click', clearFormI);
  document.getElementById('custops-form').addEventListener('submit', saveRecordJ);
  document.getElementById('sect-j-btn-new').addEventListener('click', clearFormJ);
"""
    new_block = """  (function wireLegacyIngestionUi() {
    var fy = document.getElementById('f-year');
    if (fy) fy.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    fy = document.getElementById('b-f-year');
    if (fy) fy.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    fy = document.getElementById('c-f-year');
    if (fy) fy.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    fy = document.getElementById('d-f-year');
    if (fy) fy.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    fy = document.getElementById('e-f-year');
    if (fy) fy.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    fy = document.getElementById('f-f-year');
    if (fy) fy.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    fy = document.getElementById('g-f-year');
    if (fy) fy.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    fy = document.getElementById('h-f-year');
    if (fy) fy.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    fy = document.getElementById('i-f-year');
    if (fy) fy.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    fy = document.getElementById('j-f-year');
    if (fy) fy.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    document.getElementById('filter-year').addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    if (!USE_PROTO_DATA_INGESTION) {
      var ingestYearSel = document.getElementById('ingest-year-select');
      if (ingestYearSel) ingestYearSel.addEventListener('change', function () { applyGlobalReportingYear(this.value); });
    }
  })();
  document.getElementById('btn-export-pdf').addEventListener('click', function () {
    window.print();
  });
  document.getElementById('btn-refresh').addEventListener('click', function () {
    applyFilterOrReload();
  });
  if (!USE_PROTO_DATA_INGESTION) {
    var _sf = document.getElementById('spend-form');
    if (_sf) _sf.addEventListener('submit', saveRecordA);
    _sf = document.getElementById('btn-new');
    if (_sf) _sf.addEventListener('click', clearFormA);
    _sf = document.getElementById('ev-form');
    if (_sf) _sf.addEventListener('submit', saveRecordB);
    _sf = document.getElementById('b-btn-new');
    if (_sf) _sf.addEventListener('click', clearFormB);
    _sf = document.getElementById('dr-form');
    if (_sf) _sf.addEventListener('submit', saveRecordC);
    _sf = document.getElementById('c-btn-new');
    if (_sf) _sf.addEventListener('click', clearFormC);
    _sf = document.getElementById('der-form');
    if (_sf) _sf.addEventListener('submit', saveRecordD);
    _sf = document.getElementById('d-btn-new');
    if (_sf) _sf.addEventListener('click', clearFormD);
    _sf = document.getElementById('cap-form');
    if (_sf) _sf.addEventListener('submit', saveRecordE);
    _sf = document.getElementById('e-btn-new');
    if (_sf) _sf.addEventListener('click', clearFormE);
    _sf = document.getElementById('outage-form');
    if (_sf) _sf.addEventListener('submit', saveRecordF);
    _sf = document.getElementById('sect-f-btn-new');
    if (_sf) _sf.addEventListener('click', clearFormF);
    _sf = document.getElementById('mainrepl-form');
    if (_sf) _sf.addEventListener('submit', saveRecordG);
    _sf = document.getElementById('sect-g-btn-new');
    if (_sf) _sf.addEventListener('click', clearFormG);
    _sf = document.getElementById('leak-form');
    if (_sf) _sf.addEventListener('submit', saveRecordH);
    _sf = document.getElementById('sect-h-btn-new');
    if (_sf) _sf.addEventListener('click', clearFormH);
    _sf = document.getElementById('jobs-form');
    if (_sf) _sf.addEventListener('submit', saveRecordI);
    _sf = document.getElementById('sect-i-btn-new');
    if (_sf) _sf.addEventListener('click', clearFormI);
    _sf = document.getElementById('custops-form');
    if (_sf) _sf.addEventListener('submit', saveRecordJ);
    _sf = document.getElementById('sect-j-btn-new');
    if (_sf) _sf.addEventListener('click', clearFormJ);
  }
"""
    if old_block not in s:
        raise SystemExit("legacy listener block not found")
    s = s.replace(old_block, new_block)

    old_dv = """  var addYearModal = document.getElementById('add-year-modal');
  if (addYearModal) {
    addYearModal.addEventListener('click', function (e) {
      if (e.target === addYearModal) addYearModal.hidden = true;
    });
  }
  var btnAddIngestYear = document.getElementById('btn-add-year');
  if (btnAddIngestYear) {
    btnAddIngestYear.addEventListener('click', function () {
      var inp = document.getElementById('add-year-input');
      if (inp) inp.value = '';
      if (addYearModal) addYearModal.hidden = false;
      setTimeout(function () { if (inp) inp.focus(); }, 50);
    });
  }
  var addYearCancel = document.getElementById('add-year-cancel');
  if (addYearCancel) {
    addYearCancel.addEventListener('click', function () {
      if (addYearModal) addYearModal.hidden = true;
    });
  }
  var addYearConfirm = document.getElementById('add-year-confirm');
  if (addYearConfirm) {
    addYearConfirm.addEventListener('click', function () {
      var inp = document.getElementById('add-year-input');
      var raw = inp ? String(inp.value).trim() : '';
      if (!/^\\d{4}$/.test(raw)) {
        showStatus('Enter a 4-digit year.', true);
        return;
      }
      addYearConfirm.disabled = true;
      createReportingYearFromTemplate(raw).then(function () {
        if (addYearModal) addYearModal.hidden = true;
      }).catch(function (e) {
        showStatus(e && e.message ? e.message : String(e), true);
      }).then(function () {
        addYearConfirm.disabled = false;
      });
    });
  }
  var btnDelIngestYear = document.getElementById('btn-delete-year');
  if (btnDelIngestYear) {
    btnDelIngestYear.addEventListener('click', function () {
      var iy = document.getElementById('ingest-year-select');
      if (!iy || !iy.value) return;
      var yDel = iy.value;
      if (!window.confirm('Delete ALL fact rows in ALL sections (A–J) tied to reporting year ' + yDel + ', then remove every DIM PERIOD row for that year? This cannot be undone.')) return;
      btnDelIngestYear.disabled = true;
      deleteReportingYearCascade(yDel).catch(function (e) {
        showStatus(e && e.message ? e.message : String(e), true);
      }).then(function () {
        btnDelIngestYear.disabled = false;
      });
    });
  }
"""
    new_dv = """  if (!USE_PROTO_DATA_INGESTION) {
  var addYearModal = document.getElementById('add-year-modal');
  if (addYearModal) {
    addYearModal.addEventListener('click', function (e) {
      if (e.target === addYearModal) addYearModal.hidden = true;
    });
  }
  var btnAddIngestYear = document.getElementById('btn-add-year');
  if (btnAddIngestYear) {
    btnAddIngestYear.addEventListener('click', function () {
      var inp = document.getElementById('add-year-input');
      if (inp) inp.value = '';
      if (addYearModal) addYearModal.hidden = false;
      setTimeout(function () { if (inp) inp.focus(); }, 50);
    });
  }
  var addYearCancel = document.getElementById('add-year-cancel');
  if (addYearCancel) {
    addYearCancel.addEventListener('click', function () {
      if (addYearModal) addYearModal.hidden = true;
    });
  }
  var addYearConfirm = document.getElementById('add-year-confirm');
  if (addYearConfirm) {
    addYearConfirm.addEventListener('click', function () {
      var inp = document.getElementById('add-year-input');
      var raw = inp ? String(inp.value).trim() : '';
      if (!/^\\d{4}$/.test(raw)) {
        showStatus('Enter a 4-digit year.', true);
        return;
      }
      addYearConfirm.disabled = true;
      createReportingYearFromTemplate(raw).then(function () {
        if (addYearModal) addYearModal.hidden = true;
      }).catch(function (e) {
        showStatus(e && e.message ? e.message : String(e), true);
      }).then(function () {
        addYearConfirm.disabled = false;
      });
    });
  }
  var btnDelIngestYear = document.getElementById('btn-delete-year');
  if (btnDelIngestYear) {
    btnDelIngestYear.addEventListener('click', function () {
      var iy = document.getElementById('ingest-year-select');
      if (!iy || !iy.value) return;
      var yDel = iy.value;
      if (!window.confirm('Delete ALL fact rows in ALL sections (A–J) tied to reporting year ' + yDel + ', then remove every DIM PERIOD row for that year? This cannot be undone.')) return;
      btnDelIngestYear.disabled = true;
      deleteReportingYearCascade(yDel).catch(function (e) {
        showStatus(e && e.message ? e.message : String(e), true);
      }).then(function () {
        btnDelIngestYear.disabled = false;
      });
    });
  }
  }
"""
    if old_dv not in s:
        raise SystemExit("Dataverse year modal block not found")
    s = s.replace(old_dv, new_dv)

    old_tabs = """  ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].forEach(function (Ltr) {
    document.getElementById('ingest-tab-' + Ltr).addEventListener('click', function () {
      ingestionLetter = Ltr;
      if (activeSection === 'ingestion') {
        setIngestionLetter(Ltr);
      } else {
        setSection('ingestion');
      }
    });
  });
"""
    if old_tabs not in s:
        raise SystemExit("ingest-tab forEach not found")
    s = s.replace(old_tabs, "  /* ingest-tab handlers removed — prototype binds .ingest-sec-btn */\n")

    if s == orig:
        raise SystemExit("no changes applied")
    SHELL.write_text(s, encoding="utf-8", newline="\n")
    print("patched OK", SHELL)


if __name__ == "__main__":
    main()
