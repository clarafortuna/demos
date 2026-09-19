# Template as format, or template as export: three options

**Type:** open decision, deferred by owner order
**Raised:** 2026-09-18, during CLCPA-274 round 4
**Ruled for tonight:** option (a). CLCPA-274 round 4 closes on the sub-header
half alone. The question is decided tomorrow together with **CLCPA-292**.

## The question

Downloading the template for a year that already holds saved data produces a
sheet with the row LABELS and the `(calculated)` markers, and **no values**.

That looked like the second half of CLCPA-274 round 4. It is not a defect. It
is what the template has always done, for every table and every year.

## What the code does, and where

[`app.js`](../ExecutiveDashboard_dev/app.js), in `buildIngestWorkbook`'s cell
loop:

```js
/* EMPTY, and LOCKED like everything else: the workbook shows the
 * format, it is not filled in. The operator types into their own CSV,
 * saved from this sheet. */
return { style: style, text: null };
```

Row labels ARE emitted, because the importer matches rows by label. Values are
blanked deliberately. Measured on seed years nobody has reported:

| table | stored row | template row |
|---|---|---|
| H1 | `["Manhattan",1309,491,1800]` | `["Manhattan","","","(calculated)"]` |
| B2 | `["DAC",2966,170,2,3138]` | `["DAC","","","","(calculated)"]` |
| F5 | `["Bay Ridge","Brooklyn",23,0,23]` | `["Bay Ridge","Brooklyn","","","(calculated)"]` |

So F6/2099's "Test Row with no figures" is the same behaviour as H1/2025's
"Manhattan with no figures". Changing it is a product decision about what the
artefact IS, not a bug fix, and it changes what every operator downloads.

## The options

**(a) Leave it. The template is a blank format.** RULED FOR TONIGHT.
The affordance stays as CLCPA-85 designed it: a read-only example of the shape,
which the operator fills in their own CSV. Nothing changes, nothing regresses,
and the round-trip tests keep their current meaning. The cost is the thing that
prompted the question: an operator who downloads a populated year gets an empty
sheet and may reasonably read that as data loss.

**(b) Always emit the stored values. The template becomes an export.**
Uniform and simple to explain: what you download is what is stored. It makes
the download useful as a backup and makes a round trip trivially checkable.
The costs are real: every existing operator instruction that calls this a blank
form becomes wrong; a template for a populated year stops being a clean form to
fill; and the `(calculated)` markers now sit beside real figures, which is a
different reading of the same cell. It also interacts with CLCPA-292, which
pre-fills A3/A4's Program Name keys -- if values are emitted anyway, part of
292's purpose dissolves.

**(c) Emit values only where the year already holds data; blank for a fresh
year.** RECOMMENDED IF THE CHANGE IS WANTED.
This matches the intuition behind the report: a populated year should round
trip, a new year should be a clean form. It is derivable with no per-table
literal -- the writer already knows whether the source year carries its own
rows or borrowed them, which is exactly the distinction CLCPA-274 round 3
introduced for the sub-header. The cost is that the artefact's meaning now
depends on state: the same button yields a form or an export depending on the
year, and the instructions have to say so.

## Recommendation

- If the change is wanted: **(c)**, because it is the only one that answers the
  original complaint without turning a blank form into an export everywhere,
  and because the writer already carries the distinction it needs.
- If the smallest correct action is wanted now: **(a)**, which is what was
  ruled.

Either way this should be decided beside **CLCPA-292**, since that ticket is
about what the template pre-fills, and a template that emits values has already
answered part of it.

## Not measured

Whether any operator instruction, guide or notebook describes the template as
blank. If (b) or (c) is chosen, the handoff documents must be swept for that
claim before it ships, because `verify_handoff_package.py` runs the guides'
own commands and a guide that describes the wrong artefact will not fail --
it will simply be wrong.
