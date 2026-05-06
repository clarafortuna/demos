# -*- coding: utf-8 -*-
"""Split dashboard (visual-only) vs Data Ingestion; rewrite <main> inner only."""
import re
from pathlib import Path

SHELL = Path(
    r"c:\Users\EurisDiaz\OneDrive - Clara Fortuna\Documents\02. CLCPA\CLCPA-full-numeric-lookuptypes-noids-src\WebResources\cf_clcpa_dac_shell"
)

SECTION_META = {
    "a": "Clean Energy Spending",
    "b": "EV Make Ready",
    "c": "Demand Response",
    "d": "Distributed Energy Resources",
    "e": "Strategic Capital Investments",
    "f": "Customer Outages",
    "g": "Main Replacement (Section G)",
    "h": "Leak Repairs (Section H)",
    "i": "Clean Energy Jobs (Section I)",
    "j": "Customer Operations (Section J)",
}

ingest_names = {
    "a": "Clean Energy",
    "b": "EV Make-Ready",
    "c": "Demand Resp.",
    "d": "DER",
    "e": "Strategic Cap",
    "f": "Outages",
    "g": "Main Replace",
    "h": "Leak Repairs",
    "i": "Jobs",
    "j": "Cust Ops",
}


def slice_view_exec(body: str) -> str:
    start = body.find('<div id="view-exec"')
    if start == -1:
        raise SystemExit("view-exec missing")
    nxt = body.find('\n    <div id="view-a"', start)
    if nxt == -1:
        raise SystemExit("view-a after exec missing")
    return body[start:nxt]


def slice_view_block(body: str, letter: str) -> str:
    needle = f'<div id="view-{letter}"'
    start = body.find(needle)
    if start == -1:
        raise SystemExit(f"missing view-{letter}")
    nxt = body.find("\n    <div id=\"view-", start + 1)
    if nxt == -1:
        nxt = len(body)
    return body[start:nxt]


def parse_inner_no_outer(block: str, letter: str) -> str:
    lines = block.split("\n")
    while lines and not lines[-1].strip():
        lines.pop()
    if not lines or not lines[0].strip().startswith(f'<div id="view-{letter}"'):
        raise SystemExit(f"bad view-{letter} first line {lines[0] if lines else 'empty'}")
    inner_lines = lines[1:]
    if not inner_lines or inner_lines[-1].strip() != "</div>":
        raise SystemExit(f"bad view-{letter} close {inner_lines[-1] if inner_lines else 'empty'}")
    return "\n".join(inner_lines[:-1])


def strip_section_shell(visuals_block: str) -> str:
    visuals_block = visuals_block.strip()
    m = re.match(
        r'<section class="shell-visuals-panel"[^>]*>(.*)</section>\s*$',
        visuals_block,
        re.DOTALL,
    )
    if not m:
        raise SystemExit("could not parse visuals section")
    return m.group(1).strip()


def main() -> None:
    text = SHELL.read_text(encoding="utf-8").replace("\r\n", "\n").replace("\r", "\n")
    main_m = re.search(
        r'(<main class="content">)(.*?)(</main>\s*</div>)',
        text,
        re.DOTALL,
    )
    if not main_m:
        raise SystemExit("main not found")

    main_body = main_m.group(2)
    exec_block = slice_view_exec(main_body)

    picker_lines = []
    for L in "abcdefghij":
        lu = L.upper()
        active = " active" if L == "a" else ""
        picker_lines.append(
            f'      <button type="button" class="ingest-sec-btn{active}" data-ingest-letter="{L}" '
            f'id="ingest-tab-{L}" role="tab" aria-selected="{"true" if L == "a" else "false"}">'
            f'<span class="ingest-sec-btn-letter">{lu}</span>'
            f'<span class="ingest-sec-btn-name">{ingest_names[L]}</span></button>'
        )

    ingestion_header = (
        """    <div id="view-ingestion" class="section-view">
      <div class="shell-ingestion">
        <div class="shell-page-header shell-ingestion-header">
          <h1>Data Ingestion</h1>
          <p class="shell-page-sub">Add or edit Dataverse fact rows by section. Filter year and Reload apply to the submission section selected below.</p>
        </div>
        <div class="ingest-section-picker" id="ingest-section-picker" role="tablist" aria-label="Submission section">
"""
        + "\n".join(picker_lines)
        + "\n        </div>\n"
    )

    dash_blocks = []
    ingestion_panels = []

    for L in "abcdefghij":
        active_cls = " active" if L == "a" else ""
        block = slice_view_block(main_body, L)
        inner = parse_inner_no_outer(block, L)

        sub_i = inner.find('<div class="shell-submission-zone">')
        vis_i = inner.find('<section class="shell-visuals-panel"')
        if sub_i == -1 or vis_i == -1:
            raise SystemExit(f"submission or visuals missing in {L}")

        submission = inner[sub_i:vis_i].rstrip()
        visuals_outer = inner[vis_i:].strip()
        visuals_inner = strip_section_shell(visuals_outer)

        h1 = SECTION_META[L]
        dash_inner = (
            f'      <section class="shell-visuals-panel shell-visuals-panel--report" aria-label="Section {L.upper()} dashboard">\n'
            f'        <div class="shell-dashboard-header">\n'
            f"          <h1>{h1}</h1>\n"
            f'          <p class="shell-dashboard-sub">Report visuals and KPIs for Section {L.upper()}. '
            f"To submit data, open <strong>Data Ingestion</strong> in the sidebar.</p>\n"
            f"        </div>\n{visuals_inner}\n      </section>"
        )

        dash_blocks.append(
            f'    <div id="view-{L}" class="section-view{active_cls}">\n{dash_inner}\n    </div>'
        )

        pactive = " ingestion-panel--active" if L == "a" else ""
        ingestion_panels.append(
            f'        <div class="ingestion-panel{pactive}" id="ingestion-panel-{L}" '
            f'data-ingest-letter="{L}" role="tabpanel" aria-hidden="{"false" if L == "a" else "true"}">\n'
            f"{submission}\n        </div>"
        )

    ingestion_block = (
        ingestion_header + "\n".join(ingestion_panels) + "\n      </div>\n    </div>\n"
    )

    new_main_body = (
        "\n" + exec_block + "\n\n" + "\n\n".join(dash_blocks) + "\n\n" + ingestion_block + "\n"
    )

    new_text = text[: main_m.start(2)] + new_main_body + text[main_m.end(2) :]
    SHELL.write_text(new_text, encoding="utf-8")
    print("OK:", SHELL)


if __name__ == "__main__":
    main()
