import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDraft, emptyState, parseMetric, check, traceMatrix } from './logic.js';

test('leading digits survive Build draft (3DS, 24/7), list markers are stripped', () => {
  const s = buildDraft({ ...emptyState('en'), users: 'Cardholders', goalMetric: '3DS challenge rate: 12% → 8%', scope: '3DS data is attached to the dispute\n24/7 intake of dispute requests\n1. Real numbered\n- dash item' });
  assert.deepEqual(s.reqs.map((r) => r.text), ['3DS data is attached to the dispute', '24/7 intake of dispute requests', 'Real numbered', 'dash item']);
  assert.equal(s.goals[0].text, '3DS challenge rate');
  assert.equal(s.metrics[0].baseline, '12%');
});

test('metric names split at the colon, not at "de" / "from" inside the name', () => {
  assert.deepEqual(parseMetric("Taux de blocage dans l'appli: 38 % → 70 %"), { name: "Taux de blocage dans l'appli", baseline: '38 %', target: '70 %' });
  assert.deepEqual(parseMetric('Share of calls from customers: 38% → 70%'), { name: 'Share of calls from customers', baseline: '38%', target: '70%' });
  assert.deepEqual(parseMetric('Dispute rate from 4% to 2%'), { name: 'Dispute rate', baseline: '4%', target: '2%' });
  assert.deepEqual(parseMetric('Taux de blocage de 38 % à 70 %'), { name: 'Taux de blocage', baseline: '38 %', target: '70 %' });
  assert.deepEqual(parseMetric('NPS'), { name: 'NPS', baseline: '', target: '' });
});

test('with several goals, requirements are not silently traced to G1', () => {
  const s = buildDraft({ ...emptyState('en'), users: 'X', goalMetric: 'A: 1 → 2\nB: 3 → 4\nC: 5 → 6', scope: 'one\ntwo' });
  assert.ok(s.reqs.every((r) => r.goal === ''));
  const one = buildDraft({ ...emptyState('en'), users: 'X', goalMetric: 'A: 1 → 2', scope: 'one' });
  assert.equal(one.reqs[0].goal, 'G1');
});
