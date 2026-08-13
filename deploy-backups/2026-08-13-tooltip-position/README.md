# cr2bf_dactest pre-deploy snapshot — 2026-08-13 (tooltip placed before revealed)

Byte-exact state of the live `cr2bf_dactest/` web resources in
`org9076e69b.crm.dynamics.com` (Clara Fortuna Dev), captured **immediately
before** the deploy. This is the rollback point for it.

Deployed from `Coned/CLCPA/ExecutiveDashboard_dev/` at `main` = `37925fd`
(PR #144 plus the trigger-datum commit merged on top).

| Web resource | Web resource id | Bytes | Replaced |
|---|---|---|---|
| `cr2bf_dactest/app.js` | `79151fe9-3c64-f111-ab0c-7c1e521c7110` | 744,522 | yes → 748,791 |
| `cr2bf_dactest/ExecutiveDashboard.html` | `77151fe9-3c64-f111-ab0c-7c1e521c7110` | 11,856 | yes → 11,856 |
| `cr2bf_dactest/styles.css` | `7b151fe9-3c64-f111-ab0c-7c1e521c7110` | 250,881 | **no — unchanged** |
| `cr2bf_dactest/map_payload.json` | `9a93efd4-296b-f111-ab0d-7c1e521c7110` | 4,794,147 | **no — unchanged** |

## Build id

| file | id | previous |
|---|---|---|
| `app.js` | **`adbfcbda82`** | `00b8ba7881` |
| `styles.css` | `6ea0bb1891` | **unchanged** |

```
[DAC dashboard] build adbfcbda82
```

## What this deploy changes

**The tract and overlay tooltips are placed before they are revealed.**

Showing and positioning had been two different handlers: `mouseover` filled the
tooltip and set opacity 1, while `mousemove` was the only thing that ever assigned
`left`/`top`. On a mount where no move event is delivered, that revealed a fully
populated, fully opaque tooltip at its **static** position -- `left: 0`,
`top` = wrapper height, immediately below the map -- off screen at most scroll
positions.

Reported as "DAC criteria tract tooltips stop working", reproduced 0 of 4 with a
deliberate protocol, and captured from the broken hover with devtools closed:

```
opacity "1", contentLen 1056, left "0px", top "680px",
rect {x:245, y:1094}, wrapper {x:245, y:414, h:680}, inViewport FALSE
```

`left: "0px"` is the proof: `positionTooltipAt` clamps x and y to >= 4, so it
cannot emit 0. Those were the element's untouched static coordinates.

**The trigger, measured on the hosted boot mount with devtools closed:**

```
mouseover: 618    mousemove: 0    mouseout: 0
```

618 enter events across tract paths and not one move event delivered to an
interactive layer. At that volume move delivery is dead on that mount, not merely
unlucky, which is why binding placement to `mousemove` meant it never ran.

Now: content, then place, then reveal, and no reveal if placing failed.
`positionTooltipAt` reports whether it placed anything and refuses without usable
event coordinates. **A failure to place is invisible rather than wrong.**

### Two consequences to expect on such a mount, not defects

- the tooltip is placed where the pointer ENTERED the tract and does **not track**
  the cursor inside it; it re-places on entering the next tract. Correct and
  visible beats smooth and off screen.
- `mouseout: 0` means the hide handler does not fire either, so the tooltip stays
  visible until another tract is entered. Untouched here deliberately: it is the
  same family and deserves its own slice rather than being stacked into this
  verification.

### Also in this deploy, as prevention

The mount **re-resolves the map container after the hydration gate** instead of
only checking that some element with that id exists. `renderDACMap` mints the id
from `Date.now()` every render, and the mount captured the id and the node before
the gate's await, so a re-render during the wait left it holding a detached div --
and two renders inside one millisecond reuse the id, which made the old check pass
while Leaflet built into a node nobody can see. The evidence ruled this OUT as the
cause of the tooltip defect; it ships on its own merits, with no assertion of its
own because a re-render inside the gate window cannot be produced on demand.

**Nothing was uploaded to Dataverse tables**: `nyserda_dac v1.0` on
`tract_geometry pure-2010` is unchanged.

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

**Clean rollback, with one thing to know before choosing it.** Rolling back
restores the defect: tract tooltips render off screen on any mount where move
events are not delivered, which is every boot mount that has been observed. A
rolled-back client reports `00b8ba7881`.

Take the base64 from the files **as stored in this folder**. These are CRLF and
`deploy-backups/.gitattributes` sets `* -text` so git never converts them; a
checkout that re-encoded them to LF would not restore byte-identical. The
`sha256` in `manifest.json` is over the bytes as deployed -- check it before and
after a restore.
