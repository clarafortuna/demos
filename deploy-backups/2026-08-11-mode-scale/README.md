# cr2bf_dactest pre-deploy snapshot — 2026-08-11 (mode-change scale recompute)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev) as it was **immediately
before** this deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `592b8e8`
(PR #135, recompute the draft scale on every mode change).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 726,806 | yes → 726,886 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 250,293 | **no — unchanged** |

## These files were RECONSTRUCTED, and here is why

Read this before trusting the folder, and then trust it.

The deploy script ran **twice**. The first run authorized, deployed, and archived
the correct pre-deploy bytes here. The device code then appeared to be rejected
on a second entry -- it had in fact already been consumed by the successful run --
so a second run was started. It correctly found that nothing differed and pushed
nothing, but it had already overwritten this folder with the **post-deploy**
bytes before reaching that conclusion. The rollback point was destroyed by the
backup mechanism itself.

The files here were rebuilt by running `Data/stamp_build.js` over the tree at
`main` = `221c2d5`, the commit the previous deploy shipped, and verified against
the sha256 prefixes the first run had logged:

| file | reconstructed | first run logged | |
|---|---|---|---|
| `app.js` | `177e87200857ad84…` | `177e87200857ad84…` | match |
| `styles.css` | `f9490ed2f1e9167a…` | `f9490ed2f1e9167a…` | match |
| `ExecutiveDashboard.html` | `47a20b719cace331…` | `47a20b719cace331…` | match |

Byte counts match too, and the reconstructed `app.js` stamps to build
**`a3d036a476`** -- the id the previous deploy reported. Stamping is
deterministic over a fixed tree, which is what makes this reconstruction a
verification rather than a guess.

**The live app was never at risk.** The second run pushed nothing; only this
folder was affected.

### The lesson, for the next deploy

A deploy that reports "nothing differs" must not overwrite an existing backup
folder. Two cheap fixes, either sufficient:

- refuse to write into a `BACKUP_DIR` that already exists, unless told to
- decide what to archive **after** the comparison, and skip the archive entirely
  when there is nothing to push

Until one is in place, do not re-run a deploy whose outcome is unknown: read the
log first. The log of a successful run ends with `deploy complete`, and that is
the check.

## The console build id verifies this deploy

| file | id | previous |
|---|---|---|
| `app.js` | **`5c4f245e5b`** | `a3d036a476` |
| `styles.css` | `f9490ed2f1` | **unchanged** |

```
[DAC dashboard] build 5c4f245e5b
```

A rolled-back client reports `a3d036a476`.

## What this deploy changes

Leaving **discrete** mode for **manual** in the layer upload form put three
different counts on one screen: 5 legend swatches, 3 data bars, a stepper reading
5, and a source line reading "3 quantile classes".

The mode-change handler had three branches and only `manual` failed to call
`mlRecomputeDraftScale`. It prefilled from whatever scale was already there, and
coming out of discrete that was the 3-class scale. The manual prefill arrived two
values short as a result, which the break validator then rejected with "All 4
break values are needed" -- so the state could not be saved, and nothing wrong
was ever persisted.

`mlRecomputeDraftScale` already did both halves in the right order, so the fix
deleted the special case: all three branches became one call. **16 lines out, 1
in.**

Nothing about `cr2bf_RampConfig`, persistence, hydration or how the map draws
changed. Only the manual transition behaves differently, and only by being
correct.

**Nothing was uploaded**, so the hosted data state is unchanged: `nyserda_dac
v1.0` live on `tract_geometry pure-2010`.

## Restoring

`app.js` and `ExecutiveDashboard.html` restore **together** -- the HTML's `?v=`
stamp for `app.js` matches only the copy in this folder. `styles.css` needs no
action; the live copy already matches the one here.

```
PATCH https://org9076e69b.crm.dynamics.com/api/data/v9.2/webresourceset(<webResourceId>)
If-Match: *
Content-Type: application/json

{ "content": "<base64 of the saved file>" }
```

then

```
POST https://org9076e69b.crm.dynamics.com/api/data/v9.2/PublishXml
{ "ParameterXml": "<importexportxml><webresources><webresource>{<webResourceId>}</webresource>…</webresources></importexportxml>" }
```

**Clean rollback.** Nothing about storage or rendering changed, so every saved
layer reads and draws identically on either build. A rolled-back client reports
`a3d036a476` and gets the discrete-to-manual mismatch back.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
