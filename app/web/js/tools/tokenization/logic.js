/* Tokenization simulator: pure logic, no DOM (owner K). Runs in the browser and under node for tests.

   Rules T1–T18 come from research/demo-api/tokens-and-disputes-openapi.yaml; B3 (card block suspends tokens)
   from harbor-bank-openapi.yaml. The simulation is a deterministic replay: simulate(input) starts from the
   fixtures and replays input.actions (provision, idv, pay, replay, suspend, resume, delete, block, replace),
   so a saved state always gives the same result.

   ADAPTER NOTE: builder C will serve the same endpoints from app/web/js/mock/ (shared ES module). Until it
   exists, this file IS the engine. `apiCall(action)` below gives the HTTP request each action maps to, so the
   switch to C's mock is a change in one place (see research/wave1-K.md, "Switching to C's mock").

   Every number produced here is a DEMO value: tokens in the fictional 400099 range, PAR with the fictional
   BIN controller Z999, cryptograms prefixed FAKE and made from a plain hash (no key, no algorithm). */
import { CARDS, MOCK_TODAY, TOKEN_NUMBERS, TOKEN_REQUESTORS, TSP, findCard, findCardByPan, luhnValid, maskPan, replacementOf } from './fixtures.js';

export const ACTORS = ['cardholder', 'wallet', 'tsp', 'issuer', 'device', 'merchant'];
export const STEPS = ['request', 'tsp', 'decision', 'idv', 'token', 'pay', 'lifecycle'];
export const DEMO_OTP = '123456';
export const WALLETS = ['apple_pay', 'google_pay', 'merchant_card_on_file'];
export const DEVICES = ['iphone', 'watch', 'android', 'browser'];
export const RISKS = ['low', 'medium', 'high'];
export const CHANNELS = ['contactless', 'in_app', 'web', 'card_on_file'];
export const IDV_METHODS = ['sms_otp', 'issuer_app', 'call_centre'];

const m = (k, p = {}) => ({ k, p });
const pad = (n, w) => String(n).padStart(w, '0');
const clone = (o) => JSON.parse(JSON.stringify(o));

/** FNV-1a 32-bit, used twice to build 16 hex chars. Not cryptography: a stable, random-looking demo string. */
function fnv(str, seed = 0x811c9dc5) {
  let h = seed >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
export function demoCryptogram(tokenRef, atc, amountMinor) {
  const s = `${tokenRef}|${atc}|${amountMinor}`;
  return 'FAKE' + pad(fnv(s).toString(16), 8) + pad(fnv(s, 0x9747b28c).toString(16), 8);
}
/** 29 characters: Z999 (fictional BIN controller ID) + FAKEPAR + 18 digits. Same PAR for a card and its replacement. */
export function demoPar(card) {
  const root = (card.replaces || card.card_id).replace(/\D/g, '');
  const bank = card.bank === 'bl' ? '2' : '1';
  return 'Z999FAKEPAR' + pad(bank + root, 18);
}

export const deviceType = (d) => ({ iphone: 'phone', watch: 'watch', android: 'phone', browser: 'browser' }[d] || 'phone');
const deviceId = (d) => `dev_${d}_demo_01`;
/** Token domain restriction controls: where this token may be used (research/09 §1). */
export function domainFor(wallet, device) {
  if (wallet === 'merchant_card_on_file') return { channels: ['card_on_file', 'web'], device_bound: false };
  if (device === 'watch') return { channels: ['contactless', 'in_app'], device_bound: true };
  if (device === 'browser') return { channels: ['web'], device_bound: true };
  return { channels: ['contactless', 'in_app', 'web'], device_bound: true };
}
export const tspOf = (card) => TSP[card?.network] || 'VTS';
export const eciFor = (channel) => (channel === 'contactless' ? null : channel === 'card_on_file' ? '07' : '05');

/** Expected provisioning path for a card at low risk (shown in the card picker). */
export function expectedPath(card) {
  if (!card) return 'red';
  if (card.status === 'blocked' || card.status === 'expired' || card.fraud_watch) return 'red';
  return 'green';
}

export function defaults() {
  return {
    cardId: 'crd_hb_001', pan: '', wallet: 'apple_pay', device: 'iphone', trid: '40010030273',
    deviceRisk: 'low', accountAgeDays: 400, idvMethod: 'sms_otp', channel: 'in_app', amount: 42.5, merchant: 'M-001',
    actions: [],
  };
}
/** Advanced fields that differ from the defaults (for "Advanced · n set"). */
export function advancedSet(s) {
  const d = defaults();
  return ['pan', 'deviceRisk', 'accountAgeDays', 'idvMethod', 'channel', 'amount', 'merchant'].filter((k) => s[k] !== undefined && String(s[k]) !== String(d[k])).length;
}

function newWorld() {
  return { cards: clone(CARDS), tokens: [], payments: [], seq: { hb: 0, bl: 0, pay: 0, num: 0 }, clock: 0, usedCryptograms: [] };
}
const now = (w) => { const t = new Date(Date.UTC(2026, 10, 8, 10, 0, 0) + w.clock * 60000); w.clock += 2; return t.toISOString().replace('.000', ''); };

function cardOf(w, id) { return w.cards.find((c) => c.card_id === id); }

/** Replays the inputs + actions. Returns {world, log, messages, step, token, views, problems}. */
export function simulate(input) {
  const s = { ...defaults(), ...input };
  const w = newWorld();
  const log = [];      // one entry per action: {op, ok, rule, title, detail, status, api}
  const messages = []; // sequence-diagram arrows: {from, to, text, step, kind, op: index}
  let step = 'request';
  let main = null;     // the token the screen follows (the last one provisioned)

  const say = (from, to, text, st, kind = 'ok', i) => { messages.push({ from, to, text, step: st, kind, op: i }); step = st; };
  const done = (i, op, ok, status, title, detail = null, rule = null) => log.push({ i, op, ok, status, title, detail, rule, at: now(w), api: apiCall(op, s, main) });

  const actions = [{ op: 'provision' }, ...(s.actions || [])];
  actions.forEach((a, i) => {
    const op = a.op;
    if (op === 'provision') return provision(i, a);
    if (!main) return done(i, a, false, 404, m('err.noToken'), null, null);
    ({ idv, pay, replay, suspend, resume, remove, block, replace }[op === 'delete' ? 'remove' : op] || (() => done(i, a, false, 400, m('err.unknownOp', { op }))))(i, a);
  });

  function provision(i, a) {
    const pan = (s.pan || '').replace(/\s/g, '');
    const card = pan ? findCardByPan(pan) && cardOf(w, findCardByPan(pan).card_id) : cardOf(w, s.cardId);
    const tsp = tspOf(card);
    say('cardholder', 'wallet', m('msg.addCard', { wallet: s.wallet }), 'request', 'ok', i);
    say('wallet', 'tsp', m('msg.provisionReq', { tsp }), 'request', 'ok', i);
    // T1: unknown PAN (same safety rule as A1)
    if (!card) {
      say('tsp', 'wallet', m('msg.unknownPan'), 'tsp', 'bad', i);
      return done(i, a, false, 422, m('res.t1'), m('det.t1', { luhn: luhnValid(pan) ? 'yes' : 'no' }), 'T1');
    }
    // T2: token requestor
    const tr = TOKEN_REQUESTORS.find((t) => t.trid === s.trid);
    if (!tr) {
      say('tsp', 'wallet', m('msg.unknownTrid', { trid: s.trid }), 'tsp', 'bad', i);
      return done(i, a, false, 422, m('res.t2'), m('det.t2', { trid: s.trid }), 'T2');
    }
    say('tsp', 'tsp', m('msg.tspChecks', { tsp }), 'tsp', 'ok', i);
    say('tsp', 'issuer', m('msg.checkCard'), 'tsp', 'ok', i);
    const base = { card_id: card.card_id, pan_masked: maskPan(card.pan), wallet: s.wallet, token_requestor_id: s.trid, device: s.device, device_id: deviceId(s.device), tsp, demo_only: true };
    // T3: blocked / expired / fraud watch → red
    const red3 = card.status === 'blocked' ? `card_blocked_${card.block_reason || 'stolen'}` : card.status === 'expired' || card.expiry < MOCK_TODAY.slice(0, 7) ? 'card_expired' : card.fraud_watch ? 'fraud_watch' : card.status === 'ordered' ? 'card_not_active' : null;
    if (red3) return red(i, a, base, red3, 'T3');
    // T4: one live token per card and device
    if (w.tokens.some((t) => t.card_id === card.card_id && t.device_id === base.device_id && ['active', 'pending_idv', 'suspended'].includes(t.status))) {
      say('tsp', 'wallet', m('msg.exists'), 'decision', 'bad', i);
      return done(i, a, false, 409, m('res.t4'), m('det.t4'), 'T4');
    }
    // T5: risk
    if (s.deviceRisk === 'high') return red(i, a, base, 'device_risk_high', 'T5');
    const yellow = s.deviceRisk === 'medium' || +s.accountAgeDays < 30;
    const tok = makeToken(card, base);
    w.tokens.push(tok); main = tok;
    if (yellow) {
      tok.decision = 'yellow'; tok.status = 'pending_idv';
      tok.idv_methods = IDV_METHODS; tok.idv_attempts = 0;
      tok.decision_reason = s.deviceRisk === 'medium' ? 'device_risk_medium' : 'wallet_account_new';
      hist(tok, 'pending_idv', 'issuer', tok.decision_reason);
      say('issuer', 'tsp', m('msg.yellow', { why: tok.decision_reason }), 'decision', 'warn', i);
      say('tsp', 'wallet', m('msg.idvNeeded'), 'idv', 'warn', i);
      say('wallet', 'cardholder', m('msg.chooseIdv'), 'idv', 'warn', i);
      return done(i, a, true, 201, m('res.yellow'), m('det.yellow', { why: tok.decision_reason }), 'T5');
    }
    tok.decision = 'green';
    say('issuer', 'tsp', m('msg.green'), 'decision', 'ok', i);
    activate(tok, i);
    done(i, a, true, 201, m('res.green'), m('det.green', { ref: tok.token_ref }), 'T6');
  }

  function red(i, a, base, reason, rule) {
    say('issuer', 'tsp', m('msg.red', { why: reason }), 'decision', 'bad', i);
    say('tsp', 'wallet', m('msg.declined'), 'decision', 'bad', i);
    say('wallet', 'cardholder', m('msg.cantAdd'), 'decision', 'bad', i);
    const tok = { ...base, token_ref: null, decision: 'red', status: 'declined', decision_reason: reason, history: [] };
    if (!main) main = tok;
    done(i, a, true, 201, m('res.red'), m('det.red', { why: reason }), rule);
  }

  function makeToken(card, base) {
    const bank = card.bank === 'bl' ? 'bl' : 'hb';
    w.seq[bank] += 1;
    const number = TOKEN_NUMBERS[w.seq.num++ % TOKEN_NUMBERS.length];
    const dom = domainFor(s.wallet, s.device);
    return {
      ...base, token_ref: `TRF-${bank.toUpperCase()}-${pad(w.seq[bank], 4)}`, token_number: number, token_masked: maskPan(number),
      token_expiry: card.expiry, par: demoPar(card), domain_restrictions: { ...dom, token_requestor_id: s.trid },
      assurance: { idv_method: 'none', level: 'issuer_approved' }, atc: 0, history: [],
    };
  }
  function activate(tok, i) {
    tok.status = 'active';
    hist(tok, 'provisioned', 'tsp');
    say('tsp', 'tsp', m('msg.createToken', { ref: tok.token_ref }), 'token', 'ok', i);
    say('tsp', 'device', m('msg.personalise'), 'token', 'ok', i);
    say('wallet', 'cardholder', m('msg.ready', { last4: tok.token_number.slice(-4) }), 'token', 'ok', i);
  }
  function hist(tok, event, by, reason) { tok.history.push({ at: now(w), event, by, ...(reason ? { reason } : {}) }); }

  function idv(i, a) {
    const tok = main;
    const method = a.method || s.idvMethod;
    say('cardholder', 'wallet', m('msg.idvEnter', { method }), 'idv', 'ok', i);
    say('wallet', 'tsp', m('msg.idvSend'), 'idv', 'ok', i);
    if (tok.status !== 'pending_idv') { say('tsp', 'wallet', m('msg.notPending'), 'idv', 'bad', i); return done(i, a, false, 409, m('res.t8'), m('det.t8', { status: tok.status }), 'T8'); }
    say('tsp', 'issuer', m('msg.idvCheck'), 'idv', 'ok', i);
    const ok = method !== 'sms_otp' || String(a.otp || '') === DEMO_OTP;
    if (!ok) {
      tok.idv_attempts += 1;
      if (tok.idv_attempts >= 3) {
        tok.status = 'deleted'; tok.decision = 'red'; hist(tok, 'deleted', 'issuer', 'idv_failed_3_times');
        say('issuer', 'tsp', m('msg.idvFail3'), 'idv', 'bad', i);
        return done(i, a, false, 422, m('res.t9del'), m('det.t9del'), 'T9');
      }
      say('issuer', 'tsp', m('msg.idvFail', { left: 3 - tok.idv_attempts }), 'idv', 'bad', i);
      return done(i, a, false, 422, m('res.t9'), m('det.t9', { left: 3 - tok.idv_attempts }), 'T9');
    }
    say('issuer', 'tsp', m('msg.idvOk'), 'idv', 'ok', i);
    tok.assurance = { idv_method: method, level: 'cardholder_verified' };
    activate(tok, i);
    done(i, a, true, 200, m('res.idvOk'), m('det.idvOk', { method }), 'T9');
  }

  function cryptogram(i, a, tok, channel) {
    const amountMinor = Math.round((+a.amount || +s.amount || 0) * 100);
    say('cardholder', 'device', m('msg.authenticate'), 'pay', 'ok', i);
    if (tok.status !== 'active') {
      say('device', 'cardholder', m('msg.notActive', { status: tok.status }), 'pay', 'bad', i);
      done(i, a, false, 422, m('res.t16'), m('det.t16', { status: tok.status, reason: lastReason(tok) }), tok.status === 'deleted' ? 'T15' : 'T16');
      return null;
    }
    if (!tok.domain_restrictions.channels.includes(channel)) {
      say('device', 'cardholder', m('msg.domain', { channel }), 'pay', 'bad', i);
      done(i, a, false, 422, m('res.t17'), m('det.t17', { channel, allowed: tok.domain_restrictions.channels.join(', ') }), 'T17');
      return null;
    }
    tok.atc += 1;
    const c = { token_ref: tok.token_ref, cryptogram: demoCryptogram(tok.token_ref, tok.atc, amountMinor), atc: tok.atc, eci: eciFor(channel), single_use: true, demo_only: true, amount_minor: amountMinor, channel };
    say('device', 'device', m('msg.cryptogram', { atc: c.atc }), 'pay', 'ok', i);
    return c;
  }
  function authorise(i, a, tok, c) {
    const card = cardOf(w, tok.card_id);
    say('device', 'merchant', m('msg.sendToMerchant', { channel: c.channel }), 'pay', 'ok', i);
    say('merchant', 'tsp', m('msg.authReq'), 'pay', 'ok', i);
    if (w.usedCryptograms.includes(c.cryptogram)) {
      say('tsp', 'merchant', m('msg.replay'), 'pay', 'bad', i);
      return done(i, a, false, 422, m('res.t18'), m('det.t18'), 'T18');
    }
    w.usedCryptograms.push(c.cryptogram);
    say('tsp', 'tsp', m('msg.verify'), 'pay', 'ok', i);
    say('tsp', 'issuer', m('msg.detokenise', { pan: maskPan(card.pan) }), 'pay', 'ok', i);
    const code = card.status === 'blocked' ? (card.block_reason === 'lost' ? '41' : card.block_reason === 'stolen' ? '43' : '05') : card.fraud_watch && c.channel !== 'contactless' ? '59' : '00';
    w.seq.pay += 1;
    const p = { payment_id: `pay_${pad(w.seq.pay + 100, 4)}`, token_ref: tok.token_ref, card_id: card.card_id, amount_minor: c.amount_minor, channel: c.channel, cryptogram: c.cryptogram, atc: c.atc, eci: c.eci, response_code: code, merchant_id: a.merchant || s.merchant, at: now(w), demo_only: true };
    w.payments.push(p);
    const ok = code === '00';
    say('issuer', 'tsp', m(ok ? 'msg.approved' : 'msg.declinedCode', { code }), 'pay', ok ? 'ok' : 'bad', i);
    say('tsp', 'merchant', m('msg.retoken', { code }), 'pay', ok ? 'ok' : 'bad', i);
    done(i, a, ok, 201, m(ok ? 'res.paid' : 'res.payDeclined', { code }), m('det.paid', { amount: (c.amount_minor / 100).toFixed(2), atc: c.atc, eci: c.eci || '—' }), 'T18');
    return p;
  }
  function pay(i, a) {
    const tok = main;
    const c = cryptogram(i, a, tok, a.channel || s.channel);
    if (c) { w.lastCryptogram = c; authorise(i, a, tok, c); }
  }
  function replay(i, a) {
    const c = w.lastCryptogram;
    if (!c) return done(i, a, false, 409, m('res.noCryptogram'), null, 'T18');
    say('merchant', 'merchant', m('msg.reuse'), 'pay', 'warn', i);
    authorise(i, a, main, c);
  }

  function lastReason(tok) { const h = [...tok.history].reverse().find((x) => x.reason); return h ? h.reason : ''; }
  function canAct(tok, i, a, need, rule) {
    if (tok.status === 'deleted') { done(i, a, false, 409, m('res.t15'), m('det.t15'), 'T15'); return false; }
    if (!need.includes(tok.status)) { done(i, a, false, 409, m('res.transition'), m('det.transition', { op: a.op, status: tok.status }), rule); return false; }
    return true;
  }
  function suspend(i, a) {
    const tok = main;
    const reason = a.reason || 'device_lost';
    if (!canAct(tok, i, a, ['active'], 'T11')) return;
    say(reason === 'device_lost' ? 'cardholder' : 'issuer', reason === 'device_lost' ? 'issuer' : 'tsp', m('msg.suspendAsk', { reason }), 'lifecycle', 'warn', i);
    if (reason === 'device_lost') say('issuer', 'tsp', m('msg.suspendOne'), 'lifecycle', 'warn', i);
    tok.status = 'suspended'; hist(tok, 'suspended', a.by || (reason === 'device_lost' ? 'cardholder' : 'issuer'), reason);
    say('tsp', 'device', m('msg.suspended'), 'lifecycle', 'warn', i);
    done(i, a, true, 200, m('res.suspended'), m('det.suspended', { reason }), 'T11');
  }
  function resume(i, a) {
    const tok = main;
    if (!canAct(tok, i, a, ['suspended'], 'T12')) return;
    if (lastReason(tok) === 'fraud_on_token') { say('issuer', 'tsp', m('msg.compromised'), 'lifecycle', 'bad', i); return done(i, a, false, 422, m('res.t14'), m('det.t14'), 'T14'); }
    const card = cardOf(w, tok.card_id);
    if (card.status === 'blocked') {
      const rep = w.cards.find((c) => c.replaces === card.card_id && c.status === 'active');
      if (!rep) { say('issuer', 'tsp', m('msg.resumeRefused'), 'lifecycle', 'bad', i); return done(i, a, false, 422, m('res.t13'), m('det.t13'), 'T13'); }
      return panUpdate(i, a, tok, rep);
    }
    say('issuer', 'tsp', m('msg.resumeAsk'), 'lifecycle', 'ok', i);
    tok.status = 'active'; hist(tok, 'resumed', 'issuer', a.reason || 'device_found');
    say('tsp', 'device', m('msg.resumed'), 'lifecycle', 'ok', i);
    done(i, a, true, 200, m('res.resumed'), null, 'T12');
  }
  function panUpdate(i, a, tok, rep) {
    say('issuer', 'tsp', m('msg.panUpdate', { from: tok.pan_masked, to: maskPan(rep.pan) }), 'lifecycle', 'ok', i);
    tok.previous_card_id = tok.card_id; tok.card_id = rep.card_id; tok.pan_masked = maskPan(rep.pan); tok.token_expiry = rep.expiry;
    tok.status = 'active'; hist(tok, 'pan_updated', 'issuer', 'card_replaced');
    say('tsp', 'device', m('msg.panUpdated'), 'lifecycle', 'ok', i);
    say('wallet', 'cardholder', m('msg.keepPaying'), 'lifecycle', 'ok', i);
    done(i, a, true, 200, m('res.panUpdate'), m('det.panUpdate', { card: rep.card_id, par: tok.par }), 'T13');
  }
  function remove(i, a) {
    const tok = main;
    if (!canAct(tok, i, a, ['active', 'suspended', 'pending_idv'], 'T15')) return;
    say('issuer', 'tsp', m('msg.deleteAsk', { reason: a.reason || 'cardholder_request' }), 'lifecycle', 'bad', i);
    tok.status = 'deleted'; hist(tok, 'deleted', 'issuer', a.reason || 'cardholder_request');
    say('tsp', 'device', m('msg.deleted'), 'lifecycle', 'bad', i);
    done(i, a, true, 200, m('res.deleted'), m('det.deleted'), 'T15');
  }
  function block(i, a) {
    const card = cardOf(w, main.card_id);
    const reason = a.reason || 'stolen';
    say('cardholder', 'issuer', m('msg.declare', { reason }), 'lifecycle', 'bad', i);
    if (!card || card.status === 'blocked') return done(i, a, false, 409, m('res.b2'), m('det.b2'), 'B2');
    card.status = 'blocked'; card.block_reason = reason;
    const rep = replacementOf(CARDS.find((c) => c.card_id === card.card_id) || card);
    if (!w.cards.some((c) => c.card_id === rep.card_id)) w.cards.push(rep);
    const hit = w.tokens.filter((t) => t.card_id === card.card_id && t.status === 'active');
    say('issuer', 'issuer', m('msg.blocked', { reason }), 'lifecycle', 'bad', i);
    say('issuer', 'tsp', m('msg.suspendAll', { n: hit.length }), 'lifecycle', 'warn', i);
    hit.forEach((t) => { t.status = 'suspended'; hist(t, 'suspended', 'issuer', `card_blocked_${reason}`); });
    if (hit.length) say('tsp', 'device', m('msg.suspended'), 'lifecycle', 'warn', i);
    done(i, a, true, 200, m('res.blocked', { reason }), m('det.blocked', { n: hit.length, rep: rep.card_id }), 'B3');
  }
  function replace(i, a) {
    const old = cardOf(w, main.previous_card_id || main.card_id);
    const rep = w.cards.find((c) => c.replaces === old.card_id);
    if (!rep) { say('issuer', 'issuer', m('msg.noReplacement'), 'lifecycle', 'bad', i); return done(i, a, false, 409, m('res.noReplacement'), m('det.noReplacement'), 'T13'); }
    if (rep.status === 'active') return done(i, a, false, 409, m('res.alreadyReplaced'), null, 'T13');
    rep.status = 'active';
    say('issuer', 'cardholder', m('msg.newCard', { pan: maskPan(rep.pan) }), 'lifecycle', 'ok', i);
    done(i, a, true, 200, m('res.replaced', { card: rep.card_id }), null, 'B3');
    if (main.status === 'suspended' && lastReason(main) !== 'fraud_on_token' && main.card_id === old.card_id) panUpdate(i, { op: 'resume', new_card_id: rep.card_id }, main, rep);
  }

  const token = main;
  const lastOk = log.filter((l) => l.ok).pop();
  return { input: s, world: w, log, messages, step: messages.length ? messages[messages.length - 1].step : 'request', token, payments: w.payments, lastCryptogram: w.lastCryptogram || null, card: token ? cardOf(w, token.card_id) : null, views: views(token, w), allowed: allowed(token, w), lastOk };
}

/** Which lifecycle actions are allowed now, with the rule that forbids the others (buttons + tooltips). */
export function allowed(tok, w) {
  const st = tok?.status;
  const card = tok && w.cards.find((c) => c.card_id === tok.card_id);
  const rep = card && w.cards.find((c) => c.replaces === card.card_id);
  const fraud = tok && [...(tok.history || [])].reverse().find((h) => h.reason)?.reason === 'fraud_on_token';
  const no = (rule, k) => ({ ok: false, rule, k });
  const yes = { ok: true };
  if (!tok || !tok.token_ref) return Object.fromEntries(['idv', 'pay', 'replay', 'suspend', 'resume', 'delete', 'block', 'replace'].map((k) => [k, no('T16', 'why.noToken')]));
  return {
    idv: st === 'pending_idv' ? yes : no('T8', 'why.notPending'),
    pay: st === 'active' ? yes : no(st === 'deleted' ? 'T15' : 'T16', 'why.notActive'),
    replay: w.lastCryptogram ? yes : no('T18', 'why.noCryptogram'),
    suspend: st === 'active' ? yes : no('T11', 'why.onlyActive'),
    resume: st !== 'suspended' ? no('T12', 'why.onlySuspended') : fraud ? no('T14', 'why.compromised') : card?.status === 'blocked' && rep?.status !== 'active' ? no('T13', 'why.cardBlocked') : yes,
    delete: st === 'deleted' ? no('T15', 'why.deleted') : yes,
    block: card && card.status !== 'blocked' ? yes : no('B2', 'why.alreadyBlocked'),
    replace: rep && rep.status === 'ordered' ? yes : no('T13', rep ? 'why.alreadyReplaced' : 'why.blockFirst'),
  };
}

/** Who sees what (EMVCo roles). level: full | masked | last4 | none; value is what that actor holds. */
export function views(tok, w) {
  const card = tok && w.cards.find((c) => c.card_id === tok.card_id);
  const c = w.lastCryptogram;
  const pan = card?.pan;
  const has = !!tok?.token_ref;
  const v = (level, value) => ({ level, value: level === 'none' || !value ? null : value });
  const panAs = (lvl) => v(lvl, lvl === 'full' ? pan : lvl === 'masked' ? maskPan(pan) : lvl === 'last4' ? `•••• ${pan?.slice(-4)}` : null);
  const tokAs = (lvl) => v(has ? lvl : 'none', lvl === 'full' ? tok?.token_number : lvl === 'masked' ? tok?.token_masked : lvl === 'last4' ? `•••• ${tok?.token_number?.slice(-4)}` : null);
  return {
    fields: ['pan', 'token', 'token_ref', 'par', 'cryptogram'],
    actors: {
      cardholder: { pan: panAs('full'), token: tokAs('last4'), token_ref: v('none'), par: v('none'), cryptogram: v('none') },
      wallet: { pan: panAs('last4'), token: tokAs('masked'), token_ref: v(has ? 'full' : 'none', tok?.token_ref), par: v('none'), cryptogram: v('none') },
      tsp: { pan: panAs('full'), token: tokAs('full'), token_ref: v(has ? 'full' : 'none', tok?.token_ref), par: v(has ? 'full' : 'none', tok?.par), cryptogram: v(c ? 'full' : 'none', c?.cryptogram) },
      issuer: { pan: panAs('full'), token: tokAs('masked'), token_ref: v(has ? 'full' : 'none', tok?.token_ref), par: v(has ? 'full' : 'none', tok?.par), cryptogram: v('none') },
      device: { pan: v('none'), token: tokAs('full'), token_ref: v('none'), par: v('none'), cryptogram: v(c ? 'full' : 'none', c?.cryptogram) },
      merchant: { pan: v('none'), token: tokAs('masked'), token_ref: v('none'), par: v(has && c ? 'full' : 'none', tok?.par), cryptogram: v(c ? 'full' : 'none', c?.cryptogram) },
    },
  };
}

/** The HTTP call each action maps to on the Harbor Bank / Banque Lumière mock (for the API tester and exports). */
export function apiCall(a, s, tok) {
  const ref = tok?.token_ref || '{{token_ref}}';
  const card = findCard(s.cardId);
  switch (a.op) {
    case 'provision': return { method: 'POST', path: '/tokens', body: { pan: s.pan || card?.pan, expiry: card?.expiry, wallet: s.wallet, token_requestor_id: s.trid, device_id: deviceId(s.device), device_type: deviceType(s.device), device_risk: s.deviceRisk, wallet_account_age_days: +s.accountAgeDays } };
    case 'idv': return { method: 'POST', path: `/tokens/${ref}/idv`, body: { method: a.method || s.idvMethod, ...(a.otp != null ? { otp: a.otp } : {}) } };
    case 'pay': return { method: 'POST', path: `/tokens/${ref}/cryptogram`, body: { amount_minor: Math.round((+a.amount || +s.amount) * 100), currency: 'EUR', channel: a.channel || s.channel, merchant_id: a.merchant || s.merchant } };
    case 'replay': return { method: 'POST', path: '/payments', body: { payment_token: { token_ref: ref, cryptogram: '{{cryptogram}}' }, amount_minor: Math.round(+s.amount * 100), currency: 'EUR', channel: s.channel } };
    case 'suspend': return { method: 'POST', path: `/tokens/${ref}/suspend`, body: { reason: a.reason || 'device_lost', requested_by: 'cardholder' } };
    case 'resume': return { method: 'POST', path: `/tokens/${ref}/resume`, body: { reason: a.reason || 'device_found', ...(a.new_card_id ? { new_card_id: a.new_card_id, requested_by: 'issuer' } : {}) } };
    case 'delete': return { method: 'POST', path: `/tokens/${ref}/delete`, body: { reason: a.reason || 'cardholder_request' } };
    case 'block': return { method: 'POST', path: `/cards/${tok?.card_id || s.cardId}/block`, body: { reason: a.reason || 'stolen', channel: 'app' } };
    case 'replace': return { method: 'POST', path: `/tokens/${ref}/resume`, body: { reason: 'card_replaced', requested_by: 'issuer', new_card_id: `${(tok?.card_id || s.cardId).replace(/_r1$/, '')}_r1` } };
    default: return null;
  }
}

/** Mermaid sequence diagram of the run, the current step highlighted. Text is passed through tr(). */
export function toMermaid(res, tr, actorLabel) {
  const safe = (x) => String(x).replace(/[;#<>]/g, ' ').replace(/\s+/g, ' ').trim();
  const lines = ['sequenceDiagram', '  autonumber'];
  ACTORS.forEach((a) => lines.push(`  participant ${a} as ${safe(actorLabel(a))}`));
  const lastOp = res.messages.length ? res.messages[res.messages.length - 1].op : -1;
  let open = false;
  res.messages.forEach((x) => {
    const cur = x.op === lastOp;
    if (cur && !open) { lines.push('  rect rgba(37, 99, 235, 0.10)'); open = true; }
    const arrow = x.kind === 'bad' ? '-x' : x.from === x.to ? '->>' : '->>';
    lines.push(`  ${open ? '  ' : ''}${x.from}${arrow}${x.to}: ${safe(tr(x.text))}`);
  });
  if (open) lines.push('  end');
  return lines.join('\n');
}
