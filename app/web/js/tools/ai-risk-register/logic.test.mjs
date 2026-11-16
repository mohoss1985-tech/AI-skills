/* cd app/web/js && node --test tools/ai-risk-register/logic.test.mjs
   (node tools/ai-risk-register/logic.test.mjs --write-json also regenerates samples.json) */
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { QUESTIONS, LEGAL, classify, visibleQuestions, derogationOpen, obligations, keyDates, addUnique,
  registerChecks, heat, score, level, registerCsv, risksFromCsv, nextRid } from './logic.js';
import { SAMPLES, STARTER } from './samples.js';
import strings from './i18n.js';

const ALL = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'hA', 'h1', 'h2', 'h3', 'h4', 'h5', 'h8', 't1', 't2', 't3', 't4'];
const base = (over = {}) => ({ ...Object.fromEntries(ALL.map((id) => [id, 'no'])), ...over });
const gates = (c) => c.path.map((p) => `${p.gate}:${p.outcome}`);

/* ------------------------------------------------------------------ regression: audit-4 bugs */
test('bug 1 · credit scoring + fraud purpose is HIGH-RISK, never minimal (Annex III 5(b))', () => {
  const c = classify(base({ h1: 'yes', h2: 'yes' }));
  assert.equal(c.tier, 'high');
  assert.equal(c.carveOut, false);
  assert.ok(c.reasons.some((r) => r.key === 'r_h1_fraud'));
  assert.ok(gates(c).includes('fraud:no_exception'));
  assert.equal(classify({ h1: 'yes', h2: 'yes' }).atLeast, 'high');           // even with the rest unanswered it is never below high
  assert.notEqual(classify({ h1: 'yes', h2: 'yes' }).tier, 'minimal');
});
test('bug 1b · the fraud exception applies only to a system that does not score credit', () => {
  const c = classify(base({ h1: 'no', h2: 'yes' }));
  assert.equal(c.tier, 'minimal'); assert.equal(c.carveOut, true); assert.equal(c.status, 'final');
  assert.ok(obligations(c, 'both').some((o) => o.id === 'carve'));
  const u = classify(base({ h1: 'unsure', h2: 'yes' }));                         // unsure on credit scoring: not cleared
  assert.equal(u.carveOut, false); assert.equal(u.worstCase, 'high'); assert.equal(u.status, 'provisional');
  assert.deepEqual(u.confirm.map((x) => [x.id, x.why]), [['h1', 'c_h1_fraud']]);
});
test('bug 2 · Art. 6(3) derogation is never granted when profiling is yes, unsure or unanswered', () => {
  const hit = { h4: 'yes', h6: 'yes' };
  const blank = classify(base(hit));
  assert.equal(blank.tier, 'high'); assert.equal(blank.derogation, false); assert.equal(blank.derogationState, 'not_assessed');
  assert.deepEqual(blank.open, ['h7']);
  assert.equal(classify(base({ ...hit, h7: 'yes' })).derogationState, 'denied_profiling');
  assert.equal(classify(base({ ...hit, h7: 'yes' })).tier, 'high');
  const uns = classify(base({ ...hit, h7: 'unsure' }));
  assert.equal(uns.tier, 'high'); assert.equal(uns.derogation, false); assert.ok(uns.confirm.some((x) => x.id === 'h7'));
  // conditions: an explicit "yes" is needed too
  assert.equal(classify(base({ h4: 'yes', h7: 'no' })).tier, 'high');
  assert.equal(classify(base({ h4: 'yes', h7: 'no', h6: 'unsure' })).tier, 'high');
  assert.equal(classify(base({ h4: 'yes', h7: 'no', h6: 'no' })).derogationState, 'denied_conditions');
});
test('bug 2b · credit scoring (5(b)) is never offered the derogation, whatever the answers', () => {
  const c = classify(base({ h1: 'yes', h6: 'yes', h7: 'no' }));
  assert.equal(c.tier, 'high'); assert.equal(c.derogationState, 'excluded_credit');
  assert.equal(derogationOpen({ h1: 'yes' }), false);
  assert.ok(!visibleQuestions({ h1: 'yes' }).includes('h7'));
  assert.equal(classify(base({ h1: 'yes', h4: 'yes', h6: 'yes', h7: 'no' })).tier, 'high');
  assert.equal(classify(base({ hA: 'yes', h4: 'yes', h6: 'yes', h7: 'no' })).tier, 'high');   // Annex I has no derogation
});
test('bug 3 · an empty or partial wizard is INCOMPLETE, never minimal', () => {
  for (const a of [undefined, null, {}, { p1: 'no' }, { junk: 'yes' }, { p1: 'maybe' }]) {
    const c = classify(a);
    assert.equal(c.tier, 'incomplete'); assert.equal(c.status, 'incomplete');
  }
  assert.equal(classify({}).open.length, 16);                                   // h2 is optional, h6 / h7 not asked yet
  assert.deepEqual(obligations(classify({}), 'both'), []);
  // minimal needs every relevant question answered: removing any single one makes it incomplete
  for (const id of ALL.filter((x) => x !== 'h2')) {
    const a = base(); delete a[id];
    assert.equal(classify(a).tier, 'incomplete', id);
  }
  const noH2 = base(); delete noH2.h2;
  assert.equal(classify(noH2).tier, 'minimal');
  assert.equal(classify(base({ t1: 'yes', hA: '' })).tier, 'incomplete');       // gate 2 undecided above an Art. 50 hit
  assert.equal(classify(base({ t1: 'yes', hA: '' })).atLeast, 'limited');
});
test('bug 4 · high-risk keeps the Art. 50 duties (tiers are cumulative)', () => {
  const c = classify(base({ h1: 'yes', t1: 'yes', t2: 'yes' }));
  assert.equal(c.tier, 'high'); assert.deepEqual(c.transparency, ['t1', 't2']);
  const ids = obligations(c, 'both').map((o) => o.id);
  for (const id of ['p_req', 'd_use', 'd_fria', 't1', 't2']) assert.ok(ids.includes(id), id);
  assert.deepEqual(keyDates(c, '2026-11-16').map((d) => d.key), ['annex3', 'transparency', 'marking']);
});
test('bug 5 · dates follow Regulation (EU) 2026/1744 (Digital Omnibus on AI)', () => {
  assert.equal(LEGAL.dates.annex3.iso, '2027-12-02'); assert.equal(LEGAL.dates.annex1.iso, '2028-08-02');
  assert.equal(LEGAL.dates.prohibitions.iso, '2025-02-02'); assert.equal(LEGAL.dates.newProhibitions.iso, '2026-12-02');
  assert.equal(LEGAL.dates.transparency.iso, '2026-08-02'); assert.equal(LEGAL.dates.marking.iso, '2026-12-02');
  const d = keyDates(classify(base({ h1: 'yes' })), '2026-11-16');
  assert.deepEqual(d.map((x) => [x.key, x.applies]), [['annex3', false]]);
  assert.equal(keyDates(classify(base({ hA: 'yes' })), '2026-11-16')[0].key, 'annex1');
  assert.deepEqual(keyDates(classify(base({ t1: 'yes' })), '2026-11-16').map((x) => [x.key, x.applies]), [['transparency', true]]);
  for (const l of ['en', 'fr']) {
    const all = Object.values(strings[l]).join(' ');
    assert.ok(!/postponement has been proposed|report est proposé/.test(all));
    assert.ok(/2026\/1744/.test(strings[l].legalBasis));
    assert.ok(/not legal advice|pas un avis juridique/.test(strings[l].disclaimer));
    assert.ok(/counsel|conseil/.test(strings[l].disclaimer));
  }
});
test('bug 6 · other Annex III areas and Annex I products are asked', () => {
  assert.equal(classify(base({ h8: 'yes', h7: 'yes' })).tier, 'high');
  const a1 = classify(base({ hA: 'yes' }));
  assert.equal(a1.tier, 'high'); assert.equal(a1.annex1, true); assert.equal(a1.derogationState, 'na');
  assert.equal(obligations(a1, 'provider')[0].date, 'annex1');
});
test('bug 7 · obligations depend on the role; FRIA for 5(b) and 5(c) only', () => {
  const credit = classify(base({ h1: 'yes' })), ins = classify(base({ h3: 'yes', h7: 'yes' })), hr = classify(base({ h4: 'yes', h7: 'yes' }));
  assert.ok(obligations(credit, 'deployer').every((o) => o.who !== 'provider'));
  assert.ok(obligations(credit, 'provider').every((o) => o.who !== 'deployer'));
  assert.ok(obligations(credit, 'deployer').some((o) => o.id === 'd_fria'));
  assert.ok(obligations(ins, 'deployer').some((o) => o.id === 'd_fria'));
  assert.ok(!obligations(hr, 'deployer').some((o) => o.id === 'd_fria'));
  assert.ok(obligations(credit, '').some((o) => o.who === 'provider') && obligations(credit, '').some((o) => o.who === 'deployer'));
});
test('bug 9 · starter risks are not duplicated on a second press', () => {
  const one = addUnique([], STARTER.en); const two = addUnique(one.risks, STARTER.en);
  assert.equal(one.added, 9); assert.equal(two.added, 0); assert.equal(two.risks.length, 9);
  assert.deepEqual(one.risks.map((r) => r.id).slice(0, 2), ['R-01', 'R-02']);
});
test('bug 11 · Art. 6(3) questions are shown only after an Annex III hit', () => {
  assert.ok(!visibleQuestions({}).includes('h6') && !visibleQuestions({}).includes('h7'));
  assert.ok(visibleQuestions({ h4: 'yes' }).includes('h7') && visibleQuestions({ h4: 'yes' }).includes('h6'));
  assert.ok(!visibleQuestions({ h4: 'unsure' }).includes('h7'));
  assert.ok(!classify(base()).open.includes('h7'));
});

/* ------------------------------------------------------------------ one test per tier path */
test('path · prohibited (Art. 5) stops the tree', () => {
  const c = classify({ p3: 'yes', h1: 'yes' });
  assert.equal(c.tier, 'prohibited'); assert.deepEqual(gates(c), ['art5:hit', 'result:prohibited']); assert.deepEqual(c.open, []);
  assert.deepEqual(obligations(c, 'deployer').map((o) => o.id), ['stop']);
  assert.deepEqual(keyDates(c, '2026-11-16').map((d) => [d.key, d.applies]), [['prohibitions', true]]);
  const n = classify({ p6: 'yes' });                                            // new prohibition, applies from 2 Dec 2026
  assert.equal(n.tier, 'prohibited'); assert.deepEqual(keyDates(n, '2026-11-16').map((d) => [d.key, d.applies]), [['newProhibitions', false]]);
  assert.equal(keyDates(n, '2026-12-02')[0].applies, true);
});
test('path · high-risk via Annex III', () => {
  const c = classify(base({ h1: 'yes' }));
  assert.equal(c.tier, 'high'); assert.equal(c.status, 'final'); assert.equal(c.fria, true);
  assert.deepEqual(gates(c), ['art5:clear', 'annex3:hit', 'art63:excluded_credit', 'art50:clear', 'result:high']);
});
test('path · high-risk via Annex I', () => {
  assert.deepEqual(gates(classify(base({ hA: 'yes' }))), ['art5:clear', 'annex1:hit', 'art50:clear', 'result:high']);
});
test('path · Art. 6(3) derogation granted (explicit no profiling + explicit condition) → not high-risk', () => {
  const c = classify(base({ h4: 'yes', h7: 'no', h6: 'yes' }));
  assert.equal(c.tier, 'minimal'); assert.equal(c.derogation, true); assert.equal(c.status, 'final');
  assert.ok(gates(c).includes('art63:granted'));
  assert.ok(obligations(c, 'provider').some((o) => o.id === 'p_derog' && o.ref === 'Art. 6(4), Art. 49(2)'));
  assert.equal(classify(base({ h4: 'yes', h7: 'no', h6: 'yes', t1: 'yes' })).tier, 'limited');
});
test('path · transparency (Art. 50)', () => {
  const c = classify(base({ t1: 'yes', t2: 'yes' }));
  assert.equal(c.tier, 'limited'); assert.equal(c.status, 'final');
  assert.deepEqual(gates(c), ['art5:clear', 'annex3:clear', 'art50:hit', 'result:limited']);
  assert.deepEqual(obligations(c, 'provider').map((o) => o.id), ['t1', 't2', 'literacy', 'other']);
  assert.deepEqual(obligations(classify(base({ t3: 'yes', t4: 'yes' })), 'deployer').map((o) => o.id), ['t3', 't4', 'literacy', 'other']);
});
test('path · minimal only when everything relevant is answered "no"', () => {
  const c = classify(base());
  assert.equal(c.tier, 'minimal'); assert.equal(c.status, 'final'); assert.equal(c.worstCase, null);
  assert.deepEqual(gates(c), ['art5:clear', 'annex3:clear', 'art50:clear', 'result:minimal']);
  assert.deepEqual(obligations(c, 'both').map((o) => o.id), ['literacy', 'other']);
});
test('path · incomplete', () => {
  const c = classify({ p1: 'no', p2: 'no' });
  assert.equal(c.tier, 'incomplete'); assert.deepEqual(gates(c), ['art5:open', 'annex3:open', 'art50:open', 'result:incomplete']);
});
test('"unsure" never clears a gate silently: provisional + worst case', () => {
  const p = classify(base({ p2: 'unsure' }));
  assert.equal(p.tier, 'minimal'); assert.equal(p.status, 'provisional'); assert.equal(p.worstCase, 'prohibited');
  assert.deepEqual(p.confirm.map((x) => x.id), ['p2']);
  assert.equal(classify(base({ h3: 'unsure' })).worstCase, 'high');
  assert.equal(classify(base({ t2: 'unsure' })).worstCase, 'limited');
  assert.equal(classify(base({ h1: 'yes', t2: 'unsure' })).worstCase, null);
});
test('every reason / confirm / path / obligation / date key has EN and FR text', () => {
  const combos = [{}, base(), base({ p1: 'yes', p6: 'yes' }), ...ALL.map((id) => base({ [id]: 'yes' })), ...ALL.map((id) => base({ [id]: 'unsure' })), base({ h1: 'yes', h2: 'yes' }), base({ h1: 'unsure', h2: 'yes' }), base({ h1: 'no', h2: 'unsure' }),
    ...['yes', 'no', 'unsure', ''].flatMap((h7) => ['yes', 'no', 'unsure', ''].map((h6) => base({ h5: 'yes', h7, h6 })))];
  for (const a of combos) {
    const c = classify(a);
    const keys = [...c.reasons.map((r) => r.key), ...c.confirm.map((r) => r.why), ...c.path.filter((p) => p.gate !== 'result').map((p) => `path_${p.gate}_${p.outcome}`),
      'tier_' + c.tier, 'tierSub_' + c.tier, 'rs_' + c.status, ...obligations(c, '').flatMap((o) => ['ob_' + o.id, 'who_' + o.who]), ...keyDates(c).map((d) => 'd_' + d.key)];
    for (const k of keys) for (const l of ['en', 'fr']) assert.ok(strings[l][k], `${l}.${k}`);
  }
  for (const q of QUESTIONS) for (const l of ['en', 'fr']) assert.ok(strings[l]['q_' + q.id], `${l}.q_${q.id}`);
  assert.deepEqual(Object.keys(strings.en).sort(), Object.keys(strings.fr).sort());
});

/* ------------------------------------------------------------------ samples + register */
test('samples: inputs only, three tiers shown, EN opens on credit scoring, FR on fraud detection', () => {
  const tiers = (l) => SAMPLES[l].map((s) => classify(s.state.answers).tier);
  assert.deepEqual(tiers('en'), ['high', 'minimal', 'limited', 'limited']);
  assert.deepEqual(tiers('fr'), ['minimal', 'high', 'limited', 'limited']);
  assert.equal(SAMPLES.en[0].id, 'credit-limit'); assert.equal(SAMPLES.fr[0].id, 'scoring-fraude');
  assert.equal(classify(SAMPLES.fr[0].state.answers).carveOut, true);
  for (const l of ['en', 'fr']) for (const s of SAMPLES[l]) {
    const c = classify(s.state.answers);
    assert.equal(c.status, 'final', s.id); assert.deepEqual(c.open, [], s.id);
    assert.ok(!('_classified' in s.state) && !s.autorun, s.id);                 // the presenter presses the button
    assert.ok(s.state.risks.length >= 6, s.id);
    assert.ok(!/\b\d{13,19}\b/.test(JSON.stringify(s)), 'no full PAN');
  }
});
test('register: score, checks, heat, CSV', () => {
  assert.equal(level(score({ likelihood: 4, impact: 5 })), 'high'); assert.equal(level(8), 'medium'); assert.equal(level(6), 'low');
  const fraud = SAMPLES.en[1].state.risks;
  assert.deepEqual(registerChecks(fraud).map((c) => [c.key, c.ids.join()]), [['chkHighCtl', 'R-02'], ['chkHighTest', 'R-01,R-02']]);
  assert.deepEqual(heat(fraud)[4][3], ['R-01']);
  assert.deepEqual(registerChecks(SAMPLES.en[0].state.risks).map((c) => [c.key, c.ids.join()]), [['chkHighCtl', 'R-03'], ['chkHighTest', 'R-03']]);
  const triage = SAMPLES.en[3].state.risks;
  assert.ok(registerCsv(triage).split('\r\n')[3].startsWith('R-03,'));
  const added = risksFromCsv('risk,likelihood,impact,nist\n"Leaks, PAN",9,2,measure', triage);
  assert.equal(added.at(-1).id, 'R-07'); assert.equal(added.at(-1).likelihood, 5); assert.equal(added.at(-1).nist, 'Measure');
  assert.equal(nextRid([]), 'R-01');
});

if (process.argv.includes('--write-json')) writeFileSync(new URL('./samples.json', import.meta.url), JSON.stringify(SAMPLES, null, 2) + '\n');
