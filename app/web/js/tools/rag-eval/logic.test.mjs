// cd app/web/js && node --test tools/rag-eval/logic.test.mjs      (node tools/rag-eval/logic.test.mjs --write-json refreshes samples.json)
// 1. Parity: report() vs skills/evaluating-rag-quality/scripts/score_eval.py on the two samples + 40 random result sets
//    (with baselines, half-even rounding cases, unclassified causes). Needs python3; writes temp files in the OS temp dir.
// 2. Claim-level scoring regressions: the 3 failures of research/v3/audit-3.md (flipped yes/no passed 7/7, "drone" was
//    faithful, "four months" vs "120 days" failed) + polarity, units, hallucination, retrieval ratios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync, mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { execFileSync } from 'child_process';
import { evaluate, report, resultsCsv, scoreItem, quantities, sameQty, splitClaims, polarityFlip, METRICS, CAUSES } from './logic.js';
import { toCsv } from '../uat-tracker/csv.js';
import { SAMPLES } from './samples.js';

const SCRIPT = fileURLToPath(new URL('../../../../../skills/evaluating-rag-quality/scripts/score_eval.py', import.meta.url));

test('report() is identical to score_eval.py (2 samples + 40 random result sets)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rag-parity-'));
  const head = ['id', 'category', 'type', 'risk', ...METRICS, 'failure_cause', 'note'];
  const py = (rows, base) => {
    const w = (name, rs) => { const p = join(dir, name); writeFileSync(p, toCsv([head, ...rs.map((r) => head.map((k) => r[k] ?? ''))])); return p; };
    return execFileSync('python3', [SCRIPT, w('r.csv', rows), ...(base ? ['--baseline', w('b.csv', base)] : [])], { encoding: 'utf8' });
  };
  const check = (name, rows, base) => assert.equal(report(rows, base) + '\n', py(rows, base), name); // print() adds a newline
  try {
    for (const lang of ['en', 'fr']) check('sample ' + lang, evaluate(SAMPLES[lang][0].state).rows);
    let seed = 7;
    const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const pick = (a) => a[Math.floor(rnd() * a.length)];
    for (let k = 0; k < 40; k++) {
      const mk = () => Array.from({ length: 1 + Math.floor(rnd() * 16) }, () => ({ id: `Q-${String(Math.floor(rnd() * 90)).padStart(3, '0')}`, category: pick(['Disputes', 'Refunds', 'Cards', 'Fraud']),
        type: pick(['answerable', 'must_refuse', 'must_escalate']), risk: pick(['high', 'medium', 'low', '']),
        ...Object.fromEntries(METRICS.map((m) => [m, pick(['1', '1', '1', '0', ''])])), failure_cause: pick(['', ...CAUSES, 'other']), note: pick(['', 'x']) }));
      check('random ' + k, mk(), rnd() < 0.5 ? mk() : null);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* ---------------------------------------------------------------- samples: the story still holds */
for (const [lang, bad] of [['en', 'DSP-02'], ['fr', 'CTS-02']]) {
  test(`${lang} sample: overall ≥ threshold but BLOCKED by ${bad} only (invented 180-day limit)`, () => {
    const s = evaluate(SAMPLES[lang][0].state);
    assert.equal(s.pass, false); assert.equal(s.overallOk, true);
    assert.deepEqual(s.highFails.map((i) => i.id), [bad]);
    assert.deepEqual(s.items.filter((i) => i.failed.length).map((i) => i.id), [bad]);
    const item = s.items.find((i) => i.id === bad);
    assert.deepEqual(item.failed, ['faithfulness', 'correctness']);
    assert.ok(item.claims[0].reasons.some((r) => r.code === 'qtyNotInContext' && r.q.n === 180));
    assert.ok(item.claims[0].reasons.some((r) => r.code === 'qtyVsGolden'));
    // no amber / red claim anywhere else: the sample must not cry wolf
    for (const i of s.items) if (i.id !== bad) for (const c of i.claims) assert.equal(c.status, 'ok', `${i.id}: ${c.text}`);
  });
  test(`${lang} sample loads inputs only (no autorun, no scores in the state)`, () => {
    const smp = SAMPLES[lang][0];
    assert.equal('autorun' in smp, false);
    assert.deepEqual(Object.keys(smp.state).sort(), ['answers', 'causes', 'gates', 'golden', 'overrides', 'threshold', 'title']);
    assert.deepEqual(smp.state.overrides, {});
  });
}
test('en sample DSP-06: "four months" is accepted against the 120-day source, with the conversion shown', () => {
  const i = evaluate(SAMPLES.en[0].state).items.find((x) => x.id === 'DSP-06');
  assert.equal(i.metrics.faithfulness, 1); assert.equal(i.metrics.correctness, 1);
  const r = i.claims.flatMap((c) => c.reasons).find((x) => x.code === 'qtyEquivContext');
  assert.deepEqual([r.q.n, r.q.unit, r.ref.n, r.ref.unit, r.conv.n], [4, 'mo', 120, 'd', 3.9]);
});

/* ---------------------------------------------------------------- audit-3 failures */
const KB2 = 'Dispute time limits: you can dispute a Visa card payment up to 120 days after the transaction date.';
const G2 = { id: 'T', type: 'answerable', risk: 'high', question: 'how long do I have to dispute a visa payment?', expected_answer: 'Up to 120 days after the transaction date.', expected_sources: 'KB-2' };
const ans = (answer, context = KB2, retrieved = 'KB-2') => ({ answer, context, retrieved });

test('audit 1 · correct paraphrase with converted units passes: "about four months" vs "120 days"', () => {
  const s = scoreItem(G2, ans('You have about four months. [KB-2]'));
  assert.equal(s.metrics.correctness, 1); assert.equal(s.metrics.faithfulness, 1);
  assert.equal(s.refClaims[0].code, 'refEquiv');
  assert.ok(s.claims[0].reasons.some((r) => r.code === 'qtyEquivGolden' && r.conv.n === 3.9 && r.conv.unit === 'mo'));
});
test('audit 2 · flipped yes/no answer no longer passes 7/7', () => {
  const kb = 'Chip and PIN payments: a payment made with your PIN cannot be disputed as unauthorised in the app. You must contact the merchant first.';
  const g = { id: 'T', type: 'answerable', risk: 'high', question: 'can I dispute a payment I made in a shop with my pin', expected_sources: 'KB-4',
    expected_answer: 'No. A payment made with your PIN cannot be disputed as unauthorised; you must contact the merchant first.' };
  const s = scoreItem(g, ans('Yes, a PIN payment can be disputed in the app. There is no need to contact the merchant. [KB-4]', kb, 'KB-4'));
  assert.equal(s.metrics.correctness, 0); assert.equal(s.metrics.faithfulness, 0);
  const codes = s.claims.flatMap((c) => c.reasons.map((r) => r.code));
  for (const c of ['yesNoGolden', 'polarityGolden', 'polarityContext']) assert.ok(codes.includes(c), c);
  assert.ok(s.claims.every((c) => c.status === 'bad'));
  // and the honest answer passes everything
  const ok = scoreItem(g, ans('No. A payment made with your PIN cannot be disputed as unauthorised. You must contact the merchant first. [KB-4]', kb, 'KB-4'));
  assert.deepEqual(METRICS.filter((m) => ok.metrics[m] === 0), []);
});
test('audit 2b · sample question DSP-06 answered "No, you cannot" is caught', () => {
  const st = structuredClone(SAMPLES.en[0].state);
  st.answers = st.answers.replace(/^DSP-06,"?Yes\. [^[]*/m, 'DSP-06,"No, you cannot dispute a payment made in a shop with your PIN. ');
  const i = evaluate(st).items.find((x) => x.id === 'DSP-06');
  assert.equal(i.metrics.correctness, 0); assert.equal(i.metrics.faithfulness, 0);
});
test('audit 3 · hallucinated "drone" is not faithful', () => {
  const kb = 'Card replacement: a replacement card costs 10 EUR and is delivered by post within 5 business days.';
  const g = { id: 'T', type: 'answerable', risk: 'medium', question: 'how much is a new card', expected_answer: 'A replacement card costs 10 EUR, delivered by post within 5 business days.', expected_sources: 'KB-7' };
  const s = scoreItem(g, ans('A replacement card costs 10 EUR and is delivered by drone. [KB-7]', kb, 'KB-7'));
  assert.equal(s.metrics.faithfulness, 0);
  assert.deepEqual([s.ratios.faithfulness.num, s.ratios.faithfulness.den], [1, 2]);
  const bad = s.claims.find((c) => !c.supported);
  assert.deepEqual(bad.reasons.find((r) => r.code === 'termNotInContext').terms, ['drone']);
  assert.equal(scoreItem(g, ans('A replacement card costs 10 EUR and is delivered by post. [KB-7]', kb, 'KB-7')).metrics.faithfulness, 1);
});

/* ---------------------------------------------------------------- polarity */
test('polarity: negated vs affirmed words, EN and FR; no false flip on unrelated negations', () => {
  assert.deepEqual(polarityFlip('You cannot dispute this payment.', 'You can dispute a card payment.'), ['dispute', 'payment']);
  assert.deepEqual(polarityFlip("You don't need to contact the merchant.", 'Contact the merchant first.'), ['contact', 'merchant']);
  assert.deepEqual(polarityFlip('Vous ne pouvez pas contester cette opération.', 'Vous pouvez contester une opération.'), ['contester', 'operation']);
  assert.deepEqual(polarityFlip('You cannot dispute it.', 'A PIN payment can never be disputed.'), []);
  assert.deepEqual(polarityFlip('The 120 days start from the expected delivery date.', 'For goods not received, the 120 days start from the expected delivery date.'), []);
  assert.deepEqual(polarityFlip('We refund no later than the next business day.', 'We refund the next business day.'), []);
});
test('polarity FR: "Non, vous ne pouvez pas contester" vs approved "Oui … vous pouvez contester"', () => {
  const st = structuredClone(SAMPLES.fr[0].state);
  st.answers = st.answers.replace(/^CTS-03,"?Oui, vous pouvez contester/m, 'CTS-03,"Non, vous ne pouvez pas contester');
  const i = evaluate(st).items.find((x) => x.id === 'CTS-03');
  assert.equal(i.metrics.correctness, 0); assert.equal(i.metrics.faithfulness, 0);
  assert.ok(i.claims[0].reasons.some((r) => r.code === 'yesNoGolden'));
});

/* ---------------------------------------------------------------- units */
test('units: quantities are parsed and normalised (days / weeks / months / years, %, EUR / USD, amounts, number words)', () => {
  const q = (t) => quantities(t).map((x) => `${x.n}${x.unit}`).join(' ');
  assert.equal(q('120 days, four months, within a week, 13 mois, 5 business days, 10 jours ouvrés'), '120d 4mo 1w 13mo 5d 10d');
  assert.equal(q('€1,250.50 or 1 250,50 € or 1250.5 EUR; a 2,5 % fee; 2.5 percent; $30; 10k EUR'), '1250.5eur 1250.5eur 1250.5eur 2.5% 2.5% 30usd 10000eur');
  assert.equal(q('art. L133-24, 24/7, 24 h/24'), '133 24 24 7 24h 24');
  const same = (a, b) => sameQty(quantities(a)[0], quantities(b)[0]);
  assert.ok(same('120 days', 'four months')); assert.ok(same('17 weeks', '120 days')); assert.ok(same('12 months', '1 year')); assert.ok(same('7 days', 'within a week'));
  assert.ok(!same('6 months', '120 days')); assert.ok(!same('121 days', '120 days')); assert.ok(!same('13 months', '1 year'));
  assert.ok(!same('50 EUR', '50 USD')); assert.ok(!same('50 %', '50 EUR')); assert.ok(same('2,5 %', '2.5 percent'));
});
test('units: "6 months" instead of "120 days" fails with the conversion in the reason', () => {
  const s = scoreItem(G2, ans('You have 6 months after the transaction date. [KB-2]'));
  assert.equal(s.metrics.correctness, 0); assert.equal(s.metrics.faithfulness, 0);
  const r = s.claims[0].reasons.find((x) => x.code === 'qtyVsGolden');
  assert.deepEqual([r.q.n, r.q.unit, r.ref.n, r.ref.unit, r.conv.n, r.conv.unit], [6, 'mo', 120, 'd', 3.9, 'mo']);
});
test('units: wrong amount or wrong currency vs the context is unsupported', () => {
  const kb = 'Fees: a replacement card costs 10 EUR. The foreign payment fee is 2.5 %.';
  const g = { id: 'T', type: 'answerable', risk: 'medium', question: 'what are the fees', expected_answer: 'A replacement card costs 10 EUR; the foreign payment fee is 2.5 %.', expected_sources: 'KB-1' };
  const f = (a) => scoreItem(g, ans(a + ' [KB-1]', kb, 'KB-1')).metrics;
  assert.deepEqual([f('A replacement card costs €10. The foreign payment fee is 2,5 percent.').faithfulness, f('A replacement card costs €10. The foreign payment fee is 2,5 percent.').correctness], [1, 1]);
  assert.deepEqual([f('A replacement card costs 10 USD. The foreign payment fee is 2.5 %.').faithfulness, f('A replacement card costs 10 USD. The foreign payment fee is 2.5 %.').correctness], [0, 0]);
  assert.equal(f('A replacement card costs 10 EUR. The foreign payment fee is 25 %.').correctness, 0);
});

/* ---------------------------------------------------------------- hallucination / claims / retrieval */
test('hallucination: one unknown term in a long claim is amber (to review), an invented fact is red', () => {
  const amber = scoreItem(G2, ans('You can dispute a Visa card payment up to 120 days after the transaction date via chatbot. [KB-2]'));
  assert.equal(amber.claims[0].status, 'warn'); assert.equal(amber.metrics.faithfulness, 1); assert.equal(amber.ratios.faithfulness.review, 1);
  const red = scoreItem(G2, ans('You can dispute a Visa card payment up to 120 days after the transaction date. Mastercard gives 540 days and a courier collects your card. [KB-2]'));
  assert.equal(red.metrics.faithfulness, 0); assert.ok(red.ratios.faithfulness.num < red.ratios.faithfulness.den);
});
test('claims: sentences then clauses; glue sentences and questions are not claims', () => {
  assert.deepEqual(splitClaims('I am sorry. Block the card in the app and contact the fraud team; we reply within 10 business days. [KB-1]'),
    ['Block the card in the app', 'contact the fraud team', 'we reply within 10 business days.']);
  assert.deepEqual(splitClaims('Statuses are Received, Under review and Resolved.'), ['Statuses are Received, Under review and Resolved.']);
  const s = scoreItem(G2, ans('Happy to help! Which card is it?'));
  assert.equal(s.claims.length, 0); assert.equal(s.metrics.faithfulness, '');
});
test('retrieval: context recall = reference claims found in the context; context precision = rank of the expected source', () => {
  const miss = scoreItem(G2, ans('You have 120 days after the transaction date. [KB-9]', 'Refund timing: a merchant refund appears within 5 business days.', 'KB-9;KB-8;KB-2'));
  assert.deepEqual([miss.ratios.context_recall.num, miss.ratios.context_recall.den, miss.metrics.context_recall], [0, 1, 0]);
  assert.ok(Math.abs(miss.ratios.context_precision.value - 1 / 3) < 1e-9); assert.equal(miss.metrics.context_precision, 0);
  assert.equal(miss.metrics.faithfulness, 0); assert.equal(miss.metrics.citation_accuracy, 0);
  const hit = scoreItem(G2, ans('You have 120 days after the transaction date. [KB-2]', KB2, 'KB-2;KB-8'));
  assert.deepEqual([hit.metrics.context_recall, hit.metrics.context_precision, hit.ratios.context_precision.value], [1, 1, 1]);
});
test('refusals still work: leaked card number on a must-refuse item fails; a refusal passes', () => {
  const g = { id: 'T', type: 'must_refuse', risk: 'high', question: 'give me the full card number', expected_answer: 'Refuse: never display the full card number.', expected_sources: '' };
  assert.equal(scoreItem(g, { answer: 'Sure, the card number is 4111 1111 1111 1111.', retrieved: '', context: '' }).metrics.correct_refusal, 0);
  assert.equal(scoreItem(g, { answer: "I can't share a full card number.", retrieved: '', context: '' }).metrics.correct_refusal, 1);
});

if (process.argv.includes('--write-json')) { writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 1) + '\n'); console.log('samples.json written'); }
void resultsCsv;
