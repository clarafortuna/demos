"""
enrich_neighborhoods.py — Add `neighborhood` + `borough` to map_payload.json

Pipeline:
  1. Back up map_payload.json -> map_payload.backup2.json (only if absent)
  2. Load the NYC 2020 Census Tract -> NTA crosswalk CSV, indexed by GEOID
     (the CSV's GEOID column is already the 11-digit form, matching map_payload)
  3. For each tract feature, set:
       - borough      : display name derived from County
       - neighborhood : NYC  -> NTAName from the crosswalk (by GEOID), else null
                        Westchester -> City_Town with " city"/" village" stripped
                        other -> null
  4. Write map_payload.json minified (no whitespace)

Idempotent: neighborhood/borough are re-derived from County / City_Town /
GEOID->crosswalk on every run, so re-running yields the same result. The
backup is created once (preserving the pre-neighborhood snapshot).
"""

import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)  # ExecutiveDashboard_dev/

MAP_PATH = os.path.join(ROOT, "map_payload.json")
BACKUP_PATH = os.path.join(ROOT, "map_payload.backup2.json")
CSV_PATH = os.path.join(HERE, "2020_Census_Tracts_to_2020_NTAs_and_CDTAs_Equivalency_20260601.csv")

NYC_COUNTIES = {"Kings", "New York", "Richmond", "Bronx", "Queens"}
BOROUGH = {
    "Kings": "Brooklyn",
    "New York": "Manhattan",
    "Richmond": "Staten Island",
    "Bronx": "Bronx",
    "Queens": "Queens",
    "Westchester": "Westchester",
}


def clean_city_town(name):
    """Strip a trailing ' city' / ' village' suffix; keep odd values readable."""
    if not name:
        return None
    for suffix in (" city", " village"):
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return name


def main():
    # 1. Backup once.
    if not os.path.exists(BACKUP_PATH):
        with open(MAP_PATH, "rb") as src, open(BACKUP_PATH, "wb") as dst:
            dst.write(src.read())
        backup_note = "created"
    else:
        backup_note = "already exists (kept)"

    # 2. Crosswalk GEOID -> NTAName.
    nta_by_geoid = {}
    with open(CSV_PATH, encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            nta_by_geoid[row["GEOID"]] = row["NTAName"]

    # 3. Enrich.
    with open(MAP_PATH, encoding="utf-8") as f:
        mp = json.load(f)

    matched_nyc = {}        # borough -> count with NTA
    westchester_n = 0
    unmatched_nyc = 0
    unmatched_dac = 0
    unmatched_nondac = 0
    null_other = 0
    neighborhoods = set()

    for feat in mp["features"]:
        p = feat["properties"]
        county = p.get("County")
        p["borough"] = BOROUGH.get(county)

        if county in NYC_COUNTIES:
            nta = nta_by_geoid.get(p.get("GEOID"))
            if nta:
                p["neighborhood"] = nta
                neighborhoods.add(nta)
                b = BOROUGH.get(county, county)
                matched_nyc[b] = matched_nyc.get(b, 0) + 1
            else:
                p["neighborhood"] = None
                unmatched_nyc += 1
                if p.get("DAC_Desig") == "Designated as DAC":
                    unmatched_dac += 1
                else:
                    unmatched_nondac += 1
        elif county == "Westchester":
            nb = clean_city_town(p.get("City_Town"))
            p["neighborhood"] = nb
            if nb:
                neighborhoods.add(nb)
            westchester_n += 1
        else:
            p["neighborhood"] = None
            null_other += 1

    # 4. Write minified.
    size_before = os.path.getsize(MAP_PATH)
    with open(MAP_PATH, "w", encoding="utf-8") as f:
        json.dump(mp, f, separators=(",", ":"), ensure_ascii=False)
    size_after = os.path.getsize(MAP_PATH)

    total = len(mp["features"])
    matched_total = sum(matched_nyc.values())

    print("=" * 60)
    print("NEIGHBORHOOD ENRICHMENT REPORT")
    print("=" * 60)
    print("Backup (map_payload.backup2.json): " + backup_note)
    print("Total tracts: %d" % total)
    print("-" * 60)
    print("Matched per borough (NYC, neighborhood = NTA):")
    for b in ("Brooklyn", "Manhattan", "Bronx", "Queens", "Staten Island"):
        print("  %-14s %d" % (b, matched_nyc.get(b, 0)))
    print("  NYC matched total: %d" % matched_total)
    print("Westchester (neighborhood = cleaned City_Town): %d" % westchester_n)
    print("-" * 60)
    print("Unmatched NYC tracts (neighborhood = null): %d" % unmatched_nyc)
    print("  of which DAC:     %d" % unmatched_dac)
    print("  of which Non-DAC: %d" % unmatched_nondac)
    if null_other:
        print("Other counties set to null: %d" % null_other)
    print("-" * 60)
    print("Tracts with a neighborhood: %d" % (matched_total + westchester_n))
    print("Distinct neighborhood values: %d" % len(neighborhoods))
    print("-" * 60)
    print("Size: %d -> %d bytes (%.2f -> %.2f MB, +%d bytes)" % (
        size_before, size_after, size_before / 1e6, size_after / 1e6,
        size_after - size_before,
    ))
    print("=" * 60)


if __name__ == "__main__":
    main()
