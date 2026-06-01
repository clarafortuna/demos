"""
enrich_map_payload.py — Join granular NYS DAC indicators onto map_payload.json

Pipeline:
  1. Load data/NYS_DAC.geojson (1,736 statewide DAC tracts, 67 fields each)
  2. Filter to Con Edison territory by County
  3. Index by GEOID
  4. Left-join 48 granular indicator fields onto each map_payload feature:
       - DAC ConEd tract with a GEOID match -> copy the 48 values
       - any other tract (Non-DAC, no match) -> set the 48 fields to null
         (uniform schema across all 2,333 features)
  5. Preserve everything existing (20 props, geometry, bbox, nondac_by_county)
  6. Write map_payload.json minified (no whitespace)

Idempotent: re-running re-derives the same 48 fields from the geojson.
"""

import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # ExecutiveDashboard/

NYS_PATH = os.path.join(HERE, "NYS_DAC.geojson")
MAP_PATH = os.path.join(ROOT, "map_payload.json")

CONED_COUNTIES = ["Kings", "Bronx", "Queens", "New York", "Westchester", "Richmond"]

# Fields already present in map_payload.json — never duplicated.
ALREADY = {
    "GEOID", "County", "City_Town", "DAC_Desig", "Pop_Cnt", "HH_Cnt",
    "Rank_State", "Comb_Sc", "Burden_Pct", "Vulner_Pct", "Energy_Aff",
}
# Always excluded per request.
EXCLUDED = {"OBJECTID", "Shape__Area", "Shape__Length"}
# Classification metadata excluded by the chosen scope ("44 + rankings/scores").
CLASS_META = {"REDC", "NYC_Region", "Urb_Rural", "Trib_Desig", "HH_Low_Cnt"}


def main():
    with open(NYS_PATH, encoding="utf-8") as f:
        nys = json.load(f)
    with open(MAP_PATH, encoding="utf-8") as f:
        mp = json.load(f)

    all_fields = list(nys["features"][0]["properties"].keys())
    add_fields = [
        k for k in all_fields
        if k not in ALREADY and k not in EXCLUDED and k not in CLASS_META
    ]

    # Index ConEd-territory DAC tracts by GEOID.
    nys_by_geoid = {
        f["properties"]["GEOID"]: f["properties"]
        for f in nys["features"]
        if f["properties"]["County"] in CONED_COUNTIES
    }

    matched = 0
    nulled = 0
    for feat in mp["features"]:
        geoid = feat["properties"]["GEOID"]
        src = nys_by_geoid.get(geoid)
        if src is not None:
            for k in add_fields:
                feat["properties"][k] = src[k]
            matched += 1
        else:
            for k in add_fields:
                feat["properties"][k] = None
            nulled += 1

    size_before = os.path.getsize(MAP_PATH)
    with open(MAP_PATH, "w", encoding="utf-8") as f:
        json.dump(mp, f, separators=(",", ":"), ensure_ascii=False)
    size_after = os.path.getsize(MAP_PATH)

    print("=" * 56)
    print("ENRICHMENT REPORT")
    print("=" * 56)
    print("Fields added per tract        : %d" % len(add_fields))
    print("Tracts enriched (GEOID match) : %d" % matched)
    print("Tracts with fields = null     : %d" % nulled)
    print("Total tracts                  : %d" % len(mp["features"]))
    print("-" * 56)
    print("Size before : %d bytes (%.2f MB)" % (size_before, size_before / 1e6))
    print("Size after  : %d bytes (%.2f MB)" % (size_after, size_after / 1e6))
    print("Delta       : +%d bytes (+%.2f MB, +%.0f%%)" % (
        size_after - size_before,
        (size_after - size_before) / 1e6,
        (size_after - size_before) / size_before * 100,
    ))
    print("=" * 56)
    print("Added fields:")
    print("  " + ", ".join(add_fields))


if __name__ == "__main__":
    main()
