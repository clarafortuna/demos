# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (HVI presentation)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `e73184d`
(PRs #104 + #105 — HVI presentation, and `hvi` out of the geometry pipeline).
Fourth and last deploy of the day.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 673,622 | yes → 682,652 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 241,272 | yes → 242,815 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |

The HTML is the same length either side and was still replaced: the `?v=` stamps
changed with the two files they point at.

## Build ids

| file | id | previous |
|---|---|---|
| `app.js` | **`86e805d661`** | `27db48866b` |
| `styles.css` | `b968d47a4f` | `88e20227a9` |

Both moved, so the ordinary console check works for this deploy — unlike the
previous two, where a CSS-only and then an HTML-only change left the `app.js`
hash untouched.

## What this deploy changed

Render only. **No dataset or geometry row was uploaded by this deploy**, so at
the moment it completed the hosted data state was unchanged: `nyserda_dac v1.0`
live on `tract_geometry pure-2010` (still the 9-property build), `pure-2020`
published, `2.0-demo` inactive.

- **The HVI row leaves the tract tooltip**, behind `SHOW_TRACT_HVI_LINE`. Heat
  Vulnerability is a saved layer now with its own provenance; the tract tooltip
  was stating it a second time from a source that could not say where it came
  from.
- **Saved layers get their own hover tooltip** — value field, value, layer name.
  The precedence rule lives in `mlWantsInteractive`: DAC criteria on, the tract
  tooltip answers; DAC criteria off with exactly one layer on, that layer
  answers; two or more on, none of them does, because the topmost would silently
  answer for the others.
- **Legend numbers are humanized** — `2848.9` renders as `2.8k`, `73.02` as
  `73`. Display only; stored values keep full precision.
- **The legend card sheds its provenance into an (i) popup**, which also carries
  the exact class boundaries. Those had never been shown next to the ramp,
  because six numeric labels do not fit across a 221px panel.

### The paired data change, which this deploy does NOT perform

`main` also carries the rebuilt geometry datasets with `hvi` removed —
8 properties instead of 9, 147 KB smaller for 2010 and 137 KB for 2020. Those
are **uploaded through the admin card, not deployed as web resources**, so they
reach the hosted app only when someone uploads them.

Until then the app runs the new render against the old 9-property geometry,
which is correct and shows nothing different: the tooltip line is gated by the
flag, not by the property's absence.

**When those files are uploaded, `cr2bf_FieldCount` must be set to 8.** The app
cross-checks the record against the file and refuses the dataset outright with
`record FieldCount (9) disagrees with the file (8)`.

## Restoring

All three must be restored **together**: `styles.css` styles markup only this
`app.js` emits, and the HTML's `?v=` stamps only match the pair they were
stamped for.

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

A rolled-back client reports `build 27db48866b`. Rolling back brings back the
HVI row in the tract tooltip, removes saved-layer tooltips, returns the long
provenance text to the legend card, and restores the un-humanized numbers.

It touches **no** uploaded dataset or geometry row. Note the asymmetry: if the
8-property geometry has been uploaded by then, a rolled-back app will find no
`hvi` property and still show no HVI row in the tract tooltip. Reversing that
half means re-uploading the 9-property geometry, which is a separate action in
the admin card.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
