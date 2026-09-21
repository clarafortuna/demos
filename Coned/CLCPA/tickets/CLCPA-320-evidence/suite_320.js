/* CLCPA-320: the workbook's total-row marker follows the row's ROLE, and then
 * only where the engine can DERIVE the cell.
 *
 * REPRODUCED IN A BROWSER FIRST, real downloads captured off the real button
 * (repro_320.js). A3's Total row, same table, two years, shipped build:
 *
 *   2098 (fresh)  ["Total", "(no value)", "(calculated)", "(calculated)", "(calculated)"]
 *   2023 (stored) ["Total", "",           2354317,        "",             ""]
 *
 * Three empty cells in a total row is an invitation to type into them.
 *
 * THE CAUSE. ingestComputed built its total-row set from totalRowFlags, where
 * structure proposes and ARITHMETIC confirms. A3/2023's stored Total does not
 * reproduce its own rows, so nothing confirmed it, so the workbook treated it
 * as an ordinary row.
 *
 * AMENDED BEFORE MERGE, on the owner's ruling, and the amendment narrows this
 * ticket. Role alone marked J8's Total, whose dollar figures are B7-class and
 * belong to the preparer -- telling them to leave blank the one figure only
 * they can supply. So the marker now consults DERIVABILITY from the
 * registries as well as role, and block J asserts that no marked total row is
 * underivable by any of them.
 *
 * THE COST, STATED: A3/2023, A3/2024 and A4/2023 lose the marker they gained
 * here, because no registry signal reaches them either. A3 is therefore
 * marked in 2025 and not in 2023, which is the year-dependence this ticket
 * set out to remove. The root cause underneath is the payload data question:
 * those years' stored totals do not equal their own rows. Raised in the
 * report rather than resolved by bending the rule.
 *
 * WHAT IS DELIBERATELY NOT CHANGED: the IMPORT SKIP. CLCPA-272 ruled that a
 * provided value is accepted and reconciled, never rejected, so widening what
 * the importer refuses would start discarding figures preparers actually
 * filed. Measured at zero, and asserted here.
 *
 * Pins: DAC_BASE_COMMIT, DAC_APP_OVERRIDE.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = execSync('git rev-parse --show-toplevel').toString().trim();
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
const DEV = path.join(ROOT, 'Coned/CLCPA/ExecutiveDashboard_dev');
const OUT = path.join(__dirname, 'suite-320-output.txt');

const BASE = process.env.DAC_BASE_COMMIT || 'd84c0d3';
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"', { maxBuffer: 1e9 })
  .toString('utf8').replace(/\r?\n/g, '\r\n');
const SRC = fs.readFileSync(process.env.DAC_APP_OVERRIDE || path.join(DEV, 'app.js'), 'utf8');
const P = JSON.parse(fs.readFileSync(path.join(DEV, 'payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const say = (s) => log(s);
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => {
  try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); }
};
const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\r\n]*/g, '$1');

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

const WANT = ['ingestComputed', 'getTableSchema', 'totalRowFlags',
  'isAnchoredTotalRowLabel', 'recomputeTotals',
  /* the derivability registries the pre-merge ruling names */
  'detectSumColumns', 'DERIVED_COLS', 'DERIVED_ROWS'];
const NEW = harness(SRC, WANT), OLD = harness(BASE_SRC, WANT);

/* EVERY accessor call inside attempt: the object ingestComputed returns is a
 * closure, and a hand-fed slice cannot see a missing closure until the branch
 * that needs it runs. */
function view(H, rows, id, schema) {
  return H.attempt((api) => {
    const c = api.ingestComputed(rows, id, schema);
    return rows.map((r, i) => {
      const m = [];
      for (let col = 1; col < (schema || []).length; col++) {
        if (c.marksInTemplate(i, col)) m.push(col);
      }
      return { marks: m, any1: !!c.any(i, 1), total: !!c.totalRow(i) };
    });
  });
}

const blankOf = (rows) => rows.map(r => r.map((v, c) => (c === 0 ? v : null)));

log('CLCPA-320: the total-row marker is the same in every year');
log('BASE ' + BASE + '   app.js ' + (process.env.DAC_APP_OVERRIDE || 'working tree'));
log('');

/* ===================== A: the reproduced case ========================== */
say('=== A. A3s Total row, the case captured in the browser ==============');
guard('A: A3 across its three years', () => {
  const t = P.tables.A3;
  const seen = {};
  ['2023', '2024', '2025'].forEach((y) => {
    const rows = t.data[y];
    const schema = NEW.attempt(api => api.getTableSchema(t, y));
    const v = view(NEW, rows, 'A3', schema);
    const i = rows.findIndex(r => NEW.attempt(api => api.isAnchoredTotalRowLabel(r[0])));
    seen[y] = i < 0 ? null : v[i].marks;
  });
  /* AMENDED BEFORE MERGE, and the amendment costs this case.
   *
   * Round 1 of this ticket marked A3's Total in every year, which is what it
   * was for. The J8 ruling then requires that a total the engine cannot
   * DERIVE is never marked, and A3/2023 and A3/2024 carry no derivability
   * signal at all: no declared row, no declared column, no derivable total
   * column, and an arithmetic confirmation that fails because the stored
   * figure does not reconcile with its own rows.
   *
   * So A3 is marked in 2025 and not in 2023 or 2024, which is year-dependent
   * again. That is the ruling applied honestly rather than a rule bent to
   * keep a number: the root cause is the payload data question -- those two
   * years' stored totals do not equal their rows -- and it is raised in the
   * report, not papered over here. */
  ok(JSON.stringify(seen['2025']) === JSON.stringify([1, 2, 3, 4]),
     'A1 A3s Total is marked where the engine derives it, 2025: ' +
     JSON.stringify(seen['2025']));
  ok(seen['2023'].length === 0 && seen['2024'].length === 0,
     'A1b and NOT marked in 2023 or 2024, where no derivability signal holds: ' +
     JSON.stringify([seen['2023'], seen['2024']]));

  /* and the same question on BASE, so this suite cannot pass by accident */
  const was = {};
  ['2023', '2024', '2025'].forEach((y) => {
    const rows = t.data[y];
    const schema = OLD.attempt(api => api.getTableSchema(t, y));
    const v = view(OLD, rows, 'A3', schema);
    const i = rows.findIndex(r => OLD.attempt(api => api.isAnchoredTotalRowLabel(r[0])));
    was[y] = i < 0 ? null : v[i].marks;
  });
  ok(JSON.stringify(was['2023']) === '[]' && JSON.stringify(was['2024']) === '[]',
     'A2 while BASE marked nothing at all in 2023 and 2024: ' + JSON.stringify(was));
});

/* ===================== B: every table, every year ====================== */
say('');
say('=== B. the rule, across the whole payload ===========================');
guard('B: role decides, in every year', () => {
  /* THIS ASSERTION IS A DELTA AGAINST BASE, and the first cut was not.
   *
   * That cut decided which rows to look at by calling isAnchoredTotalRowLabel
   * from the suite, then checked those rows were marked. Two mutation
   * controls walked straight through it: swapping the app's role predicate
   * for an unanchored one, and for the strict one, both left it green,
   * because the suite went on consulting the predicate IT chose while the app
   * used another. A census that re-implements the rule agrees with itself.
   *
   * Comparing the two builds cell by cell has no such blind spot: whatever
   * the app decides, the difference from BASE is what it is. */
  const moved = [], strays = [], b2 = [], b7lost = [];
  /* the two rows CLCPA-293 round 4's registry names, written here rather
   * than read from the app: a suite that asks the code under test which of
   * its own changes are allowed cannot fail on a widened registry */
  const B7_ROWS = [
    { table: 'A8', row: 'total ces programs installations' },
    { table: 'J8', row: 'total' },
  ];
  const walk = (getRows, label) => {
    Object.keys(P.tables).sort().forEach((id) => {
      const t = P.tables[id];
      Object.keys(t.data || {}).sort().forEach((y) => {
        const rows = getRows(t.data[y]);
        if (!rows || !rows.length) return;
        const schema = NEW.attempt(api => api.getTableSchema(t, y));
        const a = view(OLD, rows, id, schema), b = view(NEW, rows, id, schema);
        rows.forEach((r, i) => {
          const before = a[i].marks, after = b[i].marks;
          if (JSON.stringify(before) === JSON.stringify(after)) return;
          const lost = before.filter(c => after.indexOf(c) < 0);
          const where = label + ' ' + id + ':' + y + ' r' + i;
          /* CLCPA-308 is in the same tree and marks the DERIVED ROWS of D2,
           * D3, D4 and F7. Named, so this ticket's own set stays exact. */
          if (/^(D2|D3|D4|F7)$/.test(id)) return;
          /* CLCPA-303 is in the same tree too, and declares B2's column-wise
           * total row. Its own bucket rather than a skip of the whole table,
           * so the rows it moves are counted and named and any OTHER B2 row
           * still lands in strays. */
          if (id === 'B2') { b2.push(where + ' ' + JSON.stringify(String(r[0]).slice(0, 20)) +
            (lost.length ? ' LOST ' + JSON.stringify(lost) : ' gained')); return; }
          /* CLCPA-293 round 4 is in the same tree as well, and it WITHHOLDS
           * the marker from the two rows its B7 registry names. That is this
           * ticket's own J8 ruling carried one step further: a total the
           * engine cannot derive from its own rows must never be marked
           * (calculated), and a registry member is exactly such a total. So
           * these belong with J8's withheld markers rather than in strays,
           * and they are counted and named here for the same reason. */
          if (B7_ROWS.some(b => b.table === id &&
              String(r[0]).trim().toLowerCase() === b.row)) {
            b7lost.push(where + ' ' + JSON.stringify(String(r[0]).slice(0, 28)) +
              (lost.length ? ' LOST ' + JSON.stringify(lost) : ' gained'));
            return;
          }
          if (NEW.attempt(api => api.isAnchoredTotalRowLabel(r[0])) && !lost.length) {
            moved.push(where);
          } else {
            strays.push(where + (lost.length ? ' LOST ' + JSON.stringify(lost) : '') +
              ' ' + JSON.stringify(String(r[0]).slice(0, 26)));
          }
        });
      });
    });
  };
  walk(r => r, 'stored');
  walk(r => blankOf(r), 'blank');

  /* MEASURED, not guessed: the first cut of the old B1 said 93 from memory
   * and was wrong by 62. A count written from recollection is a fabricated
   * figure with an assertion wrapped round it. */
  /* 21, not 25: the pre-merge amendment withholds the marker from the four
   * total rows no derivability signal reaches. */
  ok(moved.length === 21,
     'B1 exactly 21 total rows gain a marker, and they are the rows this ' +
     'ticket names: ' + moved.length);
  /* CLCPA-303's rows, counted and named rather than skipped. All six are
   * BODY rows of B2 in the BLANK anatomy, gaining the marker on the
   * row-wise total column. A fresh B2 template used to invite the preparer
   * to fill a cell the engine computes: detectSumColumns needs values to
   * confirm the relationship and an empty template has none, so the marker
   * depended on whether the template happened to carry data. A declaration
   * does not. The stored anatomy is untouched, which is why no stored-year
   * row appears in this list. */
  ok(b2.length === 6 && b2.every(x => /^blank/.test(x) && / gained$/.test(x)),
     'B1b and CLCPA-303 moves exactly six more, every one a B2 body row in ' +
     'a BLANK template gaining the row-wise total marker: ' + b2.length +
     ' ' + JSON.stringify(b2.slice(0, 2)));
  /* and CLCPA-293 round 4's two, every one a marker WITHHELD rather than
   * gained, which is this ticket's J8 ruling reaching the registry */
  ok(b7lost.length > 0 && b7lost.every(x => / LOST /.test(x)),
     'B1c and the B7 registry rows LOSE their marker, never gain one, ' +
     'which is the J8 ruling applied to a total the engine cannot derive: ' +
     b7lost.length + ' ' + JSON.stringify(b7lost.slice(0, 2)));
  ok(strays.length === 0,
     'B2 and NOT ONE other row moves, in either direction: ' +
     JSON.stringify(strays.slice(0, 6)));
});

guard('B: a data row that merely mentions a total is untouched', () => {
  /* CLCPA-209 is the reason this predicate is anchored. These three labels all
   * contain "total" and none of them is a total row. */
  const cases = [
    ['J1', 'Total amount of residential electric usage'],
    ['D2', 'Total # of projects'],
    ['J8', 'Total in DAC'],
  ];
  const bad = cases.filter(([, label]) =>
    NEW.attempt(api => api.isAnchoredTotalRowLabel(label)));
  ok(bad.length === 0,
     'B3 "Total amount of...", "Total # of projects" and "Total in DAC" are ' +
     'DATA rows and stay data rows: ' + JSON.stringify(bad));
  ok(NEW.attempt(api => api.isAnchoredTotalRowLabel('County Total')) === true &&
     NEW.attempt(api => api.isAnchoredTotalRowLabel('Total')) === true,
     'B4 while a label that ENDS at a total is one');
});

/* ===================== J: the pre-merge ruling ======================== */
say('');
say('=== J. a total the engine cannot derive is NEVER marked =============');
guard('J: derivability, not role alone', () => {
  /* THE RULING: "A total row that is NOT derivable from its own rows must
   * never be marked (calculated): the marker derivation consults
   * DERIVABILITY (DERIVED_ROWS membership or the rule registry), not row
   * role alone." Checked across every total row in the payload, and the
   * derivability signals are read from the app's own registries. */
  let markedRows = 0, unmarked = [], violations = [];
  Object.keys(P.tables).sort().forEach((id) => {
    const t = P.tables[id];
    Object.keys(t.data || {}).sort().forEach((y) => {
      const rows = t.data[y];
      if (!rows || !rows.length) return;
      const schema = NEW.attempt(api => api.getTableSchema(t, y));
      const signals = NEW.attempt((api) => {
        const c = api.ingestComputed(rows, id, schema);
        const flags = api.totalRowFlags(rows, id, schema) || [];
        const sums = api.detectSumColumns(schema, rows, id).map(s => s.column);
        const dcols = (api.DERIVED_COLS[id] || []).map(d => d.column);
        const drows = (api.DERIVED_ROWS[id] || []).map(d => d.row);
        return rows.map((r, i) => {
          if (!api.isAnchoredTotalRowLabel(r[0])) return null;
          const m = [];
          for (let col = 1; col < schema.length; col++) {
            if (c.marksInTemplate(i, col)) m.push(col);
          }
          return { i: i, label: String(r[0]), marks: m, arith: !!flags[i],
                   sums: sums, dcols: dcols, drows: drows };
        });
      });
      signals.forEach((s) => {
        if (!s) return;
        const derivable = s.arith || s.drows.indexOf(s.i) >= 0 ||
          s.dcols.length > 0 || s.sums.length > 0;
        if (s.marks.length) {
          markedRows++;
          if (!derivable) violations.push(id + ':' + y + ' r' + s.i + ' ' + s.label);
        } else {
          unmarked.push(id + ':' + y + ' r' + s.i + ' ' + JSON.stringify(s.label));
        }
      });
    });
  });
  ok(violations.length === 0,
     'J1 NOT ONE marked total row is underivable by every registry signal: ' +
     JSON.stringify(violations.slice(0, 6)));
  ok(markedRows === 151,
     'J2 total rows the workbook marks: ' + markedRows);
  ok(unmarked.length === 4,
     'J3 and exactly four are withheld, every one of them with no signal at ' +
     'all: ' + JSON.stringify(unmarked));
  ok(unmarked.some(u => /^J8:2025/.test(u)),
     'J4 including J8s Total, which the ruling names: its dollar figures ' +
     'belong to the preparer and 192,638,756 is not what its rows come to');
  /* and the structural form of the rule, so it cannot be reverted quietly */
  ok(/const engineDerives = \(rr, cc\) => !!totals\[rr\] \|\| !!derivedRowSet\[rr\] \|\|/
     .test(codeOnly(SRC)),
     'J5 the marker consults derivability from the registries, in one place');
});

/* ===================== C: the import is not touched ==================== */
say('');
say('=== C. the import skip does not move ================================');
guard('C: CLCPA-272 is not reopened', () => {
  let moved = [], compared = 0;
  const walk = (getRows, label) => {
    Object.keys(P.tables).sort().forEach((id) => {
      const t = P.tables[id];
      Object.keys(t.data || {}).sort().forEach((y) => {
        const rows = getRows(t.data[y]);
        if (!rows || !rows.length) return;
        const schema = NEW.attempt(api => api.getTableSchema(t, y));
        const a = view(OLD, rows, id, schema), b = view(NEW, rows, id, schema);
        rows.forEach((r, i) => {
          compared++;
          if (a[i].any1 !== b[i].any1) moved.push(label + ' ' + id + ':' + y + ' r' + i);
        });
      });
    });
  };
  walk(r => r, 'stored');
  walk(r => blankOf(r), 'blank');
  ok(compared > 2000, 'C1 rows compared on both builds: ' + compared);
  /* NO EXCLUSIONS. This carried a carve-out for D2, D3, D4 and F7 while
   * CLCPA-308's first cut widened the import skip on those tables. That cut
   * was withdrawn -- it would have discarded 47 filed figures on re-import --
   * so the honest assertion is the unqualified one, and the carve-out is
   * removed rather than left standing where it could hide a real regression
   * on four tables. */
  ok(moved.length === 0,
     'C2 and the WHOLE TREE moves the import skip on NOT ONE row: ' +
     JSON.stringify(moved.slice(0, 8)));
});

/* ===================== D: the marker keeps its promise ================= */
say('');
say('=== D. what the marker promises, on the board this ticket is about ==');
guard('D: every G marker is filled by the engine', () => {
  const run = (H) => {
    let marked = 0, broken = [];
    Object.keys(P.tables).sort().filter(id => /^G\d+$/.test(id)).forEach((id) => {
      const t = P.tables[id];
      Object.keys(t.data || {}).sort().forEach((y) => {
        const rows = t.data[y];
        if (!rows || !rows.length) return;
        const schema = H.attempt(api => api.getTableSchema(t, y));
        const landed = H.attempt((api) => {
          const c = api.ingestComputed(rows, id, schema);
          const l = rows.map((r, i) => r.map((v, col) =>
            (col === 0 ? v : (c.marksInTemplate(i, col) ? null : v))));
          api.recomputeTotals(l, schema, id, rows);
          return l;
        });
        const v = view(H, rows, id, schema);
        rows.forEach((r, i) => {
          v[i].marks.forEach((col) => {
            marked++;
            const x = landed[i][col];
            if (!(typeof x === 'number' && isFinite(x))) broken.push(id + ':' + y + ' r' + i + 'c' + col);
          });
        });
      });
    });
    return { marked: marked, broken: broken };
  };
  const now = run(NEW), was = run(OLD);
  ok(now.marked === 100 && was.marked === 100,
     'D1 G-board cells the workbook marks, on both builds: ' + now.marked +
     ' and ' + was.marked);

  /* THE FOUR THAT ARE NOT FILLED ARE NAMED, AND THEY PREDATE THIS TICKET.
   *
   * G1 files a percentage for 2023 and 2024 with NO feet column at all --
   * the percentage is the only data in the row, which is the case CLCPA-143
   * already protects in stripDerivedForPersist. There is nothing for the
   * engine to compute those two cells FROM, so the marker on them is a
   * promise it cannot keep.
   *
   * Asserted as an EXACT set rather than tolerated: a fifth unfilled G cell
   * still turns this red, and the identity with BASE is what shows this
   * ticket did not add any of them. */
  const expect = ['G1:2023 r0c2', 'G1:2023 r1c2', 'G1:2024 r0c2', 'G1:2024 r1c2'];
  ok(JSON.stringify(now.broken) === JSON.stringify(expect),
     'D2 exactly four G cells are marked and not filled, all of them G1s ' +
     'percentage in a year with no quantities: ' + JSON.stringify(now.broken));
  ok(JSON.stringify(now.broken) === JSON.stringify(was.broken),
     'D3 and BASE produces the very same four, so CLCPA-320 adds none: ' +
     JSON.stringify(was.broken));
});

/* ===================== X: the exclusions =============================== */
say('');
say('=== X. the shape of the change ======================================');
guard('X: role is added, arithmetic is kept', () => {
  const code = codeOnly(SRC);
  ok(/const totalRole = rows\.map\(r => Array\.isArray\(r\) && isAnchoredTotalRowLabel\(r\[0\]\)\);/
     .test(code), 'X1 the role set is built from the anchored predicate');
  ok(/\(!!totals\[r\] \|\| !!totalRole\[r\]\)/.test(code),
     'X2 and the marker takes role OR arithmetic, so a total row whose label ' +
     'does not end in "total" keeps the marker it always had');
  ok(!/any: \(r, c\) =>[^\n]*totalRole/.test(code),
     'X3 while `any`, which gates the IMPORT, does not consult the role at all');
});

guard('X: the baseline', () => {
  ok(/^[0-9a-f]{7,40}$/.test(BASE), 'X4 BASE is a literal commit sha: ' + BASE);
  let anc = false;
  try { execSync('git merge-base --is-ancestor ' + BASE + ' HEAD', { cwd: ROOT }); anc = true; }
  catch (e) { anc = false; }
  ok(anc, 'X5 and HEAD descends from it');
  ok(codeOnly(BASE_SRC).indexOf('totalRole') < 0,
     'X6 while BASE has no role set at all, so this suite cannot pass on it');
});

say('');
log('  ' + pass + ' passed, ' + fail + ' failed');
fs.writeFileSync(OUT, lines.join('\n') + '\n');
if (fail) process.exit(1);
