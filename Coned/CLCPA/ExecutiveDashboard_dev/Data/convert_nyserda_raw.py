"""
convert_nyserda_raw.py - build a versioned indicator dataset straight from the
raw NYSERDA release, instead of extracting it out of map_payload.json.

Why this exists
---------------
build_tract_dataset.py reads map_payload.json, which means a new NYSERDA release
can only become a dataset by first rebuilding the payload through the whole
pipeline. That is the dependency Phase 2 removes: this script goes from the raw
NYSERDA GeoJSON to an uploadable dataset file with nothing in between.

It is deliberately NOT a fork of build_tract_dataset.py. Everything describing
the dataset -- the indicator catalog, groups, roles, formats, layout, the field
order -- is IMPORTED from it. That module parses the catalog out of app.js, so
the manifest provably matches the UI as it ships; restating any of it here would
quietly forfeit that guarantee. Only the source of the VALUES differs.

What the raw file contains
--------------------------
  Data/NYS_DAC.geojson    NYSERDA Disadvantaged Communities export, statewide.
                          1,736 features, all of them DAC -- the file has no
                          Non-DAC rows at all.
                          https://opdgig.dos.ny.gov/datasets/2579112b69b04b4c9a09f4cf013983dc

All 56 dataset fields appear in it under identical names. There is no mapping
table here because none is needed: the conversion is a projection.

Three ArcGIS export artefacts are discarded explicitly (DISCARDED_FIELDS), and
five real NYSERDA columns are carried by the raw file but not by the dataset
(UNUSED_FIELDS). Both lists are printed on every run rather than left implicit,
so a future release that adds a column is noticed instead of silently dropped.

Scope, and the Non-DAC roster
-----------------------------
The raw file is statewide and DAC-only. The dataset is six-county and covers
every tract, DAC or not. So two steps:

  1. SCOPE   keep the features whose County is one of the six (1,059 of 1,736)
  2. ROSTER  every GEOID in the universe that the raw file does not mention is a
             Non-DAC tract: DAC_Desig = "Non-DAC", every other field null

The universe comes from the published tract_geometry dataset for the same GEOID
vintage. That is the right source rather than a convenience: the geometry
dataset defines exactly which tracts the map can draw, and its GEOID list is
set-identical AND order-identical to the uploaded v1.0 (verified). Deriving the
roster from anything else would risk a dataset that claims tracts the map cannot
draw, which is the coverage-guard failure the app already refuses at 98%.

ABSENT vs NULL still holds: a Non-DAC tract is PRESENT with nulls, not absent.
Absent means "this dataset has no row", and conflating the two is how a vintage
mismatch silently blanks tracts.

Usage
-----
  python Data/convert_nyserda_raw.py --version 1.0 --geoid-vintage 2010
      --> Data/out/nyserda_dac_v1_0.json

  python Data/convert_nyserda_raw.py --version 1.0 --geoid-vintage 2010 \
        --verify-against Data/out/nyserda_dac_v1_0.json --no-write
      --> the acceptance test: rebuild v1.0 from raw and require the bytes to
          match the uploaded file exactly. See ACCEPTANCE below.

  Options:
    --raw PATH            default Data/NYS_DAC.geojson
    --universe PATH       default Data/out/tract_geometry_pure-<vintage>.json
    --raw-date YYYY-MM-DD date to name in the source label (see SOURCE LABEL)
    --source-label TEXT   override the generated label outright
    --verify-against FILE compare the built bytes against FILE
    --no-write            build and verify without writing the output file

ACCEPTANCE
----------
The bar is byte-identity with the uploaded Data/out/nyserda_dac_v1_0.json, not
value-equivalence. Value-equivalence would hide a field-order or precision
change that alters what the app parses.

--verify-against adopts the target file's sourceLabel for the comparison, and
says so on stdout. That is the one field which SHOULD differ between a v1.0 that
came from the payload and a v1.0 that came from raw, because the label names the
source. Adopting it is what makes the remaining comparison meaningful; it is
printed rather than applied quietly.

If the bytes differ, every differing path is reported. There is no tolerance
setting.

SOURCE LABEL
------------
The label names the raw file and dates it, so a row in Dataverse says which
release it came from. The Dataverse column holds 300 characters and the write
path truncates silently at that width -- a truncated label already shipped once,
mid-word. This script refuses to emit one longer than SOURCE_LABEL_MAX rather
than let it be cut downstream.
"""

import argparse
import hashlib
import json
import os
import sys
from datetime import date, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

# The manifest machinery, imported rather than restated. build_tract_dataset
# guards its main() behind __main__, so importing it is side-effect free.
import build_tract_dataset as BTD  # noqa: E402

RAW_DEFAULT = os.path.join(HERE, "NYS_DAC.geojson")
OUT_DIR = os.path.join(HERE, "out")

# The six Con Edison counties, as NYSERDA spells them.
CONED_COUNTIES = {"Bronx", "Kings", "New York", "Queens", "Richmond", "Westchester"}

# ArcGIS export artefacts. Not data, and deliberately dropped.
DISCARDED_FIELDS = ["OBJECTID", "Shape__Area", "Shape__Length"]

# Real NYSERDA columns the dataset does not carry. Listed so that adding one is
# a decision rather than an oversight. GEOID is the key and County/City_Town
# belong to the payload pipeline, so they are structural rather than "unused".
UNUSED_FIELDS = ["HH_Low_Cnt", "NYC_Region", "REDC", "Trib_Desig", "Urb_Rural"]
STRUCTURAL_FIELDS = ["GEOID", "County", "City_Town"]

NON_DAC_VALUE = "Non-DAC"

# The Dataverse column is Text(300) and the write path slices at that width with
# no word boundary and no warning. Hold well inside it.
SOURCE_LABEL_MAX = 254


def check_label_length(label, origin):
    """Applied to EVERY label, however it was arrived at.

    A generated label is not the only way to ship a truncated one -- an override
    or a label adopted from another file can be just as long. The check lives
    here, on the value, rather than on the code path that produced it.
    """
    if len(label) > SOURCE_LABEL_MAX:
        sys.exit(
            "the source label (%s) is %d characters and this script holds "
            "itself to %d, because the Dataverse column is Text(300) and the "
            "write path cuts silently at that width, mid-word. Shorten it:\n  %s"
            % (origin, len(label), SOURCE_LABEL_MAX, label)
        )
    return label


def build_source_label(raw_path, raw_date):
    """Name and date the raw release, so a Dataverse row says where it came from."""
    return (
        "NYSERDA / NYS Climate Justice Working Group, Final Disadvantaged "
        "Communities criteria. Converted from the raw release file %s "
        "(dated %s) by Data/convert_nyserda_raw.py, scoped to the six Con "
        "Edison counties." % (os.path.basename(raw_path), raw_date)
    )


def load_raw(raw_path):
    """Read the statewide release and scope it to the six counties."""
    with open(raw_path, encoding="utf-8") as fh:
        feats = json.load(fh)["features"]
    scoped = {}
    for f in feats:
        p = f["properties"]
        if p.get("County") not in CONED_COUNTIES:
            continue
        g = str(p.get("GEOID", ""))
        if g in scoped:
            sys.exit("GEOID %s appears twice in the raw file; refusing to guess "
                     "which row is authoritative" % g)
        scoped[g] = p
    return feats, scoped


def load_universe(path):
    """The GEOID roster, from the published geometry dataset for this vintage."""
    if not os.path.exists(path):
        sys.exit("no universe file at %s. The roster of Non-DAC tracts comes "
                 "from the published tract_geometry dataset for this vintage; "
                 "build it first or pass --universe." % path)
    with open(path, encoding="utf-8") as fh:
        doc = json.load(fh)
    # The manifest discriminator is kind="geometry"; the family it belongs to is
    # dataset.key="tract_geometry". Check both, so an indicator file passed here
    # by mistake is refused rather than read as a roster.
    if doc.get("kind") != "geometry" or doc.get("dataset", {}).get("key") != "tract_geometry":
        sys.exit("%s is not a tract_geometry dataset (kind=%r, dataset.key=%r)"
                 % (path, doc.get("kind"), doc.get("dataset", {}).get("key")))
    return list(doc["tracts"]["geoids"])


def build_doc(args, all_fields, scoped, universe, source_label):
    """The dataset document, in the same shape and key order as the builder."""
    fields = {k: [] for k in all_fields}
    for g in universe:
        p = scoped.get(g)
        for k in all_fields:
            if p is not None:
                fields[k].append(BTD.r6(p.get(k)))
            else:
                # Non-DAC: present with nulls, never absent. See ABSENT vs NULL.
                fields[k].append(NON_DAC_VALUE if k == "DAC_Desig" else None)

    groups_raw = BTD.parse_indicator_catalog(BTD.APP_JS)
    manifest_groups = []
    for order, g in enumerate(groups_raw, start=1):
        gid, comp = BTD.GROUP_IDS[g["label"]]
        entry = {"id": gid, "label": g["label"], "order": order}
        if comp:
            entry["component"] = comp
        manifest_groups.append(entry)

    indicators = []
    for g in groups_raw:
        gid, _ = BTD.GROUP_IDS[g["label"]]
        for order, it in enumerate(g["items"], start=1):
            indicators.append({"id": it["key"], "label": it["label"],
                               "group": gid, "format": it["format"],
                               "order": order})

    return {
        "schema": BTD.MANIFEST_SCHEMA,
        "dataset": {
            "key": BTD.DATASET_KEY,
            "version": args.version,
            "name": BTD.DATASET_NAME,
            "sourceLabel": source_label,
            "geoidVintage": args.geoid_vintage,
            "decimals": BTD.DECIMALS,
        },
        "roles": dict(BTD.ROLES, dacFlagTrueValue=BTD.DAC_FLAG_TRUE),
        "formats": BTD.FORMATS,
        "groups": manifest_groups,
        "layout": BTD.LAYOUT,
        "indicators": indicators,
        "extraFields": BTD.NON_DROPDOWN_FIELDS,
        "tracts": {"geoids": list(universe), "fields": fields},
    }


def diff_paths(a, b, path="", out=None):
    """Every differing path between two decoded documents, for the report."""
    if out is None:
        out = []
    if type(a) is not type(b):
        out.append((path or "/", "type %s vs %s"
                    % (type(a).__name__, type(b).__name__)))
    elif isinstance(a, dict):
        for k in list(a.keys()) + [k for k in b if k not in a]:
            if k not in a or k not in b:
                out.append((path + "/" + k, "present on one side only"))
            else:
                diff_paths(a[k], b[k], path + "/" + k, out)
        ka, kb = list(a.keys()), list(b.keys())
        if ka != kb and len(ka) == len(kb):
            out.append((path or "/", "same keys, different order"))
    elif isinstance(a, list):
        if len(a) != len(b):
            out.append((path, "length %d vs %d" % (len(a), len(b))))
        else:
            for i, (x, y) in enumerate(zip(a, b)):
                diff_paths(x, y, "%s[%d]" % (path, i), out)
    elif a != b:
        out.append((path, "%r vs %r" % (a, b)))
    return out


def verify(built_bytes, doc, target_path):
    """Byte-identity against the uploaded file. No tolerance setting."""
    with open(target_path, "rb") as fh:
        want = fh.read()
    print("-" * 66)
    print("ACCEPTANCE: byte-identity against %s" % target_path)
    print("  built  : %d bytes  sha256=%s"
          % (len(built_bytes), hashlib.sha256(built_bytes).hexdigest()[:16]))
    print("  target : %d bytes  sha256=%s"
          % (len(want), hashlib.sha256(want).hexdigest()[:16]))
    if built_bytes == want:
        print("  RESULT : IDENTICAL")
        return 0
    print("  RESULT : DIFFERENT")
    target = json.loads(want.decode("utf-8"))
    diffs = diff_paths(target, doc)
    print("  differing paths: %d" % len(diffs))
    for p, why in diffs[:40]:
        print("    %-46s %s" % (p[:46], why[:90]))
    if len(diffs) > 40:
        print("    ... and %d more" % (len(diffs) - 40))
    if not diffs:
        print("  No decoded difference, so the difference is in SERIALISATION")
        print("  (key order, separators, float repr or encoding), not in values.")
    return 1


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--version", required=True,
                    help="dataset version label, e.g. 1.0")
    ap.add_argument("--geoid-vintage", required=True, choices=["2010", "2020"],
                    help="GEOID vintage this release keys to")
    ap.add_argument("--raw", default=RAW_DEFAULT)
    ap.add_argument("--universe", default=None)
    ap.add_argument("--raw-date", default=None,
                    help="YYYY-MM-DD to name in the source label; defaults to "
                         "the raw file's modification date")
    ap.add_argument("--source-label", default=None)
    ap.add_argument("--verify-against", default=None)
    ap.add_argument("--no-write", action="store_true")
    args = ap.parse_args()

    universe_path = args.universe or os.path.join(
        OUT_DIR, "tract_geometry_pure-%s.json" % args.geoid_vintage)

    raw_date = args.raw_date
    dated_from_mtime = raw_date is None
    if dated_from_mtime:
        raw_date = date.fromtimestamp(os.path.getmtime(args.raw)).isoformat()
    else:
        try:
            datetime.strptime(raw_date, "%Y-%m-%d")
        except ValueError:
            sys.exit("--raw-date must be YYYY-MM-DD, got %r" % raw_date)

    if args.source_label:
        source_label = check_label_length(args.source_label, '--source-label')
    else:
        source_label = check_label_length(
            build_source_label(args.raw, raw_date), 'generated')

    groups_raw = BTD.parse_indicator_catalog(BTD.APP_JS)
    all_fields = [it["key"] for g in groups_raw for it in g["items"]] \
        + BTD.NON_DROPDOWN_FIELDS
    dupes = [k for k in set(all_fields) if all_fields.count(k) > 1]
    if dupes:
        sys.exit("field listed twice: %s" % dupes)

    feats, scoped = load_raw(args.raw)
    universe = load_universe(universe_path)

    # Every field the dataset wants must exist in the raw release. A NYSERDA
    # version that renames one would otherwise produce a column of silent nulls.
    sample = next(iter(scoped.values()))
    missing = [k for k in all_fields if k not in sample]
    if missing:
        sys.exit("the raw release has no column for %d dataset field(s): %s. A "
                 "renamed column would otherwise become a column of nulls."
                 % (len(missing), missing))

    # Every scoped raw tract must be in the universe, or the dataset would claim
    # tracts the map cannot draw -- the coverage-guard failure, seeded at build.
    orphans = sorted(set(scoped) - set(universe))
    if orphans:
        sys.exit("%d raw tract(s) are not in the universe %s, so the map could "
                 "not draw them: %s%s" % (len(orphans), universe_path,
                                          orphans[:6],
                                          " ..." if len(orphans) > 6 else ""))

    if args.verify_against:
        with open(args.verify_against, encoding="utf-8") as fh:
            target_label = json.load(fh)["dataset"]["sourceLabel"]
        if target_label != source_label:
            print("VERIFY: adopting the target file's sourceLabel for the "
                  "comparison.\n  target : %s\n  built  : %s"
                  % (target_label[:70] + "...", source_label[:70] + "..."))
            source_label = check_label_length(
                target_label, 'adopted from ' + args.verify_against)

    doc = build_doc(args, all_fields, scoped, universe, source_label)
    blob = json.dumps(doc, separators=(",", ":"),
                      ensure_ascii=False).encode("utf-8")

    extras = sorted(set(sample) - set(all_fields) - set(DISCARDED_FIELDS)
                    - set(STRUCTURAL_FIELDS))
    n_dac = len(scoped)
    n_nondac = len(universe) - n_dac
    key_checksum = hashlib.sha256(
        "\n".join(sorted(universe)).encode("utf-8")).hexdigest()

    print("=" * 66)
    print("NYSERDA RAW -> DATASET")
    print("=" * 66)
    print("raw file        : %s" % args.raw)
    print("raw dated       : %s%s" % (raw_date,
                                      "  (from file mtime; pass --raw-date to "
                                      "state it)" if dated_from_mtime else ""))
    print("universe        : %s" % universe_path)
    print("-" * 66)
    print("raw features    : %d statewide -> %d in the six counties"
          % (len(feats), n_dac))
    print("tracts written  : %d  (%d DAC + %d Non-DAC roster)"
          % (len(universe), n_dac, n_nondac))
    print("fields          : %d" % len(all_fields))
    print("discarded       : %s" % ", ".join(DISCARDED_FIELDS))
    print("carried by raw, not by the dataset:")
    print("                  %s" % (", ".join(extras) if extras else "(none)"))
    if sorted(extras) != sorted(UNUSED_FIELDS):
        print("  NOTE: that list differs from the %d recorded at the time this "
              "script was written (%s). A NYSERDA release has added or removed "
              "a column -- decide whether the dataset should carry it."
              % (len(UNUSED_FIELDS), ", ".join(UNUSED_FIELDS)))
    print("-" * 66)
    print("version         : %s   vintage: %s" % (args.version,
                                                  args.geoid_vintage))
    print("sourceLabel     : %d chars (max %d)"
          % (len(source_label), SOURCE_LABEL_MAX))
    print("KeyChecksum     : %s" % key_checksum)
    print("bytes           : %d (%.2f MB)" % (len(blob), len(blob) / 1e6))

    rc = 0
    if args.verify_against:
        rc = verify(blob, doc, args.verify_against)

    if not args.no_write:
        os.makedirs(OUT_DIR, exist_ok=True)
        out_path = os.path.join(
            OUT_DIR, "%s_v%s.json" % (BTD.DATASET_KEY,
                                      args.version.replace(".", "_")))
        with open(out_path, "wb") as fh:
            fh.write(blob)
        print("-" * 66)
        print("written         : %s" % out_path)
    print("=" * 66)
    return rc


if __name__ == "__main__":
    sys.exit(main())
