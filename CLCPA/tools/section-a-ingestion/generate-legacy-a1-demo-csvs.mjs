/**
 * Reads cf_clcpa_dash_legacy → CSVs for demo import (Section A A1 legacy programs + facts).
 * Period/DAC GUIDs: same as cf_DIMPERIOD_seed / cf_DACSTATUS_seed (must exist in org).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyPath = path.resolve(__dirname, '../../src/WebResources/cf_clcpa_dash_legacy');
const outDir = __dirname;

const PERIOD_2023 = 'a1111111-1111-1111-1111-111111110223';
const PERIOD_2024 = 'a1111111-1111-1111-1111-111111110224';
const DAC_ID = 'b2222222-2222-2222-2222-222222220001';
const NON_DAC_ID = 'b2222222-2222-2222-2222-222222220002';

function extractLegacy() {
  const s = fs.readFileSync(legacyPath, 'utf8');
  const start = s.indexOf("atob('");
  if (start < 0) throw new Error('atob not found');
  const i0 = start + "atob('".length;
  const i1 = s.indexOf("')", i0);
  const b64 = s.slice(i0, i1);
  return JSON.parse(Buffer.from(b64, 'base64').toString('utf8'));
}

function progGuid(i) {
  return `c44aaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`;
}

function factGuid(i) {
  return `f55aaaaa-aaaa-4aaa-8aaa-${String(i).padStart(12, '0')}`;
}

function main() {
  const j = extractLegacy();
  const charts = j.sectionA?.charts;
  if (!charts) throw new Error('sectionA.charts missing');

  const keys = Object.keys(charts).filter((k) => /^A1_programs_\d{4}$/.test(k)).sort();
  /** @type {Map<string, true>} */
  const nameSet = new Map();
  for (const k of keys) {
    const arr = charts[k];
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      const name = row?.name != null ? String(row.name) : '';
      if (name) nameSet.set(name, true);
    }
  }

  const sortedNames = [...nameSet.keys()].sort();

  const progRows = sortedNames.map((name, idx) => {
    const id = progGuid(idx + 1);
    const code = `A1LG${String(idx + 1).padStart(3, '0')}`;
    const short = name.length > 40 ? name.slice(0, 37) + '…' : name;
    return [id, code, name, short, 'A', '1'].map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',');
  });
  fs.writeFileSync(
    path.join(outDir, 'cf_DIMPROGRAM_legacy23_demo.csv'),
    ['cf_dimprogramid,cf_programcode,cf_programname,cf_portal_short_label,cf_sectioncode,cf_isactive', ...progRows].join('\r\n') + '\r\n',
    'utf8'
  );

  const nameToId = new Map(sortedNames.map((n, i) => [n, progGuid(i + 1)]));

  const factHeader =
    'cf_factcleanenergyspendingid,cf_sourcetable,cf_period,cf_program,cf_dacstatus,cf_customersegmentcode,cf_measurecategorycode,cf_incentivedollars,cf_participants,cf_highimpactdacpct';
  const factRows = [];
  let factSeq = 0;
  for (const k of keys) {
    const m = /^A1_programs_(\d{4})$/.exec(k);
    if (!m) continue;
    const year = m[1];
    const period = year === '2023' ? PERIOD_2023 : year === '2024' ? PERIOD_2024 : null;
    if (!period) continue;
    const arr = charts[k];
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      const name = row?.name != null ? String(row.name) : '';
      if (!name) continue;
      const total = Number(row.total);
      const dac = Number(row.dac);
      if (!Number.isFinite(total) || !Number.isFinite(dac)) continue;
      const nondac = total - dac;
      const pid = nameToId.get(name);
      if (!pid) throw new Error('No program id for ' + name);
      const slug = name.replace(/[^a-z0-9]+/gi, '_').slice(0, 36);
      factSeq += 1;
      const idDac = factGuid(factSeq);
      factSeq += 1;
      const idNd = factGuid(factSeq);
      factRows.push(
        `"${idDac}","LEGACY_A1_${year}_${slug}_DAC","${period}","${pid}","${DAC_ID}","ALL",,${dac},,`
      );
      factRows.push(
        `"${idNd}","LEGACY_A1_${year}_${slug}_ND","${period}","${pid}","${NON_DAC_ID}","ALL",,${nondac},,`
      );
    }
  }

  fs.writeFileSync(
    path.join(outDir, 'cf_FACT_legacyA1_demo.csv'),
    [factHeader, ...factRows].join('\r\n') + '\r\n',
    'utf8'
  );

  console.log('Programs:', sortedNames.length);
  console.log('Fact rows:', factRows.length);
}

main();
