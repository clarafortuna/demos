/* The black-button ticket: + Add Row renders black in its FOCUS state.
 *
 * A CSS assertion is not a layout observation, and a computed colour read from
 * a real browser is neither guesswork nor a grep. This reads getComputedStyle
 * on the real element in each real state, with the state really applied:
 * focus by focusing it, hover by dispatching over it, active by holding the
 * mouse down on it.
 *
 * It sweeps EVERY button on the editor surfaces, not just the one reported,
 * because a token defect is rarely singular.
 *
 * Usage: node repro_btn.js [label]
 */
const path = require('path');
const { open } = require('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/tickets/_kit/live_browser.js');
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const LABEL = process.argv[2] || 'PRE-FIX';

const SEED = `
  localStorage.setItem('dac:years', JSON.stringify(['2094']));
  localStorage.setItem('dac:overrides', JSON.stringify({
    'H1:2094': [['Manhattan', 100, 200, 300]]
  }));
`;

/* Read the painted colours of one element, ONCE THE COLOUR HAS SETTLED.
 *
 * These controls carry `transition: background 0.15s ease`, so a read taken a
 * fixed moment after the state is applied catches the animation partway and
 * returns a different alpha every run -- 0.992 once, 0.97 the next. That is a
 * fake precision, and it would have gone into the record as a measurement.
 * Poll until two consecutive reads agree, then report that. */
const readState = async (B, sel) => {
  let last = null;
  for (let i = 0; i < 40; i++) {
    const now = await B.eval(
      '(function(){' +
      'var e=document.querySelector(' + JSON.stringify(sel) + ');' +
      'if(!e) return null;' +
      'var s=getComputedStyle(e);' +
      'return {bg:s.backgroundColor, fg:s.color, border:s.borderColor,' +
      ' outline:s.outlineColor, shadow:(s.boxShadow||"").slice(0,60)};' +
      '})()');
    if (now === null) return null;
    if (last && last.bg === now.bg && last.fg === now.fg) return now;
    last = now;
    await sleep(60);
  }
  return last;
};

async function sweep(B, sel, label, say) {
  const rest = await readState(B, sel);
  if (!rest) { say('  ' + label.padEnd(22) + ' (not present)'); return; }
  /* FOCUS, really applied */
  await B.run('var e=document.querySelector(' + JSON.stringify(sel) + '); if(e) e.focus();');
  await sleep(120);
  const focus = await readState(B, sel);
  /* HOVER, really dispatched at the element's own coordinates */
  const box = await B.eval('(function(){var e=document.querySelector(' + JSON.stringify(sel) +
    ');if(!e)return null;var r=e.getBoundingClientRect();' +
    'return {x:r.left+r.width/2,y:r.top+r.height/2};})()');
  if (box) {
    await B.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
    await sleep(120);
  }
  const hover = await readState(B, sel);
  /* ACTIVE: hold the button down */
  if (box) {
    await B.send('Input.dispatchMouseEvent',
      { type: 'mousePressed', x: box.x, y: box.y, button: 'left', clickCount: 1 });
    await sleep(120);
  }
  const active = await readState(B, sel);
  if (box) {
    await B.send('Input.dispatchMouseEvent',
      { type: 'mouseReleased', x: box.x, y: box.y, button: 'left', clickCount: 1 });
  }
  await B.run('if(document.activeElement && document.activeElement.blur) document.activeElement.blur();');
  await B.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 5, y: 5 });
  await sleep(120);

  const line = (n, s) => '      ' + n.padEnd(7) + ' bg ' + String(s.bg).padEnd(22) +
    ' fg ' + String(s.fg).padEnd(22);
  say('  ' + label + '   ' + sel);
  say(line('rest', rest));
  say(line('focus', focus));
  say(line('hover', hover));
  say(line('active', active));
  const black = (c) => /rgba?\(\s*0,\s*0,\s*0\s*[,)]/.test(String(c));
  const flags = [];
  if (black(focus.bg) && !black(rest.bg)) flags.push('FOCUS BG GOES BLACK');
  if (black(hover.bg) && !black(rest.bg)) flags.push('HOVER BG GOES BLACK');
  if (black(active.bg) && !black(rest.bg)) flags.push('ACTIVE BG GOES BLACK');
  if (flags.length) say('      >>> ' + flags.join(' | '));
}

(async () => {
  const say = (s) => console.log(s);
  say('======================================================================');
  say('BLACK BUTTON ' + LABEL + ' -- every button state on the editor surfaces');
  say('======================================================================');
  const D = await open({ seedStorage: SEED });
  const B = D.B;
  try {
    await D.gotoIngest();
    await D.pick('H', 'H1', '2094');
    await sleep(500);
    const targets = [
      ['#ingest-add-row', 'Add Row (reported)'],
      ['#ingest-save', 'Save Changes'],
      ['#ingest-reset', 'Reset'],
      ['#ingest-addyear', 'Add Data'],
      ['#ingest-remove-year', 'Remove Year'],
      ['.ingest-row-delete', 'row delete'],
      ['.src-tab', 'source tab'],
    ];
    for (const [sel, label] of targets) { await sweep(B, sel, label, say); say(''); }

    /* and the dialog's own buttons, which are a different surface */
    await B.click('#ingest-addyear'); await sleep(700);
    say('--- inside the Add Data dialog ---');
    for (const [sel, label] of [['#ingest-modal-close', 'dialog close'],
      ['#ingest-template', 'Download Template']]) { await sweep(B, sel, label, say); say(''); }

    await B.screenshot(path.join(__dirname,
      'repro_btn_' + LABEL.toLowerCase().replace(/[^a-z]/g, '') + '.png'));
    say('page errors: ' + (D.errors().join(' | ') || 'none'));
  } finally { await D.close(); }
})().catch(e => { console.error('FAILED: ' + (e && e.stack || e)); process.exit(1); });
