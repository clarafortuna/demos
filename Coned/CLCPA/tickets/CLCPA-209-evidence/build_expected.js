/* The expected census must NOT come from the shipped implementation, or the
 * assertion checks the code against itself. It is derived instead from the census
 * Emely REVIEWED AND APPROVED (98 rows, produced by the standalone R4 prototype
 * before any app.js change), minus exactly the rows the authorized work was meant
 * to resolve. Anything else the shipped code does will fail the assertion. */
const fs=require('fs');
const approved=JSON.parse(fs.readFileSync('clcpa209_r4_census.json','utf8'));
if(approved.length!==98) throw new Error('approved census is '+approved.length+', expected 98');

// The 8 rows the slice was authorized to fix, named individually.
const RESOLVED=[
  ['C2','2023',2,'positional fallback: data rows are strings, nothing to test'],
  ['C2','2024',2,'positional fallback'],
  ['C2','2025',3,'positional fallback'],
  ['F7','2023',2,'two-candidate flat branch: "% of Grand Total" holds numbers in 2023'],
  ['A3','2025',22,'majority confirmation: 2 of 3 columns match'],
  ['A4','2025',22,'majority confirmation: 2 of 3 columns match'],
  ['A2','2023',28,'majority confirmation: 1 of 2 columns match'],
  ['A8','2023',32,'majority confirmation: the 0.18% column is a tolerance edge'],
  ['A8','2023',12,'majority confirmation: a genuine Subtotal, 1 of 2 columns matching. Its -12.92% gap is a DATA problem (reported), not grounds to declassify the row'],
];
const key=x=>x.tableId+'|'+x.year+'|'+x.row;
const drop=new Set(RESOLVED.map(([t,y,r])=>t+'|'+y+'|'+r));
const missing=RESOLVED.filter(([t,y,r])=>!approved.some(a=>key(a)===t+'|'+y+'|'+r));
if(missing.length) throw new Error('resolved rows absent from the approved census: '+JSON.stringify(missing));

const expected=approved.filter(a=>!drop.has(key(a)))
  .map(a=>({tableId:a.tableId,year:a.year,row:a.row,label:a.label,today:a.today,proposed:a.proposed}));
fs.writeFileSync('clcpa209_census_expected.json',JSON.stringify(expected,null,2));
console.log('approved census      : '+approved.length);
console.log('authorized to resolve: '+RESOLVED.length);
RESOLVED.forEach(([t,y,r,why])=>console.log('   '+(t+'/'+y+' r'+r).padEnd(16)+why));
console.log('expected census      : '+expected.length);
