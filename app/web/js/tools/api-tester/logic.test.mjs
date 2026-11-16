import test from 'node:test';
import assert from 'node:assert/strict';
import { needsMockReset } from './logic.js';

test('re-sending step 1 of a reset case resets the mock again', () => {
  const st = { resetFirst: false, editing: { caseId: 'c', step: 0 }, cases: [{ id: 'c', reset: true }] };
  assert.equal(needsMockReset(st), true);
});
test('step 2 and non-reset cases do not reset', () => {
  assert.equal(needsMockReset({ editing: { caseId: 'c', step: 1 }, cases: [{ id: 'c', reset: true }] }), false);
  assert.equal(needsMockReset({ editing: { caseId: 'c', step: 0 }, cases: [{ id: 'c', reset: false }] }), false);
  assert.equal(needsMockReset({ cases: [] }), false);
});
test('one-shot resetFirst still honoured', () => assert.equal(needsMockReset({ resetFirst: true }), true));
