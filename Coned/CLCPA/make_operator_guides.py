"""Render the four per-family operator guides that ship in docs/ as .docx.

THE PROSE IS NOT WRITTEN HERE
-----------------------------
operator-guides/approved-prose.txt holds the approved text of all four guides,
reviewed and signed off by Emely. This script does not author a sentence of it;
it parses that file and renders it. Two reasons that split is worth having:

  * the text a client reads is reviewable and diffable on its own, without
    reading Python around it;
  * a wording change is a change to a .txt, not a change to a generator, so
    nobody has to escape quotes to fix a sentence.

Every measured number, byte count, digest, count and duration in the guides
comes from that file verbatim. Nothing here computes or reformats one, and the
cross-check compares each of them against the file it describes.

WHY OOXML BY HAND
-----------------
python-docx is not installed and this repository has no package manager, by
design. A .docx is a zip of XML parts, so it is written here with the standard
library and nothing else. That also buys control of the zip entry timestamps:
every entry is pinned to the same 1980 epoch make_handoff_package.py uses, so
two builds are byte-identical and the package hash is stable.

THREE CONVENTIONS, ENFORCED RATHER THAN REMEMBERED
--------------------------------------------------
No em or en dashes. American spelling. No multi-line command continuations.
All three are checked at render time and all three are refusals, not warnings,
because a convention nobody enforces is a convention that drifts back.

Run:  python Coned/CLCPA/make_operator_guides.py
"""
import os
import re
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "operator-guides")
PROSE = os.path.join(OUT, "approved-prose.txt")

ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)

GUIDE_MARK = re.compile(r"^=====\s*GUIDE:\s*(\S+)\s*=====\s*$")
SHOT_MARK = re.compile(r"^\[SCREENSHOT:\s*([a-z0-9-]+)\]\s*$")

# The section headings, taken from the approved structure. Explicit rather than
# guessed: a heuristic that decides what is a heading by its shape would promote
# every short line, and these guides contain plenty of those.
HEADINGS = {
    "What you will do",
    "Before you start",
    "Where this sits in the order",
    "What goes in, what comes out",
    "Run it",
    "What you should see",
    "When the overlay is rebuilt, and when it is not",
    "If it refuses",
    "Check your file",
    "How long it should take",
    "Upload it",
}

LABELS = ("You see:", "It means:", "What to do:")

# F16. The one paragraph this script adds to the approved text, because the
# ticket asks for it here: the notebooks are not Colab-only, and an operator
# running them locally needs to know where the path override lives. Appended to
# Before you start, and nowhere else.
NOTEBOOK_LINE = (
    "If you would rather run this in a notebook, notebooks/ works in Google "
    "Colab, in Jupyter and in VS Code. Colab users upload the zip and run the "
    "Setup cell as it is; in Jupyter or VS Code, set ZIP_PATH at the top of "
    "that cell to wherever the zip actually is, or PKG_PATH if you have "
    "already unpacked it.")

# American spelling, since these go to a US client. The British form is the key
# so the refusal can name the American one to use instead.
BRITISH = {
    "neighbourhood": "neighborhood", "neighbourhoods": "neighborhoods",
    "colour": "color", "colours": "colors", "coloured": "colored",
    "programme": "program", "programmes": "programs",
    "enrolment": "enrollment", "enrolments": "enrollments",
    "finalised": "finalized", "organised": "organized",
    "recognised": "recognized", "labelled": "labeled",
    "centre": "center", "licence": "license", "analyse": "analyze",
    "behaviour": "behavior", "favourite": "favorite",
}


# --------------------------------------------------------------------------
# the smallest correct .docx
# --------------------------------------------------------------------------
CONTENT_TYPES = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>"""

ROOT_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>"""

DOC_RELS = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""

W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"'


def _style(sid, name, size, bold=False, color=None, before=0, after=120,
           mono=False, shade=None, italic=False, border=None, indent=None):
    font = "Consolas" if mono else "Calibri"
    rpr = '<w:rFonts w:ascii="%s" w:hAnsi="%s"/>' % (font, font)
    rpr += '<w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (size, size)
    if bold:
        rpr += "<w:b/>"
    if italic:
        rpr += "<w:i/>"
    if color:
        rpr += '<w:color w:val="%s"/>' % color
    ppr = '<w:spacing w:before="%d" w:after="%d"/>' % (before, after)
    if indent:
        ppr += '<w:ind w:left="%d" w:hanging="%d"/>' % indent
    if shade:
        ppr += '<w:shd w:val="clear" w:fill="%s"/>' % shade
    if border:
        sides = "".join(
            '<w:%s w:val="single" w:sz="6" w:space="3" w:color="%s"/>' % (s, border)
            for s in ("top", "left", "bottom", "right"))
        ppr += "<w:pBdr>%s</w:pBdr>" % sides
    return ('<w:style w:type="paragraph" w:styleId="%s"><w:name w:val="%s"/>'
            "<w:pPr>%s</w:pPr><w:rPr>%s</w:rPr></w:style>" % (sid, name, ppr, rpr))


STYLES = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
          "<w:styles %s>" % W
          + _style("Normal", "Normal", 22)
          + _style("Heading1", "heading 1", 36, bold=True, color="1F3864",
                   before=0, after=60)
          + _style("Subtitle", "Subtitle", 20, color="5F5E5A", before=0, after=280)
          + _style("Heading2", "heading 2", 28, bold=True, color="2E74B5",
                   before=320, after=140)
          + _style("Bullet", "List Bullet", 22, indent=(360, 360))
          + _style("CodeBlock", "Code Block", 19, color="1A1A1A", mono=True,
                   shade="F2F2F2", after=0)
          + _style("Shot", "Screenshot Marker", 20, bold=True, color="8A2318",
                   before=160, after=160, border="C9A0A0")
          + _style("Note", "Note", 21, color="404040", italic=True)
          + "</w:styles>")

CORE = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>%s</dc:title>
<dc:creator>Con Edison DAC dashboard</dc:creator>
<cp:revision>1</cp:revision>
</cp:coreProperties>"""


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def p(text, style="Normal"):
    return ('<w:p><w:pPr><w:pStyle w:val="%s"/></w:pPr>'
            '<w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>'
            % (style, esc(text)))


def bullet(text):
    return ('<w:p><w:pPr><w:pStyle w:val="Bullet"/></w:pPr>'
            '<w:r><w:t xml:space="preserve">%s%s</w:t></w:r></w:p>'
            % ("•  ", esc(text)))


def labeled(label, rest):
    """A You see / It means / What to do line: bold label, normal remainder."""
    return ('<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr>'
            '<w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">%s </w:t></w:r>'
            '<w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>'
            % (esc(label), esc(rest)))


def code_block(lines):
    return "".join(p(ln if ln.strip() else " ", "CodeBlock") for ln in lines)


# --------------------------------------------------------------------------
# the parser
# --------------------------------------------------------------------------
def split_guides(path):
    """{filename: [raw lines]} from the approved prose file."""
    guides, name, buf = {}, None, []
    with open(path, encoding="utf-8") as fh:
        for raw in fh:
            line = raw.rstrip("\n").rstrip("\r")
            m = GUIDE_MARK.match(line)
            if m:
                if name:
                    guides[name] = buf
                name, buf = m.group(1), []
                continue
            if name is not None:
                buf.append(line)
    if name:
        guides[name] = buf
    return guides


def render(lines):
    """Approved prose lines to an OOXML body, plus the screenshot names seen."""
    out, shots = [], []
    pending_code = []
    title_done = subtitle_done = False
    inserted_notebook_line = False
    section = None

    def flush_code():
        if pending_code:
            out.append(code_block(pending_code))
            del pending_code[:]

    for line in lines:
        stripped = line.strip()

        if not stripped:
            continue

        # An indented run is a set-apart block: a command, or sample output.
        # Consecutive indented lines group into ONE block; the flattened export
        # separates them with blank lines, which is why a blank does not break
        # the run.
        if line.startswith("  ") and not stripped.startswith("-"):
            pending_code.append(stripped)
            continue

        m = SHOT_MARK.match(stripped)
        if m:
            flush_code()
            shots.append(m.group(1))
            out.append(p("[SCREENSHOT: %s]" % m.group(1), "Shot"))
            continue

        flush_code()

        if not title_done:
            out.append(p(stripped, "Heading1"))
            title_done = True
            continue
        if not subtitle_done:
            out.append(p(stripped, "Subtitle"))
            subtitle_done = True
            continue

        if stripped in HEADINGS:
            # F16's extra line belongs at the END of Before you start, so it is
            # emitted when that section is left rather than when it is entered.
            if section == "Before you start" and not inserted_notebook_line:
                out.append(p(NOTEBOOK_LINE, "Note"))
                inserted_notebook_line = True
            section = stripped
            out.append(p(stripped, "Heading2"))
            continue

        if stripped.startswith("-"):
            out.append(bullet(stripped.lstrip("-").strip()))
            continue

        for lab in LABELS:
            if stripped.startswith(lab):
                out.append(labeled(lab, stripped[len(lab):].strip()))
                break
        else:
            out.append(p(stripped))

    flush_code()
    if not inserted_notebook_line:
        sys.exit("REFUSED: no Before you start section to attach the notebook "
                 "line to.")
    return "".join(out), shots


# --------------------------------------------------------------------------
# the conventions, as refusals
# --------------------------------------------------------------------------
def assert_no_long_dashes(name, text):
    bad = [w for ch, w in (("—", "em dash"), ("–", "en dash"),
                           ("&mdash;", "em dash entity"),
                           ("&ndash;", "en dash entity")) if ch in text]
    if bad:
        sys.exit("REFUSED: %s contains %s. Hyphens and commas only."
                 % (name, ", ".join(bad)))


def assert_american_spelling(name, text):
    low = text.lower()
    hits = sorted({"%s (use %s)" % (b, a) for b, a in BRITISH.items()
                   if re.search(r"\b%s\b" % b, low)})
    if hits:
        sys.exit("REFUSED: %s uses British spelling: %s" % (name, ", ".join(hits)))


def assert_single_line_commands(name, text):
    """F14. A command an operator copies has to be ONE line: a continuation
    arrives half-pasted, and the half that lands is a different command."""
    bad = [ln.strip() for ln in text.split("\n")
           if "python scripts/" in ln and ln.rstrip().endswith("\\")]
    if bad:
        sys.exit("REFUSED: %s has a multi-line command continuation: %s"
                 % (name, bad[0]))


def write_docx(path, title, body):
    document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<w:document %s><w:body>%s'
                '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
                '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>'
                "</w:sectPr></w:body></w:document>" % (W, body))
    parts = [
        ("[Content_Types].xml", CONTENT_TYPES),
        ("_rels/.rels", ROOT_RELS),
        ("docProps/core.xml", CORE % esc(title)),
        ("word/_rels/document.xml.rels", DOC_RELS),
        ("word/document.xml", document),
        ("word/styles.xml", STYLES),
    ]
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        for name, data in parts:
            zi = zipfile.ZipInfo(name, date_time=ZIP_EPOCH)
            zi.compress_type = zipfile.ZIP_DEFLATED
            zi.external_attr = 0o644 << 16
            z.writestr(zi, data.encode("utf-8"))


def main():
    if not os.path.exists(PROSE):
        sys.exit("REFUSED: %s is missing. It is the source of the guide text."
                 % PROSE)
    raw = open(PROSE, encoding="utf-8").read()
    assert_no_long_dashes("approved-prose.txt", raw)
    assert_american_spelling("approved-prose.txt", raw)
    assert_single_line_commands("approved-prose.txt", raw)

    guides = split_guides(PROSE)
    if len(guides) != 4:
        sys.exit("REFUSED: expected 4 guides in %s, found %d: %s"
                 % (PROSE, len(guides), ", ".join(sorted(guides))))

    total_shots = 0
    for name in sorted(guides):
        body, shots = render(guides[name])
        title = next((l.strip() for l in guides[name] if l.strip()), name)
        assert_no_long_dashes(name, body)
        assert_american_spelling(name, body)
        write_docx(os.path.join(OUT, name), title, body)
        total_shots += len(shots)
        print("%-34s %6d bytes   %d screenshots"
              % (name, os.path.getsize(os.path.join(OUT, name)), len(shots)))

    print("\n%d screenshot markers across %d guides" % (total_shots, len(guides)))
    print("written to %s" % OUT)


if __name__ == "__main__":
    main()
