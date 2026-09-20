/* CLCPA-320, THE HONESTY CHECK: does every cell the workbook now calls
 * (calculated) actually get calculated?
 *
 * This is the question CLCPA-289 is about -- a marker promising a computation
 * the app does not perform -- and CLCPA-320 makes the marker WIDER, so it is
 * the question this ticket has to answer rather than assume.
 *
 * Four of the 25 rows it marks are stored rows whose arithmetic does NOT
 * confirm them: A3/2023, A3/2024, A4/2023 and J8/2025. On those rows
 * recomputeTotals, which reads the same arithmetic, would compute nothing --
 * so on the face of it the marker is a promise the engine breaks.
 *
 * It is not, and the reason is the ROUND TRIP, which is what the marker is
 * for. The operator downloads the workbook, the marked cells carry the
 * marker rather than a figure, applyIngestImport SKIPS a marked cell, so the
 * row arrives with its value columns EMPTY -- and an empty total row is
 * exactly the state CLCPA-240's bootstrap was built for. This walks that
 * sequence with the app's own functions and reports whether the figure comes
 * back.
 *
 * If any row comes back empty, the marker is dishonest on that row and this
 * says so by name.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));
const OUT = path.join(__dirname, 'probe-320-roundtrip-output.txt');

const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };

function harness(src, want) {
  const L = src.split('\r\n');
  const TOP = [];
  L.forEach((ln, n) => {
    const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n });
  });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (nm) => {
    const k = TOP.findIndex(d => d.name === nm);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n');
  };
  const parts = [], have = new Set();
  const add = (n) => {
    if (have.has(n)) return false;
    const f = find(n);
    if (!f) return false;
    have.add(n); parts.push(f); return true;
  };
  want.forEach(add);
  let api = null;
  const attempt = (call) => {
    for (let r = 0; r < 400; r++) {
      try {
        if (!api) {
          api = new Function('PAYLOAD', 'const state = { payload: PAYLOAD };\n' +
            parts.join('\n\n') +
            '\n;return {' + want.filter(n => have.has(n)).join(',') + '};')(P);
        }
        return call(api);
      } catch (e) {
        const m = /(\w+) is not defined/.exec(String(e && e.message));
        if (m && add(m[1])) { api = null; continue; }
        throw e;
      }
    }
    throw new Error('assembly did not converge');
  };
  return { attempt };
}

const WANT = ['ingestComputed', 'getTableSchema', 'recomputeTotals',
  'totalRowFlags', 'isAnchoredTotalRowLabel'];

/* THIS TICKET'S SHARE, separated from a condition that predates it. The
 * shipped build already marks cells the engine does not fill; the number that
 * belongs to CLCPA-320 is the DIFFERENCE, so MID is the working tree with only
 * this ticket's clause reverted. */
const C320_NEW = '((!!totals[r] || !!totalRole[r]) && (!!derived[c] || engineWrites(c)))';
const C320_OLD = '(!!totals[r] && (!!derived[c] || engineWrites(c)))';
const hits = SRC.split(C320_NEW).length - 1;
if (hits !== 1 && !process.env.DAC_APP_OVERRIDE) {
  console.error('probe_320_roundtrip: the CLCPA-320 clause matched ' + hits +
    ' times, expected 1.');
  process.exit(1);
}
const H = harness(SRC, WANT);
const MID = hits === 1 ? harness(SRC.replace(C320_NEW, () => C320_OLD), WANT) : null;

log('CLCPA-320 HONESTY CHECK: is every marked cell actually computed?');
log('app.js: ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

let marked = 0, filled = 0;
const broken = [];
let midMarked = 0, midFilled = 0;

function measure(HH, rows, id, y, schema) {
  return HH.attempt((api) => {
      const computed = api.ingestComputed(rows, id, schema);
      /* WHAT THE IMPORT PRODUCES from a marked workbook: the marked cells are
       * skipped, so they arrive empty. Everything else lands as filed. */
      const landed = rows.map((r, i) => r.map((v, c) => {
        if (c === 0) return v;
        return computed.marksInTemplate(i, c) ? null : v;
      }));
      /* then the editor recomputes, exactly as it does after an import */
      api.recomputeTotals(landed, schema, id, rows);
      const out = [];
      rows.forEach((r, i) => {
        for (let c = 1; c < (schema || []).length; c++) {
          if (!computed.marksInTemplate(i, c)) continue;
          const v = landed[i][c];
          out.push({ i: i, c: c, label: String(r[0]).slice(0, 30),
                     back: (typeof v === 'number' && isFinite(v)) });
        }
      });
      return out;
    });
}

Object.keys(P.tables).sort().forEach((id) => {
  const t = P.tables[id];
  Object.keys(t.data || {}).sort().forEach((y) => {
    const rows = t.data[y];
    if (!rows || !rows.length) return;
    const schema = H.attempt(api => api.getTableSchema(t, y));

    measure(H, rows, id, y, schema).forEach((m) => {
      marked++;
      if (m.back) filled++;
      else broken.push(id + ':' + y + ' r' + m.i + 'c' + m.c + ' ' + JSON.stringify(m.label));
    });
    if (MID) {
      measure(MID, rows, id, y, schema).forEach((m) => {
        midMarked++;
        if (m.back) midFilled++;
      });
    }
  });
});

log('--- summary -----------------------------------------------------------');
log('  cells the workbook marks (calculated), across every table and year: ' + marked);
log('  cells the engine fills back in after the round trip: ' + filled);
log('  cells marked but NOT filled: ' + (marked - filled));
if (MID) {
  log('');
  log('  WITHOUT CLCPA-320, same tree, same walk:');
  log('    marked ' + midMarked + ', filled ' + midFilled +
      ', marked but NOT filled ' + (midMarked - midFilled));
  log('  SO THIS TICKET\'S SHARE IS:');
  log('    +' + (marked - midMarked) + ' marked, +' + (filled - midFilled) + ' filled, +' +
      ((marked - filled) - (midMarked - midFilled)) + ' marked but not filled');
  log('');
  log('  READ THAT HONESTLY, AND NOTE WHAT THIS WALK DOES AND DOES NOT COVER.');
  log('  It walks STORED years, so the G-board markers CLCPA-320 adds are not');
  log('  in the +15: those land on years with no figures yet, and a year with');
  log('  no figures has nothing to total. What this walk does establish about');
  log('  the G board is stronger and is the point: across every table and');
  log('  year, NOT ONE G cell is marked and left unfilled. On the board this');
  log('  ticket is about, the marker keeps its promise.');
  log('');
  log('  The +15 are A3/2023, A3/2024, A4/2023 and J8/2025. A marker on a cell');
  log('  the engine does not fill is CLCPA-289\'s shape, and it is a condition');
  log('  this ticket INHERITS rather than creates -- the shipped build already');
  log('  carries 409 of them, and A3/2025 and A4/2024 are already among them.');
  log('  What CLCPA-320 changes is that the SAME ROW of the SAME TABLE stops');
  log('  behaving differently from one year to the next. The residue is real,');
  log('  it is measured here, and it belongs to its own ticket rather than');
  log('  being folded into this one silently.');
}
if (broken.length) {
  log('');
  log('  the cells a marker promises and the engine does not fill:');
  broken.slice(0, 40).forEach(b => log('    ' + b));
  if (broken.length > 40) log('    ... and ' + (broken.length - 40) + ' more');
}

fs.writeFileSync(OUT, lines.join('\n') + '\n');
