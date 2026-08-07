# cr2bf_dactest pre-deploy snapshot — 2026-08-07 (origin-conditional page gate)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `ccce6ee`
(PR #103, converter + origin-conditional gate). Third deploy of the day, after
`2026-08-07-simplify` and `2026-08-07-hidden-guard`.

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,165 | yes → 11,856 |
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 673,622 | **no — untouched** |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 241,272 | **no — untouched** |

`app.js` and `styles.css` are archived here anyway, so the folder is a complete
picture of the live app rather than a partial one.

## No build id moved, and no id-based check can verify this deploy

| file | id |
|---|---|
| `app.js` | `27db48866b` — unchanged |
| `styles.css` | `88e20227a9` — unchanged |

Neither file was touched, so the `?v=` stamps in the HTML did not move either.
The HTML differs by the gate script alone. **Both the console build id and the
stylesheet stamp read identically either side of this deploy**, so neither can
distinguish it. The verification is the effect: opening the hosted app must go
straight to the dashboard with no password screen.

That is now twice in a row that the id check could not verify a deploy. The
console id verifies `app.js` and nothing else.

## What this deploy changed

The page password gate now applies only **off** `*.crm.dynamics.com`:

```js
if (!/\.crm\.dynamics\.com$/.test(location.hostname) &&
    sessionStorage.getItem('dac_authenticated') !== 'true') {
  window.location.href = 'index.html';
}
```

Inside Dataverse the Microsoft login and the privilege checks already decide who
reaches the page, so a second password bought nothing. On the public demo origin
it is the only access control there is and it stays.

**No app.js change, no CSS change, nothing uploaded.** The hosted data state is
untouched: `nyserda_dac v1.0` live on `tract_geometry pure-2010`, `pure-2020`
published, `2.0-demo` inactive.

### What this gate never did, and still does not

It redirects **this page**. It has never protected the data files beside it,
which are directly fetchable on a public origin whatever the gate does. That is
a separate and larger issue, reported and awaiting a decision. Do not read the
gate's presence — here or on the public origin — as protection of anything but
the page itself.

## Restoring

`ExecutiveDashboard.html` restores on its own: the `?v=` stamps in this snapshot
match the `app.js` and `styles.css` that are already live, so no other resource
needs touching.

```
PATCH https://org9076e69b.crm.dynamics.com/api/data/v9.2/webresourceset(77151fe9-3c64-f111-ab0c-7c1e521c7110)
If-Match: *
Content-Type: application/json

{ "content": "<base64 of the saved ExecutiveDashboard.html>" }
```

then

```
POST https://org9076e69b.crm.dynamics.com/api/data/v9.2/PublishXml
{ "ParameterXml": "<importexportxml><webresources><webresource>{77151fe9-3c64-f111-ab0c-7c1e521c7110}</webresource></webresources></importexportxml>" }
```

Rolling back brings the password screen back to the hosted app. It touches **no**
uploaded dataset or geometry row, and no application logic. Because no build id
changes, confirm a rollback by the effect — the password screen returns — not by
an id.

Take the base64 from the file **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed — check it before and
after a restore.
