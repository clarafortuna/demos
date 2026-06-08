"""enrich_electric_network.py — add `electric_networks` to each tract in map_payload.json.

For every tract feature, list the CECONY electric NETWORKs (from
Data/Extra_info/CECONY_Electric.shp) it overlaps: keep every network whose
intersection is >= 5% of the TRACT's area, ordered by overlap descending
(dominant first). If none reaches 5% but at least one intersects, keep just the
single largest (so a real-but-small assignment isn't dropped). No intersection
-> empty list. Areas are computed in the shapefile's native projected CRS
(EPSG:2263, NAD83 / NY Long Island, US ft), not in 4326 degrees. Applies to all
tracts (DAC + Non-DAC); no other field is touched. Idempotent.

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


MIN_FRAC = 0.05   # keep networks covering >= 5% of the tract's area

mp = json.load(open(MAP, encoding="utf-8"))
dist = collections.Counter()      # 0 / 1 / 2 / "3+"
multi_samples = []

for feat in mp["features"]:
    p = feat["properties"]
    p.pop("electric_network", None)   # drop the old single-value field
    geom = {"type": feat["geometry"]["type"], "coordinates": reproj(feat["geometry"]["coordinates"])}
    try:
        tg = shape(geom)
        if not tg.is_valid:
            tg = tg.buffer(0)
    except Exception:
        tg = None

    hits = []   # (area, name)
    if tg is not None and not tg.is_empty:
        tract_area = tg.area
        for idx in tree.query(tg):
            eg = geoms[int(idx)]
            if not tg.intersects(eg):
                continue
            a = tg.intersection(eg).area
            if a > 0:
                hits.append((a, names[int(idx)]))
        hits.sort(key=lambda t: t[0], reverse=True)            # dominant first
        thr = MIN_FRAC * tract_area if tract_area > 0 else 0.0
        kept = [name for a, name in hits if a >= thr]
        if not kept and hits:                                  # all small -> keep the single largest
            kept = [hits[0][1]]
    else:
        kept = []

    p["electric_networks"] = kept
    n = len(kept)
    dist[n if n < 3 else "3+"] += 1
    if n >= 2 and len(multi_samples) < 6:
        multi_samples.append((p.get("GEOID"), p.get("County"), kept))

with open(MAP, "w", encoding="utf-8") as f:
    json.dump(mp, f, separators=(",", ":"), ensure_ascii=False)

total = len(mp["features"])
print("electric_networks enrichment (>=%.0f%% of tract area; single-largest fallback)" % (MIN_FRAC * 100))
print("  total tracts :", total)
print("  0 (null/empty):", dist[0], "(%.1f%%)" % (100.0 * dist[0] / total))
print("  1 network    :", dist[1])
print("  2 networks   :", dist[2])
print("  3+ networks  :", dist["3+"])
print("  multi samples:", multi_samples)
