/* dacPerf ADDENDUM -- read-only, reads the runs already in localStorage.
 *
 * RUN THIS BEFORE dacPerf.reset(). It measures nothing new and reloads nothing:
 * it reads the five baseline runs you already captured and computes the number
 * the report did not print.
 *
 * WHY IT IS NEEDED. blockingBeforeTract came back 0 on all five runs with
 * longtask support ON, and that is the correct answer, not a broken probe: the
 * layer GeoJSON cannot be parsed until it has finished downloading, and 5.8 MB
 * finishes at or after the first tract path. So there is no main-thread work
 * before firstTract to attribute, and the contention is on the NETWORK, not the
 * CPU. The number that will move is therefore not blockingBeforeTract and not
 * firstTract (598 ms of variance on a 3,778 ms median swamps the effect) but:
 *
 *     the layer bytes whose download STARTS before the first tract path
 *
 * That is deterministic -- it goes to zero -- and every run already stores what
 * it needs: layerRequests[].start / .end / .bytes, and firstTract.
 *
 * Paste in the TOP frame, same as the snippet. It needs no frame access at all.
 */
(function () {
  'use strict';
  var KEY = 'dacPerf:runs';
  var runs;
  try { runs = JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { runs = []; }
  if (!runs.length) {
    console.warn('[dacPerf+] no stored runs under ' + KEY + '. If you have already ' +
      'run reset(), this cannot be recovered -- say so and I will get it another way.');
    return;
  }
  var r1 = function (n) { return n == null ? null : Math.round(n * 10) / 10; };
  var med = function (a) {
    if (!a.length) return null;
    var s = a.slice().sort(function (x, y) { return x - y; });
    var m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  var kb = function (b) { return b == null ? '?' : Math.round(b / 1024) + ' KB'; };

  var perRun = [];
  console.log('[dacPerf+] ' + runs.length + ' stored run(s). Per-run breakdown:');
  runs.forEach(function (run, i) {
    var ft = run.firstTract;
    var reqs = run.layerRequests || [];
    var beforeCount = 0, beforeBytes = 0, straddling = 0, afterCount = 0;
    var lastEndBeforeTract = 0, firstStart = null, lastEnd = 0;
    reqs.forEach(function (q) {
      if (firstStart === null || q.start < firstStart) firstStart = q.start;
      if (q.end > lastEnd) lastEnd = q.end;
      if (typeof ft !== 'number') return;
      if (q.start < ft) {
        beforeCount++;
        beforeBytes += (q.bytes || 0);
        if (q.end > ft) straddling++;
        else if (q.end > lastEndBeforeTract) lastEndBeforeTract = q.end;
      } else afterCount++;
    });
    var row = {
      run: i + 1, label: run.label || null,
      firstTract: ft,
      requests: reqs.length,
      startedBeforeTract: beforeCount,
      bytesStartedBeforeTract: beforeBytes,
      stillInFlightAtTract: straddling,
      startedAfterTract: afterCount,
      layerWindow: (firstStart === null ? null : r1(firstStart) + ' -> ' + r1(lastEnd) + ' ms'),
    };
    perRun.push(row);
    console.log('  run ' + row.run + ': firstTract ' + ft + ' ms | ' + reqs.length +
      ' layer-matched requests | ' + beforeCount + ' started before the tract path (' +
      kb(beforeBytes) + ') | ' + straddling + ' still downloading AT the tract path | ' +
      afterCount + ' started after | download window ' + row.layerWindow);
  });

  // The individual requests of the median run, so the six metadata calls can be
  // told apart from the two GeoJSON downloads by size.
  var mid = runs[Math.floor(runs.length / 2)];
  console.log('');
  console.log('[dacPerf+] the requests of one representative run, by size:');
  (mid.layerRequests || []).slice()
    .sort(function (a, b) { return (b.bytes || 0) - (a.bytes || 0); })
    .forEach(function (q) {
      var tail = String(q.url).split('/api/data/v9.2/')[1] || q.url;
      console.log('    ' + String(kb(q.bytes)).padStart(9) + '  start ' +
        String(r1(q.start)).padStart(7) + '  ' + String(r1(q.ms)).padStart(6) + ' ms  ' +
        tail.slice(0, 96));
    });

  var summary = {
    runs: perRun.length,
    clock: 'ms since IFRAME navigation start (same as the snippet)',
    firstTractMedian: r1(med(perRun.map(function (p) { return p.firstTract; })
      .filter(function (v) { return typeof v === 'number'; }))),
    requestsMedian: med(perRun.map(function (p) { return p.requests; })),
    startedBeforeTractMedian: med(perRun.map(function (p) { return p.startedBeforeTract; })),
    bytesStartedBeforeTractMedian: med(perRun.map(function (p) { return p.bytesStartedBeforeTract; })),
    bytesStartedBeforeTractKB: r1(med(perRun.map(function (p) { return p.bytesStartedBeforeTract; })) / 1024),
    stillInFlightAtTractMedian: med(perRun.map(function (p) { return p.stillInFlightAtTract; })),
    perRun: perRun,
  };
  console.log('');
  console.log('[dacPerf+] SUMMARY -- paste this back:');
  console.log(JSON.stringify(summary, null, 2));
  window.dacPerfOverlap = summary;
  return summary;
})();
/* === END dacPerf addendum === */
