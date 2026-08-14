"""Assemble the Con Edison handoff package: the scripts, the three operator
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

`build_tract_dataset.py` is where the indicator catalogue is parsed out of
`app.js`; `build_base_map_payload.py` is where the spreadsheet reader lives, and
build_coned_dataset imports it rather than reimplementing the header matching.
Both are import-safe: each has an `if __name__ == "__main__"` guard, so importing
one does not run it.

WHAT DOES NOT GO IN
-------------------
`Data/out/` ships EMPTY. Everything in it is an output, including the tract
geometry that the other two builders read as their tract universe -- so the
package's own first command produces it. Shipping a prebuilt copy would let an
operator run guide 1 successfully without ever running guide 2, and never learn
that the two are ordered.

Also excluded: `service_territories.geojson` (an output), the saved-layer
GeoJSON, and every dataset already uploaded to the dashboard.

CLIENT DATA, FLAGGED RATHER THAN QUIETLY BUNDLED
------------------------------------------------
Four payload items are Con Edison internal data. They are included because the
package is FOR Con Edison and the scripts cannot run without them, and they are
listed in MANIFEST.txt under their own heading so nobody ships this onward by
accident:

    map_payload.json          per-tract account counts and EAP enrolment
    Electric.xlsx / Gas.xlsx  the same figures at source
    Extra_info/CECONY_*       the electric and gas network geometry

`app.js` is the deployed dashboard and is Con Edison's own application.

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
DOCS = os.path.join(HERE, "operator-docs")

PKG_NAME = "coned-dac-dashboard-data-tools"

# (source path relative to DEV, destination relative to the package root)
SCRIPTS = [
    ("Data/convert_nyserda_raw.py", "Data/convert_nyserda_raw.py"),
    ("Data/build_tract_dataset.py", "Data/build_tract_dataset.py"),
    ("Data/update_map_data.py", "Data/update_map_data.py"),
    ("Data/build_pure_geometry_dataset.py", "Data/build_pure_geometry_dataset.py"),
    ("Data/_make_territories.py", "Data/_make_territories.py"),
    ("Data/build_coned_dataset.py", "Data/build_coned_dataset.py"),
    ("Data/build_base_map_payload.py", "Data/build_base_map_payload.py"),
]

# Inputs the scripts read at runtime. `client` marks Con Edison internal data.
INPUTS = [
    ("app.js", "app.js", False,
     "the deployed dashboard; the indicator catalogue is parsed out of it"),
    ("map_payload.json", "map_payload.json", True,
     "supplies the 2,333-GEOID tract universe to the geometry builder"),
    ("Data/NYS_DAC.geojson", "Data/NYS_DAC.geojson", False,
     "NYSERDA DAC release, from the NY DOS Geographic Information Gateway"),
    ("Data/ny_tracts.geojson", "Data/ny_tracts.geojson", False,
     "US Census 2020 tract boundaries, converted; update_map_data can refetch"),
    ("Data/ny_tracts_2010.geojson", "Data/ny_tracts_2010.geojson", False,
     "US Census 2010 tract boundaries, converted; update_map_data can refetch"),
    ("Data/2010_Census_Tract_to_Neighborhood_Tabulation_Area_Equivalency_table_20260806.csv",
     "Data/2010_Census_Tract_to_Neighborhood_Tabulation_Area_Equivalency_table_20260806.csv",
     False, "NYC Open Data 8ius-dhrr"),
    ("Data/2020_Census_Tracts_to_2020_NTAs_and_CDTAs_Equivalency_20260601.csv",
     "Data/2020_Census_Tracts_to_2020_NTAs_and_CDTAs_Equivalency_20260601.csv",
     False, "NYC Open Data hm78-6dwm"),
    ("Data/Electric.xlsx", "Data/Electric.xlsx", True, "Con Edison electric extract"),
    ("Data/Gas.xlsx", "Data/Gas.xlsx", True, "Con Edison gas extract"),
]

# Every part of each shapefile the scripts touch. .shp alone is not a shapefile.
SHAPEFILES = ["CECONY_Electric", "CECONY_Gas", "ORU_Territory"]
SHAPE_PARTS = [".shp", ".shx", ".dbf", ".prj"]

GUIDES = [
    "01-nyserda-indicator-dataset.html",
    "02-geometry-and-territories.html",
    "03-electric-and-gas-figures.html",
]

REQUIREMENTS = """\
# Con Edison DAC dashboard - data tools
#
# The three guides need different things. Install what the guide you are
# following asks for; installing all of it is fine too.
#
# Guide 1  NYSERDA indicators (convert_nyserda_raw.py)
#          Python standard library only. Nothing to install.
#
# Guide 2  Tract geometry and territories (update_map_data.py)
pyshp>=3.0
pyproj>=3.7
shapely>=2.1
#
# Guide 3  Electric and gas figures (build_coned_dataset.py)
openpyxl>=3.1
#
# Verified on Python 3.14.5 with pyshp 3.0.9, pyproj 3.7.2, shapely 2.1.2.
"""

README = """\
Con Edison DAC dashboard - data tools
=====================================

Everything needed to rebuild the four kinds of data file the dashboard uses.

START HERE
----------
Open the guides in a browser, in order:

    docs/01-nyserda-indicator-dataset.html
    docs/02-geometry-and-territories.html
    docs/03-electric-and-gas-figures.html

HOW TO RUN ANYTHING
-------------------
Open a terminal in THIS folder -- the one containing `Data/` -- and run scripts
as `python Data/<script>.py`. The scripts resolve their own paths and will fail
on missing inputs if run from anywhere else.

    pip install -r requirements.txt

ORDER MATTERS THE FIRST TIME
----------------------------
`Data/out/` is empty on purpose. The tract geometry is the tract list that the
other two builders read, so build it first:

    python Data/update_map_data.py --vintage 2010          (guide 2)
    python Data/convert_nyserda_raw.py --version 1.0 \\
        --geoid-vintage 2010 --raw-date 2023-03-27         (guide 1)
    python Data/build_coned_dataset.py --vintage 2010      (guide 3)

Everything the scripts write lands in `Data/out/`. Nothing in this package
contacts the dashboard: uploading is a separate, manual step, described in the
guides.

NETWORK
-------
The geometry build itself is offline. Two things do use the network: fetching a
Census boundary file if one is missing, and rebuilding the service territory
overlay, which downloads a coordinate-transformation grid. Both are described in
guide 2.

CONTENTS
--------
See MANIFEST.txt, which also lists which files are Con Edison internal data.
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
            take(os.path.join(DEV, "Data", "Extra_info", stem + ext),
                 "Data/Extra_info/" + stem + ext, True,
                 "shapefile part (all four are required)")
    for g in GUIDES:
        take(os.path.join(DOCS, g), "docs/" + g, False, "operator guide")

    with open(os.path.join(stage, "requirements.txt"), "w", encoding="utf-8") as fh:
        fh.write(REQUIREMENTS)
    with open(os.path.join(stage, "README.txt"), "w", encoding="utf-8") as fh:
        fh.write(README)
    # Keep the empty output folder in the zip.
    with open(os.path.join(stage, "Data", "out", ".keep"), "w", encoding="utf-8") as fh:
        fh.write("Outputs land here. Empty on purpose -- see README.txt.\n")

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
    lines += ["ALL FILES", "-" * 60,
              "%-72s %10s  %s" % ("path", "bytes", "sha256")]
    for dst_rel, size, digest, note in sorted(manifest):
        lines.append("%-72s %10d  %s" % (dst_rel, size, digest[:16]))
    lines += ["", "NOTES", "-" * 60]
    for dst_rel, size, digest, note in sorted(manifest):
        if note not in ("script", "operator guide"):
            lines.append("  %-58s %s" % (dst_rel, note))
    with open(os.path.join(stage, "MANIFEST.txt"), "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")

    zip_path = os.path.join(a.out, PKG_NAME + ".zip")
    if os.path.exists(zip_path):
        os.remove(zip_path)
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as z:
        for root, _dirs, files in os.walk(stage):
            for f in sorted(files):
                full = os.path.join(root, f)
                z.write(full, os.path.join(PKG_NAME, os.path.relpath(full, stage)))

    print("=" * 66)
    print("HANDOFF PACKAGE")
    print("=" * 66)
    print("  staged at : %s" % stage)
    print("  zip       : %s (%d bytes, %.1f MB)"
          % (zip_path, os.path.getsize(zip_path), os.path.getsize(zip_path) / 1e6))
    print("  files     : %d" % len(manifest))
    print("  scripts   : %d   guides: %d" % (len(SCRIPTS), len(GUIDES)))
    print("  client-data files flagged in MANIFEST.txt: %d" % len(client))
    if missing:
        print("\n  MISSING (not packaged):")
        for m in missing:
            print("    " + m)
        sys.exit("refusing to claim a complete package while inputs are missing.")
    print("=" * 66)


if __name__ == "__main__":
    main()
