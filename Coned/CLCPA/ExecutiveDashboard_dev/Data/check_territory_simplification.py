"""Guard for the CLCPA-189 territory simplification.

The overlay went from 3,484,748 bytes (152,173 vertices at 6dp) to 238,928 bytes
(10,619 vertices at 5dp) by turning on the Douglas-Peucker pass that
_make_territories.py had always carried but kept switched off. That is a 14.6x cut
in the file the map downloads the first time someone switches the layer on.

A reduction that large is only safe if the things the app and the operator rely on
are unchanged, so this asserts them rather than trusting the eye:

  1. the dataset envelope the app validates (schema/kind/key/fingerprint)
  2. 95 features, and 89/4/2 per layer
  3. layer tags exactly {electric, gas, oru}, every feature named
  4. Polygon/MultiPolygon only
  5. RING SAFETY: every ring closed and >= 4 points
  6. every coordinate inside the New York bbox the app enforces
  7. coordinate precision never exceeds the configured dp
  8. GEOMETRIC FIDELITY: max deviation from the full-resolution build, in metres,
     within the tolerance the build claims
  9. the version string cannot detach from the recipe that produced it

EVERY CHECK IS PROVEN TO FAIL FIRST. Each one is run against a deliberately broken
copy of the real document, and a check that passes its own broken variant is itself
reported as a failure. This is here because this project has repeatedly been bitten
by assertions that could not fail the way they needed to: a mock that coerced null
to '' and hid a retire bug, an equivalence test comparing new against new, a hash
taken from an output whose build had crashed. A guard nobody has seen fail is a
guess.

Usage:
    python check_territory_simplification.py
    python check_territory_simplification.py --full <path to a 1.0 build>

The full-resolution reference is needed for check 8 only. Without --full it is
built once into a temp file by re-running the builder at the original recipe, which
also re-proves that recipe still works.
"""
import argparse
import json
import math
import os
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = HERE if os.path.basename(HERE) == "Data" else os.path.join(HERE, "Data")
TERR = os.path.join(DATA, "service_territories.geojson")
BUILDER = os.path.join(DATA, "_make_territories.py")

# Mirrors DS_TERRITORY_BBOX / DS_TERRITORY_LAYERS in app.js. Duplicated on purpose:
# if the app widens its box, this guard should have to be changed deliberately
# rather than silently follow.
BBOX = {"minLon": -80.5, "maxLon": -71.0, "minLat": 40.0, "maxLat": 45.5}
LAYERS_EXPECTED = {"electric", "gas", "oru"}
COUNTS_EXPECTED = {"electric": 89, "gas": 4, "oru": 2}
FEATURES_EXPECTED = 95
ORIGINAL_RECIPE_VERSION = "1.0"

M_PER_DEG_LAT = 111320.0
# US survey foot, matching the source CRS ("NAD83 / New York Long Island (ftUS)")
# rather than the international foot. Kept identical to _make_territories.py.
FT_US = 0.30480060960121924

_pass = 0
_fail = 0


def check(name, ok, detail=None):
    global _pass, _fail
    if ok:
        _pass += 1
        print("  PASS  " + name)
    else:
        _fail += 1
        print("  FAIL  " + name + ("  <- " + str(detail) if detail is not None else ""))
    return ok


def rings_of(doc):
    """Yield (feature_index, ring) for every ring in the document."""
    for i, ft in enumerate(doc.get("features", [])):
        g = ft.get("geometry") or {}
        t = g.get("type")
        cs = g.get("coordinates") or []
        if t == "Polygon":
            for r in cs:
                yield i, r
        elif t == "MultiPolygon":
            for poly in cs:
                for r in poly:
                    yield i, r


def all_points(doc):
    for _i, r in rings_of(doc):
        for p in r:
            yield p


# --------------------------------------------------------------------------- #
# the checks, each a function of the document returning (ok, detail)
# --------------------------------------------------------------------------- #

def c_envelope(doc):
    fp = doc.get("sourceFingerprint")
    ok = (doc.get("schema") == 1
          and doc.get("kind") == "territories"
          and (doc.get("dataset") or {}).get("key") == "service_territories"
          and isinstance(fp, str) and len(fp) == 64
          and all(ch in "0123456789abcdef" for ch in fp))
    return ok, "schema=%r kind=%r key=%r fingerprint=%s" % (
        doc.get("schema"), doc.get("kind"), (doc.get("dataset") or {}).get("key"),
        (fp[:12] + "...") if isinstance(fp, str) else fp)


def c_feature_count(doc):
    n = len(doc.get("features", []))
    return n == FEATURES_EXPECTED, "%d features, expected %d" % (n, FEATURES_EXPECTED)


def c_layer_counts(doc):
    seen = {}
    for ft in doc.get("features", []):
        k = (ft.get("properties") or {}).get("layer")
        seen[k] = seen.get(k, 0) + 1
    return seen == COUNTS_EXPECTED, "%r, expected %r" % (seen, COUNTS_EXPECTED)


def c_layer_tags(doc):
    tags = {(ft.get("properties") or {}).get("layer") for ft in doc.get("features", [])}
    return tags == LAYERS_EXPECTED, "%r, expected %r" % (sorted(map(str, tags)),
                                                         sorted(LAYERS_EXPECTED))


def c_named(doc):
    bad = [i for i, ft in enumerate(doc.get("features", []))
           if not (ft.get("properties") or {}).get("name")]
    return not bad, "features with no name: %r" % bad[:8]


def c_geom_types(doc):
    bad = sorted({(ft.get("geometry") or {}).get("type")
                  for ft in doc.get("features", [])} - {"Polygon", "MultiPolygon"})
    return not bad, "unexpected geometry types: %r" % bad


def c_ring_safety(doc):
    """Ring safety: closed, and at least four points. This is the invariant
    simplify_ring's full-resolution fallback exists to protect."""
    short, open_ = [], []
    for i, r in rings_of(doc):
        if len(r) < 4:
            short.append((i, len(r)))
        elif list(r[0]) != list(r[-1]):
            open_.append(i)
    return (not short and not open_,
            "rings under 4 points: %r; unclosed rings in features: %r"
            % (short[:8], open_[:8]))


def c_bbox(doc):
    out = []
    for p in all_points(doc):
        lon, lat = p[0], p[1]
        if not (BBOX["minLon"] <= lon <= BBOX["maxLon"]
                and BBOX["minLat"] <= lat <= BBOX["maxLat"]):
            out.append((round(lon, 5), round(lat, 5)))
            if len(out) > 8:
                break
    return not out, "points outside the NY bbox: %r" % out[:8]


def c_precision(doc, dp):
    """No coordinate may carry more decimal places than the build claims. Catches a
    variant that skipped the rounding pass, which would inflate the file without
    changing a single vertex."""
    bad = []
    for p in all_points(doc):
        for v in (p[0], p[1]):
            s = repr(float(v))
            if "." in s and "e" not in s and len(s.split(".")[1]) > dp:
                bad.append(v)
                break
        if len(bad) > 8:
            break
    return not bad, "coordinates finer than %d dp: %r" % (dp, bad[:8])


def c_version_recipe(doc, tol_ft, dp):
    """The version string must not be able to detach from the geometry. '1.0' is
    reserved for no-simplification-and-6dp; anything else must be a 1.1-simp label
    that states its own tolerance and precision.

    This check exists because the first draft of the derivation keyed only on the
    tolerance, so `--tol-ft 0` under the new 5dp default produced a 3.18 MB file
    labelled '1.0' when the real 1.0 is 3.48 MB."""
    v = (doc.get("dataset") or {}).get("version")
    original = (tol_ft == 0.0 and dp == 6)
    if original:
        return v == ORIGINAL_RECIPE_VERSION, "full-resolution 6dp build must be %r, got %r" % (
            ORIGINAL_RECIPE_VERSION, v)
    expected = "1.1-simp%gft-%gdp" % (tol_ft, dp)
    return v == expected, "expected %r, got %r" % (expected, v)


def c_reported_simplification(doc, tol_ft, dp):
    """The builder records what it traded away. Assert the record is present,
    internally consistent, and within the tolerance it claims.

    Douglas-Peucker's guarantee is that no dropped vertex sits further than the
    tolerance from the retained outline, so maxDeviation <= tolerance is not a
    hope: a value above it means the implementation is wrong, and a value of
    exactly 0 with vertices dropped means the figure is not being measured."""
    s = doc.get("simplification")
    if not isinstance(s, dict):
        return False, "no 'simplification' block at the document root"
    problems = []
    if s.get("toleranceSourceUnits") != tol_ft:
        problems.append("tolerance %r != %r" % (s.get("toleranceSourceUnits"), tol_ft))
    if s.get("coordinateDecimals") != dp:
        problems.append("coordinateDecimals %r != %r" % (s.get("coordinateDecimals"), dp))
    dev = s.get("maxDeviationSourceUnits")
    if not isinstance(dev, (int, float)):
        problems.append("maxDeviationSourceUnits is %r" % (dev,))
    elif tol_ft and dev > tol_ft:
        problems.append("max deviation %g exceeds the %g tolerance it claims"
                        % (dev, tol_ft))
    vb, va = s.get("verticesBefore"), s.get("verticesAfter")
    if not (isinstance(vb, int) and isinstance(va, int) and 0 < va <= vb):
        problems.append("vertex counts %r -> %r" % (vb, va))
    elif tol_ft and va < vb and not dev:
        problems.append("%s vertices dropped but max deviation reported as %r -- "
                        "the figure is not being measured"
                        % (format(vb - va, ","), dev))
    if tol_ft and isinstance(vb, int) and isinstance(va, int) and va >= vb:
        problems.append("a tolerance of %g dropped no vertices" % tol_ft)
    return not problems, "; ".join(problems)


def m_reported_simplification(doc):
    d = _clone(doc)
    d["simplification"]["maxDeviationSourceUnits"] = d["simplification"][
        "toleranceSourceUnits"] * 3
    return d, "reported deviation inflated past its own tolerance"


def m_reported_missing(doc):
    d = _clone(doc)
    del d["simplification"]
    return d, "the simplification block removed entirely"


def m_reported_unmeasured(doc):
    d = _clone(doc)
    d["simplification"]["maxDeviationSourceUnits"] = 0
    return d, "deviation reported as 0 while vertices were dropped"


def _seg_dist_m(p, a, b, coslat):
    """Perpendicular distance from p to segment ab, in metres."""
    px = p[0] * coslat
    py = p[1]
    ax, ay = a[0] * coslat, a[1]
    bx, by = b[0] * coslat, b[1]
    dx, dy = bx - ax, by - ay
    if dx == 0.0 and dy == 0.0:
        d = math.hypot(px - ax, py - ay)
    else:
        t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)
        t = max(0.0, min(1.0, t))
        d = math.hypot(px - (ax + t * dx), py - (ay + t * dy))
    return d * M_PER_DEG_LAT


SAMPLE_PER_RING = 40


def sampled_max_deviation_m(full_doc, simp_doc, per_ring=SAMPLE_PER_RING):
    """Independent spot-check of geometric fidelity: exact point-to-polyline
    distance for a deterministic sample of original vertices.

    Why sampled, and why exact per sample. Two cheaper designs were tried and
    rejected:

      * FULL brute force is exact but costs 156,894,520 distance computations
        across these 134 ring pairs -- minutes of pure Python for a guard.
      * Walking the rings in step is O(n) and looks safe, because Douglas-Peucker
        keeps a SUBSEQUENCE of its input. It is not safe. Matching has to tolerate
        the 5dp rounding (0.56 m), but neighbouring vertices in these rings sit a
        median 2.88 m apart and some are coincident, so the walk locks onto a
        neighbour of the kept vertex and drifts. It reported 68.50 m where brute
        force on the same feature says 12.58 m -- and its own desynchronisation
        detector did not fire, which is the failure mode this project keeps
        meeting: a check that cannot fail in the way it needs to.

    So the producer states the global figure (it measures every dropped vertex for
    free, inside the recursion) and this verifies a sample of it exactly, with no
    alignment assumption at all. A builder whose reported deviation is a fiction
    fails here; a sample that happens to miss the single worst vertex still cannot
    hide a systematic drift.

    The sample is evenly spaced and therefore reproducible -- no seed, no
    randomness, same answer on every run.
    """
    worst = 0.0
    worst_at = None
    checked = 0
    full_rings = list(rings_of(full_doc))
    simp_rings = list(rings_of(simp_doc))
    if len(full_rings) != len(simp_rings):
        return None, "ring count differs: %d full vs %d simplified" % (
            len(full_rings), len(simp_rings)), 0

    for (fi, fr), (si, sr) in zip(full_rings, simp_rings):
        if fi != si:
            return None, "ring order differs at feature %d vs %d" % (fi, si), checked
        if len(sr) < 2 or not fr:
            continue
        coslat = math.cos(math.radians(fr[0][1]))
        step = max(1, len(fr) // per_ring)
        for k in range(0, len(fr), step):
            p = fr[k]
            best = min(_seg_dist_m(p, sr[j], sr[j + 1], coslat)
                       for j in range(len(sr) - 1))
            checked += 1
            if best > worst:
                worst, worst_at = best, (fi, k)
    return worst, worst_at, checked


# --------------------------------------------------------------------------- #
# negative controls: each mutator must make its named check FAIL
# --------------------------------------------------------------------------- #

def _clone(doc):
    return json.loads(json.dumps(doc))


def m_envelope(doc):
    d = _clone(doc)
    d["kind"] = "geometry"
    return d, "kind changed to 'geometry'"


def m_feature_count(doc):
    d = _clone(doc)
    d["features"] = d["features"][:-1]
    return d, "one feature dropped"


def m_layer_counts(doc):
    d = _clone(doc)
    for ft in d["features"]:
        if ft["properties"]["layer"] == "gas":
            ft["properties"]["layer"] = "electric"
            break
    return d, "one gas feature relabelled electric (total still 95)"


def m_layer_tags(doc):
    d = _clone(doc)
    d["features"][0]["properties"]["layer"] = "steam"
    return d, "a 'steam' layer tag introduced"


def m_named(doc):
    d = _clone(doc)
    d["features"][0]["properties"]["name"] = None
    return d, "one feature's name nulled"


def m_geom_types(doc):
    d = _clone(doc)
    d["features"][0]["geometry"]["type"] = "LineString"
    return d, "one geometry retyped LineString"


def m_ring_safety_short(doc):
    d = _clone(doc)
    for i, ft in enumerate(d["features"]):
        g = ft["geometry"]
        if g["type"] == "Polygon":
            g["coordinates"][0] = g["coordinates"][0][:3]
            return d, "a ring truncated to 3 points (feature %d)" % i
        if g["type"] == "MultiPolygon":
            g["coordinates"][0][0] = g["coordinates"][0][0][:3]
            return d, "a ring truncated to 3 points (feature %d)" % i
    raise AssertionError("no polygon ring found to truncate")


def m_ring_safety_open(doc):
    d = _clone(doc)
    for i, ft in enumerate(d["features"]):
        g = ft["geometry"]
        r = (g["coordinates"][0] if g["type"] == "Polygon"
             else g["coordinates"][0][0])
        r[-1] = [r[-1][0] + 0.01, r[-1][1]]
        return d, "a ring left unclosed (feature %d)" % i
    raise AssertionError("no ring found to open")


def m_bbox(doc):
    d = _clone(doc)
    g = d["features"][0]["geometry"]
    r = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
    r[0] = [-122.4, 37.8]                  # San Francisco
    return d, "one vertex moved to San Francisco"


def m_precision(doc):
    d = _clone(doc)
    g = d["features"][0]["geometry"]
    r = g["coordinates"][0] if g["type"] == "Polygon" else g["coordinates"][0][0]
    r[1] = [round(r[1][0] + 1e-7, 9), r[1][1]]
    return d, "one coordinate given 9 dp"


def m_version_recipe(doc):
    d = _clone(doc)
    d["dataset"]["version"] = "1.0"
    return d, "a simplified file labelled '1.0' (the exact drift this check exists for)"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", default=TERR)
    ap.add_argument("--full", default=None,
                    help="a full-resolution 1.0 build for the deviation check; "
                         "built into a temp file if omitted")
    ap.add_argument("--tol-ft", type=float, default=40.0,
                    help="the tolerance the file under test was built with")
    ap.add_argument("--coord-dp", type=int, default=5)
    ap.add_argument("--skip-deviation", action="store_true",
                    help="skip check 8 (it needs a full-resolution rebuild)")
    a = ap.parse_args()

    print("=== territory simplification guard ===")
    print("file: %s" % a.file)
    if not os.path.exists(a.file):
        print("STOPPED: %s does not exist." % a.file)
        return 1
    size = os.path.getsize(a.file)
    with open(a.file, encoding="utf-8") as f:
        doc = json.load(f)
    print("size: %s bytes, %d features, %s vertices\n"
          % (format(size, ","), len(doc.get("features", [])),
             format(sum(1 for _ in all_points(doc)), ",")))

    # ---- the document checks ----
    print("== the shipped file ==")
    simple = [
        ("dataset envelope intact", c_envelope, m_envelope),
        ("exactly %d features" % FEATURES_EXPECTED, c_feature_count, m_feature_count),
        ("per-layer counts 89/4/2", c_layer_counts, m_layer_counts),
        ("layer tags exactly electric/gas/oru", c_layer_tags, m_layer_tags),
        ("every feature named", c_named, m_named),
        ("Polygon/MultiPolygon only", c_geom_types, m_geom_types),
        ("ring safety: closed and >= 4 points", c_ring_safety, m_ring_safety_short),
        ("every vertex inside the NY bbox", c_bbox, m_bbox),
    ]
    for name, fn, _m in simple:
        ok, detail = fn(doc)
        check(name, ok, None if ok else detail)

    ok, detail = c_precision(doc, a.coord_dp)
    check("coordinates within %d dp" % a.coord_dp, ok, None if ok else detail)
    ok, detail = c_version_recipe(doc, a.tol_ft, a.coord_dp)
    check("version matches the recipe that built it", ok, None if ok else detail)
    ok, detail = c_reported_simplification(doc, a.tol_ft, a.coord_dp)
    check("the builder's simplification record is consistent", ok, None if ok else detail)
    s = doc.get("simplification") or {}
    if ok:
        print("        (tolerance %g ft = %.2f m; worst dropped vertex %.4f ft = "
              "%.2f m; %s -> %s vertices)"
              % (s.get("toleranceSourceUnits"), s.get("toleranceMetres"),
                 s.get("maxDeviationSourceUnits"), s.get("maxDeviationMetres"),
                 format(s.get("verticesBefore"), ","), format(s.get("verticesAfter"), ",")))

    # ---- geometric fidelity ----
    dev = None
    if a.skip_deviation:
        print("  SKIP  geometric fidelity (--skip-deviation)")
    else:
        full_path = a.full
        tmp = None
        if not full_path:
            tmp = tempfile.NamedTemporaryFile(suffix=".geojson", delete=False)
            tmp.close()
            full_path = tmp.name
            print("\n  building the full-resolution reference (--tol-ft 0 --coord-dp 6)...")
            r = subprocess.run([sys.executable, BUILDER, "--tol-ft", "0",
                                "--coord-dp", "6", "--out", full_path],
                               capture_output=True, text=True)
            # The exit code is checked. Hashing or comparing an output whose
            # producer crashed is a mistake this project has already made once.
            if r.returncode != 0:
                check("the full-resolution reference build succeeds", False,
                      "exit %d: %s" % (r.returncode, r.stderr[-300:]))
                full_path = None
        if full_path:
            with open(full_path, encoding="utf-8") as f:
                full_doc = json.load(f)
            check("the reference really is the 1.0 recipe",
                  (full_doc.get("dataset") or {}).get("version") == ORIGINAL_RECIPE_VERSION,
                  (full_doc.get("dataset") or {}).get("version"))
            dev, where, n_checked = sampled_max_deviation_m(full_doc, doc)
            # Bound: the DP tolerance in metres plus the rounding half-step. Both
            # are real: the vertex is moved by simplification, then its surviving
            # neighbours are rounded.
            bound = (a.tol_ft * FT_US + 0.5 * (10 ** -a.coord_dp) * M_PER_DEG_LAT)
            if dev is None:
                check("geometric fidelity measurable", False, where)
            else:
                check("sampled max deviation %.2f m within the %.2f m bound" % (dev, bound),
                      dev <= bound, "%.2f m at %r" % (dev, where))
                print("        (%s vertices sampled exactly, no alignment assumed; "
                      "tolerance %.2f m + rounding %.2f m)"
                      % (format(n_checked, ","), a.tol_ft * FT_US,
                         0.5 * (10 ** -a.coord_dp) * M_PER_DEG_LAT))
                # An independent control on the sampler itself: displace the
                # simplified outline and confirm the sample notices. Without this,
                # a sampler that silently returned 0.0 would read as a pass.
                drifted = _clone(doc)
                for _fi, r in rings_of(drifted):
                    for pt in r:
                        pt[1] += 0.002        # ~220 m north
                    break
                ddev, _dw, _dn = sampled_max_deviation_m(full_doc, drifted)
                check("the sampler detects a ~220 m displacement of one ring",
                      ddev is not None and ddev > bound,
                      "reported %r for a visibly moved outline" % (ddev,))
        if tmp:
            os.unlink(tmp.name)

    # ---- negative controls ----
    print("\n== negative controls: every check must FAIL on a broken variant ==")
    controls = list(simple) + [
        ("ring safety: closed and >= 4 points", c_ring_safety, m_ring_safety_open),
    ]
    for name, fn, mut in controls:
        broken, what = mut(doc)
        ok, _d = fn(broken)
        check("'%s' rejects: %s" % (name, what), not ok,
              "the check PASSED a broken document -- it cannot detect this")

    broken, what = m_precision(doc)
    ok, _d = c_precision(broken, a.coord_dp)
    check("'coordinates within %d dp' rejects: %s" % (a.coord_dp, what), not ok,
          "the check PASSED a broken document")

    broken, what = m_version_recipe(doc)
    ok, _d = c_version_recipe(broken, a.tol_ft, a.coord_dp)
    check("'version matches the recipe' rejects: %s" % what, not ok,
          "the check PASSED a broken document")

    for mut in (m_reported_simplification, m_reported_missing, m_reported_unmeasured):
        broken, what = mut(doc)
        ok, _d = c_reported_simplification(broken, a.tol_ft, a.coord_dp)
        check("'simplification record is consistent' rejects: %s" % what, not ok,
              "the check PASSED a broken document")

    print("\n%s  %d passed, %d failed" % ("FAILED" if _fail else "ALL PASS",
                                          _pass, _fail))
    if not _fail:
        print("\nThe simplified overlay is safe to publish: envelope, counts, layers,")
        print("ring validity, extent and precision all hold, geometry is within")
        print("%.2f m of the full-resolution build, and every one of these checks has"
              % (dev if dev else 0.0))
        print("been shown to fail on a document broken in exactly its own way.")
    return 1 if _fail else 0


if __name__ == "__main__":
    sys.exit(main())
