/* CLCPA-193 boot measurement, v2. Paste in the TOP frame. READ ONLY.
 *
 * WHY V2. v1 asked for a paste into a calm window that does not exist: F5 lands on
 * Executive Summary and the map starts drawing at once, and after F5 the console
 * context resets to "top" -- where firstTract is null and layerRequests is 0,
 * because the tracts and the resource timings live in the web-resource IFRAME.
 * Switching the frame dropdown AND pasting inside ~2 s, ten times, is not a
 * protocol.
 *
 * V2 REMOVES THE RACE INSTEAD OF SHRINKING IT. The snippet stays in the TOP frame,
 * where it survives, and reloads the IFRAME itself. Reloading the iframe re-runs
 * app.js boot in a fresh document -- including mlHydrateSavedLayers, which is what
 * we are measuring -- so one paste gives N runs with no F5 and no timing pressure.
 * The observer is installed on the new contentDocument before the tracts exist,
 * because the snippet controls when the reload starts.
 *
 * WHAT firstTract MEANS IN V2: milliseconds since the IFRAME's navigation start,
 * read from the iframe's own performance object. NOT since the top frame's
 * navigation. That is the cleaner measure -- it excludes the Dynamics shell -- and
 * it is identical in the before and after sessions, which is the only property the
 * comparison needs. Every other timing (fcp, resources, long tasks) is likewise the
 * iframe's own.
 *
 * Same-origin (org9076e69b), so contentDocument, contentWindow.performance and
 * contentWindow.PerformanceObserver are all reachable.
 *
 * API unchanged from v1: dacPerf.snap / report / json / reset / count.
 * The one behavioural change: snap() now DRIVES a measured iframe reload and
 * returns a promise, so call it and wait for the log rather than pasting again.
 *
 * USE:
 *   1. paste this once, in the TOP frame, at any moment
 *   2. dacPerf.reset()
 *   3. dacPerf.snap('before')      <- repeat 5 times, waiting for each to finish
 *   4. dacPerf.report()            <- paste the JSON back
 */
(function () {
  'use strict';
  var KEY = 'dacPerf:runs';
  var MAXRUNS = 40;
  var FRAME_WAIT_MS = 60000;
  var TRACT_WAIT_MS = 45000;

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; }
  }
  function save(a) {
    try { localStorage.setItem(KEY, JSON.stringify(a.slice(-MAXRUNS))); } catch (e) {}
  }
  function round(n) { return n == null ? null : Math.round(n * 10) / 10; }
  function median(a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* Is this iframe the dashboard, and is it reachable? Same-origin means
   * contentDocument is readable; a foreign frame throws and is skipped. */
  function isDashFrame(ifr) {
    try {
      var src = String(ifr.src || '');
      if (/ExecutiveDashboard|cr2bf_dactest/i.test(src)) return true;
      var d = ifr.contentDocument;
      if (!d) return false;
      if (d.getElementById('dac-map-terr')) return true;
      if (d.querySelector('path.map-tract')) return true;
      if (/DAC/i.test(d.title || '')) return true;
      return false;
    } catch (e) { return false; }   // cross-origin: not ours
  }

  function findFrame() {
    var list = document.querySelectorAll('iframe');
    for (var i = 0; i < list.length; i++) {
      if (isDashFrame(list[i])) return list[i];
    }
    return null;
  }

  /* Pasted very early: the shell may not have created the iframe yet. */
  async function waitForFrame() {
    var t0 = Date.now();
    while (Date.now() - t0 < FRAME_WAIT_MS) {
      var f = findFrame();
      if (f) return f;
      await sleep(120);
    }
    throw new Error('no reachable dashboard iframe found within ' +
      (FRAME_WAIT_MS / 1000) + 's. Frames seen: ' + document.querySelectorAll('iframe').length);
  }

  function paintMs(win, which) {
    try {
      var p = win.performance.getEntriesByType('paint').filter(function (e) { return e.name === which; });
      return p.length ? round(p[0].startTime) : null;
    } catch (e) { return null; }
  }

  /* The saved-layer file downloads, read from the IFRAME's resource timeline. */
  function layerRequests(win) {
    var out = [];
    try {
      win.performance.getEntriesByType('resource').forEach(function (r) {
        var u = String(r.name);
        if (/dacmaplayer/i.test(u) || /cr2bf_file/i.test(u) || /maplayer/i.test(u)) {
          out.push({
            url: u.length > 140 ? u.slice(0, 140) + '...' : u,
            start: round(r.startTime),
            end: round(r.responseEnd),
            ms: round(r.duration),
            bytes: r.transferSize || r.encodedBodySize || null,
          });
        }
      });
    } catch (e) {}
    return out;
  }

  /* Every request the iframe made, bucketed, so a zero layer count can be told
   * apart from "the observer read the wrong document". */
  function requestSummary(win) {
    try {
      var all = win.performance.getEntriesByType('resource');
      return { total: all.length, sample: all.slice(0, 3).map(function (r) {
        return String(r.name).split('/').pop().slice(0, 48);
      }) };
    } catch (e) { return null; }
  }

  /**
   * One measured boot: reload the iframe, install the observer on the FRESH
   * document before tracts can exist, and resolve once the first tract path
   * appears (or the wait expires).
   */
  async function measuredReload(ifr) {
    var oldDoc = null;
    try { oldDoc = ifr.contentDocument; } catch (e) {}

    // Trigger the reload. location.reload() keeps the same URL including any
    // fragment the shell relies on; reassigning src can drop it.
    try { ifr.contentWindow.location.reload(); }
    catch (e) { ifr.src = ifr.src; }

    // Catch the new document as early as it is reachable. Polling rather than a
    // load listener: load fires after subresources, and app.js can have booted and
    // drawn by then.
    var t0 = Date.now();
    var doc = null, win = null;
    while (Date.now() - t0 < FRAME_WAIT_MS) {
      try {
        var d = ifr.contentDocument;
        if (d && d !== oldDoc && d.documentElement) { doc = d; win = ifr.contentWindow; break; }
        if (d && oldDoc && d === oldDoc && d.readyState === 'loading') { doc = d; win = ifr.contentWindow; break; }
      } catch (e) { /* mid-navigation access can throw; keep polling */ }
      await sleep(8);
    }
    if (!doc || !win) throw new Error('could not reach the reloaded iframe document');

    var alreadyThere = null;
    try { alreadyThere = !!doc.querySelector('path.map-tract'); } catch (e) {}

    // Long tasks, observed INSIDE the iframe so the timeline matches firstTract.
    var longTasks = [];
    var ltSupported = true;
    try {
      var po = new win.PerformanceObserver(function (list) {
        list.getEntries().forEach(function (e) {
          longTasks.push({ start: round(e.startTime), ms: round(e.duration) });
        });
      });
      po.observe({ type: 'longtask', buffered: true });
    } catch (e) { ltSupported = false; longTasks = null; }

    // First tract path, in the iframe's own document and on its own clock.
    var firstTract = await new Promise(function (resolve) {
      var done = false;
      function finish(v) { if (!done) { done = true; resolve(v); } }
      function check() {
        try {
          if (doc.querySelector('path.map-tract')) {
            var t = null;
            try { t = round(win.performance.now()); } catch (e) {}
            finish(t);
            return true;
          }
        } catch (e) {}
        return false;
      }
      if (check()) return;
      var mo = null;
      try {
        mo = new win.MutationObserver(function () { if (check() && mo) mo.disconnect(); });
        mo.observe(doc.documentElement, { childList: true, subtree: true });
      } catch (e) {}
      // Belt and braces: a poll, because a MutationObserver created in the iframe
      // can be lost if the document is swapped again underneath us.
      var iv = setInterval(function () { if (check()) clearInterval(iv); }, 60);
      setTimeout(function () {
        clearInterval(iv);
        if (mo) { try { mo.disconnect(); } catch (e) {} }
        finish(null);
      }, TRACT_WAIT_MS);
    });

    // Let the tail of hydration land before reading the timelines.
    await sleep(1200);

    return {
      firstTract: firstTract,
      alreadyThereAtInstall: alreadyThere,
      fcp: paintMs(win, 'first-contentful-paint'),
      firstPaint: paintMs(win, 'first-paint'),
      domContentLoaded: (function () {
        try {
          var n = win.performance.getEntriesByType('navigation')[0];
          return n ? round(n.domContentLoadedEventEnd) : null;
        } catch (e) { return null; }
      })(),
      layerRequests: layerRequests(win),
      requestSummary: requestSummary(win),
      longTasks: longTasks,
      ltSupported: ltSupported,
    };
  }

  window.dacPerf = {
    /**
     * Record one measured boot. Drives the iframe reload itself, so there is no
     * paste race and no F5. Returns a promise; wait for the log before the next.
     */
    snap: async function (label) {
      var ifr;
      try { ifr = await waitForFrame(); }
      catch (e) { console.error('[dacPerf] ' + e.message); return null; }

      console.log('[dacPerf] reloading the dashboard iframe and measuring' +
        (label ? ' (' + label + ')' : '') + '...');
      var m;
      try { m = await measuredReload(ifr); }
      catch (e) { console.error('[dacPerf] measurement failed: ' + e.message); return null; }

      var lt = m.longTasks;
      var run = {
        at: new Date().toISOString(),
        label: label || null,
        clock: 'iframe navigation start',
        firstTract: m.firstTract,
        fcp: m.fcp,
        firstPaint: m.firstPaint,
        domContentLoaded: m.domContentLoaded,
        layerRequests: m.layerRequests,
        layerRequestCount: m.layerRequests.length,
        layerBytes: m.layerRequests.reduce(function (s, r) { return s + (r.bytes || 0); }, 0) || null,
        longTasks: lt,
        longTaskCount: lt ? lt.length : null,
        longTaskTotalMs: lt ? round(lt.reduce(function (s, t) { return s + t.ms; }, 0)) : null,
        blockingBeforeTract: (function () {
          if (!lt || typeof m.firstTract !== 'number') return null;
          return round(lt.filter(function (t) { return t.start < m.firstTract; })
                         .reduce(function (s, t) { return s + t.ms; }, 0));
        })(),
        requestSummary: m.requestSummary,
        installWasClean: m.alreadyThereAtInstall === false,
      };
      var runs = load();
      runs.push(run);
      save(runs);

      console.log('[dacPerf] run ' + runs.length + ' recorded' + (label ? ' (' + label + ')' : '') + ':');
      console.log('   first tract path   : ' + run.firstTract + ' ms  (since iframe navigation start)');
      console.log('   FCP                : ' + run.fcp + ' ms');
      console.log('   layer downloads    : ' + run.layerRequestCount +
        (run.layerBytes ? '  (' + Math.round(run.layerBytes / 1024) + ' KB)' : ''));
      console.log('   long tasks         : ' + run.longTaskCount +
        (run.longTaskTotalMs !== null ? '  totalling ' + run.longTaskTotalMs + ' ms' : ''));
      console.log('   blocking BEFORE the first tract path : ' + run.blockingBeforeTract + ' ms');
      if (!run.installWasClean) {
        console.warn('   NOTE: tracts were already present when the observer went in, so ' +
          'firstTract is not trustworthy for this run. Discard it and snap again.');
      }
      if (run.layerRequestCount === 0) {
        console.warn('   NOTE: zero saved-layer downloads. Either no layers are seeded, or ' +
          'this is the wrong document. Total requests seen in the iframe: ' +
          (run.requestSummary ? run.requestSummary.total : 'unknown') + '.');
      }
      return run;
    },

    report: function () {
      var all = load();
      var runs = all.filter(function (r) {
        return typeof r.firstTract === 'number' && r.installWasClean !== false;
      });
      console.log('[dacPerf] ' + all.length + ' run(s) stored, ' + runs.length + ' usable.');
      if (!runs.length) {
        console.warn('   No usable runs. Each snap() must report a numeric firstTract ' +
          'and a clean observer install.');
        return null;
      }
      var f = runs.map(function (r) { return r.firstTract; });
      var fcp = runs.map(function (r) { return r.fcp; }).filter(function (v) { return typeof v === 'number'; });
      var blk = runs.map(function (r) { return r.blockingBeforeTract; })
                    .filter(function (v) { return typeof v === 'number'; });
      var out = {
        runs: runs.length,
        clock: 'ms since IFRAME navigation start',
        firstTract: { median: round(median(f)), min: round(Math.min.apply(null, f)),
                      max: round(Math.max.apply(null, f)),
                      variance: round(Math.max.apply(null, f) - Math.min.apply(null, f)) },
        fcp: fcp.length ? { median: round(median(fcp)), min: round(Math.min.apply(null, fcp)),
                            max: round(Math.max.apply(null, fcp)),
                            variance: round(Math.max.apply(null, fcp) - Math.min.apply(null, fcp)) } : null,
        blockingBeforeTract: blk.length ? { median: round(median(blk)),
                                            max: round(Math.max.apply(null, blk)) } : null,
        layerRequestCounts: runs.map(function (r) { return r.layerRequestCount; }),
        layerBytes: runs.map(function (r) { return r.layerBytes; }),
        longTaskSupported: runs[0].ltSupported !== false,
        labels: runs.map(function (r) { return r.label; }),
      };
      console.log(JSON.stringify(out, null, 2));
      return out;
    },

    json: function () { return JSON.stringify(load(), null, 2); },

    reset: function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      console.log('[dacPerf] cleared. Runs will start from 1.');
      return 'cleared';
    },

    count: function () { return load().length; },

    /* Which frame it will drive, without measuring anything. */
    frame: function () {
      var f = findFrame();
      if (!f) return 'no reachable dashboard iframe right now (' +
        document.querySelectorAll('iframe').length + ' iframe(s) in this document)';
      var info = { src: String(f.src || '').slice(0, 160) };
      try { info.title = f.contentDocument ? f.contentDocument.title : null; } catch (e) {}
      try { info.hasTracts = !!(f.contentDocument && f.contentDocument.querySelector('path.map-tract')); } catch (e) {}
      return info;
    },
  };

  console.log('[dacPerf v2] armed in the TOP frame. It drives the iframe, so there is no paste race.');
  console.log('  frame check : run  dacPerf.frame()');
  console.log('  measure     : await dacPerf.snap("before")     (repeat 5 times)');
  console.log('  aggregate   : dacPerf.report()   |   dacPerf.reset() between sessions');
  console.log('  firstTract is ms since the IFRAME navigation start, before and after alike.');
})();
/* === END dacPerf v2 === */
