/* CLCPA-280: the five Data Sources family tabs, BEFORE and AFTER, PAINTED IN
 * A REAL BROWSER under the app's own stylesheet.
 *
 * WHERE THE PAGES COME FROM, and why they are not clicked to: see the header
 * of render_280.js. The family tab row is gated on Storage.isDataverse(), the
 * sandbox runs on localStorage, and the four affected entries are therefore
 * unreachable by clicking here. Each build's own renderDsDictView produces the
 * markup instead, and it is painted here with the real styles.css attached, so
 * the geometry below is measured, not reasoned about.
 *
 * BOTH SIDES ARE PINNED. BEFORE is a commit, not "the current file with the
 * rows put back": a before/after where both sides come from the changed code
 * proves only that the code agrees with itself.
 *
 *   BEFORE  DAC_BASE_COMMIT, default fcf4587, the tip before this change
 *   AFTER   the working tree
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const live = require('../_kit/live_browser.js');
const R280 = require('./render_280.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const OUT = path.join(__dirname, 'repro-280-output.txt');
const SHOT = path.join(__dirname, 'shots');
const BASE = process.env.DAC_BASE_COMMIT || 'fcf4587';
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const LF = new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n', 'g');

const TITLES = {
  layers: 'Map Layers', indicators: 'DAC Indicators', shapes: 'Tract Shapes',
  coned: 'Electric and Gas Figures', territory: 'Territory Overlays',
};

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };

if (!fs.existsSync(SHOT)) fs.mkdirSync(SHOT);

const AFTER_SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
/* git blobs are LF and the working tree is CRLF; the extractor anchors on
 * CRLF, so an un-normalised baseline resolves nothing and renders an empty
 * page that would read as "no placeholders found" */
const BEFORE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: ROOT, maxBuffer: 1 << 29 }).toString('utf8').replace(LF, CRLF);

/* what one painted family tab actually is */
const READ = '(function(){' +
  'var art=document.getElementById("ds-dict-entry");' +
  'if(!art) return JSON.stringify({error:"no dict entry"});' +
  'var secs=[].slice.call(art.querySelectorAll("section"));' +
  'var origin=null;' +
  'secs.forEach(function(s){var h=s.querySelector("h3");' +
  'if(h && /Where the data comes from/i.test(h.textContent)) origin=s;});' +
  'if(!origin) return JSON.stringify({error:"no origin section"});' +
  'var dl=origin.querySelector("dl.ds-dict-origin");' +
  'var rows=[];' +
  'if(dl){var kids=[].slice.call(dl.children);' +
  'for(var i=0;i<kids.length;i++){' +
  'if(kids[i].tagName==="DT") rows.push([kids[i].textContent.trim(),' +
  '(kids[i+1]&&kids[i+1].tagName==="DD")?kids[i+1].textContent.trim():null]);}}' +
  'var r=origin.getBoundingClientRect();' +
  'var next=origin.nextElementSibling;' +
  'return JSON.stringify({' +
  'title:(art.querySelector("h2")||{}).textContent,' +
  'rows:rows,hasDl:!!dl,' +
  'fallback:!dl?((origin.querySelector("p")||{}).textContent||"").trim():null,' +
  'originHeight:Math.round(r.height),' +
  'entryHeight:Math.round(art.getBoundingClientRect().height),' +
  'gapToNext:next?Math.round(next.getBoundingClientRect().top-r.bottom):null,' +
  'gapPills:art.querySelectorAll(".ds-dict-gap").length,' +
  'toBeFilled:(art.textContent.match(/TO BE FILLED/g)||[]).length,' +
  'entryText:art.textContent.replace(/' + String.fromCharCode(92) + 's+/g," ").trim()' +
  '});})()';

async function capture(B, label, pages) {
  const out = {};
  for (const id of R280.TABS) {
    /* a bare page carrying only the app's stylesheet and this view, so nothing
     * else in the shell can move the measurement */
    await B.run('document.documentElement.innerHTML = ' +
      JSON.stringify('<head><link rel="stylesheet" href="styles.css"></head>' +
        '<body style="margin:0;padding:24px;background:var(--white-smoke)">' +
        '<div id="view-container" style="max-width:1080px;margin:0 auto"></div></body>') + ';');
    await sleep(250);
    await B.run('document.getElementById("view-container").innerHTML = ' +
      JSON.stringify(pages[id]) + ';');
    /* WAIT FOR THE FONTS. Measured without this, the same BEFORE block came
     * back 206px on one run and 203px on the next: the first measurement
     * caught the fallback face. A geometry claim read off an unsettled layout
     * is a number, not a fact. */
    await B.eval('document.fonts.ready.then(function(){return 1;})');
    await sleep(350);
    const m = JSON.parse(await B.eval(READ) || '{}');
    out[id] = m;
    log('  ' + label.toUpperCase().padEnd(6) + ' ' + TITLES[id]);
    if (m.error) { log('      ERROR ' + m.error); continue; }
    (m.rows || []).forEach(([k, v]) =>
      log('      ' + String(k).padEnd(24) + ' ' + String(v).slice(0, 74)));
    if (!m.hasDl) log('      (no rows; the block falls back to: "' +
      String(m.fallback).slice(0, 62) + '")');
    log('      block ' + m.originHeight + 'px, gap to next section ' + m.gapToNext +
      'px, gap pills ' + m.gapPills + ', TO BE FILLED ' + m.toBeFilled);
    await B.screenshot(path.join(SHOT, label + '-' + id + '.png'));
  }
  return out;
}

(async () => {
  log('CLCPA-280: the Data Sources family tabs, painted in Chrome');
  log('BEFORE = ' + BASE + '   AFTER = ' +
    (process.env.DAC_APP_OVERRIDE || 'working tree'));
  log('');

  const beforePages = R280.pagesFor(BEFORE_SRC, 'before');
  const afterPages = R280.pagesFor(AFTER_SRC, 'after');

  const D = await live.open({ dir: DEV });
  let before, after;
  try {
    log('BEFORE');
    before = await capture(D.B, 'before', beforePages);
    log('');
    log('AFTER');
    after = await capture(D.B, 'after', afterPages);
  } finally {
    await D.close();
  }
  log('');

  log('ASSERTIONS');
  const sum = (o, k) => R280.TABS.reduce((n, t) => n + ((o[t] || {})[k] || 0), 0);
  ok(sum(before, 'toBeFilled') === 6,
    'BEFORE the five tabs carried 6 TO BE FILLED strings: ' + sum(before, 'toBeFilled'));
  ok(sum(before, 'gapPills') === 6,
    'BEFORE each was painted as an amber gap pill: ' + sum(before, 'gapPills'));
  ok(sum(after, 'toBeFilled') === 0,
    'AFTER not one remains: ' + sum(after, 'toBeFilled'));
  ok(sum(after, 'gapPills') === 0,
    'AFTER no gap pill is painted anywhere: ' + sum(after, 'gapPills'));

  R280.TABS.forEach((id) => {
    const b = before[id] || {}, a = after[id] || {};
    const title = TITLES[id];
    const kept = (b.rows || []).filter(
      ([k]) => k !== 'Delivered by' && k !== 'Update cadence');
    ok(JSON.stringify(kept) === JSON.stringify(a.rows || []),
      title + ': the rows left are exactly BEFORE minus the two fields -> ' +
      JSON.stringify((a.rows || []).map(r => r[0])));
    ok(!!a.hasDl === (kept.length > 0),
      title + ': the block is ' + (kept.length ? 'still a list of rows' :
        'still the source sentence, as it was'));
    /* nothing but those rows left the page: the whole entry's text with the
     * two removed rows deleted from the BEFORE side must match the AFTER side
     * character for character */
    /* a <dt> and its <dd> are adjacent elements, so textContent joins them
     * with NO separator. The first version of this pattern assumed a space,
     * matched nothing, and reported four tabs as changed when the only thing
     * wrong was the pattern. */
    const strip = (t) => String(t || '')
      .replace(/Delivered by\s*\[Con Edison contact: TO BE FILLED\]/g, '')
      .replace(/Update cadence\s*\[Update cadence: TO BE FILLED\]/g, '')
      .replace(/\s+/g, ' ').trim();
    const sb = strip(b.entryText), sa = strip(a.entryText);
    let at = -1;
    for (let i = 0; i < Math.max(sb.length, sa.length); i++) {
      if (sb[i] !== sa[i]) { at = i; break; }
    }
    ok(sb === sa, title + ': every other word on the tab is unchanged' +
      (at < 0 ? '' : '  [first difference at ' + at + ': before "' +
        sb.slice(at, at + 48) + '" vs after "' + sa.slice(at, at + 48) + '"]'));
    ok(a.originHeight <= b.originHeight,
      title + ': the block closed up rather than leaving a hole: ' +
      b.originHeight + 'px -> ' + a.originHeight + 'px');
    ok(a.gapToNext === b.gapToNext,
      title + ': the gap to the next section is unchanged at ' + a.gapToNext + 'px');
  });

  log('');
  log(pass + ' passed, ' + fail + ' failed');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  log('THREW: ' + (e && e.stack || e));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(2);
});
