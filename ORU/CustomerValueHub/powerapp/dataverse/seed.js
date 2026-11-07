// Loads the tracker rows that portal.html carries as its seed into
// ptrl_request, mapped exactly as the page's rowFromTicket() maps them.
// Skips keys already in the table.  node seed.js [--go]
const fs = require('fs'), vm = require('vm');
const { dv } = require('./dv');
const html = fs.readFileSync('C:/Users/geral/Downloads/ORU_AI_Portal_Expart/portal.html', 'utf8').split('\n');
const start = html.findIndex((l, i) => i > 2138 && l.startsWith('(function(){')) + 1;
const end = html.findIndex(l => l.startsWith('var TBY = {};'));
const code = html.slice(start, end).join('\n') + '\n;this.out = { TICKETS, PEOPLE, FUNCS, COL };';
const ctx = { window: {}, document: { documentElement: {} }, location: { hash: '' }, navigator: {}, console };
vm.runInNewContext(code, ctx);
const { TICKETS, PEOPLE, FUNCS, COL } = ctx.out;
const P = Object.fromEntries(PEOPLE.map(p => [p.id, p]));
const pname = id => (id && P[id] ? P[id].name : '');
const rows = TICKETS.map(t => ({
  ptrl_name: t.title.slice(0, 400), ptrl_requestkey: t.key, ptrl_number: t.n,
  ptrl_requesttype: '', ptrl_requesttypelabel: '', ptrl_department: '', ptrl_system: t.sys || '',
  ptrl_businessarea: t.fn || '', ptrl_businessarealabel: t.fn && FUNCS[t.fn] ? FUNCS[t.fn].label : '',
  ptrl_stage: t.col, ptrl_stagelabel: COL[t.col].label,
  ptrl_analystid: t.assignee || '', ptrl_analystname: pname(t.assignee), ptrl_analystemail: '',
  ptrl_requesterid: t.reporter || '', ptrl_requestername: pname(t.reporter), ptrl_requesteremail: '',
  ptrl_raisedon: t.created || null, ptrl_completedon: t.completedAt || null,
  ptrl_statusnote: t.statusText || '', ptrl_statuscode: t.statusCode || '', ptrl_alsoinvolved: t.additional || '',
  ptrl_resolution: t.resolution || '', ptrl_blocked: t.blocked || '', ptrl_initiative: t.ini || '',
  ptrl_contradiction: t.contra || '', ptrl_attachments: '[]', ptrl_notes: '[]'
}));
(async () => {
  const have = new Set((await dv('GET', 'ptrl_requests?$select=ptrl_requestkey')).value.map(r => r.ptrl_requestkey));
  const todo = rows.filter(r => !have.has(r.ptrl_requestkey));
  console.log(TICKETS.length, 'seed rows,', have.size, 'in table,', todo.length, 'to create');
  if (!process.argv.includes('--go')) return console.log(JSON.stringify(todo[2], null, 1));
  for (const r of todo) await dv('POST', 'ptrl_requests', r);
  console.log('created', todo.length);
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
