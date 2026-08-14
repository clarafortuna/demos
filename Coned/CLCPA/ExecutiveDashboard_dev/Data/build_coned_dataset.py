"""Slice 7a: the Con Edison per-tract operational figures as a dataset.

The eight fields the map shows for electric and gas -- the DAC class, account
count, EAP count and adjustment for each -- reach the browser today only inside
map_payload.json, built offline by build_base_map_payload.py from two Con Edison
spreadsheets. This script moves them into the same versioned, uploadable shape
the indicator, geometry and territory families already use, so nothing about them
is file-served any more.

    Data/Electric.xlsx  (sheet "Export")  ->  Data/out/coned_operational_v1_0-2010.json
    Data/Gas.xlsx       (sheet "Export")

WHY A FILE AND NOT ROWS
-----------------------
cr2bf_dacmaptractdata already holds these eight columns per tract, and the app
already reads it -- but as an OVERRIDE layer applied on top of whatever the base
says (getMapTractOverlay / applyMapOverlay). Bulk-loading the spreadsheet into
that table would overwrite hand corrections and destroy the only thing that
distinguishes "what the source says" from "what somebody fixed". So the source
figures become the base, as a dataset, and the override table is left exactly as
it is. Edits keep beating the source, which is the behaviour that already exists.

THE APP CANNOT READ .xlsx, AND THAT IS WHY THIS SCRIPT EXISTS
------------------------------------------------------------
An .xlsx is a zip of XML; parsing one in the browser needs a library, and this
build takes no new dependencies. So the conversion is necessarily offline and
what an operator uploads is the JSON. Data/check_doc_claims.js exists to stop any
document claiming otherwise, and it will fail if one does.

WHAT IS DELIBERATELY DROPPED
----------------------------
Both spreadsheets end with a FOOTER ROW whose first cell is a multi-line
"Applied filters: ..." description of the query that produced them. load_excel
treats the first column as the GEOID, so that footer becomes a key. It has never
reached the map because build_base_map_payload.py filters the universe down to
the six Con Edison counties, which drops it as a side effect. Here it is dropped
ON PURPOSE and reported, because relying on a side effect to exclude a text blob
from a tract list is not a guarantee.

Electric also carries four Putnam County tracts (36079…) outside the Con Edison
six-county service area. Same treatment: excluded deliberately, named in the
report, never silently.

PRECISION
---------
The adjustment columns are floats carrying 14-15 significant decimals, and
map_payload.json stores them at exactly that precision. This dataset does the
same: full source precision, no rounding, so the equivalence guard can compare
values with == rather than a tolerance chosen to make it pass.

Note for whoever meets it later: cr2bf_dacmaptractdata's adjustment columns are
Decimal(4dp), so an OVERRIDE entered through that table cannot carry more than
four decimals. That is a pre-existing property of the override layer, unchanged
by this slice, and it means an overridden value legitimately differs in precision
from the dataset value beneath it.

Run:  python Data/build_coned_dataset.py [--vintage 2010|2020] [--force]
Nothing here touches Dataverse. Upload the result from the Map Layers card.
"""
import argparse
import hashlib
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# Layout-agnostic paths. In the repository this script lives in Data/; in the Con
# Edison handoff package it sits at the package root with Data/ beside it. DATA is
# the same folder in both layouts, so one copy of the script serves both and the
# clean-room proof exercises the very file the repository holds.
DATA = HERE if os.path.basename(HERE) == "Data" else os.path.join(HERE, "Data")
ROOT = os.path.dirname(DATA)

# The spreadsheet reader is IMPORTED, not reimplemented. Two copies of the header
# matching and the zfill rule is exactly how this dataset would drift away from
# the payload it has to equal -- the same argument that made _make_territories.py
# import the fingerprint from the builder in slice 6c.
_spec = importlib.util.spec_from_file_location(
    "build_base_map_payload", os.path.join(HERE, "build_base_map_payload.py"))
_bbmp = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_bbmp)

IN_ELEC = os.path.join(DATA, "Electric.xlsx")
IN_GAS = os.path.join(DATA, "Gas.xlsx")

DATASET_KEY = "coned_operational"
DATASET_NAME = "Con Edison per-tract operational figures"
# The VERSION carries the vintage, and the filename with it.
#
# Found by running --vintage 2020 rather than assuming it: with a bare "1.0" both
# vintages wrote coned_operational_v1_0.json, so building 2020 silently replaced
# the 2010 file, and two datasets over different tract universes were
# indistinguishable by version label. The geometry family already solved this the
# same way -- its versions are "pure-2010" and "pure-2020", not "1.0" twice.
#
# The universes really are different: 2020 has 2,183 tracts and does not contain
# 219 GEOIDs that carry electric data under 2010 numbering.
DATASET_VERSION_BASE = "1.0"


def dataset_version(vintage):
    return "%s-%s" % (DATASET_VERSION_BASE, vintage)

# The eight map_payload.json keys, in the order the tooltip and CSV read them.
# Named identically on purpose: this dataset is a drop-in for those properties.
FIELDS = ["elec_dac", "elec_accts", "elec_eap", "elec_adj",
          "gas_dac", "gas_accts", "gas_eap", "gas_adj"]
# (payload key, which spreadsheet, which load_excel key)
FIELD_SOURCE = [
    ("elec_dac", "elec", "class"), ("elec_accts", "elec", "accts"),
    ("elec_eap", "elec", "eap"), ("elec_adj", "elec", "adj"),
    ("gas_dac", "gas", "class"), ("gas_accts", "gas", "accts"),
    ("gas_eap", "gas", "eap"), ("gas_adj", "gas", "adj"),
]


def geometry_path(vintage):
    return os.path.join(DATA, "out", "tract_geometry_pure-%s.json" % vintage)


def source_fingerprint():
    """sha256 over the two spreadsheets, in a fixed order.

    Deliberately NOT the same thing as the fingerprint in the geometry and
    territory files: that one hashes the CECONY shapefiles, this one hashes the
    xlsx extracts. They answer different questions and must never be compared to
    each other, which is why the manifest states what was hashed alongside the
    hash itself.
    """
    h = hashlib.sha256()
    for p in (IN_ELEC, IN_GAS):
        if not os.path.exists(p):
            return None
        with open(p, "rb") as fh:
            h.update(fh.read())
    return h.hexdigest()


def looks_like_geoid(gid):
    """11 digits. The footer row's 'Applied filters: …' blob is not."""
    return isinstance(gid, str) and len(gid) == 11 and gid.isdigit()


def build(vintage, force):
    gpath = geometry_path(vintage)
    if not os.path.exists(gpath):
        sys.exit("REFUSED: no geometry dataset at %s.\n"
                 "  The tract universe comes from the geometry that is drawn, not from\n"
                 "  map_payload.json, so this dataset does not depend on the file it\n"
                 "  exists to replace. Build it with update_map_data.py --vintage %s."
                 % (os.path.relpath(gpath, ROOT), vintage))
    with open(gpath, encoding="utf-8") as fh:
        geo = json.load(fh)
    geoids = geo["tracts"]["geoids"]

    elec = _bbmp.load_excel(IN_ELEC)
    gas = _bbmp.load_excel(IN_GAS)
    src = {"elec": elec, "gas": gas}

    # ---- what the spreadsheets carry that this dataset will not ----
    dropped = {"footer": [], "outside_universe": [], "malformed": []}
    for name, table in (("elec", elec), ("gas", gas)):
        for gid in table:
            if not looks_like_geoid(gid):
                # The footer blob, and anything else that is not 11 digits.
                label = repr(gid)[:60] + ("…" if len(repr(gid)) > 60 else "")
                dropped["footer" if "Applied filters" in str(gid) else "malformed"].append(
                    (name, label))
            elif gid not in set(geoids):
                dropped["outside_universe"].append((name, gid))

    fields = {k: [] for k in FIELDS}
    for gid in geoids:
        for key, which, sub in FIELD_SOURCE:
            rec = src[which].get(gid)
            fields[key].append(rec.get(sub) if rec else None)

    fp = source_fingerprint()
    if fp is None:
        sys.exit("REFUSED: a spreadsheet is missing, so this dataset could not be "
                 "stamped with the source it came from.")

    doc = {
        "schema": 1,
        "kind": "coned",
        "dataset": {
            "key": DATASET_KEY,
            "version": dataset_version(vintage),
            "name": DATASET_NAME,
            "sourceLabel": "Con Edison per-tract extracts Electric.xlsx and Gas.xlsx "
                           "(sheet Export); accounts, EAP accounts and adjustment by "
                           "census tract.",
            "geoidVintage": str(vintage),
            "sourceFingerprint": fp,
            # Says WHAT was hashed. The geometry and territory files carry a
            # fingerprint of the CECONY shapefiles under the same key name, and
            # nothing should ever compare the two.
            "sourceFingerprintOf": "Electric.xlsx, Gas.xlsx",
        },
        "tracts": {"geoids": list(geoids), "fields": fields},
    }

    out = os.path.join(DATA, "out", "coned_operational_v%s.json"
                       % dataset_version(vintage).replace(".", "_"))
    if os.path.exists(out) and not force:
        sys.exit("REFUSED: %s already exists. It may be the copy that is live in\n"
                 "  Dataverse. Pass --force to overwrite it."
                 % os.path.relpath(out, ROOT))
    with open(out, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, separators=(",", ":"), ensure_ascii=False)

    # ---- report ----
    print("=" * 74)
    print("CONED OPERATIONAL DATASET  v%s" % dataset_version(vintage))
    print("=" * 74)
    print("  universe   : %d tracts, from %s" % (len(geoids), os.path.relpath(gpath, ROOT)))
    print("  electric   : %d rows read" % len(elec))
    print("  gas        : %d rows read" % len(gas))
    print("")
    print("  values carried, by field:")
    for k in FIELDS:
        n = sum(1 for v in fields[k] if v is not None)
        print("    %-12s %5d of %d tracts" % (k, n, len(geoids)))
    print("")
    print("  DELIBERATELY DROPPED")
    for name, label in dropped["footer"]:
        print("    footer row   %-5s %s" % (name, label.replace("\\n", " / ")))
    for name, label in dropped["malformed"]:
        print("    malformed    %-5s %s" % (name, label))
    outside = dropped["outside_universe"]
    if outside:
        print("    outside the %s universe: %d (%s)" % (
            vintage, len(outside), ", ".join("%s %s" % t for t in outside[:6])))
    if not any(dropped.values()):
        print("    nothing")
    print("")
    print("  fingerprint: %s" % fp)
    print("               (over Electric.xlsx + Gas.xlsx, NOT the shapefiles)")
    print("  output     : %s (%d bytes)" % (os.path.relpath(out, ROOT), os.path.getsize(out)))
    print("")
    print("  Upload it from the Map Layers admin card. Nothing here touches Dataverse.")
    print("=" * 74)
    return doc


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vintage", default="2010", choices=["2010", "2020"])
    ap.add_argument("--force", action="store_true",
                    help="overwrite an existing dataset in Data/out/")
    args = ap.parse_args()
    build(args.vintage, args.force)


if __name__ == "__main__":
    main()
