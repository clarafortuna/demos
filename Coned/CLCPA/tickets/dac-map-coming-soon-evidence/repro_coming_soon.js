/* The Customer Counts panel, before and after, PAINTED IN A REAL BROWSER
 * under the app's own stylesheet.
 *
 * WHY IT IS PAINTED THIS WAY, and it is a limitation not a preference. The
 * DAC map cannot load here: ExecutiveDashboard.html pulls Leaflet and Turf
 * from unpkg.com, this sandbox has no network and the repo vendors no copy,
 * so window.L is undefined, renderDACMap never builds the map, and
 * renderMapKPI -- which only the map calls -- never runs. Measured directly:
 * the panel element exists at 288px wide and stays empty for 60 seconds with
 * zero leaflet panes and no map element at all.
 *
 * So render_panel.js produces each build's panel from the SHIPPED
 * renderMapKPI against the real map_payload.json and the real indicator
 * catalog, and this script paints that HTML in Chrome with styles.css
 * attached. The strings, the figures and the CSS are the app's own; what is
 * missing is the map beneath them, and the map is not what this ticket
 * changes. The rendered map stays the owner's hosted pass.
 *
 * Run render_panel.js first -- this reads its two files.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const live = require('../_kit/live_browser.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'repro-coming-soon-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };

const read = (f) => fs.readFileSync(path.join(__dirname, f), 'utf8');

/* what the painted panel actually is: its cards, their text, and the
 * measured vertical gaps between them */
const measure = (B) => B.eval(
  '(function(){' +
  'var sec=document.querySelector(".dac-kpi-section-counts");' +
  'if(!sec) return JSON.stringify({error:"no counts section"});' +
  'var cards=[].slice.call(sec.querySelectorAll(".dac-kpi-card"));' +
  'var out={cards:[],gaps:[],sectionHeight:Math.round(sec.getBoundingClientRect().height)};' +
  'cards.forEach(function(c){var r=c.getBoundingClientRect();' +
  'out.cards.push({cls:c.className,' +
  'text:c.textContent.replace(/[ ]+/g," ").trim().slice(0,60),' +
  'top:Math.round(r.top),height:Math.round(r.height)});});' +
  'for(var i=1;i<cards.length;i++){' +
  'var a=cards[i-1].getBoundingClientRect(), b=cards[i].getBoundingClientRect();' +
  'if(Math.round(b.top) > Math.round(a.bottom)) out.gaps.push(Math.round(b.top-a.bottom));}' +
  'out.values=[].slice.call(sec.querySelectorAll(".dac-kpi-bd-v")).map(' +
  'function(v){return v.textContent.trim();});' +
  'return JSON.stringify(out);})()');

(async () => {
  log('The Customer Counts panel, painted under the app stylesheet');
  log('(the map itself cannot load here: Leaflet and Turf come from unpkg.com');
  log(' and this sandbox has no network -- see the header of this script)');
  log('');

  const D = await live.open({ dir: DEV });
  const B = D.B;
  const results = {};
  try {
    for (const which of ['before', 'after']) {
      const html = read('panel-' + which + '.html');
      /* a bare page carrying ONLY the app's stylesheet and this panel, so
       * nothing else on the executive page can move the measurement */
      await B.run('document.documentElement.innerHTML = ' +
        JSON.stringify('<head><link rel="stylesheet" href="styles.css"></head>' +
          '<body style="margin:0;padding:16px;width:320px">' +
          '<div id="dac-map-kpi" class="dac-map-kpi-panel"></div></body>') + ';');
      await sleep(400);
      await B.run('document.getElementById("dac-map-kpi").innerHTML = ' +
        JSON.stringify(html) + ';');
      await sleep(500);
      const m = JSON.parse(await measure(B) || '{}');
      results[which] = m;
      log(which.toUpperCase() + ':  ' + m.cards.length + ' card(s), section height ' +
        m.sectionHeight + 'px, gaps ' + JSON.stringify(m.gaps));
      m.cards.forEach((c, i) => log('   ' + i + '  ' + JSON.stringify(c.text) +
        '   h=' + c.height));
      await B.screenshot(path.join(__dirname, 'panel-' + which + '.png'));
      log('   screenshot: panel-' + which + '.png');
      log('');
    }

    const b = results.before, a = results.after;
    ok(b.cards.some(c => /Coming soon/i.test(c.text)),
      'BEFORE the panel carries the "Coming soon" card');
    ok(!a.cards.some(c => /Coming soon/i.test(c.text)),
      'AFTER it is gone');
    ok(b.cards.length - a.cards.length === 1,
      'exactly one card was removed: ' + b.cards.length + ' -> ' + a.cards.length);

    /* THE REST OF THE PANEL IS UNMOVED: same cards, same text, same order */
    const strip = (m) => m.cards.filter(c => !/Coming soon/i.test(c.text))
      .map(c => c.cls + '|' + c.text);
    log('  remaining cards, before: ' + JSON.stringify(strip(b)).slice(0, 150));
    log('  remaining cards, after : ' + JSON.stringify(strip(a)).slice(0, 150));
    ok(JSON.stringify(strip(b)) === JSON.stringify(strip(a)),
      'every other card is identical in class, text and order');

    /* NO GAP LEFT BEHIND: the gaps between the remaining cards are the same
     * value, and there is one fewer of them */
    log('  gaps before: ' + JSON.stringify(b.gaps) + '   after: ' + JSON.stringify(a.gaps));
    ok(a.gaps.length === b.gaps.length - 1,
      'one fewer gap, because the card took its own gap with it');
    ok(new Set(a.gaps).size <= 1 && (a.gaps.length === 0 || a.gaps[0] === b.gaps[0]),
      'and the remaining gaps are unchanged: ' + JSON.stringify(a.gaps));
    ok(a.sectionHeight < b.sectionHeight,
      'the section closed up rather than leaving a hole: ' +
      b.sectionHeight + 'px -> ' + a.sectionHeight + 'px');

    /* THE FIGURES THE OWNER NAMED */
    /* READ FROM THE VALUE CELLS, not from the card text: that text is
     * truncated to 60 characters for legibility and the tooltip prose comes
     * first, so the figures fell outside the slice and the check reported
     * none on a panel that plainly shows four. */
    const figs = (m) => (m.values || []).filter(v => /^\d+(?:\.\d+)?[KM]$/.test(v));
    log('  figures before: ' + JSON.stringify(figs(b)));
    log('  figures after : ' + JSON.stringify(figs(a)));
    ['1.82M', '2.15M', '383K', '170K'].forEach((want) => {
      ok(figs(a).indexOf(want) >= 0, 'the panel still reads ' + want);
    });

    const errs = D.errors();
    log('');
    ok(errs.length === 0, 'no page errors: ' + JSON.stringify(errs));
  } finally {
    await D.close();
  }

  log('');
  log(pass + ' passed, ' + fail + ' failed');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  log('THREW: ' + (e && e.stack || e));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(2);
});
