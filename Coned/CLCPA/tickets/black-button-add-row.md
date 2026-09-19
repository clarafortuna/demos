# + Add Row inverts to near-black on hover and active

**Raised:** 2026-09-19, re-confirmed on the hosted pass of `abb8d99439`
**Verdict:** PRE-EXISTING, not introduced by any recent wave. Measured.
**Fixed:** scoped to the control, no hardcoded colour. A shared-rule fix is proposed below and awaits a ruling.

## What was reported, and what is actually true

The report says **focus state**. Measured in Chrome with the state really
applied -- focused by focusing, hovered by dispatching a mouse move at the
element's own coordinates, active by holding the button down -- the focus
state is clean. It is **hover and active** that invert:

| state | background before | foreground |
|---|---|---|
| rest | `rgba(0, 0, 0, 0)` | `rgb(47, 84, 150)` |
| focus | `rgba(0, 0, 0, 0)` | `rgb(47, 84, 150)` |
| **hover** | **`rgb(10, 36, 54)`** | `rgb(47, 84, 150)` |
| **active** | **`rgb(10, 36, 54)`** | `rgb(47, 84, 150)` |

`#0A2436` is `--ink-2`. The blue label stays put on a near-black fill, which
is what reads as "the button goes black". Recording the correction because a
fix aimed at `:focus` would have changed nothing and measured green.

These are the SETTLED colours. These controls animate `background` over 0.15s,
and a read taken at a fixed delay after applying the state returned
`rgba(10,36,54,0.992)` on one run and `rgba(10,36,54,0.97)` on the next -- a
frame of the transition, not the colour. The gesture script now polls until two
consecutive reads agree, and two independent runs return `rgb(10, 36, 54)`.

## Cause

`.btn:hover { background: var(--ink-2); }` sits at specificity **0-2-0**.
`.btn-link { background: transparent; }` is **0-1-0** and loses. `.btn-link:hover`
set only `text-decoration`, so **nothing ever contested the fill**. Any control
carrying *both* classes inverts.

This exact diagnosis was already written down once, at the `#ingest-template`
patch. It was fixed there **per id**, deliberately, citing the R2 lesson: do
not restyle a shared rule to fix one control.

## Scoped by id, and why -- plus a question for the owner

Fixed the same way its neighbour was, with a rule scoped to the control:

```css
#ingest-add-row:hover,
#ingest-add-row:active { background: transparent; }
```

`:active` as well as `:hover`, because a held button is its own state and the
measurement showed both inverting. `transparent` is `.btn-link`s own resting
value, so **no colour literal is introduced**. The underline is
`.btn-link:hover`s own and is untouched.

**I first fixed this on the shared `.btn-link:hover` rule and backed it out.**
The sweep caught `suite_85_ui`, which pins `.btn:hover`, `.btn-link` and
`.btn-link:hover` byte-identical to pre-85 and asserts the fix is *scoped by
id, so no other control is affected*. That is CLCPA-85 round 2s ruling, still
standing, and it is not mine to override.

### The question, for a ruling

That ruling was made when ONE control had the problem. There are now two, and
the blast radius of fixing the shared rule is **measured, not assumed**:

| control | classes | would the shared fix touch it |
|---|---|---|
| `#ingest-add-row` | `btn btn-link` | yes -- this ticket |
| `#ingest-template` | `btn btn-link` | yes -- already patched per id |
| `#ingest-history-showall` | `btn-link` | no |
| `#ingest-history-showless` | `btn-link` | no |
| `#ml-breaks-reset` | `btn-link ml-breaks-reset` | no |
| `#ml-ramp-reset` | `btn-link ml-ramp-reset` | no |
| (no id) | `ingest-history-toggle btn-link` | no |

Exactly **two** of the seven `.btn-link` controls carry `.btn`, and they are
precisely the two with the defect. The five that carry `.btn-link` alone never
triggered `.btn:hover` at all. Five, not four: one carries no id, and an
id-based enumeration missed it -- which is why the suite asserts totals taken
from every class attribute rather than a list of names.

So `.btn-link:hover { background: transparent; }` would change those two
controls and nothing else, and would retire both per-id patches.

**Recommendation:** make that change, and amend the CLCPA-85 round 2 rule to
say what it is really protecting -- do not restyle a shared rule for one
controls sake, but DO fix a shared rule when the cause is shared and the
blast radius is measured. Left alone, the next control to carry both classes
becomes a third patch.

**Not done without your word.** The scoped fix above is what ships here.

## Introduced-by-wave, or pre-existing

**Pre-existing.** Both ingredients have been in place, unchanged, since
`333f183` on **2026-06-01** -- the commit that created `ExecutiveDashboard_dev`:

- `.btn:hover { background: var(--ink-2); }` in `styles.css`
- `id="ingest-add-row" class="btn btn-link"` in `app.js`

`git log -S` returns exactly one commit for each string, so neither has been
touched since. No recent wave caused this.

## The sweep

Every button on the editor surfaces was measured in all four states, before
and after. Nothing else inverts. Two readings are worth keeping:

- **`.src-tab.active` computes `color: rgb(0, 0, 0)`** on a `--dusk` fill,
  which looks alarming and **is not a defect**: the tab renders no direct text
  node. Its label lives in `.src-tab-num` and `.src-tab-title`, both explicitly
  white on the active tab. Recorded so the next sweep does not re-raise it.
- `.ingest-row-delete` goes to a red tint on hover, by design, and its
  foreground darkens to `rgb(178, 59, 42)`. Intentional, left alone.

## Not measured

The map page's own controls beyond `#ml-breaks-reset` and `#ml-ramp-reset`.
The sweep covered the editor surfaces, which is what the ticket asked for.
