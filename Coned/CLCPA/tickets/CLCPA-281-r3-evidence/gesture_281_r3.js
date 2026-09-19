/* CLCPA-281 round 3, POST-FIX reproduction, in a real browser.
 *
 * The gesture: section F, table F6, year 2099. The read-only SECTION page must
 * draw both header levels. The editor half passed hosted today; this is the
 * surface that did not.
 *
 * The section page is a TAB ROW, like the editor's: data-table-id sits on a
 * button and the table appears only once it is clicked. Read from the page,
 * not assumed -- the first cut of this script looked for a table inside the
 * tab and reported "no table", which is a harness defect, not a finding.
 *
 * Both provenances, user-added first, as the standard requires.
 */
const path = require('path');
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const SEED = `
  localStorage.setItem('dac:years', JSON.stringify(['2099']));
  localStorage.setItem('dac:overrides', JSON.stringify({
    'F6:2099': [
      ['Bay Ridge', 'Brooklyn', 11, 22, 33, 44, 110],
      ['Test Row', 'Queens', 1, 2, 3, 4, 10]
    ]
  }));
`;

/** the visible table on the section page, header rows and first body rows */
const readTable = async (B) => B.eval(
  '(function(){' +
  'var tbls=Array.from(document.querySelectorAll("table")).filter(function(t){' +
  '  return t.offsetParent !== null; });' +
  'if(!tbls.length) return {table:false, count:document.querySelectorAll("table").length};' +
  'var t=tbls[0];' +
  'var head=Array.from(t.querySelectorAll("thead tr")).map(function(tr){' +
  '  return Array.from(tr.querySelectorAll("th,td")).map(function(c){' +
  '    return c.textContent.trim()+(c.colSpan>1?"(x"+c.colSpan+")":"");});});' +
  'var body=Array.from(t.querySelectorAll("tbody tr")).slice(0,3).map(function(tr){' +
  '  return Array.from(tr.querySelectorAll("td,th")).map(function(c){return c.textContent.trim();});});' +
  'return {table:true, headerRows:head.length, head:head, bodyRows:t.querySelectorAll("tbody tr").length, bodyFirst:body};' +
  '})()');

(async () => {
  const D = await open({ seedStorage: SEED });
  const B = D.B;
  const say = (s) => console.log(s);

  say('======================================================================');
  say('CLCPA-281 r3 POST-FIX -- the SECTION page, in Chrome, on a served build');
  say('  build: ' + (B.consoleLines.find(l => /\[DAC dashboard\] build/.test(l)) || '(none)'));
  say('======================================================================');

  for (const [prov, year] of [['USER-ADDED', '2099'], ['SEED', '2025']]) {
    say('');
    say('--- ' + prov + '  year ' + year + ' -------------------------------');
    await B.run('location.hash = "#/section/F";');
    await sleep(900);
    const picked = await B.run(
      'var y=document.getElementById("year-select")||document.querySelector("[data-year-select]");' +
      'if(y){y.value=' + JSON.stringify(year) + ';y.dispatchEvent(new Event("change",{bubbles:true}));return "set "+y.value;}' +
      'return "NO YEAR CONTROL";');
    say('  year control : ' + picked);
    await sleep(700);
    await B.click('[data-table-id="F6"]');       /* the tab, really clicked */
    await sleep(900);
    say('  clicked the F.6 tab');

    const r = await readTable(B);
    if (!r.table) { say('  NO VISIBLE TABLE (' + r.count + ' in the DOM)'); continue; }
    say('  HEADER ROWS DRAWN : ' + r.headerRows + '   (F6 declares header_levels 2)');
    r.head.forEach((row, i) => say('    level ' + (i + 1) + ': ' + JSON.stringify(row)));
    say('  body rows: ' + r.bodyRows);
    r.bodyFirst.forEach((b, i) => say('    row ' + i + ': ' + JSON.stringify(b)));
  }

  await B.screenshot(path.join(__dirname, 'repro_281_r3_postfix.png'));
  say('');
  say('screenshot: repro_281_r3_postfix.png');
  const errs = D.errors();
  say('page errors: ' + (errs.length ? errs.join(' | ') : 'none'));
  await D.close();
})().catch(e => { console.error('REPRO FAILED: ' + (e && e.stack || e)); process.exit(1); });
