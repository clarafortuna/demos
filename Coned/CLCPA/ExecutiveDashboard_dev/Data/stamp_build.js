/*
 * stamp_build.js — produce the exact bytes to deploy, with cache-busting stamps.
 *
 * Why this exists
 * ---------------
 * A deploy being byte-verified on the server says nothing about which build a
 * BROWSER is running. A client held a three-generation-old app.js across several
 * deploys, and identifying it took archaeology on strings that happened to have
 * been renamed. Two stamps fix that:
 *
 *   1. ExecutiveDashboard.html references app.js and styles.css with ?v=<id>, so
 *      a fresh document can never pull a stale subresource out of cache.
 *   2. app.js carries the SAME id in a sentinel it prints at boot, so whatever
 *      code is actually executing states which build it is.
 *
 * The second is the one that earns its keep. If the HTML itself is stale, its
 * script tags are stale too and no ?v= can help -- but the running build still
 * announces itself, so the condition is visible in a glance instead of a day.
 *
 * This lives in the repo, not in the deploy script, because the deploy script is
 * a scratch artifact rebuilt each time. Logic that must not rot belongs here.
 *
 * The id
 * ------
 * sha256(file)[0:10], per file, computed over the CANONICAL form -- the file
 * with any existing stamp removed. That makes the function idempotent: stamping
 * an already-stamped file yields the same id, so a re-run cannot drift. A
 * content hash also means an untouched styles.css keeps its cache entry, which
 * a timestamp or commit sha would needlessly invalidate on every deploy.
 *
 * The repo copies are never stamped. app.js says 'dev' on disk and a locally
 * served copy therefore reports itself as unstamped rather than impersonating a
 * deploy.
 *
 * Usage
 * -----
 *   const stamp = require('./Data/stamp_build.js');
 *   const out = stamp.prepare('<path to ExecutiveDashboard_dev>/');
 *   out['app.js'], out['styles.css'], out['ExecutiveDashboard.html']  // Buffers
 *   out.ids  // { 'app.js': '<id>', 'styles.css': '<id>' }
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// The sentinel line in app.js. Matches any current value so the function is
// idempotent, and is anchored on the trailing marker so nothing else can match.
const SENTINEL = /(var APP_BUILD = ')[^']*(';\s*\/\* BUILD_ID \*\/)/;
// The two subresource references in the HTML. The optional ?v= is what makes
// re-stamping idempotent.
const SCRIPT_REF = /(<script src="app\.js)(\?v=[^"]*)?(">)/;
const STYLE_REF = /(<link rel="stylesheet" href="styles\.css)(\?v=[^"]*)?(">)/;

function buildId(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 10);
}

/** Exactly-one-match or throw. A silent no-match would ship an unstamped build. */
function requireOne(text, re, what, file) {
  const all = text.match(new RegExp(re.source, 'g'));
  const n = all ? all.length : 0;
  if (n !== 1) {
    throw new Error('stamp_build: expected exactly one ' + what + ' in ' + file +
      ', found ' + n + '. Refusing to stamp rather than guess.');
  }
}

/** app.js with the sentinel forced to `value`. */
function setSentinel(text, value) {
  return text.replace(SENTINEL, '$1' + value + '$2');
}

/**
 * The bytes to deploy for all three files, plus the ids used.
 * Reads from disk; writes nothing. The repo stays clean.
 */
function prepare(devDir) {
  const read = (f) => fs.readFileSync(path.join(devDir, f), 'utf8');
  const appRaw = read('app.js');
  const cssRaw = read('styles.css');
  const htmlRaw = read('ExecutiveDashboard.html');

  requireOne(appRaw, SENTINEL, 'APP_BUILD sentinel', 'app.js');
  requireOne(htmlRaw, SCRIPT_REF, 'app.js script tag', 'ExecutiveDashboard.html');
  requireOne(htmlRaw, STYLE_REF, 'styles.css link tag', 'ExecutiveDashboard.html');

  // Canonical = unstamped. Hashing this rather than the raw bytes is what makes
  // the id stable whether or not the input was already stamped.
  const appCanonical = setSentinel(appRaw, 'dev');
  const appId = buildId(appCanonical);
  const cssId = buildId(cssRaw);

  const appOut = setSentinel(appCanonical, appId);
  const htmlOut = htmlRaw
    .replace(SCRIPT_REF, '$1?v=' + appId + '$3')
    .replace(STYLE_REF, '$1?v=' + cssId + '$3');

  return {
    'app.js': Buffer.from(appOut, 'utf8'),
    'styles.css': Buffer.from(cssRaw, 'utf8'),
    'ExecutiveDashboard.html': Buffer.from(htmlOut, 'utf8'),
    ids: { 'app.js': appId, 'styles.css': cssId },
  };
}

module.exports = { prepare, buildId, setSentinel, SENTINEL, SCRIPT_REF, STYLE_REF };
