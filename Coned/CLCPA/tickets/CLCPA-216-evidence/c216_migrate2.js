/* CLCPA-216: the C2 migration, as a SURGICAL TEXT EDIT. DRY RUN unless --write.
 *
 * WHY NOT parse-and-restringify, which is what I did first and threw away:
 * JSON.stringify reformatted the entire file -- 3,789 lines added and 3,700 removed
 * for a 21-cell change -- because "2023"/"2024"/"2025" are INTEGER-LIKE KEYS and
 * JavaScript reorders those into ascending numeric order on an object. C2's data is
 * stored 2024, 2023, 2025, so every table's years got rewritten. Zero semantic
 * change, an unreviewable diff, and a deploy that pushes a wholly-rewritten file.
 *
 * Instead: edit the text inside C2's `data` span only, one line per cell, so the
 * diff is exactly 21 changed lines. Everything else in the file is untouched byte
 * for byte, which is what makes a data migration reviewable and its rollback exact.
 *
 * Verified afterwards by parsing both versions and comparing semantically.
 */
const fs = require('fs');

const REPO = 'c:/Users/emely/Desktop/Projects/demos/';
const TARGETS = [
  'Coned/CLCPA/ExecutiveDashboard/payload.json',
  'Coned/CLCPA/ExecutiveDashboard_dev/payload.json',
];
const WRITE = process.argv.indexOf('--write') >= 0;

const PACKED = /^(\s*)"(-?[\d,]+(?:\.\d+)?)\s*\(\s*(-?[\d.]+)\s*%\s*\)"(,?)$/;
const PCT_ONLY = /^(\s*)"(-?[\d.]+)\s*%"(,?)$/;

/** the exact span of C2's "data" value, located by brace matching from its key */
function c2DataSpan(src) {
  const c2 = src.indexOf('"C2": {');
  if (c2 < 0) throw new Error('C2 block not found');
  const dataKey = src.indexOf('"data": {', c2);
  if (dataKey < 0) throw new Error('C2 data key not found');
  let i = src.indexOf('{', dataKey), depth = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return [dataKey, i + 1]; }
  }
  throw new Error('unbalanced braces in C2 data');
}

const census = [];
TARGETS.forEach((rel, ti) => {
  const p = REPO + rel;
  const src = fs.readFileSync(p, 'utf8');
  const [from, to] = c2DataSpan(src);
  const head = src.slice(0, from), span = src.slice(from, to), tail = src.slice(to);

  /* The payload is CRLF on disk. Splitting on \n alone leaves a trailing \r on
   * every line, so the $ anchor in the patterns below never matches and nothing
   * converts -- which is exactly how the first run of this script silently
   * converted ZERO cells and tripped its own gate. The gate caught it, which is
   * the point of having one. Split on the file's actual terminator. */
  const nl = span.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
  const lines = span.split(nl);
  let converted = 0;
  const out = lines.map((line, li) => {
    let m = PACKED.exec(line);
    if (m) {
      const count = Number(m[2].replace(/,/g, ''));
      const pct = Number(m[3]) / 100;
      const text = m[2] + ' (' + m[3] + '%)';
      converted++;
      if (ti === 0) census.push({ line: li, before: line.trim(), form: 'packed', count, pct, text });
      return m[1] + '{ "count": ' + count + ', "pct": ' + pct +
        ', "text": ' + JSON.stringify(text) + ' }' + m[4];
    }
    m = PCT_ONLY.exec(line);
    if (m) {
      const pct = Number(m[2]) / 100;
      const text = m[2] + '%';
      converted++;
      if (ti === 0) census.push({ line: li, before: line.trim(), form: 'percent-only', count: null, pct, text });
      // m[3], not m[4]: PCT_ONLY has three capture groups, not four. Using m[4]
      // appended the literal string "undefined" after every 2023 cell, and GATE 1
      // caught it as a parse failure.
      return m[1] + '{ "count": null, "pct": ' + pct +
        ', "text": ' + JSON.stringify(text) + ' }' + m[3];
    }
    return line;
  }).join(nl);

  const result = head + out + tail;

  // GATE 1: it must still parse
  let parsed;
  try { parsed = JSON.parse(result); }
  catch (e) { throw new Error(rel + ': result does not parse: ' + e.message); }

  // GATE 2: nothing but C2 may differ semantically
  const before = JSON.parse(src);
  const changedTables = Object.keys(before.tables)
    .filter(t => JSON.stringify(before.tables[t]) !== JSON.stringify(parsed.tables[t]));
  if (JSON.stringify(changedTables) !== '["C2"]') {
    throw new Error(rel + ': tables changed = ' + JSON.stringify(changedTables) + ', expected ["C2"] only');
  }
  ['kpis', 'sections', 'meta', 'charts'].forEach(k => {
    if (before[k] !== undefined && JSON.stringify(before[k]) !== JSON.stringify(parsed[k])) {
      throw new Error(rel + ': top-level "' + k + '" changed, expected untouched');
    }
  });

  // GATE 3: the text outside C2's data span must be byte-identical
  if (head !== src.slice(0, from) || tail !== src.slice(to)) {
    throw new Error(rel + ': text outside the C2 data span was modified');
  }

  console.log('  ' + rel);
  console.log('     cells converted     : ' + converted);
  console.log('     bytes before/after  : ' + Buffer.byteLength(src) + ' -> ' + Buffer.byteLength(result));
  console.log('     lines before/after  : ' + (src.split(nl).length) + ' -> ' + (result.split(nl).length));
  console.log('     gates              : parses OK, only C2 changed, outside-span byte-identical');
  if (WRITE) { fs.writeFileSync(p, result); console.log('     WRITTEN'); }
});

console.log('');
console.log('  cells in the census: ' + census.length);
fs.writeFileSync(__dirname + '/c216_migration_census.json', JSON.stringify(census, null, 2));
console.log(WRITE ? '  MODE: WRITE' : '  MODE: DRY RUN (pass --write to apply)');
