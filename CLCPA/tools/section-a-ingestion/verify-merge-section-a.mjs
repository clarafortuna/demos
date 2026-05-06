/**
 * Verifies mergeSectionA for 2023 and 2024 A1 programs using DV-shaped facts from demo CSVs.
 * Run: node verify-merge-section-a.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyPath = path.resolve(__dirname, '../../src/WebResources/cf_clcpa_dash_legacy');
const factCsv = path.join(__dirname, 'cf_FACT_legacyA1_demo.csv');
const progCsv = path.join(__dirname, 'cf_DIMPROGRAM_legacy23_demo.csv');

function extractLegacy() {
  const s = fs.readFileSync(legacyPath, 'utf8');
  const start = s.indexOf("atob('");
  if (start < 0) throw new Error('atob not found');
  const i0 = start + "atob('".length;
  const i1 = s.indexOf("')", i0);
  const b64 = s.slice(i0, i1);
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

function splitCsvLine(line) {
  const r = [];
  let cur = '';
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (c === ',' && !q) {
      r.push(cur);
      cur = '';
    } else cur += c;
  }
  r.push(cur);
  return r.map((s) => s.trim().replace(/^"|"$/g, ''));
}

function loadProgramMap() {
  const lines = fs.readFileSync(progCsv, 'utf8').split(/\r?\n/).filter(Boolean);
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3) continue;
    map.set(cols[0], cols[2].replace(/""/g, '"'));
  }
  return map;
}

function clonePayload(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function isDacFact(f) {
  const ds = f.cf_dacstatus || {};
  const code = String(ds.cf_dacstatuscode || '').toUpperCase();
  const label = String(ds.cf_dacstatuslabel || '').toUpperCase();
  const blob = code + ' ' + label;
  if (code === 'NON_DAC' || /\bNON[\s_-]*DAC\b/i.test(blob)) return false;
  if (code === 'DAC') return true;
  return /\bDAC\b|DAC_|DISADVANTAGED|IN_DAC|INDAC|DAC_COMMUNITY/i.test(blob);
}

function programMatchesLegacyForA1(f, legacyName) {
  let raw = (f.cf_program && (f.cf_program.cf_programname || f.cf_program.cf_programcode)) || '';
  const nTrim = String(raw).trim();
  const LTrim = String(legacyName).trim();
  if (nTrim.toLowerCase() === LTrim.toLowerCase()) return true;
  const n = nTrim.toUpperCase();
  const L = LTrim.toUpperCase();
  if (L.indexOf('CSRP') >= 0 && /SYSTEM\s+RELIEF|CSRP/i.test(n)) return true;
  if (L.indexOf('DLRP') >= 0 && /DISTRIBUTION\s+LOAD|DLRP/i.test(n)) return true;
  if (L.indexOf('BYOT') >= 0 && /BYOT/i.test(n)) return true;
  if (L.indexOf('TERM') >= 0 && /TERM/i.test(n) && /DLM/i.test(n)) return true;
  if (L.indexOf('AUTO') >= 0 && /AUTO/i.test(n) && /DLM/i.test(n)) return true;
  return false;
}

function aggregateAIncentiveByProgram(facts, legacyName) {
  let dac = 0;
  let nondac = 0;
  let n = 0;
  for (const f of facts) {
    if (!programMatchesLegacyForA1(f, legacyName)) continue;
    if (f.cf_incentivedollars == null) continue;
    n++;
    const amt = Number(f.cf_incentivedollars);
    if (isDacFact(f)) dac += amt;
    else nondac += amt;
  }
  return { dac, total: dac + nondac, hasdv: n > 0 };
}

function mergeSectionA(payload, facts) {
  if (!payload || !payload.charts) return payload;
  if (!facts || !facts.length) return payload;
  const ch = payload.charts;
  for (const key of Object.keys(ch)) {
    const m = /^A1_programs_(\d{4})$/.exec(key);
    if (!m) continue;
    const y = m[1];
    const arr = ch[key];
    if (!arr || !arr.map) continue;
    const factsY = facts.filter((f) => {
      const cy = f.cf_period && f.cf_period.cf_calendaryear;
      if (cy == null) return false;
      return String(parseInt(cy, 10)) === y;
    });
    if (!factsY.length) continue;
    ch[key] = arr.map((row) => {
      const leg = clonePayload(row);
      const a = aggregateAIncentiveByProgram(factsY, leg.name);
      if (!a.hasdv) return leg;
      return { name: leg.name, dac: a.dac, total: a.total };
    });
  }
  return payload;
}

function buildFactsFromDemoCsv() {
  const progById = loadProgramMap();
  const lines = fs.readFileSync(factCsv, 'utf8').split(/\r?\n/).filter(Boolean);
  const facts = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 8) continue;
    const id = cols[0];
    if (!id.startsWith('f55aaaaa')) continue;
    const st = cols[1];
    const m = /^LEGACY_A1_(\d{4})_/.exec(st);
    if (!m) throw new Error('Bad sourcetable ' + st);
    const year = parseInt(m[1], 10);
    const seedProg = cols[3];
    const pname = progById.get(seedProg);
    if (!pname) throw new Error('No program for ' + seedProg);
    const isDacRow = st.endsWith('_DAC');
    const incentive = Number(cols[7]);
    facts.push({
      cf_period: { cf_calendaryear: year },
      cf_program: { cf_programname: pname },
      cf_dacstatus: { cf_dacstatuscode: isDacRow ? 'DAC' : 'NON_DAC' },
      cf_incentivedollars: incentive,
    });
  }
  return facts;
}

const j = extractLegacy();
const charts = j.sectionA?.charts || {};
const facts = buildFactsFromDemoCsv();
if (facts.length !== 48) throw new Error('Expected 48 demo facts, got ' + facts.length);

const merged = mergeSectionA(JSON.parse(JSON.stringify({ charts: { ...charts } })), facts);

let errors = 0;
for (const y of ['2023', '2024']) {
  const key = 'A1_programs_' + y;
  const orig = charts[key] || [];
  const next = merged.charts[key] || [];
  if (orig.length !== next.length) {
    console.error(key + ': length mismatch');
    errors++;
    continue;
  }
  for (let i = 0; i < orig.length; i++) {
    const a = orig[i];
    const b = next[i];
    if (a.name !== b.name) {
      console.error(key + ': name mismatch at ' + i);
      errors++;
      continue;
    }
    const dD = Math.abs(Number(b.dac) - Number(a.dac));
    const dT = Math.abs(Number(b.total) - Number(a.total));
    if (dD > 0.02 || dT > 0.02) {
      console.error(
        key + ' ' + a.name + ': expected dac=' + a.dac + ' total=' + a.total + ' got dac=' + b.dac + ' total=' + b.total
      );
      errors++;
    }
  }
}

if (errors) {
  console.error('mergeSectionA verification failed with ' + errors + ' error(s).');
  process.exit(1);
}

console.log(
  'mergeSectionA OK: A1_programs_2023 and A1_programs_2024 match legacy dac/total for all programs (DV-shaped facts).'
);
