/* The driver is tested BEFORE anything is proven with it.
 *
 * A DOM shim that quietly returns null makes a missing handler and a present
 * handler look identical, which is how "the fix is not wired to any live path"
 * got past a green suite. So every capability this kit claims is exercised
 * here against a known answer, including the ones that must THROW.
 *
 * Run:  node live_page_selftest.js
 */
const { makeDocument } = require('./live_page.js');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const { document, root } = makeDocument();

root.innerHTML = `
  <div id="page" class="wrap">
    <div id="ingest-import-mount"><div class="ingest-import-notice is-warn"><h4>amber</h4></div></div>
    <div id="ingest-editor-mount">
      <table class="ingest-grid"><tbody>
        <tr data-row="0"><td class="ingest-td-label">
          <input type="text" value="Manhattan" data-row="0" data-col="0" class="ingest-cell ingest-cell-label" />
        </td><td><input type="text" value="99" data-row="0" data-col="1" class="ingest-cell ingest-cell-num" /></td>
        <td class="ingest-td-calc"><span class="ingest-cell-calc" data-row="0" data-col="3">1,098</span></td>
        <td class="ingest-td-actions"><button class="ingest-row-delete" data-row="0">x</button></td></tr>
      </tbody></table>
      <button id="ingest-save" class="btn">Save</button>
      <button id="ingest-reset" class="btn btn-secondary">Reset</button>
    </div>
  </div>`;

/* ---- tree + lookup ---- */
ok(document.getElementById('page') !== null, 'A1 getElementById finds a nested id');
ok(document.getElementById('ingest-editor-mount') !== null, 'A2 and the editor mount');
ok(document.getElementById('nope') === null, 'A3 and returns null for one that is absent');
ok(document.getElementById('ingest-import-mount') !== document.getElementById('ingest-editor-mount'),
  'A4 the two mounts are DIFFERENT nodes -- the whole CLCPA-276 question');

/* ---- selectors ---- */
ok(root.querySelectorAll('input.ingest-cell').length === 2, 'B1 tag+class matches both inputs');
ok(root.querySelectorAll('.ingest-cell').length === 2, 'B2 bare class too');
ok(root.querySelector('[data-col="3"]').tagName === 'span', 'B3 attribute selector');
ok(root.querySelectorAll('#ingest-editor-mount input').length === 2,
  'B4 descendant combinator scopes to the editor mount');
ok(root.querySelectorAll('#ingest-import-mount input').length === 0,
  'B5 and finds none under the notice mount');
ok(root.querySelector('.ingest-row-delete') !== null, 'B6 the delete button is reachable');
let threw = false;
try { root.querySelector('td:not(.num)'); } catch (e) { threw = true; }
ok(threw, 'B7 an UNSUPPORTED selector throws instead of matching nothing');

/* ---- attributes, value, class ---- */
const cell = root.querySelector('input[data-col="1"]');
ok(cell.value === '99', 'C1 value comes from the value attribute');
cell.value = '500';
ok(cell.value === '500', 'C2 and is writable');
ok(cell.getAttribute('data-row') === '0', 'C3 getAttribute');
ok(cell.classList.contains('ingest-cell-num'), 'C4 classList.contains');
cell.classList.add('x'); ok(cell.classList.contains('x'), 'C5 classList.add');
cell.classList.remove('x'); ok(!cell.classList.contains('x'), 'C6 classList.remove');

/* ---- events, including bubbling, which the grid delegates on ---- */
const seen = [];
cell.addEventListener('blur', () => seen.push('cell-blur'));
root.querySelector('table').addEventListener('click', () => seen.push('table-click'));
cell.dispatchEvent({ type: 'blur' });
ok(seen.join(',') === 'cell-blur', 'D1 a blur reaches its own listener');
root.querySelector('.ingest-row-delete').dispatchEvent({ type: 'click' });
ok(seen.indexOf('table-click') >= 0, 'D2 a click BUBBLES to the delegating ancestor');
const order = [];
const btn = document.getElementById('ingest-save');
btn.addEventListener('click', () => order.push(1));
btn.addEventListener('click', () => order.push(2));
btn.dispatchEvent({ type: 'click' });
ok(order.join('') === '12', 'D3 listeners fire in order');
ok(btn.closest('#ingest-editor-mount') !== null, 'D4 closest walks up');

/* ---- innerHTML replacement is what a repaint IS ---- */
const before = root.querySelector('input[data-col="1"]');
document.getElementById('ingest-editor-mount').innerHTML = '<input data-col="1" value="7" />';
const after = root.querySelector('input[data-col="1"]');
ok(after !== before, 'E1 a repaint REPLACES nodes, so old listeners are gone');
ok(after.value === '7', 'E2 and the new node carries the new markup');
ok(document.getElementById('ingest-import-mount').innerHTML.indexOf('amber') >= 0,
  'E3 while a SIBLING mount is untouched by that repaint -- the defect shape');

/* ---- textContent ---- */
ok(root.querySelector('h4').textContent === 'amber', 'F1 textContent reads through');

console.log('');
console.log('  ' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
