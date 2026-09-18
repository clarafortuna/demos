# Org reads, 2026-09-16 -- read-only

Three scripts used to settle the CLCPA-250 re-verification by reading the org
rather than deriving anything from git. Every org call is a `GET`. The only
`POST`s are the OAuth device-code request and the token poll, both to
`login.microsoftonline.com`. No `PATCH`, no `PublishXml`, nothing written to
Dataverse.

| script | what it read | outcome |
|---|---|---|
| `read_org_build.js` | the three web resources | never authorized; device code expired (`AADSTS70020`) before entry. Superseded by the next. |
| `read_org_and_h1.js` | the three web resources, plus H1's stored rows for 2097 and 2099 | the org serves `app.js 804f35afc7` / `styles.css 04471d05bf`, stamp and content hash agreeing, HTML referencing both. H1:2097 and H1:2099 both carry `cr2bf_schema: null` and clean rows. |
| `read_h1_2098_schema.js` | `cr2bf_schema` for `H1:2098`, one field | `null`. |

## What these reads established

The live pair is confirmed by reading the org, not by deriving it from git.

For CLCPA-250 they refuted four candidate mechanisms in turn:

- **`dacCol`'s oldest-year fallback**, the ticket's prime suspect. Already
  fixed by CLCPA-257, and moot for H1 regardless: H1's three stored schemas
  are column-compatible, differing only in column 0's label
  (`"Area"` in 2023, `"Borough / County"` in 2024 and 2025). `Grand Total`
  resolves to 3 and `DAC Repairs` to 2 whichever year is borrowed, on the
  pre-257 and post-257 code alike.
- **A missing schema on imported years.** 2097, 2098 and 2099 all carry
  `cr2bf_schema: null`, so 2098 is not distinguished by its schema.
- **A total-row label that does not match.** Both years hold a row labelled
  exactly `"Grand Total"`.
- **Non-numeric total cells.** 3 of 3 value cells are numbers in both years.

The stored rows, verbatim:

    H1:2097  [["Manhattan",979797,979797,1959594],["Queens",979797,979797,1959594],
              ["Westchester",979797,979797,1959594],["Bronx",979797,979797,1959594],
              ["Grand Total",3919188,3919188,7838376]]

    H1:2099  [["Manhattan",99,999,1098],["Queens",999,999,1998],
              ["Westchester",99,99,198],["Bronx",9999,9,10008],
              ["Grand Total",11196,2106,13302]]

So the symptom is not reproducible from stored data plus the composed layer on
build `804f35afc7`. What survives is a structural fact, and it is what
CLCPA-250 was built against tonight: `composePayloadFromRows` runs ONCE, at
boot. Nothing recomposes after a save, so `kpis.reported[].values` holds what
was computed at init and a year whose data arrives later has no KPI entry
until a reload.

Whether that gap is the WHOLE of the reported symptom is not settled here. It
needs a hosted observation on a clean load (2097, Section H header), which is
Emely's and is part of the 2026-09-17 pass.

## 2026-09-18: `read_store_2098_2099.js`, the CLCPA-278 round 3 store measurement

A fourth read, on a later GO and for a different ticket, kept here because it is
the same shape: one filtered `GET`, nothing written.

| script | what it read | outcome |
|---|---|---|
| `read_store_2098_2099.js` | the ingest override rows for 2098 and 2099 | 51 rows. 2,100 value cells, 112 string cells, **44 numeric-looking strings**, all in A3/A4 2098 column 1. Full per-cell listing in `store-read-2098-2099.txt`. |

It settled condition 2 of the CLCPA-278 round 3 ruling, which required the
zero-effect measurement to cover the ORG STORE and not only `payload.json`.
The answer was NOT zero: those 44 cells change behaviour under the shared-reader
change. Ruled audit scaffolding, accepted as disclosed, and named in the
CLCPA-224 residue list. See `../CLCPA-278-store-measurement.md`.

Two things in this script that the earlier three did not have, both worth
copying:

- **It audits its own text before requesting a device code**, and says plainly
  that one non-`GET` exists -- the device-code exchange itself, which a `POST`
  is the only way to make. An earlier draft of that audit built the forbidden
  verbs out of concatenated characters so the file would not trip over its own
  vocabulary, which is a gate written to pass rather than to catch. The audit
  now excises one visible delimited region of itself and nothing else.
- **The predicate is sliced from the shipped `app.js`**, not retyped, and
  behaviour-checked before it counts anything. A retyped copy of the rule under
  test is how a measurement comes back agreeing with itself.

Its first attempt expired unentered (`AADSTS70020`) and read nothing, exactly as
`read_org_build.js` did in September.

## Re-running

Each script requests its own device code and prints it. They read and print;
they do not write. A device code lives about 15 minutes, and an unentered one
fails with `AADSTS70020` and no side effect at all.
