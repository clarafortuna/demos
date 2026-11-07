/* Stage the portal as the Power Apps code app.
   The runtime proxy serves text files (HTML, CSS, JS, SVG) intact but mangles
   binary ones, so every image and font a page uses is embedded as a data URI in
   the file that references it, and the binaries are left out of dist. */
const fs = require('fs'), path = require('path');
// The portal source: beside this project in the repo (../../portal), or the
// working copy in Downloads.
const SRC = process.env.PORTAL_SRC || (fs.existsSync(path.join(__dirname, '../../portal/index.html'))
  ? path.join(__dirname, '../../portal') : 'C:/Users/geral/Downloads/ORU_AI_Portal_Expart');
const OUT = path.join(__dirname, '../dist');
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.eot': 'application/vnd.ms-fontobject' };
const USED_FONTS = ['uicons-solid-straight', 'uicons-bold-rounded', 'uicons-regular-rounded', 'icofont'];
const isBinary =f => !!MIME[path.extname(f).toLowerCase()];

function dataUri(file) {
  if (!fs.existsSync(file)) return null;
  return 'data:' + MIME[path.extname(file).toLowerCase()] + ';base64,' + fs.readFileSync(file).toString('base64');
}

// Text files only: binaries never reach dist.
function copy(dir, rel = '') {
  for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const r = path.join(rel, e.name);
    if (e.isDirectory()) copy(dir, r);
    else if (!isBinary(e.name)) {
      fs.mkdirSync(path.dirname(path.join(OUT, r)), { recursive: true });
      fs.copyFileSync(path.join(dir, r), path.join(OUT, r));
    }
  }
}

function walk(dir, ext, list = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, ext, list); else if (p.endsWith(ext)) list.push(p);
  }
  return list;
}

// A url() or src= pointing at a binary becomes its data URI; the reference is
// resolved against the source file's folder in the original portal.
let embedded = 0;
const missing = new Set();
function embed(ref, fromDir) {
  const clean = ref.split(/[?#]/)[0];
  if (/^(data:|https?:|\/\/)/.test(ref) || !isBinary(clean)) return null;
  const uri = dataUri(path.resolve(fromDir, clean));
  if (!uri) { missing.add(ref); return null; }
  embedded++;
  return uri;
}


// Text fonts the pages load from Google, saved locally (latin subset).
const FONTCACHE = path.join(__dirname, 'fontcache');
const faces = [
  { family: 'Outfit', weight: '100 900', style: 'normal', file: path.join(FONTCACHE, 'outfit.woff2') },
  { family: 'Inter', weight: '100 900', style: 'normal', file: path.join(FONTCACHE, 'inter.woff2') },
  { family: 'Plus Jakarta Sans', weight: '500 800', style: 'normal', file: path.join(FONTCACHE, 'jakarta.woff2') },
];

function writeFonts() {
  const seen = new Set();
  const list = faces.filter(f => !seen.has(f.family + f.weight + f.style) && seen.add(f.family + f.weight + f.style))
    .map(f => ({ family: f.family, weight: f.weight, style: f.style, data: fs.readFileSync(f.file).toString('base64') }));
  const js = `/* Fonts for the Power Apps build, registered from bytes (see powerapp_build.js). */
(function (faces) {
  faces.forEach(function (f) {
    var bin = atob(f.data), bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    var face = new FontFace(f.family, bytes.buffer, { weight: f.weight, style: f.style, display: 'swap' });
    document.fonts.add(face);
    face.load();
  });
})(${JSON.stringify(list)});
`;
  fs.writeFileSync(path.join(OUT, 'assets/js/pa-fonts.js'), js);
  console.log('fonts:', list.map(f => f.family + ' ' + f.weight).join(', '));
}

fs.rmSync(OUT, { recursive: true, force: true });
copy(SRC);

for (const out of [...walk(OUT, '.css'), ...walk(OUT, '.html')]) {
  const srcDir = path.dirname(path.join(SRC, path.relative(OUT, out)));
  let text = fs.readFileSync(out, 'utf8');
  // @font-face: the host's CSP allows fonts only from 'self', and it serves
  // font files mangled, so the faces move into pa-fonts.js (registered from
  // bytes, which no font-src rule applies to). Only the families in use stay.
  if (out.endsWith('.css')) text = text.replace(/@font-face\s*\{[^}]*\}/g, block => {
    const urls = [...block.matchAll(/url\(\s*["']?([^"')#?]+)[^)]*\)/g)].map(m => m[1]);
    const pick = urls.find(u => u.endsWith('.woff2')) || urls.find(u => u.endsWith('.woff'));
    if (!pick) return block;
    if (!USED_FONTS.includes(path.basename(pick).replace(/\.(woff2|woff)$/, ''))) return '';
    const prop = name => ((block.match(new RegExp(name + '\s*:\s*([^;]+);')) || [])[1] || '').trim().replace(/^["']|["']$/g, '');
    faces.push({ family: prop('font-family'), weight: prop('font-weight') || 'normal', style: prop('font-style') || 'normal',
      file: path.resolve(srcDir, pick) });
    return '';
  });
  // Remote font stylesheets are blocked by the same CSP; their faces are in pa-fonts.js too.
  text = text.replace(/@import\s+url\(\s*["']?https:\/\/fonts\.googleapis[^)]*\)\s*;?/g, '');
  if (out.endsWith('.html')) text = text.replace(/\s*<link[^>]+(?:fonts\.googleapis|rsms\.me)[^>]*>/g, '');
  text = text.replace(/url\(\s*(["']?)([^"')]+)\1\s*\)/g, (m, q, u) => {
    const uri = embed(u, srcDir);
    return uri ? 'url(' + q + uri + q + ')' : m;
  });
  if (out.endsWith('.html')) {
    text = text.replace(/((?:src|href)=")([^"]+)"/g, (m, a, u) => {
      const uri = embed(u, srcDir);
      return uri ? a + uri + '"' : m;
    });
  }
  // Every page connects to the host first thing (host/host.js: the player's
  // handshake and Dataverse), then registers its fonts.
  if (out.endsWith('.html')) text = text.replace(/<head>/i,
    '<head>\n    <script src="assets/js/pa-host.js"></script>\n    <script src="assets/js/pa-fonts.js"></script>');
  fs.writeFileSync(out, text);
}
writeFonts();
require('esbuild').buildSync({ entryPoints: [path.join(__dirname, '../host/host.js')], bundle: true, format: 'iife',
  minify: true, target: 'es2019', outfile: path.join(OUT, 'assets/js/pa-host.js'), logLevel: 'warning' });

const size = walk(OUT, '').reduce((s, f) => s + fs.statSync(f).size, 0);
console.log('dist', (size / 1048576).toFixed(1) + ' MB,', embedded, 'references embedded');
console.log('unresolved:', [...missing].slice(0, 20));
