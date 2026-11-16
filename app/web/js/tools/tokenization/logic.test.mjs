// cd app/web/js && node --test tools/tokenization/logic.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import * as K from './logic.js';
import { samples } from './samples.js';
import { CARDS, luhnValid } from './fixtures.js';
import base from './i18n.js';
import guide from './guide-i18n.js';

const yellow = samples.en.find((s) => s.id === 'yellow').state;
const run = (state, actions = []) => K.simulate({ ...state, actions });

test('samples load inputs only: no recorded actions, no autorun, Luhn-valid fixture cards', () => {
  for (const lang of ['en', 'fr']) for (const s of samples[lang]) {
    assert.deepEqual(s.state.actions, [], `${lang}/${s.id} has no pre-recorded actions`);
    assert.equal('autorun' in s, false, `${lang}/${s.id} has no autorun flag`);
    assert.equal(s.state.pan, '', `${lang}/${s.id} carries no free PAN`);
    const card = CARDS.find((c) => c.card_id === s.state.cardId);
    assert.ok(card && luhnValid(card.pan), `${lang}/${s.id} uses a Luhn-valid test card`);
  }
  assert.equal(K.tspOf(CARDS.find((c) => c.card_id === samples.en[0].state.cardId)), 'VTS');
  assert.equal(samples.en[0].state.wallet, 'apple_pay');
  assert.equal(K.tspOf(CARDS.find((c) => c.card_id === samples.fr[0].state.cardId)), 'CB');
});

test('regression (audit bug 1): the yellow-path sample stops at the code box and Verify code works', () => {
  for (const st of [yellow, samples.fr.find((s) => s.id === 'yellow').state]) {
    const r0 = run(st);
    assert.equal(r0.token.status, 'pending_idv');
    assert.equal(r0.allowed.idv.ok, true, 'Verify code is enabled right after Run flow');
    assert.equal(r0.allowed.pay.ok, false);
    const chs = K.chapters(r0);
    assert.equal(chs.length, 1);
    assert.equal(K.stepMove(chs, null, 'end').gate, 'otp', 'the flow waits for the code at the last message');
    assert.equal(K.stepMove(chs, null, 'first').gate, null, 'not before');
    const r1 = run(st, [{ op: 'idv', method: 'sms_otp', otp: '000000' }]);
    assert.equal(r1.token.status, 'pending_idv');
    assert.equal(r1.allowed.idv.ok, true, 'still enabled after a wrong code');
    assert.equal(r1.log[1].ok, false);
    assert.equal(K.stepMove(K.chapters(r1), null, 'end').gate, 'otp');
    const r2 = run(st, [{ op: 'idv', method: 'sms_otp', otp: '000000' }, { op: 'idv', method: 'sms_otp', otp: K.DEMO_OTP }]);
    assert.equal(r2.token.status, 'active');
    assert.equal(r2.token.decision, 'yellow');
    assert.equal(r2.allowed.idv.ok, false);
    assert.equal(r2.allowed.pay.ok, true);
    assert.equal(K.stepMove(K.chapters(r2), null, 'end').gate, null);
  }
  const r3 = run(yellow, [1, 2, 3].map(() => ({ op: 'idv', method: 'sms_otp', otp: '111111' })));
  assert.equal(r3.token.status, 'deleted', 'three wrong codes delete the token');
});

test('step engine: one message at a time, clamped, across chapters', () => {
  const r = run(yellow, [{ op: 'idv', otp: '000000' }, { op: 'idv', otp: '123456' }, { op: 'pay', amount: 12, channel: 'contactless' }]);
  const chs = K.chapters(r);
  assert.deepEqual(chs.map((c) => c.op), ['provision', 'idv', 'idv', 'pay']);
  const total = chs.reduce((t, c) => t + c.frames.length, 0);
  assert.equal(total, r.messages.length);
  let p = K.stepMove(chs, null, 'first');
  assert.deepEqual([p.c, p.n, p.index, p.total, p.atStart, p.atEnd], [0, 1, 1, total, true, false]);
  assert.deepEqual(K.stepMove(chs, p, 'back'), p, 'Back at the first message does nothing');
  const seen = [p.index];
  for (let i = 0; i < total + 3; i++) { p = K.stepMove(chs, p, 'next'); seen.push(p.index); }
  assert.deepEqual(seen.slice(0, total), Array.from({ length: total }, (_, i) => i + 1), 'Next reveals exactly one message');
  assert.equal(p.atEnd, true);
  assert.equal(p.index, total, 'Next at the end stays at the end');
  p = K.stepMove(chs, p, 'back');
  assert.equal(p.index, total - 1);
  p = K.stepMove(chs, { c: 1, n: 1 }, 'back');
  assert.deepEqual([p.c, p.n], [0, chs[0].frames.length], 'Back crosses to the end of the previous chapter');
  p = K.stepMove(chs, { c: 0, n: 2 }, 'all');
  assert.deepEqual([p.c, p.n, p.chapterEnd], [0, chs[0].frames.length, true]);
  assert.deepEqual([K.stepMove(chs, null, 'last').c, K.stepMove(chs, null, 'last').n], [3, 1]);
  p = K.stepMove(chs, { c: 99, n: 99 });
  assert.deepEqual([p.c, p.n], [3, chs[3].frames.length], 'out-of-range positions are clamped');
  p = K.stepMove(chs, null, { c: 2, n: -5 });
  assert.deepEqual([p.c, p.n], [2, 1]);
  assert.equal(K.stepMove([], null, 'next').frame, null);
});

test('step engine: path and token status are not shown before their message', () => {
  const chs = K.chapters(run(yellow));
  const at = chs[0].pathAt;
  assert.ok(at > 0);
  assert.equal(K.stepMove(chs, { c: 0, n: at }).pathShown, null, 'no path before the issuer decision');
  assert.equal(K.stepMove(chs, { c: 0, n: at + 1 }).pathShown, 'yellow');
  assert.equal(K.stepMove(chs, { c: 0, n: 1 }).status, null);
  assert.equal(K.stepMove(chs, null, 'end').status, 'pending_idv');
  const g = K.chapters(run(samples.en[0].state));
  assert.equal(K.stepMove(g, null, 'end').pathShown, 'green');
  assert.equal(K.stepMove(g, null, 'end').status, 'active');
  const red = run(samples.en.find((s) => s.id === 'red').state);
  assert.equal(K.stepMove(K.chapters(red), null, 'end').pathShown, 'red');
  assert.equal(red.world.tokens.length, 0);
  assert.equal(K.suggestNext(red), null);
});

test('diagram lanes: 4 lanes for provisioning, merchant lane only when paying', () => {
  const chs = K.chapters(run(samples.en[0].state, [{ op: 'pay' }]));
  assert.deepEqual(chs[0].lanes, ['device', 'requestor', 'tsp', 'issuer']);
  assert.deepEqual(chs[1].lanes, ['device', 'requestor', 'merchant', 'tsp', 'issuer']);
  for (const c of chs) for (const f of c.frames) assert.ok(c.lanes.includes(f.from) && c.lanes.includes(f.to));
});

test('payload fields: PAN always masked, merchant never gets it, cryptogram per payment', () => {
  const r = run(samples.en[0].state, [{ op: 'pay' }, { op: 'pay' }, { op: 'replay' }]);
  const pan = CARDS.find((c) => c.card_id === 'crd_hb_001').pan;
  assert.equal(JSON.stringify(r.messages.map((m) => m.fields)).includes(pan), false, 'no clear PAN in any payload');
  const byKey = (k, n = 0) => r.messages.filter((m) => m.text.k === k)[n].fields;
  const get = (fs, id) => fs.find((f) => f.id === id)?.value;
  assert.equal(get(byKey('msg.checkCard'), 'pan'), '400000******1018');
  assert.equal(get(byKey('msg.green'), 'decision'), '00');
  assert.equal(get(byKey('msg.sendToMerchant'), 'pan'), 'not_sent');
  assert.equal(get(byKey('msg.createToken'), 'par').length, 29);
  const c1 = get(byKey('msg.cryptogram', 0), 'tavv'), c2 = get(byKey('msg.cryptogram', 1), 'tavv');
  assert.ok(c1 && c2 && c1 !== c2, 'a new cryptogram for each payment');
  assert.equal(r.log[r.log.length - 1].rule, 'T18');
  assert.equal(K.fieldName('tokenRef', 'VTS'), 'vProvisionedTokenID');
  assert.equal(K.fieldName('tokenRef', 'MDES'), 'tokenUniqueReference');
  const y = run(yellow);
  assert.match(get(y.messages.find((m) => m.text.k === 'msg.yellow').fields, 'idvMethods'), /OTPSMS/);
});

test('MDES sample: no Visa wording, contactless refused by the domain (audit bug 6)', () => {
  const st = samples.en.find((s) => s.id === 'mdes').state;
  const r = run(st, [{ op: 'pay', amount: 25, channel: 'card_on_file' }, { op: 'pay', amount: 25, channel: 'contactless' }]);
  assert.equal(r.tsp, 'MDES');
  assert.equal(JSON.stringify(r.messages).includes('VTS'), false);
  assert.equal(r.log[r.log.length - 1].rule, 'T17');
  assert.equal(r.messages.find((m) => m.text.k === 'msg.green').fields[0].value, 'APPROVED');
});

test('lifecycle: pay, suspend, resume, card replaced (token stays, PAN updated), delete', () => {
  const st = samples.en.find((s) => s.id === 'story').state;
  const acts = [];
  const order = [];
  for (let i = 0; i < 6; i++) {
    const r = run(st, acts);
    const nx = K.suggestNext(r);
    order.push(nx);
    acts.push({ op: nx, amount: 12, channel: 'contactless' });
  }
  assert.deepEqual(order, ['pay', 'suspend', 'resume', 'renew', 'pay', 'delete']);
  const before = run(st, acts.slice(0, 3)), after = run(st, acts.slice(0, 4)), end = run(st, acts);
  assert.equal(after.token.token_number, before.token.token_number, 'token stays');
  assert.equal(after.token.par, before.token.par, 'PAR stays');
  assert.notEqual(after.token.pan_masked, before.token.pan_masked, 'PAN updated');
  assert.equal(after.token.status, 'active');
  assert.ok(luhnValid(after.world.cards.find((c) => c.card_id === after.token.card_id).pan));
  assert.equal(after.allowed.renew.ok, false, 'one replacement per card in the demo');
  assert.equal(end.payments.length, 2);
  assert.equal(end.payments[1].response_code, '00', 'payment works on the new PAN');
  assert.equal(end.token.status, 'deleted');
  assert.equal(K.suggestNext(end), null);
  assert.equal(run(st, [...acts, { op: 'pay' }]).log.pop().ok, false, 'deleted is final');
});

test('stolen card: block suspends the token, card replaced restores it; one API row per real call (audit bug 5)', () => {
  const st = samples.en.find((s) => s.id === 'story').state;
  const r1 = run(st, [{ op: 'pay' }, { op: 'block', reason: 'stolen' }]);
  assert.equal(r1.token.status, 'suspended');
  assert.equal(K.suggestNext(r1), 'replace');
  assert.equal(run(st, [{ op: 'pay' }, { op: 'block', reason: 'stolen' }, { op: 'pay' }]).log.pop().rule, 'T16');
  const r2 = run(st, [{ op: 'pay' }, { op: 'block', reason: 'stolen' }, { op: 'replace' }]);
  assert.equal(r2.token.status, 'active');
  assert.equal(r2.token.token_number, r1.token.token_number);
  const rows = r2.log.filter((l) => l.i === 3);
  assert.deepEqual(rows.map((l) => l.op.op), ['replace', 'pan_update']);
  assert.equal(rows[0].api, null);
  assert.match(rows[1].api.path, /\/resume$/);
  assert.equal(K.chapters(r2).length, 4, 'one chapter per action');
});

test('every message has a caption and every payload field a label, in EN and FR', () => {
  for (const lang of ['en', 'fr']) {
    const all = { ...base[lang], ...guide[lang] };
    for (const k of Object.keys(base.en).filter((x) => x.startsWith('msg.')).concat('msg.reissue')) {
      assert.ok(all[k], `${lang} ${k}`);
      assert.ok(all[k.replace('msg.', 'cap.')], `${lang} caption for ${k}`);
    }
    const states = [yellow, samples.en[0].state, samples.en[2].state, samples.fr[0].state];
    const acts = [{ op: 'idv', otp: '1' }, { op: 'idv', otp: '123456' }, { op: 'pay' }, { op: 'replay' }, { op: 'suspend' }, { op: 'resume' }, { op: 'renew' }, { op: 'block' }, { op: 'replace' }, { op: 'delete' }];
    for (const st of states) for (const m of run(st, acts).messages) for (const f of m.fields) assert.ok(all['pf.' + f.id], `${lang} label for field ${f.id}`);
    for (const op of ['provision', 'idv', 'pay', 'replay', 'suspend', 'resume', 'delete', 'block', 'replace', 'renew', 'pan_update']) assert.ok(all['op.' + op], `${lang} op.${op}`);
  }
});
