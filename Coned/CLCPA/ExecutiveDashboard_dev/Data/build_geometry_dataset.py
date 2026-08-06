"""
build_geometry_dataset.py — extract the map's tract GEOMETRY out of
map_payload.json into a versioned dataset file for Dataverse
(cr2bf_dactractdataset.cr2bf_DataFile, DatasetKey = tract_geometry).

Why this exists
---------------
map_payload.json carries three unrelated things: the NYSERDA indicator values
(already moved out by build_tract_dataset.py), the ConEd operational fields
(already in cr2bf_dacmaptractdata), and the tract polygons plus the properties
derived from them. This script moves the third group, so the geometry the map
draws becomes a versioned, swappable dataset like the indicators.

Pairing
-------
Geometry is never activated on its own. The active INDICATOR dataset declares
its GeoidVintage, and the app loads the published geometry dataset whose
GeoidVintage matches. One decision, one toggle, no way for the two to disagree.

Which properties travel with the geometry
-----------------------------------------
Everything whose value depends on which polygon a tract has:

  County, City_Town, borough  - stable per GEOID, but they describe the tract
                                this file draws, so they ship with it
  neighborhood                - NTA name from a VINTAGE-KEYED crosswalk. The
                                2020 equivalency table only knows 2020 GEOIDs,
                                which is exactly why 129 of today's tracts have
                                no name (see the mixed build report below)
  electric_networks, gas_areas- computed by >=5% AREA INTERSECTION against the
  hvi                           CECONY shapefiles / HVI ZCTAs. Change the
                                polygons and these must be recomputed, not
                                copied
  _geom_year                  - which source vintage supplied each polygon

GEOID is the key, so it lives in tracts.geoids rather than in tracts.fields.

Absent vs null
--------------
A columnar file can only say null, never "absent". map_payload.json omits `hvi`
entirely on the 216 tracts with no >=5% ZCTA overlap, so this file writes null
there. The reader is written to match: a null never creates a property that the
tract did not already have, so the rebuilt feature is identical to the payload's
rather than merely equivalent to it. Where the property does exist, null still
overwrites, because that is a real "no value".

Output shape (kind: "geometry")
-------------------------------
  { schema, kind, dataset{}, tracts { geoids[], geometry[], fields{} } }

geometry[] and every fields[] column are aligned to geoids[], the same
columnar contract build_tract_dataset.py uses, so the same alignment check
guards both.

Usage
-----
  python Data/build_geometry_dataset.py --mixed
      --> writes Data/out/tract_geometry_mixed-2020-2010.json

      Reproduces the geometry map_payload.json draws TODAY, exactly: the 2020
      polygon where the GEOID exists in the 2020 tract file, the 2010 polygon
      for the 150 that do not. Values are copied verbatim from the payload, so
      a map drawn from this dataset is byte-identical to a map drawn from the
      payload. That byte-identity is the acceptance test for the geometry read
      path: it proves the engine was swapped without changing the output.

      It declares geoidVintage "2010" because that is the key space it draws --
      the same vintage nyserda_dac v1.0 declares -- so the two pair. The
      version label says mixed-2020-2010 because the SHAPES are mixed.

True single-vintage builds (--vintage 2010 / 2020) are deliberately NOT in this
script yet. They are not a filter over the payload: they need the polygons read
from ny_tracts.geojson / ny_tracts_2010.geojson AND electric_networks, gas_areas
and hvi recomputed against those polygons, which means re-running the shapefile
and ZCTA intersections. That is the next slice.
"""

import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAP_PATH = os.path.join(ROOT, "map_payload.json")
OUT_DIR = os.path.join(HERE, "out")

MANIFEST_SCHEMA = 1
DATASET_KEY = "tract_geometry"

# Properties that describe the polygon rather than the tract's statistics.
# Order is fixed so the output is reproducible.
GEOM_PROPERTIES = [
    "County", "City_Town", "borough", "neighborhood",
    "electric_networks", "gas_areas", "hvi", "_geom_year",
]

MIXED = {
    "version": "mixed-2020-2010",
    "name": "Census tract geometry, 2020 with 2010 fallback",
    # The vintage it PAIRS with, i.e. the key space it draws.
    "geoid_vintage": "2010",
    "source_label": (
        "U.S. Census Bureau cartographic boundary files, cb_2020_36_tract_500k "
        "with cb_2010 for the tracts absent from the 2020 file. Extracted "
        "verbatim from map_payload.json by Data/build_geometry_dataset.py "
        "--mixed, so it draws exactly what the dashboard drew before geometry "
        "became a dataset."
    ),
}


def main():
    if "--mixed" not in sys.argv:
        sys.exit("usage: python Data/build_geometry_dataset.py --mixed\n"
                 "(single-vintage builds need the polygons re-read and the "
                 "spatial properties recomputed; that is the next slice)")

    mp = json.load(open(MAP_PATH, encoding="utf-8"))
    feats = mp["features"]

    geoids = [f["properties"]["GEOID"] for f in feats]
    if len(set(geoids)) != len(geoids):
        sys.exit("duplicate GEOIDs in map_payload.json")

    # Verbatim copies. No rounding, no re-projection, no re-ordering: the point
    # of the mixed build is that the render cannot move.
    geometry = [f["geometry"] for f in feats]
    fields = {k: [f["properties"].get(k) for f in feats] for k in GEOM_PROPERTIES}

    key_checksum = hashlib.sha256("\n".join(sorted(geoids)).encode("utf-8")).hexdigest()

    doc = {
        "schema": MANIFEST_SCHEMA,
        "kind": "geometry",
        "dataset": {
            "key": DATASET_KEY,
            "version": MIXED["version"],
            "name": MIXED["name"],
            "sourceLabel": MIXED["source_label"],
            "geoidVintage": MIXED["geoid_vintage"],
        },
        "tracts": {"geoids": geoids, "geometry": geometry, "fields": fields},
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    out_name = "%s_%s.json" % (DATASET_KEY, MIXED["version"])
    out_path = os.path.join(OUT_DIR, out_name)
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, separators=(",", ":"), ensure_ascii=False)
    size = os.path.getsize(out_path)

    by_year = {}
    for f in feats:
        y = f["properties"].get("_geom_year")
        by_year[y] = by_year.get(y, 0) + 1
    named = sum(1 for f in feats if f["properties"].get("neighborhood"))

    print("=" * 66)
    print("GEOMETRY DATASET BUILT")
    print("=" * 66)
    print("file            : %s" % out_path)
    print("bytes           : %d (%.2f MB)" % (size, size / 1e6))
    print("payload bytes   : %d (%.2f MB)" % (os.path.getsize(MAP_PATH),
                                              os.path.getsize(MAP_PATH) / 1e6))
    print("-" * 66)
    print("tracts          : %d" % len(geoids))
    print("polygon source  : %s" % ", ".join(
        "%d from %s" % (n, y) for y, n in sorted(by_year.items(), reverse=True)))
    print("properties      : %d  (%s)" % (len(GEOM_PROPERTIES), ", ".join(GEOM_PROPERTIES)))
    print("-" * 66)
    print("neighborhood    : %d named, %d null" % (named, len(geoids) - named))
    print("                  The nulls are the NYC tracts drawn on 2010 geometry.")
    print("                  The DCP equivalency table is 2020-keyed, so it has no")
    print("                  row for them. Shipping the nulls is deliberate and")
    print("                  matches what the payload shows today; sourcing the")
    print("                  2010 NTA table would fix it and is a separate task.")
    print("-" * 66)
    print("Paste these into the Dataverse record:")
    print("  cr2bf_DatasetName    : %s" % MIXED["name"])
    print("  cr2bf_DatasetKey     : %s" % DATASET_KEY)
    print("  cr2bf_VersionLabel   : %s" % MIXED["version"])
    print("  cr2bf_SourceLabel    : %s" % MIXED["source_label"])
    print("  cr2bf_GeoidVintage   : %s" % MIXED["geoid_vintage"])
    print("  cr2bf_TractCount     : %d" % len(geoids))
    print("  cr2bf_FieldCount     : %d" % len(GEOM_PROPERTIES))
    print("  cr2bf_KeyChecksum    : %s" % key_checksum)
    print("  cr2bf_ManifestVersion: %d" % MANIFEST_SCHEMA)
    print("  cr2bf_IsActive       : Yes  (published, i.e. available for pairing)")
    print("=" * 66)
    print("Pairs with an indicator dataset whose GeoidVintage is %s"
          % MIXED["geoid_vintage"])
    print("(nyserda_dac v1.0 declares exactly that).")
    print("=" * 66)


if __name__ == "__main__":
    main()
