"""update_map_data.py -- fetch and stage the public inputs, then run the geometry
build. The operator-facing front door to build_pure_geometry_dataset.py.

    python Data/update_map_data.py --vintage 2020
    python Data/update_map_data.py --vintage 2010 --dry-run
    python Data/update_map_data.py --vintage 2010 --no-fetch --force

WHY THIS IS A SEPARATE SCRIPT
-----------------------------
Across the other scripts in Data/ there is not one HTTP call. Every input is
placed there by hand. That isolation was deliberate and recorded: the builder's
own note declined to fold in the territory conversion precisely because it would
"make this build require network access where it currently does not".

WHERE THAT ISOLATION NOW STANDS, narrowed by slice 6c
----------------------------------------------------
The geometry BUILD is still offline. It reads files and writes a dataset, and
nothing in it opens a socket.

THIS ORCHESTRATOR IS NOT, and as of slice 6c that is true even with --no-fetch
in play, because it is now the single producer of BOTH outputs and the territory
conversion needs the network: _make_territories.py enables the PROJ network to
fetch a NADCON grid for the ORU layer, which is NAD27 and therefore needs a real
datum transform rather than an ellipsoid swap. ORU stays in the overlay because
it is a visible product feature whose removal is Con Edison's call, so the
network requirement stays with it.

Read that as: "the build is offline, the orchestrator is not". Anyone who needs a
fully offline run should call build_pure_geometry_dataset.py directly and accept
that nothing then checks the territory coupling for them.

So this script is the only one that opens a socket, and it runs the builder as a
SUBPROCESS rather than importing and calling it. That boundary is the point, not
a detail: it is what keeps "given these bytes, this output" true of the builder.
Importing it to call main() would put network code in the same process as the
compute and quietly end that property.

What IS imported from the builder is its crosswalk configuration -- the prefixes,
the portal ids, and find_crosswalk itself. Restating those here would recreate
the bug that was just fixed in that file, where a hardcoded 2020 filename meant
the build silently read a different file from the one that had been staged. The
rule is "no build in-process", not "no shared constant".

PROVENANCE
----------
Downloads are staged UNTOUCHED. The Census archive is saved as published, in
Data/raw/, with a sidecar recording the URL, the server's date, the byte count
and the sha256. The crosswalk CSV is saved under its published name and never
rewritten -- the builder resolves it by prefix precisely so the date suffix does
not have to be edited away.

The single exception is shp -> GeoJSON, which is unavoidable: the Census
publishes a shapefile inside a .zip and load_tracts() does json.load. That
conversion is a FORMAT change with no semantic edit, it writes a new derived
file rather than altering the archive, and its output is checked four ways
before the builder is allowed to see it.

WHAT IT REFUSES TO DO
---------------------
  - rebuild map_payload.json. It is not reproducible from its own pipeline: a
    re-run diverges on City_Town, neighborhood and electric_networks. This script
    consumes it read-only and refuses if it is absent rather than regenerating a
    file that would come back different.
  - touch Dataverse. No auth, no writes, no upload. It produces a file and
    prints the field block; a human uploads.
  - deploy anything.
  - edit a staged raw file, ever.
  - continue past a missing Con Edison input, which cannot be downloaded.
  - accept a download that does not look right.
  - overwrite an existing dataset without --force.
  - guess a URL or a portal id.

EXIT CODES
----------
  0  a dataset file was produced (or --dry-run completed a clean preflight)
  2  refused: something missing, ambiguous, or failing a check
  3  the builder itself failed
"""
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import tempfile
import zipfile
from datetime import datetime, timezone
from urllib.request import Request, urlopen

HERE = os.path.dirname(os.path.abspath(__file__))
# Layout-agnostic paths. In the repository this script lives in Data/; in the Con
# Edison handoff package it sits at the package root with Data/ beside it. DATA is
# the same folder in both layouts, so one copy of the script serves both and the
# clean-room proof exercises the very file the repository holds.
DATA = HERE if os.path.basename(HERE) == "Data" else os.path.join(HERE, "Data")
ROOT = os.path.dirname(DATA)
RAW = os.path.join(DATA, "raw")
SUPERSEDED = os.path.join(RAW, "superseded")

sys.path.insert(0, HERE)
# No __pycache__: this is a once-in-a-while operator tool and it should not leave
# build litter in Data/ just because it imports a sibling for its constants.
sys.dont_write_bytecode = True
try:
    import build_pure_geometry_dataset as B      # noqa: E402  (config only; see above)
except SystemExit as e:
    # The builder calls sys.exit() at module scope on some failures, and an
    # unguarded import would end THIS process with the builder's code before a
    # single line of preflight was printed. Found by a test that replaced the
    # builder with a stub: the orchestrator exited 7 silently.
    sys.stderr.write(
        "\nREFUSED\n  build_pure_geometry_dataset.py exited while being imported "
        "(code %s).\n  Nothing has been fetched, staged or built. Run it directly to "
        "see why:\n    python Data/build_pure_geometry_dataset.py --vintage 2020\n"
        % getattr(e, "code", "?"))
    sys.exit(2)
except Exception as e:                            # noqa: BLE001
    sys.stderr.write(
        "\nREFUSED\n  build_pure_geometry_dataset.py could not be imported, so its "
        "crosswalk\n  configuration is unavailable and nothing can be verified.\n"
        "    %s: %s\n"
        "  Its dependencies are pyshp, pyproj and shapely. Nothing was fetched or "
        "built.\n" % (type(e).__name__, str(e)[:200]))
    sys.exit(2)

BUILDER = os.path.join(HERE, "build_pure_geometry_dataset.py")

# Verified live before shipping, not written from memory:
#   2020  200, 2,257,222 bytes, application/zip
#   2010  present in the GENZ2010 directory listing; the file is slow to serve,
#         which is why the timeout below is generous rather than polite
CENSUS_URL = {
    "2020": "https://www2.census.gov/geo/tiger/GENZ2020/shp/cb_2020_36_tract_500k.zip",
    "2010": "https://www2.census.gov/geo/tiger/GENZ2010/gz_2010_36_140_00_500k.zip",
}
# Socrata CSV export. The portal ids come from the builder so there is one copy.
SOCRATA = "https://data.cityofnewyork.us/api/views/%s/rows.csv?accessType=DOWNLOAD"
TIMEOUT = 300
UA = "ConEd-DAC-dashboard update_map_data.py (contact the maintainer)"

# Con Edison service area, state FIPS 36. The builder carries these as county
# NAMES keyed by FIPS; this is the same six, as the digits the files hold.
CONED_COUNTY_FIPS = ["005", "047", "061", "081", "085", "119"]

# The property each vintage's loader actually reads. Getting this wrong produces
# an empty intersection with the payload and a build that exits on "no overlap"
# rather than anything that names the real cause.
KEY_PROPERTY = {"2020": "GEOID", "2010": "GEO_ID"}
GEO_ID_PREFIX = "1400000US"

# Con Edison inputs. Not downloadable: if these are missing the run stops with
# the exact paths, because no flag can fix it.
CONED_INPUTS = [
    (os.path.join(DATA, "tract_universe.json"),
     "the tract universe and City_Town; generated once by build_tract_universe.py"),
    (os.path.join(DATA, "Extra_info", "CECONY_Electric.shp"),
     "electric_networks is measured against it"),
    (os.path.join(DATA, "Extra_info", "CECONY_Electric.dbf"), "its NETWORK attribute"),
    (os.path.join(DATA, "Extra_info", "CECONY_Electric.prj"), "its CRS"),
    (os.path.join(DATA, "Extra_info", "CECONY_Gas.shp"),
     "gas_areas is measured against it"),
    (os.path.join(DATA, "Extra_info", "CECONY_Gas.dbf"), "its BORONAME attribute"),
    (os.path.join(DATA, "Extra_info", "CECONY_Gas.prj"), "its CRS"),
]

# Plausible lon/lat for New York. A projected file (EPSG:2263, US survey feet)
# loads through json.load without complaint and produces silent nonsense
# downstream, so the numbers are checked rather than the file extension.
LON_RANGE = (-80.0, -71.0)
LAT_RANGE = (40.0, 46.0)


class Refuse(Exception):
    """Something is missing, ambiguous, or failed a check. Exit 2."""


def out(*a):
    print(*a)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def rel(path):
    try:
        return os.path.relpath(path, ROOT).replace("\\", "/")
    except ValueError:
        return path


# ---------------------------------------------------------------------------
# arguments
# ---------------------------------------------------------------------------
def parse_args(argv):
    a = {"vintage": None, "census_url": None, "crosswalk_id": None,
         "refetch": False, "no_fetch": False, "dry_run": False,
         "force": False, "artifact": False, "refresh_territories": False}
    i = 0
    while i < len(argv):
        t = argv[i]
        if t == "--vintage":
            i += 1
            a["vintage"] = argv[i] if i < len(argv) else None
        elif t == "--census-url":
            i += 1
            a["census_url"] = argv[i] if i < len(argv) else None
        elif t == "--crosswalk-id":
            i += 1
            a["crosswalk_id"] = argv[i] if i < len(argv) else None
        elif t == "--refetch":
            a["refetch"] = True
        elif t == "--no-fetch":
            a["no_fetch"] = True
        elif t == "--dry-run":
            a["dry_run"] = True
        elif t == "--force":
            a["force"] = True
        elif t == "--artifact":
            a["artifact"] = True
        elif t == "--refresh-territories":
            a["refresh_territories"] = True
        else:
            raise Refuse("unknown argument %r.\n%s" % (t, USAGE))
        i += 1
    if a["vintage"] not in ("2010", "2020"):
        raise Refuse("--vintage must be 2010 or 2020.\n" + USAGE)
    if a["refresh_territories"] and a["no_fetch"]:
        raise Refuse("--refresh-territories needs the network and --no-fetch forbids "
                     "it. The territory conversion fetches a NADCON grid for the ORU "
                     "layer, which is NAD27 and cannot be transformed without one.")
    if a["refetch"] and a["no_fetch"]:
        raise Refuse("--refetch and --no-fetch contradict each other: one says "
                     "replace every input, the other says open no socket.")
    for flag in ("census_url", "crosswalk_id"):
        if a[flag] is not None and a["no_fetch"]:
            raise Refuse("--%s was given with --no-fetch, so it could not be used. "
                         "Drop one." % flag.replace("_", "-"))
    return a


USAGE = """usage: python Data/update_map_data.py --vintage 2010|2020
                 [--census-url URL] [--crosswalk-id ID]
                 [--refetch] [--no-fetch] [--dry-run] [--force] [--artifact]

  --census-url    override the vintage's Census cartographic boundary URL
  --crosswalk-id  override the NYC Open Data portal id for the NTA crosswalk
  --refetch       re-download and re-stage even when an input is present
  --no-fetch      verify and build from what is on disk; opens no socket
  --dry-run       preflight only: no writes, no network
  --force         allow overwriting an existing dataset in Data/out/
  --artifact      passed through to the builder
  --refresh-territories
                  rebuild service_territories.geojson even when its stamp already
                  matches the shapefiles. It is rebuilt automatically when the
                  stamp is absent or disagrees; this forces it otherwise."""


# ---------------------------------------------------------------------------
# fetching, with a pinned sidecar
# ---------------------------------------------------------------------------
def fetch(url, dest, what):
    """Download to dest and write dest + '.fetch.json' beside it."""
    out("  fetching %s" % what)
    out("    %s" % url)
    req = Request(url, headers={"User-Agent": UA})
    tmp = dest + ".part"
    try:
        with urlopen(req, timeout=TIMEOUT) as r:
            server_date = r.headers.get("Last-Modified") or r.headers.get("Date")
            declared = r.headers.get("Content-Length")
            ctype = r.headers.get("Content-Type")
            with open(tmp, "wb") as fh:
                shutil.copyfileobj(r, fh, length=1 << 20)
    except Exception as e:
        if os.path.exists(tmp):
            os.remove(tmp)
        raise Refuse(
            "the download failed and nothing was staged.\n"
            "  url   : %s\n"
            "  error : %s: %s\n"
            "  This script will not guess an alternative address. If the source "
            "moved,\n  pass the new one with %s."
            % (url, type(e).__name__, str(e)[:200],
               "--census-url" if what.startswith("Census") else "--crosswalk-id"))

    size = os.path.getsize(tmp)
    if size == 0:
        os.remove(tmp)
        raise Refuse("the download for %s was empty (0 bytes). Nothing staged." % what)
    if declared and declared.isdigit() and int(declared) != size:
        os.remove(tmp)
        raise Refuse("%s: the server declared %s bytes and %d arrived, so the "
                     "transfer was truncated. Nothing staged."
                     % (what, declared, size))
    os.replace(tmp, dest)
    digest = sha256_file(dest)
    side = {
        "url": url,
        "savedAs": os.path.basename(dest),
        "bytes": size,
        "sha256": digest,
        "serverDate": server_date,
        "contentType": ctype,
        "fetchedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "fetchedBy": "update_map_data.py",
    }
    with io.open(dest + ".fetch.json", "w", encoding="utf-8", newline="\n") as fh:
        json.dump(side, fh, indent=2, sort_keys=True)
        fh.write("\n")
    out("    staged %s  %d bytes  sha256=%s" % (rel(dest), size, digest[:16]))
    out("    sidecar %s" % rel(dest + ".fetch.json"))
    return side


# ---------------------------------------------------------------------------
# the one documented transformation: shapefile -> GeoJSON
# ---------------------------------------------------------------------------
def convert_zip_to_geojson(zip_path, vintage, dest):
    """Format conversion only. No reprojection, no attribute edits.

    Keeps the six Con Edison counties and only the properties the loader reads,
    matching the files that are already committed. Filtering is not required for
    correctness -- load_tracts indexes by key and the build scopes to the payload
    universe either way -- but it is what the existing inputs do, and a smaller
    file is a smaller thing to be wrong about.
    """
    import shapefile                                    # pyshp, already a builder dep

    key = KEY_PROPERTY[vintage]
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        stems = sorted({os.path.splitext(n)[0] for n in names
                        if n.lower().endswith(".shp")})
        if len(stems) != 1:
            raise Refuse("expected exactly one .shp in %s, found %d: %s"
                         % (rel(zip_path), len(stems), stems or names[:8]))
        stem = stems[0]
        need = [stem + ext for ext in (".shp", ".shx", ".dbf")]
        missing = [n for n in need if n not in names]
        if missing:
            raise Refuse("%s is missing shapefile members %s; it cannot be read."
                         % (rel(zip_path), missing))
        prj = None
        if stem + ".prj" in names:
            prj = z.read(stem + ".prj").decode("utf-8", "replace")
        tmpdir = tempfile.mkdtemp(prefix="census_")
        try:
            for n in need:
                z.extract(n, tmpdir)
            r = shapefile.Reader(os.path.join(tmpdir, stem))
            fields = [f[0] for f in r.fields[1:]]
            if key not in fields:
                raise Refuse(
                    "the %s shapefile has no %s attribute, which is the one the "
                    "builder reads.\n  Attributes present: %s"
                    % (vintage, key, fields))
            records = r.numRecords
            feats = []
            kept = 0
            for sr in r.iterShapeRecords():
                rec = sr.record.as_dict()
                gid_raw = str(rec.get(key, ""))
                gid = gid_raw[len(GEO_ID_PREFIX):] if (
                    vintage == "2010" and gid_raw.startswith(GEO_ID_PREFIX)) else gid_raw
                if len(gid) != 11 or gid[2:5] not in CONED_COUNTY_FIPS:
                    continue
                props = {key: gid_raw}
                if vintage == "2020":
                    props["COUNTYFP"] = gid[2:5]
                geom = sr.shape.__geo_interface__
                feats.append({"type": "Feature", "properties": props,
                              "geometry": {"type": geom["type"],
                                           "coordinates": geom["coordinates"]}})
                kept += 1
            r.close()
        finally:
            shutil.rmtree(tmpdir, ignore_errors=True)

    if prj is not None and "PROJCS" in prj.upper():
        raise Refuse(
            "the %s shapefile is PROJECTED, not geographic:\n    %s\n"
            "  The builder reprojects FROM EPSG:4326, so projected input would be "
            "read as\n  degrees and produce silent nonsense. Refusing to convert it."
            % (vintage, prj.strip()[:160]))

    doc = {"type": "FeatureCollection", "features": feats}
    with io.open(dest, "w", encoding="utf-8", newline="") as fh:
        json.dump(doc, fh, separators=(",", ":"), ensure_ascii=False)
    out("    converted %d of %d shapefile records -> %s"
        % (kept, records, rel(dest)))
    return {"records": records, "kept": kept, "prj": (prj or "").strip()[:120]}


def check_geojson(path, vintage):
    """The four structural checks. Verify, do not trust."""
    key = KEY_PROPERTY[vintage]
    try:
        g = json.load(open(path, encoding="utf-8"))
    except Exception as e:
        raise Refuse("%s is not readable JSON: %s: %s" % (rel(path), type(e).__name__, e))
    feats = g.get("features")
    if not isinstance(feats, list) or not feats:
        raise Refuse("%s has no features." % rel(path))

    problems = []
    # 1. the key property the loader reads
    nokey = [i for i, f in enumerate(feats[:50])
             if key not in (f.get("properties") or {})]
    if nokey:
        problems.append("check 1: %d of the first 50 features have no %s property, "
                        "which is what load_tracts reads for %s."
                        % (len(nokey), key, vintage))
    elif vintage == "2010":
        bad = [f["properties"][key] for f in feats[:50]
               if not str(f["properties"][key]).startswith(GEO_ID_PREFIX)]
        if bad:
            problems.append("check 1: the 2010 loader slices GEO_ID at 9 characters, "
                            "expecting the %s prefix; got e.g. %r"
                            % (GEO_ID_PREFIX, bad[0]))

    # 2. all six Con Edison counties
    def gid_of(f):
        v = str(f["properties"].get(key, ""))
        return v[len(GEO_ID_PREFIX):] if v.startswith(GEO_ID_PREFIX) else v

    counties = {gid_of(f)[2:5] for f in feats if len(gid_of(f)) == 11}
    absent = [c for c in CONED_COUNTY_FIPS if c not in counties]
    if absent:
        problems.append("check 2: no tracts for Con Edison county FIPS %s. The "
                        "download is not the six-county area." % absent)

    # 3. lon/lat, not projected
    def first_coord(geom):
        c = geom.get("coordinates")
        while isinstance(c, list) and c and isinstance(c[0], list):
            c = c[0]
        return c

    sample = [first_coord(f["geometry"]) for f in feats[:200] if f.get("geometry")]
    sample = [c for c in sample if isinstance(c, list) and len(c) >= 2]
    if not sample:
        problems.append("check 3: could not read a coordinate from the first 200 features.")
    else:
        offlon = [c for c in sample if not (LON_RANGE[0] <= c[0] <= LON_RANGE[1])]
        offlat = [c for c in sample if not (LAT_RANGE[0] <= c[1] <= LAT_RANGE[1])]
        if offlon or offlat:
            problems.append(
                "check 3: coordinates are not New York lon/lat. Sample %r. Expected "
                "lon in %s and lat in %s -- a projected file (EPSG:2263, US survey "
                "feet) reads as degrees and fails silently downstream."
                % (sample[0], LON_RANGE, LAT_RANGE))

    # 4. count, reported
    if problems:
        raise Refuse("the converted %s GeoJSON failed its structural checks:\n%s"
                     % (vintage, "\n".join("  " + p for p in problems)))
    out("    checks passed: %s present, six counties (%d), lon/lat in range, "
        "%d features" % (key, len(counties), len(feats)))
    return len(feats)


# ---------------------------------------------------------------------------
# preflight
# ---------------------------------------------------------------------------
def resolve_crosswalk(vintage):
    """The builder's own resolver, so the prefix has one definition.

    It exits on ambiguity, which is a refusal we want -- caught here so the
    preflight table can carry it as a row rather than a traceback.
    """
    try:
        return ("ok", B.find_crosswalk(vintage))
    except SystemExit as e:
        return ("ambiguous", str(e))


def preflight(a):
    v = a["vintage"]
    geo = B.SRC[v]
    zip_name = os.path.basename(a["census_url"] or CENSUS_URL[v])
    zip_path = os.path.join(RAW, zip_name)
    rows = []
    fatal = []

    # the derived GeoJSON, and the archive it comes from
    if os.path.exists(geo):
        rows.append(("Census tract GeoJSON", "PRESENT", rel(geo)))
    elif a["no_fetch"]:
        rows.append(("Census tract GeoJSON", "MISSING", rel(geo)))
        fatal.append("%s is absent and --no-fetch forbids downloading it. Drop "
                     "--no-fetch, or place the file yourself." % rel(geo))
    else:
        rows.append(("Census tract GeoJSON", "WILL BUILD", rel(geo) + "  (from the archive)"))
    if a["refetch"] and not a["no_fetch"]:
        rows.append(("Census archive", "WILL REFETCH", rel(zip_path)))
    elif os.path.exists(zip_path):
        rows.append(("Census archive", "PRESENT", rel(zip_path)))
    elif os.path.exists(geo):
        rows.append(("Census archive", "not needed", "the GeoJSON is already here"))
    elif a["no_fetch"]:
        rows.append(("Census archive", "MISSING", rel(zip_path)))
    else:
        rows.append(("Census archive", "WILL FETCH", rel(zip_path)))

    # the crosswalk
    state, found = resolve_crosswalk(v)
    if state == "ambiguous":
        rows.append(("NTA crosswalk", "AMBIGUOUS", "two or more match the prefix"))
        fatal.append(found)
    elif found and a["refetch"] and not a["no_fetch"]:
        rows.append(("NTA crosswalk", "WILL REFETCH", rel(found) + "  (current one superseded)"))
    elif found:
        rows.append(("NTA crosswalk", "PRESENT", rel(found)))
    elif a["no_fetch"]:
        rows.append(("NTA crosswalk", "MISSING", "prefix " + B.CROSSWALK_PREFIX[v]))
        fatal.append("no CSV in Data/ starts with %r and --no-fetch forbids "
                     "downloading it (NYC Open Data %s)."
                     % (B.CROSSWALK_PREFIX[v], B.CROSSWALK_PORTAL[v][0]))
    else:
        rows.append(("NTA crosswalk", "WILL FETCH",
                     "NYC Open Data " + (a["crosswalk_id"] or B.CROSSWALK_PORTAL[v][0])))

    # Con Edison inputs: no flag can conjure these
    for path, why in CONED_INPUTS:
        if os.path.exists(path):
            rows.append((os.path.basename(path), "PRESENT", why))
        else:
            rows.append((os.path.basename(path), "MISSING", why))
            fatal.append("%s is missing. It comes from Con Edison and cannot be "
                         "downloaded: %s" % (rel(path), why))

    # the output
    out_path = os.path.join(DATA, "out", "tract_geometry_pure-%s.json" % v)
    if os.path.exists(out_path) and not a["force"]:
        rows.append(("dataset output", "EXISTS", rel(out_path)))
        fatal.append("%s already exists. It may be the copy that is live in "
                     "Dataverse.\n  Pass --force to overwrite it." % rel(out_path))
    elif os.path.exists(out_path):
        rows.append(("dataset output", "WILL OVERWRITE", rel(out_path) + "  (--force)"))
    else:
        rows.append(("dataset output", "WILL WRITE", rel(out_path)))

    # The two-outputs coupling, now decided here rather than mentioned.
    #
    # This used to compare mtimes and print a note ending "Not fixed here." It is
    # fixed here now: this script is the single producer of both outputs, so it
    # decides whether the overlay has to be rebuilt and then rebuilds it. mtimes
    # are gone -- one survives a copy or a checkout without meaning anything --
    # and the comparison is between the fingerprint stamped in the overlay and the
    # shapefile bytes on disk.
    terr = os.path.join(DATA, "service_territories.geojson")
    mine = B.coned_source_fingerprint()
    theirs = B.territory_fingerprint(terr)
    terr_action = None
    if mine is None:
        rows.append(("territory overlay", "UNCHECKABLE", "a CECONY shapefile part is missing"))
    elif not os.path.exists(terr):
        terr_action = "missing"
        rows.append(("territory overlay", "WILL BUILD", rel(terr)))
    elif theirs is None:
        terr_action = "unstamped"
        rows.append(("territory overlay", "WILL REBUILD", "no fingerprint: predates slice 6c"))
    elif theirs != mine:
        terr_action = "mismatch"
        rows.append(("territory overlay", "WILL REBUILD",
                     "stamp " + theirs[:12] + " != shapefiles " + mine[:12]))
    elif a["refresh_territories"]:
        terr_action = "forced"
        rows.append(("territory overlay", "WILL REBUILD", "--refresh-territories"))
    else:
        rows.append(("territory overlay", "PRESENT", "stamp matches " + mine[:12]))

    if terr_action:
        # No extra line here: the table row above already states it, and printing
        # it twice put a stray entry above the header.
        if a["no_fetch"]:
            fatal.append(
                "the territory overlay needs rebuilding (%s) and --no-fetch forbids it: "
                "the conversion fetches a NADCON grid for the ORU layer.\n"
                "  Drop --no-fetch, or run the builder directly and accept that nothing "
                "checks the coupling for you." % terr_action)

    out("-" * 74)
    out("PREFLIGHT  vintage %s" % v)
    out("-" * 74)
    for name, state, note in rows:
        out("  %-26s %-14s %s" % (name, state, note))
    out("-" * 74)

    return fatal, {"geo": geo, "zip": zip_path, "out": out_path, "crosswalk": found,
                   "terr": terr, "terr_action": terr_action, "fingerprint": mine}


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------
def run(argv):
    a = parse_args(argv)
    v = a["vintage"]
    out("=" * 74)
    out("update_map_data.py  --vintage %s%s" % (v, "  (dry run)" if a["dry_run"] else ""))
    out("=" * 74)

    fatal, paths = preflight(a)
    if fatal:
        raise Refuse("preflight stopped this run:\n%s"
                     % "\n\n".join("  " + f for f in fatal))
    if a["dry_run"]:
        out("\ndry run: preflight only. Nothing was written and no socket was opened.")
        return 0

    # ---- fetch -------------------------------------------------------------
    if not a["no_fetch"]:
        os.makedirs(RAW, exist_ok=True)
        url = a["census_url"] or CENSUS_URL[v]
        zip_path = os.path.join(RAW, os.path.basename(url))
        need_zip = a["refetch"] or (not os.path.exists(paths["geo"])
                                    and not os.path.exists(zip_path))
        if need_zip:
            out("\nFETCH")
            fetch(url, zip_path, "Census %s cartographic tract boundaries" % v)
        elif not os.path.exists(paths["geo"]):
            out("\nFETCH")
            out("  Census archive already staged: %s" % rel(zip_path))

        # crosswalk
        if a["refetch"] or not paths["crosswalk"]:
            portal = a["crosswalk_id"] or B.CROSSWALK_PORTAL[v][0]
            if not need_zip:
                out("\nFETCH")
            # Staging a second file beside the first would make the builder
            # refuse for ambiguity, so the current one is moved aside, not
            # deleted: it stays readable provenance for the dataset built from it.
            if paths["crosswalk"]:
                os.makedirs(SUPERSEDED, exist_ok=True)
                moved = os.path.join(SUPERSEDED, os.path.basename(paths["crosswalk"]))
                shutil.move(paths["crosswalk"], moved)
                out("  superseded %s -> %s" % (os.path.basename(paths["crosswalk"]),
                                               rel(moved)))
            stamp = datetime.now(timezone.utc).strftime("%Y%m%d")
            name = "%s_%s.csv" % (B.CROSSWALK_PREFIX[v].rstrip("_"), stamp)
            dest = os.path.join(DATA, name)
            fetch(SOCRATA % portal, dest, "NTA crosswalk (NYC Open Data %s)" % portal)
            # The sidecar belongs with the other provenance, not in Data/.
            os.makedirs(RAW, exist_ok=True)
            shutil.move(dest + ".fetch.json",
                        os.path.join(RAW, name + ".fetch.json"))
            state, found = resolve_crosswalk(v)
            if state == "ambiguous":
                raise Refuse(found)
            paths["crosswalk"] = found

    # ---- convert, if the GeoJSON is not there ------------------------------
    if not os.path.exists(paths["geo"]):
        zip_path = os.path.join(RAW, os.path.basename(a["census_url"] or CENSUS_URL[v]))
        if not os.path.exists(zip_path):
            raise Refuse("%s is absent and so is the archive it comes from (%s)."
                         % (rel(paths["geo"]), rel(zip_path)))
        out("\nCONVERT  (the one documented transformation: shp -> GeoJSON)")
        convert_zip_to_geojson(zip_path, v, paths["geo"])
        check_geojson(paths["geo"], v)
    else:
        out("\nCHECK  %s" % rel(paths["geo"]))
        check_geojson(paths["geo"], v)

    # ---- build, as a subprocess -------------------------------------------
    # ---- territories: the other half of what these shapefiles produce --------
    # Run BEFORE the builder, because the builder now refuses when the overlay's
    # stamp disagrees with the shapefiles. Doing it here is what makes this script
    # the single producer: one run, one set of shapefiles, both outputs stamped
    # with the same fingerprint.
    #
    # A subprocess, like the builder, and for a sharper reason: _make_territories.py
    # has no main() and does its work at module scope, so importing it would run it
    # as a side effect of reading its constants.
    if paths.get("terr_action"):
        out("\nTERRITORIES  (subprocess; this step needs the network, see the header)")
        out("  reason: " + paths["terr_action"])
        out("  python Data/_make_territories.py")
        out("")
        tproc = subprocess.run([sys.executable, os.path.join(HERE, "_make_territories.py")],
                               cwd=ROOT)
        if tproc.returncode != 0:
            raise Refuse(
                "_make_territories.py exited %d, so the overlay was not rebuilt.\n"
                "  The builder would refuse against a stale stamp, and building only\n"
                "  one of the two outputs is the trap this step exists to close.\n"
                "  Nothing has been written to Data/out/." % tproc.returncode)
        after = B.territory_fingerprint(paths["terr"])
        if after != paths["fingerprint"]:
            raise Refuse(
                "the rebuilt overlay carries fingerprint %s but the shapefiles hash to "
                "%s.\n  The two producers disagree, which is exactly what the stamp "
                "exists to catch.\n  Nothing has been written to Data/out/."
                % (str(after)[:16], str(paths["fingerprint"])[:16]))
        out("  overlay stamped %s, matching the shapefiles." % str(after)[:16])

    out("\nBUILD  (subprocess: the builder stays offline)")
    cmd = [sys.executable, BUILDER, "--vintage", v]
    if a["artifact"]:
        cmd.append("--artifact")
    out("  %s" % " ".join(["python", "Data/" + os.path.basename(BUILDER),
                           "--vintage", v] + (["--artifact"] if a["artifact"] else [])))
    out("")
    before = os.path.getmtime(paths["out"]) if os.path.exists(paths["out"]) else None
    proc = subprocess.run(cmd, cwd=ROOT)
    if proc.returncode != 0:
        out("\nthe builder exited %d. Nothing here overrides that." % proc.returncode)
        return 3
    if not os.path.exists(paths["out"]):
        out("\nthe builder reported success but %s is not there." % rel(paths["out"]))
        return 3
    if before is not None and os.path.getmtime(paths["out"]) == before:
        out("\nthe builder reported success but %s was not rewritten." % rel(paths["out"]))
        return 3

    size = os.path.getsize(paths["out"])
    out("=" * 74)
    out("DATASET READY")
    out("  file    : %s" % rel(paths["out"]))
    out("  bytes   : %d (%.2f MB)" % (size, size / 1e6))
    out("  sha256  : %s" % sha256_file(paths["out"]))
    out("  built from")
    out("    tracts    : %s" % rel(paths["geo"]))
    out("    crosswalk : %s" % rel(paths["crosswalk"] or "(unresolved)"))
    out("    universe  : %s" % rel(os.path.join(DATA, "tract_universe.json")))
    out("")
    out("  Upload it from the Map Layers admin card, with the field block the")
    out("  builder printed above. Nothing here touches Dataverse.")
    out("=" * 74)
    return 0


def main():
    try:
        code = run(sys.argv[1:])
    except Refuse as e:
        # Flush first: stdout is buffered and stderr is not, so without this the
        # refusal printed ABOVE the preflight table that explains it.
        sys.stdout.flush()
        print("\nREFUSED\n%s" % e, file=sys.stderr)
        sys.stderr.flush()
        sys.exit(2)
    except KeyboardInterrupt:
        print("\ninterrupted; nothing partial was left staged.", file=sys.stderr)
        sys.exit(2)
    sys.exit(code)


if __name__ == "__main__":
    main()
