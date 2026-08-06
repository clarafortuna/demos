"""
build_pure_geometry_dataset.py — build a SINGLE-VINTAGE tract geometry dataset
for Dataverse (cr2bf_dactractdataset, DatasetKey = tract_geometry).

Why this exists
---------------
build_geometry_dataset.py --mixed lifted the payload's own polygons out
verbatim: 2020 shapes where the GEOID exists in the 2020 tract file, 2010 shapes
for the 150 that do not. That hybrid was the right first step, because it let
the geometry engine be proven byte-identical. It is not the right end state: a
dataset that declares vintage 2010 should draw 2010 tracts, not a mixture.

This script builds the pure article, from the Census tract file of that vintage.

  python Data/build_pure_geometry_dataset.py --vintage 2020
  python Data/build_pure_geometry_dataset.py --vintage 2010 [--artifact]

Not a filter over the payload
-----------------------------
Three of the eight carried properties are computed FROM the polygons by area
intersection, so they cannot be copied across a vintage change:

  electric_networks  >= 5% of the tract's area, CECONY_Electric.shp NETWORK
  gas_areas          >= 5% of the tract's area, CECONY_Gas.shp BORONAME
  hvi                >= 5% of the tract's area, hvi_zcta.geojson ZCTAs

They are recomputed here with the same rules and the same projected CRS the
enrich_* scripts use (EPSG:2263, NAD83 / New York Long Island, US survey feet).
Copying them from the payload would silently attach 2020-derived overlaps to
2010 shapes, which is the exact class of error the vintage guard exists to stop.

The remaining five travel unchanged because they do not depend on the polygon:
GEOID is the key, County comes from its digits, borough from County, City_Town
is a NYSERDA attribute, and _geom_year is stamped with this vintage.

Neighborhood names are vintage-keyed
------------------------------------
NTAs are aggregations of the census tracts OF THEIR OWN VINTAGE, so the name a
tract carries depends on which equivalency table names it:

  2020  Data/2020_Census_Tracts_to_2020_NTAs_and_CDTAs_Equivalency_*.csv
        (already in the repo; names 2,324 of 2,324 NYC 2020 tracts)

  2010  Data/2010_Census_Tract_to_2010_NTA_Equivalency_*.csv
        NYC Department of City Planning, NYC Open Data dataset 8ius-dhrr,
        "2010 Census Tract to Neighborhood Tabulation Area Equivalency table",
        2,168 rows, published 2015-02-18. NOT YET IN THE REPO. It has no GEOID
        column, so the key is built as '36' + FIPS county (3) + tract (6).

Westchester has no NTAs in either vintage and takes its name from City_Town,
which is vintage-independent, exactly as the payload pipeline does today.

Scope
-----
Each dataset carries only tracts its vintage can populate with data, so the map
never grows grey holes:

  2010  the 2,333 tracts the map draws today (all present in the 2010 file)
  2020  the 2,183 of those that still exist in the 2020 file

The remaining 57 (2010) and 382 (2020) tracts in the source files carry no
ConEd or NYSERDA data and are deliberately left out. Adding them later is
additive: a new geometry version.
"""

import csv
import hashlib
import json
import os
import sys

import shapefile                       # pyshp
from pyproj import CRS, Transformer
from shapely.geometry import shape
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAP_PATH = os.path.join(ROOT, "map_payload.json")
OUT_DIR = os.path.join(HERE, "out")

SRC = {
    "2010": os.path.join(HERE, "ny_tracts_2010.geojson"),
    "2020": os.path.join(HERE, "ny_tracts.geojson"),
}
ELEC = os.path.join(HERE, "Extra_info", "CECONY_Electric")
GAS = os.path.join(HERE, "Extra_info", "CECONY_Gas")
HVI = os.path.join(HERE, "hvi_zcta.geojson")

CROSSWALK_2020 = os.path.join(
    HERE, "2020_Census_Tracts_to_2020_NTAs_and_CDTAs_Equivalency_20260601.csv")
# Filename pattern for the 2010 table; resolved by prefix so the date suffix of
# whatever was downloaded does not have to be hardcoded.
CROSSWALK_2010_PREFIX = "2010_Census_Tract"

MANIFEST_SCHEMA = 1
DATASET_KEY = "tract_geometry"
MIN_FRAC = 0.05
GEOM_PROPERTIES = [
    "County", "City_Town", "borough", "neighborhood",
    "electric_networks", "gas_areas", "hvi", "_geom_year",
]
COUNTY_NAMES = {"005": "Bronx", "047": "Kings", "061": "New York",
                "081": "Queens", "085": "Richmond", "119": "Westchester"}
BOROUGH = {"Kings": "Brooklyn", "New York": "Manhattan", "Richmond": "Staten Island",
           "Bronx": "Bronx", "Queens": "Queens", "Westchester": "Westchester"}
NYC_COUNTIES = {"Kings", "New York", "Richmond", "Bronx", "Queens"}


def clean_city_town(name):
    if not name:
        return None
    for suffix in (" city", " village"):
        if name.endswith(suffix):
            return name[: -len(suffix)]
    return name


def load_tracts(vintage):
    """GEOID -> geometry dict, from the Census file of that vintage."""
    g = json.load(open(SRC[vintage], encoding="utf-8"))
    out = {}
    for f in g["features"]:
        p = f["properties"]
        if vintage == "2020":
            gid = str(p.get("GEOID", "")).zfill(11)
        else:
            geo_id = p.get("GEO_ID", "")
            gid = geo_id[9:] if geo_id.startswith("1400000US") else ""
        if gid:
            out[gid] = f["geometry"]
    return out


def find_crosswalk_2010():
    for name in sorted(os.listdir(HERE)):
        if name.startswith(CROSSWALK_2010_PREFIX) and name.lower().endswith(".csv"):
            return os.path.join(HERE, name)
    return None


def load_neighborhoods(vintage):
    """GEOID -> NTA name for the vintage. Returns (mapping, provenance string)."""
    if vintage == "2020":
        rows = list(csv.DictReader(open(CROSSWALK_2020, encoding="utf-8-sig")))
        return ({r["GEOID"]: r["NTAName"] for r in rows},
                "NYC DCP, 2020 Census Tracts to 2020 NTAs and CDTAs Equivalency (%d rows)"
                % len(rows))

    path = find_crosswalk_2010()
    if not path:
        sys.exit(
            "MISSING: the 2010 NTA equivalency table.\n"
            "  Expected a CSV in Data/ whose name starts with '%s'.\n"
            "  Source: NYC Department of City Planning, NYC Open Data 8ius-dhrr,\n"
            "  '2010 Census Tract to Neighborhood Tabulation Area Equivalency table'\n"
            "  (7 columns, 2,168 rows, published 2015-02-18).\n"
            "  A 2010 geometry dataset cannot be built without it: naming its tracts\n"
            "  from the 2020 table would put 2020 neighbourhood names on 2010 tracts,\n"
            "  which is the mismatch this whole design exists to prevent."
            % CROSSWALK_2010_PREFIX)

    rows = list(csv.DictReader(open(path, encoding="utf-8-sig")))
    # The 2010 table has no GEOID column: build it from FIPS county + tract.
    def col(row, *cands):
        for c in cands:
            for k in row:
                if k.strip().lower() == c:
                    return row[k]
        return None
    mapping = {}
    for r in rows:
        fips = col(r, "2010 census bureau fips county code", "fips county code")
        tract = col(r, "2010 census tract", "census tract")
        name = col(r, "neighborhood tabulation area (nta) name", "ntaname", "nta name")
        if fips is None or tract is None or name is None:
            sys.exit("the 2010 table does not have the expected columns; got: %s"
                     % list(rows[0].keys()))
        gid = "36" + str(fips).strip().zfill(3) + str(tract).strip().zfill(6)
        mapping[gid] = name
    return mapping, ("NYC DCP, 2010 Census Tract to 2010 NTA Equivalency, "
                     "NYC Open Data 8ius-dhrr (%d rows), %s" % (len(rows), os.path.basename(path)))


def load_layer(path, name_field):
    crs = CRS.from_wkt(open(path + ".prj", encoding="utf-8").read())
    r = shapefile.Reader(path, encoding="utf-8")
    names, geoms = [], []
    for sr in r.shapeRecords():
        g = shape(sr.shape.__geo_interface__)
        if not g.is_valid:
            g = g.buffer(0)
        names.append(sr.record.as_dict().get(name_field))
        geoms.append(g)
    r.close()
    return names, geoms, STRtree(geoms), crs


def assign_named(tg, area, names, geoms, tree, fallback_largest):
    """Same rule as enrich_electric_network.py: >=5% of the tract, dominant
    first, optional single-largest fallback, [] when nothing intersects."""
    hits = []
    for idx in tree.query(tg):
        i = int(idx)
        if not tg.intersects(geoms[i]):
            continue
        a = tg.intersection(geoms[i]).area
        if a > 0:
            hits.append((a, names[i]))
    hits.sort(key=lambda t: t[0], reverse=True)
    thr = MIN_FRAC * area if area > 0 else 0.0
    kept = [n for a, n in hits if a >= thr]
    if not kept and hits and fallback_largest:
        kept = [hits[0][1]]
    return kept


def assign_hvi(tg, area, zids, scores, geoms, tree):
    """Same rule as enrich_hvi.py: >=5%, dominant first, NO fallback."""
    if area <= 0:
        return []
    thr = MIN_FRAC * area
    hits = []
    for idx in tree.query(tg):
        i = int(idx)
        if not tg.intersects(geoms[i]):
            continue
        a = tg.intersection(geoms[i]).area
        if a >= thr:
            hits.append((a, zids[i], scores[i]))
    hits.sort(key=lambda t: t[0], reverse=True)
    return [{"zcta": z, "score": s, "overlap_fraction": round(a / area, 4)}
            for a, z, s in hits]


def main():
    if "--vintage" not in sys.argv:
        sys.exit("usage: python Data/build_pure_geometry_dataset.py --vintage 2010|2020 [--artifact]")
    vintage = sys.argv[sys.argv.index("--vintage") + 1]
    if vintage not in SRC:
        sys.exit("vintage must be 2010 or 2020")

    mp = json.load(open(MAP_PATH, encoding="utf-8"))
    payload = {f["properties"]["GEOID"]: f for f in mp["features"]}
    tracts = load_tracts(vintage)

    # Scope: the tracts this vintage can populate with data (see the docstring).
    geoids = sorted(g for g in payload if g in tracts)
    if not geoids:
        sys.exit("no overlap between the payload universe and the %s tract file" % vintage)

    nta, nta_provenance = load_neighborhoods(vintage)

    # ---- recompute the three spatial properties, in EPSG:2263 --------------
    elec_names, elec_geoms, elec_tree, elec_crs = load_layer(ELEC, "NETWORK")
    gas_names, gas_geoms, gas_tree, _ = load_layer(GAS, "BORONAME")
    hz = json.load(open(HVI, encoding="utf-8"))
    tf = Transformer.from_crs(CRS.from_epsg(4326), elec_crs, always_xy=True)

    def reproj(coords):
        if coords and isinstance(coords[0], (int, float)):
            x, y = tf.transform(coords[0], coords[1])
            return [x, y]
        return [reproj(c) for c in coords]

    zids, zscores, zgeoms = [], [], []
    for f in hz["features"]:
        p = f["properties"]
        g = shape({"type": f["geometry"]["type"], "coordinates": reproj(f["geometry"]["coordinates"])})
        if not g.is_valid:
            g = g.buffer(0)
        zgeoms.append(g)
        zids.append(p.get("zcta") or p.get("ZCTA") or p.get("MODZCTA"))
        zscores.append(p.get("score") if p.get("score") is not None
                       else p.get("HVI") or p.get("Heat_Vulnerability_Index__HVI_"))
    ztree = STRtree(zgeoms)

    print("recomputing spatial properties for %d tracts in %s ..." % (len(geoids), elec_crs.name))
    fields = {k: [] for k in GEOM_PROPERTIES}
    geometry = []
    named = unnamed = 0
    for n, gid in enumerate(geoids):
        geom = tracts[gid]
        geometry.append(geom)
        tg = shape({"type": geom["type"], "coordinates": reproj(geom["coordinates"])})
        if not tg.is_valid:
            tg = tg.buffer(0)
        area = tg.area
        county = COUNTY_NAMES.get(gid[2:5])
        src = payload[gid]["properties"]
        city_town = src.get("City_Town")
        if county in NYC_COUNTIES:
            nb = nta.get(gid)
            if nb:
                named += 1
            else:
                unnamed += 1
        elif county == "Westchester":
            nb = clean_city_town(city_town)
            named += 1 if nb else 0
        else:
            nb = None
        hvi = assign_hvi(tg, area, zids, zscores, zgeoms, ztree)
        fields["County"].append(county)
        fields["City_Town"].append(city_town)
        fields["borough"].append(BOROUGH.get(county))
        fields["neighborhood"].append(nb)
        fields["electric_networks"].append(
            assign_named(tg, area, elec_names, elec_geoms, elec_tree, True))
        fields["gas_areas"].append(
            assign_named(tg, area, gas_names, gas_geoms, gas_tree, True))
        # Match the payload exactly: no >=5% overlap means NO hvi, not an empty
        # list. The reader turns a null back into an absent property.
        fields["hvi"].append(hvi if hvi else None)
        fields["_geom_year"].append(int(vintage))
        if (n + 1) % 500 == 0:
            print("   %d/%d" % (n + 1, len(geoids)))

    key_checksum = hashlib.sha256("\n".join(sorted(geoids)).encode("utf-8")).hexdigest()
    version = "pure-" + vintage
    doc = {
        "schema": MANIFEST_SCHEMA,
        "kind": "geometry",
        "dataset": {
            "key": DATASET_KEY,
            "version": version,
            "name": "Census tract geometry, %s" % vintage,
            "sourceLabel": (
                "U.S. Census Bureau cartographic boundary file, %s vintage, six Con Edison "
                "counties. Neighborhood names: %s. electric_networks, gas_areas and hvi "
                "recomputed against these polygons at a 5%% area threshold in %s. "
                "Built by Data/build_pure_geometry_dataset.py --vintage %s."
                % (vintage, nta_provenance, elec_crs.name, vintage)),
            "geoidVintage": vintage,
        },
        "tracts": {"geoids": geoids, "geometry": geometry, "fields": fields},
    }

    os.makedirs(OUT_DIR, exist_ok=True)
    out_path = os.path.join(OUT_DIR, "%s_%s.json" % (DATASET_KEY, version))
    with open(out_path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, separators=(",", ":"), ensure_ascii=False)
    size = os.path.getsize(out_path)

    print("=" * 66)
    print("PURE %s GEOMETRY DATASET BUILT" % vintage)
    print("=" * 66)
    print("file            : %s" % out_path)
    print("bytes           : %d (%.2f MB)" % (size, size / 1e6))
    print("tracts          : %d" % len(geoids))
    print("properties      : %d" % len(GEOM_PROPERTIES))
    print("neighborhood    : %d named, %d unnamed" % (named, len(geoids) - named))
    print("names from      : %s" % nta_provenance)
    print("spatial props   : recomputed in %s" % elec_crs.name)
    print("-" * 66)
    print("Paste these into the Dataverse record:")
    print("  cr2bf_DatasetName    : %s" % doc["dataset"]["name"])
    print("  cr2bf_DatasetKey     : %s" % DATASET_KEY)
    print("  cr2bf_VersionLabel   : %s" % version)
    print("  cr2bf_GeoidVintage   : %s" % vintage)
    print("  cr2bf_TractCount     : %d" % len(geoids))
    print("  cr2bf_FieldCount     : %d" % len(GEOM_PROPERTIES))
    print("  cr2bf_KeyChecksum    : %s" % key_checksum)
    print("  cr2bf_ManifestVersion: %d" % MANIFEST_SCHEMA)
    print("  cr2bf_IsActive       : Yes  (published; uploading retires the previous %s set)" % vintage)
    print("=" * 66)


if __name__ == "__main__":
    main()
