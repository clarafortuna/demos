#!/usr/bin/env python3
"""
build_base_map_payload.py  —  STEP 0 of the DAC map data pipeline.

Builds the BASE map_payload.json for Con Edison's six-county service area by
combining census-tract geometry with the NYSERDA DAC base and the Con Edison
Electric/Gas extracts. The later steps add the rest:

    python Data/build_base_map_payload.py   # 0. base build  (this script)
    python Data/enrich_map_payload.py       # 1. + 48 DAC indicator / score fields
    python Data/enrich_neighborhoods.py     # 2. + borough + neighborhood

Run from the dashboard root (ExecutiveDashboard_dev/), with all inputs in Data/.

------------------------------------------------------------------------------
INPUTS  (place in Data/)
------------------------------------------------------------------------------
  Data/ny_tracts.geojson        NY 2020 census-tract polygons.
                                 U.S. Census Bureau, 2020 cartographic boundary
                                 file cb_2020_36_tract_500k (state 36 = NY).
                                 https://www.census.gov/geographies/mapping-files/time-series/geo/cartographic-boundary.2020.html
                                 Properties used: GEOID, COUNTYFP

  Data/ny_tracts_2010.geojson   NY 2010 census-tract polygons (fallback for the
                                 ~150 legacy GEOIDs that no longer exist in 2020).
                                 Same Census source, 2010 vintage.
                                 Properties used: GEO_ID ("1400000US36XXXXXXXXX")

  Data/NYS_DAC.geojson          NYSERDA Disadvantaged Communities dataset
                                 (GeoJSON export; criteria finalized by the NYS
                                 Climate Justice Working Group, 2023-03-27).
                                 https://opdgig.dos.ny.gov/datasets/2579112b69b04b4c9a09f4cf013983dc
                                 Provides DAC scores per tract.

  Data/Electric.xlsx
  Data/Gas.xlsx                  Con Edison per-tract extracts (sheet "Export").
                                 Columns: <GEOID> | DAC Indicator | Total Accts |
                                          Total EAP Accts | Total Adjustment

------------------------------------------------------------------------------
OUTPUT
------------------------------------------------------------------------------
  map_payload.json   FeatureCollection, 2,333 features (1,059 DAC + 1,274 Non-DAC),
                     ~20 base properties per feature, plus a root `nondac_by_county`
                     block. Written minified.

Idempotent: re-running with the same inputs overwrites map_payload.json with the
same result. After this, run enrich_map_payload.py then enrich_neighborhoods.py.
"""

import json
import openpyxl
from collections import defaultdict

# ---- paths (relative to the dashboard root; run: python Data/build_base_map_payload.py) ----
IN_2020 = "Data/ny_tracts.geojson"
IN_2010 = "Data/ny_tracts_2010.geojson"
IN_DAC  = "Data/NYS_DAC.geojson"
IN_ELEC = "Data/Electric.xlsx"
IN_GAS  = "Data/Gas.xlsx"
OUT     = "map_payload.json"

# Con Edison service area = six counties (state FIPS 36 + county FIPS)
CONED_FIPS   = {"36005", "36047", "36061", "36081", "36085", "36119"}
COUNTY_NAMES = {
    "005": "Bronx", "047": "Kings", "061": "New York",
    "081": "Queens", "085": "Richmond", "119": "Westchester",
}
# DAC-base fields copied straight from NYS_DAC.geojson (by GEOID)
DAC_FIELDS = ["City_Town", "DAC_Desig", "Pop_Cnt", "HH_Cnt",
              "Comb_Sc", "Rank_State", "Burden_Pct", "Vulner_Pct", "Energy_Aff"]


def index_geom_2020(path):
    g = json.load(open(path))
    out = {}
    for feat in g["features"]:
        gid = str(feat["properties"].get("GEOID", "")).zfill(11)
        out[gid] = feat
    return out


def index_geom_2010(path):
    g = json.load(open(path))
    out = {}
    for feat in g["features"]:
        p = feat["properties"]
        geo_id = p.get("GEO_ID", "")
        if geo_id.startswith("1400000US"):          # e.g. 1400000US36061004500
            gid = geo_id[9:]
        else:
            gid = (p.get("STATE", "") + p.get("COUNTY", "") + p.get("TRACT", "")).zfill(11)
        out[gid] = feat
    return out


def index_dac(path):
    g = json.load(open(path))
    return {str(f["properties"].get("GEOID", "")).zfill(11): f["properties"]
            for f in g["features"]}


def load_excel(path):
    """Read a Con Edison extract (sheet 'Export'). First column = GEOID;
    other columns matched by header name so column order doesn't matter."""
    wb = openpyxl.load_workbook(path, data_only=True)
    ws = wb["Export"]
    rows = list(ws.iter_rows(values_only=True))
    header = [str(h).strip().lower() if h is not None else "" for h in rows[0]]

    def col(name):
        name = name.lower()
        return header.index(name) if name in header else None

    ci_cls = col("DAC Indicator")
    ci_acc = col("Total Accts")
    ci_eap = col("Total EAP Accts")
    ci_adj = col("Total Adjustment")

    out = {}
    for r in rows[1:]:
        gid = r[0]                                   # GEOID is the first column
        if gid in (None, ""):
            continue
        gid = str(gid).strip().zfill(11)
        out[gid] = {
            "class": r[ci_cls] if ci_cls is not None else None,
            "accts": r[ci_acc] if ci_acc is not None else None,
            "eap":   r[ci_eap] if ci_eap is not None else None,
            "adj":   r[ci_adj] if ci_adj is not None else None,
        }
    return out


def main():
    geom_2020 = index_geom_2020(IN_2020)
    geom_2010 = index_geom_2010(IN_2010)
    dac       = index_dac(IN_DAC)
    elec      = load_excel(IN_ELEC)
    gas       = load_excel(IN_GAS)

    # Universe = every GEOID that has Electric OR Gas data OR is a DAC tract,
    # restricted to the six Con Edison counties.
    all_gids = {g for g in (set(elec) | set(gas) | set(dac)) if g[:5] in CONED_FIPS}

    features, n2020, n2010, nogeom = [], 0, 0, 0
    for gid in sorted(all_gids):
        if gid in geom_2020:
            geom, geom_year = geom_2020[gid], 2020; n2020 += 1
        elif gid in geom_2010:
            geom, geom_year = geom_2010[gid], 2010; n2010 += 1
        else:
            nogeom += 1
            continue  # no geometry in either vintage -> cannot be drawn

        dp = dac.get(gid, {})
        e  = elec.get(gid, {})
        g  = gas.get(gid, {})
        is_dac = bool(dp) or e.get("class") == "DAC" or g.get("class") == "DAC"

        props = {"GEOID": gid, "County": COUNTY_NAMES.get(gid[2:5])}
        for f in DAC_FIELDS:
            props[f] = dp.get(f)
        props["DAC_Desig"] = "Designated as DAC" if is_dac else "Non-DAC"
        props.update({
            "elec_dac": e.get("class"), "elec_accts": e.get("accts"),
            "elec_eap": e.get("eap"),   "elec_adj":  e.get("adj"),
            "gas_dac":  g.get("class"), "gas_accts": g.get("accts"),
            "gas_eap":  g.get("eap"),   "gas_adj":   g.get("adj"),
            "_geom_year": geom_year,
        })
        features.append({"type": "Feature", "geometry": geom["geometry"], "properties": props})

    # Non-DAC borough roll-up (averages + sums per county per utility)
    nondac_by_county = defaultdict(lambda: {"electric": None, "gas": None})
    for utility, src in (("electric", elec), ("gas", gas)):
        agg = defaultdict(lambda: {"n": 0, "accts": 0, "eap": 0, "adj": 0.0})
        for gid, row in src.items():
            if row["class"] != "Non-DAC":
                continue
            cname = COUNTY_NAMES.get(gid[2:5])
            if not cname:
                continue
            a = agg[cname]
            a["n"] += 1
            a["accts"] += row["accts"] or 0
            a["eap"]   += row["eap"]   or 0
            a["adj"]   += row["adj"]   or 0.0
        for cname, a in agg.items():
            n = a["n"]
            if not n:
                continue
            nondac_by_county[cname][utility] = {
                "n_tracts": n,
                "avg_accts": round(a["accts"] / n, 1),
                "avg_eap":   round(a["eap"]   / n, 1),
                "avg_adj":   round(a["adj"]   / n, 2),
                "sum_accts": a["accts"],
                "sum_eap":   a["eap"],
                "sum_adj":   round(a["adj"], 2),
            }

    payload = {"type": "FeatureCollection",
               "nondac_by_county": dict(nondac_by_county),
               "features": features}
    with open(OUT, "w") as f:
        json.dump(payload, f, separators=(",", ":"))

    dac_n = sum(1 for x in features if x["properties"]["DAC_Desig"] == "Designated as DAC")
    print(f"geometry: {n2020} via 2020, {n2010} via 2010 (fallback), {nogeom} dropped (no geometry)")
    print(f"features: {len(features)}  ({dac_n} DAC + {len(features) - dac_n} Non-DAC)")
    print(f"elec_accts total: {sum(x['properties']['elec_accts'] or 0 for x in features):,}")
    print(f"gas_accts total:  {sum(x['properties']['gas_accts'] or 0 for x in features):,}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
