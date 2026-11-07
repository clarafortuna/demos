// Customer Value Hub: publisher (prefix ptrl), solution, and the two tables the
// portal keeps its records in. Re-runnable: what exists is left alone.
//   ptrl_request  one row per intake request, the same shape as R() in portal.html
//   ptrl_attachment  one row per file attached to a request (File column)
//   ptrl_usecase  one row per proposed use case (answers to the 40 intake questions)
//   ptrl_idea     one row per Share an Idea submission
const { dv, L } = require('./dv');
const SOL = 'CustomerValueHub';

const str = (name, label, max = 100) => ({ '@odata.type': 'Microsoft.Dynamics.CRM.StringAttributeMetadata', SchemaName: name, DisplayName: L(label), RequiredLevel: { Value: 'None' }, MaxLength: max, FormatName: { Value: 'Text' } });
const memo = (name, label, max = 100000) => ({ '@odata.type': 'Microsoft.Dynamics.CRM.MemoAttributeMetadata', SchemaName: name, DisplayName: L(label), RequiredLevel: { Value: 'None' }, MaxLength: max, Format: 'TextArea' });
const int = (name, label) => ({ '@odata.type': 'Microsoft.Dynamics.CRM.IntegerAttributeMetadata', SchemaName: name, DisplayName: L(label), RequiredLevel: { Value: 'None' }, MinValue: 0, MaxValue: 2147483647, Format: 'None' });
const date = (name, label) => ({ '@odata.type': 'Microsoft.Dynamics.CRM.DateTimeAttributeMetadata', SchemaName: name, DisplayName: L(label), RequiredLevel: { Value: 'None' }, Format: 'DateOnly', DateTimeBehavior: { Value: 'DateOnly' } });

const TABLES = [
  { schema: 'ptrl_Request', label: 'Request', plural: 'Requests', primary: ['ptrl_Name', 'Request', 400],
    description: 'Intake requests raised in the Customer Value Hub.',
    columns: [
      str('ptrl_RequestKey', 'Request Key', 20), int('ptrl_Number', 'Number'),
      str('ptrl_RequestType', 'Request Type'), str('ptrl_RequestTypeLabel', 'Request Type Label'),
      str('ptrl_Department', 'Department', 200),
      str('ptrl_System', 'System', 50),
      str('ptrl_BusinessArea', 'Business Area', 50), str('ptrl_BusinessAreaLabel', 'Business Area Label'),
      str('ptrl_Stage', 'Stage', 30), str('ptrl_StageLabel', 'Stage Label', 50),
      str('ptrl_AnalystId', 'Analyst Id', 50), str('ptrl_AnalystName', 'Analyst'), str('ptrl_AnalystEmail', 'Analyst Email', 200),
      str('ptrl_RequesterId', 'Requester Id', 50), str('ptrl_RequesterName', 'Requester'), str('ptrl_RequesterEmail', 'Requester Email', 200),
      date('ptrl_RaisedOn', 'Raised On'), date('ptrl_CompletedOn', 'Completed On'),
      memo('ptrl_StatusNote', 'Status Note'), str('ptrl_StatusCode', 'Status Code', 200),
      str('ptrl_AlsoInvolved', 'Also Involved', 400), str('ptrl_Resolution', 'Resolution', 200),
      str('ptrl_Blocked', 'Blocked Reason', 400), str('ptrl_Initiative', 'Initiative', 20),
      memo('ptrl_Contradiction', 'Source Contradiction', 4000), memo('ptrl_Attachments', 'Attachments (JSON)', 20000),
      memo('ptrl_Notes', 'Notes (JSON)', 100000)
    ] },
  { schema: 'ptrl_Attachment', label: 'Attachment', plural: 'Attachments', primary: ['ptrl_Name', 'File Name', 400],
    description: 'Files attached to an intake request (screenshots, Excel, PDF, Word).',
    columns: [str('ptrl_RequestKey', 'Request Key', 20), str('ptrl_ContentType', 'Content Type', 200), int('ptrl_Size', 'Size (bytes)'),
      { '@odata.type': 'Microsoft.Dynamics.CRM.FileAttributeMetadata', SchemaName: 'ptrl_File', DisplayName: L('File'), RequiredLevel: { Value: 'None' }, MaxSizeInKB: 32768 }] },
  { schema: 'ptrl_UseCase', label: 'Use Case', plural: 'Use Cases', primary: ['ptrl_Name', 'Use Case Name', 300],
    description: 'Use cases proposed in the Customer Value Hub, with the questions of the Customer Operations use case intake form.',
    columns: [str('ptrl_UseCaseKey', 'Use Case Key', 20), str('ptrl_ShortCode', 'Short Name / Code', 20),
      str('ptrl_SubmitterName', 'Submitter', 200), str('ptrl_SubmitterEmail', 'Submitter Email', 200),
      str('ptrl_Department', 'Department', 200), str('ptrl_Workgroup', 'Section / Workgroup', 200),
      str('ptrl_BusinessOwner', 'Accountable Business Owner', 200), str('ptrl_Status', 'Status', 50),
      str('ptrl_Criticality', 'Business Criticality', 100), str('ptrl_SolutionType', 'Solution Type', 300),
      int('ptrl_AnnualHours', 'Annual Hours'), memo('ptrl_Answers', 'Answers (JSON)', 200000)] },
  { schema: 'ptrl_Idea', label: 'Idea', plural: 'Ideas', primary: ['ptrl_Name', 'Summary', 200],
    description: 'Ideas shared on the Share an Idea page.',
    columns: [str('ptrl_SubmitterName', 'Submitted By', 200), str('ptrl_SubmitterEmail', 'Submitter Email', 200),
      memo('ptrl_Idea', 'Idea', 20000), str('ptrl_Status', 'Status', 50)] }
];

const has = async p => { try { await dv('GET', p); return true; } catch (e) { if (e.status === 404) return false; throw e; } };

(async () => {
  // Publisher and solution
  let pub = (await dv('GET', "publishers?$select=publisherid&$filter=customizationprefix eq 'ptrl'")).value[0];
  if (!pub) {
    await dv('POST', 'publishers', { uniquename: 'CustomerValueHub', friendlyname: 'Customer Value Hub', customizationprefix: 'ptrl', customizationoptionvalueprefix: 41270 });
    pub = (await dv('GET', "publishers?$select=publisherid&$filter=customizationprefix eq 'ptrl'")).value[0];
    console.log('publisher created');
  }
  if (!(await dv('GET', `solutions?$select=solutionid&$filter=uniquename eq '${SOL}'`)).value.length) {
    await dv('POST', 'solutions', { uniquename: SOL, friendlyname: 'Customer Value Hub', version: '1.0.0.0', description: 'O&R Customer Value Hub: the portal app, its tables and its email flows.',
      'publisherid@odata.bind': `/publishers(${pub.publisherid})` });
    console.log('solution created');
  }
  const H = { 'MSCRM.SolutionUniqueName': SOL };
  for (const t of TABLES) {
    const ln = t.schema.toLowerCase();
    if (!(await has(`EntityDefinitions(LogicalName='${ln}')?$select=LogicalName`))) {
      await dv('POST', 'EntityDefinitions', {
        '@odata.type': 'Microsoft.Dynamics.CRM.EntityMetadata', SchemaName: t.schema, DisplayName: L(t.label), DisplayCollectionName: L(t.plural),
        Description: L(t.description), OwnershipType: 'UserOwned', HasActivities: false, HasNotes: false, IsActivity: false,
        Attributes: [{ ...str(t.primary[0], t.primary[1], t.primary[2]), IsPrimaryName: true, RequiredLevel: { Value: 'ApplicationRequired' } }]
      }, H);
      console.log('table', ln);
    }
    for (const c of t.columns) {
      const base = `EntityDefinitions(LogicalName='${ln}')/Attributes`;
      if (await has(`${base}(LogicalName='${c.SchemaName.toLowerCase()}')?$select=LogicalName`)) continue;
      await dv('POST', base, c, H); console.log('  column', c.SchemaName);
    }
  }
  await dv('POST', 'PublishXml', { ParameterXml: '<importexportxml><entities>' + TABLES.map(t => '<entity>' + t.schema.toLowerCase() + '</entity>').join('') + '</entities></importexportxml>' });
  console.log('published');
})().catch(e => { console.error('FAILED', e.message); process.exit(1); });
