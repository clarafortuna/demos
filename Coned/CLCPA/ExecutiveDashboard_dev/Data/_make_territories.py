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
# Layout-agnostic paths. In the repository this script lives in Data/; in the Con
# Edison handoff package it sits at the package root with Data/ beside it. DATA is
# the same folder in both layouts, so one copy of the script serves both and the
# clean-room proof exercises the very file the repository holds.
DATA = HERE if os.path.basename(HERE) == "Data" else os.path.join(HERE, "Data")
SRC = os.path.join(DATA, "Extra_info")
OUT = os.path.join(DATA, "service_territories.geojson")
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

# Slice 6c: stamp WHICH CECONY shapefiles this overlay was built from.
#
# The same two files also produce the per-tract electric_networks and gas_areas in
# build_pure_geometry_dataset.py, and rebuilding one output without the other used
# to be caught only by comparing mtimes and printing a warning. Both halves were
# weak. The fingerprint is imported from the builder rather than reimplemented
# here, because two copies of a hash rule is how the two sides drift apart --
# which is the very failure this field exists to detect.
#
# ORU is excluded from the fingerprint by design: it feeds only this overlay, so
# including it would report a mismatch when nothing shared had changed. See the
# note beside FINGERPRINT_PARTS in the builder.
import build_pure_geometry_dataset as _bpg   # noqa: E402  (same directory)

_fingerprint = _bpg.coned_source_fingerprint()
if _fingerprint is None:
    raise SystemExit(
        "REFUSING: a CECONY shapefile part is missing, so this overlay could not "
        "be stamped with the source it came from. Writing an unstamped file would "
        "put the coupling back on trust.")

# Slice 6d: the overlay is also a DATASET, so it carries a manifest.
#
# One file serving two transports, on purpose. `schema`, `kind` and `dataset` sit
# beside `features` as GeoJSON foreign members, so these exact bytes validate as a
# territories dataset in Dataverse AND still parse as the web resource the map
# falls back to -- which is what lets slice 6e delete that web resource without a
# second producer, and without the two drifting apart the way the overlay and the
# per-tract network values used to.
#
# The fingerprint stays at the ROOT rather than moving into `dataset`. It describes
# the FeatureCollection, and the app reads either position (dsSourceFingerprint),
# so moving it would only invalidate the 6c guard that already asserts it here.
DATASET = {
    "key": "service_territories",
    "version": "1.0",
    "name": "ConEd & ORU service territories",
    "sourceLabel": "Con Edison electric networks and gas service area, ORU territory; "
                   "reprojected to WGS84 from " +
                   ", ".join(b + ".shp" for b, _l, _n, _e in LAYERS),
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection",
               "schema": 1,
               "kind": "territories",
               "dataset": DATASET,
               "sourceFingerprint": _fingerprint,
               "features": features},
              f, separators=(",", ":"), ensure_ascii=False)

print("\nlayers:")
for b, l, n, bb in report:
    print("  %-16s layer=%-8s features=%d  bbox lon[%.4f, %.4f] lat[%.4f, %.4f]"
          % (b, l, n, bb[0], bb[2], bb[1], bb[3]))
sz = os.path.getsize(OUT)
print("\ntotal features:", len(features))
print("output: %s (%d bytes, %.2f MB)" % (OUT, sz, sz / 1e6))
