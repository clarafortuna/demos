/* CLCPA-270 -- THE CENSUS RE-RUN, diffed against the delivered census.
 *
 * The ruling named the intended consequences and required the proof to be a
 * DIFF: the same 149 table-years measured again, and the changed set asserted
 * to be exactly what was ruled and nothing else. So this recomputes the three
 * protections on BOTH builds -- BASE from the delivered census's commit, and
 * the working tree -- and compares row by row.
 *
 * It reads app.js; it changes nothing.
 *
 * Run:  node suite_270_census.js
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const REPO = 'c:/Users/emely/Desktop/Projects/demos';
const REL = 'Coned/CLCPA/ExecutiveDashboard_dev/app.js';
/* PINNED ON BOTH SIDES (CLAUDE.md), the standing model. The post-change
 * side reads 83fd9c1, this ticket's own commit, because a
 * blast-radius claim can only be true at the commit that made the change
 * -- never on a tip that also carries the tickets merged after it.
 * DAC_APP_OVERRIDE still wins, so the mutation runner keeps working. */
const NEWREV = process.env.DAC_NEW_COMMIT || '83fd9c1';
/* BASE: the commit that delivered the census this diff is against. */
const BASE = process.env.DAC_BASE_COMMIT || 'a444741';
/* THE PIN WAS DEAD CODE. NEWREV was declared and commented above exactly as in
 * every other pinned suite, and then SRC read the working tree anyway -- so
 * this census silently became a live guard on whatever was checked out, which
 * is the failure mode CLAUDE.md's pin-both-sides rule exists to stop. It read
 * correctly only because the working tree happened to be the pinned build. */
const SRC = process.env.DAC_APP_OVERRIDE
  ? fs.readFileSync(process.env.DAC_APP_OVERRIDE, 'utf8')
  : execSync('git show ' + NEWREV + ':"' + REL + '"',
      { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const BASE_SRC = execSync('git show ' + BASE + ':"' + REL + '"',
  { cwd: REPO, maxBuffer: 1 << 28 }).toString('utf8').replace(/\r?\n/g, '\r\n');
const P = JSON.parse(fs.readFileSync(
  path.join(REPO, 'Coned/CLCPA/ExecutiveDashboard_dev/payload.json'), 'utf8'));

let pass = 0, fail = 0;
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const ok = (c, m) => { if (c) { pass++; log('  ok   ' + m); } else { fail++; log('  FAIL ' + m); } };
const guard = (l, fn) => { try { fn(); } catch (e) { fail++; log('  FAIL ' + l + ' THREW: ' + (e && e.message)); } };

function api(src, want) {
  const L = src.split('\r\n'); const TOP = [];
  L.forEach((ln, n) => { const m = /^  (?:function|const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(ln);
    if (m) TOP.push({ name: m[1], line: n }); });
  const bound = TOP.map(d => d.line).concat([L.length]);
  const find = (n) => { const k = TOP.findIndex(d => d.name === n);
    return k < 0 ? null : L.slice(TOP[k].line, bound[k + 1]).join('\n'); };
  const parts = [], have = new Set();
  const add = (n) => { if (have.has(n)) return false; const f = find(n);
    if (!f) return false; have.add(n); parts.push(f); return true; };
  want.forEach(add);
  const make = () => new Function('const state={};' + parts.join('\n\n') +
    '\nreturn {' + want.join(',') + '};')();
  return (fn) => {
    for (let r = 0; r < 500; r++) {
      try { return fn(make()); }
      catch (e) { const m = /(\w+) is not defined/.exec(e.message);
        if (m && add(m[1])) continue; throw e; }
    }
    throw new Error('dependency resolution did not converge');
  };
}

/* The protections, computed the way renderIngestEditor computes them, on each
 * build. The OLD build's three independent tests are reproduced here from its
 * own shipped predicates; the NEW build's come from its one role function. */
function protections(src, isNew) {
  const want = isNew
    ? ['totalRowFlags', 'ingestRowRole', 'ingestRoleOpen', 'INGEST_ROLE_OPEN',
       'HIERARCHICAL_TABLES', 'normIngestKey']
    : ['totalRowFlags', 'isHierarchicalTotalLabel', 'HIERARCHICAL_TABLES', 'normIngestKey'];
  const run = api(src, want);
  const out = {};
  run((a) => {
    Object.keys(P.tables).sort().forEach((id) => {
      const t = P.tables[id];
      Object.keys(t.schema_by_year || {}).sort().forEach((y) => {
        const data = (t.data || {})[y] || [];
        if (!data.length) return;
        const schema = t.schema_by_year[y];
        const lv = t.header_levels;
        const hrc = (typeof lv !== 'number' || lv < 2) ? 0 : Math.min(lv - 1, data.length);
        const hier = !!a.HIERARCHICAL_TABLES[id];
        const rowHasNumber = (r) => Array.isArray(r) &&
          r.slice(1).some(v => typeof v === 'number' && isFinite(v));
        const structural = data.map(r => Array.isArray(r) && !rowHasNumber(r));
        const gh = {};
        if (hier) {
          data.forEach((r, idx) => {
            if (!structural[idx] || !Array.isArray(r) || r[0] == null) return;
            for (let k = idx + 1; k < data.length && !structural[k]; k++) {
              if (rowHasNumber(data[k])) { gh[a.normIngestKey(r[0])] = true; return; }
            }
          });
        }
        const isGroupHeaderRow = (row) => hier && Array.isArray(row) &&
          !!gh[a.normIngestKey(row[0])] && !rowHasNumber(row);
        const tf = a.totalRowFlags(data, id, schema);

        data.forEach((row, r) => {
          const hdr = r < hrc || isGroupHeaderRow(row);
          let label, values, deletable, role;
          if (isNew) {
            role = a.ingestRowRole(row[0], id, hdr);
            /* THE AMENDMENT, read through the shipped accessor rather than off
             * the table. The renderer asks ingestRoleOpen(role, derives), so
             * the census must ask the same question the same way -- reading
             * INGEST_ROLE_OPEN directly would make this a census of a rule the
             * editor no longer applies. */
            const open = a.ingestRoleOpen(role, !!tf[r]);
            label = open.label; values = open.values; deletable = open.deletable;
          } else {
            const isTotal = !!tf[r];
            const lockTotalRow = isTotal && hier && !hdr && a.isHierarchicalTotalLabel(row[0]);
            role = hdr ? 'header' : (isTotal ? 'total(arith)' : 'data');
            label = !hdr && !lockTotalRow;
            values = !hdr && !isTotal;
            deletable = !hdr && !lockTotalRow && !isTotal;
          }
          out[id + '|' + y + '|' + r] = {
            id, y, r, label: String(row[0] == null ? '' : row[0]),
            role, open: [label ? 'L+' : 'L-', values ? 'V+' : 'V-', deletable ? 'D+' : 'D-'].join(' '),
            /* the derive engine's own answer for this row, recorded so the
             * amendment can be checked against it rather than against a list */
            derives: !!tf[r],
          };
        });
      });
    });
  });
  return out;
}

log('======================================================================');
log('CLCPA-270 -- the census RE-RUN, diffed against the delivered census');
log('  BASE (delivered census): ' + BASE);
log('======================================================================');

const before = protections(BASE_SRC, false);
const after = protections(SRC, true);
const keys = Object.keys(before);

log('');
log('SCALE');
log('  table-years : ' + new Set(keys.map(k => k.split('|').slice(0, 2).join(':'))).size);
log('  rows        : ' + keys.length);
ok(keys.length === Object.keys(after).length,
  'both builds measured the same rows (' + keys.length + ')');

const changed = keys.filter(k => before[k].open !== after[k].open);
log('');
log('ROWS WHOSE PROTECTION CHANGED: ' + changed.length);
changed.forEach((k) => {
  const b = before[k], a2 = after[k];
  log('  ' + (b.id + ':' + b.y).padEnd(10) + 'r' + String(b.r).padEnd(3) +
      b.open + '  ->  ' + a2.open + '   [' + a2.role + ']  ' + JSON.stringify(b.label).slice(0, 52));
});

/* ---- NOTHING MAY UNLOCK ------------------------------------------------ */
log('');
log('A. THE ONE-WAY RULE: protection may tighten, never loosen');
const loosened = changed.filter((k) => {
  const b = before[k].open.split(' '), a2 = after[k].open.split(' ');
  return a2.some((v, i) => v.endsWith('+') && b[i].endsWith('-'));
});
ok(loosened.length === 0,
  'A1 NOT ONE row became more open -- ' + loosened.length +
  (loosened.length ? ': ' + loosened.slice(0, 5).join(', ') : ''));

/* ---- THE RULED CONSEQUENCES, each asserted by name --------------------- */
log('');
log('B. THE RULED CONSEQUENCES');
const ch = (pred) => changed.filter(k => pred(after[k], before[k]));

/* FULLY OPEN means L+ V+ D+ before, which is what the ruling counted. Round 1
 * of this assertion counted any changed A3/A4/J8 total row and reported 7,
 * folding in three rows that were already value-locked and only gained a
 * label lock -- consequence 3, not consequence 1. */
const wasFullyOpen = changed.filter(k => before[k].open === 'L+ V+ D+');
const wasFullyOpenTotal = wasFullyOpen.filter(k => after[k].role === 'total');
const c1 = wasFullyOpenTotal.filter(k => ['A3', 'A4', 'J8'].indexOf(after[k].id) >= 0);
log('   consequence 1, the fully-open total-labelled rows in A3, A4, J8:');
c1.forEach(k => log('      ' + after[k].id + ':' + after[k].y + ' r' + after[k].r +
  '  ' + JSON.stringify(after[k].label)));
ok(c1.length === 4, 'B1 exactly FOUR such rows locked -- found ' + c1.length);

/* A FIFTH ROW OUTSIDE THE ENUMERATION, reported rather than excluded.
 *
 * The ruling named four fully-open total-labelled rows, counted with the
 * STRICT classifier. A8's "Total CES Programs Installations" is fully open
 * today and is unmistakably a group total -- 336,599 / 190,180 / 0.57 -- but
 * its label is not strict, so the ruling's count did not see it. The ruling's
 * PRINCIPLE (role from the label, never from arithmetic) requires it to lock;
 * excluding it would need a hardcoded exception, which the CLCPA-259 lesson
 * forbids. So it locks, and it is named here for the owner's confirmation. */
const extraOpen = wasFullyOpenTotal.filter(k => ['A3', 'A4', 'J8'].indexOf(after[k].id) < 0);
log('   beyond the enumeration, reached by the ruling\'s principle:');
extraOpen.forEach(k => log('      ' + after[k].id + ':' + after[k].y + ' r' + after[k].r +
  '  ' + JSON.stringify(after[k].label)));
ok(extraOpen.length === 1 && after[extraOpen[0]].id === 'A8',
  'B1b exactly ONE row beyond the enumeration, and it is A8 -- found ' +
  extraOpen.length + (extraOpen.length ? ' (' + extraOpen.map(k => after[k].id).join(',') + ')' : ''));

const flapped = ['A3|2023', 'A3|2024', 'A4|2023'];
ok(flapped.every(f => changed.some(k => k.indexOf(f + '|') === 0)),
  'B2 the rows whose protection flapped between years are all in the changed set');

/* CONSEQUENCE 5, THE A8 RULING (option b): the VALUE half follows derivability.
 *
 * B3 used to assert that every total-role row carried the identical
 * protection in every year. That claim was the stability the ruling bought,
 * and the amendment deliberately gives part of it back: a total the engine
 * cannot derive keeps typeable value cells, and whether the engine can derive
 * it is a property of the year's data. So the claim is split, and the half
 * that matters is asserted unchanged. */
const totalRole = Object.keys(after).filter(k => after[k].role === 'total');
ok(totalRole.every(k => after[k].open.indexOf('L- ') === 0 &&
   after[k].open.indexOf(' D-') === after[k].open.length - 3),
  'B3a the LABEL lock and the delete guard are identical on every total-role ' +
  'row in every year -- the arithmetic path is dead as an arbiter of structure');

const typeable = totalRole.filter(k => after[k].open.indexOf('V+') >= 0);
log('   consequence 5, total rows the engine does NOT derive (L- V+ D-):');
typeable.forEach(k => log('      ' + after[k].id + ':' + after[k].y + ' r' + after[k].r +
  '  ' + JSON.stringify(after[k].label)));
const TYPEABLE_EXPECTED = [
  'A3|2023|28',   /* "Total" 2,354,317 -- stored, does not reconcile */
  'A3|2024|26',   /* "Total" 2,009,280 -- stored, does not reconcile */
  'A4|2023|28',   /* "Total" 1,218,703 -- stored, does not reconcile */
  'A8|2025|25',   /* "Total CES Programs Installations" -- parts not in table */
  'J8|2025|2',    /* "Total" -- its columns are not a sum of the rows above */
].sort();
ok(JSON.stringify(typeable.slice().sort()) === JSON.stringify(TYPEABLE_EXPECTED),
  'B3b and EXACTLY these five rows keep typeable values -- got ' +
  typeable.length + ': ' + typeable.slice().sort().join(', '));
/* the ruling's own words: the four of consequence 1 are in this set too, so
 * the amendment is not an A8 carve-out wearing a derived disguise */
ok(TYPEABLE_EXPECTED.filter(k => /^(A3|A4|J8)\|/.test(k)).length === 4,
  'B3c four of the five are consequence 1\'s own rows, not an A8 exception');
/* and it is DERIVED: every one of them is a row totalRowFlags refuses */
ok(typeable.every(k => after[k].derives === false),
  'B3d every one of them is a row the derive engine itself declines -- ' +
  'no row or table is named anywhere in the rule');

const flatLabel = changed.filter(k => before[k].open.indexOf('L+') === 0 &&
  after[k].open.indexOf('L-') === 0);
ok(flatLabel.length >= 56,
  'B4 the label lock reaches the flat tables: ' + flatLabel.length +
  ' rows gained a locked label (the census found 56 flat total rows open)');

const computed = Object.keys(after).filter(k => after[k].role === 'computed');
log('   consequence 4, system-computed share rows:');
Array.from(new Set(computed.map(k => after[k].id + '  ' + after[k].label)))
  .forEach(s => log('      ' + s));
ok(computed.length > 0 && computed.every(k => after[k].open === 'L- V- D-'),
  'B5 every computed-share row is locked in full, values and label (' +
  computed.length + ' row-years)');
ok(computed.some(k => after[k].id === 'J8') && computed.some(k => after[k].id === 'F7'),
  'B6 and the rule reached an EQUIVALENT outside J8 -- F7 "% of Grand Total"');

/* the rule must NOT have claimed the percentages whose denominator is not in
 * the table: those are the preparer's to type (CLCPA-206) */
const dTables = Object.keys(after).filter(k => ['D2', 'D3', 'D4'].indexOf(after[k].id) >= 0 &&
  after[k].role === 'computed');
ok(dTables.length === 0,
  'B7 and it claimed NONE of D2/D3/D4\'s percentage rows, whose denominator is ' +
  'not in the table -- found ' + dTables.length);

/* ---- NOTHING ELSE ------------------------------------------------------ */
log('');
log('C. AND NOTHING ELSE');
/* consequence 5 joins the covering set: a row that changed only because the
 * amendment kept its values typeable is accounted for by the ruling, not an
 * escapee from it */
const accounted = new Set([].concat(c1, flatLabel, typeable.filter(k => changed.indexOf(k) >= 0),
  computed.filter(k => changed.indexOf(k) >= 0)));
const unaccounted = changed.filter(k => !accounted.has(k));
log('   changed rows not covered by a ruled consequence: ' + unaccounted.length);
unaccounted.forEach(k => log('      ' + after[k].id + ':' + after[k].y + ' r' + after[k].r +
  '  ' + before[k].open + ' -> ' + after[k].open + '  ' + JSON.stringify(after[k].label).slice(0, 52)));
ok(unaccounted.length === 0,
  'C1 every changed row is covered by a ruled consequence -- ' +
  unaccounted.length + ' are not');

/* ---- the arithmetic path is gone from protection ----------------------- */
log('');
log('D. THE ARITHMETIC PATH IS NO LONGER AN ARBITER');
guard('D-block', () => {
  const codeOnly = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, (m, p) => p);
  const code = codeOnly(SRC);
  ok(/const rowRole = ingestRowRole\(row\[0\], i\.tableId, structuralHeader\);/.test(code),
    'D1 the renderer derives ONE role per row');
  ok(/const isTotal = !roleOpen\.values && !isHeaderRow;/.test(code),
    'D2 value locking follows the protections the accessor returned');
  /* the AMENDMENT, structurally: the accessor is asked, and it is asked with
   * the derive engine's own flag for THIS row. A renderer that read the table
   * directly would be back to a role-only value lock. */
  ok(/const roleOpen = ingestRoleOpen\(rowRole, !!editorTotalFlags\[rowIdx\]\);/.test(code),
    'D2a and the value half is asked of the DERIVE ENGINE, per row');
  ok(!/INGEST_ROLE_OPEN\[rowRole\]/.test(code),
    'D2b the renderer no longer reads the role table directly');
  /* and the styling must NOT have followed the value lock, or a typeable
   * total would stop looking like a total */
  ok(/const isTotalRole = rowRole === 'total' \|\| rowRole === 'computed';/.test(code) &&
     /isTotalRole \? ' class="ingest-row-total"'/.test(code),
    'D2c while the row STYLING follows the role, not the value lock');
  ok(/const lockTotalRow = !roleOpen\.label && !isHeaderRow;/.test(code),
    'D3 label locking follows the role');
  ok(/\$\{!roleOpen\.deletable \? ''/.test(code),
    'D4 deletability follows the role');
  ok(!/lockTotalRow = isTotal && isHierFamily/.test(code),
    'D5 the arithmetic-gated label lock is gone');
  /* totalRowFlags must SURVIVE -- it is the derive engine's, not protection's */
  ok(/function totalRowFlags\(/.test(code) && /recomputeTotals/.test(code),
    'D6 totalRowFlags itself survives, where it belongs: the derive engine');
});

/* ---- X. this census reads what it says it reads ------------------------- */
log('');
log('X. THE HARNESS ITSELF');
guard('X-block', () => {
  /* THE DEFECT THIS ROUND FOUND HERE. NEWREV was declared, commented as the
   * pinned build, and then ignored -- SRC read the working tree. It gave the
   * right answer only because the tree happened to hold the pinned build, and
   * it would have gone on giving an answer about whatever was checked out. */
  const self = fs.readFileSync(__filename, 'utf8');
  const body = self.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(/const SRC = process\.env\.DAC_APP_OVERRIDE\s*\r?\n\s*\?[^\n]*\r?\n\s*: execSync\('git show ' \+ NEWREV/.test(body),
    'X2 the census reads the PINNED build, not the working tree');
  ok(/const NEWREV = process\.env\.DAC_NEW_COMMIT \|\| '[0-9a-f]{7,40}';/.test(body),
    'X3 and NEWREV is a literal sha');
  ok(/const BASE = process\.env\.DAC_BASE_COMMIT \|\| '[0-9a-f]{7,40}';/.test(body),
    'X4 as is the delivered-census BASE');
});

log('');
log('======================================================================');
log('  ' + pass + ' passed, ' + fail + ' failed');
log('======================================================================');
fs.writeFileSync(__dirname + '/suite-270-census-output.txt', lines.join('\n') + '\n');
process.exit(fail ? 1 : 0);
