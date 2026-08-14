/* check_doc_claims.js -- static guard: the in-app documentation must not claim a
 * capability the app does not have.
 *
 * The bug this exists for: the Con Edison customer extracts card told the
 * operator "Upload the file; the data flows in through the upload into the data
 * store. No rebuild and no code change." There is no such upload. app.js has no
 * spreadsheet handling of any kind, and both file inputs accept .geojson,.json
 * only. Refreshing those extracts means rebuilding map_payload.json through the
 * payload pipeline and redeploying it.
 *
 * It survived because nothing connects a documentation string to the code it
 * describes. Prose is not exercised by a browser test, and the card itself
 * carried "Using: to confirm" -- flagged as unverified for weeks, and wrong.
 *
 * So this guard is written around the CAPABILITY, not the sentence. It asserts:
 *
 *   1. no upload input anywhere accepts a spreadsheet extension. This is the
 *      code fact every claim below has to match, and it is checked first so a
 *      future xlsx upload path makes this guard fail LOUDLY rather than quietly
 *      permitting the old prose back.
 *   2. no documentation string claims an upload for the extracts. Two phrasings
 *      are named because they shipped; the check is on the pair
 *      (spreadsheet named) + (upload claimed), so a reworded version of the
 *      same false claim is caught too.
 *   3. the honest replacement is present -- a later edit that drops it would
 *      otherwise leave the card silent about how the refresh actually works.
 *
 * Run:  node Data/check_doc_claims.js        (from ExecutiveDashboard_dev/)
 * Exits non-zero on failure, so it works as a pre-commit or CI step.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP = path.join(ROOT, 'app.js');
// The operator-facing copy of the same five cards. Not tracked in git at the
// time of writing, so its absence is not a failure -- but if it is here, it
// must not disagree with the app.
const GUIDE = path.join(ROOT, 'sources-update-guide.html');
// The three Con Edison operator guides. They are the surface most likely to make
// this claim -- they exist to explain the refresh cycles, they are written for
// readers with no repository access, and nobody reading them can check. Absence
// is not a failure; a guide that IS here must not disagree with the app.
const OPERATOR_DOCS = path.join(ROOT, '..', 'operator-docs');

const SPREADSHEET = /\.xlsx\b|\.xls\b|\.csv\b/i;
// Phrasings that shipped. Kept literal so the failure message can name what it
// found, and deliberately NOT the whole test -- see the pair check below.
const SHIPPED_CLAIMS = [
  'flows in through the upload',
  'No rebuild and no code change',
];
// The honest interim wording. The procedure itself is not published here on
// purpose: map_payload.json is not byte-reproducible from its own pipeline, so
// a rebuild procedure would be documenting something not yet validated.
const HONEST = 'no upload for spreadsheets';

function accepted(src) {
  const out = [];
  const re = /accept\s*=\s*["']([^"']+)["']/g;
  let m;
  while ((m = re.exec(src))) {
    m[1].split(',').forEach(function (ext) {
      const e = ext.trim();
      if (e) out.push(e);
    });
  }
  return out;
}

/* Sentences that name a spreadsheet AND claim it reaches the app by itself.
 * Split on <li> and sentence ends rather than lines: the app builds this markup
 * inside a template literal, so one source line can hold a whole paragraph.
 *
 * The verb list is deliberately wider than "upload". The first version of this
 * guard only looked for that word, and a planted rewording -- "Drop
 * Electric.xlsx straight into the app and it is ingested automatically" -- made
 * the identical false promise and passed. The claim class is "a spreadsheet
 * enters the app without a rebuild", however it is phrased. */
const ENTERS_APP = new RegExp([
  '\\bupload(ed|s|ing)?\\b',
  '\\bingest(ed|s|ion|ing)?\\b',
  '\\bimport(ed|s|ing)?\\b',
  '\\bdrag(ged|s)?\\b',
  '\\bdrops? (it |them |the file )?in(to)?\\b',
  'flows? in',
  'picked up',
  'no rebuild',
  'no code change',
  'automatic(ally)?',
].join('|'), 'i');

function uploadClaims(src) {
  // `</pre>` is in the split list because a code block is its own unit. Without
  // it, a pasted script transcript became ONE chunk, and any transcript that
  // happened to mention a .csv input AND end with "Upload it from the Map Layers
  // card" was reported as claiming the csv is uploaded. Splitting there makes the
  // chunks smaller and therefore the match MORE precise -- it does not weaken the
  // check, since a real claim of this kind lives inside a single sentence.
  return src
    .split(/<\/li>|<\/p>|<\/pre>|\. (?=[A-Z])/)
    .map(function (s) { return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim(); })
    .filter(function (s) {
      if (!SPREADSHEET.test(s)) return false;
      // Denials are the correction, not the bug.
      if (/no upload|not self-service|cannot be uploaded|there is no/i.test(s)) return false;
      return ENTERS_APP.test(s);
    });
}

function main() {
  const fails = [];
  const app = fs.readFileSync(APP, 'utf8');
  const surfaces = [{ name: 'app.js', src: app }];
  if (fs.existsSync(GUIDE)) {
    surfaces.push({ name: 'sources-update-guide.html', src: fs.readFileSync(GUIDE, 'utf8') });
  }
  if (fs.existsSync(OPERATOR_DOCS)) {
    fs.readdirSync(OPERATOR_DOCS)
      .filter(function (f) { return /\.html?$/i.test(f); })
      .sort()
      .forEach(function (f) {
        surfaces.push({ name: 'operator-docs/' + f,
                        src: fs.readFileSync(path.join(OPERATOR_DOCS, f), 'utf8') });
      });
  }

  // 1. the capability, from the code
  const exts = accepted(app);
  const spreadsheet = exts.filter(function (e) { return SPREADSHEET.test(e); });
  if (spreadsheet.length) {
    fails.push('an upload input now accepts a spreadsheet (' + spreadsheet.join(', ') + ').\n' +
      '     If that is deliberate, this guard is the thing to update: the extracts card\n' +
      '     may then describe an upload, and the wording it was corrected to is wrong.\n' +
      '     Do not just delete the assertion below -- the two have to move together.');
  }
  if (!exts.length) {
    fails.push('found no accept="" attribute at all in app.js, so assertion 1 proved\n' +
      '     nothing. The upload inputs were renamed or removed; fix this guard.');
  }

  // 2. no surface claims the upload
  surfaces.forEach(function (s) {
    SHIPPED_CLAIMS.forEach(function (claim) {
      if (s.src.indexOf(claim) !== -1) {
        fails.push(s.name + ' contains the false claim ' + JSON.stringify(claim) + '.\n' +
          '     There is no spreadsheet upload. Refreshing the extracts rebuilds\n' +
          '     map_payload.json through the payload pipeline and redeploys it.');
      }
    });
    uploadClaims(s.src).forEach(function (sentence) {
      fails.push(s.name + ' has a sentence naming a spreadsheet and claiming it is\n' +
        '     uploaded:\n       ' + JSON.stringify(sentence.slice(0, 160)) + '\n' +
        '     The app accepts ' + exts.join(', ') + ' and has no spreadsheet handling.');
    });
  });

  // 3. the honest wording survives
  if (app.indexOf(HONEST) === -1) {
    fails.push('app.js no longer says ' + JSON.stringify(HONEST) + '.\n' +
      '     The card has to tell the operator how the refresh actually reaches the\n' +
      '     dashboard, or the false version comes back the next time someone asks.');
  }

  if (fails.length) {
    console.error('FAIL  Data/check_doc_claims.js');
    fails.forEach(function (f, i) { console.error('\n  ' + (i + 1) + '. ' + f); });
    process.exit(1);
  }
  console.log('PASS  no doc claims a spreadsheet upload; inputs accept ' + exts.join(', ') +
              '; the honest wording is present (' + surfaces.length + ' surface(s) checked)');
}

main();
