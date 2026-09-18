"""Generate the four per-family operator notebooks that ship in notebooks/.

WHY A GENERATOR AND NOT FOUR HAND-WRITTEN FILES
-----------------------------------------------
The four notebooks share five of their six cells: the same package discovery,
the same integrity check against MANIFEST.txt, the same pip install, the same
run helper, the same verification shape. Hand-written, they would drift apart,
and the one thing this package is being fixed for is prose that drifted away
from the code it describes.

They also embed README content -- the three-step execution order -- which is
generated in make_handoff_package.py. One generator per fact.

THE DESIGN RULE, FROM THE TICKET
--------------------------------
Notebooks are ORCHESTRATORS. They call the shipped scripts through subprocess
and reimplement nothing, so a notebook run and a terminal run produce
byte-identical outputs. Nothing here parses a shapefile, projects a coordinate
or formats a dataset. Where a cell needs to know something about an output it
reads the output.

EXPECTED VALUES, AND WHY SOME ARE None
--------------------------------------
The verification cell compares what a run produced against expected values. Any
value here was MEASURED from a real build. Where no measurement exists the value
is None, and the cell records what it measured without pretending to compare --
an unmeasured number written into a table as though it were measured is the
defect this package was just audited for (finding F9).

Run:  python Coned/CLCPA/make_operator_notebooks.py
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "operator-notebooks")

# The three steps, in EXECUTION order, as the README states them. Embedded in
# every notebook header so a reader of any one of them sees the whole order.
STEPS = [
    ("Step 1", "docs/tract-shapes.docx, docs/territory-overlays.docx",
     "python scripts/update_map_data.py --vintage 2010",
     "tract shapes AND the territory overlay: one command, two outputs"),
    ("Step 2", "docs/dac-indicators.docx",
     "python scripts/convert_nyserda_raw.py --version 1.0 "
     "--geoid-vintage 2010 --raw-date 2023-03-27",
     "the DAC indicator dataset"),
    ("Step 3", "docs/electric-and-gas-figures.docx",
     "python scripts/build_coned_dataset.py --vintage 2010",
     "the electric and gas figures"),
]

# The zip as it arrives, and where a Colab operator drops it. F12: the
# find-the-package cell used to tell an operator to unpack the zip, and no cell
# did the unpacking, so anyone who had uploaded the zip and nothing else was
# stopped there with an instruction and no way to follow it.
ZIP_NAME = "coned-dac-dashboard-data-tools.zip"
PKG_DIR = "coned-dac-dashboard-data-tools"


def md(*lines):
    return {"cell_type": "markdown", "metadata": {}, "source": list(lines)}


def code(*lines):
    return {"cell_type": "code", "metadata": {}, "execution_count": None,
            "outputs": [], "source": list(lines)}


def order_table(mine):
    """The three-step order, with this notebook's own step marked."""
    rows = ["| | Guide | Command | Produces |", "|---|---|---|---|"]
    for label, guide, cmd, what in STEPS:
        mark = " **<- you are here**" if label == mine else ""
        rows.append("| %s%s | `%s` | `%s` | %s |" % (label, mark, guide, cmd, what))
    return "\n".join(rows)


# --------------------------------------------------------------------------
# the shared cells
# --------------------------------------------------------------------------
def cell_setup():
    """F12: unpack the zip, and R7: start the clock.

    The old first cell told an operator to unpack the zip and then did not
    unpack it, which stopped anyone who had uploaded the zip and nothing else.
    This runs BEFORE find-the-package, is idempotent, and says which of the two
    cases it took.
    """
    return code(
        "# ===================================================================\n",
        "# SET THESE IF YOU ARE NOT IN GOOGLE COLAB\n",
        "# ===================================================================\n",
        "\n",
        "# Colab users: leave this as None after uploading the zip.\n",
        "# Jupyter or VS Code users: set the full path to the zip, for example\n",
        "#   ZIP_PATH = r'C:\\\\Users\\\\you\\\\Downloads\\\\%s'\n" % ZIP_NAME,
        "ZIP_PATH = None\n",
        "\n",
        "# Set this INSTEAD if the package is already unpacked: point it at the\n",
        "# folder holding MANIFEST.txt, for example\n",
        "#   PKG_PATH = r'C:\\\\Users\\\\you\\\\Downloads\\\\%s'\n" % PKG_DIR,
        "PKG_PATH = None\n",
        "\n",
        "# ===================================================================\n",
        "# Nothing below needs editing.\n",
        "# ===================================================================\n",
        "# SETUP. Unpacks the package if it is not already unpacked, and starts\n",
        "# the clock for the timing block at the end.\n",
        "import datetime, glob, hashlib, json, os, subprocess, sys, time, zipfile\n",
        "\n",
        "STARTED_AT = datetime.datetime.now(datetime.timezone.utc)\n",
        "STARTED_CLOCK = time.time()\n",
        "STAGE_TIMES = []\n",
        "\n",
        "ZIP_NAME = %r\n" % ZIP_NAME,
        "PKG_DIR = %r\n" % PKG_DIR,
        "\n",
        "def _looks_like_pkg(d):\n",
        "    return (os.path.isfile(os.path.join(d, 'MANIFEST.txt'))\n",
        "            and os.path.isdir(os.path.join(d, 'scripts'))\n",
        "            and os.path.isdir(os.path.join(d, 'Data')))\n",
        "\n",
        "# Resolution order: PKG_PATH, then ZIP_PATH, then the auto-search. An\n",
        "# override that is set but wrong is an error, never a silent fallback to\n",
        "# the search: being quietly pointed at a different copy than the one you\n",
        "# named is worse than being told the path is wrong.\n",
        "_found = []\n",
        "if PKG_PATH:\n",
        "    if not _looks_like_pkg(PKG_PATH):\n",
        "        raise SystemExit(\n",
        "            'PKG_PATH is set to ' + str(PKG_PATH) + ' but that folder does '\n",
        "            'not hold MANIFEST.txt, scripts/ and Data/. Point it at the '\n",
        "            'unpacked package folder, or set it back to None.')\n",
        "    _found = [PKG_PATH]\n",
        "    print('PKG_PATH set     :', PKG_PATH)\n",
        "\n",
        "if not _found:\n",
        "    # Already unpacked anywhere sensible? Then do nothing at all.\n",
        "    _found = [d for d in [os.path.join(os.getcwd(), PKG_DIR),\n",
        "                          os.path.join('/content', PKG_DIR)]\n",
        "              if _looks_like_pkg(d)]\n",
        "    _found += [d for d in sorted(glob.glob('/content/**/' + PKG_DIR,\n",
        "                                           recursive=True))\n",
        "               if _looks_like_pkg(d)]\n",
        "\n",
        "if _found:\n",
        "    print('already unpacked :', _found[0])\n",
        "    print('nothing to do. Skipping the unpack.')\n",
        "else:\n",
        "    if ZIP_PATH:\n",
        "        if not os.path.isfile(ZIP_PATH):\n",
        "            raise SystemExit(\n",
        "                'ZIP_PATH is set to ' + str(ZIP_PATH) + ' but there is no '\n",
        "                'file there. Check the path, or set it back to None.')\n",
        "        _zips = [ZIP_PATH]\n",
        "    else:\n",
        "        _zips = [z for z in ['/content/' + ZIP_NAME,\n",
        "                             os.path.join(os.getcwd(), ZIP_NAME)]\n",
        "                 if os.path.isfile(z)]\n",
        "        _zips += sorted(glob.glob('/content/**/' + ZIP_NAME, recursive=True))\n",
        "    if not _zips:\n",
        "        raise SystemExit(\n",
        "            'No package and no zip found.\\n'\n",
        "            '  In Google Colab: upload ' + ZIP_NAME + ' using the folder '\n",
        "            'icon in the left sidebar, then the upload button, and run this '\n",
        "            'cell again.\\n'\n",
        "            '  In Jupyter or VS Code: set ZIP_PATH at the top of this cell '\n",
        "            'to the full path of the zip, or PKG_PATH if you have already '\n",
        "            'unpacked it.')\n",
        "    _z = _zips[0]\n",
        "    _dest = (os.path.dirname(os.path.abspath(_z)) if ZIP_PATH\n",
        "             else ('/content' if os.path.isdir('/content') else os.getcwd()))\n",
        "    print('zip found        :', _z)\n",
        "    print('unpacking into   :', _dest)\n",
        "    with zipfile.ZipFile(_z) as _zf:\n",
        "        _zf.extractall(_dest)\n",
        "    print('unpacked         :', len(os.listdir(os.path.join(_dest, PKG_DIR))),\n",
        "          'entries')\n",
        "\n",
        "print()\n",
        "print('STARTED', STARTED_AT.strftime('%Y-%m-%d %H:%M:%S UTC'))\n",
    )


def cell_locate():
    return code(
        "# Find the unpacked package. Nothing here writes anything.\n",
        "import hashlib, os, subprocess, sys, json, glob\n",
        "\n",
        "# PKG_PATH from the Setup cell wins if you set it. Otherwise this looks\n",
        "# where the Setup cell would have unpacked, then searches.\n",
        "PKG = PKG_PATH if 'PKG_PATH' in dir() and PKG_PATH else None\n",
        "\n",
        "def _looks_like_pkg(d):\n",
        "    return (os.path.isfile(os.path.join(d, 'MANIFEST.txt'))\n",
        "            and os.path.isdir(os.path.join(d, 'scripts'))\n",
        "            and os.path.isdir(os.path.join(d, 'Data')))\n",
        "\n",
        "if PKG is None:\n",
        "    here = os.getcwd()\n",
        "    candidates = [here, os.path.dirname(here),\n",
        "                  os.path.join(here, 'coned-dac-dashboard-data-tools')]\n",
        "    if 'ZIP_PATH' in dir() and ZIP_PATH:\n",
        "        candidates.insert(0, os.path.join(\n",
        "            os.path.dirname(os.path.abspath(ZIP_PATH)),\n",
        "            'coned-dac-dashboard-data-tools'))\n",
        "    candidates += sorted(glob.glob('/content/**/coned-dac-dashboard-data-tools',\n",
        "                                   recursive=True))\n",
        "    candidates += sorted(glob.glob(os.path.join(here, '**',\n",
        "                         'coned-dac-dashboard-data-tools'), recursive=True))\n",
        "    for c in candidates:\n",
        "        if c and _looks_like_pkg(c):\n",
        "            PKG = c\n",
        "            break\n",
        "\n",
        "if PKG is None:\n",
        "    raise SystemExit(\n",
        "        'Could not find the package root. Run the Setup cell above first: it '\n",
        "        'unpacks the zip.\\n'\n",
        "        '  In Google Colab: upload the zip with the folder icon in the left '\n",
        "        'sidebar, then run Setup again.\\n'\n",
        "        '  In Jupyter or VS Code: set ZIP_PATH, or PKG_PATH if it is already '\n",
        "        'unpacked, at the top of the Setup cell.')\n",
        "\n",
        "print('package root :', PKG)\n",
        "print('contents     :', ', '.join(sorted(os.listdir(PKG))))\n",
    )


def cell_integrity():
    return code(
        "# INTEGRITY. Two halves, and the second is the one that proves something.\n",
        "#\n",
        "# 1. The zip's own size and sha256, printed for you to compare against the\n",
        "#    figures in the handoff note. A notebook INSIDE the zip cannot contain\n",
        "#    the zip's own digest, so this prints rather than asserts.\n",
        "# 2. Every unpacked file against the full sha256 in MANIFEST.txt. This is\n",
        "#    the real check, and it is only possible because MANIFEST.txt carries\n",
        "#    complete 64-character digests.\n",
        "\n",
        "def sha256_of(path):\n",
        "    h = hashlib.sha256()\n",
        "    with open(path, 'rb') as fh:\n",
        "        for chunk in iter(lambda: fh.read(1 << 20), b''):\n",
        "            h.update(chunk)\n",
        "    return h.hexdigest()\n",
        "\n",
        "zips = sorted(glob.glob('/content/**/coned-dac-dashboard-data-tools*.zip',\n",
        "                        recursive=True))\n",
        "zips += sorted(glob.glob(os.path.join(os.path.dirname(PKG),\n",
        "                         'coned-dac-dashboard-data-tools*.zip')))\n",
        "if zips:\n",
        "    z = zips[0]\n",
        "    print('zip          :', z)\n",
        "    print('  bytes      :', os.path.getsize(z))\n",
        "    print('  sha256     :', sha256_of(z))\n",
        "else:\n",
        "    print('zip          : not found (fine: it may have been deleted after unpacking)')\n",
        "\n",
        "# MANIFEST.txt rows look like:\n",
        "#   <path>  <bytes>\n",
        "#       sha256  <64 hex>\n",
        "rows, path_now = [], None\n",
        "with open(os.path.join(PKG, 'MANIFEST.txt'), encoding='utf-8') as fh:\n",
        "    for line in fh:\n",
        "        s = line.rstrip('\\n')\n",
        "        t = s.strip()\n",
        "        if t.startswith('sha256 ') and path_now:\n",
        "            rows.append((path_now[0], path_now[1], t.split(None, 1)[1].strip()))\n",
        "            path_now = None\n",
        "        elif s.startswith(' ') or not t or t.startswith('-') or t.startswith('='):\n",
        "            continue\n",
        "        else:\n",
        "            parts = t.rsplit(None, 1)\n",
        "            if len(parts) == 2 and parts[1].isdigit():\n",
        "                path_now = (parts[0].strip(), int(parts[1]))\n",
        "\n",
        "bad, checked = [], 0\n",
        "for rel, size, digest in rows:\n",
        "    full = os.path.join(PKG, rel)\n",
        "    if not os.path.exists(full):\n",
        "        bad.append('%s: listed in MANIFEST, absent from the package' % rel)\n",
        "        continue\n",
        "    if len(digest) != 64:\n",
        "        bad.append('%s: MANIFEST digest is %d characters, not 64' % (rel, len(digest)))\n",
        "        continue\n",
        "    actual_size, actual = os.path.getsize(full), sha256_of(full)\n",
        "    if actual_size != size:\n",
        "        bad.append('%s: %d bytes on disk, MANIFEST says %d' % (rel, actual_size, size))\n",
        "    if actual != digest:\n",
        "        bad.append('%s: sha256 mismatch' % rel)\n",
        "    checked += 1\n",
        "\n",
        "print()\n",
        "print('MANIFEST rows parsed   :', len(rows))\n",
        "print('files verified         :', checked)\n",
        "if bad:\n",
        "    print('PROBLEMS               :', len(bad))\n",
        "    for b in bad:\n",
        "        print('   ', b)\n",
        "    raise SystemExit('the package does not match its own MANIFEST; stopping.')\n",
        "print('every file matches MANIFEST.txt on both size and full sha256.')\n",
    )


def cell_install():
    return code(
        "# Dependencies, from the package's own requirements.txt. Nothing pinned\n",
        "# here by hand: the file in the package is the source of truth.\n",
        "req = os.path.join(PKG, 'scripts', 'requirements.txt')\n",
        "print(open(req, encoding='utf-8').read())\n",
        "p = subprocess.run([sys.executable, '-m', 'pip', 'install', '-q', '-r', req],\n",
        "                   capture_output=True, text=True)\n",
        "print(p.stdout[-2000:])\n",
        "print(p.stderr[-2000:])\n",
        "if p.returncode != 0:\n",
        "    raise SystemExit('pip install failed with %d' % p.returncode)\n",
        "print('dependencies installed.')\n",
    )


def cell_runner():
    return code(
        "# The run helper. Every command below goes through this, so the command\n",
        "# actually issued is visible and a non-zero exit stops the notebook instead\n",
        "# of scrolling past.\n",
        "#\n",
        "# cwd is the PACKAGE ROOT, which is where the guides say to run from: the\n",
        "# scripts resolve Data/ from their own location, and the paths they print are\n",
        "# relative to the root.\n",
        "# It also times every stage, for the timing block at the end.\n",
        "def run(args, expect=0, stage=None):\n",
        "    label = stage or ' '.join(args[:1])\n",
        "    print('$ python ' + ' '.join(args))\n",
        "    print('-' * 70)\n",
        "    t0 = time.time()\n",
        "    p = subprocess.run([sys.executable] + args, cwd=PKG,\n",
        "                       capture_output=True, text=True)\n",
        "    elapsed = time.time() - t0\n",
        "    sys.stdout.write(p.stdout)\n",
        "    if p.stderr.strip():\n",
        "        print('--- stderr ---')\n",
        "        sys.stdout.write(p.stderr)\n",
        "    print('-' * 70)\n",
        "    print('exit code: %d      elapsed: %s' % (p.returncode, hms(elapsed)))\n",
        "    STAGE_TIMES.append((label, elapsed))\n",
        "    if expect is not None and p.returncode != expect:\n",
        "        raise SystemExit('expected exit %s, got %d' % (expect, p.returncode))\n",
        "    return p\n",
        "\n",
        "def hms(seconds):\n",
        "    seconds = int(round(seconds))\n",
        "    return '%d:%02d:%02d' % (seconds // 3600, (seconds % 3600) // 60,\n",
        "                             seconds % 60)\n",
    )


def cell_timing():
    """R7: one obvious block the operator can read and screenshot."""
    return code(
        "# TIMING. One block, meant to be read and screenshotted.\n",
        "FINISHED_AT = datetime.datetime.now(datetime.timezone.utc)\n",
        "total = time.time() - STARTED_CLOCK\n",
        "\n",
        "print('=' * 58)\n",
        "print('RUN TIMING')\n",
        "print('=' * 58)\n",
        "for label, secs in STAGE_TIMES:\n",
        "    print('  %-42s %s' % (label, hms(secs)))\n",
        "if STAGE_TIMES:\n",
        "    print('-' * 58)\n",
        "print('  STARTED        %s' % STARTED_AT.strftime('%Y-%m-%d %H:%M:%S UTC'))\n",
        "print('  FINISHED       %s' % FINISHED_AT.strftime('%Y-%m-%d %H:%M:%S UTC'))\n",
        "print('  TOTAL ELAPSED  %s' % hms(total))\n",
        "print('=' * 58)\n",
        "print()\n",
        "print('Times vary by machine. A slower computer taking two or three times')\n",
        "print('as long is normal. Ten times as long is worth investigating rather')\n",
        "print('than waiting out: check the preflight table for something being')\n",
        "print('downloaded that should already be here.')\n",
    )


def cell_verify(outputs, extra=()):
    """outputs: list of (relpath, expected_bytes_or_None, expected_sha_or_None)."""
    src = [
        "# VERIFICATION. Measure what the run produced, and compare it against\n",
        "# values that were measured from a real build. A value of None means no\n",
        "# measurement exists yet: the cell records what it found and says so rather\n",
        "# than comparing against a number nobody measured.\n",
        "EXPECTED = [\n",
    ]
    for rel, size, digest in outputs:
        src.append("    (%r, %r, %r),\n" % (rel, size, digest))
    src += [
        "]\n",
        "\n",
        "problems = []\n",
        "for rel, exp_size, exp_sha in EXPECTED:\n",
        "    full = os.path.join(PKG, rel)\n",
        "    print(rel)\n",
        "    if not os.path.exists(full):\n",
        "        print('    MISSING: the run did not produce this file')\n",
        "        problems.append('%s is missing' % rel)\n",
        "        continue\n",
        "    size, digest = os.path.getsize(full), sha256_of(full)\n",
        "    print('    bytes  :', size,\n",
        "          '' if exp_size is None else ('(expected %d)' % exp_size))\n",
        "    print('    sha256 :', digest)\n",
        "    if exp_sha is None:\n",
        "        print('    expected sha256: not measured; recorded, not compared')\n",
        "    else:\n",
        "        print('    expected       :', exp_sha)\n",
        "    if exp_size is not None and size != exp_size:\n",
        "        problems.append('%s: %d bytes, expected %d' % (rel, size, exp_size))\n",
        "    if exp_sha is not None and digest != exp_sha:\n",
        "        problems.append('%s: sha256 differs from the expected build' % rel)\n",
        "\n",
    ]
    src += list(extra)
    src += [
        "\n",
        "print()\n",
        "if problems:\n",
        "    for p_ in problems:\n",
        "        print('PROBLEM:', p_)\n",
        "    raise SystemExit('verification failed.')\n",
        "print('verification passed.')\n",
    ]
    return code(*src)


def counts_cell(rel, kind):
    """Structural counts, read from the output rather than asserted about it."""
    if kind == "geometry":
        return [
            "# Structural counts, read out of the dataset itself.\n",
            "doc = json.load(open(os.path.join(PKG, %r), encoding='utf-8'))\n" % rel,
            "tracts = doc['tracts']\n",
            "geoids = tracts['geoids']\n",
            "geometry = tracts['geometry']\n",
            "fields = tracts['fields']\n",
            "print()\n",
            "print('version      :', doc['dataset']['version'])\n",
            "print('geoidVintage :', doc['dataset']['geoidVintage'])\n",
            "print('geoids       :', len(geoids), '  unique:', len(set(geoids)))\n",
            "print('geometries   :', len(geometry))\n",
            "print('fields       :', len(fields))\n",
            "if not (len(geoids) == len(set(geoids)) == len(geometry)):\n",
            "    problems.append('geoid / geometry counts disagree')\n",
            "if len(fields) != 8:\n",
            "    problems.append('expected 8 fields, found %d' % len(fields))\n",
        ]
    if kind == "territories":
        return [
            "# Layer counts, read out of the overlay itself.\n",
            "terr = json.load(open(os.path.join(PKG, %r), encoding='utf-8'))\n" % rel,
            "feats = terr['features']\n",
            "per = {}\n",
            "for f_ in feats:\n",
            "    k = f_['properties'].get('layer', '?')\n",
            "    per[k] = per.get(k, 0) + 1\n",
            "print()\n",
            "print('kind     :', terr.get('kind'))\n",
            "print('features :', len(feats))\n",
            "for k in sorted(per):\n",
            "    print('    %-10s %d' % (k, per[k]))\n",
            "print('sourceFingerprint:', str(terr.get('sourceFingerprint'))[:16])\n",
            "if len(per) < 3:\n",
            "    problems.append('expected three layers, found %d' % len(per))\n",
        ]
    return []


# --------------------------------------------------------------------------
# the four notebooks
# --------------------------------------------------------------------------
GEO_2010 = "Data/out/tract_geometry_pure-2010.json"
# CLCPA-279 wave 2 / R2: the overlay is an output, so it lands in Data/out/ with
# the rest of them. It used to be written one level up, in Data/.
TERR = "Data/out/service_territories.geojson"
DAC = "Data/out/nyserda_dac_v1_0.json"
CONED = "Data/out/coned_operational_v1_0-2010.json"

# MEASURED, every one of them. Nothing here is estimated or carried over from
# prose: each value was read off a file produced by a clean-room run of THIS
# package, from the zip, in the order the README states.
#
# The first two were also measured independently by Con Edison in a fresh Colab
# on 2026-09-16/17 (handoff audit, verification rows 15, 16, 21, 33) and agree to
# the byte. The last two the audit did not execute, so the CLCPA-279 clean-room
# run is their only measurement; each was built twice and was byte-identical.
M_GEO_2010 = (1587328,
              "6e9f09f7414f59ed4381b59d0d66bb6baa24f5c162182934b4f9c7d756413f49")
M_TERR = (239162,
          "a45ae7f05d4aac95cf37d6f77aa4a5d536b4da6dcf08de155a318a19e10ea4c7")
M_DAC = (1181466,
         "6df6a4d8378390c6ec8668651316a8f20b81fafe0f0753376d51b8e86ff50163")
M_CONED = (176215,
           "b9e7a4d6e971b2b3a85f1d135c70f7da317153664c04e3954984b04e6ada3365")

ONE_COMMAND_NOTE = (
    "> **One command, two outputs.** `update_map_data.py` is the single producer "
    "of both the tract shapes and the territory overlay. It builds them together, "
    "from one set of shapefiles, and stamps both with the same fingerprint so "
    "they cannot drift apart. That is why this notebook and the other one for "
    "step 1 run the same command: whichever you run, you get both files.\n"
)

REFRESH_NOTE = (
    "> **`--refresh-territories` is not an overlay-only rebuild.** Verified, not "
    "assumed: the run always continues on to rebuild the dataset as well, so with "
    "a dataset already in `Data/out/` the flag needs `--force` too and both files "
    "are rewritten. There is no supported way to rebuild the overlay alone, and "
    "that is deliberate -- the two outputs are stamped as a pair.\n"
)


def notebook(title, family, step, purpose, produces, notes, cells_mid, verify):
    nb = {
        "nbformat": 4, "nbformat_minor": 5,
        "metadata": {
            "kernelspec": {"display_name": "Python 3", "language": "python",
                           "name": "python3"},
            "language_info": {"name": "python"},
        },
        "cells": [],
    }
    head = [
        "# %s\n" % title,
        "\n",
        "**Output family:** %s\n" % family,
        "\n",
        "%s\n" % purpose,
        "\n",
        "**What it produces**\n",
        "\n",
    ]
    head += ["- `%s`\n" % p for p in produces]
    head += [
        "\n",
        "## Where this sits in the execution order\n",
        "\n",
        "Nothing in this package is numbered. Each guide and notebook is named after\n",
        "its output family, and the order to run them in is this one:\n",
        "\n",
        order_table(step) + "\n",
        "\n",
    ]
    # F13: the order table and the callout below it used to butt straight up
    # against each other with no breathing room. A blank line before each note,
    # and one after the last, so the table ends and the callout starts.
    for n in notes:
        head += ["\n", "&nbsp;\n", "\n", n, "\n"]
    head += [
        "\n",
        "## How to use this notebook\n",
        "\n",
        "Run the cells in order. This notebook is an **orchestrator**: it calls the\n",
        "package's own scripts and reimplements nothing, so what it produces is\n",
        "byte-identical to running the same commands in a terminal.\n",
        "\n",
        "Nothing here contacts the dashboard, Dataverse, or any Con Edison system.\n",
        "Uploading is a separate manual step, described in the guide.\n",
    ]
    nb["cells"].append(md(*head))
    nb["cells"].append(md(
        "## Setup: unpack the package, and start the clock\n",
        "\n",
        "Upload `coned-dac-dashboard-data-tools.zip` to this session first, then\n",
        "run this cell. If the package is already unpacked it says so and does\n",
        "nothing.\n"))
    nb["cells"].append(cell_setup())
    nb["cells"].append(md("## Find the package\n"))
    nb["cells"].append(cell_locate())
    nb["cells"].append(md("## Integrity: is this package intact?\n"))
    nb["cells"].append(cell_integrity())
    nb["cells"].append(md("## Install the dependencies\n"))
    nb["cells"].append(cell_install())
    nb["cells"].append(md("## The run helper\n"))
    nb["cells"].append(cell_runner())
    for c in cells_mid:
        nb["cells"].append(c)
    nb["cells"].append(md(
        "## Verify the outputs\n",
        "\n",
        "Sizes and digests are measured from the files the run just wrote.\n",
    ))
    nb["cells"].append(verify)
    nb["cells"].append(md(
        "## How long it took\n",
        "\n",
        "The block below is the one to screenshot for the run record.\n",
    ))
    nb["cells"].append(cell_timing())
    nb["cells"].append(md(
        "## What happens next\n",
        "\n",
        "Nothing in this notebook uploads anything. Follow the guide's upload\n",
        "section to publish these files through the dashboard's Map Layers card.\n",
    ))
    return nb


def build_tract_shapes():
    mid = [
        md("## Dry run: preflight only\n",
           "\n",
           "`--dry-run` prints the preflight table and stops. No writes, no network.\n"),
        code("run(['scripts/update_map_data.py', '--vintage', '2010', '--dry-run'], stage='dry run, preflight only')\n"),
        md("## The real run\n",
           "\n",
           "One command. It writes the tract shapes **and** the territory overlay.\n",
           "\n",
           "If the dataset already exists the preflight refuses and tells you to pass\n",
           "`--force`; that refusal is the tool protecting a file that may be the copy\n",
           "live in Dataverse, so read it before overriding it.\n"),
        code("run(['scripts/update_map_data.py', '--vintage', '2010'], stage='tract shapes and overlay, vintage 2010')\n"),
    ]
    return notebook(
        "Tract shapes", "TRACT SHAPES", "Step 1",
        "Builds the per-tract geometry dataset the map draws, for one GEOID "
        "vintage. This runs FIRST: the tract list it writes is what steps 2 and 3 "
        "read.",
        [GEO_2010, TERR + "  (the same command produces this too)"],
        [ONE_COMMAND_NOTE],
        mid,
        cell_verify([(GEO_2010,) + M_GEO_2010, (TERR,) + M_TERR],
                    extra=counts_cell(GEO_2010, "geometry")),
    )


def build_territory_overlays():
    mid = [
        md("## Dry run: preflight only\n",
           "\n",
           "The preflight names what it will do with the overlay: `WILL BUILD` when\n",
           "it is absent, `WILL REBUILD` when its stamp disagrees with the\n",
           "shapefiles, `PRESENT` when it already matches.\n"),
        code("run(['scripts/update_map_data.py', '--vintage', '2010', '--dry-run'], stage='dry run, preflight only')\n"),
        md("## The real run\n",
           "\n",
           "The same single command as step 1, because one command produces both\n",
           "outputs. The overlay lands in `Data/`, **not** in `Data/out/`.\n"),
        code("run(['scripts/update_map_data.py', '--vintage', '2010'], stage='tract shapes and overlay, vintage 2010')\n"),
    ]
    return notebook(
        "Territory overlays", "TERRITORY OVERLAYS", "Step 1",
        "Builds the service territory overlay: the electric network outlines, the "
        "gas service areas, and the ORU outlines the map draws beneath the tracts.",
        [TERR, GEO_2010 + "  (the same command produces this too)"],
        [ONE_COMMAND_NOTE, REFRESH_NOTE],
        mid,
        cell_verify([(TERR,) + M_TERR, (GEO_2010,) + M_GEO_2010],
                    extra=counts_cell(TERR, "territories")),
    )


def build_dac_indicators():
    mid = [
        md("## Dry run: build without writing\n",
           "\n",
           "`--no-write` does the whole conversion and then does not write the file.\n"),
        code("run(['scripts/convert_nyserda_raw.py', '--version', '1.0',\n",
             "     '--geoid-vintage', '2010', '--raw-date', '2023-03-27',\n",
             "     '--no-write'], stage='dry run, no write')\n"),
        md("## The real run\n",
           "\n",
           "This reads the tract geometry from step 1 as its tract universe. If step\n",
           "1 has not run, `Data/out/` is empty and this stops on a missing input:\n",
           "that is the ordering, not a fault in the package.\n"),
        code("run(['scripts/convert_nyserda_raw.py', '--version', '1.0',\n",
             "     '--geoid-vintage', '2010', '--raw-date', '2023-03-27'],\n",
             "     stage='DAC indicators')\n"),
    ]
    return notebook(
        "DAC indicators", "DAC INDICATORS", "Step 2",
        "Converts the NYSERDA disadvantaged-community release into the indicator "
        "dataset the dashboard reads.",
        [DAC],
        [],
        mid,
        cell_verify([(DAC,) + M_DAC]),
    )


def build_coned_figures():
    mid = [
        md("## Dry run\n",
           "\n",
           "This script has no dry-run flag, so there is no dry-run cell to offer.\n",
           "Said plainly rather than faked: the run below is the first thing that\n",
           "writes. It refuses rather than overwriting an existing output unless you\n",
           "pass `--force`.\n"),
        md("## The real run\n",
           "\n",
           "Reads the Con Edison electric and gas extracts, and the tract geometry\n",
           "from step 1 as its tract list.\n"),
        code("run(['scripts/build_coned_dataset.py', '--vintage', '2010'], stage='electric and gas figures, vintage 2010')\n"),
    ]
    return notebook(
        "Electric and gas figures", "ELECTRIC AND GAS FIGURES", "Step 3",
        "Builds the per-tract electric and gas operational figures: account "
        "counts and energy affordability enrollment.",
        [CONED],
        [],
        mid,
        cell_verify([(CONED,) + M_CONED]),
    )


BUILDERS = {
    "tract-shapes.ipynb": build_tract_shapes,
    "territory-overlays.ipynb": build_territory_overlays,
    "dac-indicators.ipynb": build_dac_indicators,
    "electric-and-gas-figures.ipynb": build_coned_figures,
}


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, fn in sorted(BUILDERS.items()):
        nb = fn()
        path = os.path.join(OUT, name)
        # LF and a trailing newline: a notebook is JSON read by tools, not a
        # working-tree source file, and every generator run must produce the same
        # bytes or the package stops being reproducible.
        text = json.dumps(nb, indent=1, ensure_ascii=False, sort_keys=False) + "\n"
        with open(path, "w", encoding="utf-8", newline="\n") as fh:
            fh.write(text)
        print("%-34s %6d bytes  %d cells" % (name, len(text.encode("utf-8")),
                                             len(nb["cells"])))
    print("\nwritten to %s" % OUT)


if __name__ == "__main__":
    main()
