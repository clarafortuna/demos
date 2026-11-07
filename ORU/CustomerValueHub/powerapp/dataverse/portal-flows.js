// Email notifications for the O&R Customer Value Hub: three Power Automate flows
// (Dataverse trigger + Office 365 Outlook "Send an email") on ptrl_request and
// ptrl_idea. Only @clarafortuna.com addresses get mail; anything else (the
// tracker's O&R names, analysts without an address) goes to Gerald, so nothing
// leaves the company while the portal is confidential.
const fs = require('fs');
const ENV = '5c344ac0-7294-e6e9-8c4e-0ad374893c12';
const TF = __dirname + '/token.json';
const FALLBACK = 'gerald@clarafortuna.com';
const APP_URL = 'https://apps.powerapps.com/play/e/5c344ac0-7294-e6e9-8c4e-0ad374893c12/app/0a0c6fa7-a7ff-4976-b967-dbec9ad797b2?tenantId=c99ea5cd-d25c-4d09-b7be-5ec537eedeed';

async function tok(scope) {
  const t = JSON.parse(fs.readFileSync(TF, 'utf8'));
  const r = await (await fetch('https://login.microsoftonline.com/organizations/oauth2/v2.0/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: '51f81489-12ee-4a9e-aaae-a2591f45987d', refresh_token: t.refresh_token, scope }) })).json();
  if (!r.access_token) throw new Error(scope + ' ' + (r.error_description || '').slice(0, 160));
  if (r.refresh_token) { t.refresh_token = r.refresh_token; fs.writeFileSync(TF, JSON.stringify(t)); }
  return r.access_token;
}

const f = c => `triggerOutputs()?['body/${c}']`;
const to = col => `@{if(endsWith(toLower(coalesce(${f(col)},'')),'@clarafortuna.com'),${f(col)},'${FALLBACK}')}`;
const v = (c, d = '-') => `@{coalesce(${f(c)},'${d}')}`;

// ─── Email template, in the app's theme ──────────────────────────────────────
// The portal's orange (--primary-color in assets/css/oru.css) on near-black,
// Outfit with Segoe UI as the Outlook fallback. Tables and inline styles only: that is all
// Outlook renders reliably. `x` fills the values: Power Automate expressions in
// the flow, sample text in the local preview (node flows.js preview).
const C = { brand: '#c24e17', brand50: '#fdf1ea', brand100: '#fbe2d4', navy: '#1c1c1c', ink: '#1f2937', muted: '#4b5563', subtle: '#6b7280', border: '#e5e7eb', page: '#f4f5f7', soft: '#f9fafb' };
const FONT = "font-family:Outfit,'Segoe UI',Arial,sans-serif";
const TYPE_PILL = [['Regulatory', '#fdecec', '#b91c1c'], ['Officer or Executive Request', C.brand50, C.brand]];
const STAGE_PILL = [['Done', '#e7f6ee', '#047857'], ['Released', '#e7f6ee', '#047857'], ['Intake', '#f1f3f5', C.muted]];

const FLOW_VALUES = {
  // One answer from a use case's answers (JSON in ptrl_answers).
  ans: (k, d = '-') => `@{coalesce(json(coalesce(${f('ptrl_answers')},'{}'))?['${k}'],'${d}')}`,
  val: (c, d) => v(c, d),
  first: c => `@{first(split(coalesce(${f(c)},'there'),' '))}`,
  pick: (c, pairs, i, def) => `@{${pairs.reduceRight((acc, p) => `if(equals(${f(c)},'${p[0]}'),'${p[i]}',${acc})`, `'${def}'`)}}`,
};

const pill = (x, col, pairs, defBg, defFg) =>
  `<span style="display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:${x.pick(col, pairs, 1, defBg)};color:${x.pick(col, pairs, 2, defFg)}">${x.val(col)}</span>`;

const row = (label, value) => `<tr>
<td style="padding:10px 0;border-top:1px solid ${C.border};width:140px;font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.subtle};vertical-align:top">${label}</td>
<td style="padding:10px 0;border-top:1px solid ${C.border};font-size:14px;color:${C.ink};font-weight:500">${value}</td></tr>`;

const template = (x, { eyebrow, intro, why }) => `<!doctype html><html><body style="margin:0;padding:0;background:${C.page}">
<div style="display:none;max-height:0;overflow:hidden">${x.val('ptrl_requestkey')} · ${x.val('ptrl_name')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};${FONT}"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px">

<tr><td style="padding:0 4px 16px">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:36px;height:36px;background:${C.brand};border-radius:8px;text-align:center;vertical-align:middle;color:#fff;font-size:12px;font-weight:800;letter-spacing:-.02em">O&amp;R</td>
    <td style="padding-left:10px;line-height:1.2">
      <div style="font-size:13px;font-weight:700;color:${C.navy}">O&amp;R Customer Value Hub</div>
      <div style="font-size:9px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:${C.brand}">Unified Innovation Portal</div>
    </td>
  </tr></table>
</td></tr>

<tr><td style="background:#ffffff;border:1px solid ${C.border};border-radius:16px;overflow:hidden">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td style="height:4px;background:${C.brand};font-size:0;line-height:0">&nbsp;</td></tr>
    <tr><td style="padding:28px 32px 8px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${C.brand}">${eyebrow}</div>
      <div style="margin-top:8px;font-size:22px;line-height:1.3;font-weight:700;color:${C.ink}">${x.val('ptrl_name')}</div>
      <div style="margin-top:10px">
        <span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:12px;font-weight:700;background:${C.soft};border:1px solid ${C.border};color:${C.navy};font-family:Consolas,monospace">${x.val('ptrl_requestkey')}</span>
        &nbsp;${pill(x, 'ptrl_stagelabel', STAGE_PILL, C.brand50, C.brand)}
        &nbsp;${pill(x, 'ptrl_requesttypelabel', TYPE_PILL, '#f1f3f5', C.muted)}
      </div>
      <p style="margin:20px 0 4px;font-size:15px;line-height:1.6;color:${C.muted}">${intro}</p>
    </td></tr>
    <tr><td style="padding:8px 32px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('Requested by', x.val('ptrl_requestername'))}
        ${row('Analyst', x.val('ptrl_analystname', 'Not assigned yet'))}
        ${row('System', x.val('ptrl_system'))}
        ${row('Business area', x.val('ptrl_businessarealabel', 'Not classified'))}
        ${row('Department', x.val('ptrl_department'))}
      </table>
    </td></tr>
    <tr><td style="padding:12px 32px 4px">
      <div style="font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.subtle};margin-bottom:8px">Status note</div>
      <div style="background:${C.soft};border:1px solid ${C.border};border-left:3px solid ${C.brand};border-radius:8px;padding:14px 16px;font-size:14px;line-height:1.6;color:${C.ink};white-space:pre-wrap">${x.val('ptrl_statusnote', 'No note yet.')}</div>
    </td></tr>
    <tr><td style="padding:24px 32px 32px">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="background:${C.brand};border-radius:8px"><a href="${APP_URL}&request=${x.val('ptrl_requestkey', '')}" style="display:inline-block;padding:12px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none">View request ${x.val('ptrl_requestkey')} &rarr;</a></td>
      </tr></table>
    </td></tr>
  </table>
</td></tr>

<tr><td style="padding:20px 8px;text-align:center;font-size:12px;line-height:1.6;color:${C.subtle}">
  ${why}<br>O&amp;R Customer Value Hub &middot; This is an automatic notification, replies are not monitored.
</td></tr>
</table>
</td></tr></table></body></html>`;

// The idea email: same frame, the idea in place of the request details.
const ideaTemplate = (x, copy) => template(x, copy)
  .replace(/<div style="margin-top:10px">[\s\S]*?<\/div>\n      <p/, '<p')
  .replace(/<tr><td style="padding:8px 32px 4px">[\s\S]*?<\/table>\n    <\/td><\/tr>\n/, `<tr><td style="padding:8px 32px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('Shared by', x.val('ptrl_submittername'))}
        ${row('Email', x.val('ptrl_submitteremail'))}
      </table>
    </td></tr>\n`)
  .replace('>Status note<', '>The idea<').replace(x.val('ptrl_statusnote', 'No note yet.'), x.val('ptrl_idea'))
  .replace(/<a href="[^"]*"([^>]*)>View request [^<]*<\/a>/, `<a href="${APP_URL}"$1>Open the Customer Value Hub &rarr;</a>`)
  .replace(/<div style="display:none[^>]*>[^<]*<\/div>/, `<div style="display:none;max-height:0;overflow:hidden">New idea · ${x.val('ptrl_name')}</div>`)
  .replace(/(<div style="margin-top:8px;font-size:22px[^>]*>)[^<]*(<\/div>)/, `$1${x.val('ptrl_name')}$2`);

// The new initiative email: same frame, the submission's key answers.
const initiativeTemplate = (x, copy) => template(x, copy)
  .replace(/<div style="margin-top:10px">[\s\S]*?<\/div>\n      <p/, '<p')
  .replace(/<tr><td style="padding:8px 32px 4px">[\s\S]*?<\/table>\n    <\/td><\/tr>\n/, `<tr><td style="padding:8px 32px 4px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
        ${row('Key', x.val('ptrl_usecasekey'))}
        ${row('Code', x.val('ptrl_shortcode'))}
        ${row('Submitted by', x.val('ptrl_submittername'))}
        ${row('Department', x.val('ptrl_department') + ' / ' + x.val('ptrl_workgroup'))}
        ${row('Business owner', x.val('ptrl_businessowner'))}
        ${row('Criticality', x.val('ptrl_criticality'))}
        ${row('Annual hours', x.val('ptrl_annualhours'))}
      </table>
    </td></tr>\n`)
  .replace('>Status note<', '>Problem statement<').replace(x.val('ptrl_statusnote', 'No note yet.'), x.ans('problem'))
  .replace(/<a href="[^"]*"([^>]*)>View request [^<]*<\/a>/, `<a href="${APP_URL}"$1>Open the Customer Value Hub &rarr;</a>`)
  .replace(/<div style="display:none[^>]*>[^<]*<\/div>/, `<div style="display:none;max-height:0;overflow:hidden">New initiative · ${x.val('ptrl_name')}</div>`)
  .replace(/(<div style="margin-top:8px;font-size:22px[^>]*>)[^<]*(<\/div>)/, `$1${x.val('ptrl_name')}$2`);

const mail = (toExpr, subject, body, runAfter = {}) => ({
  type: 'OpenApiConnection', runAfter,
  inputs: {
    host: { connectionName: 'shared_office365', operationId: 'SendEmailV2', apiId: '/providers/Microsoft.PowerApps/apis/shared_office365' },
    parameters: { 'emailMessage/To': toExpr, 'emailMessage/Subject': subject, 'emailMessage/Body': body, 'emailMessage/Importance': 'Normal' },
    authentication: "@parameters('$authentication')",
  },
});
const trigger = (table, message, filtering) => ({
  type: 'OpenApiConnectionWebhook',
  inputs: {
    host: { connectionName: 'shared_commondataserviceforapps', operationId: 'SubscribeWebhookTrigger', apiId: '/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps' },
    parameters: { 'subscriptionRequest/message': message, 'subscriptionRequest/entityname': table, 'subscriptionRequest/scope': 4, ...(filtering ? { 'subscriptionRequest/filteringattributes': filtering } : {}) },
    authentication: "@parameters('$authentication')",
  },
});
const definition = (triggerDef, actions) => ({
  $schema: 'https://schema.management.azure.com/providers/Microsoft.Logic/schemas/2016-06-01/workflowdefinition.json#',
  contentVersion: '1.0.0.0',
  parameters: { $connections: { defaultValue: {}, type: 'Object' }, $authentication: { defaultValue: {}, type: 'SecureObject' } },
  triggers: { When_a_row_changes: triggerDef }, actions,
});
const after = first => ({ [first]: ['Succeeded', 'Failed'] });

const b = s => `<strong style="color:${C.ink}">${s}</strong>`;
const COPY = {
  received: x => ({ eyebrow: 'Request received',
    intro: `Hi ${x.first('ptrl_requestername')}, thanks for reaching out. Your request is in the queue and the team will follow up. You can follow it in the Customer Value Hub at any time.`,
    why: 'You are receiving this because you raised this request.' }),
  newForTeam: x => ({ eyebrow: 'New request',
    intro: `${b(x.val('ptrl_requestername'))} raised a new ${b(x.val('ptrl_requesttypelabel', 'request'))}. Review the details below and pick it up in the Customer Value Hub.`,
    why: 'You are receiving this because you work the intake queue.' }),
  updated: x => ({ eyebrow: 'Status update',
    intro: `Hi ${x.first('ptrl_requestername')}, your request moved to ${b(x.val('ptrl_stagelabel'))}.`,
    why: 'You are receiving this because you raised this request.' }),
  updatedForTeam: x => ({ eyebrow: 'Request moved',
    intro: `This request, with ${b(x.val('ptrl_analystname', 'no analyst yet'))}, is now ${b(x.val('ptrl_stagelabel'))}.`,
    why: 'You are receiving this because you work this request.' }),
  ideaThanks: x => ({ eyebrow: 'Idea received',
    intro: `Hi ${x.first('ptrl_submittername')}, thank you for sharing your idea. The team reads every one, and will reach out if they need more detail.`,
    why: 'You are receiving this because you shared an idea.' }),
  ideaForTeam: x => ({ eyebrow: 'New idea',
    intro: `${b(x.val('ptrl_submittername'))} shared an idea on the Share an Idea page.`,
    why: 'You are receiving this because you review shared ideas.' }),
  initiativeThanks: x => ({ eyebrow: 'Initiative submitted',
    intro: `Hi ${x.first('ptrl_submittername')}, thank you for submitting a new initiative. The team reviews every submission within five business days.`,
    why: 'You are receiving this because you submitted this initiative.' }),
  initiativeForTeam: x => ({ eyebrow: 'New initiative',
    intro: `${b(x.val('ptrl_submittername'))} submitted a new initiative. Every answer is in Initiative Submissions, ready to export.`,
    why: 'You are receiving this because you review new initiatives.' }),
};
const R = (copy, x = FLOW_VALUES) => template(x, copy(x));
const I = (copy, x = FLOW_VALUES) => ideaTemplate(x, copy(x));
const N = (copy, x = FLOW_VALUES) => initiativeTemplate(x, copy(x));

const FLOWS = [
  {
    displayName: 'Customer Value Hub - New request emails',
    definition: definition(trigger('ptrl_request', 1), {
      Email_requester: mail(to('ptrl_requesteremail'), `We received your request @{${f('ptrl_requestkey')}}: @{${f('ptrl_name')}}`, R(COPY.received)),
      Email_team: mail(to('ptrl_analystemail'), `New request @{${f('ptrl_requestkey')}} (${v('ptrl_requesttypelabel')}): @{${f('ptrl_name')}}`, R(COPY.newForTeam), after('Email_requester')),
    }),
  },
  {
    displayName: 'Customer Value Hub - Request stage emails',
    definition: definition(trigger('ptrl_request', 3, 'ptrl_stage'), {
      Email_requester: mail(to('ptrl_requesteremail'), `Update on @{${f('ptrl_requestkey')}}: ${v('ptrl_stagelabel')}`, R(COPY.updated)),
      Email_analyst: mail(to('ptrl_analystemail'), `Request @{${f('ptrl_requestkey')}} - ${v('ptrl_stagelabel')}: @{${f('ptrl_name')}}`, R(COPY.updatedForTeam), after('Email_requester')),
    }),
  },
  {
    displayName: 'Customer Value Hub - New idea emails',
    definition: definition(trigger('ptrl_idea', 1), {
      Email_submitter: mail(to('ptrl_submitteremail'), 'Thanks for sharing your idea', I(COPY.ideaThanks)),
      Email_team: mail(FALLBACK, `New idea: @{${f('ptrl_name')}}`, I(COPY.ideaForTeam), after('Email_submitter')),
    }),
  },
  {
    displayName: 'Customer Value Hub - New initiative emails',
    definition: definition(trigger('ptrl_usecase', 1), {
      Email_submitter: mail(to('ptrl_submitteremail'), `We received your initiative @{${f('ptrl_usecasekey')}}: @{${f('ptrl_name')}}`, N(COPY.initiativeThanks)),
      Email_team: mail(FALLBACK, `New initiative @{${f('ptrl_usecasekey')}}: @{${f('ptrl_name')}}`, N(COPY.initiativeForTeam), after('Email_submitter')),
    }),
  },
];

if (process.argv[2] === 'preview') {
  // Writes the six emails with sample values, to look at them in a browser.
  const S = { ptrl_requestkey: 'REQ-079', ptrl_name: 'Billing extract for the NYSERDA quarterly filing', ptrl_stagelabel: 'In Development', ptrl_requesttypelabel: 'Regulatory',
    ptrl_requestername: 'Gerald Serra Torres', ptrl_analystname: 'Mike E', ptrl_system: 'CCB', ptrl_businessarealabel: 'Energy Services', ptrl_department: 'Customer Service Operations',
    ptrl_statusnote: 'We need the Q3 billing extract for accounts enrolled in the community solar program, split by rate class.\nDue to the regulator by the 15th.',
    ptrl_submittername: 'Gerald Serra Torres', ptrl_submitteremail: 'gerald@clarafortuna.com', ptrl_idea: 'A short checklist on the intake form, so a request arrives with what the analyst needs.' };
  Object.assign(S, { ptrl_usecasekey: 'UC-001', ptrl_shortcode: 'SEVREV', ptrl_workgroup: 'O&R Customer Assistance', ptrl_businessowner: 'David Braunfotel',
    ptrl_criticality: 'Silver (important but not mission-critical)', ptrl_annualhours: 2400 });
  const PV = { ans: k => ({ problem: 'Analysts read every severance notice by hand.' })[k] || '-', val: (c, d = '-') => S[c] ?? d, first: c => (S[c] || 'there').split(' ')[0], pick: (c, pairs, i, def) => (pairs.find(p => p[0] === S[c]) || [])[i] ?? def };
  const ideaS = { ...S, ptrl_name: 'Intake checklist' };
  const PVI = { ...PV, val: (c, d = '-') => ideaS[c] ?? d };
  const out = Object.entries(COPY).map(([k, copy]) => `<h3 style="font-family:Arial;margin:24px">${k}</h3>` + (/^idea/.test(k) ? I(copy, PVI) : /^initiative/.test(k) ? N(copy, { ...PV, val: (c, d = '-') => ({ ...S, ptrl_name: 'Severance Notice Review Assist', ptrl_department: 'Other' })[c] ?? d }) : R(copy, PV))).join('');
  fs.writeFileSync(__dirname + '/email-preview.html', out);
  console.log('wrote', __dirname + '/email-preview.html');
  process.exit(0);
}

(async () => {
  const pa = await tok('https://service.powerapps.com//.default offline_access');
  const conn = async api => ((await (await fetch(`https://api.powerapps.com/providers/Microsoft.PowerApps/apis/${api}/connections?api-version=2016-11-01&$filter=environment eq '${ENV}'`, { headers: { Authorization: 'Bearer ' + pa } })).json()).value || [])
    .find(c => (c.properties.statuses || []).some(s => s.status === 'Connected') && !/^pac-/.test(c.name));
  const outlook = await conn('shared_office365'), dv = await conn('shared_commondataserviceforapps');
  if (!outlook) { console.log('NO OUTLOOK CONNECTION yet'); process.exit(2); }
  console.log('using', outlook.name, dv.name);
  const fl = await tok('https://service.flow.microsoft.com//.default offline_access');
  const H = { Authorization: 'Bearer ' + fl, 'Content-Type': 'application/json' };
  const base = `https://api.flow.microsoft.com/providers/Microsoft.ProcessSimple/environments/${ENV}/flows`;
  const existing = (await (await fetch(base + '?api-version=2016-11-01', { headers: H })).json()).value || [];
  for (const fdef of FLOWS) {
    const body = { properties: { displayName: fdef.displayName, definition: fdef.definition, state: 'Started',
      connectionReferences: {
        shared_commondataserviceforapps: { connectionName: dv.name, id: '/providers/Microsoft.PowerApps/apis/shared_commondataserviceforapps', source: 'Embedded' },
        shared_office365: { connectionName: outlook.name, id: '/providers/Microsoft.PowerApps/apis/shared_office365', source: 'Embedded' },
      } } };
    const prev = existing.find(x => x.properties.displayName === fdef.displayName);
    const res = await fetch(prev ? `${base}/${prev.name}?api-version=2016-11-01` : `${base}?api-version=2016-11-01`, { method: prev ? 'PATCH' : 'POST', headers: H, body: JSON.stringify(body) });
    const j = await res.json();
    console.log(prev ? 'updated' : 'created', fdef.displayName, res.status, res.ok ? j.name + ' ' + j.properties.state : JSON.stringify(j.error).slice(0, 400));
  }
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
