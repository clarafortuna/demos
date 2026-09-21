/* CLCPA-293's delta to buildIngestImport, extracted from app.js rather than
 * retyped, so the four suites that reverse it cannot drift from the code or
 * from each other.
 *
 * Each of those suites asserts that ITS ticket left the import path alone,
 * against its own earlier baseline. CLCPA-293 legitimately changes that path:
 * a total the engine cannot derive is now accepted from the preparer instead
 * of being discarded in silence. Reversing the delta by name keeps every other
 * byte under the original guard.
 */
const DECL_293 = "      /* CLCPA-293: total cells the engine cannot derive, accepted from the\r\n       * preparer rather than discarded, and named on the panel. */\r\n      preparerTotals: [],\r\n";
const SETUP_293 = "    /* CLCPA-293: asked ONCE per import, not per cell: each answer costs a\r\n     * full recompute of the table.\r\n     *\r\n     * AND ASKED OF THE DRAFT, deliberately, though not because the two differ\r\n     * today. candidate is a copy of draft at this point and a mutation\r\n     * swapping one for the other moves nothing, which is stated here rather\r\n     * than left as an implied claim.\r\n     *\r\n     * The reason is the classifier: it reads VALUES, not just structure. Once\r\n     * the file's figures reach candidate -- which happens in the write loop\r\n     * below, and would happen here too if this were ever moved or re-ordered\r\n     * -- a row can start looking like a computed total BECAUSE a figure was\r\n     * supplied for it, and that would become the reason for refusing the\r\n     * figure. Naming the draft makes the rule independent of where this sits:\r\n     * the file's values must never decide whether the file's values are\r\n     * accepted. */\r\n    const baseRows = (draft || []).map(row => (row || []).slice());\r\n    const baseComputed = ingestComputed(baseRows, tableId, schema);\r\n    const rebuildableTotals = ingestRebuildableTotals(baseRows, schema, tableId,\r\n      (r) => baseComputed.totalRow(r));\r\n    /* CLCPA-293: what the ITEMISED rows come to, so an accepted total can be\r\n     * reconciled against them and the disagreement named. Taken over the rows\r\n     * that are NOT totals, which is the same set every other total in this\r\n     * engine is built from. A8's grand total is the case: the file may say\r\n     * 336,599 while the rows itemise 283,852, and the 52,747 difference is\r\n     * real, not an error. The operator is the only one who can say so, which\r\n     * is why this advises and never rejects. */\r\n    const itemisedSum = (function () {\r\n      const body = baseRows.filter((r, i) => !baseComputed.totalRow(i));\r\n      if (!body.length) return null;\r\n      const len = baseRows.reduce((m, r) => Math.max(m, (r || []).length), 0);\r\n      try { return columnGrandTotals(body, len).colSum; } catch (e) { return null; }\r\n    })();\r\n";
const ACCEPT_293 = "          /* CLCPA-293 / A-10: B7. A TOTAL THE ENGINE CANNOT DERIVE BELONGS TO\r\n           * THE PREPARER, so it is accepted rather than discarded.\r\n           *\r\n           * Only the total-row half of the refusal is relaxed. A derived\r\n           * COLUMN stays computed: \"% in DACs\" is a quotient of two columns\r\n           * present in the row, the engine can always rebuild it, and letting\r\n           * a file overwrite it would be the CLCPA-88 defect coming back.\r\n           *\r\n           * The value still goes through the same parse and the same write as\r\n           * any other cell. What changes is that it is no longer dropped in\r\n           * silence: it is recorded so the panel can say it was accepted and\r\n           * what the itemised rows give instead. */\r\n          if (!computed.derivedCol(cIdx) && !rebuildableTotals.has(t.rowIdx + ',' + cIdx)) {\r\n            res.preparerTotals.push(Object.assign({ rowIndex: t.rowIdx, colIndex: cIdx,\r\n              itemised: (itemisedSum ? itemisedSum[cIdx] : null) }, where));\r\n          } else {\r\n            res.notTouched.computed.push(Object.assign({\r\n              why: computed.derivedCol(cIdx)\r\n                ? 'this column is calculated from the other columns'\r\n                : 'this row is a calculated total',\r\n            }, where));\r\n            return;\r\n          }\r\n        }";
const ACCEPT_BEFORE_293 = "          res.notTouched.computed.push(Object.assign({\r\n            why: computed.derivedCol(cIdx)\r\n              ? 'this column is calculated from the other columns'\r\n              : 'this row is a calculated total',\r\n          }, where));\r\n          return;\r\n        }";
const ENRICH_293 = "    /* CLCPA-293: the accepted totals carry the value that was written, taken\r\n     * from the write itself rather than re-parsed, so the advisory and the\r\n     * draft can never quote different numbers. A cell recorded as accepted\r\n     * but not written is dropped: it means a later guard refused it after\r\n     * all, and advertising it would be a lie about what is in the table. */\r\n    res.preparerTotals = (res.preparerTotals || []).map((p) => {\r\n      const hit = (res.populated || []).find(\r\n        (q) => q.label === p.label && q.column === p.column);\r\n      return hit ? Object.assign({ value: hit.value }, p) : null;\r\n    }).filter(Boolean);\r\n\r\n";
const RENDER_293 = "      renderReconcileNotice(r.reconcileNotices) +\r\n      /* CLCPA-293: and the totals this import took from the preparer because\r\n       * the engine cannot derive them. Beside the reconciliation advisory,\r\n       * in the same amber box and the same voice: both are cases where the\r\n       * app has done something the operator alone can judge. */\r\n      renderPreparerTotalsNotice(r.preparerTotals);";
const RENDER_BEFORE_293 = "      renderReconcileNotice(r.reconcileNotices);";
const RENDER_293_CODE = "      renderReconcileNotice(r.reconcileNotices) +\r\n      \r\n      renderPreparerTotalsNotice(r.preparerTotals);";

/** Turn a post-293 buildIngestImport back into its pre-293 self. */
function reverse293(text) {
  return String(text)
    .replace(DECL_293, () => '')
    .replace(SETUP_293, () => '')
    .replace(ACCEPT_293, () => ACCEPT_BEFORE_293)
    .replace(ENRICH_293, () => '');
}

/** And the same for renderIngestImportResult, which gained the advisory.
 *
 * Two forms, because one caller compares COMMENT-STRIPPED source: a delta
 * carrying its comments cannot match there, and the reversal silently did
 * nothing until this was added. */
function reverseRender293(text) {
  return String(text)
    .replace(RENDER_293, () => RENDER_BEFORE_293)
    .replace(RENDER_293_CODE, () => RENDER_BEFORE_293);
}

/* CLCPA-310's delta to the SAME function, for the same reason: the suites
 * that guard renderIngestImportResult against their own baselines are each
 * asserting that THEIR ticket left the panel alone, and CLCPA-310
 * legitimately changes one expression in it -- the value the fraction
 * advisory shows is formatted instead of concatenated raw, because eight of
 * twenty plausible percent inputs printed a floating-point artifact at an
 * operator.
 *
 * Extracted here rather than retyped in each suite, so the reversal and the
 * code cannot drift apart. */
const RENDER_310 = "          cell(x) + ': ' + x.read + ' read as ' +\r\n          unitNoticeValue(x.read, x.landed))).join('') +";
const RENDER_BEFORE_310 = "          cell(x) + ': ' + x.read + ' read as ' + x.landed)).join('') +";

/** Turn a post-310 renderIngestImportResult back into its pre-310 self. */
function reverseRender310(text) {
  return String(text).replace(RENDER_310, () => RENDER_BEFORE_310);
}

/* CLCPA-305's delta to the same function: the reconciliation advisory is no
 * longer rendered from the panel at all.
 *
 * It was built from r.reconcileNotices, a snapshot of the candidate taken at
 * import time and then carried for as long as the panel lived, while the
 * Confirm-save dialog reconciled the DRAFT fresh on every open. Measured: a
 * file with one row that does not add up, the operator corrects that very
 * cell, and the page still says 1 row while the dialog says 0 at the moment
 * of saving. The list now comes from the draft in one place.
 *
 * THIS REVERSAL MUST RUN BEFORE reverseRender293, because the CLCPA-293
 * delta's own anchor includes the line CLCPA-305 removed. */
const RECONCILE_LINE = '      renderReconcileNotice(r.reconcileNotices) +\r\n';
const STRIPPED_305 = "yearAdvisory +\r\n      \r\n      \r\n      renderPreparerTotalsNotice";
const STRIPPED_BEFORE_305 = "yearAdvisory +\r\n" + RECONCILE_LINE +
  "      \r\n      renderPreparerTotalsNotice";

/** Turn a post-305 renderIngestImportResult back into its pre-305 self. */
function reverseRender305(text) {
  let s = String(text);
  /* already pre-305: the line is there and this ticket's note is not */
  if (s.indexOf('renderReconcileNotice(r.reconcileNotices)') >= 0 &&
      s.indexOf('CLCPA-305: THE RECONCILIATION ADVISORY') < 0) return s;
  /* the RAW form, as a comment-preserving grab() hands it over */
  s = s.replace(/[ ]*\/\* CLCPA-305: THE RECONCILIATION ADVISORY[\s\S]*?\*\/\r\n/,
    () => RECONCILE_LINE);
  /* and the COMMENT-STRIPPED form, where codeOnly has left the blank
   * continuation lines the removed comment and line used to occupy */
  s = s.replace(STRIPPED_305, () => STRIPPED_BEFORE_305);
  return s;
}

/* CLCPA-309's delta to buildIngestImport, for the third time the same
 * reason: two suites guard that function against their own baselines,
 * asserting that THEIR ticket left the import path alone, and CLCPA-309
 * legitimately changes one condition in it.
 *
 * The fraction advisory claims "what was read is what the cell holds". On a
 * declared derived ROW that claim is false -- the value lands and the next
 * recompute replaces it with the quotient -- so the advisory no longer fires
 * there. Reversing the delta by name keeps every other byte under the
 * original guard.
 *
 * Two forms again, because a comment-stripped caller cannot match a delta
 * carrying its comment. The condition replacement is written to serve both:
 * it names only the code. */
const COND_309 = "        if (isPercentLiteral(raw) && !pctCols[cIdx] &&\r\n" +
  "            !(typeof computed.derivedRow === 'function' && computed.derivedRow(t.rowIdx))) {";
const COND_BEFORE_309 = "        if (isPercentLiteral(raw) && !pctCols[cIdx]) {";

/** Turn a post-309 buildIngestImport back into its pre-309 self.
 *
 * ARMED, because a reversal that silently matches nothing is a deleted
 * guard: the suite goes green on an equality it never really tested. If the
 * text is neither post-309 nor already pre-309, that is a drift this kit
 * must not paper over, and it throws into the caller's guard() by name. */
function reverse309(text) {
  const s = String(text);
  if (s.indexOf(COND_309) < 0) {
    if (s.indexOf(COND_BEFORE_309) >= 0) return s;   /* already pre-309 */
    throw new Error('reverse309: neither the post-309 condition nor the ' +
      'pre-309 one is present in buildIngestImport. The reversal would ' +
      'have passed the text through untouched and the guard would have ' +
      'gone green without testing anything.');
  }
  return s
    .replace(/[ ]*\/\* CLCPA-309 \/ D-02: NOT ON A CELL THE ENGINE RECOMPUTES\.[\s\S]*?\*\/\r\n/,
      () => '')
    .replace(COND_309, () => COND_BEFORE_309);
}

/* CLCPA-293 round 4's delta to buildIngestImport: a total the B7 registry
 * says belongs to the preparer is accepted, kept and named even where the
 * value probe would have called it rebuildable. Reversed by name, through
 * the shared kit, for the same reason as the three above -- the suites that
 * pin this function each assert that THEIR ticket left the import path
 * alone, and this one legitimately changes one condition in it. */
const R4_NEW = '          const b7 = isB7PreparerTotal(tableId, candidate[t.rowIdx][0], schema[cIdx]);\r\n' +
  '          if (b7 || (!computed.derivedCol(cIdx) &&\r\n' +
  "                     !rebuildableTotals.has(t.rowIdx + ',' + cIdx))) {\r\n" +
  '            res.preparerTotals.push(Object.assign({ rowIndex: t.rowIdx, colIndex: cIdx,\r\n' +
  '              b7: !!b7,\r\n';
const R4_OLD = "          if (!computed.derivedCol(cIdx) && !rebuildableTotals.has(t.rowIdx + ',' + cIdx)) {\r\n" +
  '            res.preparerTotals.push(Object.assign({ rowIndex: t.rowIdx, colIndex: cIdx,\r\n';

/** Turn a post-round-4 buildIngestImport back into its pre-round-4 self.
 *
 * ARMED, like reverse309: a reversal that silently matches nothing turns
 * its suite green on an equality it never tested. */
function reverse293r4(text) {
  const s = String(text);
  if (s.indexOf(R4_NEW) < 0) {
    if (s.indexOf(R4_OLD) >= 0) return s;            /* already pre-round-4 */
    throw new Error('reverse293r4: neither the post-round-4 accept clause nor ' +
      'the pre-round-4 one is present in buildIngestImport. The reversal ' +
      'would have passed the text through untouched and the guard would ' +
      'have gone green without testing anything.');
  }
  return s
    .replace(/[ ]*\/\* CLCPA-293 round 4: THE B7 REGISTRY[\s\S]*?\*\/\r\n/, () => '')
    .replace(R4_NEW, () => R4_OLD);
}

module.exports = { reverse293, reverseRender293, reverseRender310, reverseRender305,
  reverse309, reverse293r4 };
