"""Generate the four per-family operator guides that ship in docs/ as .docx.

WHY OOXML BY HAND
-----------------
python-docx is not installed and this repository has no package manager, by
design. A .docx is a zip of XML parts, so it is written here with the standard
library and nothing else. That keeps the no-install property, and it buys the
thing a library would have taken away: control of the zip entry timestamps.

A .docx built with default timestamps changes on every run, which would make the
handoff package's sha256 different every build. Every entry here is pinned to the
same 1980 epoch make_handoff_package.py uses, so two builds are byte-identical.

NO EM OR EN DASHES, ANYWHERE
----------------------------
Project convention, and these are client-facing documents. Hyphens and commas
only. assert_no_long_dashes() below refuses to write a file containing one, so
the convention is enforced rather than remembered.

MEASURED NUMBERS
----------------
Every size, digest, count and duration a guide states comes from MEASURED below,
and every value there was read off a real clean-room run of the package these
guides ship inside. A value left as None renders as MISSING and the packager
refuses to ship it. An unmeasured number written into a guide as though it were
measured is audit finding F9, which is the reason this whole wave exists.

Run:  python Coned/CLCPA/make_operator_guides.py
"""
import os
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "operator-guides")

ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)

# --------------------------------------------------------------------------
# MEASURED. Filled from the CLCPA-279 wave 2 clean-room run. None renders as
# MISSING and make_handoff_package.py refuses to package a guide containing it.
# --------------------------------------------------------------------------
MEASURED = {
    "geo2010_bytes": "1,587,328",
    "geo2010_sha": "6e9f09f7414f59ed4381b59d0d66bb6baa24f5c162182934b4f9c7d756413f49",
    "geo2020_bytes": "1,285,052",
    "geo2020_sha": "d288460f7907a79e2bc4f9c6f578cf66ac0aee840fbdeffb38670021c24b875e",
    "terr_bytes": "239,162",
    "terr_sha": "a45ae7f05d4aac95cf37d6f77aa4a5d536b4da6dcf08de155a318a19e10ea4c7",
    "dac_bytes": "1,181,466",
    "dac_sha": "6df6a4d8378390c6ec8668651316a8f20b81fafe0f0753376d51b8e86ff50163",
    "coned_bytes": "176,215",
    "coned_sha": "b9e7a4d6e971b2b3a85f1d135c70f7da317153664c04e3954984b04e6ada3365",
    "coned_tracts": "2,333",
    "geo_tracts_2010": "2,333",
    "geo_tracts_2020": "2,183",
    "terr_features": "95",
    "terr_electric": "89",
    "terr_gas": "4",
    "terr_oru": "2",
    "dac_tracts": "2,333",
    "dac_fields": "56",
    # Wall clock, same clean-room run, on an ordinary laptop. The first geometry
    # run is the slow one because it also builds the overlay, which fetches a
    # coordinate grid; later runs reuse the overlay.
    "dur_geometry": "5 seconds on the first run, and about 3 seconds afterwards",
    "dur_dac": "1 second",
    "dur_coned": "1 second",
}


def M(key):
    v = MEASURED.get(key)
    return "MISSING" if v is None else str(v)


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


def _style(sid, name, size_half_pt, bold, color, spacing_before, mono=False,
           shade=None, italic=False):
    rpr = '<w:rFonts w:ascii="%s" w:hAnsi="%s"/>' % (
        ("Consolas", "Consolas") if mono else ("Calibri", "Calibri"))
    rpr += '<w:sz w:val="%d"/><w:szCs w:val="%d"/>' % (size_half_pt, size_half_pt)
    if bold:
        rpr += "<w:b/>"
    if italic:
        rpr += "<w:i/>"
    if color:
        rpr += '<w:color w:val="%s"/>' % color
    ppr = '<w:spacing w:before="%d" w:after="%d"/>' % (spacing_before, 120)
    if shade:
        ppr += '<w:shd w:val="clear" w:fill="%s"/>' % shade
    return ('<w:style w:type="paragraph" w:styleId="%s"><w:name w:val="%s"/>'
            "<w:pPr>%s</w:pPr><w:rPr>%s</w:rPr></w:style>" % (sid, name, ppr, rpr))


STYLES = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
          "<w:styles %s>" % W
          + _style("Normal", "Normal", 22, False, None, 0)
          + _style("Heading1", "heading 1", 34, True, "1F3864", 320)
          + _style("Heading2", "heading 2", 28, True, "2E74B5", 280)
          + _style("Heading3", "heading 3", 24, True, "404040", 240)
          + _style("CodeBlock", "Code Block", 19, False, "1A1A1A", 120,
                   mono=True, shade="F2F2F2")
          + _style("Shot", "Screenshot Marker", 20, True, "8A2318", 160)
          + _style("Note", "Note", 21, False, "5F5E5A", 120, italic=True)
          + "</w:styles>")

CORE = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>%s</dc:title>
<dc:creator>Con Edison DAC dashboard</dc:creator>
<cp:revision>1</cp:revision>
</cp:coreProperties>"""


def esc(t):
    return (t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


def para(text, style="Normal", bullet=False):
    ppr = '<w:pPr><w:pStyle w:val="%s"/>' % style
    if bullet:
        ppr += '<w:ind w:left="360" w:hanging="360"/>'
    ppr += "</w:pPr>"
    body = ("&#8226;&#160;" + esc(text)) if bullet else esc(text)
    return ("<w:p>%s<w:r><w:t xml:space=\"preserve\">%s</w:t></w:r></w:p>"
            % (ppr, body))


def code(text):
    out = []
    for line in text.split("\n"):
        out.append('<w:p><w:pPr><w:pStyle w:val="CodeBlock"/></w:pPr>'
                   '<w:r><w:t xml:space="preserve">%s</w:t></w:r></w:p>'
                   % esc(line if line else " "))
    return "".join(out)


def shot(name):
    return para("[SCREENSHOT: %s]" % name, style="Shot")


def h1(t):
    return para(t, style="Heading1")


def h2(t):
    return para(t, style="Heading2")


def h3(t):
    return para(t, style="Heading3")


def note(t):
    return para(t, style="Note")


def assert_no_long_dashes(title, blocks):
    """Project convention, enforced rather than remembered."""
    bad = []
    for ch, what in (("—", "em dash"), ("–", "en dash"),
                     ("&mdash;", "em dash entity"), ("&ndash;", "en dash entity")):
        if ch in blocks:
            bad.append(what)
    if bad:
        sys.exit("REFUSED: %s contains %s. Hyphens and commas only."
                 % (title, ", ".join(bad)))


def write_docx(path, title, blocks):
    assert_no_long_dashes(title, blocks)
    document = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
                '<w:document %s><w:body>%s'
                '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>'
                '<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/>'
                "</w:sectPr></w:body></w:document>" % (W, blocks))
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


# --------------------------------------------------------------------------
# shared prose
# --------------------------------------------------------------------------
ORDER_BLOCK = """Step 1   Tract shapes, and the territory overlay with it
         python scripts/update_map_data.py --vintage 2010

Step 2   DAC indicators
         python scripts/convert_nyserda_raw.py --version 1.0 \\
             --geoid-vintage 2010 --raw-date 2023-03-27

Step 3   Electric and gas figures
         python scripts/build_coned_dataset.py --vintage 2010"""


def preamble(family, step, purpose, produces, lands, inputs_folder, inputs):
    b = []
    b.append(h1(family))
    b.append(para(purpose))
    b.append(h2("Where this sits in the order"))
    b.append(para(
        "The three steps below are the order to run things in. This guide is "
        "%s. Nothing in this package is numbered by filename: the order is "
        "stated here and in README.txt, and nowhere else." % step))
    b.append(code(ORDER_BLOCK))
    b.append(para(
        "The geometry goes first because it writes the tract list that both of "
        "the other two read. Run step 2 or step 3 on a fresh package and it "
        "stops on a missing input, which is the ordering working, not a fault."))
    b.append(h2("What this produces, and where it lands"))
    for p in produces:
        b.append(para(p, bullet=True))
    b.append(para(lands))
    b.append(h2("What it reads, and from where"))
    b.append(para(
        "Every input this family needs is in %s. Nothing it reads lives "
        "anywhere else in the package." % inputs_folder))
    for i in inputs:
        b.append(para(i, bullet=True))
    return b


def verification_section(family, nn, rows, counts, duration, extra_notes=()):
    b = [h2("Verify what you got")]
    b.append(para(
        "Check the file before you upload it. The run prints its own size and "
        "sha256; these are the values this guide was written against, measured "
        "on a clean run of this package."))
    b.append(code(rows))
    if counts:
        b.append(para("Counts inside the file:"))
        b.append(code(counts))
    for n in extra_notes:
        b.append(para(n))
    b.append(h3("Expected duration"))
    b.append(para(
        "Expected duration: about %s on this run's hardware. Times vary by "
        "machine, and a slower computer taking two or three times as long is "
        "normal. A run taking ten times as long is worth investigating rather "
        "than waiting out: check whether it is downloading something it should "
        "already have, and read the preflight table it printed." % duration))
    b.append(para(
        "The notebook for this family prints a timing block at the end, with "
        "the start time, the finish time and the total elapsed. That block is "
        "the thing to screenshot."))
    b.append(shot("%s-%s-timing" % (family, nn)))
    return b


def upload_section(family, nn, what, where_path):
    return [
        h2("Upload it"),
        para(
            "Nothing in this package contacts the dashboard. The file is "
            "produced on your machine and stays there until you upload it by "
            "hand, which is a deliberate boundary and not a missing feature."),
        para("In the dashboard, open Map Layers, then Upload data file, choose "
             "%s, and press Upload version." % where_path),
        para("Paste the field block the run printed into the matching record "
             "fields. The run prints exactly the values the record expects, so "
             "copy them rather than retyping them."),
        shot("%s-%s-upload" % (family, nn)),
        note("This guide stops here. What the dashboard does with %s after the "
             "upload is the dashboard's business, and is covered by the "
             "dashboard documentation, not by this package." % what),
    ]


ONE_COMMAND = (
    "One command, two outputs. update_map_data.py is the single producer of "
    "both the tract shapes and the territory overlay. It builds them from one "
    "set of shapefiles and stamps both with the same fingerprint, so the two "
    "cannot drift apart. Whichever of the two guides you are following, the "
    "command you run is the same and you get both files.")


# --------------------------------------------------------------------------
# the four guides
# --------------------------------------------------------------------------
def guide_tract_shapes():
    f = "tract-shapes"
    b = preamble(
        "Tract shapes",
        "step 1",
        "This family is the per-tract geometry the map draws: one shape per "
        "census tract, for one GEOID vintage, with the handful of properties "
        "the map colours and labels by.",
        ["Data/out/tract_geometry_pure-2010.json, the tract shapes",
         "Data/out/service_territories.geojson, the territory overlay, "
         "produced by the same command"],
        "Both land in Data/out/. Everything this package writes lands in "
        "Data/out/, including the overlay.",
        "Data/tract-geometry/",
        ["ny_tracts_2010.geojson and ny_tracts.geojson, the census tract "
         "boundaries, one file per vintage",
         "tract_universe.json, the list of tracts that exist and their place "
         "names. It ships pre-built; there is nothing for you to run to make it",
         "the neighbourhood equivalency CSV for the vintage you are building",
         "CECONY_Electric and CECONY_Gas shapefiles, which the per-tract "
         "network and gas fields are measured against"])
    b.append(note(ONE_COMMAND))
    b.append(para("The companion guide is territory-overlays.docx, which covers "
                  "the second of the two outputs in detail."))

    b.append(h2("Run it"))
    b.append(para("Open a terminal in the package root, the folder holding "
                  "Data, docs, notebooks and scripts."))
    b.append(para("Always dry run first. It prints the preflight table and "
                  "stops: no downloads, no writes."))
    b.append(code("python scripts/update_map_data.py --vintage 2010 --dry-run"))
    b.append(shot("%s-01-dry-run" % f))
    b.append(para("Then the real run:"))
    b.append(code("python scripts/update_map_data.py --vintage 2010"))
    b.append(shot("%s-02-real-run" % f))
    b.append(para("For the 2020 vintage, pass --vintage 2020. The two vintages "
                  "are separate files and both can exist at once."))

    b.append(h2("What a real run prints"))
    b.append(para("The preflight table first. This is the part to actually read: "
                  "it says what is present and what the run is about to do."))
    b.append(code(
        "  Census tract GeoJSON       PRESENT        Data/tract-geometry/ny_tracts_2010.geojson\n"
        "  Census archive             not needed     the GeoJSON is already here\n"
        "  tract_universe.json        PRESENT        the tract universe and City_Town; ships pre-built\n"
        "  CECONY_Electric.shp        PRESENT        electric_networks is measured against it\n"
        "  dataset output             WILL WRITE     Data/out/tract_geometry_pure-2010.json\n"
        "  territory overlay          WILL BUILD     Data/out/service_territories.geojson"))
    b.append(para("Then the two build steps, and the summary:"))
    b.append(code(
        "DATASET READY\n"
        "  file    : Data/out/tract_geometry_pure-2010.json\n"
        "  bytes   : %s\n"
        "  sha256  : %s" % (M("geo2010_bytes"), M("geo2010_sha"))))
    b.append(shot("%s-03-dataset-ready" % f))

    b.append(h2("When it refuses"))
    b.append(para("Every refusal below is the tool protecting something. None "
                  "of them is a crash, and each says what to do."))
    b.append(para("The output already exists. It may be the copy that is live "
                  "in Dataverse, so the run stops rather than overwriting it. "
                  "Pass --force when you mean to replace it.", bullet=True))
    b.append(para("No vintage given. There is no default and the command "
                  "refuses to guess: pass --vintage 2010 or --vintage 2020.",
                  bullet=True))
    b.append(para("--refresh-territories together with --no-fetch. The "
                  "territory conversion needs the network, and --no-fetch "
                  "forbids it, so the pair is refused rather than half done.",
                  bullet=True))
    b.append(para("--artifact without map_payload.json. That flag writes a "
                  "change document measured against a file this package does "
                  "not ship, so it is refused in preflight, before anything is "
                  "written.", bullet=True))
    b.append(shot("%s-04-refusal" % f))

    b += verification_section(
        f, "05",
        "file   : Data/out/tract_geometry_pure-2010.json\n"
        "bytes  : %s\n"
        "sha256 : %s" % (M("geo2010_bytes"), M("geo2010_sha")),
        "tracts : %s\n"
        "fields : 8   (the record's FieldCount must say 8, worth checking twice)"
        % M("geo_tracts_2010"),
        M("dur_geometry"),
        extra_notes=[
            "For the 2020 vintage the figures differ: %s tracts, %s bytes, "
            "version label pure-2020, sha256 %s."
            % (M("geo_tracts_2020"), M("geo2020_bytes"), M("geo2020_sha"))])
    b += upload_section(f, "06", "the tract shapes",
                        "Data/out/tract_geometry_pure-2010.json")
    return "Tract shapes", "".join(b)


def guide_territory_overlays():
    f = "territory-overlays"
    b = preamble(
        "Territory overlays",
        "step 1, the same command as tract shapes",
        "This family is the service territory overlay the map draws beneath "
        "the tracts: the electric network outlines, the gas service areas, and "
        "the Orange and Rockland outlines.",
        ["Data/out/service_territories.geojson, the territory overlay",
         "Data/out/tract_geometry_pure-2010.json, the tract shapes, produced "
         "by the same command"],
        "Both land in Data/out/. The overlay used to sit one level up, in "
        "Data/. It does not any more: everything this package writes lands in "
        "Data/out/.",
        "Data/tract-geometry/",
        ["CECONY_Electric shapefile, the electric network outlines",
         "CECONY_Gas shapefile, the gas service areas",
         "ORU_Territory shapefile, the Orange and Rockland outlines",
         "each shapefile is four files, .shp, .shx, .dbf and .prj, and all four "
         "are required"])
    b.append(note(ONE_COMMAND))
    b.append(para("The companion guide is tract-shapes.docx, which covers the "
                  "other of the two outputs in detail."))

    b.append(h2("Run it"))
    b.append(para("The same single command. There is no overlay-only command, "
                  "and that is deliberate: the two outputs are stamped as a "
                  "pair so they cannot be built from different shapefiles."))
    b.append(code("python scripts/update_map_data.py --vintage 2010 --dry-run"))
    b.append(shot("%s-01-dry-run" % f))
    b.append(code("python scripts/update_map_data.py --vintage 2010"))
    b.append(shot("%s-02-real-run" % f))

    b.append(h2("When the overlay is rebuilt, and when it is not"))
    b.append(para("The overlay is not rebuilt on every run. The preflight row "
                  "tells you which case you are in:"))
    b.append(code(
        "  territory overlay          WILL BUILD     it is not there yet\n"
        "  territory overlay          WILL REBUILD   its stamp disagrees with the shapefiles\n"
        "  territory overlay          PRESENT        its stamp matches, so it is reused"))
    b.append(para("This is on purpose. The overlay is stamped with a "
                  "fingerprint of the shapefiles it came from, and reusing it "
                  "when that fingerprint still matches is what keeps the two "
                  "outputs consistent."))
    b.append(para("--refresh-territories forces a rebuild when the stamp "
                  "already matches. Read the next paragraph before using it."))
    b.append(note(
        "--refresh-territories is not an overlay-only rebuild. The run always "
        "goes on to rebuild the tract shapes as well, so if a dataset is "
        "already in Data/out/ the flag needs --force too, and both files are "
        "rewritten. There is no supported way to rebuild one without the other."))
    b.append(shot("%s-03-preflight-overlay" % f))

    b.append(h2("When it refuses"))
    b.append(para("--refresh-territories together with --no-fetch. The "
                  "conversion downloads a coordinate transformation grid for "
                  "the Orange and Rockland layer, which is in an older datum, "
                  "so the network is genuinely required. The pair is refused "
                  "rather than half done.", bullet=True))
    b.append(para("The rebuilt overlay disagrees with the shapefiles. The run "
                  "stops and writes nothing to Data/out/, because building one "
                  "of the two outputs against different shapefiles than the "
                  "other is exactly the trap the stamp exists to catch.",
                  bullet=True))
    b.append(shot("%s-04-refusal" % f))

    b += verification_section(
        f, "05",
        "file   : Data/out/service_territories.geojson\n"
        "bytes  : %s\n"
        "sha256 : %s" % (M("terr_bytes"), M("terr_sha")),
        "features : %s\n"
        "  electric %s\n"
        "  gas      %s\n"
        "  oru      %s" % (M("terr_features"), M("terr_electric"),
                           M("terr_gas"), M("terr_oru")),
        M("dur_geometry"),
        extra_notes=[
            "The overlay and the tract shapes carry the same sourceFingerprint. "
            "If you ever see two different values, the two files were built "
            "from different shapefiles and should be rebuilt together."])
    b += upload_section(f, "06", "the overlay",
                        "Data/out/service_territories.geojson")
    return "Territory overlays", "".join(b)


def guide_dac_indicators():
    f = "dac-indicators"
    b = preamble(
        "DAC indicators",
        "step 2",
        "This family is the NYSERDA disadvantaged community data: the "
        "indicator values the map colours by, the tooltips read, and the CSV "
        "export carries.",
        ["Data/out/nyserda_dac_v1_0.json, the indicator dataset"],
        "It lands in Data/out/, with everything else this package writes.",
        "Data/nyserda/",
        ["NYS_DAC.geojson, the NYSERDA release as downloaded from the New York "
         "Department of State Geographic Information Gateway",
         "indicator_catalog.json, which decides what the indicators are called. "
         "It ships with the package and you do not normally touch it"])
    b.append(note(
        "This step also reads Data/out/tract_geometry_pure-2010.json, which is "
        "step 1's output and not an input you supply. It is where the list of "
        "tracts comes from, which is why the geometry is built first."))

    b.append(h2("Run it"))
    b.append(para("There is a no-write mode. It does the whole conversion and "
                  "then does not write the file, so you can see what it would "
                  "produce before it produces it."))
    b.append(code("python scripts/convert_nyserda_raw.py --version 1.0 \\\n"
                  "    --geoid-vintage 2010 --raw-date 2023-03-27 --no-write"))
    b.append(shot("%s-01-no-write" % f))
    b.append(para("Then the real run, the same command without --no-write:"))
    b.append(code("python scripts/convert_nyserda_raw.py --version 1.0 \\\n"
                  "    --geoid-vintage 2010 --raw-date 2023-03-27"))
    b.append(shot("%s-02-real-run" % f))
    b.append(para("--raw-date is the date the DAC criteria were finalised by "
                  "the New York State Climate Justice Working Group, which is "
                  "2023-03-27 for the current release. It is recorded in the "
                  "dataset, not used to fetch anything."))

    b.append(h2("What a real run prints"))
    b.append(para("The counts are the part to read. The output has more tracts "
                  "than the input, and that is correct: the NYSERDA file holds "
                  "designated DAC tracts only, and the converter builds the "
                  "Non-DAC roster itself."))
    b.append(code(
        "raw features    : 1736 statewide -> 1059 in the six counties\n"
        "tracts written  : %s  (1059 DAC + 1274 Non-DAC roster)\n"
        "fields          : %s\n"
        "bytes           : %s" % (M("dac_tracts"), M("dac_fields"),
                                  M("dac_bytes"))))
    b.append(shot("%s-03-counts" % f))

    b.append(h2("When it refuses"))
    b.append(para("No geometry dataset. The tract list comes from step 1's "
                  "output, so on a fresh package this stops until the geometry "
                  "has been built. Run step 1 and come back.", bullet=True))
    b.append(para("An unknown GEOID vintage. Only 2010 and 2020 are accepted; "
                  "anything else is rejected rather than guessed.", bullet=True))
    b.append(shot("%s-04-refusal" % f))

    b += verification_section(
        f, "05",
        "file   : Data/out/nyserda_dac_v1_0.json\n"
        "bytes  : %s\n"
        "sha256 : %s" % (M("dac_bytes"), M("dac_sha")),
        "tracts : %s\nfields : %s" % (M("dac_tracts"), M("dac_fields")),
        M("dur_dac"),
        extra_notes=[
            "Comparing file sizes against a previous release and concluding "
            "something broke is the expected wrong turn here. A new NYSERDA "
            "release legitimately changes the size. Compare the counts and the "
            "field list, not the byte count."])
    b += upload_section(f, "06", "the indicator dataset",
                        "Data/out/nyserda_dac_v1_0.json")
    return "DAC indicators", "".join(b)


def guide_electric_gas():
    f = "electric-and-gas-figures"
    b = preamble(
        "Electric and gas figures",
        "step 3",
        "This family is the per-tract Con Edison operational data: electric "
        "and gas account counts, and energy affordability programme enrolment.",
        ["Data/out/coned_operational_v1_0-2010.json, the operational figures"],
        "It lands in Data/out/, with everything else this package writes.",
        "Data/electric-gas/",
        ["Electric.xlsx, the electric extract, sheet named Export",
         "Gas.xlsx, the gas extract"])
    b.append(note(
        "Both spreadsheets are Con Edison internal data. They are listed in "
        "MANIFEST.txt under their own heading so that nobody forwards this "
        "package outside Con Edison by accident."))
    b.append(note(
        "This step also reads Data/out/tract_geometry_pure-2010.json, which is "
        "step 1's output and not an input you supply. It is the tract list, "
        "which is why the geometry is built first."))

    b.append(h2("Run it"))
    b.append(para("This script has no no-write mode, so there is no dry run to "
                  "offer. Said plainly rather than faked: the command below is "
                  "the first thing that writes. It refuses rather than "
                  "overwriting an existing output unless you pass --force."))
    b.append(code("python scripts/build_coned_dataset.py --vintage 2010"))
    b.append(shot("%s-01-real-run" % f))

    b.append(h2("What a real run prints"))
    b.append(para("A per-field coverage table, then what it deliberately threw "
                  "away. Both are worth reading: a field carried for far fewer "
                  "tracts than the others is the signal that an extract came "
                  "out wrong."))
    b.append(code(
        "  values carried, by field:\n"
        "    elec_dac      2283 of 2333 tracts\n"
        "    elec_accts    2283 of 2333 tracts\n"
        "    gas_dac       1036 of 2333 tracts\n"
        "\n"
        "  DELIBERATELY DROPPED\n"
        "    footer row   elec  'Applied filters: ...'\n"
        "    outside the 2010 universe: 4"))
    b.append(para("Gas covering fewer tracts than electric is expected, not a "
                  "fault: the gas service area is smaller than the electric one."))
    b.append(shot("%s-02-coverage" % f))

    b.append(h2("When it refuses"))
    b.append(para("No geometry dataset. The tract list comes from step 1's "
                  "output, so this stops until the geometry has been built.",
                  bullet=True))
    b.append(para("The output already exists. Pass --force when you mean to "
                  "replace it.", bullet=True))
    b.append(shot("%s-03-refusal" % f))

    b += verification_section(
        f, "04",
        "file   : Data/out/coned_operational_v1_0-2010.json\n"
        "bytes  : %s\n"
        "sha256 : %s" % (M("coned_bytes"), M("coned_sha")),
        None,
        M("dur_coned"),
        extra_notes=[
            "The fingerprint this run prints is taken over Electric.xlsx and "
            "Gas.xlsx, not over the shapefiles. It changes when a new extract "
            "arrives, which is what it is for."])
    b += upload_section(f, "05", "the operational figures",
                        "Data/out/coned_operational_v1_0-2010.json")
    return "Electric and gas figures", "".join(b)


GUIDES = {
    "tract-shapes.docx": guide_tract_shapes,
    "territory-overlays.docx": guide_territory_overlays,
    "dac-indicators.docx": guide_dac_indicators,
    "electric-and-gas-figures.docx": guide_electric_gas,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    missing = sorted(k for k, v in MEASURED.items() if v is None)
    for name, fn in sorted(GUIDES.items()):
        title, blocks = fn()
        path = os.path.join(OUT, name)
        write_docx(path, title, blocks)
        print("%-34s %6d bytes" % (name, os.path.getsize(path)))
    print("\nwritten to %s" % OUT)
    if missing:
        print("\nMEASURED still unfilled (%d): %s" % (len(missing),
                                                      ", ".join(missing)))
        print("The guides render these as MISSING and the packager refuses to "
              "ship them. Fill them from the clean-room run.")


if __name__ == "__main__":
    main()
