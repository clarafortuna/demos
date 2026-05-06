# Copy New update ingestion JS into WebResources; empty #ingest-editor-area; align picker with prototype.
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NEW_JS = ROOT.parent / "New update" / "data_ingestion_page.js"
SHELL = ROOT / "WebResources" / "cf_clcpa_dac_shell"
OUT_JS = ROOT / "WebResources" / "cf_clcpa_dash_data_ingestion_page"


def patch_proto_js(src: str) -> str:
    old = """  document.addEventListener('DOMContentLoaded', () => {
    seedIfNeeded();
    renderToolbar();
    renderEditor();

    document.querySelectorAll('.ingest-sec-btn').forEach(btn => {
      btn.addEventListener('click', () => setSection(btn.getAttribute('data-letter')));
    });
    document.getElementById('ingest-year-select').addEventListener('change', (e) => {
      state.year = e.target.value;
      renderEditor();
    });
    document.getElementById('ingest-table-select').addEventListener('change', (e) => {
      state.table = e.target.value;
      renderEditor();
    });
    document.getElementById('btn-add-year').addEventListener('click', () => {
      document.getElementById('add-year-input').value = '';
      document.getElementById('add-year-modal').hidden = false;
      setTimeout(() => document.getElementById('add-year-input').focus(), 50);
    });
    document.getElementById('add-year-cancel').addEventListener('click', () => {
      document.getElementById('add-year-modal').hidden = true;
    });
    document.getElementById('add-year-confirm').addEventListener('click', handleAddYearConfirm);
    document.getElementById('btn-delete-year').addEventListener('click', handleDeleteYear);
  });
})();"""
    new = """  function bootProtoIngestionUi() {
    seedIfNeeded();
    renderToolbar();
    renderEditor();

    document.querySelectorAll('.ingest-sec-btn').forEach(btn => {
      btn.addEventListener('click', () => setSection(btn.getAttribute('data-letter')));
    });
    document.getElementById('ingest-year-select').addEventListener('change', (e) => {
      state.year = e.target.value;
      renderEditor();
    });
    document.getElementById('ingest-table-select').addEventListener('change', (e) => {
      state.table = e.target.value;
      renderEditor();
    });
    document.getElementById('btn-add-year').addEventListener('click', () => {
      document.getElementById('add-year-input').value = '';
      document.getElementById('add-year-modal').hidden = false;
      setTimeout(() => document.getElementById('add-year-input').focus(), 50);
    });
    document.getElementById('add-year-cancel').addEventListener('click', () => {
      document.getElementById('add-year-modal').hidden = true;
    });
    document.getElementById('add-year-confirm').addEventListener('click', handleAddYearConfirm);
    document.getElementById('btn-delete-year').addEventListener('click', handleDeleteYear);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootProtoIngestionUi);
  } else {
    bootProtoIngestionUi();
  }
})();"""
    if old not in src:
        raise SystemExit("Expected DOM tail not found in data_ingestion_page.js")
    return src.replace(old, new)


def replace_ingest_editor_area(html: str) -> str:
    i = html.find('<div id="ingest-editor-area">')
    if i < 0:
        raise SystemExit("ingest-editor-area not found")
    j = i + len('<div id="ingest-editor-area">')
    depth = 1
    pos = j
    while depth > 0 and pos < len(html):
        o = html.find("<div", pos)
        c = html.find("</div>", pos)
        if c < 0:
            raise SystemExit("unbalanced div")
        if o != -1 and o < c:
            depth += 1
            pos = o + 4
        else:
            depth -= 1
            pos = c + len("</div>")
    return html[:i] + '<div id="ingest-editor-area"></div>' + html[pos:]


def update_section_picker(html: str) -> str:
    html = html.replace(' data-ingest-letter="a"', ' data-letter="A"')
    html = html.replace(' data-ingest-letter="b"', ' data-letter="B"')
    html = html.replace(' data-ingest-letter="c"', ' data-letter="C"')
    html = html.replace(' data-ingest-letter="d"', ' data-letter="D"')
    html = html.replace(' data-ingest-letter="e"', ' data-letter="E"')
    html = html.replace(' data-ingest-letter="f"', ' data-letter="F"')
    html = html.replace(' data-ingest-letter="g"', ' data-letter="G"')
    html = html.replace(' data-ingest-letter="h"', ' data-letter="H"')
    html = html.replace(' data-ingest-letter="i"', ' data-letter="I"')
    html = html.replace(' data-ingest-letter="j"', ' data-letter="J"')
    for ch in "abcdefghij":
        html = re.sub(r' id="ingest-tab-%s"' % ch, "", html)
    html = html.replace(
        ' class="ingest-toolbar-select" aria-label="Active ingestion target" disabled="disabled"',
        ' class="ingest-toolbar-select" aria-label="Table within the selected section"',
    )
    return html


def main():
    if not NEW_JS.is_file():
        raise SystemExit("Missing %s" % NEW_JS)
    OUT_JS.write_text(patch_proto_js(NEW_JS.read_text(encoding="utf-8")), encoding="utf-8", newline="\n")

    html = SHELL.read_text(encoding="utf-8")
    html = replace_ingest_editor_area(html)
    html = update_section_picker(html)
    if "/WebResources/cf_clcpa_dash_data_ingestion_page" not in html:
        html = html.replace(
            "</body>",
            '\n<script type="text/javascript" src="/WebResources/cf_clcpa_dash_data_ingestion_page"></script>\n</body>',
            1,
        )
    html = html.replace(
        "Creates period rows in Dataverse by cloning the template from your latest calendar year (same grains and labels). Fact tables stay empty until you add rows. If your environment uses many period rows per year, confirm the copies in DIM PERIOD after running this.",
        "A new year will be created. Programs and measures from the most recent year will be copied as a template; values will be empty so you can fill them in. You can delete rows you don't need.",
    )
    SHELL.write_text(html, encoding="utf-8", newline="\n")
    print("OK:", OUT_JS.name, "+ shell HTML")


if __name__ == "__main__":
    main()
