"""Assemble the Con Edison handoff package: the scripts, the four operator
guides, their inputs, and a requirements file.

The package has to be self-sufficient in a clean directory with no access to this
repository. That is not asserted here -- `verify_handoff_package.py` unpacks the
zip somewhere else and runs each guide's commands against it.

WHAT GOES IN, AND THE TWO SCRIPTS THE BRIEF DID NOT NAME
--------------------------------------------------------
Five scripts were requested. Seven ship, because two are imported rather than
run, and a package without them fails on the first command:

    convert_nyserda_raw.py      imports build_tract_dataset  -->  ships
    build_coned_dataset.py      imports build_base_map_payload -->  ships

`build_tract_dataset.py` holds the manifest builder and the indicator-catalogue
loader; `build_base_map_payload.py` is where the spreadsheet reader lives, and
build_coned_dataset imports it rather than reimplementing the header matching.
Both are import-safe: each has an `if __name__ == "__main__"` guard, so importing
one does not run it.

LAYOUT (v3, CLCPA-279 wave 2)
-----------------------------
The shape is the instruction, and NOTHING IS NUMBERED. There are four output
families; every guide, notebook and input folder is named after one of them, and
the order to run them in is stated in README.txt and in each guide, never by a
digit in a filename.

    <root>/README.txt   the START HERE, at the root where an operator lands
    <root>/MANIFEST.txt every file in the package, with its full sha256
    <root>/Data/        inputs, one folder per family:
                          Data/nyserda/         convert_nyserda_raw.py's inputs
                          Data/tract-geometry/  the geometry chain's inputs
                          Data/electric-gas/    build_coned_dataset.py's inputs
                          Data/out/             EVERY output, nothing else
    <root>/docs/        four Word guides, one per family
    <root>/scripts/     every shipped .py, plus requirements.txt
    <root>/notebooks/   one Colab notebook per family, orchestrators only

Two changes in v3 are worth stating because they were code, not cosmetics:

  * the territory overlay was written to Data/ and is now written to Data/out/,
    so "everything lands in Data/out/" is true without an exception clause;
  * Data/ is organised by family, which moved the inputs the scripts resolve. The
    repository's Data/ has the same shape, so one path still serves both.

v1 put the .py files at the package root. They moved into scripts/ in v2 so the
root holds only the two files an operator reads first.

WHAT DOES NOT GO IN
-------------------
`Data/out/` ships EMPTY. Everything in it is an output, including the tract
geometry that the other two builders read as their tract universe -- so the
package's own first command produces it. Shipping a prebuilt copy would let an
operator run the DAC indicators successfully without ever running the geometry,
and never learn that the two are ordered.

The three numbered HTML guides no longer ship (v3). They stay in the repository
at operator-docs/ as history, untouched, and nothing in the package refers to
them.

`map_payload.json` no longer ships AT ALL. It was carried only to give the
geometry builder a list of tract numbers and City_Town, so a 4.8 MB file of
customer account data was being shipped to satisfy a dependency on ~71 KB of
information. `build_tract_universe.py` extracted the two into
`Data/tract-geometry/tract_universe.json` with its provenance recorded, the builder reads that,
and both vintages rebuild byte-identically through it.

Also excluded, each asserted at build time rather than merely listed:
`build_geometry_dataset.py` (the older 9-property builder, whose output the app
refuses), `build_tract_universe.py` (its only input is the file this package
excludes), our `check_*.py` guards, and the superseded `enrich_*` scripts.

CLIENT DATA, FLAGGED RATHER THAN QUIETLY BUNDLED
------------------------------------------------
Con Edison internal data, included because the scripts cannot run without it and
this package is FOR Con Edison, and listed in MANIFEST.txt under its own heading
so nobody forwards the package by accident:

    Electric.xlsx / Gas.xlsx  per-tract account counts and EAP enrolment
    tract-geometry/CECONY_*   the electric and gas network geometry

`app.js` no longer ships either. It was carried, all 800 KB of it, so that ONE
function could parse the indicator names out of `const MAP_INDICATOR_GROUPS` --
which slice 5d then retired. `build_indicator_catalog.py` froze that list into
`Data/nyserda/indicator_catalog.json` (6 KB) with the sha256 of the app.js it came from,
so the traceability is kept and the application stays out of the package.

Neither remaining generated input is customer data: `tract_universe.json` carries
tract numbers and place names, `indicator_catalog.json` carries indicator labels.
Both are public geography and public NYSERDA vocabulary.

Run:  python Coned/CLCPA/make_handoff_package.py [--out DIR]
"""
import argparse
import hashlib
import os
import shutil
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
DEV = os.path.join(HERE, "ExecutiveDashboard_dev")
DOCS = os.path.join(HERE, "operator-docs")          # the retired HTML guides
NOTEBOOKS_SRC = os.path.join(HERE, "operator-notebooks")
GUIDES_SRC = os.path.join(HERE, "operator-guides")  # the shipped Word guides

PKG_NAME = "coned-dac-dashboard-data-tools"

# (source path relative to DEV, destination relative to the package root)
# THE .py FILES LIVE IN scripts/ (CLCPA-279), not at the root and not in Data/.
#
# Data/ holds only inputs, docs/ only documentation, scripts/ only code, and the
# root only the two files an operator reads before anything else. It also keeps
# the commonest operator error this package can produce out of reach -- running a
# script from inside Data/, which fails on every input path.
#
# THIS MOVE REQUIRED A CODE CHANGE, and the reason is worth stating because the
# v1 comment here claimed the opposite. Each script anchors its inputs on its own
# __file__, and the v1 idiom knew exactly two layouts:
#
#     DATA = HERE if basename(HERE) == "Data" else join(HERE, "Data")
#
# which resolves a script in scripts/ to <root>/scripts/Data/ -- a folder that
# does not exist. Every script would have failed on its first input path. The six
# scripts that resolve their own paths now test three layouts (in Data/, at the
# root, in scripts/), so one copy still serves the repository and the package, and
# the clean-room proof still exercises the very file the repository holds.
# build_base_map_payload.py needs no anchor: it is imported, and takes its paths
# from the caller.
SCRIPTS = [
    ("Data/convert_nyserda_raw.py", "scripts/convert_nyserda_raw.py"),
    ("Data/build_tract_dataset.py", "scripts/build_tract_dataset.py"),
    ("Data/update_map_data.py", "scripts/update_map_data.py"),
    ("Data/build_pure_geometry_dataset.py", "scripts/build_pure_geometry_dataset.py"),
    ("Data/_make_territories.py", "scripts/_make_territories.py"),
    ("Data/build_coned_dataset.py", "scripts/build_coned_dataset.py"),
    ("Data/build_base_map_payload.py", "scripts/build_base_map_payload.py"),
]

# Deliberately NOT packaged. Asserted at build time below, not just listed here.
#
#   build_geometry_dataset.py   the OLDER builder. Produces 9 properties instead of
#                               8, so a file it builds is REFUSED by the app on the
#                               field-count check. Kept in the repository as a
#                               fallback; shipping it would place a wrong-output
#                               script beside the right one with nothing but a
#                               filename to tell them apart.
#   build_tract_universe.py     generates tract_universe.json FROM map_payload.json.
#                               Run once, by us, already done. Shipping it would ship
#                               a script whose only input this package excludes.
#   check_*.py                  our guards; they assert against repository state.
#   enrich_*.py, build_payload.py, retire_dead_payload_fields.py
#                               superseded or one-off.
MUST_NOT_SHIP = [
    "build_geometry_dataset.py",
    "build_tract_universe.py",
    "build_payload.py",
    "retire_dead_payload_fields.py",
    "map_payload.json",
    "app.js",
    # Writes to Con Edison's live Dataverse (creates and deletes rows in
    # cr2bf_dacmaptractdata). It is operational tooling for the CLCPA-191 rollback,
    # not a build step, and it has no business in a package meant to be run by
    # someone reproducing the inputs.
    "restore_map_tract_data.js",
]

# Whole DIRECTORIES that must never ship, matched by path prefix rather than by
# filename.
#
# Data/backups/ holds Dataverse exports taken before a destructive change -- the
# CLCPA-191 export of cr2bf_dacmaptractdata is the first. They are internal
# operational backups of Con Edison's own live table, they are the only rollback
# for the change they precede, and they have no business in a package whose whole
# point is "here is how you rebuild the inputs".
#
# A prefix rule, not a filename rule, and deliberately so: these files are dated,
# so listing cr2bf_dacmaptractdata_2026-08-24.json in MUST_NOT_SHIP would guard
# exactly one export and silently let the next one through. Elsewhere in this
# project substring matching on names has caused real damage (payload.json vs
# map_payload.json); the lesson is not "never match on prefixes", it is "match the
# thing you actually mean". Here the thing meant is the directory.
MUST_NOT_SHIP_DIRS = [
    "Data/backups/",
]

# Inputs the scripts read at runtime. `client` marks Con Edison internal data.
#
# Data/ IS ORGANISED BY OUTPUT FAMILY (CLCPA-279 wave 2). Every input sits in the
# folder of the family that eats it, and the repository's own Data/ has the same
# shape, so one path resolves both. The mapping was read out of the code, not
# assumed: see the fam() comment in any of the shipped scripts.
#
#   Data/nyserda/         convert_nyserda_raw.py's inputs
#   Data/tract-geometry/  the geometry chain's inputs
#   Data/electric-gas/    build_coned_dataset.py's inputs
#   Data/out/             every output, nothing else
GEO = "Data/tract-geometry/"
INPUTS = [
    ("Data/nyserda/indicator_catalog.json", "Data/nyserda/indicator_catalog.json", False,
     "the six indicator groups and fifty indicators the dataset manifest is built from; replaces app.js, which was carried only to be parsed for this"),
    (GEO + "tract_universe.json", GEO + "tract_universe.json", False,
     "the 2,333-GEOID tract universe and City_Town, with provenance recorded; "
     "replaces map_payload.json as the geometry builder's universe input"),
    ("Data/nyserda/NYS_DAC.geojson", "Data/nyserda/NYS_DAC.geojson", False,
     "NYSERDA DAC release, from the NY DOS Geographic Information Gateway"),
    (GEO + "ny_tracts.geojson", GEO + "ny_tracts.geojson", False,
     "US Census 2020 tract boundaries, converted; update_map_data can refetch"),
    (GEO + "ny_tracts_2010.geojson", GEO + "ny_tracts_2010.geojson", False,
     "US Census 2010 tract boundaries, converted; update_map_data can refetch"),
    (GEO + "2010_Census_Tract_to_Neighborhood_Tabulation_Area_Equivalency_table_20260806.csv",
     GEO + "2010_Census_Tract_to_Neighborhood_Tabulation_Area_Equivalency_table_20260806.csv",
     False, "NYC Open Data 8ius-dhrr"),
    (GEO + "2020_Census_Tracts_to_2020_NTAs_and_CDTAs_Equivalency_20260601.csv",
     GEO + "2020_Census_Tracts_to_2020_NTAs_and_CDTAs_Equivalency_20260601.csv",
     False, "NYC Open Data hm78-6dwm"),
    ("Data/electric-gas/Electric.xlsx", "Data/electric-gas/Electric.xlsx", True,
     "Con Edison electric extract"),
    ("Data/electric-gas/Gas.xlsx", "Data/electric-gas/Gas.xlsx", True,
     "Con Edison gas extract"),
]

# Every part of each shapefile the scripts touch. .shp alone is not a shapefile.
# They are geometry-chain inputs, so they sit in the tract-geometry family.
SHAPEFILES = ["CECONY_Electric", "CECONY_Gas", "ORU_Territory"]
SHAPE_PARTS = [".shp", ".shx", ".dbf", ".prj"]

# The operator guides: four Word documents, one per OUTPUT FAMILY, authored by
# make_operator_guides.py and shipped into docs/.
#
# The three numbered HTML guides no longer ship (CLCPA-279 wave 2 / R4). They
# stay in the repository at operator-docs/ as history, untouched. Nothing in the
# package refers to them any more: the README, the notebooks and the guides
# themselves name families, never numbers.
WORD_GUIDES = [
    "tract-shapes.docx",
    "territory-overlays.docx",
    "dac-indicators.docx",
    "electric-and-gas-figures.docx",
]

# One notebook per OUTPUT FAMILY, and deliberately NOT numbered.
#
# The guides are numbered by family (01, 02, 03) but run in the order 02, 01, 03,
# and that mismatch is audit finding F1. Numbering the notebooks would invent a
# second competing sequence and reproduce the same defect in a new place. Each
# notebook states its own place in the execution order in its header cell
# instead, which is the thing an operator actually needs.
#
# Four notebooks against three guides: guide 2 covers tract shapes AND territory
# overlays because one command produces both, and both notebooks say so.
NOTEBOOKS = [
    "dac-indicators.ipynb",
    "tract-shapes.ipynb",
    "territory-overlays.ipynb",
    "electric-and-gas-figures.ipynb",
]

REQUIREMENTS = """\
# Con Edison DAC dashboard - data tools
#
# The four guides need different things. Install what the guide you are
# following asks for; installing all of it is fine too.
#
# DAC indicators (convert_nyserda_raw.py)
#          Python standard library only. Nothing to install.
#
# Tract shapes and territory overlays (update_map_data.py)
pyshp>=3.0
pyproj>=3.7
shapely>=2.1
#
# Electric and gas figures (build_coned_dataset.py)
openpyxl>=3.1
#
# Verified on Python 3.14.5 with pyshp 3.0.9, pyproj 3.7.2, shapely 2.1.2.
"""

README = """\
Con Edison DAC dashboard - data tools
=====================================

Everything needed to rebuild the four kinds of data file the dashboard uses.

    Data/       the inputs, in one folder per output family
    scripts/    the scripts, and requirements.txt
    docs/       the operator guides, one per output family
    notebooks/  one notebook per output family, if you would rather run it there
    MANIFEST.txt  every file in this package, with its full sha256

Nothing here is numbered. There are four output families, and every guide,
notebook and input folder is named after the family it belongs to:

    tract shapes              the shapes the map draws, one per census tract
    territory overlays       the electric, gas and ORU outlines beneath them
    DAC indicators           the NYSERDA disadvantaged community values
    electric and gas figures  per-tract account counts and programme enrolment

The order to run them in is below. It is stated there and in the guides, never
by a number in a filename.

WHERE TO UNPACK IT (Windows)
----------------------------
Unpack somewhere SHALLOW. `C:\\coned-tools\\` is ideal; your Desktop is fine.

The longest path inside this package is %(longest)d characters, and Windows
refuses paths over 260 by default. Unpacking into a deep folder therefore fails
partway through with:

    [WinError 3] The system cannot find the path specified

which names no file and reads like a corrupt download. It is not -- it is the
path length. Keep the folder you unpack into under about 140 characters and it
cannot happen. This caught our own verification run, so it is not hypothetical.

FIRST: A VIRTUAL ENVIRONMENT
----------------------------
Do this before you run anything. It keeps these installs off your system Python,
which matters because this package pins versions of three geometry libraries.

    python -m venv .venv

    .venv\\Scripts\\activate            (Windows)
    source .venv/bin/activate         (macOS or Linux)

    pip install -r scripts/requirements.txt

The prompt gains a `(.venv)` prefix when it is active. If you open a new
terminal later, activate it again before running anything.

START HERE: ONE ORDER, AND IT IS THIS ONE
-----------------------------------------
Work down the three steps, reading each guide before running its command.

    Step 1    docs/tract-shapes.docx  and  docs/territory-overlays.docx
              python scripts/update_map_data.py --vintage 2010

              Tract shapes AND the territory overlay: one command, two outputs.
              Two guides cover it because they are two different families, but
              there is only ever one command to run.

              This goes FIRST, and the reason is the whole of the ordering: the
              tract shapes it writes ARE the list of tracts that steps 2 and 3
              read. Neither of them can decide which tracts exist on its own.

    Step 2    docs/dac-indicators.docx
              python scripts/convert_nyserda_raw.py --version 1.0 \\
                  --geoid-vintage 2010 --raw-date 2023-03-27

    Step 3    docs/electric-and-gas-figures.docx
              python scripts/build_coned_dataset.py --vintage 2010

`Data/out/` ships empty on purpose. Everything in it is an output, and step 1
produces the file steps 2 and 3 depend on, so running step 2 first fails on a
missing input rather than on anything being wrong with the package.

THE SCRIPTS, AND WHICH THREE YOU ACTUALLY RUN
---------------------------------------------
Seven scripts ship. You run THREE of them. The other four are called by those
three, or imported by them, and running one by hand is never part of any
procedure in this package.

YOU RUN THESE THREE:

    scripts/update_map_data.py
        Steps 1. Builds the tract shapes AND the territory overlay, in one
        command, and is the only thing that should build either.
        Eats:     Data/tract-geometry/
        Produces: Data/out/tract_geometry_pure-<vintage>.json
                  Data/out/service_territories.geojson

    scripts/convert_nyserda_raw.py
        Step 2. Turns the NYSERDA release into the indicator dataset.
        Eats:     Data/nyserda/  (and step 1's output, for the tract list)
        Produces: Data/out/nyserda_dac_v1_0.json

    scripts/build_coned_dataset.py
        Step 3. Turns the two Con Edison spreadsheets into per-tract figures.
        Eats:     Data/electric-gas/  (and step 1's output, for the tract list)
        Produces: Data/out/coned_operational_v1_0-<vintage>.json

YOU DO NOT RUN THESE FOUR:

    scripts/build_pure_geometry_dataset.py
        The geometry builder. update_map_data.py runs it for you, after it has
        checked the inputs and rebuilt the overlay when needed. Running it by
        hand skips those checks.

    scripts/_make_territories.py
        The overlay builder. update_map_data.py runs it for you. It is run as a
        separate step so that both outputs carry the same stamp.

    scripts/build_tract_dataset.py
        Imported by convert_nyserda_raw.py for the manifest builder and the
        indicator catalogue reader. Never run on its own.

    scripts/build_base_map_payload.py
        Imported by build_coned_dataset.py for the spreadsheet reader. Never run
        on its own.

If a script is not in the first list, no guide will ever ask you to type its
name.

HOW TO RUN ANYTHING
-------------------
Open a terminal in THIS folder -- the one holding `Data/`, `docs/` and
`scripts/` -- and invoke a script by its path:

    python scripts/update_map_data.py --vintage 2010

The scripts are in `scripts/`. Their inputs are in `Data/`. Each script finds
`Data/` from its own location rather than from your current folder, so it will
run correctly from anywhere -- but every path it PRINTS is relative to this
folder, so run them from here and the output reads as written.

WHERE THE INPUTS ARE
--------------------
One folder per family, holding exactly what that family reads:

    Data/nyserda/         NYS_DAC.geojson, indicator_catalog.json
    Data/tract-geometry/  the census tract boundaries per vintage, the tract
                          universe, the neighbourhood equivalency tables, and
                          the CECONY and ORU shapefiles
    Data/electric-gas/    Electric.xlsx, Gas.xlsx

WHERE THE OUTPUTS LAND: ONE PLACE
---------------------------------
Everything this package writes lands in `Data/out/`, with no exceptions:

    Data/out/tract_geometry_pure-2010.json      step 1, the tract shapes
    Data/out/service_territories.geojson        step 1, the territory overlay
    Data/out/nyserda_dac_v1_0.json              step 2, the DAC indicators
    Data/out/coned_operational_v1_0-2010.json   step 3, electric and gas

The overlay used to sit one level up, in `Data/`. It does not any more. If you
are following an older instruction that sends you to `Data/` for it, that
instruction predates this package. Each run prints the full path of everything
it writes, so the run's own output is the reference if you are unsure.

Nothing in this package contacts the dashboard. Uploading is a separate, manual
step, described in the guides.

NOTEBOOKS
---------
`notebooks/` holds one notebook per output family, for running this in Google
Colab or Jupyter instead of a terminal. They orchestrate the same scripts with
the same commands and reimplement nothing, so a notebook and a terminal produce
byte-identical files. Each one states where it sits in the three steps above,
and each prints a timing block you can screenshot.

    tract-shapes.ipynb              step 1
    territory-overlays.ipynb        step 1, the same command
    dac-indicators.ipynb            step 2
    electric-and-gas-figures.ipynb  step 3

NETWORK
-------
The geometry build itself is offline. Two things do use the network: fetching a
Census boundary file if one is missing, and rebuilding the service territory
overlay, which downloads a coordinate-transformation grid. Both are described in
the tract-shapes and territory-overlays guides.

CONTENTS
--------
See MANIFEST.txt, which lists every file with its full sha256, and which also
flags which files are Con Edison internal data.
"""


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(HERE, "handoff"))
    a = ap.parse_args()

    stage = os.path.join(a.out, PKG_NAME)
    if os.path.exists(stage):
        shutil.rmtree(stage)
    os.makedirs(os.path.join(stage, "Data", "out"), exist_ok=True)
    os.makedirs(os.path.join(stage, "Data", "Extra_info"), exist_ok=True)
    os.makedirs(os.path.join(stage, "docs"), exist_ok=True)
    os.makedirs(os.path.join(stage, "scripts"), exist_ok=True)
    os.makedirs(os.path.join(stage, "notebooks"), exist_ok=True)

    manifest, missing, client = [], [], []

    def take(src_abs, dst_rel, is_client, note):
        if not os.path.exists(src_abs):
            missing.append(dst_rel)
            return
        dst = os.path.join(stage, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copy2(src_abs, dst)
        row = (dst_rel, os.path.getsize(dst), sha256(dst), note)
        manifest.append(row)
        if is_client:
            client.append(dst_rel)

    for src, dst in SCRIPTS:
        take(os.path.join(DEV, src), dst, False, "script")
    for src, dst, is_client, note in INPUTS:
        take(os.path.join(DEV, src), dst, is_client, note)
    for stem in SHAPEFILES:
        for ext in SHAPE_PARTS:
            take(os.path.join(DEV, "Data", "tract-geometry", stem + ext),
                 GEO + stem + ext, True,
                 "shapefile part (all four are required)")
    for g in WORD_GUIDES:
        take(os.path.join(GUIDES_SRC, g), "docs/" + g, False, "operator guide")
    for n in NOTEBOOKS:
        take(os.path.join(NOTEBOOKS_SRC, n), "notebooks/" + n, False,
             "Colab notebook, one per output family; orchestrates the scripts")

    # Files this script WRITES rather than copies. They are manifest rows too --
    # audit finding F2 was that four of them were in the package and not in the
    # list, so a completeness check reported unexplained extras.
    def emit(dst_rel, text, note):
        dst = os.path.join(stage, dst_rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with open(dst, "w", encoding="utf-8") as fh:
            fh.write(text)
        manifest.append((dst_rel, os.path.getsize(dst), sha256(dst), note))

    emit("scripts/requirements.txt", REQUIREMENTS,
         "pip requirements for all four guides")
    emit("Data/out/.keep",
         "Outputs land here. Empty on purpose -- see README.txt.\n",
         "keeps the empty output folder in the zip")

    # README carries the longest path in the package as a number, and a number in
    # prose is a number that drifts (audit finding F9 was exactly that). Measure
    # it and inject it, so the claim cannot be wrong.
    #
    # 116 characters in v1: the longest RELATIVE path, plus the top-level folder
    # name the zip unpacks into, which is what an operator's path budget actually
    # spends. Computed the same way here.
    longest_rel = max(len(r[0]) for r in manifest)
    longest = longest_rel + len(PKG_NAME) + 1
    emit("README.txt", README % {"longest": longest}, "this file's own START HERE")

    lines = ["Con Edison DAC dashboard - data tools", "=" * 60, ""]
    if client:
        lines += ["CON EDISON INTERNAL DATA IN THIS PACKAGE",
                  "-" * 60,
                  "These files contain per-tract customer account counts, energy",
                  "affordability enrolment, or network geometry. They are included",
                  "because the scripts cannot run without them and this package is for",
                  "Con Edison. Do not forward this package outside Con Edison.", ""]
        lines += ["  " + c for c in client]
        lines += [""]
    # ALL FILES means all files, and sha256 means sha256 (audit findings F2, F3).
    #
    # v1 printed digest[:16] under a column headed `sha256`, so an operator
    # checking against sha256sum output saw no match until they noticed it was a
    # prefix. Full 64-character digests now, which is why the layout below puts
    # the digest on its own line rather than fighting for width with the path --
    # the longest path here is 85 characters and 85 + 10 + 64 does not fit in a
    # readable line.
    lines += ["ALL FILES", "-" * 60,
              "Every file in this package. The digest is the FULL sha256, so",
              "`sha256sum <path>` output can be compared to it directly.",
              ""]
    for dst_rel, size, digest, note in sorted(manifest):
        lines.append("%-72s %10d" % (dst_rel, size))
        lines.append("    sha256  %s" % digest)
    # MANIFEST.txt itself is listed, and its digest is NOT -- a file cannot
    # contain its own sha256. Saying so explicitly is the honest version of F2:
    # the row exists, so a completeness check finds nothing unexplained, and the
    # one field that cannot be filled says why instead of being left blank.
    lines.append("%-72s %10s" % ("MANIFEST.txt", "(this file)"))
    lines.append("    sha256  not listed: a file cannot contain its own digest")
    lines += ["", "NOTES", "-" * 60]
    for dst_rel, size, digest, note in sorted(manifest):
        if note not in ("script", "operator guide"):
            lines.append("  %-58s %s" % (dst_rel, note))
    with open(os.path.join(stage, "MANIFEST.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    # THE GUIDES MUST NOT SHIP AN UNMEASURED NUMBER.
    #
    # make_operator_guides.py renders any value it has not been given as the
    # literal MISSING, so a guide quoting a size, a digest, a count or a duration
    # that nobody measured says so in plain sight rather than carrying a
    # plausible invention. Audit finding F9 was a stale number in a guide; this
    # is the guard that stops the next one, and it is a refusal, not a warning.
    # DAC_ALLOW_UNMEASURED=1 is the MEASUREMENT PASS, and the only reason it
    # exists: the guides must quote numbers from a clean-room run of the package,
    # and the package cannot be built until the guides exist. So one throwaway
    # build is made with the sentinels in place, the chain is run against it, the
    # measurements are filled in, and the real package is built with this guard
    # armed. A package built under this flag is not shippable and says so.
    unmeasured = []
    for g in WORD_GUIDES:
        with zipfile.ZipFile(os.path.join(stage, "docs", g)) as z:
            body = z.read("word/document.xml").decode("utf-8")
        if "MISSING" in body:
            unmeasured.append(g)
    if unmeasured:
        if os.environ.get("DAC_ALLOW_UNMEASURED") != "1":
            sys.exit("REFUSED: %d guide(s) still contain MISSING: %s\n"
                     "  Fill MEASURED in make_operator_guides.py from a "
                     "clean-room run and regenerate before packaging.\n"
                     "  For the measurement pass itself, set "
                     "DAC_ALLOW_UNMEASURED=1." % (len(unmeasured),
                                                  ", ".join(unmeasured)))
        print("!" * 66)
        print("MEASUREMENT PASS ONLY. %d guide(s) contain MISSING: %s"
              % (len(unmeasured), ", ".join(unmeasured)))
        print("This package is NOT shippable. Run the chain, fill MEASURED,")
        print("regenerate the guides, and build again without the flag.")
        print("!" * 66)

    # THE PACKAGE SHIPS NO FLAT INPUTS.
    #
    # The scripts resolve each input through fam(), which falls back to a flat
    # Data/ when the family folder is absent. That fallback exists for
    # repository scripts this restructure did not touch. In the PACKAGE it must
    # never fire, because a package that works through the fallback is a package
    # whose family layout is decorative. Asserted here, and again from the
    # outside in verify_handoff_package.py.
    flat = sorted(n for n in (r[0] for r in manifest)
                  if n.startswith("Data/") and n.count("/") == 1
                  and not n.startswith("Data/out/"))
    if flat:
        sys.exit("REFUSED: %d input(s) sit directly in Data/ instead of a family "
                 "folder: %s" % (len(flat), ", ".join(flat)))

    # Assert the exclusions rather than trusting the lists above. A file that
    # should never ship is exactly the thing a future edit adds back by accident,
    # and "it is not in SCRIPTS" is not the same as "it is not in the package".
    staged = []
    for root, _dirs, files in os.walk(stage):
        for f in files:
            staged.append(os.path.relpath(os.path.join(root, f), stage).replace("\\", "/"))
    # F2, asserted rather than intended. The manifest claims to list every file,
    # so prove it against the staged tree instead of trusting that every writer
    # above remembered to append a row. MANIFEST.txt is the one file not in
    # `manifest` -- it is listed in the text with its digest explained away.
    listed = {r[0] for r in manifest} | {"MANIFEST.txt"}
    unlisted = sorted(set(staged) - listed)
    phantom = sorted(listed - set(staged))
    if unlisted or phantom:
        sys.exit("REFUSED: MANIFEST does not match the package.\n"
                 "  in the package, not in MANIFEST: %s\n"
                 "  in MANIFEST, not in the package: %s"
                 % (", ".join(unlisted) or "(none)",
                    ", ".join(phantom) or "(none)"))

    # The README states the longest path as a number. Prove the number against
    # the tree it describes, including the files written after it was computed.
    real_longest = max(len(s) for s in staged) + len(PKG_NAME) + 1
    if real_longest != longest:
        sys.exit("REFUSED: README claims the longest path is %d characters; the "
                 "package's longest is %d." % (longest, real_longest))

    leaked = [n for n in MUST_NOT_SHIP if any(s.endswith("/" + n) or s == n for s in staged)]
    if leaked:
        sys.exit("REFUSED: %d file(s) that must never ship are in the package: %s"
                 % (len(leaked), ", ".join(leaked)))
    # Directory rule, checked separately: a staged path under any of these is a
    # leak regardless of what it is called.
    leaked_dirs = sorted({d for d in MUST_NOT_SHIP_DIRS
                          for s in staged if s.startswith(d) or ("/" + d) in ("/" + s)})
    if leaked_dirs:
        offenders = [s for s in staged
                     if any(s.startswith(d) or ("/" + d) in ("/" + s) for d in leaked_dirs)]
        sys.exit("REFUSED: %d file(s) from a directory that must never ship (%s): %s"
                 % (len(offenders), ", ".join(leaked_dirs), ", ".join(sorted(offenders)[:6])))

    zip_path = os.path.join(a.out, PKG_NAME + ".zip")
    if os.path.exists(zip_path):
        os.remove(zip_path)

    # DETERMINISTIC ARCHIVE (CLCPA-219). Two runs of this script must produce a
    # byte-identical zip, or "the package is reproducible" is a claim nobody can
    # check -- and the sha256 in the verification record means nothing.
    #
    # z.write() stamps each entry with the file's mtime, which breaks that twice
    # over:
    #
    #   1. FIVE files are written fresh by this script -- MANIFEST.txt,
    #      README.txt, scripts/requirements.txt, Data/out/.keep and the docs
    #      placeholder -- so their mtime is "now". Two runs a minute apart
    #      differed by exactly 16 bytes when there were four of them: entries
    #      times two header copies times the two-byte DOS time field (the date
    #      matched, being the same day). Content was identical, every CRC equal.
    #
    #   2. Worse and invisible on one machine: the copied entries carry the
    #      WORKING COPY's mtimes, which in this checkout span June to August. A
    #      fresh git clone stamps checkout time on all of them, so the same
    #      commit packaged elsewhere produces a completely different zip.
    #
    # Pinning every entry to the zip epoch fixes both. The mtimes carry no
    # information anyone uses -- provenance is the sha256 per file in
    # MANIFEST.txt and the commit this was built from -- so nothing is lost.
    # external_attr is set explicitly for the same reason: taken from the host
    # filesystem it would make the archive OS-dependent as well.
    ZIP_EPOCH = (1980, 1, 1, 0, 0, 0)   # the earliest a DOS timestamp can express
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, dirs, files in os.walk(stage):
            dirs.sort()          # os.walk order is not guaranteed; make it so
            for f in sorted(files):
                full = os.path.join(root, f)
                arc = (PKG_NAME + "/" +
                       os.path.relpath(full, stage).replace(os.sep, "/"))
                zi = zipfile.ZipInfo(arc, date_time=ZIP_EPOCH)
                zi.compress_type = zipfile.ZIP_DEFLATED
                zi.external_attr = 0o644 << 16     # rw-r--r--, host-independent
                with open(full, "rb") as fh:
                    z.writestr(zi, fh.read())

    print("=" * 66)
    print("HANDOFF PACKAGE")
    print("=" * 66)
    print("  staged at : %s" % stage)
    print("  zip       : %s (%d bytes, %.1f MB)"
          % (zip_path, os.path.getsize(zip_path), os.path.getsize(zip_path) / 1e6))
    print("  files     : %d" % len(manifest))
    print("  scripts   : %d   guides: %d" % (len(SCRIPTS), len(WORD_GUIDES)))
    print("  client-data files flagged in MANIFEST.txt: %d" % len(client))
    if missing:
        print("\n  MISSING (not packaged):")
        for m in missing:
            print("    " + m)
        sys.exit("refusing to claim a complete package while inputs are missing.")
    print("=" * 66)


if __name__ == "__main__":
    main()
