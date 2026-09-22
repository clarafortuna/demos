/* The fourteen section-page tooltip surfaces, as data.
 *
 * ONE ROW PER POSITIONER, which is what CLCPA-242 pinned and what this ticket
 * was scoped against: fourteen occurrences of the bare
 * `tip.style.left = (e.pageX + 14) + 'px'`. It is NOT fourteen CSS selectors.
 * Five of the sites sit inside a shared `bindMove(el)` closure that is applied
 * to several target lists, so the selector inventory is larger than fourteen
 * and every one of those selectors has to be registered, not just the one the
 * evidence walks.
 *
 * `tip` is the div the site writes to, and it is the fact that decides how much
 * of CLCPA-242 each site actually needs. Eight sites write to the SHARED
 * .exec-tooltip, which the delegated control-tip handler blanket-hides; six
 * write to their own div, which that handler never touches. Fix A is therefore
 * material for eight and harmless for six; fix B, the viewport clamp and
 * hide-on-re-render apply to all fourteen. Measured from the source, not
 * assumed: see the census in the PR.
 *
 * `walk` is the selector the browser evidence travels inside. `all` is every
 * selector the site serves, and is what gets registered.
 */
const SURFACES = [
  { n: 1, line: 14834, section: 'F', fn: 'wireFSectionTooltips', tip: '.exec-tooltip',
    shared: true, walk: '.f3-tile[data-tt-label]',
    all: ['.f3-tile[data-tt-label]'] },
  { n: 2, line: 14870, section: 'G', fn: 'wireGSectionTooltips', tip: '.exec-tooltip',
    shared: true, walk: '.g-row[data-tt-label]',
    all: ['.g-row[data-tt-label]'] },
  { n: 3, line: 14891, section: 'G', fn: 'wireGSectionTooltips', tip: '.exec-tooltip',
    shared: true, walk: '.g-methane-block[data-tt-label]',
    all: ['.g-methane-block[data-tt-label]'] },
  { n: 4, line: 14916, section: 'G', fn: 'wireGSectionTooltips', tip: '.exec-tooltip',
    shared: true, walk: '.g-methane-donut',
    all: ['.g-methane-donut'] },
  { n: 5, line: 15370, section: 'I', fn: 'wireISectionTooltips', tip: '.exec-tooltip',
    shared: true, walk: '.i-funnel-stage[data-tt-label]',
    all: ['.i-funnel-stage[data-tt-label]', '.i-rate-bar-row[data-tt-label]'] },
  { n: 6, line: 15784, section: 'A', fn: 'wireSectionATooltips', tip: '.exec-tooltip',
    shared: true, walk: '.a-stacked-row',
    all: ['.a-stacked-row'] },
  { n: 7, line: 15843, section: 'A', fn: 'wireQuadrantTooltip', tip: '.exec-tooltip',
    shared: true, walk: '.scatter-svg circle[data-name]',
    all: ['.scatter-svg circle[data-name]'] },
  { n: 8, line: 15904, section: 'B', fn: 'wireBTooltips', tip: '.exec-tooltip',
    shared: true, walk: '.b-fund-row',
    all: ['.b-fund-row', '.b-torn-row'] },
  /* HIT ZONES, not elements. This surface is one <canvas>: the handler works
   * out which arc the pointer is over and DELIBERATELY hides the box between
   * zones. A travel that samples the canvas geometrically therefore records a
   * legitimate hide as a defect, and it did: the first run reported this
   * surface hiding mid-travel before the change and surviving after it, on
   * two sets of sampled points that differed by a few pixels and had nothing
   * to do with the change. `zones` tells the walk to keep only points where a
   * tooltip actually opens, so what it measures is what the ticket is about. */
  { n: 9, line: 16066, section: 'E', fn: 'drawSectionEArc', tip: '.e-tt',
    shared: false, zones: true, walk: '#e-arc-canvas-section',
    all: ['#e-arc-canvas-section'] },
  { n: 10, line: 16091, section: 'E', fn: 'drawSectionEArc', tip: '.e-tt',
    shared: false, walk: '.e-yoy-row',
    all: ['.e-yoy-row'] },
  { n: 11, line: 16110, section: 'J', fn: 'wireJTooltips', tip: '.j-tt',
    shared: false, walk: '.j-burden-html-row',
    all: ['.j-burden-html-row', '.j-aff-block', '.j-flow-stage', '.j-dpa-group'] },
  { n: 12, line: 16249, section: 'D', fn: 'wireDTooltips', tip: '.d-tt',
    shared: false, walk: '.d-bar-metric',
    all: ['.d-bar-metric'] },
  /* This site serves `.d-bar-metric[data-table="F2"]` as well as `.f3-borough`:
   * section F borrows section D's bars for table F2. The registered selector
   * is the BARE `.d-bar-metric`, which site 12 already contributes and which
   * matches the qualified form too. Registering both spellings would put the
   * same element in the list twice and make the inventory's own count wrong,
   * which is how the first cut of the suite failed. */
  { n: 13, line: 16316, section: 'F', fn: 'wireFTooltips', tip: '.f-tt',
    shared: false, walk: '.f3-borough',
    all: ['.d-bar-metric', '.f3-borough'] },
  { n: 14, line: 16407, section: 'H', fn: 'wireHTooltips', tip: '.h-pie-tt',
    shared: false, walk: '.h-pie-slice',
    all: ['.h-pie-slice'] },
];

/* every distinct selector the fourteen sites serve, de-duplicated and in the
 * order the sites appear. This is what OWNS_TIP has to gain. */
const ALL_SELECTORS = (() => {
  const seen = new Set(), out = [];
  SURFACES.forEach(s => s.all.forEach(sel => {
    if (!seen.has(sel)) { seen.add(sel); out.push(sel); }
  }));
  return out;
})();

module.exports = { SURFACES, ALL_SELECTORS };
