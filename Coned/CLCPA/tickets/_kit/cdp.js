/* A REAL BROWSER, driven over the DevTools Protocol.
 *
 * WHY THIS EXISTS, and it is not a preference. Three consecutive hosted FAILs
 * shipped green out of the Node bench. The bench reproduces LOGIC: it runs the
 * real functions against a real object graph and it is good at that. It cannot
 * see the rendered surface -- which mount a repaint touched, whether a click
 * produced a visible row, what a cell actually displays after a blur. Every one
 * of the three defects lived exactly there.
 *
 * So gestures are now driven in Chrome against a served build. Real layout,
 * real event dispatch, real re-render. Evidence is the rendered DOM and a
 * screenshot, not a suite tally.
 *
 * No driver library is installed and none is needed: Chrome speaks CDP over a
 * WebSocket, and Node has had a global WebSocket since 22.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(p => fs.existsSync(p));

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function getJson(port, route) {
  return new Promise((res, rej) => {
    const req = http.get({ host: '127.0.0.1', port, path: route }, (r) => {
      let b = '';
      r.on('data', c => { b += c; });
      r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
    });
    req.on('error', rej);
  });
}

/** Serve a directory over HTTP. fetch() needs http, not file://. */
function serve(dir, port) {
  const py = spawn('python', ['-m', 'http.server', String(port), '--bind', '127.0.0.1'],
    { cwd: dir, stdio: 'ignore', detached: false });
  /* WAIT FOR IT TO ANSWER, and do not make the caller guess.
   *
   * This used to return the moment python was spawned. Chrome's debugging
   * endpoint IS waited for below, so the race looked handled, but the HTTP
   * server was not: on a cold machine python loses that race, the first goto
   * lands on about:blank, and the failure surfaces much later as
   * "SecurityError: Access is denied for this document" from a sessionStorage
   * write -- a message that says nothing about a server not being up. Cost an
   * afternoon's confusion after a restart.
   *
   * ready resolves when the port answers and rejects with a sentence naming
   * the real cause if it never does. */
  const ready = (async () => {
    const deadline = Date.now() + 20000;
    for (;;) {
      const up = await new Promise((resolve) => {
        const req = http.get(
          { host: '127.0.0.1', port: port, path: '/', timeout: 1000 },
          (res) => { res.resume(); resolve(true); });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
      });
      if (up) return true;
      if (Date.now() > deadline) {
        throw new Error('cdp.serve: nothing answered on 127.0.0.1:' + port +
          ' within 20s. The static server never came up, so any page opened ' +
          'against it would be about:blank.');
      }
      await new Promise(r => setTimeout(r, 100));
    }
  })();
  return { proc: py, ready: ready, stop: () => { try { py.kill(); } catch (e) {} } };
}

async function launch(opts) {
  const o = opts || {};
  const port = o.port || 9333;
  if (!CHROME) throw new Error('cdp: no Chrome or Edge found');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-profile-'));
  const args = [
    '--headless=new',
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--disable-dev-shm-usage',
    '--window-size=1600,1200',
    'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: 'ignore' });

  /* wait for the debugging endpoint rather than sleeping a guessed interval */
  let list = null;
  for (let i = 0; i < 100; i++) {
    await sleep(200);
    try { list = await getJson(port, '/json/list'); if (list && list.length) break; } catch (e) {}
  }
  if (!list || !list.length) { try { proc.kill(); } catch (e) {} throw new Error('cdp: browser never opened a debugging port'); }

  const target = list.find(t => t.type === 'page') || list[0];
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let id = 0;
  const pending = new Map();
  const consoleLines = [];
  const pageErrors = [];
  ws.onmessage = (ev) => {
    let m; try { m = JSON.parse(ev.data); } catch (e) { return; }
    if (m.id && pending.has(m.id)) {
      const { res, rej } = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) rej(new Error('cdp: ' + JSON.stringify(m.error))); else res(m.result);
      return;
    }
    if (m.method === 'Runtime.consoleAPICalled') {
      consoleLines.push((m.params.args || []).map(a =>
        a.value !== undefined ? String(a.value) : (a.description || a.type)).join(' '));
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails || {};
      pageErrors.push((d.exception && (d.exception.description || d.exception.value)) || d.text || 'error');
    }
  };
  const send = (method, params) => new Promise((res, rej) => {
    const mid = ++id;
    pending.set(mid, { res, rej });
    ws.send(JSON.stringify({ id: mid, method, params: params || {} }));
    setTimeout(() => { if (pending.has(mid)) { pending.delete(mid); rej(new Error('cdp: timeout on ' + method)); } }, o.timeout || 30000);
  });

  await send('Runtime.enable');
  await send('Page.enable');

  const B = {
    send, consoleLines, pageErrors,
    /** navigate and wait for the app to finish its own boot */
    goto: async (url, readySelector) => {
      await send('Page.navigate', { url });
      for (let i = 0; i < 200; i++) {
        await sleep(150);
        const r = await B.eval('document.readyState === "complete" && ' +
          (readySelector ? '!!document.querySelector(' + JSON.stringify(readySelector) + ')' : 'true'));
        if (r === true) return true;
      }
      throw new Error('cdp: page never became ready' + (readySelector ? ' for ' + readySelector : ''));
    },
    /** evaluate an expression in the page and return its JSON value */
    eval: async (expr) => {
      const r = await send('Runtime.evaluate', {
        expression: '(function(){ return (' + expr + '); })()',
        returnByValue: true, awaitPromise: true,
      });
      if (r.exceptionDetails) {
        throw new Error('cdp eval: ' +
          ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) ||
            r.exceptionDetails.text));
      }
      return r.result.value;
    },
    /** run statements (no implicit return) */
    run: async (code) => {
      const r = await send('Runtime.evaluate', {
        expression: '(function(){ ' + code + ' })()',
        returnByValue: true, awaitPromise: true,
      });
      if (r.exceptionDetails) {
        throw new Error('cdp run: ' +
          ((r.exceptionDetails.exception && r.exceptionDetails.exception.description) ||
            r.exceptionDetails.text));
      }
      return r.result.value;
    },
    /** a REAL click: the browser dispatches it, with coordinates */
    click: async (selector) => {
      const box = await B.eval(
        '(function(){var e=document.querySelector(' + JSON.stringify(selector) + ');' +
        'if(!e) return null; var r=e.getBoundingClientRect();' +
        'return {x:r.left+r.width/2, y:r.top+r.height/2, w:r.width, h:r.height};})()');
      if (!box) throw new Error('cdp: no element for click ' + selector);
      if (!box.w || !box.h) throw new Error('cdp: element has no box (not visible): ' + selector);
      for (const type of ['mousePressed', 'mouseReleased']) {
        await send('Input.dispatchMouseEvent', {
          type, x: box.x, y: box.y, button: 'left', clickCount: 1,
        });
      }
      await sleep(60);
      return box;
    },
    /** focus a field and type it one character at a time, as a person does */
    typeInto: async (selector, text) => {
      await B.click(selector);
      await B.run('var e=document.querySelector(' + JSON.stringify(selector) + '); if(e){e.focus(); e.value="";}');
      for (const ch of String(text)) {
        await send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch });
        await send('Input.dispatchKeyEvent', { type: 'keyUp' });
      }
      await sleep(40);
    },
    /** leave the field: a real blur, which is what commits an edit */
    blur: async (selector) => {
      await B.run('var e=document.querySelector(' + JSON.stringify(selector) + '); if(e) e.blur();');
      await sleep(120);
    },
    screenshot: async (file) => {
      const r = await send('Page.captureScreenshot', { format: 'png' });
      fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
      return file;
    },
    close: async () => { try { ws.close(); } catch (e) {} try { proc.kill(); } catch (e) {} },
  };
  return B;
}

module.exports = { launch, serve, CHROME };
