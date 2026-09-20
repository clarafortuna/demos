/* CLCPA-290, in a real browser: A3/A4's Total row leaves its average-type
 * cells empty on a live-calculated year.
 *
 * The owner's scene is year 2098 with the Total row rendering
 *   Total | (dash) | 11,211.1 | (dash) | (dash)
 * -- Total Participants computed, the two "Avg ... by Participant" cells not.
 *
 * Driven on a user-added year seeded with A3's own 2025 data rows and its
 * Total row EMPTIED, so the engine has to fill it. Both surfaces, because the
 * ticket says the empty cells propagate to the report page.
 *
 * Usage: node repro_290.js [label]
 */
const path = require('path');
const fs = require('fs');
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LABEL = process.argv[2] || 'PRE-FIX';

const DEV = 'c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/';
const P = JSON.parse(fs.readFileSync(DEV + 'payload.json', 'utf8'));

/* A3 and A4's own rows, Total row emptied so the engine must compute it */
const seedRows = (id) => P.tables[id].data['2025'].map((r) => {
  const c = r.slice();
  if (/^total$/i.test(String(c[0] || '').trim())) for (let i = 1; i < c.length; i++) c[i] = null;
  return c;
});

const SEED = `
  localStorage.setItem('dac:years', JSON.stringify(['2098']));
  localStorage.setItem('dac:overrides', JSON.stringify({
    'A3:2098': ${JSON.stringify(seedRows('A3'))},
    'A4:2098': ${JSON.stringify(seedRows('A4'))}
  }));
`;

const totalRowOf = async (B, where) => B.eval(
  '(function(){' +
  'var sel = ' + JSON.stringify(where) + ';' +
  'var rows = Array.from(document.querySelectorAll(sel));' +
  'for (var i = 0; i < rows.length; i++) {' +
  '  var cells = Array.from(rows[i].querySelectorAll("td,th"));' +
  '  if (!cells.length) continue;' +
  '  var first = cells[0].querySelector("input") ? cells[0].querySelector("input").value' +
  '            : cells[0].textContent.trim();' +
  '  if (/^total$/i.test(first)) {' +
  '    return cells.map(function(c){ var inp=c.querySelector("input");' +
  '      return inp ? inp.value : c.textContent.trim(); });' +
  '  }' +
  '}' +
  'return null;})()');

(async () => {
  const say = (s) => console.log(s);
  say('======================================================================');
  say('CLCPA-290 ' + LABEL + ' -- the A3/A4 Total row on a live-calculated year');
  say('======================================================================');
  const D = await open({ seedStorage: SEED });
  const B = D.B;
  try {
    for (const id of ['A3', 'A4']) {
      say('');
      say('--- ' + id + ' / 2098, EDITOR --------------------------------');
      await D.gotoIngest();
      await D.pick('A', id, '2098');
      await sleep(700);
      say('  schema      : ' + JSON.stringify(
        P.tables[id].schema_by_year['2025']));
      const tr = await totalRowOf(B, '#ingest-editor-mount tbody tr');
      say('  TOTAL row   : ' + JSON.stringify(tr));
      const calc = await B.eval(
        '(function(){var n=document.querySelectorAll("#ingest-editor-mount .ingest-calc");' +
        'return Array.from(n).map(function(e){return e.textContent.trim();}).slice(0,8);})()');
      say('  calc spans  : ' + JSON.stringify(calc));

      say('--- ' + id + ' / 2098, SECTION PAGE --------------------------');
      await B.run('location.hash = "#/section/A";');
      await sleep(900);
      await B.run('var y=document.getElementById("year-select"); if(y){y.value="2098";' +
        'y.dispatchEvent(new Event("change",{bubbles:true}));}');
      await sleep(700);
      await B.click('[data-table-id="' + id + '"]');
      await sleep(900);
      const sr = await totalRowOf(B, 'table tbody tr');
      say('  TOTAL row   : ' + JSON.stringify(sr));
    }
    /* what the STORED year shows, for contrast -- it must not move */
    say('');
    say('--- A3 / 2025 (seed year), SECTION PAGE, must not move -----');
    await B.run('var y=document.getElementById("year-select"); if(y){y.value="2025";' +
      'y.dispatchEvent(new Event("change",{bubbles:true}));}');
    await sleep(800);
    await B.click('[data-table-id="A3"]');
    await sleep(900);
    say('  TOTAL row   : ' + JSON.stringify(await totalRowOf(B, 'table tbody tr')));

    await B.screenshot(path.join(__dirname,
      'repro_290_' + LABEL.toLowerCase().replace(/[^a-z]/g, '') + '.png'));
    say('');
    say('  page errors : ' + (D.errors().join(' | ') || 'none'));
  } finally { await D.close(); }
})().catch(e => { console.error('REPRO FAILED: ' + (e && e.stack || e)); process.exit(1); });
