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
/* CLCPA-241 round 2: classify every stored percent cell, and check the rule
 * against every filed figure. No code is changed; this is the measurement the
 * STOP rests on. */
const fs = require('fs');
const DEV = _dacRepo() + '/Coned/CLCPA/ExecutiveDashboard_dev/';
const P = JSON.parse(fs.readFileSync(DEV + 'payload.json', 'utf8'));
const SRC = fs.readFileSync(DEV + 'app.js', 'utf8');
const i = SRC.indexOf('const DERIVED_COLS = (function () {');
const j = SRC.indexOf('\r\n  })();', i);
const DC = new Function(SRC.slice(i, j + 8) + '\nreturn DERIVED_COLS;')();
const k = SRC.indexOf('const PERSIST_STRIP_TABLES = new Set([');
const STRIP = new Function(SRC.slice(k, SRC.indexOf(']);', k) + 3) + '\nreturn PERSIST_STRIP_TABLES;')();

console.log('=== every stored percent-string cell, classified ===');
const out = {};
Object.keys(P.tables).forEach((id) => {
  const t = P.tables[id];
  Object.keys(t.data || {}).forEach((y) => {
    const sch = (t.schema_by_year || {})[y] || [];
    (t.data[y] || []).forEach((r) => (r || []).forEach((v, c) => {
      if (typeof v !== 'string' || !/^-?[0-9.,]+%$/.test(v.trim())) return;
      const key = id + ' col' + c;
      out[key] = out[key] || { n: 0, head: sch[c],
        ruled: (DC[id] || []).some(d => d.column === c), strip: STRIP.has(id) };
      out[key].n++;
    }));
  });
});
let total = 0, target = 0, unrebuildable = 0;
Object.keys(out).sort().forEach((key) => {
  const o = out[key];
  total += o.n;
  if (/^A9 /.test(key)) target += o.n; else if (!o.ruled) unrebuildable += o.n;
  console.log('  ' + key.padEnd(10) + String(o.n).padStart(3) +
    '  ruled=' + (o.ruled ? 'YES' : 'no ') + '  stripped=' + (o.strip ? 'YES' : 'no ') +
    '  ' + JSON.stringify(o.head));
});
console.log('  TOTAL ' + total + ';  A9 percent-CHANGE target ' + target +
  ';  unruled and NOT rebuildable ' + unrebuildable);

console.log('');
console.log('=== the rule against every filed A9 figure ===');
let ok = 0, differ = [];
Object.keys(P.tables.A9.data).sort().forEach((y) => {
  (P.tables.A9.data[y] || []).forEach((r, ri) => {
    [[5, 3, 1], [6, 4, 2]].forEach((m) => {
      const stored = r[m[0]];
      if (typeof stored !== 'string' || !/%/.test(stored)) return;
      const cur = Number(r[m[1]]), prev = Number(r[m[2]]);
      if (!isFinite(cur) || !isFinite(prev) || prev === 0) return;
      const rendered = (((cur - prev) / prev) * 100).toFixed(0) + '%';
      if (rendered === String(stored).trim()) { ok++; return; }
      differ.push(y + ' row' + ri + ' col' + m[0] + ' filed ' + stored +
        ' computed ' + rendered + ' (' + (((cur - prev) / prev) * 100).toFixed(3) + ')');
    });
  });
});
console.log('  ' + ok + ' reproduce the filed figure exactly');
console.log('  ' + differ.length + ' do NOT:');
differ.forEach(d => console.log('     ' + d));
