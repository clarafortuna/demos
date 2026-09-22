/* CLCPA-247: the fourteen section-page tooltip surfaces, travelled with a REAL
 * pointer in Chrome, on a served build.
 *
 * WHY A REAL POINTER AND NOT A SYNTHETIC EVENT. The defect CLCPA-242 fixed is
 * a collision between mouseENTER and mouseOVER: enter fires once for the row,
 * over RE-FIRES as the pointer crosses into a child of the same row, and the
 * delegated control-tip handler hides the shared box on that second event. A
 * hand-built `new MouseEvent('mouseover')` on the row cannot reproduce that,
 * because the browser is what decides which element is under the pointer and
 * which of the two events to raise. So every move goes through
 * Input.dispatchMouseEvent and the browser raises the real sequence.
 *
 * THE TRAVEL IS DERIVED FROM THE SURFACE, NOT FROM FRACTIONS OF ITS WIDTH.
 * The first cut moved to 20%, 50% and 80% of the box and caught the defect on
 * four surfaces. That is a gesture, not a test: on a row whose children happen
 * to sit elsewhere those three points can land in the same child and cross no
 * boundary at all, and the surface reads clean while being just as broken.
 * The travel now visits ONE POINT INSIDE EVERY CHILD, so every boundary the
 * pointer can cross is crossed.
 *
 * AND EVERY POINT IS PROVEN TO HIT. document.elementFromPoint is asked whether
 * the point actually lands on the surface before it is used. Section H's pie
 * slices are SVG circles with fill="none", so only the stroked arc is
 * hittable and the centre of the bounding box hits nothing: the first cut
 * moved there, saw a tooltip that never opened, and would have recorded a
 * surface with no defect as a surface with no tooltip.
 *
 * OPACITY IS READ AFTER THE TRANSITION SETTLES. These boxes fade over 0.12s to
 * 0.15s, so a read 120ms after the move catches 0.9996 or 0.0004 and neither
 * number means anything. The reader polls until two consecutive samples agree.
 *
 * WHAT A FAILING SURFACE LOOKS LIKE: opacity 1 on entry, then 0 on a later
 * move inside the SAME surface. A passing one holds 1 throughout.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const live = require('../_kit/live_browser.js');
const { SURFACES } = require('./surfaces.js');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const LABEL = process.env.DAC_REPRO_LABEL || 'after';
const BASE = process.env.DAC_BASE_COMMIT || 'd880c0b';
const OUT = path.join(__dirname, 'repro-247-' + LABEL + '-output.txt');
const SHOT = path.join(__dirname, 'shots');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; log('  PASS  ' + m); } else { fail++; log('  FAIL  ' + m); } };

if (!fs.existsSync(SHOT)) fs.mkdirSync(SHOT);

/* ---- the build this run serves --------------------------------------- */
/* BEFORE IS A COMMIT, SERVED, not "the working tree with the change undone".
 * Both labels can therefore be re-run at any time and neither depends on what
 * happens to be uncommitted. The page fetches map_payload.json and
 * payload.json from its own directory, so a build is the whole top level;
 * Data/ is the pipeline and is never fetched, which is why it is left behind. */
function servedDir() {
  if (LABEL !== 'before') return DEV;
  const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
  const LF = new RegExp(String.fromCharCode(92) + 'r?' + String.fromCharCode(92) + 'n', 'g');
  const dir = path.join(process.env.TEMP || '.', 'clcpa247-before');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.readdirSync(DEV).forEach((f) => {
    const src = path.join(DEV, f);
    if (fs.statSync(src).isDirectory()) {
      if (f === 'logo') fs.cpSync(src, path.join(dir, f), { recursive: true });
      return;
    }
    fs.copyFileSync(src, path.join(dir, f));
  });
  ['app.js', 'styles.css'].forEach((f) => {
    const blob = execSync('git show ' + BASE + ':"Coned/CLCPA/ExecutiveDashboard_dev/' + f + '"',
      { cwd: ROOT, maxBuffer: 1 << 29 }).toString('utf8');
    fs.writeFileSync(path.join(dir, f), blob.replace(LF, CRLF));
  });
  return dir;
}

/* ---- in-page readers ------------------------------------------------ */
const tipRead = (sel) =>
  '(function(){var t=document.querySelector(' + JSON.stringify(sel) + ');' +
  'if(!t) return JSON.stringify({present:false});' +
  'var cs=getComputedStyle(t); var r=t.getBoundingClientRect();' +
  'return JSON.stringify({present:true,opacity:cs.opacity,' +
  'html:(t.innerHTML||"").length,' +
  'text:(t.textContent||"").replace(/\\s+/g," ").trim().slice(0,44),' +
  'left:Math.round(r.left),top:Math.round(r.top),' +
  'w:Math.round(r.width),h:Math.round(r.height),' +
  /* THE CLAMP, measured rather than described: a box whose right or bottom
   * edge is past the viewport is off screen, and that is what the flip and
   * the slide exist to prevent. Client coordinates on both sides. */
  'offRight:Math.round(r.right)>window.innerWidth,' +
  'offBottom:Math.round(r.bottom)>window.innerHeight,' +
  'offLeft:Math.round(r.left)<0,offTop:Math.round(r.top)<0,' +
  'vw:window.innerWidth,vh:window.innerHeight,' +
  'offW:t.offsetWidth,offH:t.offsetHeight});})()';

/* SETTLED opacity: poll until two consecutive samples agree, or give up and
 * say so rather than quoting a number caught mid-fade. */
async function tipState(B, sel) {
  let prev = null;
  for (let i = 0; i < 12; i++) {
    const st = JSON.parse(await B.eval(tipRead(sel)) || '{}');
    if (prev && prev.opacity === st.opacity) { st.settled = true; return st; }
    prev = st;
    await sleep(80);
  }
  prev.settled = false;
  return prev;
}

/* THE TRAVEL PATH, built in the page and PROVEN to hit the surface. */
const pathFor = (sel, want) =>
  '(function(){' +
  'var WANT=' + (want || 4) + ';' +
  'var el=document.querySelector(' + JSON.stringify(sel) + ');' +
  'if(!el) return JSON.stringify({found:false});' +
  'el.scrollIntoView({block:"center"});' +
  'var r=el.getBoundingClientRect();' +
  'var hits=function(x,y){var t=document.elementFromPoint(x,y);' +
  'return !!(t && (t===el || el.contains(t)));};' +
  'var pts=[];' +
  'var kids=[].slice.call(el.children);' +
  'kids.forEach(function(c){var k=c.getBoundingClientRect();' +
  'if(k.width<2||k.height<2) return;' +
  'var x=Math.round(k.left+k.width/2), y=Math.round(k.top+k.height/2);' +
  'if(hits(x,y)) pts.push({x:x,y:y,on:String(c.className&&c.className.baseVal!==undefined?c.className.baseVal:c.className||c.tagName).slice(0,22)});});' +
  /* no usable children, or none of them hittable: sample the surface itself.
   * A coarse grid, because a stroked SVG arc is hittable on a thin band that
   * no fraction of the bounding box is guaranteed to land on. */
  'if(pts.length<2){' +
  'for(var fy=0.1; fy<=0.9001; fy+=0.1){for(var fx=0.05; fx<=0.9501; fx+=0.05){' +
  'var X=Math.round(r.left+r.width*fx), Y=Math.round(r.top+r.height*fy);' +
  'if(hits(X,Y)) pts.push({x:X,y:Y,on:"self"});' +
  'if(pts.length>=WANT*6) break;}' +
  'if(pts.length>=WANT*6) break;}}' +
  /* thin to WANT well-separated stops, so the travel stays a travel */
  'var out=[];' +
  'if(pts.length){var step=Math.max(1,Math.floor(pts.length/WANT));' +
  'for(var i=0;i<pts.length && out.length<WANT;i+=step) out.push(pts[i]);}' +
  'return JSON.stringify({found:true,x:Math.round(r.left),y:Math.round(r.top),' +
  'w:Math.round(r.width),h:Math.round(r.height),kids:kids.length,' +
  'count:document.querySelectorAll(' + JSON.stringify(sel) + ').length,' +
  'stops:out});})()';

async function move(B, x, y) {
  await B.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  await sleep(90);
}

/* THE EDGE PROBE. The travel above walks whatever instance comes first, which
 * is usually mid-page and therefore says nothing about the clamp. This finds
 * the instance of the surface whose hittable point sits FURTHEST RIGHT and
 * FURTHEST DOWN in the viewport, and hovers that: it is the worst case the
 * page actually offers. Where the page offers no instance near an edge the
 * probe says so rather than implying a clamp was tested. */
const edgePointFor = (sel) =>
  '(function(){' +
  'var els=[].slice.call(document.querySelectorAll(' + JSON.stringify(sel) + '));' +
  'if(!els.length) return JSON.stringify({found:false});' +
  'var best=null;' +
  'els.forEach(function(el){' +
  'var r=el.getBoundingClientRect();' +
  'if(r.width<2||r.height<2) return;' +
  'for(var fy=0.9; fy>=0.1; fy-=0.2){for(var fx=0.95; fx>=0.05; fx-=0.05){' +
  'var x=Math.round(r.left+r.width*fx), y=Math.round(r.top+r.height*fy);' +
  'if(x<0||y<0||x>window.innerWidth||y>window.innerHeight) continue;' +
  'var t=document.elementFromPoint(x,y);' +
  'if(t && (t===el || el.contains(t))){' +
  'var score=x+y;' +
  'if(!best || score>best.score) best={x:x,y:y,score:score};' +
  'break;}}}});' +
  'return JSON.stringify({found:!!best,pt:best,' +
  'vw:window.innerWidth,vh:window.innerHeight});})()';

/* ---- one surface ----------------------------------------------------- */
async function walkSurface(B, s) {
  await B.eval(pathFor(s.walk));           // scrolls it into view
  await sleep(250);
  const p = JSON.parse(await B.eval(pathFor(s.walk)) || '{}');   // re-read after scroll
  if (!p.found) return { n: s.n, missing: true };
  if (!p.stops || !p.stops.length) return { n: s.n, unhittable: true, box: p };

  /* PARK OFF THE SURFACE FIRST, so "opened" means this gesture opened it and
   * not that the previous surface left it up. */
  await move(B, Math.max(2, p.x - 40), Math.max(2, p.y - 40));
  const parked = await tipState(B, s.tip);

  /* A HIT-ZONE SURFACE IS PROBED FIRST. Its handler hides the box between
   * zones on purpose, so a geometric sample records correct behaviour as a
   * defect. Only points that actually open a tooltip are travelled. */
  let stops = p.stops;
  if (s.zones) {
    const wide = JSON.parse(await B.eval(pathFor(s.walk, 16)) || '{}');
    const cands = (wide.stops && wide.stops.length >= 4) ? wide.stops : p.stops;
    const live = [];
    for (const c of cands) {
      await move(B, c.x, c.y);
      const t = await tipState(B, s.tip);
      if (t.opacity === '1' && t.html > 0) live.push(c);
      if (live.length >= 4) break;
    }
    if (live.length >= 2) stops = live;
    await move(B, Math.max(2, p.x - 40), Math.max(2, p.y - 40));
  }

  const seen = [];
  for (const st of stops) {
    await move(B, st.x, st.y);
    const t = await tipState(B, s.tip);
    seen.push({ on: st.on, x: st.x, y: st.y, op: t.opacity, html: t.html,
      left: t.left, top: t.top, w: t.w, h: t.h, text: t.text, settled: t.settled });
  }
  await move(B, Math.max(2, p.x - 40), Math.max(2, p.y - 40));
  const left = await tipState(B, s.tip);

  /* the worst case the page offers for the clamp */
  const ep = JSON.parse(await B.eval(edgePointFor(s.walk)) || '{}');
  let edge = null;
  if (ep.found) {
    await move(B, ep.pt.x, ep.pt.y);
    const t = await tipState(B, s.tip);
    edge = { at: ep.pt, vw: ep.vw, vh: ep.vh, opacity: t.opacity,
      left: t.left, top: t.top, w: t.w, h: t.h,
      offRight: t.offRight, offBottom: t.offBottom,
      offLeft: t.offLeft, offTop: t.offTop };
    await move(B, 2, 2);
  }
  return { n: s.n, box: p, parked, seen, left, edge };
}

(async () => {
  log('CLCPA-247: the fourteen section-page tooltip surfaces, travelled in Chrome');
  const head = execSync('git rev-parse --short HEAD', { cwd: ROOT }).toString().trim();
  const dirty = execSync('git status --porcelain -- Coned/CLCPA/ExecutiveDashboard_dev/app.js',
    { cwd: ROOT }).toString().trim();
  log('label: ' + LABEL + '   HEAD ' + head + (dirty ? ' + uncommitted app.js' : '') +
    '   serving: ' + (LABEL === 'before' ? 'app.js and styles.css from ' + BASE
      : 'the working tree'));
  log('');

  const D = await live.open({ dir: servedDir() });
  const B = D.B;
  const results = [];
  try {
    const bySection = {};
    SURFACES.forEach(s => { (bySection[s.section] = bySection[s.section] || []).push(s); });

    for (const letter of Object.keys(bySection)) {
      await B.run('location.hash = "#/section/' + letter + '";');
      for (let i = 0; i < 80; i++) {
        await sleep(150);
        if (await B.eval('!!document.querySelector("#view-container .chart-row")')) break;
      }
      await B.eval('document.fonts.ready.then(function(){return 1;})');
      await sleep(400);
      log('SECTION ' + letter);
      for (const s of bySection[letter]) {
        const r = await walkSurface(B, s);
        results.push(Object.assign({ s }, r));
        if (r.missing) {
          log('  ' + String(s.n).padStart(2) + '  ' + s.walk + '   NOT PRESENT on this page');
          continue;
        }
        if (r.unhittable) {
          log('  ' + String(s.n).padStart(2) + '  ' + s.walk +
            '   NO HITTABLE POINT (' + r.box.count + ' on page, box ' +
            r.box.w + 'x' + r.box.h + ')');
          continue;
        }
        log('  ' + String(s.n).padStart(2) + '  ' + s.walk +
          '   (' + r.box.count + ' on page, ' + r.box.kids + ' child element(s), ' +
          r.seen.length + ' stops)');
        log('       parked   opacity ' + r.parked.opacity);
        r.seen.forEach((v, i) => log('       stop ' + (i + 1) + '    opacity ' +
          String(v.op).padEnd(5) + ' html ' + String(v.html).padEnd(5) +
          ' box ' + v.w + 'x' + v.h + ' at ' + v.left + ',' + v.top +
          '   on ' + JSON.stringify(v.on)));
        log('       left     opacity ' + r.left.opacity + '   html ' + r.left.html);
        if (!r.edge) log('       edge     no instance offered a hittable point near an edge');
        else log('       edge     hovered at ' + r.edge.at.x + ',' + r.edge.at.y +
          ' of ' + r.edge.vw + 'x' + r.edge.vh + '   box ' + r.edge.w + 'x' + r.edge.h +
          ' at ' + r.edge.left + ',' + r.edge.top +
          '   offscreen: ' + (['right', 'bottom', 'left', 'top']
            .filter(k => r.edge['off' + k[0].toUpperCase() + k.slice(1)]).join('+') || 'no'));
      }
      await B.screenshot(path.join(SHOT, LABEL + '-section-' + letter + '.png'));
      log('');
    }

    /* ---- residue on re-render --------------------------------------- */
    /* TWO CASES, AND ONLY THE SECOND IS THE DEFECT.
     *
     * The first cut of this block changed the year with the pointer resting on
     * a row and called any visible box "RESIDUE". That is wrong: after the
     * re-render a NEW row is under the stationary pointer, the browser raises
     * mouseover on it, and the tooltip legitimately re-opens with the new
     * year's figures. It reported residue on both builds, and the two runs
     * differed only in content length. Stale is the word that matters, so the
     * reader now compares the TEXT.
     *
     * The second case is the one CLCPA-242's rule exists for: the rows the
     * tooltip describes are removed from under a stationary pointer. Chrome
     * raises no mouseleave for a node that is removed, so nothing closes the
     * box and it is left over a page that no longer contains its row. */
    log('RESIDUE ON RE-RENDER');
    const yr = SURFACES.filter(s => s.n === 2)[0];
    await B.run('location.hash = "#/section/G";');
    await sleep(1400);
    const yp = JSON.parse(await B.eval(pathFor(yr.walk)) || '{}');
    if (!yp.found || !yp.stops.length) log('  surface not present; residue not tested');
    else {
      /* CASE 1: year change, pointer left on the row */
      await move(B, yp.stops[0].x, yp.stops[0].y);
      const up = await tipState(B, yr.tip);
      const changed = await B.eval(
        '(function(){var s=document.getElementById("year-select");' +
        'if(!s) return "no year-select";' +
        'var opts=[].slice.call(s.options).map(function(o){return o.value;});' +
        'var other=opts.filter(function(v){return v!==s.value;})[0];' +
        'if(!other) return "only one year";' +
        's.value=other; s.dispatchEvent(new Event("change",{bubbles:true}));' +
        'return other;})()');
      await sleep(1000);
      const after = await tipState(B, yr.tip);
      const stale = after.opacity === '1' && after.text === up.text;
      log('  CASE 1  year change with the pointer still on the row');
      log('    before : opacity ' + up.opacity + '  ' + JSON.stringify(up.text));
      log('    year   : switched to ' + changed);
      log('    after  : opacity ' + after.opacity + '  ' + JSON.stringify(after.text));
      log('    -> ' + (after.opacity === '0' ? 'hidden, nothing shown'
        : stale ? 'STALE: the same text over re-rendered rows'
          : 'refreshed: a new row is under the pointer and its own tooltip opened'));
      ok(!stale, 'a year change does not leave the PREVIOUS year\'s text on screen');

      /* CASE 2: the rows go away under a stationary pointer */
      await move(B, 2, 2);
      await sleep(400);
      await B.run('location.hash = "#/section/G";');
      await sleep(1200);
      const yp2 = JSON.parse(await B.eval(pathFor(yr.walk)) || '{}');
      await move(B, yp2.stops[0].x, yp2.stops[0].y);
      const up2 = await tipState(B, yr.tip);
      /* NAVIGATE WITHOUT MOVING THE POINTER: the rows are replaced underneath
       * it by a section that has none of them. */
      await B.run('location.hash = "#/section/I";');
      await sleep(1400);
      const left2 = {};
      for (const sel of ['.exec-tooltip', '.e-tt', '.j-tt', '.d-tt', '.f-tt', '.h-pie-tt']) {
        const t = await tipState(B, sel);
        if (t.present) left2[sel] = { op: t.opacity, html: t.html, text: t.text };
      }
      log('  CASE 2  the rows are removed from under a stationary pointer');
      log('    tooltip up before  : opacity ' + up2.opacity + '  ' + JSON.stringify(up2.text));
      log('    after the route change, every tip div:');
      Object.keys(left2).forEach(k => log('      ' + k.padEnd(14) +
        'opacity ' + String(left2[k].op).padEnd(5) + ' html ' +
        String(left2[k].html).padEnd(5) + ' ' + JSON.stringify(left2[k].text)));
      /* THE SAME DISTINCTION AS CASE 1, and it caught the same misreading a
       * second time. A box showing the text it had before the rows went away
       * is residue. A box showing SOMETHING ELSE is a tooltip the new page
       * opened for whatever is now under the stationary pointer, which is
       * correct behaviour and not this ticket's business. Judged on the text,
       * not on the opacity. */
      const residue = Object.keys(left2).filter(k =>
        left2[k].op !== '0' && left2[k].text === up2.text);
      const reopened = Object.keys(left2).filter(k =>
        left2[k].op !== '0' && left2[k].text !== up2.text);
      /* and the content of every HIDDEN box must be cleared, which is the
       * other half of the rule: a hidden box still holding the last row's
       * text can flash it again before the next content is written */
      const holding = Object.keys(left2).filter(k =>
        left2[k].op === '0' && left2[k].html > 0);
      log('    -> ' + (residue.length ? 'RESIDUE: ' + residue.join(', ') +
        ' still showing the OLD text' : 'no stale box') +
        (reopened.length ? '   (re-opened for the new page: ' + reopened.join(', ') + ')' : '') +
        (holding.length ? '   (hidden but still holding text: ' + holding.join(', ') + ')' : ''));
      ok(residue.length === 0,
        'no tip is left showing the text of rows that were re-rendered away');
      ok(holding.length === 0,
        'and every hidden tip has had its content cleared: ' + JSON.stringify(holding));
      results.residue = { up, changed, after, stale, up2, left2, residue, reopened, holding };
    }
    log('');

    /* ---- a control tip, wherever one lives -------------------------- */
    log('CONTROL TIP, ESCAPE AND KEYBOARD FOCUS:');
    let found = null;
    for (const route of ['#/section/A', '#/section/G', '#/executive', '#/ingest']) {
      await B.run('location.hash = "' + route + '";');
      await sleep(1300);
      const c = await B.eval(
        '(function(){var c=document.querySelector("[data-tip]");if(!c) return "none";' +
        'c.scrollIntoView({block:"center"});var r=c.getBoundingClientRect();' +
        'return JSON.stringify({route:"' + route + '",' +
        'x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)});})()');
      if (c !== 'none') { found = JSON.parse(c); break; }
    }
    if (!found) log('  no [data-tip] control found on any route');
    else {
      log('  found one on ' + found.route);
      await move(B, found.x, found.y);
      const on = await tipState(B, '.exec-tooltip');
      await B.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await B.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sleep(300);
      const off = await tipState(B, '.exec-tooltip');
      log('  hovered         : opacity ' + on.opacity + ', text ' + JSON.stringify(on.text));
      log('  after Escape    : opacity ' + off.opacity);
      ok(on.opacity === '1', 'a control tip still opens on hover');
      ok(off.opacity === '0', 'and Escape still closes it');

      const kb = await B.eval(
        '(function(){var c=document.querySelector("[data-tip]");if(!c) return "none";' +
        'c.focus();return document.activeElement===c?"focused":"not focusable";})()');
      if (kb === 'focused') {
        const onF = await tipState(B, '.exec-tooltip');
        await B.run('document.activeElement && document.activeElement.blur();');
        const offF = await tipState(B, '.exec-tooltip');
        log('  keyboard focus  : opacity ' + onF.opacity + ' -> blur ' + offF.opacity);
        ok(onF.opacity === '1' && offF.opacity === '0',
          'keyboard focus still opens it and blur still closes it');
      } else {
        log('  keyboard focus  : ' + kb + ' (not asserted)');
      }
    }

    log('');
    log('PAGE ERRORS: ' + JSON.stringify(D.errors()));
    ok(D.errors().length === 0, 'no page errors during the whole walk');
  } finally {
    await D.close();
  }

  /* ---- the verdict table ------------------------------------------- */
  log('');
  log('THE FOURTEEN, ' + LABEL.toUpperCase());
  log('  #  sec  surface                              tip           opens  survives  clean / worst-case edge');
  const verdicts = [];
  results.forEach((r) => {
    const s = r.s;
    const row = (a, b, c) => log('  ' + String(s.n).padStart(2) + '  ' + s.section.padEnd(4) +
      s.walk.slice(0, 36).padEnd(37) + s.tip.padEnd(14) +
      String(a).padEnd(7) + String(b).padEnd(10) + String(c));
    if (r.missing) { row('NOT PRESENT', '', ''); verdicts.push({ n: s.n, missing: true }); return; }
    if (r.unhittable) { row('NO HIT POINT', '', ''); verdicts.push({ n: s.n, unhittable: true }); return; }
    const opens = r.seen[0].op === '1' && r.seen[0].html > 0;
    const survives = opens && r.seen.every(v => v.op === '1');
    const clean = r.left.opacity === '0';
    const offscreen = !!(r.edge && (r.edge.offRight || r.edge.offBottom ||
      r.edge.offLeft || r.edge.offTop));
    row(opens ? 'yes' : 'NO', survives ? 'yes' : 'NO',
      (clean ? 'yes' : 'NO') + (r.edge ? (offscreen ? '   OFFSCREEN' : '   on screen')
        : '   no edge case'));
    verdicts.push({ n: s.n, shared: s.shared, opens, survives, clean,
      edgeTested: !!r.edge, offscreen,
      stops: r.seen.length, ops: r.seen.map(v => v.op) });
  });

  fs.writeFileSync(path.join(__dirname, 'verdicts-' + LABEL + '.json'),
    JSON.stringify(verdicts, null, 2) + '\n');
  const live14 = verdicts.filter(v => !v.missing && !v.unhittable);
  log('');
  log('walked ' + live14.length + '/14   opens ' + live14.filter(v => v.opens).length +
    '   survives the travel ' + live14.filter(v => v.survives).length +
    '   clean on leave ' + live14.filter(v => v.clean).length);
  const broken = live14.filter(v => v.opens && !v.survives).map(v => v.n);
  log('hides mid-travel: ' + (broken.length ? broken.join(', ') : 'none'));
  const off = live14.filter(v => v.offscreen).map(v => v.n);
  log('goes off screen at its worst case: ' + (off.length ? off.join(', ') : 'none') +
    '   (edge case available on ' + live14.filter(v => v.edgeTested).length + '/' +
    live14.length + ')');
  log('');
  log(pass + ' passed, ' + fail + ' failed');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  log('THREW: ' + (e && e.stack || e));
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  process.exit(2);
});
