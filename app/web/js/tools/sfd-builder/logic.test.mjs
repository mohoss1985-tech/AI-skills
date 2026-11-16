import test from 'node:test';
import assert from 'node:assert/strict';
import { rulesCsv, buildTables, emptyState } from './logic.js';
import SAMPLES from './samples.js';
import { sfdRulesFromCsv } from '../uat-tracker/csv.js';
import { casesFromCsv, casesFromSfdCsv, compute } from '../uat-tracker/logic.js';
import { testsFromSfdCsv, testsFromList, validate, toSpec } from '../xray-builder/logic.js';

const T = (k, v = {}) => `${k}${v.ex ? ':' + v.ex : ''}${v.rule ? ':' + v.rule : ''}`;
const csv = () => rulesCsv(SAMPLES.en[0], T);

test('the SFD rules CSV is read back by sfdRulesFromCsv (same ids, text, examples, stories)', () => {
  const st = SAMPLES.en[0];
  const { rules, error } = sfdRulesFromCsv(csv());
  assert.ok(!error);
  assert.equal(rules.length, st.rules.length);
  assert.deepEqual(rules.map((r) => r.id), st.rules.map((r) => r.id));
  assert.equal(rules[0].text, st.rules[0].text);
  assert.equal(rules[2].example, st.rules[2].example);
});

test('UAT tracker imports the SFD rules CSV: one not-run case per rule, requirement = rule id, expected = example', () => {
  const st = SAMPLES.en[0];
  const { cases, error, fromSfd } = casesFromCsv(csv()); // plain runs paste recognises it too
  assert.ok(!error && fromSfd);
  assert.equal(cases.length, st.rules.length);
  assert.ok(cases.every((c) => c.status === 'notrun'));
  assert.equal(cases[0].req, st.rules[0].id);
  assert.equal(cases[0].expected, st.rules[0].example);
  const more = casesFromSfdCsv(csv(), cases).cases;
  assert.equal(more[0].id, `UAT-${String(cases.length + 1).padStart(2, '0')}`);
  const r = compute({ planned: cases.length, days: 10, day: 1, cases, defects: [], criteria: { reqCovered: true } });
  assert.equal(r.requirements.notCovered.length, st.rules.length); // honest: nothing run yet
});

test('Xray builder imports the SFD rules CSV: one manual test per rule, rule id as label, valid steps', () => {
  const st = SAMPLES.en[0];
  const tests = testsFromSfdCsv(csv(), { prefix: 'CARD-T' });
  assert.equal(tests.length, st.rules.length);
  assert.equal(tests[0].id, 'CARD-T01');
  assert.equal(tests[0].labels, st.rules[0].id);
  assert.ok(tests.every((t) => t.type === 'manual' && t.steps.length === 1 && t.steps[0].result));
  const spec = toSpec({ project: 'CARD', target: 'cloud', tests, features: {}, background: {}, execution: {} });
  assert.ok(!validate(spec, 'cloud').some((i) => i.level === 'error'));
  assert.deepEqual(testsFromSfdCsv('Test ID,Summary\nA,b', {}), []);
});

test('SFD parser: "1." list numbers are stripped, a number inside the text is kept', () => {
  const s = buildTables({ ...emptyState('en'), feature: 'F', rulesText: '1. The merchant is contacted first\n3 documents max per dispute' });
  assert.deepEqual(s.rules.map((r) => r.text), ['The merchant is contacted first', '3 documents max per dispute']);
});
