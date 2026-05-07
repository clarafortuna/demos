/**
 * Step 1: Extract Table A3 from cf_clcpa_dash_legacy (__LEGACY_DASH.sectionA)
 * Back-calculate totals: totalIncentive = participants * avgIncentive,
 * totalMmbtu = participants * avgMmbtu
 *
 * Known legacy inconsistency (parallel to Table A2 2023 MMBtu footer): A3 **2023** footer
 * Total participants can exceed the sum of program rows (Δ 15,350 in packaged dash). **Ground truth = row-detail sum.**
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const legacyPath = path.resolve(__dirname, '../../src/WebResources/cf_clcpa_dash_legacy');
const outPath = path.resolve(__dirname, 'legacy-table-a3-extracted.json');

const t = fs.readFileSync(legacyPath, 'utf8');
const i = t.indexOf("atob('");
if (i < 0) throw new Error('atob not found');
const start = i + 6;
const end = t.indexOf("')", start);
const j = JSON.parse(Buffer.from(t.slice(start, end), 'base64').toString('utf8'));

const a3 = j.sectionA.tables.find((x) => x.id === 'A3');
if (!a3) throw new Error('A3 table missing');

function numOrZero(v) {
  if (v === 'N/A' || v === '' || v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function parseYear(data, year) {
  const header = data[0];
  const rows = [];
  let grandTotal = null;
  for (let r = 1; r < data.length; r++) {
    const row = data[r];
    const participantType = row[0];
    const programName = row[1];
    const participants = numOrZero(row[2]);
    const avgInc = numOrZero(row[3]);
    const avgMmbtu = numOrZero(row[4]);
    if (programName === 'Total' || participantType === 'Total') {
      grandTotal = {
        participantType,
        programName,
        rawRow: [...row],
        totalParticipants: participants,
        avgIncentiveLegacy: avgInc,
        avgMmbtuLegacy: avgMmbtu,
        totalIncentiveFromAvgs: participants * avgInc,
        totalMmbtuFromAvgs: participants * avgMmbtu,
      };
      continue;
    }
    rows.push({
      year,
      participantType,
      programName,
      totalParticipants: participants,
      avgIncentivePerParticipant: avgInc,
      avgEnergySavingsMmbtuPerParticipant: avgMmbtu,
      totalIncentiveDollars: participants * avgInc,
      totalEnergySavingsMmbtu: participants * avgMmbtu,
    });
  }
  return { header, rows, grandTotal };
}

function sumDetail(rows) {
  return rows.reduce(
    (a, r) => ({
      totalParticipants: a.totalParticipants + r.totalParticipants,
      totalIncentiveDollars: a.totalIncentiveDollars + r.totalIncentiveDollars,
      totalEnergySavingsMmbtu: a.totalEnergySavingsMmbtu + r.totalEnergySavingsMmbtu,
    }),
    { totalParticipants: 0, totalIncentiveDollars: 0, totalEnergySavingsMmbtu: 0 }
  );
}

const y2024 = parseYear(a3.data_2024, 2024);
const y2023 = parseYear(a3.data_2023, 2023);
const sum24 = sumDetail(y2024.rows);
const sum23 = sumDetail(y2023.rows);

const output = {
  source: '__LEGACY_DASH.sectionA.tables[A3]',
  titles: { title_2024: a3.title_2024, title_2023: a3.title_2023 },
  legacyHeaders: y2024.header,
  note:
    'totalIncentiveDollars = totalParticipants * avgIncentivePerParticipant; totalEnergySavingsMmbtu = totalParticipants * avgEnergySavingsMmbtuPerParticipant. Legacy Avg cells that are "N/A" or empty are treated as 0 for back-calculation.',
  knownLegacyInconsistency2023Participants: {
    topic: 'Table A3 2023 participant Total row vs program lines',
    packagedLegacyFooterTotalParticipants: y2023.grandTotal?.totalParticipants ?? null,
    rowDetailSumParticipants: sum23.totalParticipants,
    deltaFooterMinusDetail:
      y2023.grandTotal != null
        ? y2023.grandTotal.totalParticipants - sum23.totalParticipants
        : null,
    groundTruth: 'row_detail_sum',
  },
  years2024: {
    rowCount: y2024.rows.length,
    grandTotal: y2024.grandTotal,
    sumsBackCalculatedFromRows: sum24,
    participantCountMatchLegacyTotal:
      y2024.grandTotal && y2024.grandTotal.totalParticipants === sum24.totalParticipants,
    rows: y2024.rows,
  },
  years2023: {
    rowCount: y2023.rows.length,
    grandTotal: y2023.grandTotal,
    sumsBackCalculatedFromRows: sum23,
    participantCountMatchLegacyTotal:
      y2023.grandTotal && y2023.grandTotal.totalParticipants === sum23.totalParticipants,
    rows: y2023.rows,
  },
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf8');
console.log('Wrote', outPath);
console.log('2024 programs', y2024.rows.length, '2023 programs', y2023.rows.length);
