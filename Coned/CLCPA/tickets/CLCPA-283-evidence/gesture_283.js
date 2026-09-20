const _dacRepo = () => {
  const p = require('path'), f = require('fs');
  if (process.env.DAC_REPO) return p.resolve(process.env.DAC_REPO);
  let d = __dirname;
  for (let i = 0; i < 16; i++) {
    if (f.existsSync(p.join(d, '.clcpa-root'))) {
      const two = p.resolve(d, '..', '..');
      return f.existsSync(p.join(two, '.git')) ? two : d;
    }
    const u = p.dirname(d); if (u === d) break; d = u;
  }
  throw new Error('CLCPA project root not found above ' + __dirname + '; set DAC_REPO');
};
/* CLCPA-283, in a real browser: Remove Year promises a delete and then
 * refuses it.
 *
 * The owner's live reproduction is 2096 on the org, "user-added, ONE save".
 * 2096 IS NOT TOUCHED: this runs on fresh scratch years in localStorage.
 *
 * THE SEQUENCE THAT MATTERS, and it is why "one save" is in the report:
 *   1. add a year -> it is empty, so the Remove control is offered
 *   2. type a value and SAVE -> the year now holds data
 *   3. the Remove control is STILL on screen: its visibility was decided at
 *      render, and nothing re-decided it
 *   4. click it. The dialog promises "This will also delete any saved data
 *      for <year>. This cannot be undone."
 *   5. confirm -> Storage.removeYear re-asks isYearProtected, which NOW says
 *      protected, and answers with a red toast
 *
 * Two readings of one question, taken at two moments. Net effect: no
 * user-added year that has ever been saved can be removed from the UI.
 *
 * Usage: node repro_283.js [label]
 */
const path = require('path');
const { open } = require(_dacRepo() + '/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LABEL = process.argv[2] || 'PRE-FIX';

/* 2094 and 2093 added and EMPTY, exactly as "+ Add Data" leaves a new year */
const SEED = `
  localStorage.setItem('dac:years', JSON.stringify(['2094', '2093']));
  localStorage.setItem('dac:overrides', JSON.stringify({}));
`;

const textOf = async (B, sel) => {
  const t = await B.eval('(function(){var e=document.querySelector(' +
    JSON.stringify(sel) + ');return e?e.textContent:"";})()');
  return String(t || '').split(/\s+/).join(' ').trim();
};
const removeBtn = (B) => B.eval(
  '(function(){var b=document.getElementById("ingest-remove-year");' +
  'if(!b) return {there:false};' +
  'var r=b.getBoundingClientRect();' +
  'return {there:true, hidden:!!b.hidden, visible:!!(r.width&&r.height), text:b.textContent.trim()};})()');

async function tryRemove(B, D, year, say) {
  await B.run('var h=document.getElementById("dac-toast-host"); if(h) h.textContent="";');
  const before = await removeBtn(B);
  say('  Remove control       : ' + JSON.stringify(before));
  if (!before.there || !before.visible) { say('  -> not clickable, nothing to confirm'); return false; }
  await B.click('#ingest-remove-year');
  await sleep(700);
  say('  DIALOG SAYS          : ' + (await textOf(B, '.ingest-modal, .modal, [role=dialog]')).slice(0, 240));
  const how = await B.run(
    'var b=document.getElementById("ingest-modal-confirm")||document.querySelector(\'[data-cfm="confirm"]\');' +
    'if(!b){var a=Array.from(document.querySelectorAll("button"));' +
    ' b=a.filter(function(x){return /^Remove /.test(x.textContent.trim());})[0];}' +
    'if(!b) return "NO CONFIRM CONTROL"; b.click(); return "confirmed via "+(b.id||b.textContent.trim());');
  say('  confirm              : ' + how);
  await sleep(1000);
  say('  TOAST / NOTICE       : ' + (await textOf(B, '#dac-toast-host')).slice(0, 200));
  say('  dac:years now        : ' + JSON.stringify(await B.eval('JSON.parse(localStorage.getItem("dac:years")||"[]")')));
  say('  override keys now    : ' + JSON.stringify(await B.eval('Object.keys(JSON.parse(localStorage.getItem("dac:overrides")||"{}"))')));
  say('  year selector shows  : ' + JSON.stringify(await B.eval(
    '(function(){var s=document.getElementById("ingest-year");return s?Array.from(s.options).map(function(o){return o.value;}):[];})()')));
  return true;
}

(async () => {
  const say = (s) => console.log(s);
  say('======================================================================');
  say('CLCPA-283 ' + LABEL + ' -- Remove Year, in Chrome');
  say("  2096 is the owner's CLCPA-301 reproduction and is NOT touched here");
  say('======================================================================');

  const D = await open({ seedStorage: SEED });
  const B = D.B;
  try {
    say('');
    say('--- USER-ADDED 2094, EMPTY (before any save) ----------------------');
    await D.gotoIngest();
    await D.pick('H', 'H1', '2094');
    await sleep(400);
    say('  Remove control       : ' + JSON.stringify(await removeBtn(B)));

    say('');
    say('--- the ONE SAVE: add a row, type a value, save -------------------');
    await D.clickAddRow();
    await sleep(300);
    await D.typeCell(0, 0, 'Manhattan');
    await D.typeCell(0, 1, '100');
    await D.typeCell(0, 2, '200');
    const answered = await D.clickSave();
    say('  save confirmed       : ' + answered);
    say('  stored H1:2094       : ' + JSON.stringify(await D.storedRows('H1', '2094')));

    say('');
    say('--- NOW click Remove, with the control still on screen ------------');
    await tryRemove(B, D, '2094', say);

    say('');
    say('--- USER-ADDED 2093, never saved (the case that works today) ------');
    await D.pick('H', 'H1', '2093');
    await sleep(500);
    await tryRemove(B, D, '2093', say);

    say('');
    say('--- SEED 2025 (must stay unremovable, either side of the fix) -----');
    await D.pick('H', 'H1', '2025');
    await sleep(500);
    say('  Remove control       : ' + JSON.stringify(await removeBtn(B)));

    await B.screenshot(path.join(__dirname,
      'repro_283_' + LABEL.toLowerCase().replace(/[^a-z]/g, '') + '.png'));
    say('');
    say('  page errors: ' + (D.errors().join(' | ') || 'none'));
  } finally { await D.close(); }
})().catch(e => { console.error('REPRO FAILED: ' + (e && e.stack || e)); process.exit(1); });
