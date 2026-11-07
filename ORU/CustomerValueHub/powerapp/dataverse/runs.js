// Latest request row and the recent runs of the portal's flows.
const { dv, flow } = require('./dv');
(async () => {
  const r = (await dv('GET', 'ptrl_requests?$select=ptrl_requestkey,ptrl_name,ptrl_requestername,ptrl_requesteremail,ptrl_requesttypelabel,ptrl_stagelabel&$orderby=ptrl_number desc&$top=1')).value[0];
  console.log('latest row:', r.ptrl_requestkey, '|', r.ptrl_name, '|', r.ptrl_requestername, r.ptrl_requesteremail, '|', r.ptrl_requesttypelabel, r.ptrl_stagelabel);
  const ideas = (await dv('GET', 'ptrl_ideas?$select=ptrl_name,ptrl_submitteremail,createdon&$orderby=createdon desc&$top=2')).value;
  console.log('ideas:', ideas.map(i => i.ptrl_name + ' / ' + i.ptrl_submitteremail));
  const flows = (await flow('GET', 'flows?api-version=2016-11-01')).value.filter(f => /^Customer Value Hub/.test(f.properties.displayName));
  for (const f of flows) {
    const runs = (await flow('GET', `flows/${f.name}/runs?api-version=2016-11-01&$top=3`)).value;
    console.log(f.properties.displayName, '->', runs.map(x => x.properties.status + ' ' + x.properties.startTime.slice(11, 19)).join(', ') || 'no runs');
  }
})().catch(e => console.log('ERR', e.message));
