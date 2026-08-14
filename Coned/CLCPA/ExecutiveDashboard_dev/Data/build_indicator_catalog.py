"""Generate Data/indicator_catalog.json -- the indicator catalogue, frozen.

Run ONCE. The output is committed and shipped; this script exists so the file has
a recorded origin rather than appearing from nowhere.

WHY THIS FILE EXISTS
--------------------
convert_nyserda_raw.py builds the dataset manifest's group and item list by
PARSING it out of app.js -- `const MAP_INDICATOR_GROUPS` -- so that the manifest
provably matched the dashboard as shipped. That was a good property and it had a
cost: the entire 800 KB application had to travel inside the operator package to
supply a list of 56 indicator names, and guide 1 had to carry a bold paragraph
explaining that app.js was not optional.

Slice 5d then retired MAP_INDICATOR_GROUPS. The live dataset became the only
source of truth for the catalogue, which was the right change for the app and
broke the converter outright:

    ValueError: substring not found   (src.index("const MAP_INDICATOR_GROUPS"))

So the catalogue is frozen here instead. The converter reads this file, app.js
leaves the package, and the guarantee that mattered is kept in a different way:
the file records WHICH app.js it came from, by sha256, so a manifest built from it
can be traced to the build whose UI it matched.

WHAT IT IS GENERATED FROM
-------------------------
An app.js from BEFORE slice 5d, since that is the last build containing the
literal. Extract one and point this script at it:

    git show 1d4a5f9:Coned/CLCPA/ExecutiveDashboard_dev/app.js > /tmp/app_pre5d.js
    python Data/build_indicator_catalog.py --app-js /tmp/app_pre5d.js

`1d4a5f9` is the slice-7b merge, the last commit before 5d. Any commit before
`83fd0b1` carries the literal.

WHY FREEZING IS SAFE HERE, WHICH IS NOT OBVIOUS
-----------------------------------------------
Freezing a copy of something that can drift is usually a trap. It is safe here
because the thing it described no longer exists to drift FROM: after 5d the app
carries no catalogue of its own, and the live dataset's own manifest is what
drives the UI. This file feeds the CONVERTER, so a future NYSERDA release that
adds or renames an indicator is handled by editing this file and rebuilding --
which is the same action that was previously needed in app.js, in one obvious
place instead of buried in an 800 KB script.

Run:  python Data/build_indicator_catalog.py --app-js PATH [--force]
"""
import argparse
import hashlib
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
# Layout-agnostic paths. In the repository this script lives in Data/; in the Con
# Edison handoff package it sits at the package root with Data/ beside it.
DATA = HERE if os.path.basename(HERE) == "Data" else os.path.join(HERE, "Data")
ROOT = os.path.dirname(DATA)
OUT = os.path.join(DATA, "indicator_catalog.json")
SCHEMA = 1


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--app-js", required=True,
                    help="path to an app.js from BEFORE slice 5d (it must still "
                         "contain const MAP_INDICATOR_GROUPS)")
    ap.add_argument("--source-ref", default="",
                    help="the git ref the app.js came from, recorded in provenance")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    if os.path.exists(OUT) and not a.force:
        sys.exit("REFUSED: %s already exists.\n"
                 "  It is generated once and committed. Pass --force only if you mean to\n"
                 "  replace it." % os.path.relpath(OUT, ROOT))
    if not os.path.exists(a.app_js):
        sys.exit("REFUSED: %s is not a file." % a.app_js)

    # The parser is IMPORTED from build_tract_dataset rather than reimplemented.
    # Two copies of a regex that reads a JS literal is exactly how the frozen file
    # would stop matching what the converter expects.
    sys.path.insert(0, HERE)
    sys.dont_write_bytecode = True
    import build_tract_dataset as BTD    # noqa: E402

    try:
        groups = BTD.parse_indicator_catalog(a.app_js)
    except ValueError:
        sys.exit("REFUSED: %s does not contain `const MAP_INDICATOR_GROUPS`.\n"
                 "  Slice 5d removed it, so this must be an app.js from before that\n"
                 "  slice. Extract one with:\n"
                 "    git show 1d4a5f9:Coned/CLCPA/ExecutiveDashboard_dev/app.js > app_pre5d.js"
                 % a.app_js)

    src_sha = sha256(a.app_js)
    items = [it for g in groups for it in g["items"]]
    doc = {
        "schema": SCHEMA,
        "kind": "indicator_catalog",
        "provenance": {
            "generatedBy": "Data/build_indicator_catalog.py",
            "derivedFrom": "app.js, const MAP_INDICATOR_GROUPS",
            "derivedFromSha256": src_sha,
            "derivedFromBytes": os.path.getsize(a.app_js),
            "derivedFromRef": a.source_ref,
            "note": "Parsed out of an app.js from BEFORE slice 5d, which retired the "
                    "MAP_INDICATOR_GROUPS literal. The converter reads this file "
                    "instead, which is what lets app.js stay out of the operator "
                    "package. A future NYSERDA release that adds or renames an "
                    "indicator is handled by editing this file and rebuilding.",
            "usedBy": "convert_nyserda_raw.py, via "
                      "build_tract_dataset.load_indicator_catalog(), to build the "
                      "dataset manifest's group and item list.",
        },
        "groups": groups,
    }
    with open(OUT, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)

    print("=" * 70)
    print("INDICATOR CATALOG")
    print("=" * 70)
    print("  source     : %s" % a.app_js)
    print("               %d bytes, sha256 %s" % (os.path.getsize(a.app_js), src_sha))
    if a.source_ref:
        print("  git ref    : %s" % a.source_ref)
    print("  groups     : %d" % len(groups))
    for g in groups:
        print("    %-34s %d item(s)" % (g["label"], len(g["items"])))
    print("  indicators : %d" % len(items))
    print("  output     : %s (%d bytes)"
          % (os.path.relpath(OUT, ROOT), os.path.getsize(OUT)))
    print("")
    print("  Nothing reads app.js after this.")
    print("=" * 70)


if __name__ == "__main__":
    main()
