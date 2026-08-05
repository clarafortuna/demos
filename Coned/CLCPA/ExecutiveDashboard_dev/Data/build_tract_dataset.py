"""
build_tract_dataset.py — extract the NYSERDA per-tract release out of
map_payload.json into a single versioned dataset file for Dataverse
(cr2bf_dactractdataset.cr2bf_DataFile).

Why this exists
---------------
Today the ~56 NYSERDA fields are baked into map_payload.json, so a NYSERDA v2.0
means rebuilding and redeploying the payload. Moving them to a Dataverse File
column makes a new release an upload plus an IsActive flip.

The file carries BOTH the per-tract values AND a manifest describing them, so
the Color By dropdown, tract tooltip, detail box and CSV export build themselves
from the active dataset. A v2.0 that renames, relabels, reorders or adds
indicators therefore needs no code change.

Output shape (see MANIFEST_SCHEMA)
----------------------------------
  { schema, dataset{}, roles{}, formats{}, groups[], layout{}, indicators[],
    tracts { geoids[], fields{ id: [values aligned to geoids] } } }

Columnar, and every tract that carries data:
  - columnar because the ~56 field names would otherwise repeat 2,333 times
  - full float precision by DEFAULT, because that is the only setting under which
    the dataset-driven render is BYTE-identical to the payload-driven one. 6dp is
    lossless for every displayed VALUE and every colour bin (verified: 2dp shifts
    163 displayed values and 1 colour bin, 3dp shifts 10, 4dp shifts 1, 6dp
    shifts none) -- but the tract detail box writes the raw value into an inline
    bar width, so 6dp yields `width:70.954442%` where the payload gives
    `width:70.9544423830138%`. Visually and numerically identical; not byte
    identical. Pass --decimals 6 to trade 30% of the file size (1.18 MB -> 0.91 MB)
    for that difference.
  - DAC_Desig is non-null on all 2,333 tracts, so every drawn tract has a row;
    the reader still distinguishes "absent key" from "null value" for a future
    version whose vintage covers fewer tracts (see ABSENT vs NULL)

ABSENT vs NULL
--------------
A tract absent from tracts.geoids means "this dataset has no row for it" — for
example a Non-DAC tract, or a GEOID vintage mismatch. A tract present with a
null field value means "this dataset has a row, but this field is empty". The
app must not conflate them: conflating is exactly how a v2.0 vintage mismatch
would silently blank 88 DAC tracts.

The indicator catalog is parsed out of app.js rather than restated here, so the
manifest provably matches the UI as it ships today. That is what makes the
acceptance test (dataset-driven render == payload-driven render) meaningful.

Usage
-----
  python Data/build_tract_dataset.py [--decimals 6]
      --> writes Data/out/nyserda_dac_v1_0.json  and prints the record fields
          to paste into Dataverse (TractCount / FieldCount / KeyChecksum / ...)

  python Data/build_tract_dataset.py --synthetic-v2
      --> writes Data/out/nyserda_dac_v2_0-test.json, a SYNTHETIC fixture for
          exercising the GEOID-vintage coverage guard. See SYNTHETIC V2 below.

SYNTHETIC V2
------------
The vintage guard is an acceptance criterion, but it cannot be exercised with a
real file until NYSERDA actually ships a 2020-keyed release. --synthetic-v2
builds the file that release would look like: identical values and manifest,
but the 150 tracts the map draws on 2010 fallback geometry are re-keyed to
2020-style GEOIDs, which is precisely what a re-vintaged release would do.

The 2020 GEOIDs are INVENTED, not crosswalked - there is no 2010-to-2020 tract
crosswalk in this repo, and a real one is not needed to trip the guard. They are
generated as the next free tract code inside the same county and verified to
collide with nothing the map draws, so the coverage arithmetic is exact and
repeatable. The file names itself synthetic in dataset.name and sourceLabel so
it can never be mistaken for a NYSERDA release inside Dataverse.
"""

import hashlib
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
APP_JS = os.path.join(ROOT, "app.js")
MAP_PATH = os.path.join(ROOT, "map_payload.json")
OUT_DIR = os.path.join(HERE, "out")

MANIFEST_SCHEMA = 1
DATASET_KEY = "nyserda_dac"
VERSION_LABEL = "1.0"
DATASET_NAME = "NYSERDA DAC indicators"
SOURCE_LABEL = "NYSERDA / NYS Climate Justice Working Group, Final Disadvantaged Communities criteria, 2023 release"
# v1.0 keys to 2010-era census tracts. 88 of the 1,059 ConEd DAC tracts have
# GEOIDs that exist only in the 2010 tract file and are drawn with 2010 geometry.
GEOID_VINTAGE = "2010"
# None = full precision (default; required for a byte-identical render).
# An integer rounds to that many places. See the module docstring.
DECIMALS = None

# ---- --synthetic-v2 overrides (see SYNTHETIC V2 in the module docstring) ------
SYNTH_VERSION_LABEL = "2.0-test"
SYNTH_GEOID_VINTAGE = "2020"
SYNTH_DATASET_NAME = "SYNTHETIC TEST FILE, NYSERDA DAC indicators v2.0-test"
SYNTH_SOURCE_LABEL = (
    "SYNTHETIC TEST FIXTURE, NOT A NYSERDA RELEASE. Built by "
    "Data/build_tract_dataset.py --synthetic-v2 from the v1.0 values, with the "
    "150 tracts drawn on 2010 fallback geometry re-keyed to invented 2020-style "
    "GEOIDs. Exists only to exercise the GEOID-vintage coverage guard. Do not "
    "activate as a real dataset version."
)

# Fields consumed by the map that come from the same NYSERDA release but are NOT
# in the Color By dropdown. They ride in the dataset because leaving them behind
# would let v2.0 update the indicators while these stayed v1.0.
NON_DROPDOWN_FIELDS = [
    "Burden_Sc", "Vulner_Sc", "Rank_State", "DAC_Desig", "Pop_Cnt", "HH_Cnt",
]

# Roles let the app stop hardcoding privileged keys. Every value must resolve to
# a field carried by this dataset, or activation is refused.
ROLES = {
    "defaultIndicator": "Comb_Sc",
    "headlineScore": "Comb_Sc",
    "headlinePercentile": "Rank_State",
    "envScore": "Burden_Sc",
    "envPercentile": "Burden_Pct",
    "popScore": "Vulner_Sc",
    "popPercentile": "Vulner_Pct",
    "dacFlag": "DAC_Desig",
    "population": "Pop_Cnt",
    "households": "HH_Cnt",
}
# Value of the dacFlag field that means "this tract is a designated DAC".
DAC_FLAG_TRUE = "Designated as DAC"

# Named formats. The app owns the ramps; the manifest may only reference ones it
# knows, so an unknown format refuses activation rather than rendering blank.
FORMATS = {
    "pct": {"ramp": "pct-0-100", "label": "percentile (0-100)"},
    "score": {"ramp": "score-90-120", "label": "raw burden score"},
}

# Group ids are stable identifiers; labels are display text and may change freely
# in a future version. `component` drives the env/pop colouring in the detail box.
GROUP_IDS = {
    "Summary": ("summary", None),
    "Environmental Burdens": ("env_burdens", "env"),
    "Climate Risks": ("climate", "env"),
    "Health": ("health", "pop"),
    "Demographics / Vulnerability": ("demographics", "pop"),
    "Affordability & Ranking": ("affordability", None),
}

# The detail box is a curated two-zone layout, not a dump of every group: the
# Summary and Affordability groups are deliberately not shown there, and one
# column's title differs from its group label. Encoding that here is what lets
# the detail box be manifest-driven at all.
LAYOUT = {
    "detailZones": [
        {"title": "Environmental Burden", "component": "env", "columns": [
            {"title": "Environmental Burdens", "group": "env_burdens"},
            {"title": "Climate Risks", "group": "climate"},
        ]},
        {"title": "Population Vulnerability", "component": "pop", "columns": [
            {"title": "Health", "group": "health"},
            {"title": "Demographics / Socioeconomic", "group": "demographics"},
        ]},
    ],
    "csvThematicGroups": ["env_burdens", "climate", "health", "demographics"],
}


def parse_indicator_catalog(app_js_path):
    """Read MAP_INDICATOR_GROUPS out of app.js so the manifest matches the UI."""
    src = open(app_js_path, encoding="utf-8").read()
    start = src.index("const MAP_INDICATOR_GROUPS")
    # The literal is followed by the INDICATOR CATALOG section that consumes it.
    for marker in ("// INDICATOR CATALOG", "const IND_KNOWN_RAMPS"):
        end = src.find(marker, start)
        if end > 0:
            break
    if end <= 0:
        sys.exit("could not find the end of MAP_INDICATOR_GROUPS in app.js")
    block = src[start:end]
    groups, current = [], None
    for line in block.splitlines():
        gm = re.search(r"\{ group: '([^']+)', items: \[", line)
        if gm:
            current = {"label": gm.group(1), "items": []}
            groups.append(current)
            continue
        im = re.search(r"\{ key: '([^']+)',\s*label: '([^']*)',\s*scale: '([a-z]+)'", line)
        if im and current is not None:
            current["items"].append({"key": im.group(1), "label": im.group(2),
                                     "format": im.group(3)})
    if not groups:
        sys.exit("could not parse MAP_INDICATOR_GROUPS out of app.js")
    return groups


def r6(v):
    """Round floats to DECIMALS; pass ints, strings and None through untouched."""
    if isinstance(v, bool) or v is None:
        return v
    if isinstance(v, float):
        return v if DECIMALS is None else round(v, DECIMALS)
    return v


def revintage_2020(rows, drawn_geoids):
    """Re-key the 2010-fallback tracts to invented, collision-free 2020 GEOIDs.

    Returns (geoids, remapped_count). A real 2020 release would carry the true
    crosswalked codes; what matters for the guard is only that the keys are no
    longer the ones the map draws, which is what re-vintaging actually causes.
    """
    taken = set(drawn_geoids)
    out, remapped = [], 0
    for p in rows:
        gid = p["GEOID"]
        if p.get("_geom_year") != 2010:
            out.append(gid)
            continue
        county, tract = gid[:5], gid[5:]
        # 001900 -> 001901, the shape a real 2020 tract split takes. Step until
        # the code is free, so no synthetic key can shadow a drawn tract.
        n = int(tract)
        while True:
            n += 1
            cand = county + str(n).zfill(len(tract))
            if cand not in taken:
                break
        taken.add(cand)
        out.append(cand)
        remapped += 1
    return out, remapped


def main():
    global DECIMALS, VERSION_LABEL, GEOID_VINTAGE, DATASET_NAME, SOURCE_LABEL
    if "--decimals" in sys.argv:
        DECIMALS = int(sys.argv[sys.argv.index("--decimals") + 1])
    synthetic = "--synthetic-v2" in sys.argv
    if synthetic:
        VERSION_LABEL = SYNTH_VERSION_LABEL
        GEOID_VINTAGE = SYNTH_GEOID_VINTAGE
        DATASET_NAME = SYNTH_DATASET_NAME
        SOURCE_LABEL = SYNTH_SOURCE_LABEL
    groups_raw = parse_indicator_catalog(APP_JS)
    dropdown = [it for g in groups_raw for it in g["items"]]
    dropdown_keys = [it["key"] for it in dropdown]
    all_fields = dropdown_keys + NON_DROPDOWN_FIELDS

    dupes = [k for k in set(all_fields) if all_fields.count(k) > 1]
    if dupes:
        sys.exit("field listed twice: %s" % dupes)

    mp = json.load(open(MAP_PATH, encoding="utf-8"))
    feats = mp["features"]

    # A tract "carries data" when any dataset field is non-null. Non-DAC tracts
    # are all-null and are simply absent from the file (see ABSENT vs NULL).
    rows = []
    for f in feats:
        p = f["properties"]
        if any(p.get(k) is not None for k in all_fields):
            rows.append(p)

    geoids = [p["GEOID"] for p in rows]
    remapped = 0
    if synthetic:
        geoids, remapped = revintage_2020(rows, [f["properties"]["GEOID"] for f in feats])
        if not remapped:
            sys.exit("--synthetic-v2 remapped nothing; no 2010-fallback tracts found")
    if len(set(geoids)) != len(geoids):
        sys.exit("duplicate GEOIDs among data-carrying tracts")

    fields = {k: [r6(p.get(k)) for p in rows] for k in all_fields}

    manifest_groups = []
    for order, g in enumerate(groups_raw, start=1):
        gid, comp = GROUP_IDS[g["label"]]
        entry = {"id": gid, "label": g["label"], "order": order}
        if comp:
            entry["component"] = comp
        manifest_groups.append(entry)

    indicators = []
    for g in groups_raw:
        gid, _ = GROUP_IDS[g["label"]]
        for order, it in enumerate(g["items"], start=1):
            indicators.append({"id": it["key"], "label": it["label"],
                               "group": gid, "format": it["format"], "order": order})

    # Integrity fields for the Dataverse record. KeyChecksum is over the sorted
    # GEOID list, so a truncated or reordered upload is detectable.
    key_checksum = hashlib.sha256("\n".join(sorted(geoids)).encode("utf-8")).hexdigest()

    doc = {
        "schema": MANIFEST_SCHEMA,
        "dataset": {
            "key": DATASET_KEY,
            "version": VERSION_LABEL,
            "name": DATASET_NAME,
            "sourceLabel": SOURCE_LABEL,
            "geoidVintage": GEOID_VINTAGE,
            "decimals": DECIMALS,   # null = full precision
        },
        "roles": dict(ROLES, dacFlagTrueValue=DAC_FLAG_TRUE),
        "formats": FORMATS,
        "groups": manifest_groups,
        "layout": LAYOUT,
        "indicators": indicators,
        # Fields carried but not offered in the dropdown (roles reference them).
        "extraFields": NON_DROPDOWN_FIELDS,
        "tracts": {"geoids": geoids, "fields": fields},
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    out_name = "%s_v%s.json" % (DATASET_KEY, VERSION_LABEL.replace(".", "_"))
    out_path = os.path.join(OUT_DIR, out_name)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, separators=(",", ":"), ensure_ascii=False)
    size = os.path.getsize(out_path)

    print("=" * 66)
    print("TRACT DATASET BUILT")
    print("=" * 66)
    print("file            : %s" % out_path)
    print("bytes           : %d (%.2f MB)" % (size, size / 1e6))
    print("payload bytes   : %d (%.2f MB)  -> dataset is %.1f%% of it"
          % (os.path.getsize(MAP_PATH), os.path.getsize(MAP_PATH) / 1e6,
             size / os.path.getsize(MAP_PATH) * 100))
    print("-" * 66)
    print("tracts in file  : %d  (of %d drawn; the rest carry no data)"
          % (len(geoids), len(feats)))
    print("fields          : %d  (%d dropdown + %d extra)"
          % (len(all_fields), len(dropdown_keys), len(NON_DROPDOWN_FIELDS)))
    print("precision       : %s" % ("full (byte-identical render)"
                                    if DECIMALS is None else "%d dp" % DECIMALS))
    print("groups          : %d" % len(manifest_groups))
    print("-" * 66)
    print("Paste these into the Dataverse record:")
    print("  cr2bf_DatasetName    : %s" % DATASET_NAME)
    print("  cr2bf_DatasetKey     : %s" % DATASET_KEY)
    print("  cr2bf_VersionLabel   : %s" % VERSION_LABEL)
    print("  cr2bf_SourceLabel    : %s" % SOURCE_LABEL)
    print("  cr2bf_GeoidVintage   : %s" % GEOID_VINTAGE)
    print("  cr2bf_TractCount     : %d" % len(geoids))
    print("  cr2bf_FieldCount     : %d" % len(all_fields))
    print("  cr2bf_KeyChecksum    : %s" % key_checksum)
    print("  cr2bf_ManifestVersion: %d" % MANIFEST_SCHEMA)
    print("  cr2bf_IsActive       : No  (the app flips this after validating)")
    print("=" * 66)

    if synthetic:
        # State the arithmetic the coverage guard will do, and the message it
        # will produce, so the hosted test has a pass/fail line to compare to.
        drawn = [f["properties"] for f in feats]
        keys = set(geoids)
        matched = sum(1 for p in drawn if p["GEOID"] in keys)
        share = matched / len(geoids)
        absent_dac = sum(1 for p in drawn
                         if p["GEOID"] not in keys and p.get("DAC_Desig") == DAC_FLAG_TRUE)
        absent_2010 = sum(1 for p in drawn
                          if p["GEOID"] not in keys and p.get("DAC_Desig") == DAC_FLAG_TRUE
                          and p.get("_geom_year") == 2010)
        print("SYNTHETIC FIXTURE, NOT A NYSERDA RELEASE")
        print("-" * 66)
        print("re-keyed tracts : %d (every tract drawn on 2010 fallback geometry)" % remapped)
        print("coverage        : %d of %d dataset keys match a drawn tract = %.1f%%"
              % (matched, len(geoids), share * 100))
        print("floor           : 98.0%%  ->  %s"
              % ("REFUSED (as intended)" if share < 0.98 else "WOULD PASS, fixture is not doing its job"))
        print("-" * 66)
        print("Expected refusal message on activation:")
        print("  only %d of the dataset's %d tracts match drawn features (%.1f%%, below" % (
            matched, len(geoids), share * 100))
        print("  the 98%% floor). Declared GEOID vintage is %s; the map draws 2020" % GEOID_VINTAGE)
        print("  geometry with a 2010 fallback. This looks like a vintage mismatch.")
        print("Expected accompanying warning:")
        print("  %d drawn DAC tract(s) have no row in this dataset and will show no" % absent_dac)
        print("  indicators (%d of them are drawn on 2010 fallback geometry, the" % absent_2010)
        print("  classic vintage symptom).")
        print("=" * 66)


if __name__ == "__main__":
    main()
