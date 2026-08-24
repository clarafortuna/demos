"""One-off: convert the Extra_info ConEd/ORU service-territory shapefiles to one
WGS84 GeoJSON (Data/service_territories.geojson) for the DAC map overlay.

- Electric networks + Gas service area + ORU territory.
- Reprojects each shapefile from its .prj CRS to EPSG:4326 with a PROPER datum
  transform (electric/gas are NAD83; ORU is NAD27, so a real NAD27->WGS84
  transform is required, not a naive ellipsoid swap). PROJ network is enabled
  and ballpark transforms are rejected so a grid-based transform is used.
- Optional Douglas-Peucker simplification (TOL_FT; 0 = full resolution).
Not committed itself; the .geojson output is the deliverable."""
import argparse, json, math, os
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

# CLCPA-189: simplification ON, and the reason the old comment gave for leaving it
# off no longer holds.
#
# That comment read "lazy-load covers the page-load cost". Lazy loading does not
# REMOVE the cost, it MOVES it -- to the first time someone switches the layer on,
# which is precisely where the delay was observed on hosted. Measured at full
# resolution the overlay is 3,484,748 bytes for 95 polygons: 152,173 vertices for
# outlines that are drawn at borough-to-state zoom, where one screen pixel spans
# roughly 50-500 m.
#
# Tolerance is in SOURCE units (US survey feet) and is applied BEFORE reprojection,
# so it is a uniform distance on the ground rather than a longitude-dependent one.
# 40 ft is about 12 m: comfortably sub-pixel at every zoom this overlay is used at,
# and it takes the file to roughly 8% of its former size. See the sweep recorded in
# check_territory_simplification.py for the numbers behind the choice.
#
# Rounding drops 6dp -> 5dp (about 1.1 m) at the same time. Measured on its own,
# precision was the weak lever -- 5dp alone saves 9% because the vertex COUNT is
# the cost, not the digits -- but it is free once the vertices are gone.
TOL_FT_DEFAULT = 40.0
COORD_DP_DEFAULT = 5

_ap = argparse.ArgumentParser(description=__doc__)
_ap.add_argument("--tol-ft", type=float, default=TOL_FT_DEFAULT,
                 help="Douglas-Peucker tolerance in source units (US ft); "
                      "0 = full resolution. Default %(default)s.")
_ap.add_argument("--coord-dp", type=int, default=COORD_DP_DEFAULT,
                 help="decimal places for output lon/lat. Default %(default)s.")
_ap.add_argument("--out", default=OUT,
                 help="output path; override to build a variant without touching "
                      "the deliverable (used by the tolerance sweep and by the "
                      "guard's deliberately broken variants).")
_args = _ap.parse_args()
TOL_FT = _args.tol_ft
COORD_DP = _args.coord_dp
OUT = _args.out

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


# The largest distance, in source units, that any dropped vertex ends up from the
# retained outline. Accumulated across every ring of every layer.
#
# This is recorded HERE because the information is free here and expensive
# anywhere else. Measuring fidelity by comparing the finished WGS84 output against
# a full-resolution rebuild means re-pairing 152,173 vertices with the 10,619 that
# survived: exact brute force is 156.9 million distance computations, and the
# cheap alternative -- walking the two rings in step, since DP keeps a
# subsequence -- silently desynchronised when I tried it. Neighbouring vertices in
# these rings sit a median 2.88 m apart (some are coincident), so any
# rounding-tolerant match locks onto the wrong vertex and reports a deviation of
# 68.50 m where the truth is 12.58 m. Inside the recursion there is nothing to
# match: when a segment is accepted, the farthest point from it has just been
# measured.
_dev_max_src = 0.0


def dp(pts, tol):
    """Douglas-Peucker, recording the true residual of every accepted segment.

    Split decisions are unchanged from the original: the previous version seeded
    the running maximum AT the tolerance so that only a point beyond it could be
    selected, which is the same test as "split iff the farthest point exceeds
    tol" -- it simply discarded the actual distance on the way past."""
    global _dev_max_src
    if len(pts) <= 2:
        return pts[:]
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        i, j = stack.pop()
        ax, ay = pts[i]; bx, by = pts[j]
        dx, dy = bx - ax, by - ay
        d2 = dx * dx + dy * dy
        idx, far = -1, 0.0
        for k in range(i + 1, j):
            px, py = pts[k]
            if d2 == 0:
                dist = math.hypot(px - ax, py - ay)
            else:
                t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / d2))
                dist = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
            if dist > far:
                far, idx = dist, k
        if far > tol:
            keep[idx] = True
            stack.append((i, idx)); stack.append((idx, j))
        elif far > _dev_max_src:
            # Segment accepted: `far` is exactly how far the worst dropped vertex
            # between i and j lies from the line that now replaces them.
            _dev_max_src = far
    return [pts[k] for k in range(len(pts)) if keep[k]]


def simplify_ring(ring, tol):
    # Ring safety, and it is deliberately the blunt version: if the tolerance would
    # take this ring below the four points a closed ring needs, keep the ring at
    # FULL resolution rather than emit something degenerate. A few small rings
    # staying dense is a much better failure than a polygon the validator rejects
    # -- or worse, one it accepts and draws as a spike. check_territory_simplification
    # asserts the resulting invariant (every ring >= 4 points and closed) on the
    # real output, so this is a guarantee rather than an intention.
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
        return [round(lon, COORD_DP), round(lat, COORD_DP)]
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
    v_before = v_after = 0
    for sr in r.shapeRecords():
        gi = sr.shape.__geo_interface__
        simp = simplify_coords(gi["type"], gi["coordinates"], TOL_FT)
        v_before += sum(1 for _ in allcoords(gi["coordinates"]))
        v_after += sum(1 for _ in allcoords(simp))
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
    report.append((basename, layer, n, (min(xs), min(ys), max(xs), max(ys)),
                   v_before, v_after))

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
# The version is DERIVED from the geometry settings, never typed alongside them. Two
# territory files that differ in geometry must not be able to share a version
# string: the app retires the previous row by KEY, so a mislabelled upload would
# silently replace the full-resolution overlay with a simplified one under the same
# name and leave nothing in the record to say so.
#
# "1.0" is reserved for the EXACT recipe that produced the published 1.0 row --
# no simplification AND 6dp. The first version of this line keyed only on the
# tolerance, so `--tol-ft 0` with the new 5dp default emitted a 3.18 MB file
# labelled "1.0" while the real 1.0 is 3.48 MB. That is the same label-detaching-
# from-artifact failure this comment exists to prevent, so it is asserted rather
# than merely intended: check_territory_simplification proves the pairing.
_ORIGINAL_RECIPE = (0.0, 6)
_version = ("1.0" if (TOL_FT, COORD_DP) == _ORIGINAL_RECIPE
            else "1.1-simp%gft-%gdp" % (TOL_FT, COORD_DP))

DATASET = {
    "key": "service_territories",
    "version": _version,
    "name": "ConEd & ORU service territories",
    "sourceLabel": "Con Edison electric networks and gas service area, ORU territory; "
                   "reprojected to WGS84 from " +
                   ", ".join(b + ".shp" for b, _l, _n, _e in LAYERS),
}

_tot_before = sum(r[4] for r in report)
_tot_after = sum(r[5] for r in report)

# US survey foot, taken from the source CRS rather than assumed: CECONY_Gas.prj is
# "NAD83 / New York Long Island (ftUS)", whose axis unit converts at
# 0.30480060960121924 m -- not the international foot's 0.3048. The difference is
# two parts per million and irrelevant to the outcome, but a tolerance quoted in
# metres should come from the projection that defined it.
_FT_US = 0.30480060960121924

# Recorded in the file, at the root beside sourceFingerprint, so a reader can see
# what was traded away without rebuilding anything. The app ignores unknown root
# members (schema/kind/dataset/sourceFingerprint are already GeoJSON foreign
# members) and dsValidateTerritoryDoc does no strict key checking, so this is
# inert at runtime and load-bearing only for the guard and for whoever inherits
# this pipeline.
SIMPLIFICATION = {
    "toleranceSourceUnits": TOL_FT,
    "sourceUnit": "US survey foot",
    "toleranceMetres": round(TOL_FT * _FT_US, 4),
    "maxDeviationSourceUnits": round(_dev_max_src, 4),
    "maxDeviationMetres": round(_dev_max_src * _FT_US, 4),
    "coordinateDecimals": COORD_DP,
    "verticesBefore": _tot_before,
    "verticesAfter": _tot_after,
}

with open(OUT, "w", encoding="utf-8") as f:
    json.dump({"type": "FeatureCollection",
               "schema": 1,
               "kind": "territories",
               "dataset": DATASET,
               "sourceFingerprint": _fingerprint,
               "simplification": SIMPLIFICATION,
               "features": features},
              f, separators=(",", ":"), ensure_ascii=False)

print("\nlayers:")
for b, l, n, bb, vb, va in report:
    print("  %-16s layer=%-8s features=%d  bbox lon[%.4f, %.4f] lat[%.4f, %.4f]"
          % (b, l, n, bb[0], bb[2], bb[1], bb[3]))
    print("  %-16s vertices %s -> %s  (%.1f%% kept)"
          % ("", format(vb, ","), format(va, ","),
             100.0 * va / vb if vb else 100.0))
sz = os.path.getsize(OUT)
print("\ntotal features:", len(features))
print("simplification: tolerance %g ft (%.2f m), coordinates at %d dp, version %s"
      % (TOL_FT, TOL_FT * _FT_US, COORD_DP, _version))
print("total vertices: %s -> %s  (%.1f%% kept, %s dropped)"
      % (format(_tot_before, ","), format(_tot_after, ","),
         100.0 * _tot_after / _tot_before if _tot_before else 100.0,
         format(_tot_before - _tot_after, ",")))
print("max deviation : %.4f ft (%.2f m) -- worst dropped vertex, measured inside"
      % (_dev_max_src, _dev_max_src * _FT_US))
print("                the recursion, so it covers every ring of every layer")
print("output: %s (%d bytes, %.2f MB)" % (OUT, sz, sz / 1e6))
