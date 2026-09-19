# CLCPA — Migration path

```
clarafortuna/demos                    integration candidate            standalone repo
Coned/CLCPA/…            ──────▶      clcpa-integration-candidate  ──▶  clcpa-executive-dashboard
(legacy line, intact)                 (local branch, not pushed)        (not created yet)
```

## Where we are

The integration candidate is a **local branch off the engineer's own tip**, not off `main`:

```
75e8eec  CLCPA-278 round 4   <- engineer baseline, the tip of the only live stack
  ecffca4  security: escape payload-derived values and encode OData filter literals
  4ac9725  security: permanent regression suites
  2f71cc7  tools: delta reconciliation and a one-command security run
  684959d  portability: the test estate runs off one machine
```

Branching from `75e8eec` rather than `origin/main` means her three unmerged r4 commits are **inside**
the candidate by construction, not re-applied on top of it. That is why the ledger records them as
*inherited* — there is no porting step to get wrong.

Her branches are untouched. Nothing has been pushed, merged, reset or rebased.

## Absorbing the rest of her week

```bash
node tools/reconcile.js status   # outstanding commits on her live tip
node tools/reconcile.js impact   # each one classified, with security-control flags
#   … review, port, sh tools/run_security.sh …
node tools/reconcile.js mark <sha>
```

The ledger in `tools/reconciled.json` records `engineer commit → integration commit → validation`, and
is committed so it outlives the machine that produced it. The point is that each delta is a small
review, never a re-migration.

## What the standalone repository should contain

**MUST MOVE** — the deployed surface and everything that proves or produces it:
`ExecutiveDashboard_dev/{app.js, styles.css, ExecutiveDashboard.html, payload.json, logo/}`;
`Data/` pipeline, checkers and `stamp_build.js`; `tickets/_kit/`; the `suite_*` / `mut_*` estate;
`tools/`; `docs/`; `MIGRATION_READINESS.md`; the newest deploy script and manifest as the contract.

**SHOULD MOVE**: `data-sources.html` and `sources-update-guide.html` (provenance, useful in a security
review); `Data/out/*.json` published datasets, via LFS; the three `Draft documents` PDFs; the operator
guides.

**ARCHIVE, do not move**: `deploy-backups/` — 102 waves, each holding a full ~1.25 MB `app.js`, which
is the bulk of repository weight. Keep the newest two as format exemplars. Also the one-off evidence
scripts (`probe_*`, `diag_*`, `seed_*`), and the nine scripts that perform live org reads with
device-code auth — archive those *explicitly*, and never let their names match a CI discovery pattern.

**DO NOT MOVE**:

- `index.html` — a client-side password gate with the password in source *and* in commit message
  `10cd12d`. Not deployed; carrying it imports a guaranteed secret-scanner hit for a control that
  protects nothing in the product.
- `map_payload.json` — 4.8 MB, dead at runtime since slice 5d removed the file-served map.
- `ExecutiveDashboard_Test/`, `ExecutiveDashboard/`, `Dac_Dashboard_V1/`, `Coned/Dac_Dashboard/` —
  older copies. Carrying them forward re-creates exactly the confusion that cost the first week of
  this engagement.
- The loose demo HTML, stock photography and `background.mp4` under `Coned/CLCPA/`.
- Other clients (`Clara/`, `Innovation/`, `Travel/`, `Veolia/`) and the demo-site `CNAME`.
- The top-level `/CLCPA/` solution source and its three ZIPs — a different artefact class.

## Why `.clcpa-root` makes the move mechanical

Path resolution anchors on a marker file at the **project** root, not on `.git`. Today that marker is
at `Coned/CLCPA/.clcpa-root`; in the standalone repo it sits at the root. The same resolver answers
correctly in both layouts, so **no test or tool needs editing when the project moves** — only
`tools/project_root.js` learns that the project root and the repo root have become the same directory.

That is the whole design intent: the migration becomes a copy plus one file, not another discovery
project.

## Open before the move

1. **A ticket number** for the security change — the branch deliberately carries none rather than
   inventing one.
2. **Which history to carry.** A clean-slate initial commit loses attribution but avoids dragging 102
   deploy backups and four unrelated clients through `filter-repo`. Recommendation: clean slate, with
   `demos` retained read-only as the historical record, *plus* a committed mapping so
   `engineer commit → integration commit` stays answerable.
3. **Suite BASE commits.** 94 suites resolve a pinned revision via `git show`. Those shas only exist in
   `demos` history. Either carry history, or vendor each BASE file as a fixture and swap `execSync`
   for `readFileSync` — the second also removes `child_process` from the test path.
4. **The environment question.** There is one org in this repository and it is the vendor's. That has
   to be answered before CI can target anything. See `HANDOFF.md`.
