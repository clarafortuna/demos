"""Verify the Con Edison handoff package the way an OPERATOR meets it.

WHY THIS EXISTS
---------------
`make_handoff_package.py`'s docstring promised this file for weeks -- "that is not
asserted here; verify_handoff_package.py unpacks the zip somewhere else and runs
each guide's commands against it" -- and the file did not exist. The August
clean-room run was done by hand, once, and then the package changed underneath it.

What went wrong in the gap is the whole argument for automating this. The
restructure moved the seven scripts from `Data/` to the package root. `README.txt`
was updated. The three operator guides were not, so every command in all three
guides read `python Data/<script>.py` and failed immediately in the shipped
package:

    can't open file '...\\coned-dac-dashboard-data-tools\\Data\\update_map_data.py':
    [Errno 2] No such file or directory

Nothing caught it, because nothing connects a command written in a guide to the
package that guide ships inside. `check_doc_claims.js` guards a different thing --
that no document claims an upload the app does not have -- and has no notion of
whether a documented command can run.

WHAT IT CHECKS
--------------
Commands are EXTRACTED FROM THE GUIDES, never hardcoded here. That is the point:
if a path drifts again, or a guide gains a command for a script that does not
ship, this fails. A hardcoded list would have passed happily through the very
defect that prompted it.

  STRUCTURE   the zip unpacks; requirements.txt and the three guides are present;
              Data/out/ ships empty; nothing from MUST_NOT_SHIP leaked.
  RESOLVES    every `python <script>` in every guide names a file that exists at
              the path the guide gives, relative to the package root. This is the
              check that would have caught the restructure.
  IMPORTABLE  each script is imported as a module inside the package, proving it
              parses AND that every module it imports ships with it. This also
              tests a claim make_handoff_package.py makes explicitly -- that the
              two imported-not-run scripts are import-safe behind an
              `if __name__ == "__main__"` guard -- so a script that grew
              top-level side effects fails here.

              `--help` was the obvious probe and it is the wrong one: this
              package's scripts do not agree on it. update_map_data.py has a
              hand-rolled parser that REFUSES `--help` ("unknown argument"), and
              build_pure_geometry_dataset.py prints usage and exits 1. Using it
              would have reported two failures that are findings about the
              scripts, not breakage in the package.
  SAFE MODE   for the scripts that have a no-write mode, the guide's own command
              is run with it: update_map_data.py --dry-run, which reports
              "Nothing was written and no socket was opened". A real run of the
              whole pipeline is deliberately NOT attempted; see below.

WHAT IT DOES NOT CHECK, AND WHY
-------------------------------
It does not build the datasets. `build_pure_geometry_dataset.py`,
`build_coned_dataset.py` and `_make_territories.py` have no no-write mode, and
`--refresh-territories` needs the network. Running the full pipeline is a
several-minute job with real outputs, and it is the operator simulation's
business, not a pre-commit guard's. This is the fast check that cannot be
skipped; it is not a replacement for running the guides.

It also cannot check the upload. The package deliberately contains nothing that
contacts the dashboard, so every guide ends at a built file.

Run:  python Coned/CLCPA/verify_handoff_package.py
      python Coned/CLCPA/verify_handoff_package.py --zip path/to/pkg.zip
      python Coned/CLCPA/verify_handoff_package.py --keep     (leave the temp dir)

Exits non-zero on any failure, so it works as a pre-commit or CI step.
"""
import argparse
import glob
import html
import os
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))
PKG_NAME = "coned-dac-dashboard-data-tools"

# Files that must never ship. Kept in step with make_handoff_package.py by the
# cross-check below, so the two lists cannot drift apart silently.
MUST_NOT_SHIP = [
    "build_geometry_dataset.py",
    "build_tract_universe.py",
    "build_payload.py",
    "retire_dead_payload_fields.py",
    "map_payload.json",
    "app.js",
    "restore_map_tract_data.js",
]

# The no-write mode each script offers. A script absent from this map is checked
# for resolution and importability only.
#
# --no-fetch is deliberately NOT added alongside --dry-run. It was, and
# update_map_data refused the pair: "Drop --no-fetch, or run the builder directly
# and accept that nothing checks the coupling for you." --dry-run alone is
# already offline and says so -- "Nothing was written and no socket was opened" --
# so the extra flag bought nothing and broke the check.
SAFE_FLAGS = {
    "update_map_data.py": ["--dry-run"],
}

# Commands that cannot be verified offline from a freshly unpacked package, with
# the reason. Skipped with the reason printed, never silently.
#
# convert_nyserda_raw needs the tract universe, which is an OUTPUT of guide 2 --
# Data/out/ ships empty on purpose, so guide 1's command genuinely cannot run
# until guide 2 has really run. That ordering is the package's design, not a
# defect, and proving it belongs to the operator simulation.
CANNOT_VERIFY_OFFLINE = {
    "--refresh-territories":
        "needs the network (the ORU layer is NAD27 and needs a NADCON grid fetched)",
}
NEEDS_GUIDE_2_OUTPUT = {
    "convert_nyserda_raw.py":
        "reads Data/out/tract_geometry_pure-<vintage>.json, which guide 2 produces; "
        "Data/out/ ships empty by design",
}

FAILURES = []
NOTES = []


def fail(check, detail):
    FAILURES.append((check, detail))
    print("  FAIL  %-10s %s" % (check, detail))


def ok(check, detail):
    print("  ok    %-10s %s" % (check, detail))


def note(detail):
    NOTES.append(detail)
    print("  --    %-10s %s" % ("note", detail))


def extract_commands(guide_path):
    """Every `python <script> ...` command a guide tells the operator to run.

    Read out of the guide's own text rather than listed here. HTML entities are
    unescaped first, or a command carrying &quot; or &amp; would be compared in
    its encoded form and silently never match.
    """
    text = html.unescape(open(guide_path, encoding="utf-8").read())
    # Strip tags so a command split across <span>s still reads as one line.
    text = re.sub(r"<[^>]+>", "", text)
    cmds = []
    for line in text.splitlines():
        line = line.strip()
        m = re.match(r"^python\s+([A-Za-z0-9_./\\-]+\.py)\s*(.*)$", line)
        if m:
            args = m.group(2).strip()
            # A trailing backslash is a shell line-continuation in the guide's
            # formatting, not an argument.
            args = args.rstrip("\\").strip()
            cmds.append((m.group(1), args))
    return cmds


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip", default=None,
                    help="package zip to verify (default: build one from this repo)")
    ap.add_argument("--keep", action="store_true", help="leave the unpacked temp dir in place")
    a = ap.parse_args()

    print("=" * 74)
    print("HANDOFF PACKAGE VERIFICATION")
    print("=" * 74)

    tmp = tempfile.mkdtemp(prefix="coned-pkg-verify-")
    built = None
    try:
        # ---- get a zip -------------------------------------------------
        zip_path = a.zip
        if not zip_path:
            built = os.path.join(tmp, "build")
            print("building a package from this repo...")
            r = subprocess.run([sys.executable, os.path.join(HERE, "make_handoff_package.py"),
                                "--out", built], capture_output=True, text=True)
            if r.returncode != 0:
                print(r.stdout)
                print(r.stderr)
                fail("build", "make_handoff_package.py exited %d" % r.returncode)
                return 1
            zip_path = os.path.join(built, PKG_NAME + ".zip")
        if not os.path.exists(zip_path):
            fail("build", "no zip at %s" % zip_path)
            return 1
        print("zip: %s (%d bytes)" % (zip_path, os.path.getsize(zip_path)))
        print("")

        # ---- STRUCTURE -------------------------------------------------
        print("STRUCTURE")
        unpacked = os.path.join(tmp, "unpacked")
        with zipfile.ZipFile(zip_path) as z:
            names = [i.filename for i in z.infolist()]
            z.extractall(unpacked)
        root = os.path.join(unpacked, PKG_NAME)
        if not os.path.isdir(root):
            fail("unpack", "the zip does not contain a %s/ directory" % PKG_NAME)
            return 1
        ok("unpack", "%d entries -> %s" % (len(names), root))

        for req in ["requirements.txt", "README.txt", "MANIFEST.txt"]:
            if os.path.exists(os.path.join(root, req)):
                ok("present", req)
            else:
                fail("present", "%s is missing from the package" % req)

        guides = sorted(glob.glob(os.path.join(root, "docs", "*.html")))
        if guides:
            ok("guides", "%d guide(s): %s" % (len(guides),
                                              ", ".join(os.path.basename(g) for g in guides)))
        else:
            fail("guides", "no guides in docs/")

        outdir = os.path.join(root, "Data", "out")
        leftovers = [f for f in os.listdir(outdir)] if os.path.isdir(outdir) else []
        if leftovers == [".keep"]:
            ok("out-empty", "Data/out/ ships empty (only .keep)")
        else:
            fail("out-empty", "Data/out/ ships %d file(s): %s" % (len(leftovers), leftovers))

        # Unpack depth. Windows refuses paths over 260 characters by default, and
        # the failure names no file: "[WinError 3] The system cannot find the path
        # specified", partway through, reading like a corrupt download. It caught
        # our own verification run when an output directory name grew by two
        # characters. Reported every run so a newly added long filename is seen
        # here rather than by an operator.
        longest = max(names, key=len)
        headroom = 260 - len(longest)
        print("  ok    depth      longest internal path is %d chars (%s)"
              % (len(longest), os.path.basename(longest)[:46]))
        print("  --    depth      so the unpack folder must stay under ~%d chars"
              % headroom)
        if len(longest) > 180:
            fail("depth", "longest internal path is %d chars, which leaves almost no "
                          "room for an unpack folder" % len(longest))

        leaked = [n for n in MUST_NOT_SHIP
                  if any(s.endswith("/" + n) or s == n for s in names)]
        if leaked:
            fail("exclusions", "file(s) that must never ship are present: %s" % ", ".join(leaked))
        else:
            ok("exclusions", "%d excluded file(s) all absent" % len(MUST_NOT_SHIP))

        # The two lists must not drift. If make_handoff_package grows an entry,
        # this verifier should be checking it too.
        pkg_src = open(os.path.join(HERE, "make_handoff_package.py"), encoding="utf-8").read()
        m = re.search(r"MUST_NOT_SHIP = \[(.*?)\]", pkg_src, re.S)
        if m:
            theirs = set(re.findall(r'"([^"]+)"', m.group(1)))
            mine = set(MUST_NOT_SHIP)
            if theirs != mine:
                fail("list-sync", "MUST_NOT_SHIP differs from the packager's: "
                                  "only there %s / only here %s"
                                  % (sorted(theirs - mine), sorted(mine - theirs)))
            else:
                ok("list-sync", "MUST_NOT_SHIP matches the packager's list (%d)" % len(mine))
        else:
            note("could not read MUST_NOT_SHIP out of make_handoff_package.py to cross-check")
        print("")

        # ---- the guides' own commands ----------------------------------
        all_cmds = []
        for g in guides:
            for script, args in extract_commands(g):
                all_cmds.append((os.path.basename(g), script, args))
        if not all_cmds:
            fail("commands", "no `python <script>` commands found in any guide -- "
                             "either the guides changed shape or the extractor is broken")
            return 1

        print("RESOLVES  (%d command(s) extracted from the guides)" % len(all_cmds))
        unresolved = set()
        for guide, script, args in all_cmds:
            p = os.path.join(root, script.replace("/", os.sep))
            if os.path.exists(p):
                ok("resolves", "%-34s %s" % (script, "(" + guide + ")"))
            else:
                unresolved.add(script)
                fail("resolves", "%s says `python %s` -- no such file in the package"
                                 % (guide, script))
        print("")

        # ---- IMPORTABLE ------------------------------------------------
        # Import every SHIPPED script, not only the ones a guide names: the two
        # that ship precisely because they are imported (build_tract_dataset,
        # build_base_map_payload) appear in no guide command, and they are the
        # ones whose absence breaks the first command an operator runs.
        print("IMPORTABLE  (imported as a module inside the package)")
        shipped = sorted(f for f in os.listdir(root) if f.endswith(".py"))
        # A script may only be imported if its work sits behind an
        # `if __name__ == "__main__"` guard. This is not pedantry: importing
        # _make_territories.py executes its whole body, which opens the output
        # file for writing and fetches a NADCON grid. An earlier version of this
        # probe imported everything, and only argparse rejecting the argv stopped
        # it from doing real work inside a verification run.
        probe = (
            "import importlib.util, sys\n"
            "p = sys.argv[1]\n"
            "sys.argv = [p]\n"                 # a module-level parser sees no flags
            "spec = importlib.util.spec_from_file_location('_probe_' + p[:-3], p)\n"
            "m = importlib.util.module_from_spec(spec)\n"
            "spec.loader.exec_module(m)\n"
        )
        # The two scripts that ship BECAUSE something imports them. The packager
        # states they are import-safe; that claim is asserted here rather than
        # trusted, because it is the thing that breaks the first command.
        IMPORTED_BY_OTHERS = ["build_tract_dataset.py", "build_base_map_payload.py"]
        for script in shipped:
            src = open(os.path.join(root, script), encoding="utf-8").read()
            guarded = re.search(r"^if __name__", src, re.M) is not None
            if not guarded:
                if script in IMPORTED_BY_OTHERS:
                    fail("imports", "%s is imported by another script but has NO "
                                    "`if __name__` guard, so importing it runs it" % script)
                    continue
                # Syntax only. Executing it would do real work.
                try:
                    compile(src, script, "exec")
                    ok("parses", "%s (no __main__ guard -- parsed, NOT imported)" % script)
                    note("%s has no `if __name__` guard: its body runs on import, "
                         "including a file write. Never `import` it." % script)
                except SyntaxError as e:
                    fail("parses", "%s does not parse: %s" % (script, e))
                continue
            r = subprocess.run([sys.executable, "-c", probe, script],
                               cwd=root, capture_output=True, text=True, timeout=300)
            if r.returncode == 0:
                ok("imports", script)
            else:
                tail = (r.stderr or r.stdout).strip().splitlines()
                fail("imports", "%s could not be imported inside the package: %s"
                                % (script, tail[-1] if tail else "(no output)"))
        print("")

        # ---- SAFE MODE -------------------------------------------------
        print("SAFE MODE  (the guide's own command, run with its no-write flag)")
        ran = 0
        for guide, script, args in all_cmds:
            if script in unresolved:
                continue
            argv = args.split()
            blocked = [why for flag, why in CANNOT_VERIFY_OFFLINE.items() if flag in argv]
            if blocked:
                note("skipped `%s %s`: %s" % (script, args, blocked[0]))
                continue
            if script in NEEDS_GUIDE_2_OUTPUT:
                note("skipped `%s`: %s" % (script, NEEDS_GUIDE_2_OUTPUT[script]))
                continue
            if script not in SAFE_FLAGS:
                note("skipped `%s %s`: no no-write mode; it writes real outputs, so it "
                     "belongs to the operator simulation" % (script, args))
                continue
            flags = [f for f in SAFE_FLAGS[script] if f not in argv]
            cmd = [sys.executable, script] + argv + flags
            r = subprocess.run(cmd, cwd=root, capture_output=True, text=True, timeout=900)
            label = "%s %s" % (script, " ".join(argv + flags))
            if r.returncode == 0:
                ok("safe-run", label)
                ran += 1
            else:
                tail = (r.stdout + r.stderr).strip().splitlines()
                fail("safe-run", "%s exited %d\n           %s"
                                 % (label, r.returncode, tail[-1] if tail else "(no output)"))
        if not ran:
            fail("safe-run", "not one command could be run in a no-write mode -- this guard "
                             "would pass an unrunnable package")
        print("")

    finally:
        if a.keep:
            print("temp dir kept: %s" % tmp)
        else:
            shutil.rmtree(tmp, ignore_errors=True)

    print("=" * 74)
    if FAILURES:
        print("FAILED: %d check(s)" % len(FAILURES))
        for check, detail in FAILURES:
            print("   %-10s %s" % (check, detail))
        print("=" * 74)
        return 1
    print("PASS: the package unpacks, and every command the guides give resolves,")
    print("      runs, and where a no-write mode exists, completes.")
    if NOTES:
        for n in NOTES:
            print("   note: %s" % n)
    print("=" * 74)
    return 0


if __name__ == "__main__":
    sys.exit(main())
