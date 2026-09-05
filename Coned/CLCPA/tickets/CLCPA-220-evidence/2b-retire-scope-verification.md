# CLCPA-220 correction 2b: the retire scope, and what is NOT yet screen-verified

## The defect

Two activation paths disagreed about which sibling versions an activation
retires.

| path | scoped by |
|---|---|
| `saveTractDataset` (upload) | `datasetKey` AND `geoidVintage`, except territories (`retireBy: 'key'`) |
| `setTractDatasetActive` (the toggle) | `datasetKey` only, always |

It was invisible while DAC indicators were the only family with a toggle,
because indicators genuinely are one-active-per-key. Correction 2 gives electric
and gas figures a toggle, and those are vintage-scoped. Activating a 2020
version would have silently deactivated the 2010 one, taken the operational
figures off the 2010 map, and reported success.

Both vintages of geometry and of ConEd figures are published at once BY DESIGN.
That is the whole reason `saveTractDataset` carries `retireBy` at all.

## The fix

The rule is stated generally rather than as a list of family names:

> scope by key alone exactly when there is no vintage to scope by

because `cr2bf_geoidvintage eq ''` does not match a row stored NULL. A rule
survives a new family being added; a list of names rots.

## What IS verified

The filter the code builds is exercised directly, both ways:

- electric and gas 2020: the filter keeps its `cr2bf_geoidvintage eq '2020'`
  clause, so the 2010 row is not in the retire set
- DAC indicators: still scoped, so single-per-key-and-vintage is unchanged
- territories: no vintage clause at all, because a null vintage matches nothing
- control: the pre-fix filter had no vintage clause, so it WOULD have retired
  the other vintage

## What is NOT verified, and why

**The two-vintage round trip against Dataverse has not been screen-tested.**

The tenant currently holds ONE `coned_operational` row, so there is no second
vintage to be wrongly retired and nothing to observe. Ruled by Emely on
2026-09-05: the assertions carry it for now, and the real round trip is verified
when a second vintage naturally exists, through the operator simulation or the
Con Edison repopulation.

Recorded here rather than left implied, because "asserted" and "verified against
the live table" are different claims and this ticket only supports the first.

---

# The read-only disabled switch: asserted, never rendered read-only

Same treatment, same reason, recorded here so the two limits sit together.

Visual round 2 removed the per-row state pills from Saved layers. A read-only
user previously got a pill INSTEAD of a toggle, which is now the one thing that
would reintroduce the ragged column the change existed to fix. So a read-only
user gets the same switch, disabled, with a title explaining why.

One vocabulary for everyone, not two.

## What IS verified

The markup is asserted: every saved-layer row renders a switch, no row renders a
state pill, and the card-header hint survives.

## What is NOT verified

**The read-only path has never been rendered with a read-only user.** The render
harness fixture grants every privilege:

    canCreateLayers: () => true,
    canWriteLayers: () => true,
    canCreateDatasets: () => true,
    canWriteDatasets: () => true,

so `canToggle` is always true and the disabled branch is never taken. The
assertions cover the shape of the row, not the read-only variant of it.

Ruled by Emely on 2026-09-05: asserted for now, screen-verified when a read-only
pass naturally happens. Recorded rather than implied, because "the markup is
asserted" and "a read-only user has seen it" are different claims and this
ticket supports only the first.

---

# Round 3: three more asserted-only paths

Same treatment again, same file, so the whole ticket's unverified surface reads
in one place instead of being scattered across commit messages.

| path | asserted | never seen by a person |
|---|---|---|
| the About panel TOGGLE | the button, the panel, `hidden`, `aria-expanded` and `aria-controls` are all asserted in the rendered markup | the click has never been performed. The render harness produces HTML; it does not run the delegated click handler, so open and close are proven by construction only |
| the tab FILL against the real page | the CSS declares `--white-smoke` fill with border and text at `--text-2` | whether that actually reads as a button ON the page is the exact judgement the CSS cannot make. It is why round 3 exists: round 2's border-only change looked right in the file and dissolved on screen |
| the read-only disabled switch on the three toggle families | the markup renders a disabled switch when `canWrite` is false | the fixture grants every privilege, so the branch is never taken. Round 2 recorded this for Saved layers; round 3 extended the same code path to DAC indicators, electric and gas, and territory overlays, and extended the same gap with it |

The middle one is worth stating plainly rather than filing as routine. Round 2
changed the tab border and it was verified green in assertions, then failed on
screen because white on white does not become visible by being outlined. A
passing CSS assertion says the declaration is present. It says nothing about
whether the result is legible, and no assertion I can write will.
