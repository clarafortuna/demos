# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (generic [hidden] guard)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `55ffd63`
(PR #102, generic `[hidden]` guard). Second deploy of the day; the first was
`2026-08-07-simplify`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 239,782 | yes → 241,272 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,165 | yes → 11,165 |
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 673,622 | **no — untouched** |

`app.js` is archived here anyway, so this folder is a complete picture of the
live app rather than a partial one.

## Build ids, and why the usual client check does not work for this deploy

| file | id |
|---|---|
| `app.js` | `27db48866b` — **unchanged from the previous deploy** |
| `styles.css` | `88e20227a9` (was `5323135324`) |

This slice changed CSS only, so `app.js` hashes to exactly what it did before
and the console still prints `build 27db48866b` either side of the deploy. The
usual check — match the console id against the deploy output — **cannot tell
this deploy apart from the one before it.** Check the stylesheet stamp instead:

```js
document.querySelector('link[href*="styles.css"]').getAttribute('href')
// -> styles.css?v=88e20227a9   (rolled back: styles.css?v=5323135324)
```

The lesson generalises: the console id verifies `app.js` only. Any CSS-only or
HTML-only deploy needs the stamp on the resource that actually changed.

## What this deploy changed

One CSS rule, plus the removal of seven now-redundant ones. **No app.js change,
no resolver change, nothing uploaded** — the hosted data state is untouched:
`nyserda_dac v1.0` live on `tract_geometry pure-2010`, `pure-2020` published,
`2.0-demo` inactive.

`styles.css` gains, at the very bottom of the file:

```css
[hidden] { display: none !important; }
```

The retired **Edit map files** nav entry shipped `hidden` in markup on
2026-08-06 and rendered on every build since, because `.nav-item { display:
flex }` outranks the browser's own `[hidden] { display: none }` — any author
declaration beats a UA one at any specificity. Same mechanism as the built-in
HVI row. One rule now covers the class of bug, and seven per-class guards
(`.dac-tract-detail`, `.dac-td-note`, `.dac-map-eapbox`, `.dac-map-terr-opt`,
`.ml-legendbox`, `.ml-overlay`, `.ml-ramp-reset`) collapse into it.

**The bottom of the file is not cosmetic.** Seven rules are `!important` *and*
specificity `(0,1,0)`, tying with this one — `.dac-map-card`, `.section-pane`,
`.exec-shares-grid`, `.exec-shares-grid-4`, `.dumb-row`, `.dumb-axis`,
`.dumb-axis-inner`. Ties break on source order, so from the top the rule loses
to all seven. `Data/check_hidden_guard.js` in the repo asserts the position as
well as the presence, for exactly this reason.

The only visible change: the **Edit map files** entry leaves the sidebar.

## Restoring

`styles.css` and `ExecutiveDashboard.html` must be restored **together** — the
HTML's `?v=` stamps only make sense alongside the stylesheet they were stamped
for. `app.js` needs no action; the live copy already matches the one here.

For each row, PATCH the content back and publish:

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

A rolled-back client reports `styles.css?v=5323135324`. Rolling back brings the
**Edit map files** entry back to the sidebar and reinstates the seven per-class
guards. It touches **no** uploaded dataset or geometry row, and no application
logic.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
