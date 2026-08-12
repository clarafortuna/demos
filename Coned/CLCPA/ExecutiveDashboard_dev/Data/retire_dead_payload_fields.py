"""retire_dead_payload_fields.py -- remove the two dead fields from
map_payload.json, in place, and prove nothing else changed.

    python Data/retire_dead_payload_fields.py            # report only
    python Data/retire_dead_payload_fields.py --write    # do it

WHY SURGERY AND NOT A REBUILD
-----------------------------
map_payload.json is not reproducible from its own pipeline. MAP_PAYLOAD_DIVERGENCE.md
(slice 5a) measured it: 69 of 73 properties rebuild exactly, but City_Town comes
out null on the 1,274 Non-DAC tracts because DAC_FIELDS are copied from
NYS_DAC.geojson, which holds DAC tracts only. The live values are a county fill
that exists in no committed script, and 116 Westchester neighborhood values are
derived from them.

So the file cannot be regenerated to remove a field. It has to be edited, and the
edit has to be provably surgical. Hence this script: it removes exactly two keys,
then asserts that every other byte of meaning is untouched.

WHAT IS REMOVED, AND WHY IT IS SAFE
-----------------------------------
  hvi                 per tract. Read at exactly one place in app.js:
                        const hviList = SHOW_TRACT_HVI_LINE ? p.hvi : null;
                      SHOW_TRACT_HVI_LINE is false, so the ternary never even
                      evaluates p.hvi. Heat Vulnerability is a saved map layer
                      now, carrying its own provenance, and the property was
                      already removed from the geometry pipeline (9 fields -> 8).

  nondac_by_county    root block. One occurrence in app.js, inside
                      dsApplyGeometryToGeo, where it is copied onto the new
                      FeatureCollection so a geometry swap does not drop it.
                      Nothing reads it back, and payload.json -- the dashboard's
                      separate data file, which feeds the borough charts -- does
                      not contain it at all.

Idempotent: running it twice removes nothing the second time and says so.

VERIFICATION
------------
Every feature is compared property by property against the original. The only
permitted differences are the absence of `hvi` and the absence of the root block.
Anything else aborts before the file is written.
"""
import io
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MAP = os.path.join(ROOT, "map_payload.json")

DEAD_PROPERTY = "hvi"
DEAD_ROOT_KEY = "nondac_by_county"


def main():
    write = "--write" in sys.argv
    before_bytes = os.path.getsize(MAP)
    with io.open(MAP, encoding="utf-8") as fh:
        mp = json.load(fh)

    feats = mp["features"]
    had_prop = sum(1 for f in feats if DEAD_PROPERTY in f["properties"])
    had_root = DEAD_ROOT_KEY in mp

    print("map_payload.json")
    print("  bytes            : %d" % before_bytes)
    print("  features         : %d" % len(feats))
    print("  tracts with %-4s : %d" % (DEAD_PROPERTY, had_prop))
    print("  root %-16s: %s" % (DEAD_ROOT_KEY, "present" if had_root else "absent"))

    if not had_prop and not had_root:
        print("\nnothing to do: both are already gone.")
        return 0

    # Snapshot every property dict BEFORE touching anything, so the comparison
    # below is against what was actually there rather than against expectations.
    original = [dict(f["properties"]) for f in feats]

    for f in feats:
        f["properties"].pop(DEAD_PROPERTY, None)
    mp.pop(DEAD_ROOT_KEY, None)

    # ---- verification, before the write --------------------------------------
    problems = []
    for i, f in enumerate(feats):
        was, now = original[i], f["properties"]
        expected = {k: v for k, v in was.items() if k != DEAD_PROPERTY}
        if now != expected:
            gained = sorted(set(now) - set(expected))
            lost = sorted(set(expected) - set(now))
            changed = [k for k in set(now) & set(expected) if now[k] != expected[k]]
            problems.append("feature %d (%s): gained %s, lost %s, changed %s"
                            % (i, was.get("GEOID"), gained, lost, changed[:4]))
        if len(problems) > 5:
            break
    leftover = [k for k in mp if k not in ("type", "features")]
    if leftover:
        problems.append("unexpected root keys remain: %s" % leftover)
    if len(feats) != len(original):
        problems.append("feature count changed: %d -> %d" % (len(original), len(feats)))

    if problems:
        print("\nABORTED, nothing written. The edit was not surgical:")
        for p in problems:
            print("  " + p)
        return 2

    print("\nverified: %d features differ from the original by the absence of %r"
          % (len(feats), DEAD_PROPERTY))
    print("          and nothing else; root keys are now %s" % sorted(mp.keys()))

    if not write:
        print("\nreport only. Pass --write to apply.")
        return 0

    with io.open(MAP, "w", encoding="utf-8", newline="") as fh:
        json.dump(mp, fh, separators=(",", ":"), ensure_ascii=False)
    after_bytes = os.path.getsize(MAP)
    print("\nwritten.")
    print("  bytes  : %d -> %d  (%+d, %.1f%%)"
          % (before_bytes, after_bytes, after_bytes - before_bytes,
             100.0 * (after_bytes - before_bytes) / before_bytes))
    print("  removed: %s from %d tracts, and the %s root block"
          % (DEAD_PROPERTY, had_prop, DEAD_ROOT_KEY))
    return 0


if __name__ == "__main__":
    sys.exit(main())
