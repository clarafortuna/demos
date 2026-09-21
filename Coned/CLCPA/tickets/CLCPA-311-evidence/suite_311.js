/* CLCPA-311 / D-04: the Section D chart published a fabricated 0.0% LMI share.
 *
 * REPRODUCED IN A REAL BROWSER FIRST, against a served build, before any code
 * (repro_311.js and repro-311-output.txt beside this file):
 *
 *   [LMI] LMI subscribers (EAP)   (D3)
 *            2025   1.9k   share: 0.0%
 *            2024   1.2k   share: 0.0%
 *
 * THE CAUSE, and it is one operator. dBarMetric computed
 *
 *     const dacShare = total ? (dac / total) : null;
 *
 * and the LMI bar is handed dac = null, because it has no DAC split. In
 * JavaScript `null / 1917` is 0, not null, so dacShare was 0 rather than
 * absent, the guard `total != null ? fmtPct(dacShare) : '-'` saw a perfectly
 * good total, and the dash was unreachable. Section D published 0.0% on every
 * stored year.
 *
 * D3 FILES THE REAL FIGURE two rows below the count it already reads:
 * "Percentage of subscribers who are low-income customers participating in the
 * Company's Energy Affordability Program" = 0.093 cumulative for 2025 and
 * 0.063 for 2024. So the fix reads what the table files, and where nothing is
 * filed it shows the dash Section D uses everywhere else. Nothing coerces to
 * zero.
 *
 * THE SHARE EXPRESSION IS EXTRACTED FROM app.js AND EVALUATED, not retyped
 * here: a harness that reimplements the rule can agree with itself while the
 * app does something else, which this repo has shipped before.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');

const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

/** renderSectionD sits at column 0, so the 2-space anchor does not find it. */
function grabCol0(name, src) {
  const re = new RegExp('(?:^|\\r\\n)function ' + name + '\\s*\\(');
  const m = re.exec(src);
  if (!m) return null;
  const start = src.indexOf(m[0]) + (m[0].startsWith('\r\n') ? 2 : 0);
  let i = src.indexOf('{', start), d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (!d) return src.slice(start, i + 1); }
  }
  return null;
}

/** the share maths AS WRITTEN, lifted out and made callable */
function shareFn(src) {
  const body = grabCol0('renderSectionD', src) || '';
  const i = body.indexOf('const dacShare');
  if (i < 0) throw new Error('no dacShare in renderSectionD');
  const j = body.indexOf(';', body.indexOf('prevDacShare'));
  const expr = body.slice(i, j + 1);
  /* eslint-disable no-new-func */
  return new Function('share', 'total', 'dac', 'prevTotal', 'prevDac',
    expr + '\nreturn { curr: dacShare, prev: prevDacShare };');
}

log('='.repeat(72));
log('CLCPA-311 / D-04 -- the LMI share is read, not invented');
log('  BASE : ' + BASE + ' (predates this change)');
log('='.repeat(72));

log('');
log('A. WHAT D3 ACTUALLY FILES');
guard('A-block', () => {
  const pctRow = (y) => (P.tables.D3.data[y] || []).find(r =>
    /^percentage of subscribers who are low-income/i.test(String(r[0] || '').trim()));
  const cntRow = (y) => (P.tables.D3.data[y] || []).find(r =>
    /^total # of subscribers who are low-income/i.test(String(r[0] || '').trim()));
  ok(!!pctRow('2025') && pctRow('2025')[1] === 0.09300000000000001,
    'A1 D3/2025 files the LMI share as 0.093 cumulative -- ' +
    JSON.stringify(pctRow('2025') && pctRow('2025')[1]));
  ok(!!pctRow('2024') && pctRow('2024')[1] === 0.063,
    'A2 D3/2024 files it as 0.063');
  ok(!!cntRow('2025') && cntRow('2025')[1] === 1917,
    'A3 and the COUNT row beside it is 1917, which is what the bar already read');
  /* the share is a real share of the subscriber total, not of something else */
  const tot = (P.tables.D3.data['2025'] || []).find(r =>
    /^total # of subscribers$/i.test(String(r[0] || '').trim()));
  ok(tot && Math.abs(1917 / tot[1] - 0.093) < 0.001,
    'A4 1917/' + (tot && tot[1]) + ' = 0.0927, so the filed 0.093 is that share rounded');
});

log('');
log('B. THE BASELINE FABRICATES IT');
guard('B-block', () => {
  const base = codeOnly(grabCol0('renderSectionD', BASE_SRC) || '');
  ok(/const dacShare\s+= total\s+\? \(dac\s+\/ total\)\s+: null;/.test(base),
    'B1 BASE computes dac/total with no guard on dac');
  ok(/\$\{total != null \? fmtPct\(dacShare\) : /.test(base),
    'B2 and gates the slot on TOTAL, so a null dac never reaches the dash');
  /* the coercion itself, stated as a value rather than described */
  ok((null / 1917) === 0, 'B3 null/1917 === 0 in JavaScript, which is the whole defect');
  const fn = shareFn(BASE_SRC);
  const got = fn(undefined, 1917, null, 1186, null);
  ok(got.curr === 0, 'B4 BASE share maths, driven: dac=null gives ' + JSON.stringify(got.curr) +
    ', not null');
});

log('');
log('C. THE FIX: ABSENT MEANS ABSENT');
guard('C-block', () => {
  const fn = shareFn(SRC);
  const nulled = fn(undefined, 1917, null, 1186, null);
  ok(nulled.curr === null && nulled.prev === null,
    'C1 dac=null now yields null, not 0 -- ' + JSON.stringify(nulled));
  const computed = fn(undefined, 88150, 28536, 75200, 24100);
  ok(Math.abs(computed.curr - 28536 / 88150) < 1e-12,
    'C2 while two real counts still compute their own share -- ' +
    computed.curr.toFixed(4));
  const stored = fn({ curr: 0.093, prev: 0.063 }, 1917, null, 1186, null);
  ok(stored.curr === 0.093 && stored.prev === 0.063,
    'C3 and a STORED share is used when the table files one');
  /* a stored share takes precedence over a computable one: the table's own
   * figure is the published one */
  const both = fn({ curr: 0.5, prev: 0.4 }, 100, 10, 100, 10);
  ok(both.curr === 0.5, 'C4 the filed figure wins over the computable one');
  /* and a share of zero is a real share, not an absence */
  const zero = fn({ curr: 0, prev: 0 }, 100, null, 100, null);
  ok(zero.curr === 0, 'C5 a filed ZERO is still a figure, not treated as missing');
});

log('');
log('D. THE SLOT SHOWS THE DASH WHEN THERE IS NOTHING TO SHOW');
guard('D-block', () => {
  const now = codeOnly(grabCol0('renderSectionD', SRC) || '');
  /* ANCHORED TO THE SLOT, and a mutation control is why. Without the span
   * prefix this regex also matched the non-LMI tooltip attribute
   * data-curr-dac-pct, which carries the very same expression -- so the
   * assertion stayed green while the slot it names was mutated back to the
   * defect. It passed for the wrong reason until something made it fail. */
  ok(/<span class="d-bar-total">\$\{dacShare != null \? fmtPct\(dacShare\) : /.test(now),
    'D1 the LMI slot gates on the SHARE, not on the total');
  ok(/<span class="d-bar-total">\$\{prevDacShare != null \? fmtPct\(prevDacShare\) : /.test(now),
    'D2 and so does the previous-year slot');
  ok(!/\$\{total != null \? fmtPct\(dacShare\) : /.test(now),
    'D3 the old gate is gone');
});

log('');
log('E. THE CALL SITE READS THE TABLE');
guard('E-block', () => {
  const now = codeOnly(grabCol0('renderSectionD', SRC) || '');
  ok(/const d3LmiPct\s+= getDRow\('D3', \['percentage', 'low-income', 'energy affordability'\]\);/.test(now),
    'E1 the share is read from D3 by its own wording');
  ok(/\{ curr: d3LmiPct\.upTo, prev: d3LmiPct\.prevCum \}/.test(now),
    'E2 and handed to the bar');
  /* the term that matters: without "percentage" the search finds the COUNT
   * row above it, which is what the bar already had */
  const d3 = P.tables.D3.data['2025'] || [];
  const first = d3.find(r => ['low-income', 'energy affordability']
    .every(t => String(r[0] || '').toLowerCase().includes(t)));
  const withPct = d3.find(r => ['percentage', 'low-income', 'energy affordability']
    .every(t => String(r[0] || '').toLowerCase().includes(t)));
  ok(first && first[1] === 1917, 'E3 without "percentage" the match is the COUNT, 1917');
  ok(withPct && withPct[1] === 0.09300000000000001,
    'E4 with it, the match is the SHARE, 0.093 -- the two rows are otherwise worded alike');
});

log('');
log('F. NOTHING ELSE IN SECTION D MOVED');
guard('F-block', () => {
  const now = grabCol0('renderSectionD', SRC) || '';
  const was = grabCol0('renderSectionD', BASE_SRC) || '';
  const added = now.split('\r\n').filter(l => was.indexOf(l) < 0)
    .filter(l => l.trim() && !/^\s*[*/]/.test(l.trim()));
  const CLAIMED = [
    "      const d3LmiPct  = getDRow('D3', ['percentage', 'low-income', 'energy affordability']);",
    '        const dacShare = (share && share.curr != null) ? share.curr',
    '          : ((total && dac != null) ? (dac / total) : null);',
    '        const prevDacShare = (share && share.prev != null) ? share.prev',
    '          : ((prevTotal && prevDac != null) ? (prevDac / prevTotal) : null);',
    '      const dBarMetric = (label, fmtFn, total, dac, prevTotal, prevDac, tableId, isLmi, share) => {',
    "                <span class=\"d-bar-total\">${dacShare != null ? fmtPct(dacShare) : '—'}</span>",
    "                <span class=\"d-bar-total\">${prevDacShare != null ? fmtPct(prevDacShare) : '—'}</span>",
    "                                   { curr: d3LmiPct.upTo, prev: d3LmiPct.prevCum })}",
  ];
  const callLine = now.split('\r\n').find(l => l.indexOf("dBarMetric('LMI subscribers (EAP)'") >= 0);
  if (callLine) CLAIMED.push(callLine);
  const unclaimed = added.filter(l => CLAIMED.indexOf(l) < 0);
  ok(unclaimed.length === 0,
    'F1 every added code line in renderSectionD belongs to this ticket -- ' +
    JSON.stringify(unclaimed.slice(0, 3)));
  /* THE OTHER BARS KEEP THEIR MEANING. Slicing from a marker to the end of
   * the function does NOT isolate that branch -- the call sites live below it
   * and one of them legitimately changed -- so the claim is made on the lines
   * that carry the meaning instead. The non-LMI slot shows a COUNT, not a
   * share, and that is what must not move. */
  const nonLmiSlot = '              <span class="d-bar-total">${fmtFn(total)}</span>';
  ok(now.indexOf(nonLmiSlot) >= 0 && was.indexOf(nonLmiSlot) >= 0,
    'F2 the non-LMI slot still shows the total COUNT, exactly as on BASE');
  ok(/data-curr-dac-pct="\$\{dacShare != null \? fmtPct\(dacShare\) : 'n\/a'\}"/.test(now),
    'F3 and its tooltip share keeps the n/a it already had, never a zero');
  /* the browser pass is the other half of this: repro-311-output.txt shows
   * every non-LMI bar rendering the same figures before and after. */
  const shown = ['Projects', 'MW installed', 'Subscribers'];
  ok(shown.every(l => now.indexOf("dBarMetric('" + l) >= 0),
    'F4 and all three non-LMI metrics are still drawn by the same call');
});

log('');
log('='.repeat(72));
log('  ' + pass + ' passed, ' + fail + ' failed');
log('='.repeat(72));
fs.writeFileSync(path.join(__dirname, 'suite-311-output.txt'), lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
