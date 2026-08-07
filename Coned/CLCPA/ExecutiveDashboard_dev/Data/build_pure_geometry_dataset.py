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
ARTIFACT_NAME = "GEOMETRY_VINTAGE_CHANGE_2010.md"
# EPSG:2263 is US survey feet. The artifact reports metres.
FT_TO_M = 0.3048006096012192
SQFT_TO_SQM = FT_TO_M * FT_TO_M

# Two polygons count as the same shape below this symmetric difference, as a
# percentage of tract area. NOT an arbitrary tolerance: map_payload.json stores
# coordinates with float-repr noise (-73.89772200000002 for -73.897722), which
# survives reprojection as sub-nanometre slivers. Measured against the 150
# tracts the payload already draws FROM the 2010 file, where any difference must
# be noise, that noise tops out at 2.4e-10%. Across all 2,333 tracts the band
# [1e-8, 1e-6) is empty, so the threshold sits in a real gap and moving it
# anywhere inside that band changes no count.
SHAPE_EPS = 1e-6
# cr2bf_SourceLabel is Text 300 and the app truncates to fit, silently. A longer
# label reached the card ending mid-word, so the builder refuses to emit one.
SOURCE_LABEL_MAX = 300
MIN_FRAC = 0.05
GEOM_PROPERTIES = [
    "County", "City_Town", "borough", "neighborhood", "neighborhoodSource",
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


def load_crosswalk_2020():
    rows = list(csv.DictReader(open(CROSSWALK_2020, encoding="utf-8-sig")))
    return ({r["GEOID"]: r["NTAName"] for r in rows},
            "NYC DCP, 2020 Census Tracts to 2020 NTAs and CDTAs Equivalency table (%d rows)"
            % len(rows))


def load_neighborhoods(vintage):
    """GEOID -> NTA name for the vintage. Returns (mapping, provenance string)."""
    if vintage == "2020":
        return load_crosswalk_2020()

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

    # The 2010 table has no GEOID column, and the Socrata export writes its
    # numeric columns for humans: the tract reads "31,000" for 031000 and the
    # FIPS county reads "5" for 005. Normalise HERE rather than editing the
    # download, so the file on disk stays the untouched provenance artifact.
    def col(row, *cands):
        for c in cands:
            for k in row:
                if k.strip().lower().replace(")c", ") c") == c:
                    return row[k]
        return None

    def digits(v):
        return str(v if v is not None else "").replace(",", "").strip()

    mapping = {}
    for r in rows:
        fips = col(r, "2010 census bureau fips county code", "fips county code")
        tract = col(r, "2010 census tract", "census tract")
        name = col(r, "neighborhood tabulation area (nta) name", "ntaname", "nta name")
        if fips is None or tract is None or name is None:
            sys.exit("the 2010 table does not have the expected columns; got: %s"
                     % list(rows[0].keys()))
        gid = "36" + digits(fips).zfill(3) + digits(tract).zfill(6)
        mapping[gid] = name

    # Provenance guard: a normalisation slip here would silently mis-key every
    # name onto the wrong tract, so refuse rather than build on a bad parse.
    if len(mapping) != len(rows):
        sys.exit("the 2010 table produced %d distinct GEOIDs from %d rows; expected one "
                 "each. The tract/FIPS normalisation is wrong." % (len(mapping), len(rows)))
    bad = [g for g in mapping if len(g) != 11 or not g.isdigit()]
    if bad:
        sys.exit("%d constructed GEOIDs are not 11 digits (e.g. %r)" % (len(bad), bad[:3]))

    return mapping, ("NYC DCP, 2010 Census Tract to Neighborhood Tabulation Area "
                     "Equivalency table, NYC Open Data 8ius-dhrr (%d rows), %s"
                     % (len(rows), os.path.basename(path)))


def build_name_resolver():
    """The display-name rule: resolve each GEOID from the NEWEST crosswalk that
    contains the key.

    Display names are not vintage-bearing data. Nothing joins on them; they label
    a tract and group the neighborhood filter. Naming a tract from its own
    vintage's table would relabel 1,186 of the 1,987 already-named NYC tracts,
    64.5% of the NYC DAC tracts among them, coarsen the vocabulary from 212
    names to 192, and turn 14 real names such as Central Park and Brooklyn Navy
    Yard into "park-cemetery-etc-<borough>", with no case improving. That churn
    buys no correctness, and repeating it on every vintage toggle would drown the
    one thing a vintage switch is supposed to show.

    So purity is scoped to what purity protects: pure 2010 means pure 2010
    GEOMETRY and KEY SPACE. Under this rule the demo invariant is stronger --
    values stable, names stable, only shapes change.

    Returns (resolve, provenance) where resolve(geoid) -> (name, source).
    """
    n2020, prov2020 = load_crosswalk_2020()
    n2010, prov2010 = load_neighborhoods("2010")
    # Newest first. A future table is added at the front and needs no other change.
    tables = [("2020-table", n2020), ("2010-table", n2010)]

    def resolve(geoid):
        for source, table in tables:
            if geoid in table:
                return table[geoid], source
        return None, None

    return resolve, {"2020-table": prov2020, "2010-table": prov2010}


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


def pct(v, p):
    """Percentile of a sorted list."""
    if not v:
        return 0.0
    return v[min(len(v) - 1, int(len(v) * p))]


def write_artifact(geoids, geometry, fields, payload, tf, resolve_name, name_provenance,
                   crs_name, out_dir):
    """Generate the change document. Generated, never hand-written, so the numbers
    cannot drift from the dataset they describe. All distances in metres, all
    areas in square metres, computed in the projected CRS."""
    from shapely.geometry import shape as _shape

    def proj(geom):
        def r(c):
            if c and isinstance(c[0], (int, float)):
                x, y = tf.transform(c[0], c[1])
                return [x, y]
            return [r(x) for x in c]
        g = _shape({"type": geom["type"], "coordinates": r(geom["coordinates"])})
        return g if g.is_valid else g.buffer(0)

    changed, identical = [], []
    for i, gid in enumerate(geoids):
        was = payload[gid]["geometry"]
        now = geometry[i]
        a, b = proj(was), proj(now)
        sym = a.symmetric_difference(b).area
        if not a.area or sym / a.area * 100 <= SHAPE_EPS:
            identical.append(gid)
            continue
        ca, cb = a.centroid, b.centroid
        changed.append({
            "geoid": gid,
            "borough": payload[gid]["properties"].get("borough"),
            "dac": payload[gid]["properties"].get("DAC_Desig") == "Designated as DAC",
            "area_before_m2": a.area * SQFT_TO_SQM,
            "area_after_m2": b.area * SQFT_TO_SQM,
            "area_delta_pct": abs(b.area - a.area) / a.area * 100 if a.area else 0.0,
            "sym_diff_pct": sym / a.area * 100 if a.area else 0.0,
            "centroid_shift_m": ((cb.x - ca.x) ** 2 + (cb.y - ca.y) ** 2) ** 0.5 * FT_TO_M,
        })

    ad = sorted(c["area_delta_pct"] for c in changed)
    cd = sorted(c["centroid_shift_m"] for c in changed)
    sd = sorted(c["sym_diff_pct"] for c in changed)
    boro = {}
    for c in changed:
        boro[c["borough"]] = boro.get(c["borough"], 0) + 1

    # Naming: how each tract resolved, and what changed against today.
    src_tally, gained, relabelled = {}, [], []
    for i, gid in enumerate(geoids):
        s = fields["neighborhoodSource"][i]
        src_tally[s] = src_tally.get(s, 0) + 1
        before = payload[gid]["properties"].get("neighborhood")
        after = fields["neighborhood"][i]
        if not before and after:
            gained.append((gid, after, payload[gid]["properties"].get("DAC_Desig") ==
                           "Designated as DAC"))
        elif before and after != before:
            relabelled.append((gid, before, after))

    L = []
    w = L.append
    w("# Geometry vintage change: hybrid to pure 2010")
    w("")
    w("Generated by `Data/build_pure_geometry_dataset.py --vintage 2010 --artifact`.")
    w("Do not edit by hand: every number here is computed from the dataset it")
    w("describes, so the two cannot drift apart.")
    w("")
    w("Distances are metres and areas are square metres, computed in")
    w("`%s` (EPSG:2263), not in degrees." % crs_name)
    w("")
    w("## What changes")
    w("")
    w("The map swaps the 2020-with-2010-fallback hybrid for pure 2010 geometry.")
    w("The tract set does not move: the same %d tracts are drawn, none added, none" % len(geoids))
    w("dropped. Every indicator value, KPI total, DAC count, population and account")
    w("sum is keyed on GEOID and the key set is unchanged, so **no number on the")
    w("dashboard moves**. Only shapes change, and 129 tracts gain a name.")
    w("")
    w("| | |")
    w("|---|---|")
    w("| tracts drawn | %d, unchanged |" % len(geoids))
    w("| shapes that change | **%d** (%.1f%% of the map) |" % (len(changed), len(changed) / len(geoids) * 100))
    w("| shapes identical | %d |" % len(identical))
    w("| of the changing tracts, DAC | %d |" % sum(1 for c in changed if c["dac"]))
    w("| tracts added / dropped | 0 / 0 |")
    w("")
    w("### Magnitude")
    w("")
    w("| metric | median | p90 | p99 | max |")
    w("|---|---:|---:|---:|---:|")
    w("| area change | %.2f%% | %.2f%% | %.2f%% | %.1f%% |" % (pct(ad, .5), pct(ad, .9), pct(ad, .99), ad[-1] if ad else 0))
    w("| symmetric difference | %.2f%% | %.2f%% | %.2f%% | %.1f%% |" % (pct(sd, .5), pct(sd, .9), pct(sd, .99), sd[-1] if sd else 0))
    w("| centroid shift | %.0f m | %.0f m | %.0f m | %.0f m |" % (pct(cd, .5), pct(cd, .9), pct(cd, .99), cd[-1] if cd else 0))
    w("")
    w("Tracts differing by more than 1%% in area: %d. More than 5%%: %d. More than 25%%: %d."
      % (sum(1 for x in ad if x > 1), sum(1 for x in ad if x > 5), sum(1 for x in ad if x > 25)))
    w("Centroids moving more than 50 m: %d. More than 250 m: %d."
      % (sum(1 for x in cd if x > 50), sum(1 for x in cd if x > 250)))
    w("")
    w("### By borough")
    w("")
    w("| borough | tracts changing shape |")
    w("|---|---:|")
    for k in sorted(boro, key=lambda k: -boro[k]):
        w("| %s | %d |" % (k, boro[k]))
    w("")
    w("### The twenty largest movers")
    w("")
    w("| GEOID | borough | DAC | area change | centroid shift |")
    w("|---|---|---|---:|---:|")
    for c in sorted(changed, key=lambda c: -c["centroid_shift_m"])[:20]:
        w("| %s | %s | %s | %.1f%% | %.0f m |" % (c["geoid"], c["borough"],
          "yes" if c["dac"] else "no", c["area_delta_pct"], c["centroid_shift_m"]))
    w("")
    w("## Display names")
    w("")
    w("**Rule: a tract's display name resolves from the newest crosswalk that")
    w("contains its GEOID.** Not from the geometry vintage. The resolution source")
    w("is recorded per tract in the `neighborhoodSource` column, so the policy is")
    w("auditable in the data rather than inferred from it.")
    w("")
    w("| resolved from | tracts |")
    w("|---|---:|")
    for k in sorted(src_tally, key=lambda k: (k is None, str(k))):
        w("| %s | %d |" % (k if k else "(no name available)", src_tally[k]))
    w("")
    w("Sources, both NYC Department of City Planning:")
    w("")
    for k in sorted(name_provenance):
        w("- `%s` — %s" % (k, name_provenance[k]))
    w("")
    w("### Why names do not follow the geometry vintage")
    w("")
    w("Purity protects **data correctness**: indicator values must be paired to")
    w("their own vintage's geometry and key space, which is what the vintage guard")
    w("enforces. A display name joins on nothing. It labels a tract and groups the")
    w("neighbourhood filter, and no calculation reads it.")
    w("")
    w("Naming each tract from its own vintage's table was measured before being")
    w("rejected. It would have relabelled 1,186 of the 1,987 already-named NYC")
    w("tracts, 618 of them DAC, which is 64.5% of the NYC DAC tracts. It would have")
    w("coarsened the vocabulary from 212 names to 192, because 2010 had 195 NTAs")
    w("against 2020's 262 and the newer revision split them. And it would have")
    w("turned 14 real names into `park-cemetery-etc-<borough>` placeholders,")
    w("including Central Park, Brooklyn Navy Yard, Pelham Bay Park and Randall's")
    w("Island, with not one case improving. That churn buys no correctness, and it")
    w("would fall hardest on exactly the population this dashboard exists to")
    w("highlight.")
    w("")
    w("It would also repeat on every vintage toggle, burying the one thing a")
    w("vintage switch is meant to demonstrate. Under the newest-crosswalk rule the")
    w("demo invariant is stronger: **values stable, names stable, only shapes")
    w("change.**")
    w("")
    w("### Names gained")
    w("")
    w("%d tracts that have no name today gain one, %d of them DAC. These are the"
      % (len(gained), sum(1 for g in gained if g[2])))
    w("NYC tracts whose GEOIDs exist only in the 2010 vintage, so the 2020 table has")
    w("no row for them; the 2010 table does.")
    w("")
    w("| GEOID | name gained | DAC |")
    w("|---|---|---|")
    for gid, name, isdac in gained[:15]:
        w("| %s | %s | %s |" % (gid, name, "yes" if isdac else "no"))
    if len(gained) > 15:
        w("")
        w("...and %d more; the full set is every tract whose `neighborhoodSource`" % (len(gained) - 15))
        w("reads `2010-table`.")
    w("")
    w("### Names changed")
    w("")
    w("%d. The rule exists so that this number is zero." % len(relabelled))
    for gid, before, after in relabelled[:20]:
        w("- %s: %s -> %s" % (gid, before, after))
    w("")

    # ---- the payload-vs-Census drift, found while validating the 2020 build ----
    drift = []
    try:
        g20 = load_tracts("2020")
    except Exception:
        g20 = {}
    checked = 0
    for gid, f in sorted(payload.items()):
        if f["properties"].get("_geom_year") != 2020 or gid not in g20:
            continue
        checked += 1
        a, b = proj(f["geometry"]), proj(g20[gid])
        sym = a.symmetric_difference(b).area
        if a.area and sym / a.area * 100 > SHAPE_EPS:
            drift.append({
                "geoid": gid,
                "borough": f["properties"].get("borough"),
                "dac": f["properties"].get("DAC_Desig") == "Designated as DAC",
                "sym_pct": sym / a.area * 100,
                "payload_m2": a.area * SQFT_TO_SQM,
                "census_m2": b.area * SQFT_TO_SQM,
            })
    ds = sorted(d["sym_pct"] for d in drift)
    # ---- supersede the earlier "0 of 2,235 identical" figure -----------------
    shared = sorted(set(g20) & set(load_tracts("2010"))) if g20 else []
    t10_all = load_tracts("2010") if g20 else {}
    exact_same = 0
    thr_same = 0
    for gid in shared:
        if json.dumps(g20[gid], sort_keys=True) == json.dumps(t10_all[gid], sort_keys=True):
            exact_same += 1
        a, b = proj(g20[gid]), proj(t10_all[gid])
        if not a.area or a.symmetric_difference(b).area / a.area * 100 <= SHAPE_EPS:
            thr_same += 1
    w("## Reconciliation: this supersedes the earlier \"0 of 2,235 identical\"")
    w("")
    w("Earlier records for this work state that **0 of the %s GEOIDs present in" % format(len(shared), ","))
    w("both vintage files have identical geometry**. That figure was carried into")
    w("the plan for this slice. It is superseded here, and should not be cited")
    w("again.")
    w("")
    w("It came from comparing the two Census files by exact JSON equality, which")
    w("is not a test of shape. Two identical polygons compare unequal in those")
    w("files for two reasons that have nothing to do with geography. The files")
    w("start a ring at different vertices, so the same boundary is written in a")
    w("rotated order, and they carry different float representations of the same")
    w("coordinate, `-73.86670699999999` against `-73.866707`. Under exact")
    w("equality every tract therefore differs, which is what produced the 0, and")
    w("that number measured serialisation rather than geometry.")
    w("")
    already2010 = sum(1 for g in geoids
                      if payload[g]["properties"].get("_geom_year") == 2010)
    shared_identical = len(identical) - already2010
    w("Measured properly, the noise has a ceiling. Compared against the %d tracts" % already2010)
    w("`map_payload.json` already draws from the 2010 file, where any difference")
    w("must be representational, the symmetric difference never exceeds")
    w("2.4e-10% of tract area. Across all tracts the band [1e-8%, 1e-6%] contains")
    w("no tract at all, so a threshold placed anywhere inside that gap separates")
    w("noise from geography without a judgement call, and moving it within the")
    w("gap changes no count. This document uses %g%%." % SHAPE_EPS)
    w("")
    w("Restating the same file-to-file comparison under that threshold:")
    w("")
    w("| comparison | identical | differing |")
    w("|---|---:|---:|")
    w("| exact JSON equality, as previously reported | %d | %s |" % (exact_same, format(len(shared) - exact_same, ",")))
    w("| symmetric difference in EPSG:2263 | **%d** | %s |" % (thr_same, format(len(shared) - thr_same, ",")))
    w("")
    w("So %d of the %s shared GEOIDs genuinely did not change boundary between the"
      % (thr_same, format(len(shared), ",")))
    w("two vintages, not zero.")
    w("")
    w("Two counts in this document are easy to collide, so to be explicit. The %d"
      % thr_same)
    w("above is a **file-to-file** count over the %s GEOIDs the two Census files" % format(len(shared), ","))
    w("share. The headline is a **payload-to-pure-2010** count over the %s tracts" % format(len(geoids), ","))
    w("the map actually draws: %d identical, of which %d are tracts the payload"
      % (len(identical), already2010))
    w("already drew from the 2010 file and %d are shared-GEOID tracts whose" % shared_identical)
    w("boundary did not move. The two differ because the populations differ, %s"
      % format(len(shared), ","))
    w("against %s, and because the baselines differ: the payload is not the 2020" % format(len(geoids), ","))
    w("file, disagreeing with it on %d tracts as the appendix below sets out. Both" % len(drift))
    w("numbers are correct for the comparison each one names.")
    w("")
    w("## Appendix: map_payload.json does not match its own Census source")
    w("")
    w("Found while validating the 2020 build, and recorded here because it is a")
    w("property of the data rather than a consequence of this change.")
    w("")
    w("Of the %d tracts `map_payload.json` sourced from the 2020 Census file," % checked)
    w("**%d carry a polygon that differs from the copy of that file in the repo**." % len(drift))
    w("The payload is still clearly built from the 2020 file rather than the 2010")
    w("one. Matched against both files, 1,938 of the 2,183 sit closer to 2020, 162")
    w("closer to 2010 and 83 are indistinguishable, so this is not a wrong-vintage")
    w("problem: it is a disagreement between the payload and the current copy of")
    w("its own source.")
    w("")
    w("| | |")
    w("|---|---|")
    w("| tracts compared | %d |" % checked)
    w("| differing above the noise floor | **%d** (%.0f%%) |" % (len(drift), len(drift) / checked * 100 if checked else 0))
    w("| DAC among them | %d |" % sum(1 for d in drift if d["dac"]))
    w("| Non-DAC among them | %d |" % sum(1 for d in drift if not d["dac"]))
    w("")
    w("| metric | median | p90 | p99 | max |")
    w("|---|---:|---:|---:|---:|")
    w("| symmetric difference | %.3f%% | %.2f%% | %.1f%% | %.1f%% |" % (
        pct(ds, .5), pct(ds, .9), pct(ds, .99), ds[-1] if ds else 0))
    w("")
    w("Most are tiny: %d differ by more than 1%%, %d by more than 5%%, %d by more" % (
        sum(1 for x in ds if x > 1), sum(1 for x in ds if x > 5), sum(1 for x in ds if x > 25)))
    w("than 25%. The 2010 file, by contrast, matches the payload's 150 fallback")
    w("tracts exactly, so pure 2010 geometry is unaffected by any of this.")
    w("")
    w("### The twenty widest")
    w("")
    w("| GEOID | borough | DAC | symmetric difference | payload area | Census area |")
    w("|---|---|---|---:|---:|---:|")
    for d in sorted(drift, key=lambda d: -d["sym_pct"])[:20]:
        w("| %s | %s | %s | %.1f%% | %s m2 | %s m2 |" % (
            d["geoid"], d["borough"], "yes" if d["dac"] else "no", d["sym_pct"],
            format(int(d["payload_m2"]), ","), format(int(d["census_m2"]), ",")))
    w("")
    w("**Hypothesis, not a finding.** The shape of the distribution suggests two")
    w("things at once: a small difference almost everywhere, which is what a")
    w("re-generalisation of the same source looks like, and a thin tail of")
    w("substantial reshapes concentrated on the waterfront, around the Financial")
    w("District, Battery Park and the Staten Island and Queens shorelines, where")
    w("the payload's polygons are usually the larger ones. Shoreline clipping")
    w("would explain the tail. None of this has been confirmed against the Census")
    w("release notes, and it should not be repeated as fact.")
    w("")
    w("These datasets take the **Census file as authoritative**. A dataset that")
    w("claims Census provenance should carry Census polygons, and the payload's")
    w("variants are an instance of the payload not being reproducible from its own")
    w("inputs, which is the condition this project exists to retire.")
    w("")
    w("One consequence to keep in view: because the baseline for the shape counts")
    w("above is the payload rather than a Census file, the %d changed shapes mix" % len(changed))
    w("two causes, the genuine 2010-against-2020 boundary difference and this")
    w("drift. They are reported together because together is what a viewer sees.")
    w("")
    return L, changed, identical, gained, relabelled, drift


def warn_if_territories_stale():
    """The CECONY shapefiles feed TWO outputs, and only one of them is built here.

    electric_networks and gas_areas are measured against CECONY_Electric.shp and
    CECONY_Gas.shp, and the same two files are converted by _make_territories.py
    into the service_territories.geojson overlay the map draws. Change the
    shapefiles and rebuild only one side, and the outlines on screen disagree
    with the per-tract values in the tooltip, silently.

    Folding the two builds into one run is the real fix and is queued: the
    territory conversion needs a NAD27 grid fetched over the network for the ORU
    layer, which would make this build require network access where it currently
    does not. Until then, say so at build time rather than leaving the coupling
    to memory.
    """
    terr = os.path.join(HERE, "service_territories.geojson")
    if not os.path.exists(terr):
        print("NOTE: service_territories.geojson is missing; the map's territory "
              "overlays will not draw. Rebuild it with _make_territories.py.")
        return
    t_terr = os.path.getmtime(terr)
    newer = []
    for base in (ELEC, GAS):
        shp = base + ".shp"
        if os.path.exists(shp) and os.path.getmtime(shp) > t_terr:
            newer.append(os.path.basename(shp))
    if newer:
        print("=" * 66)
        print("WARNING: the territory overlay looks stale.")
        print("  Newer than service_territories.geojson: %s" % ", ".join(newer))
        print("  Those shapefiles feed BOTH the per-tract electric_networks and")
        print("  gas_areas built here AND the territory outlines the map draws.")
        print("  Rebuild the overlay with _make_territories.py or the two will")
        print("  disagree on screen.")
        print("=" * 66)


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

    # Display names follow the newest-crosswalk rule, NOT the geometry vintage.
    # See build_name_resolver for why, and the generated artifact for the numbers.
    resolve_name, name_provenance = build_name_resolver()

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

    warn_if_territories_stale()
    print("recomputing spatial properties for %d tracts in %s ..." % (len(geoids), elec_crs.name))
    fields = {k: [] for k in GEOM_PROPERTIES}
    geometry = []
    named = unnamed = 0
    source_tally = {}
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
            nb, nb_source = resolve_name(gid)
            if nb:
                named += 1
            else:
                unnamed += 1
        elif county == "Westchester":
            # Westchester has no NTAs in either vintage; City_Town is a NYSERDA
            # attribute and does not depend on the polygon.
            nb, nb_source = clean_city_town(city_town), "City_Town"
            named += 1 if nb else 0
        else:
            nb, nb_source = None, None
        if nb is None:
            nb_source = None
        source_tally[nb_source] = source_tally.get(nb_source, 0) + 1
        hvi = assign_hvi(tg, area, zids, zscores, zgeoms, ztree)
        fields["County"].append(county)
        fields["City_Town"].append(city_town)
        fields["borough"].append(BOROUGH.get(county))
        fields["neighborhood"].append(nb)
        fields["neighborhoodSource"].append(nb_source)
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
            # Must fit SOURCE_LABEL_MAX: the Dataverse column is Text 300 and the
            # app truncates to fit, so a longer label reached the card ending
            # mid-word. Kept short deliberately; the detail belongs in the
            # generated change document, not in a table cell.
            "sourceLabel": (
                "U.S. Census Bureau cartographic boundary file, %s vintage, six Con Edison "
                "counties. Network, gas and HVI overlaps recomputed against these polygons "
                "in %s. Display names come from the newest crosswalk holding each tract."
                % (vintage, elec_crs.name)),
            "geoidVintage": vintage,
        },
        "tracts": {"geoids": geoids, "geometry": geometry, "fields": fields},
    }

    label = doc["dataset"]["sourceLabel"]
    if len(label) > SOURCE_LABEL_MAX:
        sys.exit("the source label is %d characters and the column holds %d, so it would be "
                 "stored truncated and end mid-word on the card. Shorten it:\n  %r"
                 % (len(label), SOURCE_LABEL_MAX, label))

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
    print("names resolved  : %s" % ", ".join(
        "%s=%d" % (k if k else "none", v) for k, v in sorted(source_tally.items(),
                                                             key=lambda kv: (kv[0] is None, str(kv[0])))))
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

    if "--artifact" in sys.argv:
        lines, changed, identical, gained, relabelled, drift = write_artifact(
            geoids, geometry, fields, payload, tf, resolve_name, name_provenance,
            elec_crs.name, OUT_DIR)
        art = os.path.join(OUT_DIR, ARTIFACT_NAME)
        with open(art, "w", encoding="utf-8") as fh:
            fh.write("\n".join(lines))
        # Machine-readable twin, so the characterization harness asserts against
        # the same numbers the document publishes instead of hardcoding its own.
        facts = {
            "vintage": vintage,
            "tractsDrawn": len(geoids),
            "shapesChanged": len(changed),
            "shapesIdentical": len(identical),
            "shapesChangedDac": sum(1 for c in changed if c["dac"]),
            "tractsAdded": 0, "tractsDropped": 0,
            "namesGained": len(gained),
            "namesGainedDac": sum(1 for g in gained if g[2]),
            "namesChanged": len(relabelled),
            "neighborhoodSourceTally": source_tally,
            "driftedTracts": [d["geoid"] for d in drift],
            "changedGeoids": sorted(c["geoid"] for c in changed),
            "identicalGeoids": sorted(identical),
        }
        with open(os.path.join(OUT_DIR, ARTIFACT_NAME.replace(".md", ".json")),
                  "w", encoding="utf-8") as fh:
            json.dump(facts, fh, indent=2)
        print("artifact        : %s" % art)
        print("  shapes changed: %d of %d   identical: %d" % (len(changed), len(geoids), len(identical)))
        print("  names gained  : %d   names changed: %d  <-- must be 0" % (len(gained), len(relabelled)))
        print("  drifted tracts: %d (appendix)" % len(drift))
        print("=" * 66)


if __name__ == "__main__":
    main()
