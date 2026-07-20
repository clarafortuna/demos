"""enrich_hvi.py — add an `hvi` field to each tract in map_payload.json and emit
the drawable ZCTA overlay (Data/hvi_zcta.geojson) for the DAC map.

Heat Vulnerability Index (HVI) is published per NYC ZCTA (ZIP Code Tabulation
Area), not per census tract, so this offline step spatially joins the ZCTAs to
the tracts. For every tract feature it lists the intersecting ZCTAs:

  hvi: [ {zcta, score, overlap_fraction}, ... ]   sorted overlap-desc (dominant
        first). Only ZCTAs whose intersection is >= 5% of the TRACT's area are
        kept. A tract with no >=5% intersection gets NO hvi field (not a zero
        score) — including the degenerate case where a tract clips one or more
        ZCTAs but every overlap is below 5%. There is deliberately NO
        single-largest fallback (unlike enrich_electric_network.py): HVI must
        be omitted, not forced. HVI covers the five NYC boroughs only, so the
        217 Westchester tracts correctly get no hvi field.

  Data/hvi_zcta.geojson: the source ZCTA polygons (WGS84 / EPSG:4326, as the
        runtime draws them) each carrying {zcta, score, source}. This mirrors
        how Data/service_territories.geojson feeds the network overlay.

Areas are computed in a projected CRS (EPSG:2263, NAD83 / NY Long Island,
US ft) — the same CRS enrich_electric_network.py uses — never in 4326 degrees.
Applies to all tracts (DAC + Non-DAC); no other field is touched. Idempotent:
recomputes + overwrites both outputs on each run (re-running produces byte-
identical files — stable ordering, no duplicated fields).

The year in SOURCE_LABEL is a display label ONLY — no code depends on it, so a
future correction is a one-line edit here.

Pipeline order:  0 build_base -> 1 enrich_map_payload -> 2 enrich_neighborhoods
                 -> 3 enrich_electric_network -> 4 enrich_hvi (this script)
Run from ExecutiveDashboard_dev/:  python Data/enrich_hvi.py
"""
import json, os, collections
from pyproj import CRS, Transformer
from shapely.geometry import shape
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
HVI_SRC = os.path.join(HERE, "Extra_info", "hvi_zcta_2020.geojson")
MAP = os.path.join(ROOT, "map_payload.json")
OVERLAY = os.path.join(HERE, "hvi_zcta.geojson")

HVI_SLIVER_THRESHOLD = 0.05   # keep ZCTAs covering >= 5% of the tract's area
ZCTA_FIELD = "ZCTA5CE20"
SCORE_FIELD = "Heat_Vulnerability_Index__HVI_"
# Display label only. The year is assumed; no code branches on it (see module
# docstring), so correcting the vintage later is a single edit right here.
SOURCE_LABEL = "HVI (2022, assumed) - NYC DOHMH, 2020 ZCTA"

# EPSG:2263 (NAD83 / NY Long Island, ftUS) — matches enrich_electric_network.py.
CRS_PROJ = CRS.from_epsg(2263)
CRS_WGS84 = CRS.from_epsg(4326)
tf = Transformer.from_crs(CRS_WGS84, CRS_PROJ, always_xy=True)


def reproj(coords):
    """Recursively reproject a GeoJSON coordinate tree from 4326 to EPSG:2263."""
    if coords and isinstance(coords[0], (int, float)):
        x, y = tf.transform(coords[0], coords[1])
        return [x, y]
    return [reproj(c) for c in coords]


def load_zctas():
    """Return (zcta_ids, scores, projected_geoms, STRtree) for the HVI source."""
    src = json.load(open(HVI_SRC, encoding="utf-8"))
    zids, scores, geoms = [], [], []
    for feat in src["features"]:
        p = feat["properties"]
        g = shape({"type": feat["geometry"]["type"],
                   "coordinates": reproj(feat["geometry"]["coordinates"])})
        if not g.is_valid:
            g = g.buffer(0)
        zids.append(p.get(ZCTA_FIELD))
        scores.append(p.get(SCORE_FIELD))
        geoms.append(g)
    return zids, scores, geoms, STRtree(geoms)


def assign(tg, tract_area, zids, scores, geoms, tree):
    """Return [{zcta, score, overlap_fraction}, ...] for ZCTAs covering >= 5% of
    the tract's area, dominant first. NO single-largest fallback: if nothing
    reaches the threshold the list is empty (-> tract gets no hvi field)."""
    if tract_area <= 0:
        return []
    thr = HVI_SLIVER_THRESHOLD * tract_area
    hits = []
    for idx in tree.query(tg):
        i = int(idx)
        g = geoms[i]
        if not tg.intersects(g):
            continue
        a = tg.intersection(g).area
        if a >= thr:
            hits.append((a, zids[i], scores[i]))
    hits.sort(key=lambda t: t[0], reverse=True)
    return [{"zcta": z, "score": s, "overlap_fraction": round(a / tract_area, 4)}
            for a, z, s in hits]


def main():
    zids, scores, geoms, tree = load_zctas()

    mp = json.load(open(MAP, encoding="utf-8"))
    dist = collections.Counter()
    multi = []
    total = len(mp["features"])
    with_hvi = 0

    for feat in mp["features"]:
        p = feat["properties"]
        p.pop("hvi", None)   # recompute cleanly so re-runs never accumulate

        geom = {"type": feat["geometry"]["type"],
                "coordinates": reproj(feat["geometry"]["coordinates"])}
        try:
            tg = shape(geom)
            if not tg.is_valid:
                tg = tg.buffer(0)
        except Exception:
            tg = None

        hvi = assign(tg, tg.area, zids, scores, geoms, tree) \
            if (tg is not None and not tg.is_empty) else []

        # No coverage -> omit the field entirely (not [] , not a zero score).
        if hvi:
            p["hvi"] = hvi
            with_hvi += 1
        dist[len(hvi) if len(hvi) < 3 else "3+"] += 1
        if len(hvi) >= 2 and len(multi) < 6:
            multi.append((p.get("GEOID"), p.get("County"),
                          [(h["zcta"], h["score"], h["overlap_fraction"]) for h in hvi]))

    # Write map_payload.json minified (same format as the other enrich steps).
    with open(MAP, "w", encoding="utf-8") as f:
        json.dump(mp, f, separators=(",", ":"), ensure_ascii=False)

    # Emit the drawable overlay: source ZCTA polygons in WGS84 with score+source.
    # Read straight from source (unprojected) so the overlay stays in 4326, and
    # sort by ZCTA id for stable, idempotent output.
    src = json.load(open(HVI_SRC, encoding="utf-8"))
    ov_feats = []
    for feat in src["features"]:
        p = feat["properties"]
        ov_feats.append({
            "type": "Feature",
            "properties": {"zcta": p.get(ZCTA_FIELD),
                           "score": p.get(SCORE_FIELD),
                           "source": SOURCE_LABEL},
            "geometry": feat["geometry"],
        })
    ov_feats.sort(key=lambda f: str(f["properties"]["zcta"]))
    with open(OVERLAY, "w", encoding="utf-8") as f:
        json.dump({"type": "FeatureCollection", "features": ov_feats},
                  f, separators=(",", ":"), ensure_ascii=False)

    print("HVI enrichment over %d tracts (>=%.0f%% of tract area; no fallback)"
          % (total, HVI_SLIVER_THRESHOLD * 100))
    print("  hvi ZCTAs per tract  0:%d  1:%d  2:%d  3+:%d"
          % (dist[0], dist[1], dist[2], dist["3+"]))
    print("  tracts with hvi: %d   without: %d" % (with_hvi, total - with_hvi))
    by_county = collections.Counter(
        fe["properties"]["County"] for fe in mp["features"] if "hvi" in fe["properties"])
    print("  hvi by county:", dict(by_county))
    print("  multi-ZCTA samples:", multi)
    print("  overlay: %s (%d ZCTA polygons)" % (OVERLAY, len(ov_feats)))


if __name__ == "__main__":
    main()
