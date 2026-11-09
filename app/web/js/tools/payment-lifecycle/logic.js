/* Payment lifecycle & chargeback simulator: pure logic, no DOM (owner K). Runs in the browser and under node.

   Rules P3–P7, R1–R3, D1–D16 come from research/demo-api/tokens-and-disputes-openapi.yaml (+ D1–D5 of
   harbor-bank-openapi.yaml). simulate(input) is a deterministic replay: authorise → (capture) → the chosen event,
   then input.actions (represent, accept, prearb, refund, capture, reversal, advance, chargeback).

   ADAPTER NOTE: builder C will serve /payments, /disputes and /_mock/clock from app/web/js/mock/. Until then this
   file IS the engine; apiCall() gives the HTTP request each step maps to (see research/wave1-K.md).

   Deadlines and fees live in ONE table (DEADLINES) with confidence public | to_confirm and the source URL. */
import { MOCK_TODAY } from '../tokenization/fixtures.js';

export const PARTIES = ['cardholder', 'issuer', 'acquirer', 'merchant'];
export const EVENTS = ['void', 'reversal', 'partial_capture', 'refund', 'chargeback'];
export const STAGES = ['authorisation', 'clearing', 'outcome', 'representment', 'pre_arbitration', 'arbitration'];
export const EVIDENCE = ['proof_of_delivery', 'signed_delivery', 'tracking_only', 'refund_issued', 'product_description', 'return_policy', 'cancellation_policy_accepted', 'two_separate_orders', 'compelling_evidence_3_0', 'authorisation_proof'];
export const REVERSAL_REASONS = ['customer_cancelled', 'merchant_cancelled', 'final_amount_lower', 'duplicate', 'timeout'];
export const REFUND_REASONS = ['goods_returned', 'service_cancelled', 'goodwill', 'duplicate'];

/** Visa dispute conditions (public names, research/09 §3). CB motifs: only 45 is public (Adyen); others *to confirm*. */
export const CONDITIONS = [
  { code: '10.1', cat: 10, fraud: true }, { code: '10.2', cat: 10, fraud: true }, { code: '10.3', cat: 10, fraud: true },
  { code: '10.4', cat: 10, fraud: true, cb: '45' }, { code: '10.5', cat: 10, fraud: true },
  { code: '11.1', cat: 11 }, { code: '11.2', cat: 11 }, { code: '11.3', cat: 11 },
  { code: '12.1', cat: 12 }, { code: '12.2', cat: 12 }, { code: '12.3', cat: 12 }, { code: '12.4', cat: 12 },
  { code: '12.5', cat: 12 }, { code: '12.6', cat: 12 }, { code: '12.7', cat: 12 },
  { code: '13.1', cat: 13 }, { code: '13.2', cat: 13 }, { code: '13.3', cat: 13 }, { code: '13.4', cat: 13 },
  { code: '13.5', cat: 13 }, { code: '13.6', cat: 13 }, { code: '13.7', cat: 13 }, { code: '13.8', cat: 13 }, { code: '13.9', cat: 13 },
];
export const conditionOf = (code) => CONDITIONS.find((c) => c.code === code);
export const workflowOf = (code) => (/^1[01]\./.test(code) ? 'allocation' : 'collaboration');

/** D14 matching evidence per condition (first round). */
export const WINNING_EVIDENCE = {
  '13.1': [['proof_of_delivery']], '13.3': [['product_description', 'return_policy']],
  '13.6': [['refund_issued'], ['cancellation_policy_accepted']], '13.7': [['refund_issued'], ['cancellation_policy_accepted']],
  '12.6': [['two_separate_orders']], '10.4': [['compelling_evidence_3_0']],
};
export const evidenceWins = (code, ev = []) => (WINNING_EVIDENCE[code] || []).some((set) => set.every((e) => ev.includes(e)));

const ADYEN_VISA = 'https://docs.adyen.com/risk-management/chargeback-guidelines/visa-chargebacks.md';
const ADYEN_CB = 'https://docs.adyen.com/risk-management/chargeback-guidelines/cartes-bancaires-chargebacks';
const VISA_RULES = 'https://www.visa.com/en-us/support/visa-rules.html';
const L133_18 = 'https://www.doctrine.fr/l/texts/codes/LEGITEXT000006072026/articles/LEGIARTI000020861591';
const LEGIFRANCE = 'https://www.legifrance.gouv.fr';
/** One table for every deadline and fee: {scheme, step, days|months|amount, confidence, source_url}. */
export const DEADLINES = [
  { scheme: 'visa', step: 'raise', days: 120, confidence: 'public', source_url: VISA_RULES, note: 'from_processing_date' },
  { scheme: 'visa', step: 'respond', days: 30, confidence: 'public', source_url: ADYEN_VISA, note: 'scheme_level' },
  { scheme: 'visa', step: 'merchant_window', days: 18, confidence: 'to_confirm', source_url: ADYEN_VISA, note: 'acquirer_gives_less' },
  { scheme: 'visa', step: 'pre_arbitration', days: 30, confidence: 'public', source_url: ADYEN_VISA },
  { scheme: 'visa', step: 'arbitration_fee', amount_minor: 60000, currency: 'USD', confidence: 'to_confirm', source_url: ADYEN_VISA, note: 'cited_by_adyen' },
  { scheme: 'cb', step: 'raise', days: 120, confidence: 'to_confirm', source_url: ADYEN_CB, note: 'cb_rulebook' },
  { scheme: 'cb', step: 'respond', days: 30, confidence: 'to_confirm', source_url: ADYEN_CB, note: 'cb_rulebook' },
  { scheme: 'cb', step: 'merchant_window', days: 18, confidence: 'to_confirm', source_url: ADYEN_CB, note: 'acquirer_gives_less' },
  { scheme: 'cb', step: 'pre_arbitration', days: 30, confidence: 'to_confirm', source_url: ADYEN_CB, note: 'cb_rulebook' },
  { scheme: 'cb', step: 'arbitration_fee', amount_minor: null, currency: 'EUR', confidence: 'to_confirm', source_url: ADYEN_CB, note: 'cb_rulebook' },
  { scheme: 'cb', step: 'l133_18_refund', business_days: 1, confidence: 'public', source_url: L133_18, note: 'l133_18' },
  { scheme: 'cb', step: 'l133_24_contest', months: 13, confidence: 'public', source_url: LEGIFRANCE, note: 'l133_24' },
];
export const deadline = (scheme, step) => DEADLINES.find((d) => d.scheme === scheme && d.step === step);

const m = (k, p = {}) => ({ k, p });
// ---- dates (UTC, yyyy-mm-dd) ----
const D = (iso) => new Date(`${iso}T00:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
export const addDays = (s, n) => { const d = D(s); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const addMonths = (s, n) => { const d = D(s); d.setUTCMonth(d.getUTCMonth() + n); return iso(d); };
export const daysBetween = (a, b) => Math.round((D(b) - D(a)) / 86400000);
/** Next business day (Mon–Fri; French public holidays not handled, *to confirm*). */
export function nextBusinessDay(s) { let d = addDays(s, 1); while ([0, 6].includes(D(d).getUTCDay())) d = addDays(d, 1); return d; }

export function defaults() {
  return {
    scheme: 'visa', amount: 89, currency: 'EUR', cardId: 'crd_hb_001', merchant: 'M-007', channel: 'ecom',
    threeDs: 'none', wallet: false, event: 'chargeback', reason: '13.1', eventAmount: '',
    authDate: '2026-10-11', captureDate: '2026-10-12', eventDate: MOCK_TODAY, expectedDelivery: '2026-10-20', fraudReport: '',
    actions: [],
  };
}
export function advancedSet(s) {
  const d = defaults();
  return ['merchant', 'channel', 'wallet', 'eventAmount', 'authDate', 'captureDate', 'eventDate', 'expectedDelivery', 'fraudReport'].filter((k) => s[k] !== undefined && String(s[k]) !== String(d[k])).length;
}

/** Replays the payment. Returns {pay, dispute, log, ledger, positions, stages, today, allowed, tracks, liability}. */
export function simulate(input) {
  const s = { ...defaults(), ...input };
  const minor = (x) => Math.round(+x * 100);
  const amt = minor(s.amount);
  let today = s.authDate;
  const pay = { payment_id: 'pay_0001', status: 'authorised', authorised_minor: amt, captured_minor: 0, reversed_minor: 0, refunded_minor: 0, disputed_minor: 0, currency: s.currency, channel: s.channel, three_ds: s.threeDs, wallet: !!s.wallet, arn: null, authorised_at: s.authDate, captured_at: null, timeline: [] };
  let dispute = null;
  const log = [];
  const ledger = [];
  let n = 0;
  const move = (debit, credit, amount, k, extra = {}) => ledger.push({ at: today, debit, credit, amount_minor: amount, note: m(k), ...extra });
  const done = (a, ok, status, title, detail = null, rule = null, stage = null) => log.push({ i: n, op: a, ok, status, title, detail, rule, at: today, stage, api: apiCall(a, s, dispute) });

  const ops = [{ op: 'authorise', at: s.authDate }];
  if (['refund', 'chargeback'].includes(s.event)) ops.push({ op: 'capture', at: s.captureDate });
  const evAmount = s.eventAmount !== '' && s.eventAmount != null ? minor(s.eventAmount) : null;
  if (s.event === 'void') ops.push({ op: 'reversal', at: s.eventDate, void: true, reason: s.reason });
  if (s.event === 'reversal') ops.push({ op: 'reversal', at: s.eventDate, reason: s.reason, amount_minor: evAmount });
  if (s.event === 'partial_capture') ops.push({ op: 'capture', at: s.eventDate, amount_minor: evAmount ?? Math.round(amt * 0.8) });
  if (s.event === 'refund') ops.push({ op: 'refund', at: s.eventDate, reason: s.reason, amount_minor: evAmount ?? amt });
  if (s.event === 'chargeback') ops.push({ op: 'chargeback', at: s.eventDate, code: s.reason, amount_minor: evAmount ?? amt });
  const all = [...ops, ...(s.actions || [])];

  for (const a of all) {
    if (a.at && a.at > today) today = a.at;
    ({ authorise, capture, reversal, refund, chargeback, represent, accept, prearb, advance }[a.op] || ((x) => done(x, false, 400, m('err.unknownOp', { op: x.op }))))(a);
    n += 1;
  }

  function authorise(a) {
    pay.timeline.push({ at: today, event: 'authorised' });
    move('cardholder', null, amt, 'led.hold', { kind: 'hold' });
    done(a, true, 201, m('res.authorised'), m('det.authorised', { amount: amt }), 'A1', 'authorisation');
  }
  function capture(a) {
    if (pay.status !== 'authorised' && pay.status !== 'partially_reversed') return done(a, false, 409, m('res.p3'), m('det.p3', { status: pay.status }), 'P3', 'clearing');
    const max = pay.authorised_minor - pay.reversed_minor;
    const c = a.amount_minor ?? max;
    if (c > max) return done(a, false, 422, m('res.p4'), m('det.p4', { max }), 'P4', 'clearing');
    pay.captured_minor = c; pay.status = 'captured'; pay.captured_at = today; pay.arn = '74000002305000000009' + String(1 + n).padStart(3, '0');
    pay.timeline.push({ at: today, event: 'captured', amount_minor: c });
    move('cardholder', 'merchant', c, 'led.clearing', { via: 'issuer → scheme → acquirer' });
    done(a, true, 200, m('res.captured'), m(c < max ? 'det.partialCapture' : 'det.captured', { amount: c, released: max - c }), c < max ? 'P5' : 'P3', 'clearing');
  }
  function reversal(a) {
    if (pay.status === 'reversed') return done(a, false, 409, m('res.p3rev'), m('det.p3rev'), 'P7', 'outcome');
    if (pay.captured_at) return done(a, false, 409, m('res.p6'), m('det.p6'), 'P6', 'outcome');
    const max = pay.authorised_minor - pay.reversed_minor;
    const r = a.amount_minor ?? max;
    if (r > max) return done(a, false, 422, m('res.p7'), m('det.p7', { max }), 'P7', 'outcome');
    pay.reversed_minor += r; pay.status = r === max ? 'reversed' : 'partially_reversed';
    pay.timeline.push({ at: today, event: pay.status, amount_minor: r });
    move(null, 'cardholder', r, a.void ? 'led.void' : 'led.release', { kind: 'hold' });
    done(a, true, 200, m(a.void ? 'res.voided' : r === max ? 'res.reversed' : 'res.partialReversed'), m('det.reversed', { amount: r }), a.void ? 'P6' : 'P7', 'outcome');
  }
  function refund(a) {
    if (!pay.captured_at) return done(a, false, 409, m('res.r1'), m('det.r1'), 'R1', 'outcome');
    if (dispute && !['won', 'lost', 'merchant_accepted'].includes(dispute.status)) return done(a, false, 409, m('res.r3'), m('det.r3'), 'R3', 'outcome');
    const r = a.amount_minor ?? pay.captured_minor;
    const max = pay.captured_minor - pay.refunded_minor - pay.disputed_minor;
    if (r > max) return done(a, false, 422, m('res.r2'), m('det.r2', { max }), 'R2', 'outcome');
    pay.refunded_minor += r; pay.status = pay.refunded_minor >= pay.captured_minor ? 'refunded' : 'partially_refunded';
    pay.timeline.push({ at: today, event: 'refunded', amount_minor: r });
    move('merchant', 'cardholder', r, 'led.refund');
    done(a, true, 201, m('res.refunded'), m('det.refunded', { amount: r }), 'R2', 'outcome');
  }
  function chargeback(a) {
    const code = a.code;
    const cond = conditionOf(code);
    const r = a.amount_minor ?? pay.captured_minor;
    if (!cond) return done(a, false, 422, m('res.d1'), m('det.d1', { code }), 'D1', 'outcome');
    if (!pay.captured_at) return done(a, false, 422, m('res.d7'), m('det.d7'), 'D7', 'outcome');
    if (dispute && !['won', 'lost', 'merchant_accepted'].includes(dispute.status)) return done(a, false, 409, m('res.d5'), m('det.d5'), 'D5', 'outcome');
    if (pay.refunded_minor >= pay.captured_minor || (cond.cat === 13 && r <= pay.refunded_minor)) return done(a, false, 422, m('res.d8'), m('det.d8'), 'D8', 'outcome');
    const age = daysBetween(pay.captured_at, today);
    const lim = deadline(s.scheme, 'raise');
    if (age > lim.days) return done(a, false, 422, m('res.d2'), m('det.d2', { age, days: lim.days }), 'D2', 'outcome');
    if (r > pay.captured_minor - pay.disputed_minor - pay.refunded_minor) return done(a, false, 422, m('res.d4'), m('det.d4'), 'D4', 'outcome');
    const shiftedBy = cond.fraud && code !== '10.1' && code !== '10.2' && (s.threeDs === 'authenticated' || s.threeDs === 'attempted' || s.wallet) && pay.channel !== 'pos'
      ? (s.wallet ? 'wallet' : s.threeDs) : null;
    // FR cardholder track (L133-18) starts with the contest, whatever the interbank outcome.
    if (cond.fraud && s.scheme === 'cb') {
      move('issuer', 'cardholder', r, 'led.l133', { at: nextBusinessDay(today) });
    }
    if (shiftedBy && code === '10.4') {
      if (!(cond.fraud && s.scheme === 'cb')) move('issuer', 'cardholder', r, 'led.issuerAbsorbs');
      dispute = { dispute_id: 'DSP-2026-0101', condition_code: code, workflow: 'allocation', status: 'blocked', amount_minor: r, raised_at: today, respond_by: null, liability: 'issuer', evidence: [], history: [{ at: today, event: 'blocked', rule: 'D9' }] };
      return done(a, false, 422, m('res.d9'), m(shiftedBy === 'attempted' ? 'det.d9attempted' : shiftedBy === 'wallet' ? 'det.d9wallet' : 'det.d9'), 'D9', 'outcome');
    }
    if (cond.fraud && !s.fraudReport) return done(a, false, 422, m('res.d3'), m('det.d3'), 'D3', 'outcome');
    if (code === '13.1' && s.expectedDelivery && s.expectedDelivery >= today) return done(a, false, 422, m('res.d11'), m('det.d11', { date: s.expectedDelivery }), 'D11', 'outcome');
    const wf = workflowOf(code);
    const respond = deadline(s.scheme, wf === 'collaboration' ? 'respond' : 'pre_arbitration');
    pay.disputed_minor += r; pay.status = 'disputed';
    dispute = { dispute_id: 'DSP-2026-0101', payment_id: pay.payment_id, condition_code: code, workflow: wf, status: 'chargeback', amount_minor: r, raised_at: today, respond_by: addDays(today, respond.days), liability: 'merchant', evidence: [], history: [{ at: today, event: 'chargeback' }], fee_minor: 0 };
    pay.timeline.push({ at: today, event: 'disputed', amount_minor: r });
    if (!(cond.fraud && s.scheme === 'cb')) move('issuer', 'cardholder', r, cond.fraud ? 'led.provisionalFraud' : 'led.provisional');
    move('merchant', 'issuer', r, 'led.chargeback', { via: 'acquirer → scheme' });
    ledger.push({ at: today, debit: 'merchant', credit: 'acquirer', amount_minor: null, note: m('led.cbFee') });
    done(a, true, 201, m(wf === 'allocation' ? 'res.cbAllocation' : 'res.cbCollab'), m(wf === 'allocation' ? 'det.cbAllocation' : 'det.cbCollab', { by: dispute.respond_by }), wf === 'allocation' ? 'D10' : 'D10', 'outcome');
  }
  function represent(a) {
    if (!dispute || dispute.status !== 'chargeback') return done(a, false, 422, m('res.noChargeback'), null, 'D12', 'representment');
    if (today > dispute.respond_by) {
      dispute.status = 'merchant_accepted'; dispute.liability = 'merchant';
      return done(a, false, 422, m('res.d12'), m('det.d12', { by: dispute.respond_by }), 'D12', 'representment');
    }
    if (!a.evidence || !a.evidence.length) return done(a, false, 422, m('res.d13'), m('det.d13'), 'D13', 'representment');
    dispute.evidence = [...a.evidence];
    dispute.history.push({ at: today, event: 'represented', evidence: a.evidence });
    if (evidenceWins(dispute.condition_code, a.evidence)) {
      dispute.status = 'won'; dispute.liability = 'issuer';
      pay.disputed_minor -= dispute.amount_minor; pay.status = 'captured';
      move('issuer', 'merchant', dispute.amount_minor, 'led.represented', { via: 'scheme → acquirer' });
      move('cardholder', 'issuer', dispute.amount_minor, 'led.rebill');
      return done(a, true, 200, m('res.won'), m('det.won'), 'D14', 'representment');
    }
    dispute.status = 'pre_arbitration'; dispute.respond_by = addDays(today, deadline(s.scheme, 'pre_arbitration').days);
    done(a, true, 200, m('res.preArb'), m('det.preArb', { by: dispute.respond_by }), 'D14', 'representment');
  }
  function accept(a) {
    if (!dispute || !['chargeback', 'pre_arbitration'].includes(dispute.status)) return done(a, false, 422, m('res.noOpen'), null, 'D13', 'representment');
    const st = dispute.status;
    dispute.status = st === 'chargeback' ? 'merchant_accepted' : 'lost'; dispute.liability = 'merchant';
    dispute.history.push({ at: today, event: dispute.status });
    done(a, true, 200, m(st === 'chargeback' ? 'res.accepted' : 'res.lostAccepted'), m('det.accepted'), st === 'chargeback' ? 'D13' : 'D16', st === 'chargeback' ? 'representment' : 'pre_arbitration');
  }
  function prearb(a) {
    if (!dispute || dispute.status !== 'pre_arbitration') return done(a, false, 422, m('res.noPreArb'), null, 'D15', 'pre_arbitration');
    if (today > dispute.respond_by) { dispute.status = 'lost'; return done(a, false, 422, m('res.d15'), m('det.d12', { by: dispute.respond_by }), 'D15', 'pre_arbitration'); }
    if (a.accept) return accept(a);
    if (a.new_evidence?.length) dispute.evidence = [...new Set([...dispute.evidence, ...a.new_evidence])];
    dispute.history.push({ at: today, event: 'arbitration' });
    const fee = deadline(s.scheme, 'arbitration_fee');
    const merchantWins = evidenceWins(dispute.condition_code, dispute.evidence);
    dispute.status = merchantWins ? 'won' : 'lost';
    dispute.liability = merchantWins ? 'issuer' : 'merchant';
    dispute.fee_minor = fee.amount_minor || 0;
    if (merchantWins) {
      pay.disputed_minor -= dispute.amount_minor;
      move('issuer', 'merchant', dispute.amount_minor, 'led.arbWon', { via: 'scheme → acquirer' });
    }
    ledger.push({ at: today, debit: merchantWins ? 'issuer' : 'merchant', credit: 'scheme', amount_minor: fee.amount_minor, currency: fee.currency, note: m('led.fee'), fee: true });
    done(a, merchantWins, 200, m(merchantWins ? 'res.arbWon' : 'res.arbLost'), m('det.arb', { loser: merchantWins ? 'issuer' : 'merchant' }), 'D16', 'arbitration');
  }
  function advance(a) {
    today = addDays(today, a.days || 1);
    done(a, true, 200, m('res.clock', { days: a.days || 1 }), m('det.clock', { today }), null, null);
  }

  // positions: money only (holds and fees in other currencies excluded)
  const positions = Object.fromEntries([...PARTIES, 'scheme'].map((p) => [p, 0]));
  ledger.forEach((l) => {
    if (l.kind === 'hold' || l.amount_minor == null || (l.currency && l.currency !== s.currency)) return;
    if (l.debit) positions[l.debit] -= l.amount_minor;
    if (l.credit) positions[l.credit] += l.amount_minor;
  });
  const hold = pay.captured_at ? 0 : pay.authorised_minor - pay.reversed_minor;
  const res = { input: s, pay, dispute, log, ledger, positions, hold: Math.max(0, hold), today, scheme: s.scheme };
  res.stages = stages(res);
  res.allowed = allowedActions(res);
  res.liability = whoPays(res);
  res.tracks = s.scheme === 'cb' ? frTracks(res) : null;
  res.liabilityShift = liabilityShift(s);
  return res;
}

/** Stage list for the timeline: status done | current | refused | skipped | upcoming, with dates and deadlines. */
export function stages(res) {
  const { pay, dispute, log, today, input } = res;
  const at = (stage) => log.filter((l) => l.stage === stage);
  const st = (stage) => { const l = at(stage); if (!l.length) return null; return l[l.length - 1]; };
  const out = [];
  out.push({ id: 'authorisation', status: 'done', at: pay.authorised_at, entry: st('authorisation') });
  const cl = st('clearing');
  out.push({ id: 'clearing', status: pay.captured_at ? 'done' : pay.status.includes('reversed') ? 'skipped' : cl && !cl.ok ? 'refused' : 'current', at: pay.captured_at, entry: cl });
  const oc = st('outcome');
  const outcomeKind = input.event === 'partial_capture' ? 'clearing' : input.event;
  out.push({ id: 'outcome', kind: outcomeKind, status: !oc ? (input.event === 'partial_capture' ? 'skipped' : 'upcoming') : oc.ok ? 'done' : 'refused', at: oc?.at, entry: oc, workflow: dispute?.workflow, deadline: dispute && dispute.status === 'chargeback' ? { by: dispute.respond_by, left: daysBetween(today, dispute.respond_by), conf: deadline(input.scheme, dispute.workflow === 'collaboration' ? 'respond' : 'pre_arbitration') } : null });
  const isCb = !!dispute && dispute.status !== 'blocked';
  const rp = st('representment');
  out.push({ id: 'representment', status: !isCb ? 'skipped' : rp ? (rp.ok ? 'done' : 'refused') : dispute.status === 'chargeback' ? 'current' : 'skipped', at: rp?.at, entry: rp, allocation: dispute?.workflow === 'allocation' });
  const pa = st('pre_arbitration');
  const ar0 = st('arbitration');
  out.push({ id: 'pre_arbitration', status: !isCb ? 'skipped' : dispute.status === 'pre_arbitration' ? 'current' : ar0 ? 'done' : pa ? (pa.ok ? 'done' : 'refused') : 'upcoming', at: pa?.at || (dispute?.history.find((h) => h.event === 'represented') && dispute.status !== 'won' ? dispute.history.find((h) => h.event === 'represented').at : null), entry: pa, deadline: dispute?.status === 'pre_arbitration' ? { by: dispute.respond_by, left: daysBetween(today, dispute.respond_by), conf: deadline(input.scheme, 'pre_arbitration') } : null });
  const ar = st('arbitration');
  out.push({ id: 'arbitration', status: !isCb ? 'skipped' : ar ? (ar.status === 200 ? 'done' : 'refused') : 'upcoming', at: ar?.at, entry: ar, fee: deadline(input.scheme, 'arbitration_fee') });
  // stages after a closed dispute are not reached
  if (dispute && ['won', 'merchant_accepted'].includes(dispute.status)) out.forEach((x) => { if (x.status === 'upcoming') x.status = 'skipped'; });
  if (dispute && dispute.status === 'lost' && !ar) out.forEach((x) => { if (x.id === 'arbitration') x.status = 'skipped'; });
  if (!dispute && ['refund', 'reversal', 'void'].includes(input.event)) out.slice(3).forEach((x) => { x.status = 'skipped'; });
  return out;
}

/** Next actions with allowed / refused + rule (greyed buttons name the rule). */
export function allowedActions(res) {
  const { pay, dispute, today } = res;
  const open = dispute && ['chargeback', 'pre_arbitration'].includes(dispute.status);
  const no = (rule, k) => ({ ok: false, rule, k });
  const yes = { ok: true };
  return {
    capture: ['authorised', 'partially_reversed'].includes(pay.status) ? yes : no('P3', 'why.p3'),
    reversal: pay.captured_at ? no('P6', 'why.p6') : pay.status === 'reversed' ? no('P7', 'why.p7') : yes,
    refund: !pay.captured_at ? no('R1', 'why.r1') : open ? no('R3', 'why.r3') : pay.refunded_minor >= pay.captured_minor ? no('R2', 'why.r2') : yes,
    chargeback: !pay.captured_at ? no('D7', 'why.d7') : dispute?.status === 'blocked' ? no('D9', 'why.d9') : open ? no('D5', 'why.d5') : pay.refunded_minor >= pay.captured_minor ? no('D8', 'why.d8') : yes,
    represent: dispute?.status !== 'chargeback' ? no('D12', 'why.noChargeback') : today > dispute.respond_by ? no('D12', 'why.d12') : yes,
    accept: open ? yes : no('D13', 'why.noOpen'),
    prearb: dispute?.status !== 'pre_arbitration' ? no('D15', 'why.noPreArb') : today > dispute.respond_by ? no('D15', 'why.d12') : yes,
  };
}

/** Who carries the amount right now (cardholder | issuer | merchant | none) and why. */
export function whoPays(res) {
  const { pay, dispute } = res;
  if (!pay.captured_at) return { party: 'none', k: pay.status === 'reversed' ? 'who.reversed' : 'who.hold' };
  if (dispute?.status === 'blocked') return { party: 'issuer', k: 'who.shifted' };
  if (dispute?.status === 'won') return { party: res.input.event === 'chargeback' && conditionOf(dispute.condition_code)?.fraud ? 'issuer' : 'cardholder', k: 'who.won' };
  if (dispute && ['chargeback', 'pre_arbitration', 'merchant_accepted', 'lost'].includes(dispute.status)) return { party: 'merchant', k: dispute.status === 'chargeback' || dispute.status === 'pre_arbitration' ? 'who.pending' : 'who.merchantLost' };
  if (pay.refunded_minor >= pay.captured_minor) return { party: 'merchant', k: 'who.refunded' };
  if (pay.refunded_minor > 0) return { party: 'cardholder', k: 'who.partialRefund' };
  return { party: 'cardholder', k: 'who.cleared' };
}

/** Liability-shift facts for the chosen payment (fraud conditions only). */
export function liabilityShift(s) {
  if (s.channel === 'pos') return { shifted: null, k: 'ls.pos' };
  if (s.wallet) return { shifted: true, k: 'ls.wallet', conf: 'to_confirm' };
  if (s.threeDs === 'authenticated') return { shifted: true, k: 'ls.eci05', conf: 'public' };
  if (s.threeDs === 'attempted') return { shifted: true, k: 'ls.eci06', conf: 'to_confirm' };
  return { shifted: false, k: 'ls.none', conf: 'public' };
}

/** FR: the cardholder's rights track vs the interbank impayé track (research/09 §4). */
export function frTracks(res) {
  const { input, dispute, pay } = res;
  const cond = conditionOf(input.reason);
  const debit = pay.captured_at || pay.authorised_at;
  const contested = input.event === 'chargeback' ? input.eventDate : null;
  return {
    cardholder: cond?.fraud && contested ? { refund_due_by: nextBusinessDay(contested), contest_until: addMonths(debit, 13), contested } : { refund_due_by: null, contest_until: addMonths(debit, 13), contested },
    interbank: { status: dispute?.status || null, motif: cond?.cb || null, to_confirm: !cond?.cb },
  };
}

/** HTTP request each step maps to on the Harbor Bank / Banque Lumière mock. */
export function apiCall(a, s, dispute) {
  const id = 'pay_0001';
  const dsp = dispute?.dispute_id || '{{dispute_id}}';
  const card = s.cardId;
  switch (a.op) {
    case 'authorise': return { method: 'POST', path: '/payments', body: { card_id: card, amount_minor: Math.round(+s.amount * 100), currency: s.currency, channel: s.channel, merchant_id: s.merchant, three_ds: s.threeDs } };
    case 'capture': return { method: 'POST', path: `/payments/${id}/capture`, body: a.amount_minor ? { amount_minor: a.amount_minor } : undefined };
    case 'reversal': return { method: 'POST', path: `/payments/${id}/reversal`, body: { ...(a.amount_minor ? { amount_minor: a.amount_minor } : {}), reason: REVERSAL_REASONS.includes(a.reason) ? a.reason : 'customer_cancelled' } };
    case 'refund': return { method: 'POST', path: `/payments/${id}/refunds`, body: { amount_minor: a.amount_minor, reason: REFUND_REASONS.includes(a.reason) ? a.reason : 'goods_returned' } };
    case 'chargeback': return { method: 'POST', path: `/payments/${id}/disputes`, body: { condition_code: a.code, amount_minor: a.amount_minor, ...(s.fraudReport ? { fraud_report_id: s.fraudReport } : {}), ...(a.code === '13.1' ? { expected_delivery_date: s.expectedDelivery } : {}) } };
    case 'represent': return { method: 'POST', path: `/disputes/${dsp}/representment`, body: { evidence: a.evidence || [] } };
    case 'accept': return { method: 'POST', path: dispute?.status === 'pre_arbitration' ? `/disputes/${dsp}/pre-arbitration` : `/disputes/${dsp}/representment`, body: { accept: true } };
    case 'prearb': return { method: 'POST', path: `/disputes/${dsp}/pre-arbitration`, body: { accept: !!a.accept, ...(a.new_evidence ? { new_evidence: a.new_evidence } : {}) } };
    case 'advance': return { method: 'POST', path: '/_mock/clock', body: { advance_days: a.days || 1 } };
    default: return null;
  }
}

/** BPMN 2.0 XML of the dispute process (lanes Cardholder, Issuer, Scheme, Acquirer, Merchant). */
export function toBpmn(tr) {
  const lanes = ['cardholder', 'issuer', 'scheme', 'acquirer', 'merchant'];
  const H = 110, X0 = 190, W = 1500;
  const nodes = [
    ['start', 'startEvent', 'cardholder', 120, 'bpmn.start'],
    ['t1', 'task', 'cardholder', 230, 'bpmn.contest'],
    ['t2', 'task', 'issuer', 380, 'bpmn.raise'],
    ['g1', 'exclusiveGateway', 'scheme', 540, 'bpmn.allowed'],
    ['t3', 'task', 'scheme', 680, 'bpmn.route'],
    ['t4', 'task', 'acquirer', 830, 'bpmn.debit'],
    ['g2', 'exclusiveGateway', 'merchant', 980, 'bpmn.defend'],
    ['t5', 'task', 'merchant', 1120, 'bpmn.represent'],
    ['t6', 'task', 'issuer', 1270, 'bpmn.review'],
    ['g3', 'exclusiveGateway', 'issuer', 1420, 'bpmn.agree'],
    ['t7', 'task', 'scheme', 1420, 'bpmn.arbitrate'],
    ['e1', 'endEvent', 'merchant', 1560, 'bpmn.merchantWins'],
    ['e2', 'endEvent', 'acquirer', 1120, 'bpmn.merchantPays'],
    ['e3', 'endEvent', 'issuer', 680, 'bpmn.issuerPays'],
  ];
  const flows = [['start', 't1'], ['t1', 't2'], ['t2', 'g1'], ['g1', 't3', 'bpmn.yes'], ['g1', 'e3', 'bpmn.shifted'], ['t3', 't4'], ['t4', 'g2'], ['g2', 't5', 'bpmn.yes'], ['g2', 'e2', 'bpmn.no'], ['t5', 't6'], ['t6', 'g3'], ['g3', 'e1', 'bpmn.accepts'], ['g3', 't7', 'bpmn.preArb'], ['t7', 'e1']];
  const x = (s) => esc(tr(s));
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const size = (t) => (t === 'task' ? [110, 64] : t === 'exclusiveGateway' ? [44, 44] : [36, 36]);
  const ly = (lane, t, row = 0) => lanes.indexOf(lane) * H + H / 2 - size(t)[1] / 2 + row;
  const pos = Object.fromEntries(nodes.map(([id, t, lane, cx]) => [id, { x: cx - size(t)[0] / 2 + X0 - 100, y: ly(lane, t), w: size(t)[0], h: size(t)[1] }]));
  const ctr = (id) => ({ x: pos[id].x + pos[id].w / 2, y: pos[id].y + pos[id].h / 2 });
  const proc = [
    ...lanes.map((l) => `<bpmn:lane id="lane_${l}" name="${x('party.' + l)}">${nodes.filter((n) => n[2] === l).map((n) => `<bpmn:flowNodeRef>${n[0]}</bpmn:flowNodeRef>`).join('')}</bpmn:lane>`),
  ];
  const elems = nodes.map(([id, t, , , label]) => `<bpmn:${t} id="${id}" name="${x(label)}" />`);
  const fl = flows.map(([a, b, label], i) => `<bpmn:sequenceFlow id="f${i}" sourceRef="${a}" targetRef="${b}"${label ? ` name="${x(label)}"` : ''} />`);
  const shapes = [
    `<bpmndi:BPMNShape id="pool_di" bpmnElement="pool" isHorizontal="true"><dc:Bounds x="60" y="0" width="${W + 120}" height="${lanes.length * H}" /></bpmndi:BPMNShape>`,
    ...lanes.map((l, i) => `<bpmndi:BPMNShape id="lane_${l}_di" bpmnElement="lane_${l}" isHorizontal="true"><dc:Bounds x="90" y="${i * H}" width="${W + 90}" height="${H}" /></bpmndi:BPMNShape>`),
    ...nodes.map(([id, t]) => `<bpmndi:BPMNShape id="${id}_di" bpmnElement="${id}"${t === 'exclusiveGateway' ? ' isMarkerVisible="true"' : ''}><dc:Bounds x="${pos[id].x}" y="${pos[id].y}" width="${pos[id].w}" height="${pos[id].h}" /></bpmndi:BPMNShape>`),
    ...flows.map(([a, b], i) => { const p = ctr(a), q = ctr(b); return `<bpmndi:BPMNEdge id="f${i}_di" bpmnElement="f${i}"><di:waypoint x="${p.x}" y="${p.y}" /><di:waypoint x="${p.x}" y="${q.y}" /><di:waypoint x="${q.x}" y="${q.y}" /></bpmndi:BPMNEdge>`; }),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="defs_dispute" targetNamespace="https://analyst-kit.example/bpmn">
  <bpmn:collaboration id="collab"><bpmn:participant id="pool" name="${x('bpmn.pool')}" processRef="dispute" /></bpmn:collaboration>
  <bpmn:process id="dispute" isExecutable="false">
    <bpmn:laneSet id="lanes">${proc.join('')}</bpmn:laneSet>
    ${elems.join('\n    ')}
    ${fl.join('\n    ')}
  </bpmn:process>
  <bpmndi:BPMNDiagram id="diagram"><bpmndi:BPMNPlane id="plane" bpmnElement="collab">
    ${shapes.join('\n    ')}
  </bpmndi:BPMNPlane></bpmndi:BPMNDiagram>
</bpmn:definitions>
`;
}
