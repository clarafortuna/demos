# cr2bf_dactest pre-deploy snapshot — 2026-08-13 (kind whitelist + chunk threshold)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `1b6b5f5`,
carrying PR #146 (slice 6a, the dataset-kind whitelist) and PR #147 (the chunk
threshold lowered to 1 MB).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 748,791 | yes → 753,314 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 250,881 | **no — unchanged** |
| `cr2bf_dactest/map_payload.json` | `9a93efd4-296b-f111-ab0d-7c1e521c7110` | 4,794,147 | **no — unchanged** |

## Build id

| file | id | previous |
|---|---|---|
| `app.js` | **`4c07c86f61`** | `adbfcbda82` |
| `styles.css` | `6ea0bb1891` | **unchanged** |

```
[DAC dashboard] build 4c07c86f61
```

## What this deploy changes, and what it deliberately does not

**Nothing on screen.** Both changes are invisible in normal use: no map, tooltip,
legend or layer behaviour is touched. That is the honest framing for a verifier.

### 6a: the dataset kind is now an explicit whitelist

`dsDocKind` used to read

    return (doc && doc.kind === 'geometry') ? 'geometry' : 'indicators';

so ANY value that was not `geometry` came back as `indicators`. The guarantee that
a file cannot be filed as the wrong family held only while there were exactly two
kinds. Demonstrated on the previous build: a dataset declaring `kind: "weather"`
went live as an indicator set.

Now the function returns the declared family, or null for anything unrecognised,
and both gates refuse before measuring, so the message names the reason rather
than "the data file has no tracts.geoids array".

**Absent `kind` still means indicators, and that is the live data rather than
tidiness**: `nyserda_dac v1.0` and `v2.0-demo` carry no `kind` at all, so a
stricter rule would have refused the dataset drawing the map. `territories` is
recognised but not yet supported, so an operator gets "recognised but cannot yet
use" until slice 6d.

### #147: the chunk threshold is 1 MB, not 4 MB

Chosen on evidence rather than caution. `MaxSizeInKB` reads 131,072 (128 MB) on
both file columns, so the column ceiling was never the constraint. The constraint
was which PATH carries the biggest payload:

- the territory overlay is 3,484,369 bytes, **4,645,828 once base64-encoded** --
  the largest single request this app would ever make
- the largest single PATCH it has really made is about 2.1 MB encoded
- the chunked path is **proven in this org**: the saved `heat_vulnerability_index`
  layer is ~4.34 MB and has been uploading through it all along

**Consequence, asserted rather than discovered:** dataset uploads now chunk too --
the geometry file at 1,587,241 bytes and the indicator file at 1,181,337 each
become init plus exactly ONE chunk. Saved layers under 1 MB are unchanged; those
over 4 MB are unchanged; those between 1 and 4 MB change path and were asserted to
read back byte-identical.

`dataset_chunk_guard.js` drives a real upload through the admin card, which no
suite did before -- `geom_ui` only staged the preview and `ds_test` seeded rows --
so this path previously had nothing watching it.

**Nothing was uploaded to Dataverse tables**, so the hosted data state is
unchanged: `nyserda_dac v1.0` live on `tract_geometry pure-2010`, 6 dataset rows,
2 saved layers.

## Restoring

`app.js` and `ExecutiveDashboard.html` restore **together** -- the HTML's `?v=`
stamp for `app.js` matches only the copy in this folder. `styles.css` and
`map_payload.json` need no action.

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

**Clean rollback, with two things it takes back.** A rolled-back client reports
`adbfcbda82`, accepts a dataset declaring an unrecognised `kind` as indicators
again, and sends dataset uploads as a single PATCH again. Nothing about stored data
changes either way: both are about validation and transport, not content. Every
dataset and layer already in Dataverse reads identically on either build.

Take the base64 from the files **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
