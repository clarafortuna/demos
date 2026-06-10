"""enrich_electric_network.py — add `electric_networks` and `gas_areas` to each
tract in map_payload.json.

For every tract feature, list the ConEd service areas it overlaps:
  - electric_networks: CECONY electric NETWORKs (Data/Extra_info/CECONY_Electric.shp)
  - gas_areas:         CECONY gas borough areas (Data/Extra_info/CECONY_Gas.shp, BORONAME)

For each layer, keep every polygon whose intersection is >= 5% of the TRACT's
area, ordered by overlap descending (dominant first). If none reaches 5% but at
least one intersects, keep just the single largest. No intersection -> empty
list (correctly leaves e.g. Brooklyn/Staten Island gas blank). Areas are
computed in the shapefiles' native projected CRS (EPSG:2263, NAD83 / NY Long
Island, US ft), not in 4326 degrees. Applies to all tracts (DAC + Non-DAC);
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
GAS = os.path.join(HERE, "Extra_info", "CECONY_Gas")
MAP = os.path.join(ROOT, "map_payload.json")
MIN_FRAC = 0.05   # keep areas covering >= 5% of the tract's area


def load_layer(path, name_field):
    """Return (names, geoms, STRtree) in the shapefile's native CRS, plus its CRS."""
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


elec_names, elec_geoms, elec_tree, elec_crs = load_layer(ELEC, "NETWORK")
gas_names, gas_geoms, gas_tree, gas_crs = load_layer(GAS, "BORONAME")
# electric and gas share the CRS (NAD83 NY Long Island ftUS); reproject tracts once.
tf = Transformer.from_crs(CRS.from_epsg(4326), elec_crs, always_xy=True)


def reproj(coords):
    if coords and isinstance(coords[0], (int, float)):
        x, y = tf.transform(coords[0], coords[1])
        return [x, y]
    return [reproj(c) for c in coords]


def assign(tg, tract_area, names, geoms, tree):
    """Names whose intersection >= 5% of the tract area, dominant first;
    single-largest fallback; [] if no intersection."""
    hits = []
    for idx in tree.query(tg):
        g = geoms[int(idx)]
        if not tg.intersects(g):
            continue
        a = tg.intersection(g).area
        if a > 0:
            hits.append((a, names[int(idx)]))
    hits.sort(key=lambda t: t[0], reverse=True)
    thr = MIN_FRAC * tract_area if tract_area > 0 else 0.0
    kept = [n for a, n in hits if a >= thr]
    if not kept and hits:
        kept = [hits[0][1]]
    return kept


mp = json.load(open(MAP, encoding="utf-8"))
elec_dist = collections.Counter()
gas_dist = collections.Counter()
gas_multi = []

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

    if tg is not None and not tg.is_empty:
        ta = tg.area
        elec = assign(tg, ta, elec_names, elec_geoms, elec_tree)
        gas = assign(tg, ta, gas_names, gas_geoms, gas_tree)
    else:
        elec, gas = [], []

    p["electric_networks"] = elec
    p["gas_areas"] = gas
    elec_dist[len(elec) if len(elec) < 3 else "3+"] += 1
    gas_dist[len(gas) if len(gas) < 3 else "3+"] += 1
    if len(gas) >= 2 and len(gas_multi) < 6:
        gas_multi.append((p.get("GEOID"), p.get("County"), gas))

with open(MAP, "w", encoding="utf-8") as f:
    json.dump(mp, f, separators=(",", ":"), ensure_ascii=False)

total = len(mp["features"])
gas_present = sum(1 for fe in mp["features"] if fe["properties"]["gas_areas"])


def show(title, d):
    print("  %-16s 0:%d  1:%d  2:%d  3+:%d" % (title, d[0], d[1], d[2], d["3+"]))


print("enrichment over %d tracts (>=%.0f%% of tract area; single-largest fallback)" % (total, MIN_FRAC * 100))
show("electric_networks", elec_dist)
show("gas_areas", gas_dist)
print("  gas: %d tracts with an area, %d null (%.1f%%)"
      % (gas_present, total - gas_present, 100.0 * (total - gas_present) / total))
print("  gas multi samples:", gas_multi)
gas_by_county = collections.Counter(fe["properties"]["County"] for fe in mp["features"] if fe["properties"]["gas_areas"])
print("  gas by county:", dict(gas_by_county))
