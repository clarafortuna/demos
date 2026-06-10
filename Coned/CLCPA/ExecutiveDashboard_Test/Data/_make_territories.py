"""One-off: convert the Extra_info ConEd/ORU service-territory shapefiles to one
WGS84 GeoJSON (Data/service_territories.geojson) for the DAC map overlay.

- Electric networks + Gas service area + ORU territory.
- Reprojects each shapefile from its .prj CRS to EPSG:4326 with a PROPER datum
  transform (electric/gas are NAD83; ORU is NAD27, so a real NAD27->WGS84
  transform is required, not a naive ellipsoid swap). PROJ network is enabled
  and ballpark transforms are rejected so a grid-based transform is used.
- Optional Douglas-Peucker simplification (TOL_FT; 0 = full resolution).
Not committed itself; the .geojson output is the deliverable."""
import json, math, os
import shapefile            # pyshp
import pyproj
from pyproj import CRS, Transformer

pyproj.network.set_network_enabled(True)   # allow PROJ to fetch NADCON grid for NAD27

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "Extra_info")
OUT = os.path.join(HERE, "service_territories.geojson")
# Simplification disabled for now (lazy-load covers the page-load cost). Set a
# positive value (e.g. 50.0 ≈ 15 m, source units = US ft) to re-enable.
TOL_FT = 0.0

# (basename, layer tag, name field, extra fields kept)
LAYERS = [
    ("CECONY_Electric", "electric", "NETWORK",  ["BOROUGH", "COUNTY", "ABREVIATIO", "CODE"]),
    ("CECONY_Gas",      "gas",      "BORONAME", ["BOROCODE"]),
    ("ORU_Territory",   "oru",      "STATE",    []),
]


def transformer_for(basename):
    with open(os.path.join(SRC, basename + ".prj"), encoding="utf-8") as f:
        src = CRS.from_wkt(f.read())
    dst = CRS.from_epsg(4326)
    try:
        tf = Transformer.from_crs(src, dst, always_xy=True, allow_ballpark=False)
        ballpark = ""
    except Exception:
        tf = Transformer.from_crs(src, dst, always_xy=True)
        ballpark = "  (WARNING: ballpark / approximate datum transform)"
    print("  %-16s %s%s" % (basename, tf.description, ballpark))
    return tf


def dp(pts, tol):
    if len(pts) <= 2:
        return pts[:]
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        ax, ay = pts[i]; bx, by = pts[j]
        dx, dy = bx - ax, by - ay
        d2 = dx * dx + dy * dy
        idx, maxd = -1, tol
        for k in range(i + 1, j):
            px, py = pts[k]
            if d2 == 0:
                dist = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / d2))
                dist = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if dist > maxd:
                maxd, idx = dist, k
        if idx != -1:
            keep[idx] = True
            stack.append((i, idx)); stack.append((idx, j))
    return [pts[k] for k in range(len(pts)) if keep[k]]


def simplify_ring(ring, tol):
    s = dp(ring, tol)
    if len(s) < 4:
        return ring
    if s[0] != s[-1]:
        s.append(s[0])
    return s


def simplify_coords(geom_type, coords, tol):
    if not tol:
        return coords
    if geom_type == "Polygon":
        return [simplify_ring([list(p) for p in ring], tol) for ring in coords]
    if geom_type == "MultiPolygon":
        return [[simplify_ring([list(p) for p in ring], tol) for ring in poly] for poly in coords]
    return coords


def reproject(coords, tf):
    if coords and isinstance(coords[0], (int, float)):
        lon, lat = tf.transform(coords[0], coords[1])
        return [round(lon, 6), round(lat, 6)]
    return [reproject(c, tf) for c in coords]


def allcoords(c):
    if c and isinstance(c[0], (int, float)):
        yield c
    else:
        for x in c:
            yield from allcoords(x)


print("reprojection transforms:")
features, report = [], []
for basename, layer, name_field, extra in LAYERS:
    tf = transformer_for(basename)
    r = shapefile.Reader(os.path.join(SRC, basename), encoding="utf-8")
    n = 0
    xs, ys = [], []
    for sr in r.shapeRecords():
        gi = sr.shape.__geo_interface__
        simp = simplify_coords(gi["type"], gi["coordinates"], TOL_FT)
        geom = {"type": gi["type"], "coordinates": reproject(simp, tf)}
        rec = sr.record.as_dict()
        props = {"layer": layer, "name": rec.get(name_field)}
        for k in extra:
            props[k] = rec.get(k)
        features.append({"type": "Feature", "properties": props, "geometry": geom})
        for lon, lat in allcoords(geom["coordinates"]):
            xs.append(lon); ys.append(lat)
        n += 1
    r.close()
    report.append((basename, layer, n, (min(xs), min(ys), max(xs), max(ys))))

with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection", "features": features},
              f, separators=(",", ":"), ensure_ascii=False)

print("\nlayers:")
for b, l, n, bb in report:
    print("  %-16s layer=%-8s features=%d  bbox lon[%.4f, %.4f] lat[%.4f, %.4f]"
          % (b, l, n, bb[0], bb[2], bb[1], bb[3]))
sz = os.path.getsize(OUT)
print("\ntotal features:", len(features))
print("output: %s (%d bytes, %.2f MB)" % (OUT, sz, sz / 1e6))
