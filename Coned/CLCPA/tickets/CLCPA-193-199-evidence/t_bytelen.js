/* utf8ByteLength must equal new TextEncoder().encode(s).length for every input,
 * or the size gates it feeds would pass a file the column will refuse. */
const fs = require('fs');
const src = fs.readFileSync('c:/Users/emely/Desktop/Projects/demos/Coned/CLCPA/ExecutiveDashboard_dev/app.js', 'utf8');
const m = src.match(/function utf8ByteLength\(str\) \{[\s\S]*?\n\}/);
if (!m) { console.error('could not extract utf8ByteLength'); process.exit(1); }
eval(m[0]);
const enc = new TextEncoder();
let pass = 0, fail = 0;
const check = (s, label) => {
  const a = utf8ByteLength(s), b = enc.encode(s).length;
  if (a === b) pass++; else { fail++; console.error('MISMATCH ' + label + ': got ' + a + ' want ' + b + '  ' + JSON.stringify(s)); }
};
const cases = [
  ['', 'empty'], ['a', 'ascii'], ['abc123', 'ascii run'],
  ['\u00e9', 'e-acute 2B'], ['\u00fc\u00f6\u00e4', 'latin1 3x2B'],
  ['\u20ac', 'euro 3B'], ['\u4e2d\u6587', 'CJK 2x3B'],
  ['\u{1f600}', 'emoji 4B'], ['a\u{1f600}b', 'emoji in ascii'],
  ['\ud83d', 'LONE HIGH surrogate'], ['\udc00', 'LONE LOW surrogate'],
  ['\ud83d\ud83d', 'two lone highs'], ['a\ud83dz', 'lone high mid-string'],
  ['\ud83d\ude00\ud83d', 'pair then lone high'],
  ['\u007f\u0080', '1B then 2B boundary'], ['\u07ff\u0800', '2B/3B boundary'],
  ['\uffff', 'max BMP'], ['line\r\nline', 'CRLF'],
  ['{"type":"FeatureCollection","features":[]}', 'geojson head'],
];
cases.forEach(([s, l]) => check(s, l));
// the real shape: a GeoJSON-ish string with mixed content, at size
check(JSON.stringify({ type: 'FeatureCollection', features: Array.from({ length: 2000 },
  (_, i) => ({ type: 'Feature', properties: { GEOID: '36' + i, name: 'Tract \u00e9' + i + ' \u4e2d' },
  geometry: { type: 'Polygon', coordinates: [[[-73.9 + i / 1e4, 40.7], [-73.8, 40.8], [-73.9, 40.7]]] } })) }),
  '2000-feature GeoJSON');
// fuzz across the whole UTF-16 range, lone surrogates included
let seed = 12345;
const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
for (let t = 0; t < 3000; t++) {
  let s = '';
  const n = 1 + Math.floor(rnd() * 24);
  for (let i = 0; i < n; i++) s += String.fromCharCode(Math.floor(rnd() * 0x10000));
  check(s, 'fuzz#' + t);
}
console.log('utf8ByteLength: ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
