# CLCPA Executive Dashboard — Security

## The boundary

**Dataverse is the only authorization boundary.** The app holds no token, no key, no service identity.
Every request carries the signed-in user's own cookie (`credentials:'same-origin'`), so bypassing any
UI control gains nothing the user could not already do with that cookie.

Privileges are read from the platform, not assumed — `EntityDefinitions(…)?$select=Privileges` for the
real names, then `RetrieveUserPrivilegeByPrivilegeName` per user — and the probe **fails closed**. The
app's own log line states it: *"The UI gate is convenience; Dataverse enforces."*

Privilege names use **SchemaName casing** (`prvReadcr2bf_DACIngestTestTableData1`). A hand-built
lowercase name does not exist, the probe fails, and every control it guards disappears **silently**.
This has been hit once. Never construct these; read them.

## Controls this project maintains

| Control | Where | Proven by |
|---|---|---|
| HTML text escaping on report cells | `renderTable` body cell | `suite_xss_table_cells` |
| HTML escaping on payload-derived labels | C2 / E1 / F3 / H1 renderers | `suite_label_sinks` |
| Re-escaping on `dataset` read | Section E/F/H tooltips | `suite_xss_tooltip_dataset` |
| OData literal + URL transport encoding | `odataLiteral`, 3 `$filter` sites | `suite_odata_encoding` |
| `dataset.key` charset guard | `dsValidateDoc` (indicators family) | `suite_dataset_key` |
| No user-visible change from escaping | 149 real table-years | `suite_render_equivalence` |
| The controls can actually fail | 9 mutants | `mut_security` |

`sh tools/run_security.sh` — no arguments, no environment. 125 assertions.

### Two things that are easy to get wrong here

**`dataset.*` returns the DECODED value.** Escaping a `data-` attribute does not protect a tooltip that
reads it back into `innerHTML`; the browser undoes the escaping in between. Both sides are needed, for
different reasons: write-side stops attribute breakout, read-side stops markup execution.

**Quote-doubling and URL encoding are different properties.** `v.replace(/'/g,"''")` is correct OData
literal escaping and is kept. It runs on the raw string, while percent-decoding happens later at the
transport layer — so `%27` is not a quote when the doubling inspects it and *is* one by the time
Dataverse parses. `odataLiteral` does both, and **the order is load-bearing**: double first, encode
second. Encoding first would percent-encode the doubled quotes into something the literal rule never
produced.

## Deliberately not escaped

- Section D/G/J labels, tornado `metric`/`source`, F3 tile labels, both `href` sinks — **string
  literals**, each traced to its caller. Escaping them is churn that hides which sinks carry untrusted
  data.
- `boroughColors[b.name]` — the **lookup key** stays raw; escaping it silently breaks the palette. The
  rendered name beside it *is* escaped. Pinned by `suite_label_sinks` sections C and D so a future
  "escape everything" sweep is caught.

## Live-data evidence

One authenticated read-only session against `org9076e69b`, **9 GETs, 0 writes**:

```
207 records · 8,873 cells · 2,992 string cells · 0 JSON parse failures
pre-encoded entities: 0        HTML tags: 0
evidence hash 07a6b823c2298f75…   (live-rows-scan-2026-09-19.json)
```

Reconciles independently: 52 tables × 3 report years (156) + 51 override rows for 2098/2099 = **207**.
This is what makes the escaping change provably invisible to users on real data, not just on
`payload.json`.

## Residual risks — re-validated at the integration HEAD

| Item | Classification | Evidence | Blocks deploy? |
|---|---|---|---|
| **Org-level auditing disabled** | Defense-in-depth gap | `MIGRATION_READINESS.md` Q4 — off at the *org* level, so `cr2bf_dacmaptractdata` is configured to audit and records nothing. Compounds the next row: a direct-API bypass leaves no trace anywhere. | **Go-live item** |
| **CSV formula injection** | Confirmed (low) | `csvCell` quotes correctly; **0** neutralisation of a leading `= + - @`. Exported names arrive from uploadable GeoJSON. | No |
| **Unpinned CDN, no SRI** | Confirmed supply-chain | 3 `unpkg.com` references, no `integrity`; `@turf/turf@7` floats on a major version. Vendoring closes it and yields the first SBOM. | No |
| **Client-only destructive guards** | Defense-in-depth gap | `isYearProtected` — 2 call sites, commented "last line of defense". Accurate about the client, which is the problem. | No |
| **`window.Dash`** | Defense-in-depth gap | 1 unconditional assignment. No privilege gain, but it shortens any future XSS to an authenticated write. Nothing depends on it at runtime. | No |
| **`escMap` does not escape `'`** | Defense-in-depth gap | 11 uses. Values *are* untrusted (borough, neighbourhood, uploaded layer name) but **0** land in a single-quoted attribute, so the gap is not reachable today. | No |
| **Ad-hoc `replace(/"/g,'&quot;')`** | Maintainability | 6 occurrences. Escapes `"` but not `&`. Values are literals today; the risk is that the pattern is copied. | No |

None is patched here. Bundling unrelated fixes into a security changeset is how a reviewable change
stops being reviewable.

## Concurrency, not a vulnerability but a data-integrity risk

The Dataverse read cache is never invalidated after `init`, and writes are fire-and-forget with no
ETag or optimistic concurrency. **Two concurrent editors overwrite each other with no conflict
signal.** Worth a ticket in its own right.
