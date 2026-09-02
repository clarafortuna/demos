# cr2bf_dactest pre-deploy snapshot, 2026-08-28 (CLCPA-143 item b, payload.json)

Byte-exact state of the live `cr2bf_dactest/payload.json` web resource in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the micro-deploy. This is the rollback point for it.

**Source deployed: branch `main` @ `e26f09b`** (merge of PR #174,
`clcpa-143-item-b-narrative`, commit `f1bf0b6`).

This is a **payload-only micro-deploy**. `app.js`, `styles.css` and
`ExecutiveDashboard.html` were not targets, so **the build id did not change**
and remains `342094b187` from the item (a) deploy earlier the same day. The
verification for this deploy is the read-back hash below, not a build id.

## Rollback

Restoring means PATCHing the `payload.json` in this folder back to
`webresourceset(7d151fe9-3c64-f111-ab0c-7c1e521c7110)` as base64, then
`PublishXml`. Those bytes are the pre-edit version:

| | |
|---|---|
| bytes | 296,646 |
| sha256 | `8d606ecb9a003f506f679b2dff741094df9f1ad63b7bebaa58b81f4720aff6dd` |
| carries the old `(43.5%)` figure | yes, so a rollback genuinely restores prior behaviour |

Two independent copies of these exact bytes exist: this folder, archived from the
live resource during the deploy, and the copy saved earlier by the read-only
fingerprint run. Verified byte-identical to each other.

## What was pushed, and how it was verified

| | |
|---|---|
| local bytes | 296,638, sha256 `4757f60e896850ca857f9291573faa7abf27c0f4372daf4d64069915acfb0c16` |
| **read-back after publish** | 296,638, sha256 `4757f60e896850ca857f9291573faa7abf27c0f4372daf4d64069915acfb0c16` |
| result | **hash confirmed, and byte-identical on a full comparison** |

Verified by **SHA256, not by byte count**. This edit removes 8 bytes from a 296KB
file, so a truncated or re-encoded upload could easily land on a plausible size;
the hash is the only check that proves the bytes are the intended ones.

Three gates ran before any write, each able to stop the deploy:

1. the local file had to hash to `4757f60e...`, the version established by the
   edit script, so no unverified bytes could be pushed
2. the id had to resolve **by name** to `cr2bf_dactest/payload.json`
3. the live content had to hash to `8d606ecb...`, the version established by the
   read-only fingerprint. If anything had changed it in between, the run would
   have stopped rather than overwriting someone else's change

Live `modifiedon` before this deploy was `2026-06-18T21:47:43Z`, consistent with
no deploy in this working sequence ever having touched it.

## What shipped

CLCPA-143 item (b): the hardcoded `43.5%` is removed from the
`ev_equity_ratio` narrative in `kpis.analytical`. It was J9/2024's derived DAC
share baked into prose, and it drifts silently as data changes.

The live narrative now reads:

> DAC share of EV plug installations divided by the DAC share of residential
> customers. A ratio of 1.0 = parity. Below 1.0 = under-served; above 1.0 =
> over-indexed (a positive equity outcome).

Confirmed by parsing the **read-back live bytes**, not just the local file.

No figure moved. Compared against the fingerprinted live payload: `tables`,
`kpis.reported` and `charts` are all deep-equal, and blanking that one narrative
on both sides makes the two payloads identical.

## Where this is visible

**Nowhere in the hosted dashboard.** The `narrative` field has **zero** readers
in `ExecutiveDashboard_dev/app.js` and zero in `ExecutiveDashboard.html`. Its
only readers live in `Coned/CLCPA/Dac_Dashboard_V1/`, a separate and out-of-scope
build.

So this change is **preventive**: it removes a stale figure from the data so that
if narratives are ever surfaced, they cannot carry a number that has already
drifted from the value the dashboard derives.

## Divergence to know about

Only the `_dev` copy was edited, per the `_dev`-only guardrail.
`Coned/CLCPA/ExecutiveDashboard/payload.json` and the other repo copies still
carry the old string, so `_dev` and the client copy now differ by these 8 bytes.
That divergence is intentional. Note also that the test harnesses read the
**client** copy rather than `_dev`; no test was ever wrong, because the two were
byte-identical until now, but the coupling is worth knowing.
