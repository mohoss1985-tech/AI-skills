import test from 'node:test';
import assert from 'node:assert/strict';
import { simulate, defaults, addDays } from './logic.js';

const base = { ...defaults(), event: 'chargeback', reason: '13.1', amount: 250, expectedDelivery: '' };

test('an open chargeback is lost by default when the window is missed', () => {
  const open = simulate({ ...base, actions: [] });
  assert.equal(open.dispute.status, 'chargeback');
  const late = simulate({ ...base, actions: [{ op: 'advance', days: 30 }, { op: 'advance', days: 30 }] });
  assert.equal(late.dispute.status, 'merchant_accepted');
  assert.equal(late.liability.party, 'merchant');
  assert.ok(late.log.some((l) => l.op.op === 'expire' && l.rule === 'D12'));
  assert.equal(late.allowed.represent.ok, false);
});
test('on time: no expiry', () => {
  const r = simulate({ ...base, actions: [{ op: 'advance', days: 5 }] });
  assert.equal(r.dispute.status, 'chargeback');
});
test('money tiles carry the real flows next to a zero net', () => {
  const r = simulate({ ...base, actions: [] });
  assert.equal(r.positions.merchant, 0);
  assert.equal(r.flows.merchant.in, 25000);
  assert.equal(r.flows.merchant.out, 25000);
  assert.equal(r.flows.cardholder.in, 25000);
});
