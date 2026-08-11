"""check_crosswalk_resolution.py -- NTA crosswalk file resolution, both vintages.

Committed for the same reason as check_hidden_guard.js: it needs no browser and
no dependency the builder does not already have, so it can live in the repo and
keep failing long after a scratch harness would have been deleted.

Written BEFORE the fix it guards, so these are the bug reproduced rather than a
description of it. Against the pre-fix builder: 4 passed, 6 failed.

The bug: CROSSWALK_2020 was a hardcoded filename ending _20260601.csv while the
2010 table was resolved by prefix. Stage a freshly downloaded hm78-6dwm as
..._20260810.csv and the builder silently kept using the June file -- no error,
a dataset labelled with a crosswalk it did not use. Measured: with a 4-row file
staged, the loader returned 2,327 rows from the repo copy.

And the 2010 resolver, which did resolve by prefix, returned the FIRST match in
sorted order, so two exports in Data/ silently picked one.

Run:  python Data/check_crosswalk_resolution.py     (or from Data/)
Exits non-zero on failure, so it works as a pre-commit or CI step.
"""
import csv
import io
import os
import shutil
import sys
import tempfile

# Beside the module it tests, so this runs from a clone with no configuration.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import build_pure_geometry_dataset as B          # noqa: E402

passed = failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  PASS  " + name)
    else:
        failed += 1
        # Truncated: a failing load returns the whole 2,327-entry mapping and it
        # buried the actual result under 264KB of dict on the first run.
        d = str(detail).replace("\n", " ")
        if len(d) > 150:
            d = d[:150] + "... (truncated)"
        print("  FAIL  " + name + ("  <- " + d if detail else ""))


def write_2020(path, rows=3):
    with io.open(path, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["GEOID", "NTAName"])
        for i in range(rows):
            w.writerow(["3606100%04d" % i, "Test NTA %d" % i])


def write_2010(path, rows=3):
    with io.open(path, "w", encoding="utf-8-sig", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["2010 Census Bureau FIPS County Code", "2010 Census Tract",
                    "Neighborhood Tabulation Area (NTA) Name"])
        for i in range(rows):
            w.writerow(["61", "%d" % (10000 + i), "Legacy NTA %d" % i])


def with_dir(fn):
    """Run fn(tmp) with B.HERE pointed at a fresh temp dir."""
    tmp = tempfile.mkdtemp(prefix="xwalk_")
    orig = B.HERE
    try:
        B.HERE = tmp
        return fn(tmp)
    finally:
        B.HERE = orig
        shutil.rmtree(tmp, ignore_errors=True)


def call(vintage):
    """load_neighborhoods, returning ('ok', mapping, provenance) or ('exit', msg)."""
    try:
        mapping, prov = B.load_neighborhoods(vintage)
        return ("ok", mapping, prov)
    except SystemExit as e:
        return ("exit", str(e))
    except Exception as e:                       # noqa: BLE001
        return ("raise", type(e).__name__ + ": " + str(e))


print("== 1. 2020: a differently dated file must be the one used ==")


def t1(tmp):
    write_2020(os.path.join(tmp, "2020_Census_Tracts_to_2020_NTAs_and_CDTAs_"
                                 "Equivalency_20260810.csv"), rows=4)
    return call("2020")


r = with_dir(t1)
check("a 2020 crosswalk with a later date suffix resolves", r[0] == "ok", r)
if r[0] == "ok":
    check("it is the staged file that was read (4 rows)", len(r[1]) == 4, len(r[1]))
    check("the provenance names the file actually used",
          "20260810" in r[2], r[2])

print("\n== 2. 2020: two matching files is an ERROR, not a silent pick ==")


def t2(tmp):
    write_2020(os.path.join(tmp, "2020_Census_Tracts_to_2020_NTAs_and_CDTAs_"
                                 "Equivalency_20260601.csv"), rows=2)
    write_2020(os.path.join(tmp, "2020_Census_Tracts_to_2020_NTAs_and_CDTAs_"
                                 "Equivalency_20260810.csv"), rows=5)
    return call("2020")


r = with_dir(t2)
check("two 2020 crosswalks refuse to build", r[0] == "exit", r)
if r[0] == "exit":
    check("the refusal names both files",
          "20260601" in r[1] and "20260810" in r[1], r[1])

print("\n== 3. 2010: two matching files is an ERROR too ==")


def t3(tmp):
    write_2010(os.path.join(tmp, "2010_Census_Tract_to_Neighborhood_Tabulation_"
                                 "Area_Equivalency_table_20260806.csv"), rows=2)
    write_2010(os.path.join(tmp, "2010_Census_Tract_to_Neighborhood_Tabulation_"
                                 "Area_Equivalency_table_20260901.csv"), rows=5)
    return call("2010")


r = with_dir(t3)
check("two 2010 crosswalks refuse to build", r[0] == "exit", r)
if r[0] == "exit":
    check("the refusal names both files",
          "20260806" in r[1] and "20260901" in r[1], r[1])

print("\n== 4. the single-file cases still work (regression) ==")


def t4(tmp):
    write_2010(os.path.join(tmp, "2010_Census_Tract_to_Neighborhood_Tabulation_"
                                 "Area_Equivalency_table_20260806.csv"), rows=3)
    return call("2010")


r = with_dir(t4)
check("one 2010 crosswalk resolves and loads", r[0] == "ok" and len(r[1]) == 3, r)


def t5(tmp):
    write_2020(os.path.join(tmp, "2020_Census_Tracts_to_2020_NTAs_and_CDTAs_"
                                 "Equivalency_20260601.csv"), rows=3)
    return call("2020")


r = with_dir(t5)
check("one 2020 crosswalk resolves and loads", r[0] == "ok" and len(r[1]) == 3, r)

print("\n== 5. missing file: a precise refusal naming the portal id ==")

r = with_dir(lambda tmp: call("2010"))
check("missing 2010 table exits", r[0] == "exit", r)
if r[0] == "exit":
    check("names the 2010 portal id 8ius-dhrr", "8ius-dhrr" in r[1], r[1][:120])

r = with_dir(lambda tmp: call("2020"))
check("missing 2020 table exits cleanly, not a traceback", r[0] == "exit", r)
if r[0] == "exit":
    check("names the 2020 portal id hm78-6dwm", "hm78-6dwm" in r[1], r[1][:120])

print("\n" + ("ALL PASS " if not failed else "FAILED ") +
      "%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
