"""check_territory_coupling.py -- the two-outputs coupling, and that a mismatch is
CAUGHT rather than merely representable.

Committed for the same reason as check_hidden_guard.js and
check_crosswalk_resolution.py: it needs no browser and no dependency the builder
does not already have, so it can live in the repo and keep failing long after a
scratch harness would have been deleted.

The coupling: the CECONY electric+gas shapefiles feed BOTH the per-tract
electric_networks / gas_areas in build_pure_geometry_dataset.py AND the
service_territories.geojson overlay from _make_territories.py. Rebuild one and not
the other and the outlines on screen disagree with the tooltip numbers, silently.

Before slice 6c that was checked by comparing MTIMES and printing a WARNING. Both
halves were weak: an mtime survives a copy, a checkout or a touch without meaning
anything, and a warning in a terminal is not a control.

The graduated rule under test:

    overlay missing          -> note, no refusal (the map draws no outlines)
    overlay carries NO stamp -> warn, no refusal (predates 6c, unverifiable)
    stamp DISAGREES          -> REFUSE (this is the trap, caught)

Run:  python Data/check_territory_coupling.py     (or from Data/)
Exits non-zero on failure, so it works as a pre-commit or CI step.
"""
import json
import os
import shutil
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
sys.dont_write_bytecode = True
import build_pure_geometry_dataset as B          # noqa: E402

passed = failed = 0


def check(name, cond, detail=""):
    global passed, failed
    if cond:
        passed += 1
        print("  PASS  " + name)
    else:
        failed += 1
        d = str(detail).replace("\n", " | ")
        print("  FAIL  " + name + ("  <- " + d[:180] if detail else ""))


def write_overlay(path, fingerprint):
    doc = {"type": "FeatureCollection", "features": []}
    if fingerprint is not None:
        doc["sourceFingerprint"] = fingerprint
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh)


def run_case(label, fingerprint_in_overlay, computed, overlay_exists=True):
    """Call assert_territories_match() against a temp overlay, returning
    ('exit', message) or ('ok', None). B.HERE is redirected so the real overlay is
    never touched; the hash function is stubbed so the comparison logic is what is
    under test rather than the hashing."""
    tmp = tempfile.mkdtemp(prefix="terr_")
    orig_here, orig_fp = B.HERE, B.coned_source_fingerprint
    try:
        B.HERE = tmp
        B.coned_source_fingerprint = lambda: computed
        if overlay_exists:
            write_overlay(os.path.join(tmp, "service_territories.geojson"),
                          fingerprint_in_overlay)
        try:
            B.assert_territories_match()
            return ("ok", None)
        except SystemExit as e:
            return ("exit", str(e))
    finally:
        B.HERE, B.coned_source_fingerprint = orig_here, orig_fp
        shutil.rmtree(tmp, ignore_errors=True)


print("== 1. the fingerprint itself ==")
fp = B.coned_source_fingerprint()
check("a fingerprint is produced from the real shapefiles",
      isinstance(fp, str) and len(fp) == 64, fp)
check("it is stable across calls", fp == B.coned_source_fingerprint())
check("ORU is NOT part of it (it feeds only the overlay)",
      all("ORU" not in os.path.basename(b) for b in (B.ELEC, B.GAS)),
      [B.ELEC, B.GAS])

print("\n== 2. the graduated rule ==")
r = run_case("mismatch", "a" * 64, "b" * 64)
check("a DISAGREEING stamp REFUSES", r[0] == "exit", r)
if r[0] == "exit":
    check("the refusal names both fingerprints",
          "a" * 16 in r[1] and "b" * 16 in r[1], r[1][:120])
    check("and it names the command that fixes it",
          "--refresh-territories" in r[1], r[1][-140:])

r = run_case("absent stamp", None, "b" * 64)
check("an UNSTAMPED overlay warns but does not refuse", r[0] == "ok", r)

r = run_case("agreeing", "c" * 64, "c" * 64)
check("an AGREEING stamp passes silently", r[0] == "ok", r)

r = run_case("missing overlay", None, "b" * 64, overlay_exists=False)
check("a MISSING overlay notes but does not refuse", r[0] == "ok", r)

r = run_case("no shapefiles", "c" * 64, None)
check("an uncomputable fingerprint does not refuse either", r[0] == "ok", r)

print("\n== 3. the live artifacts agree with each other ==")
# Not a tautology: these are two files written by two different producers, and the
# whole slice exists because they could disagree.
live_terr = B.territory_fingerprint()
check("the shipped overlay carries a stamp", isinstance(live_terr, str), live_terr)
check("and it matches the shapefiles on disk", live_terr == fp,
      "overlay %s vs shapefiles %s" % (str(live_terr)[:16], str(fp)[:16]))

out = os.path.join(B.HERE, "out", "tract_geometry_pure-2010.json")
if os.path.exists(out):
    with open(out, encoding="utf-8") as fh:
        ds = json.load(fh)
    dfp = (ds.get("dataset") or {}).get("sourceFingerprint")
    check("the built geometry dataset carries the same stamp", dfp == fp,
          "dataset %s vs shapefiles %s" % (str(dfp)[:16], str(fp)[:16]))
else:
    print("  SKIP  no built dataset in Data/out to compare")

print("\n" + ("ALL PASS " if not failed else "FAILED ") +
      "%d passed, %d failed" % (passed, failed))
sys.exit(1 if failed else 0)
