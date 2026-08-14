"""check_coned_equivalence.py -- the coned_operational dataset carries exactly
what map_payload.json carries, for all 2,333 tracts and all eight fields.

This is the acceptance bar slice 1 set and every family since has had to clear:
moving data out of the payload must change nothing on screen. Here that reduces
to a value-for-value comparison, so it is checkable rather than argued.

Committed for the same reason as check_hidden_guard.js, check_crosswalk_resolution.py
and check_territory_coupling.py: no browser, no dependency the builder does not
already have.

The comparison is EXACT. The adjustment columns carry 14-15 decimals and the
payload stores them at that precision, so there is no tolerance to choose -- and
choosing one is how a converter that quietly rounds gets signed off. If this file
ever needs a tolerance, that is a finding, not a fix.

Run:  python Data/check_coned_equivalence.py
Exits non-zero on failure.
"""
import copy
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.dont_write_bytecode = True

_spec = importlib.util.spec_from_file_location(
    "build_coned_dataset", os.path.join(HERE, "build_coned_dataset.py"))
B = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(B)

passed = failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  PASS  " + name)
    else:
        failed += 1
        d = str(detail).replace("\n", " | ")
        print("  FAIL  " + name + ("  <- " + d[:200] if detail else ""))


DS_PATH = os.path.join(HERE, "out", "coned_operational_v1_0-2010.json")
PAY_PATH = os.path.join(ROOT, "map_payload.json")
GEO_PATH = os.path.join(HERE, "out", "tract_geometry_pure-2010.json")

for p in (DS_PATH, PAY_PATH, GEO_PATH):
    if not os.path.exists(p):
        sys.exit("missing %s -- run build_coned_dataset.py first" % os.path.relpath(p, ROOT))

ds = json.load(open(DS_PATH, encoding="utf-8"))
pay = json.load(open(PAY_PATH, encoding="utf-8"))
geo = json.load(open(GEO_PATH, encoding="utf-8"))

pay_by_geoid = {f["properties"]["GEOID"]: f["properties"] for f in pay["features"]}


def compare(dataset):
    """Every field, every tract, ==. Returns the list of disagreements."""
    bad = []
    gids = dataset["tracts"]["geoids"]
    for k in B.FIELDS:
        col = dataset["tracts"]["fields"][k]
        for i, gid in enumerate(gids):
            want = pay_by_geoid.get(gid, {}).get(k)
            got = col[i]
            if got != want:
                bad.append((gid, k, got, want))
                if len(bad) > 40:
                    return bad
    return bad


print("== 1. manifest shape ==")
check("schema is 1", ds.get("schema") == 1, ds.get("schema"))
check("kind is coned", ds.get("kind") == "coned", ds.get("kind"))
check("dataset.key is coned_operational",
      ds["dataset"]["key"] == "coned_operational", ds["dataset"]["key"])
check("it declares a GEOID vintage", bool(ds["dataset"].get("geoidVintage")),
      ds["dataset"].get("geoidVintage"))
check("GEOID is not also a field column", "GEOID" not in ds["tracts"]["fields"],
      list(ds["tracts"]["fields"])[:10])
check("it carries exactly the eight payload keys",
      sorted(ds["tracts"]["fields"]) == sorted(B.FIELDS),
      sorted(ds["tracts"]["fields"]))
n = len(ds["tracts"]["geoids"])
check("every column aligns to the geoids",
      all(len(v) == n for v in ds["tracts"]["fields"].values()),
      {k: len(v) for k, v in ds["tracts"]["fields"].items()})

print("\n== 2. the tract universe is the GEOMETRY's, not the payload's ==")
# The point of taking the universe from the geometry dataset is that this file
# does not depend on the one it exists to replace. That it ALSO equals the
# payload's universe is what makes the comparison below total.
check("the geoids are the geometry dataset's, in order",
      ds["tracts"]["geoids"] == geo["tracts"]["geoids"])
check("and they cover the payload exactly",
      set(ds["tracts"]["geoids"]) == set(pay_by_geoid),
      {"only_ds": len(set(ds["tracts"]["geoids"]) - set(pay_by_geoid)),
       "only_pay": len(set(pay_by_geoid) - set(ds["tracts"]["geoids"]))})

print("\n== 3. equivalence: every field, every tract ==")
bad = compare(ds)
check("all eight fields equal map_payload.json for all %d tracts" % n,
      not bad, bad[:6])
for k in B.FIELDS:
    got = sum(1 for v in ds["tracts"]["fields"][k] if v is not None)
    want = sum(1 for g in ds["tracts"]["geoids"]
               if pay_by_geoid.get(g, {}).get(k) is not None)
    check("  %-11s non-null count matches (%d)" % (k, want), got == want,
          {"dataset": got, "payload": want})

print("\n== 4. precision is carried, not rounded ==")
adj = [v for v in ds["tracts"]["fields"]["elec_adj"] if isinstance(v, float)]
deep = [v for v in adj if len(repr(v).split(".")[-1]) > 8]
check("adjustment values keep more than 8 decimals", len(deep) > 1000, len(deep))
sample = deep[0] if deep else None
check("and a deep value is byte-equal to the payload's",
      sample is not None and any(
          pay_by_geoid[g].get("elec_adj") == sample
          for g in ds["tracts"]["geoids"]
          if pay_by_geoid.get(g, {}).get("elec_adj") == sample),
      repr(sample))

print("\n== 5. what the spreadsheets carry and this file refuses ==")
gids = set(ds["tracts"]["geoids"])
check("no geoid is anything but 11 digits",
      all(B.looks_like_geoid(g) for g in ds["tracts"]["geoids"]),
      [g for g in ds["tracts"]["geoids"] if not B.looks_like_geoid(g)][:4])
check("the 'Applied filters:' footer never became a tract",
      not any("Applied" in str(g) for g in ds["tracts"]["geoids"]))
elec = B._bbmp.load_excel(B.IN_ELEC)
footer = [g for g in elec if not B.looks_like_geoid(g)]
check("...and the footer IS present in the raw spreadsheet, so that is a real exclusion",
      len(footer) == 1, footer)
putnam = sorted(g for g in elec if B.looks_like_geoid(g) and g.startswith("36079"))
check("the four Putnam tracts are in the spreadsheet", len(putnam) == 4, putnam)
check("...and none of them is in the dataset", not (set(putnam) & gids), putnam)

print("\n== 6. the fingerprint ==")
fp = ds["dataset"].get("sourceFingerprint")
check("a 64-char fingerprint is stamped", isinstance(fp, str) and len(fp) == 64, fp)
check("it recomputes from the spreadsheets on disk", fp == B.source_fingerprint(), fp)
check("the manifest says WHAT was hashed",
      ds["dataset"].get("sourceFingerprintOf") == "Electric.xlsx, Gas.xlsx",
      ds["dataset"].get("sourceFingerprintOf"))
check("it is NOT the shapefile fingerprint the other two families carry",
      fp != geo["dataset"].get("sourceFingerprint"),
      {"coned": str(fp)[:16], "geometry": str(geo["dataset"].get("sourceFingerprint"))[:16]})

print("\n== 7. NEGATIVE CONTROLS: the comparison must be able to fail ==")
mut = copy.deepcopy(ds)
i = next(j for j, v in enumerate(mut["tracts"]["fields"]["elec_accts"]) if v is not None)
mut["tracts"]["fields"]["elec_accts"][i] += 1
check("a single changed account count is caught", bool(compare(mut)),
      "mutating one value produced no disagreement")

mut2 = copy.deepcopy(ds)
j = next(k for k, v in enumerate(mut2["tracts"]["fields"]["elec_adj"])
         if isinstance(v, float))
mut2["tracts"]["fields"]["elec_adj"][j] = round(mut2["tracts"]["fields"]["elec_adj"][j], 4)
check("rounding ONE adjustment to 4dp is caught (the tolerance trap)",
      bool(compare(mut2)),
      "4dp rounding slipped through, so the comparison is not exact")

mut3 = copy.deepcopy(ds)
mut3["tracts"]["fields"]["gas_dac"][0] = "DAC" if mut3["tracts"]["fields"]["gas_dac"][0] != "DAC" else "Non-DAC"
check("a flipped DAC class is caught", bool(compare(mut3)))

print("\n" + ("ALL PASS " if not failed else "FAILED ") +
      "%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
