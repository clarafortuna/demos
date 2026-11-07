// Removes what the Service Desk left in Clara Fortuna Dev: its two email flows,
// the four oru_ tables (rows included), the ORU Intake Portal solution and its
// publisher. The code app itself stays: it now serves the portal.
const { dv, flow } = require('./dv');
const ARGS = process.argv.slice(2), GO = ARGS.includes('--go');
(async () => {
  const flows = (await flow('GET', 'flows?api-version=2016-11-01')).value.filter(f => /^ORU Service Desk/.test(f.properties.displayName));
  const sol = (await dv('GET', "solutions?$select=solutionid,uniquename&$filter=uniquename eq 'ORUIntakePortal'&$expand=publisherid($select=publisherid,uniquename,customizationprefix)")).value[0];
  const comps = sol ? (await dv('GET', `solutioncomponents?$select=componenttype,objectid&$filter=_solutionid_value eq ${sol.solutionid}`)).value : [];
  const tables = ['oru_request', 'oru_requesttype', 'oru_businessarea', 'oru_system'];
  console.log('flows:', flows.map(f => f.properties.displayName));
  console.log('tables:', tables);
  console.log('solution:', sol && sol.uniquename, 'publisher:', sol && sol.publisherid.uniquename, sol && sol.publisherid.customizationprefix);
  console.log('solution components by type:', comps.reduce((a, c) => (a[c.componenttype] = (a[c.componenttype] || 0) + 1, a), {}));
  if (!GO) return console.log('dry run; pass --go to delete');
  for (const f of flows) {
    await flow('POST', `flows/${f.name}/stop?api-version=2016-11-01`).catch(() => {});
    await flow('DELETE', `flows/${f.name}?api-version=2016-11-01`); console.log('deleted flow', f.properties.displayName);
  }
  for (const t of tables) {
    try { await dv('DELETE', `EntityDefinitions(LogicalName='${t}')`); console.log('deleted table', t); }
    catch (e) { if (e.status === 404) console.log('no table', t); else throw e; }
  }
  if (sol) {
    await dv('DELETE', `solutions(${sol.solutionid})`); console.log('deleted solution', sol.uniquename);
    try { await dv('DELETE', `publishers(${sol.publisherid.publisherid})`); console.log('deleted publisher', sol.publisherid.uniquename); }
    catch (e) { console.log('publisher kept:', e.message.slice(0, 200)); }
  }
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
