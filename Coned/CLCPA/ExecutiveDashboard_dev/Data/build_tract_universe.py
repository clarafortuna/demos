"""Generate Data/tract_universe.json -- the tract universe and City_Town, frozen.

Run ONCE. The output is committed and shipped; this script exists so the file has
a recorded origin rather than appearing from nowhere.

WHY THIS FILE EXISTS
--------------------
build_pure_geometry_dataset.py needed exactly two things from map_payload.json:

    1. the set of GEOIDs that defines the tract universe
    2. City_Town per GEOID

That is 2,333 GEOIDs and 2,333 short strings -- about 100 KB of information -- and
it was being carried by a 4.8 MB file holding indicator values, account counts and
polygons the builder never touched. Worse, that file is Con Edison customer data,
so the handoff package could not be assembled without shipping customer figures to
satisfy a dependency on a list of tract numbers.

This file carries the two things and nothing else.

ONE FILE, NOT ONE PER VINTAGE
-----------------------------
The universe is vintage-INDEPENDENT. The builder intersects it with the Census
tract file for the vintage it is building, and the vintage-specific narrowing falls
out of that:

    2,333 universe GEOIDs INTERSECT the 2010 tract file -> 2,333
    2,333 universe GEOIDs INTERSECT the 2020 tract file -> 2,183

So a `tract_universe_2010.json` and a `tract_universe_2020.json` would hold
identical data under two names that claim otherwise, and the 219-GEOID difference
between the vintages would look like a property of the files instead of what it
is: 219 tracts that exist under 2010 numbering and not under 2020. Encoding the
vintage in the filename would be a lie about where that difference comes from.

WHAT IS FROZEN HERE CANNOT BE REGENERATED, AND THAT IS THE POINT
---------------------------------------------------------------
City_Town is copied from map_payload.json as it stands, NOT rebuilt from its
pipeline, because rebuilding it does not reproduce it. MAP_PAYLOAD_DIVERGENCE.md
measured this: re-running the payload build returns City_Town as null on the 1,274
Non-DAC tracts, since the values are copied from a DAC-only source. The live values
are a county fill that exists in no committed script, and 116 Westchester
neighborhood names are derived from them.

So this file is not a convenience copy. It is the only durable record of values
that no script can produce again, and its provenance block says so. Deleting
map_payload.json without extracting this first would have lost them.

Run:  python Data/build_tract_universe.py [--force]
"""
import argparse
import hashlib
import json
import os
import sys
from datetime import datetime, timezone

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "map_payload.json")
OUT = os.path.join(HERE, "tract_universe.json")
SCHEMA = 1


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true",
                    help="overwrite an existing tract_universe.json")
    a = ap.parse_args()

    if os.path.exists(OUT) and not a.force:
        sys.exit("REFUSED: %s already exists.\n"
                 "  It is generated once and committed. Regenerating it from a DIFFERENT\n"
                 "  map_payload.json would silently change the tract universe every build\n"
                 "  reads. Pass --force only if you mean to replace it."
                 % os.path.relpath(OUT, ROOT))

    if not os.path.exists(SRC):
        sys.exit("REFUSED: %s is not here.\n"
                 "  This script is the ONE step that still needs it. Once tract_universe.json\n"
                 "  exists, nothing reads map_payload.json again -- which is what allows it to\n"
                 "  be deleted and kept out of the handoff package."
                 % os.path.relpath(SRC, ROOT))

    src_sha = sha256(SRC)
    with open(SRC, encoding="utf-8") as fh:
        payload = json.load(fh)

    tracts = {}
    dupes = []
    for f in payload.get("features", []):
        p = f.get("properties") or {}
        gid = p.get("GEOID")
        if gid is None:
            continue
        gid = str(gid)
        if gid in tracts:
            dupes.append(gid)
            continue
        tracts[gid] = p.get("City_Town")
    if dupes:
        sys.exit("REFUSED: %d duplicate GEOID(s) in the source, first %s. The universe must "
                 "be a set." % (len(dupes), dupes[0]))

    geoids = sorted(tracts)
    doc = {
        "schema": SCHEMA,
        "kind": "tract_universe",
        "provenance": {
            "generatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            "generatedBy": "Data/build_tract_universe.py",
            "derivedFrom": "map_payload.json",
            "derivedFromSha256": src_sha,
            "derivedFromBytes": os.path.getsize(SRC),
            "note": "City_Town is COPIED, not rebuilt. Re-running the payload pipeline "
                    "returns City_Town as null on the 1,274 Non-DAC tracts, because the "
                    "values are copied there from a DAC-only source; the live values are a "
                    "county fill that exists in no committed script, and 116 Westchester "
                    "neighborhood names derive from them. See "
                    "Data/out/MAP_PAYLOAD_DIVERGENCE.md. This file is the only durable "
                    "record of those values.",
            "usedBy": "build_pure_geometry_dataset.py, for the tract universe and City_Town. "
                      "The universe is vintage-independent: the builder intersects it with "
                      "the Census tract file for the vintage being built (2,333 for 2010, "
                      "2,183 for 2020), so one file serves both.",
        },
        "tracts": {
            "geoids": geoids,
            "fields": {"City_Town": [tracts[g] for g in geoids]},
        },
    }

    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, separators=(",", ":"), ensure_ascii=False)

    named = sum(1 for g in geoids if tracts[g])
    print("=" * 70)
    print("TRACT UNIVERSE")
    print("=" * 70)
    print("  source     : %s" % os.path.relpath(SRC, ROOT))
    print("               %d bytes, sha256 %s" % (os.path.getsize(SRC), src_sha))
    print("  GEOIDs     : %d" % len(geoids))
    print("  City_Town  : %d named, %d blank" % (named, len(geoids) - named))
    print("  output     : %s (%d bytes, %.1f%% of the source)"
          % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT),
             100.0 * os.path.getsize(OUT) / os.path.getsize(SRC)))
    print("")
    print("  Nothing reads map_payload.json after this.")
    print("=" * 70)


if __name__ == "__main__":
    main()
