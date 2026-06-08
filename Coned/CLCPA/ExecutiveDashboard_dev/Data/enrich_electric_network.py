"""enrich_electric_network.py — add `electric_network` to each tract in map_payload.json.

For every tract feature, assign the CECONY electric NETWORK (from
Data/Extra_info/CECONY_Electric.shp) it falls in, choosing the network with the
LARGEST intersection area. Areas are computed in the shapefile's native
projected CRS (EPSG:2263, NAD83 / NY Long Island, US ft) — not in 4326 degrees.
Tracts intersecting no network get null. Applies to all tracts (DAC + Non-DAC);
no other field is touched. Idempotent (recomputes + overwrites on each run).

Pipeline order:  0 build_base -> 1 enrich_map_payload -> 2 enrich_neighborhoods
                 -> 3 enrich_electric_network (this script)
Run from ExecutiveDashboard_dev/:  python Data/enrich_electric_network.py
"""
import json, os, collections
import shapefile                       # pyshp
from pyproj import CRS, Transformer
from shapely.geometry import shape
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ELEC = os.path.join(HERE, "Extra_info", "CECONY_Electric")
MAP = os.path.join(ROOT, "map_payload.json")

# ---- electric NETWORK polygons in their native projected CRS (EPSG:2263, ft) ----
elec_crs = CRS.from_wkt(open(ELEC + ".prj", encoding="utf-8").read())
r = shapefile.Reader(ELEC, encoding="utf-8")
names, geoms = [], []
for sr in r.shapeRecords():
    g = shape(sr.shape.__geo_interface__)
    if not g.is_valid:
        g = g.buffer(0)
    names.append(sr.record.as_dict().get("NETWORK"))
    geoms.append(g)
r.close()
tree = STRtree(geoms)

# ---- reproject tract geometry 4326 -> electric CRS (so areas are in ft^2) ----
tf = Transformer.from_crs(CRS.from_epsg(4326), elec_crs, always_xy=True)


def reproj(coords):
    if coords and isinstance(coords[0], (int, float)):
        x, y = tf.transform(coords[0], coords[1])
        return [x, y]
    return [reproj(c) for c in coords]


mp = json.load(open(MAP, encoding="utf-8"))
matched = nulled = 0
match_by_county = collections.Counter()
null_by_county = collections.Counter()
samples = []

for feat in mp["features"]:
    p = feat["properties"]
    geom = {"type": feat["geometry"]["type"], "coordinates": reproj(feat["geometry"]["coordinates"])}
    try:
        tg = shape(geom)
        if not tg.is_valid:
            tg = tg.buffer(0)
    except Exception:
        tg = None

    best, best_area = None, 0.0
    if tg is not None and not tg.is_empty:
        for idx in tree.query(tg):
            eg = geoms[int(idx)]
            if not tg.intersects(eg):
                continue
            a = tg.intersection(eg).area
            if a > best_area:
                best_area, best = a, names[int(idx)]

    p["electric_network"] = best
    cty = p.get("County")
    if best is not None:
        matched += 1; match_by_county[cty] += 1
        if len(samples) < 6:
            samples.append((p.get("GEOID"), cty, best))
    else:
        nulled += 1; null_by_county[cty] += 1

with open(MAP, "w", encoding="utf-8") as f:
    json.dump(mp, f, separators=(",", ":"), ensure_ascii=False)

total = len(mp["features"])
print("electric_network enrichment")
print("  total tracts     :", total)
print("  with network     :", matched)
print("  null (no network):", nulled, "(%.1f%%)" % (100.0 * nulled / total))
print("  matched by county:", dict(match_by_county))
print("  null by county   :", dict(null_by_county))
print("  samples          :", samples)
