/* Mock card-issuer API: Harbor Bank (Visa terms, EN) and Banque Lumière (CB terms, FR). Owner C.
   Pure ES module, no DOM, no network: runs in the page (static demo), in Node (tests) and is mirrored rule for
   rule by app/server/tools/mock_bank.py (local app, /mock/harbor/v1/* and /mock/lumiere/v1/*), so exported
   curl / pytest suites hit the same behaviour. Specs: research/demo-api/harbor-bank-openapi.yaml (cards,
   authorisations, fraud reports, disputes) + tokens-and-disputes-openapi.yaml (tokens, payments, chargebacks).

   Usage (API tester, tokenization and payment-lifecycle simulators):
     import { getBank, mockRoute, mockFetch } from '../../mock/bank.js';
     const bank = getBank('harbor');                         // shared in-page singleton per brand
     const res = bank.handle({ method: 'POST', path: '/cards/crd_hb_008/block',
                               headers: { 'X-API-Key': 'hb_test_demo_key' }, body: '{"reason":"lost","channel":"app"}' });
     // res = { status: 200, headers: [[k, v]...], body: '{...}', json: {...} }
     bank.state            // live state (cards, tokens, payments, disputes...) for simulators to draw
     bank.reset()          // back to the fixtures, clock 2026-11-08
     await mockFetch({ method, url, headers: [[k, v]], body })   // tester transport, adds time_ms/size

   Nothing here is real cryptography: tokens, PAR and cryptograms are labelled demo strings. */
import FIX from './fixtures.js';

export const MOCK_HOST = 'issuer.example';
export const BRANDS = ['harbor', 'lumiere'];
export const KEYS = { harbor: 'hb_test_demo_key', lumiere: 'bl_test_demo_key' };
export const BASES = { harbor: `https://${MOCK_HOST}/harbor/v1`, lumiere: `https://${MOCK_HOST}/lumiere/v1` };
export const FIXTURES = FIX;
export const OTP = '123456';

/* ---------------------------------------------------------------- small pure helpers (ported 1:1 to Python) */
export function luhn(pan) {
  const s = String(pan);
  if (!/^\d{12,19}$/.test(s)) return false;
  let t = 0;
  for (let i = 0; i < s.length; i++) {
    let d = Number(s[s.length - 1 - i]);
    if (i % 2) { d *= 2; if (d > 9) d -= 9; }
    t += d;
  }
  return t % 10 === 0;
}
export function luhnComplete(body) {
  for (let c = 0; c < 10; c++) if (luhn(body + c)) return body + c;
  return body + '0';
}
export const maskPan = (pan) => (pan ? String(pan).slice(0, 6) + '******' + String(pan).slice(-4) : null);
const pad = (n, w) => String(n).padStart(w, '0');
const clone = (o) => JSON.parse(JSON.stringify(o));
function fnv(s) {
  let h = 0x811c9dc5;
  for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const hex8 = (n) => pad(n.toString(16), 8);
function code6(seed, prefix) {
  const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let n = fnv(seed), out = prefix || '';
  while (out.length < 6) { out += alphabet[n % 36]; n = Math.floor(n / 36) || fnv(out + seed); }
  return out;
}
function dateParts(d) { const [y, m, dd] = d.split('-').map(Number); return Date.UTC(y, m - 1, dd); }
const isoDate = (ms) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (d, n) => isoDate(dateParts(d) + n * 86400000);
export const daysBetween = (a, b) => Math.round((dateParts(b) - dateParts(a)) / 86400000);
function nextBusinessDay(d) {
  let x = addDays(d, 1);
  while ([0, 6].includes(new Date(dateParts(x)).getUTCDay())) x = addDays(x, 1);
  return x;
}
function addMonths(d, n) {
  const [y, m, dd] = d.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1 + n, 1));
  const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  return isoDate(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), Math.min(dd, last)));
}

/* ---------------------------------------------------------------- messages (EN / FR) */
const PROBLEMS = {
  'unauthorized': ['Missing or invalid API key', 'Clé d\'API absente ou invalide'],
  'forbidden': ['This key cannot write (read-only scope)', 'Cette clé ne peut pas écrire (lecture seule)'],
  'not-found': ['Not found', 'Introuvable'],
  'no-route': ['This endpoint is not part of the demo API', 'Ce point d\'accès ne fait pas partie de l\'API de démo'],
  'method-not-allowed': ['Method not allowed on this endpoint', 'Méthode non autorisée sur ce point d\'accès'],
  'invalid-json': ['Body is not valid JSON', 'Le corps n\'est pas un JSON valide'],
  'invalid-field': ['Invalid field', 'Champ invalide'],
  'unknown-test-pan': ['Not a test card of this demo', 'Pas une carte de test de cette démo'],
  'card-already-blocked': ['Card already blocked', 'Carte déjà en opposition'],
  'card-not-blocked': ['Card is not blocked', 'La carte n\'est pas en opposition'],
  'unblock-not-allowed': ['Only a lost card can be unblocked', 'Seule une carte perdue peut être réactivée'],
  'unblock-window-expired': ['Unblock window (24 h) is over', 'Le délai de réactivation (24 h) est dépassé'],
  'activity-since-block': ['A payment was attempted since the block', 'Un paiement a été tenté depuis l\'opposition'],
  'transaction-card-mismatch': ['Transaction does not belong to this card', 'L\'opération n\'appartient pas à cette carte'],
  'transaction-not-approved': ['Only approved transactions can be reported', 'Seules les opérations acceptées peuvent être déclarées'],
  'fraud-already-reported': ['Fraud already reported for this transaction', 'Fraude déjà déclarée pour cette opération'],
  'unknown-condition': ['Unknown dispute condition', 'Motif de contestation inconnu'],
  'time-limit-exceeded': ['Dispute time limit exceeded', 'Délai de contestation dépassé'],
  'fraud-report-required': ['A fraud report is required for 10.x', 'Une déclaration de fraude est requise pour 10.x'],
  'fraud-report-mismatch': ['Fraud report is for another transaction', 'La déclaration de fraude porte sur une autre opération'],
  'amount-exceeds-transaction': ['Amount is more than what is left to dispute', 'Montant supérieur au reste contestable'],
  'dispute-already-open': ['A dispute is already open on this transaction', 'Une contestation est déjà ouverte sur cette opération'],
  'idempotency-key-reused': ['Idempotency-Key reused with a different body', 'Idempotency-Key réutilisée avec un autre corps'],
  'rate-limited': ['Too many calls (over 60 a minute)', 'Trop d\'appels (plus de 60 par minute)'],
  'server-error': ['Forced server error (X-Mock-Fault)', 'Erreur serveur forcée (X-Mock-Fault)'],
  'unknown-token-requestor': ['Unknown token requestor (TRID)', 'Demandeur de jeton (TRID) inconnu'],
  'token-already-exists': ['This card already has a token on this device', 'Cette carte a déjà un jeton sur cet appareil'],
  'token-not-pending': ['Token is not waiting for ID&V', 'Le jeton n\'attend pas de vérification d\'identité'],
  'idv-failed': ['Wrong one-time code', 'Code à usage unique erroné'],
  'idv-expired': ['One-time code expired', 'Code à usage unique expiré'],
  'invalid-token-transition': ['Token status does not allow this', 'Le statut du jeton ne le permet pas'],
  'token-deleted': ['Token is deleted (final)', 'Jeton supprimé (définitif)'],
  'card-blocked': ['Card behind the token is blocked', 'La carte liée au jeton est en opposition'],
  'token-compromised': ['Token was used for fraud: delete it', 'Jeton utilisé pour une fraude : supprimez-le'],
  'token-not-active': ['Token is not active', 'Le jeton n\'est pas actif'],
  'domain-restriction': ['Channel outside the token domain', 'Canal hors du domaine du jeton'],
  'cryptogram-invalid': ['Demo cryptogram unknown or already used', 'Cryptogramme de démo inconnu ou déjà utilisé'],
  'invalid-payment-transition': ['Payment status does not allow this', 'Le statut du paiement ne le permet pas'],
  'capture-exceeds-authorisation': ['Capture is more than the authorised amount', 'Remise supérieure au montant autorisé'],
  'reversal-exceeds-authorisation': ['Reversal is more than the authorised amount', 'Annulation supérieure au montant autorisé'],
  'already-captured': ['Payment already captured', 'Paiement déjà remis en compensation'],
  'not-captured': ['Payment not captured yet', 'Paiement pas encore remis'],
  'refund-exceeds-captured': ['Refunds are more than the captured amount', 'Remboursements supérieurs au montant remis'],
  'dispute-open': ['A dispute is open on this payment', 'Une contestation est ouverte sur ce paiement'],
  'not-cleared': ['Only cleared payments can be charged back', 'Seuls les paiements compensés peuvent faire l\'objet d\'un impayé'],
  'credit-already-processed': ['Credit already processed', 'Remboursement déjà effectué'],
  'liability-shifted': ['Fraud liability shifted to the issuer', 'Responsabilité de la fraude transférée à l\'émetteur'],
  'too-early': ['Too early: expected delivery date not passed', 'Trop tôt : la date de livraison prévue n\'est pas passée'],
  'response-window-closed': ['Response window closed', 'Délai de réponse dépassé'],
  'no-response-step': ['Allocation disputes have no merchant response step', 'Pas d\'étape de réponse du commerçant en allocation'],
};
const AUTH_MSG = {
  '00': ['Approved', 'Acceptée'], '05': ['Do not honour', 'Refusée (ne pas honorer)'], '41': ['Lost card', 'Carte perdue'],
  '43': ['Stolen card', 'Carte volée'], '51': ['Insufficient funds', 'Provision insuffisante'], '54': ['Expired card', 'Carte expirée'],
  '59': ['Suspected fraud', 'Suspicion de fraude'], '91': ['Issuer unavailable', 'Émetteur indisponible'],
};
const STIP_MSG = ['Approved in Stand-In Processing', 'Acceptée en traitement de secours (STIP)'];
const STATUS_TEXT = { 200: 'OK', 201: 'Created', 204: 'No Content', 400: 'Bad Request', 401: 'Unauthorized', 403: 'Forbidden',
  404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 422: 'Unprocessable Content', 429: 'Too Many Requests',
  500: 'Internal Server Error', 503: 'Service Unavailable', 504: 'Gateway Timeout' };
export const statusText = (s) => STATUS_TEXT[s] || '';

const ENUMS = {
  currency: ['EUR', 'USD', 'GBP'], auth_channel: ['pos', 'ecom', 'atm'], entry_mode: ['CHIP', 'CONTACTLESS', 'ECOM', 'MAGSTRIPE', 'MANUAL'],
  block_reason: ['lost', 'stolen', 'used_without_permission'], block_channel: ['app', 'call_centre'], declared_by: ['cardholder', 'agent'],
  fraud_type: ['0', '1', '2', '3', '4', '5', '6'], wallet: ['apple_pay', 'google_pay', 'merchant_card_on_file'],
  device_type: ['phone', 'watch', 'tablet', 'browser'], device_risk: ['low', 'medium', 'high'],
  idv_method: ['sms_otp', 'issuer_app', 'call_centre'],
  lifecycle_reason: ['device_lost', 'device_found', 'card_blocked_lost', 'card_blocked_stolen', 'card_replaced', 'fraud_on_token', 'cardholder_request', 'card_closed'],
  requested_by: ['cardholder', 'issuer', 'wallet', 'tsp'], crypto_channel: ['contactless', 'in_app', 'web', 'card_on_file'],
  pay_channel: ['pos', 'ecom', 'in_app', 'contactless'], three_ds: ['authenticated', 'attempted', 'none'],
  reversal_reason: ['customer_cancelled', 'merchant_cancelled', 'final_amount_lower', 'duplicate', 'timeout'],
  refund_reason: ['goods_returned', 'service_cancelled', 'goodwill', 'duplicate'],
  evidence: ['proof_of_delivery', 'signed_delivery', 'tracking_only', 'refund_issued', 'product_description', 'return_policy',
    'cancellation_policy_accepted', 'two_separate_orders', 'compelling_evidence_3_0', 'authorisation_proof'],
};
const WIN_EVIDENCE = { '13.1': [['proof_of_delivery']], '13.3': [['product_description', 'return_policy']],
  '13.6': [['refund_issued'], ['cancellation_policy_accepted']], '13.7': [['refund_issued'], ['cancellation_policy_accepted']],
  '12.6': [['two_separate_orders']], '10.4': [['compelling_evidence_3_0']] };
const OPEN_DISPUTE = ['submitted', 'acquirer_responded', 'pre_arbitration', 'chargeback', 'represented', 'arbitration'];
const RATE_LIMIT = 60;

class Reply {
  constructor(status, body, headers) { this.status = status; this.body = body; this.headers = headers || []; }
}

/* ---------------------------------------------------------------- the bank */
export class MockBank {
  constructor(brand = 'harbor') {
    if (!FIX.brands[brand]) throw new Error('Unknown mock brand ' + brand);
    this.brand = brand;
    this.cfg = FIX.brands[brand];
    this.fr = this.cfg.lang === 'fr';
    this.listeners = [];
    this.reset();
  }

  reset() {
    const c = this.cfg;
    const cards = {};
    c.cards.forEach((card, i) => {
      const x = clone(card);
      delete x.expect;
      x.block = x.block || null;
      x.par = 'Z999FAKEPAR' + pad(c.par_offset + i + 1, 18);
      x.activity_since_block = false;
      cards[x.card_id] = x;
    });
    const payments = {};
    c.payments.forEach((p, i) => {
      const x = clone(p);
      x.authorised_minor = x.amount_minor; delete x.amount_minor;
      Object.assign(x, { response_code: '00', captured_minor: x.status === 'captured' ? x.authorised_minor : 0, reversed_minor: 0,
        refunded_minor: 0, disputed_minor: 0, wallet: false, authentication: x.three_ds === 'none' ? 'none' : '3ds', token_ref: null,
        arn: x.captured_at ? c.arn_prefix + pad(9000 + i + 1, 12) : null, refunds: [] });
      x.timeline = [{ at: x.authorised_at, event: 'authorised', amount_minor: x.authorised_minor }];
      if (x.captured_at) x.timeline.push({ at: x.captured_at, event: 'captured', amount_minor: x.captured_minor });
      payments[x.payment_id] = x;
    });
    this.state = {
      today: FIX.today, tick: 0, seq: { auth: 0, fraud: 1200, dispute: 30, ldispute: 100, token: 0, payment: c.payments.length, req: 0, repl: 0 },
      cards, payments,
      transactions: Object.fromEntries(c.transactions.map((t) => [t.transaction_id, clone(t)])),
      fraud_reports: Object.fromEntries(c.fraud_reports.map((r) => [r.fraud_report_id, clone(r)])),
      disputes: Object.fromEntries(c.disputes.map((d) => [d.dispute_id, Object.assign(clone(d), { kind: 'base' })])),
      authorisations: {}, tokens: {}, cryptograms: {}, idempotency: {}, calls: [],
    };
    this.emit();
  }

  onChange(fn) { this.listeners.push(fn); return () => { this.listeners = this.listeners.filter((f) => f !== fn); }; }
  emit() { this.listeners.forEach((fn) => { try { fn(this.state); } catch (e) { /* listener bug must not break the mock */ } }); }

  now() {
    const s = this.state;
    s.tick += 1;
    return new Date(dateParts(s.today) + 10 * 3600000 + s.tick * 1000).toISOString().replace('.000Z', 'Z');
  }
  t(en, fr) { return this.fr ? fr : en; }

  problem(status, slug, detail, rule, extra) {
    const [en, fr] = PROBLEMS[slug] || [slug, slug];
    const body = { type: this.cfg.problem_base + slug, title: this.fr ? fr : en, status };
    if (detail) body.detail = detail;
    if (rule) body.rule = rule;
    return new Reply(status, Object.assign(body, extra || {}), [['Content-Type', 'application/problem+json']]);
  }
  bad(field, detail) { return this.problem(400, 'invalid-field', detail || this.t(`${field} is invalid`, `${field} est invalide`), null, { field }); }

  /* ---- public entry point: {method, path, headers, body} -> {status, headers, body, json} */
  handle({ method = 'GET', path = '/', headers = {}, body = '' } = {}) {
    const h = {};
    for (const [k, v] of Array.isArray(headers) ? headers : Object.entries(headers || {})) if (k) h[String(k).toLowerCase()] = String(v);
    const m = String(method).toUpperCase();
    const p = ('/' + String(path).split('?')[0].replace(/^\/+/, '')).replace(/\/+$/, '') || '/';
    let reply;
    try {
      reply = this.dispatch(m, p, h, body == null ? '' : String(body));
    } catch (e) {
      reply = this.problem(500, 'server-error', String(e && e.message || e));
    }
    this.state.seq.req += 1;
    const out = [['Content-Type', 'application/json'], ['X-Request-Id', 'req_' + this.brand + '_' + pad(this.state.seq.req, 5)],
      ['X-Mock-Clock', this.state.today]];
    for (const [k, v] of reply.headers) {
      const i = out.findIndex(([ok]) => ok.toLowerCase() === k.toLowerCase());
      if (i >= 0) out[i] = [k, v]; else out.push([k, v]);
    }
    const text = reply.body == null ? '' : JSON.stringify(reply.body, null, 2);
    if (reply.body == null) out.splice(out.findIndex(([k]) => k === 'Content-Type'), 1);
    this.emit();
    return { status: reply.status, reason: statusText(reply.status), headers: out, body: text, json: reply.body == null ? null : clone(reply.body) };
  }

  dispatch(m, p, h, raw) {
    const s = this.state;
    if (p === '/_mock/reset') {
      if (m !== 'POST') return this.problem(405, 'method-not-allowed');
      this.reset();
      return new Reply(204, null);
    }
    if (p === '/_mock/state' && m === 'GET') return new Reply(200, this.publicState());
    let b = {};
    if (raw.trim()) {
      try { b = JSON.parse(raw); } catch (e) { return this.problem(400, 'invalid-json', this.t('Fix the JSON syntax of the body.', 'Corrigez la syntaxe JSON du corps.')); }
      if (b === null || typeof b !== 'object' || Array.isArray(b)) return this.problem(400, 'invalid-json', this.t('The body must be a JSON object.', 'Le corps doit être un objet JSON.'));
    }
    if (p === '/_mock/clock') {
      if (m !== 'POST') return this.problem(405, 'method-not-allowed');
      const n = b.advance_days;
      if (!Number.isInteger(n) || n < 1 || n > 400) return this.bad('advance_days', this.t('advance_days must be a whole number from 1 to 400', 'advance_days doit être un entier de 1 à 400'));
      s.today = addDays(s.today, n);
      return new Reply(200, { today: s.today });
    }
    // rate limit (60 calls a minute, real time), mock controls excluded
    const nowMs = Date.now();
    s.calls = s.calls.filter((t) => nowMs - t < 60000);
    if (s.calls.length >= RATE_LIMIT) {
      const r = this.problem(429, 'rate-limited', this.t('Wait 30 s or call POST /_mock/reset.', 'Attendez 30 s ou appelez POST /_mock/reset.'));
      r.headers.push(['Retry-After', '30']);
      return r;
    }
    s.calls.push(nowMs);

    const scope = this.cfg.keys[h['x-api-key'] || ''];
    if (!scope) return this.problem(401, 'unauthorized', this.t(`Send the header X-API-Key: ${KEYS[this.brand]}`, `Envoyez l'en-tête X-API-Key: ${KEYS[this.brand]}`));
    const fault = h['x-mock-fault'];
    if (['500', '503', '504'].includes(fault)) return this.problem(Number(fault), 'server-error', this.t(`Forced by X-Mock-Fault: ${fault}`, `Forcée par X-Mock-Fault: ${fault}`));
    if (m !== 'GET' && scope !== 'all') return this.problem(403, 'forbidden', this.t('Use the full demo key for writes.', 'Utilisez la clé de démo complète pour écrire.'), p.startsWith('/disputes') || /\/disputes$/.test(p) ? 'D6' : null);

    // idempotency (all POSTs): same key + same body -> same answer; same key + other body -> 409
    const idem = m === 'POST' ? h['idempotency-key'] : '';
    const fp = m + ' ' + p + ' ' + JSON.stringify(b);
    if (idem) {
      const prev = s.idempotency[idem];
      if (prev) {
        if (prev.fp !== fp) return this.problem(409, 'idempotency-key-reused', this.t('Use a new Idempotency-Key for a different request.', 'Utilisez une nouvelle Idempotency-Key pour une autre requête.'), 'B5');
        return new Reply(prev.status, clone(prev.body), [...prev.headers, ['Idempotent-Replayed', 'true']]);
      }
    }
    const reply = this.route(m, p, h, b);
    if (idem && reply.status < 500) s.idempotency[idem] = { fp, status: reply.status, body: clone(reply.body), headers: reply.headers };
    return reply;
  }

  route(m, p, h, b) {
    let x;
    const R = [
      ['GET', /^\/cards\/([^/]+)$/, (id) => this.getCard(id)],
      ['POST', /^\/cards\/([^/]+)\/block$/, (id) => this.block(id, b)],
      ['POST', /^\/cards\/([^/]+)\/unblock$/, (id) => this.unblock(id)],
      ['POST', /^\/authorisations$/, () => this.authorise(b)],
      ['GET', /^\/authorisations\/([^/]+)$/, (id) => (this.state.authorisations[id] ? new Reply(200, clone(this.state.authorisations[id])) : this.notFound(id))],
      ['POST', /^\/fraud-reports$/, () => this.fraudReport(b)],
      ['POST', /^\/disputes$/, () => this.dispute(b)],
      ['GET', /^\/disputes\/([^/]+)$/, (id) => this.getDispute(id)],
      ['POST', /^\/disputes\/([^/]+)\/representment$/, (id) => this.represent(id, b, h)],
      ['POST', /^\/disputes\/([^/]+)\/pre-arbitration$/, (id) => this.preArbitration(id, b)],
      ['POST', /^\/tokens$/, () => this.provision(b)],
      ['GET', /^\/tokens\/([^/]+)$/, (id) => this.getToken(id)],
      ['POST', /^\/tokens\/([^/]+)\/idv$/, (id) => this.idv(id, b)],
      ['POST', /^\/tokens\/([^/]+)\/(suspend|resume|delete)$/, (id, op) => this.lifecycle(id, op, b)],
      ['POST', /^\/tokens\/([^/]+)\/cryptogram$/, (id) => this.cryptogram(id, b)],
      ['POST', /^\/payments$/, () => this.pay(b)],
      ['GET', /^\/payments\/([^/]+)$/, (id) => this.getPayment(id)],
      ['POST', /^\/payments\/([^/]+)\/capture$/, (id) => this.capture(id, b)],
      ['POST', /^\/payments\/([^/]+)\/reversal$/, (id) => this.reverse(id, b)],
      ['POST', /^\/payments\/([^/]+)\/refunds$/, (id) => this.refund(id, b)],
      ['POST', /^\/payments\/([^/]+)\/disputes$/, (id) => this.chargeback(id, b)],
    ];
    let pathKnown = false;
    for (const [meth, rx, fn] of R) {
      if ((x = p.match(rx))) {
        pathKnown = true;
        if (meth === m) return fn(...x.slice(1).map(decodeURIComponent));
      }
    }
    if (pathKnown) return this.problem(405, 'method-not-allowed', `${m} ${p}`);
    return this.problem(404, 'no-route', this.t(`${m} ${p} is not part of the demo API. See the endpoint list in the API tester.`, `${m} ${p} ne fait pas partie de l'API de démo. Voir la liste des points d'accès dans le testeur.`));
  }

  notFound(id) { return this.problem(404, 'not-found', this.t(`No object with id ${id}`, `Aucun objet avec l'identifiant ${id}`)); }

  /* ---- views */
  cardView(c) {
    const out = { card_id: c.card_id, pan_masked: maskPan(c.pan), brand: this.cfg.brand, issuer: this.cfg.issuer, product: c.product,
      status: c.status, block: c.block ? clone(c.block) : null, expiry: c.expiry, available_minor: c.available_minor, currency: c.currency,
      wallet_tokens: clone(c.wallet_tokens || []) };
    for (const wt of out.wallet_tokens) delete wt.suspended_by_block;
    for (const tk of Object.values(this.state.tokens)) {
      if (tk.card_id === c.card_id && tk.status !== 'declined') out.wallet_tokens.push({ token_id: tk.token_ref, wallet: tk.wallet, status: tk.status });
    }
    if (c.replacement) out.replacement = clone(c.replacement);
    if (c.replaces) out.replaces = c.replaces;
    if (c.refund_due_by) out.refund_due_by = c.refund_due_by;
    return out;
  }
  tokenView(tk) {
    const out = clone(tk);
    delete out.token_number; delete out.attempts;
    return out;
  }
  paymentView(p) {
    const out = clone(p);
    delete out.refunds;
    return out;
  }
  publicState() {
    const s = this.state;
    return { brand: this.brand, today: s.today,
      cards: Object.values(s.cards).map((c) => this.cardView(c)),
      tokens: Object.values(s.tokens).map((t) => this.tokenView(t)),
      payments: Object.values(s.payments).map((p) => this.paymentView(p)),
      disputes: Object.values(s.disputes).map((d) => clone(d)),
      fraud_reports: Object.values(s.fraud_reports).map((r) => clone(r)),
      authorisations: Object.values(s.authorisations).map((a) => clone(a)) };
  }

  /* ---- cards */
  getCard(id) {
    const c = this.state.cards[id];
    return c ? new Reply(200, this.cardView(c)) : this.notFound(id);
  }
  block(id, b) {
    const s = this.state;
    const c = s.cards[id];
    if (!c) return this.notFound(id);
    if (!ENUMS.block_reason.includes(b.reason)) return this.problem(400, 'invalid-field', this.t('reason must be one of lost, stolen, used_without_permission', 'reason doit valoir lost, stolen ou used_without_permission'), 'B1', { field: 'reason' });
    if (!ENUMS.block_channel.includes(b.channel)) return this.problem(400, 'invalid-field', this.t('channel must be one of app, call_centre', 'channel doit valoir app ou call_centre'), 'B1', { field: 'channel' });
    if (b.declared_by != null && !ENUMS.declared_by.includes(b.declared_by)) return this.bad('declared_by');
    if (c.status === 'blocked') return this.problem(409, 'card-already-blocked', this.t(`Card ${id} was blocked on ${c.block && c.block.blocked_at}`, `La carte ${id} est en opposition depuis le ${c.block && c.block.blocked_at}`), 'B2');
    const at = this.now();
    c.status = 'blocked';
    c.activity_since_block = false;
    c.block = { reason: b.reason, blocked_at: at, channel: b.channel, exception_file: 'listed',
      unblock_allowed_until: b.reason === 'lost' ? new Date(Date.parse(at) + 86400000).toISOString().replace('.000Z', 'Z') : null };
    for (const wt of c.wallet_tokens || []) if (wt.status === 'active') { wt.status = 'suspended'; wt.suspended_by_block = true; }
    for (const tk of Object.values(s.tokens)) {
      if (tk.card_id === id && ['active', 'pending_idv'].includes(tk.status)) {
        tk.status = 'suspended'; tk.suspend_reason = 'card_blocked_' + (b.reason === 'used_without_permission' ? 'stolen' : b.reason);
        tk.suspended_by_block = true;
        tk.history.push({ at, event: 'suspended', by: 'issuer', reason: tk.suspend_reason });
      }
    }
    if (b.reason !== 'used_without_permission' && !c.replacement) {
      s.seq.repl += 1;
      const rid = id + '_r1';
      const n = Object.keys(s.cards).length + s.seq.repl;
      const rpan = luhnComplete(c.pan.slice(0, 12) + '9' + pad(n % 100, 2));
      s.cards[rid] = { card_id: rid, pan: rpan, expiry: addMonths(s.today, 48).slice(0, 7), product: c.product, status: 'active',
        available_minor: c.available_minor, currency: c.currency, wallet_tokens: [], block: null, par: c.par, activity_since_block: false, replaces: id };
      c.replacement = { ordered: true, card_id: rid };
    }
    if (this.fr) c.refund_due_by = nextBusinessDay(s.today);
    return new Reply(200, this.cardView(c));
  }
  unblock(id) {
    const s = this.state;
    const c = s.cards[id];
    if (!c) return this.notFound(id);
    if (c.status !== 'blocked' || !c.block) return this.problem(409, 'card-not-blocked', this.t(`Card ${id} is ${c.status}`, `La carte ${id} est ${c.status}`));
    if (c.block.reason !== 'lost') return this.problem(422, 'unblock-not-allowed', this.t(`Reason is ${c.block.reason}: the cardholder needs a new card number`, `Motif ${c.block.reason} : le porteur a besoin d'un nouveau numéro de carte`), 'U1');
    const at = this.now();
    if (!c.block.unblock_allowed_until || at > c.block.unblock_allowed_until) return this.problem(422, 'unblock-window-expired', this.t(`Unblock was allowed until ${c.block.unblock_allowed_until}`, `La réactivation était possible jusqu'au ${c.block.unblock_allowed_until}`), 'U2');
    if (c.activity_since_block) return this.problem(422, 'activity-since-block', this.t('An authorisation was attempted after the block', 'Une autorisation a été tentée après l\'opposition'), 'U3');
    c.status = 'active';
    c.block = null;
    delete c.refund_due_by;
    for (const wt of c.wallet_tokens || []) if (wt.suspended_by_block) { wt.status = 'active'; delete wt.suspended_by_block; }
    for (const tk of Object.values(s.tokens)) {
      if (tk.card_id === id && tk.status === 'suspended' && tk.suspended_by_block) {
        tk.status = 'active'; delete tk.suspended_by_block; delete tk.suspend_reason;
        tk.history.push({ at, event: 'resumed', by: 'issuer', reason: 'card_unblocked' });
      }
    }
    if (c.replacement) { delete s.cards[c.replacement.card_id]; delete c.replacement; }
    return new Reply(200, this.cardView(c));
  }
  cardByPan(pan) { return Object.values(this.state.cards).find((c) => c.pan === pan) || null; }
  unknownPan(pan) {
    const fixed = FIX.legacy_pans[pan];
    const detail = fixed
      ? this.t(`${pan} is the old (non-Luhn) fixture number. Use ${fixed}.`, `${pan} est l'ancien numéro de test (Luhn faux). Utilisez ${fixed}.`)
      : this.t('Only the demo test cards work. Never paste a real card number.', 'Seules les cartes de test de la démo fonctionnent. Ne collez jamais un vrai numéro de carte.');
    return this.problem(422, 'unknown-test-pan', detail, 'A1', { field: 'pan' });
  }

  /* ---- issuer decision A1-A7 (shared by /authorisations and /payments) */
  decide(card, amount, channel) {
    const s = this.state;
    if (card.status === 'blocked') card.activity_since_block = true;
    const blockCode = (r) => (r === 'lost' ? '41' : r === 'stolen' ? '43' : '05');
    if (card.issuer_host === 'down') {
      if (!card.stand_in) return { code: '91', stip: false };
      if (card.status === 'blocked' && card.block && card.block.exception_file === 'listed') return { code: blockCode(card.block.reason), stip: true };
      return { code: amount <= card.stip_limit_minor ? '00' : '05', stip: true };
    }
    if (card.status === 'blocked') return { code: blockCode(card.block && card.block.reason), stip: false };
    if (card.expiry < s.today.slice(0, 7)) return { code: '54', stip: false };
    if (card.fraud_watch && channel === 'ecom') return { code: '59', stip: false };
    if (amount > card.available_minor) return { code: '51', stip: false };
    return { code: '00', stip: false };
  }
  validAmount(v) { return Number.isInteger(v) && v >= 1 && v <= 10000000; }
  authorise(b) {
    const s = this.state;
    for (const f of ['pan', 'expiry', 'amount_minor', 'currency', 'channel']) if (b[f] == null || b[f] === '') return this.bad(f, this.t(`${f} is required`, `${f} est obligatoire`));
    const pan = String(b.pan).replace(/\s/g, '');
    const card = this.cardByPan(pan);
    if (!card) return this.unknownPan(pan);
    if (!/^\d{4}-\d{2}$/.test(String(b.expiry))) return this.bad('expiry', this.t('expiry must look like 2029-04', 'expiry doit ressembler à 2029-04'));
    if (!this.validAmount(b.amount_minor)) return this.bad('amount_minor', this.t('amount_minor must be a whole number of cents from 1 to 10000000', 'amount_minor doit être un entier en centimes de 1 à 10000000'));
    if (!ENUMS.currency.includes(b.currency)) return this.bad('currency', this.t('currency must be EUR, USD or GBP', 'currency doit valoir EUR, USD ou GBP'));
    if (!ENUMS.auth_channel.includes(b.channel)) return this.bad('channel', this.t('channel must be one of pos, ecom, atm', 'channel doit valoir pos, ecom ou atm'));
    if (b.entry_mode != null && !ENUMS.entry_mode.includes(b.entry_mode)) return this.bad('entry_mode');
    const d = this.decide(card, b.amount_minor, b.channel);
    s.seq.auth += 1;
    const id = 'auth_' + pad(s.seq.auth, 4);
    const approved = d.code === '00';
    if (approved && !d.stip) card.available_minor -= b.amount_minor;
    const msg = approved && d.stip ? STIP_MSG : AUTH_MSG[d.code];
    const a = { auth_id: id, response_code: d.code, approved, message: this.fr ? msg[1] : msg[0],
      auth_code: approved ? code6(this.brand + id + pan, d.stip ? 'S' : '') : null, stip: d.stip,
      amount_minor: b.amount_minor, currency: b.currency, card_id: card.card_id, channel: b.channel,
      merchant_id: b.merchant_id || null, created_at: this.now() };
    s.authorisations[id] = a;
    return new Reply(200, clone(a));
  }

  /* ---- fraud reports F1-F5 */
  fraudReport(b) {
    const s = this.state;
    for (const f of ['transaction_id', 'card_id', 'fraud_type', 'case_id']) if (b[f] == null || b[f] === '') return this.bad(f, this.t(`${f} is required`, `${f} est obligatoire`));
    if (!ENUMS.fraud_type.includes(String(b.fraud_type))) return this.problem(400, 'invalid-field', this.t('fraud_type must be 0 to 6 (values to confirm against current Visa rules)', 'fraud_type doit valoir de 0 à 6 (liste à confirmer)'), 'F2', { field: 'fraud_type' });
    const tx = s.transactions[b.transaction_id];
    if (!tx) return this.notFound(b.transaction_id);
    if (tx.card_id !== b.card_id) return this.problem(422, 'transaction-card-mismatch', this.t(`Transaction belongs to ${tx.card_id}`, `L'opération appartient à ${tx.card_id}`), 'F1');
    if (!tx.approved) return this.problem(422, 'transaction-not-approved', this.t(`Transaction was declined (${tx.response_code})`, `Opération refusée (${tx.response_code})`), 'F3');
    const dup = Object.values(s.fraud_reports).find((r) => r.transaction_id === tx.transaction_id);
    if (dup) return this.problem(409, 'fraud-already-reported', this.t(`Already reported as ${dup.fraud_report_id}`, `Déjà déclarée sous ${dup.fraud_report_id}`), 'F4');
    s.seq.fraud += 1;
    const r = { fraud_report_id: 'FR-2026-' + pad(s.seq.fraud, 4), transaction_id: tx.transaction_id, card_id: tx.card_id,
      fraud_type: String(b.fraud_type), case_id: b.case_id, confirmed_at: b.confirmed_at || null, status: 'sent',
      amount_minor: tx.amount_minor, currency: tx.currency, reported_at: this.now() };
    s.fraud_reports[r.fraud_report_id] = r;
    return new Reply(201, clone(r));
  }

  /* ---- disputes on a transaction D1-D6 */
  conditionOk(code) { return Object.prototype.hasOwnProperty.call(FIX.conditions, String(code)); }
  dispute(b) {
    const s = this.state;
    for (const f of ['transaction_id', 'condition_code', 'amount_minor', 'currency']) if (b[f] == null || b[f] === '') return this.bad(f, this.t(`${f} is required`, `${f} est obligatoire`));
    if (!Number.isInteger(b.amount_minor) || b.amount_minor < 1) return this.bad('amount_minor', this.t('amount_minor must be a whole number of cents, 1 or more', 'amount_minor doit être un entier en centimes, au moins 1'));
    const tx = s.transactions[b.transaction_id];
    if (!tx) return this.notFound(b.transaction_id);
    const code = String(b.condition_code);
    if (!this.conditionOk(code)) return this.problem(422, 'unknown-condition', this.t(`${code} is not a handled Visa condition (10.x, 11.x, 12.x, 13.x)`, `${code} n'est pas un motif traité (10.x, 11.x, 12.x, 13.x)`), 'D1');
    const age = daysBetween(tx.date, s.today);
    if (age > 120) return this.problem(422, 'time-limit-exceeded', this.t(`Transaction is ${age} days old (limit 120)`, `L'opération date de ${age} jours (limite 120)`), 'D2');
    if (code.startsWith('10.')) {
      if (!b.fraud_report_id) return this.problem(422, 'fraud-report-required', this.t('Send the fraud report first (POST /fraud-reports), then its fraud_report_id', 'Envoyez d\'abord la déclaration de fraude (POST /fraud-reports), puis son fraud_report_id'), 'D3');
      const fr = s.fraud_reports[b.fraud_report_id];
      if (!fr || fr.transaction_id !== tx.transaction_id) return this.problem(422, 'fraud-report-mismatch', this.t(`${b.fraud_report_id} does not cover this transaction`, `${b.fraud_report_id} ne couvre pas cette opération`), 'D3');
    }
    const open = Object.values(s.disputes).find((d) => d.transaction_id === tx.transaction_id && OPEN_DISPUTE.includes(d.status));
    if (open) return this.problem(409, 'dispute-already-open', this.t(`${open.dispute_id} is still open`, `${open.dispute_id} est toujours ouverte`), 'D5');
    const used = Object.values(s.disputes).filter((d) => d.transaction_id === tx.transaction_id && d.status !== 'withdrawn').reduce((n, d) => n + d.amount_minor, 0);
    if (b.amount_minor > tx.amount_minor - used) return this.problem(422, 'amount-exceeds-transaction', this.t(`At most ${tx.amount_minor - used} can be disputed`, `Au plus ${tx.amount_minor - used} peut être contesté`), 'D4');
    s.seq.dispute += 1;
    const at = this.now();
    const d = { dispute_id: 'DSP-2026-' + pad(s.seq.dispute, 4), transaction_id: tx.transaction_id, condition_code: code,
      condition: FIX.conditions[code], amount_minor: b.amount_minor, currency: b.currency, status: 'submitted',
      fraud_report_id: b.fraud_report_id || null, opened_at: at, respond_by: null, history: [{ at, status: 'submitted' }], kind: 'base' };
    if (this.fr) { d.refund_due_by = nextBusinessDay(s.today); d.contest_until = addMonths(tx.date, 13); }
    s.disputes[d.dispute_id] = d;
    return new Reply(201, this.disputeView(d), [['Location', '/disputes/' + d.dispute_id]]);
  }
  disputeView(d) { const o = clone(d); delete o.kind; delete o.evidence_on_file; return o; }
  getDispute(id) {
    const d = this.state.disputes[id];
    return d ? new Reply(200, this.disputeView(d)) : this.notFound(id);
  }

  /* ---- tokens T1-T18 */
  provision(b) {
    const s = this.state;
    for (const f of ['pan', 'expiry', 'wallet', 'token_requestor_id', 'device_id']) if (b[f] == null || b[f] === '') return this.bad(f, this.t(`${f} is required`, `${f} est obligatoire`));
    if (!ENUMS.wallet.includes(b.wallet)) return this.bad('wallet', this.t('wallet must be apple_pay, google_pay or merchant_card_on_file', 'wallet doit valoir apple_pay, google_pay ou merchant_card_on_file'));
    if (b.device_type != null && !ENUMS.device_type.includes(b.device_type)) return this.bad('device_type');
    if (b.device_risk != null && !ENUMS.device_risk.includes(b.device_risk)) return this.bad('device_risk');
    const pan = String(b.pan).replace(/\s/g, '');
    const card = this.cardByPan(pan);
    if (!card) { const r = this.unknownPan(pan); r.body.rule = 'T1'; return r; }
    const trq = FIX.token_requestors.find((t) => t.token_requestor_id === String(b.token_requestor_id));
    if (!trq) return this.problem(422, 'unknown-token-requestor', this.t('Use a demo TRID: 40010030273 (Apple Pay), 40010075001 (Google Pay), 40010099001 (card-on-file)', 'Utilisez un TRID de démo : 40010030273 (Apple Pay), 40010075001 (Google Pay), 40010099001 (carte enregistrée)'), 'T2');
    const at = this.now();
    let reason = null;
    if (card.status === 'blocked') reason = 'card_blocked_' + (card.block && card.block.reason);
    else if (card.status === 'expired' || card.expiry < s.today.slice(0, 7)) reason = 'card_expired';
    else if (card.fraud_watch) reason = 'fraud_watch';
    if (reason) return new Reply(201, { token_ref: null, decision: 'red', status: 'declined', card_id: card.card_id, pan_masked: maskPan(card.pan), decision_reason: reason, rule: 'T3', demo_only: true });
    const dupe = Object.values(s.tokens).find((t) => t.card_id === card.card_id && t.device_id === b.device_id && ['active', 'pending_idv', 'suspended'].includes(t.status));
    if (dupe) return this.problem(409, 'token-already-exists', this.t(`${dupe.token_ref} already exists on ${b.device_id}`, `${dupe.token_ref} existe déjà sur ${b.device_id}`), 'T4');
    if (b.device_risk === 'high') return new Reply(201, { token_ref: null, decision: 'red', status: 'declined', card_id: card.card_id, pan_masked: maskPan(card.pan), decision_reason: 'device_risk_high', rule: 'T5', demo_only: true });
    const yellow = b.device_risk === 'medium' || (Number.isInteger(b.wallet_account_age_days) && b.wallet_account_age_days < 30);
    s.seq.token += 1;
    const ref = this.cfg.token_prefix + pad(s.seq.token, 4);
    const number = luhnComplete('400099' + (this.brand === 'harbor' ? '000000' : '000001') + pad(s.seq.token, 3));
    const channels = trq.device_bound ? ['contactless', 'in_app', 'web'] : ['card_on_file', 'web'];
    const tk = { token_ref: ref, decision: yellow ? 'yellow' : 'green', status: yellow ? 'pending_idv' : 'active', card_id: card.card_id,
      pan_masked: maskPan(card.pan), token_number: number, token_masked: maskPan(number), token_expiry: card.expiry, par: card.par,
      wallet: b.wallet, token_requestor_id: trq.token_requestor_id, device_id: b.device_id, device_type: b.device_type || null,
      domain_restrictions: { channels, token_requestor_id: trq.token_requestor_id, device_bound: trq.device_bound },
      assurance: { idv_method: 'none', level: yellow ? 'pending' : 'issuer_approved' },
      views: { wallet_sees: ['token_ref', 'token_masked', 'card art', 'last 4 of PAN'],
        device_secure_element_holds: ['token (device account number)', 'cryptogram key (demo: none)'],
        merchant_sees: ['token_masked', 'cryptogram', 'eci', 'par'], issuer_sees: ['pan', 'token_ref', 'par', 'device_id', 'wallet'] },
      history: [{ at, event: yellow ? 'idv_requested' : 'provisioned', by: 'issuer' }], atc: 0, attempts: 0, demo_only: true };
    if (yellow) {
      tk.idv_methods = [{ method: 'sms_otp', target: '+33 6** ** ** 42' }, { method: 'issuer_app' }, { method: 'call_centre' }];
      tk.idv_expires_at = new Date(Date.parse(at) + 600000).toISOString().replace('.000Z', 'Z');
      tk.demo_otp = OTP;
    }
    s.tokens[ref] = tk;
    return new Reply(201, this.tokenView(tk));
  }
  getToken(ref) {
    const tk = this.state.tokens[ref];
    return tk ? new Reply(200, this.tokenView(tk)) : this.notFound(ref);
  }
  idv(ref, b) {
    const tk = this.state.tokens[ref];
    if (!tk) return this.notFound(ref);
    if (tk.status !== 'pending_idv') return this.problem(409, 'token-not-pending', this.t(`Token is ${tk.status}`, `Le jeton est ${tk.status}`), 'T8');
    if (!ENUMS.idv_method.includes(b.method)) return this.bad('method', this.t('method must be sms_otp, issuer_app or call_centre', 'method doit valoir sms_otp, issuer_app ou call_centre'));
    const at = this.now();
    if (at > tk.idv_expires_at) return this.problem(422, 'idv-expired', this.t(`Code expired at ${tk.idv_expires_at}`, `Code expiré à ${tk.idv_expires_at}`), 'T10');
    if (b.method === 'sms_otp' && String(b.otp || '') !== OTP) {
      tk.attempts += 1;
      if (tk.attempts >= 3) {
        tk.status = 'deleted'; tk.decision = 'red';
        tk.history.push({ at, event: 'deleted', by: 'issuer', reason: 'idv_failed_3_times' });
        return this.problem(422, 'idv-failed', this.t('3 wrong codes: the token is deleted', '3 codes erronés : le jeton est supprimé'), 'T9', { attempts_left: 0 });
      }
      return this.problem(422, 'idv-failed', this.t(`Wrong code. Demo code is ${OTP}.`, `Code erroné. Le code de démo est ${OTP}.`), 'T9', { attempts_left: 3 - tk.attempts });
    }
    tk.status = 'active';
    tk.assurance = { idv_method: b.method, level: 'issuer_verified' };
    delete tk.demo_otp;
    tk.history.push({ at, event: 'provisioned', by: 'issuer', idv: b.method });
    return new Reply(200, this.tokenView(tk));
  }
  lifecycle(ref, op, b) {
    const s = this.state;
    const tk = s.tokens[ref];
    if (!tk) return this.notFound(ref);
    if (tk.status === 'deleted') return this.problem(409, 'token-deleted', this.t('Deleted is final. Provision a new token.', 'La suppression est définitive. Créez un nouveau jeton.'), 'T15');
    if (!ENUMS.lifecycle_reason.includes(b.reason)) return this.bad('reason', this.t('reason is required (device_lost, card_replaced, fraud_on_token, ...)', 'reason est obligatoire (device_lost, card_replaced, fraud_on_token, ...)'));
    if (b.requested_by != null && !ENUMS.requested_by.includes(b.requested_by)) return this.bad('requested_by');
    const at = this.now();
    if (op === 'suspend') {
      if (tk.status !== 'active') return this.problem(409, 'invalid-token-transition', this.t(`Only an active token can be suspended (it is ${tk.status})`, `Seul un jeton actif peut être suspendu (il est ${tk.status})`), 'T11');
      tk.status = 'suspended'; tk.suspend_reason = b.reason; delete tk.suspended_by_block;
      tk.history.push({ at, event: 'suspended', by: b.requested_by || 'cardholder', reason: b.reason });
      return new Reply(200, this.tokenView(tk));
    }
    if (op === 'resume') {
      if (tk.status !== 'suspended') return this.problem(409, 'invalid-token-transition', this.t(`Only a suspended token can be resumed (it is ${tk.status})`, `Seul un jeton suspendu peut être réactivé (il est ${tk.status})`), 'T12');
      if (tk.suspend_reason === 'fraud_on_token') return this.problem(422, 'token-compromised', this.t('Delete this token and provision a new one', 'Supprimez ce jeton et créez-en un nouveau'), 'T14');
      const card = s.cards[tk.card_id];
      if (card && card.status === 'blocked') {
        const repl = card.replacement && card.replacement.card_id;
        if (!b.new_card_id || b.new_card_id !== repl || !s.cards[repl] || s.cards[repl].status !== 'active')
          return this.problem(422, 'card-blocked', this.t(`Card ${card.card_id} is blocked. Send new_card_id = the active replacement${repl ? ' (' + repl + ')' : ''}.`, `La carte ${card.card_id} est en opposition. Envoyez new_card_id = la carte de remplacement active${repl ? ' (' + repl + ')' : ''}.`), 'T13');
        const nc = s.cards[repl];
        tk.history.push({ at, event: 'pan_updated', by: 'issuer', from: card.card_id, to: nc.card_id });
        tk.card_id = nc.card_id; tk.pan_masked = maskPan(nc.pan); tk.token_expiry = nc.expiry;
      }
      tk.status = 'active'; delete tk.suspend_reason; delete tk.suspended_by_block;
      tk.history.push({ at, event: 'resumed', by: b.requested_by || 'issuer', reason: b.reason });
      return new Reply(200, this.tokenView(tk));
    }
    tk.status = 'deleted';
    tk.history.push({ at, event: 'deleted', by: b.requested_by || 'issuer', reason: b.reason });
    return new Reply(200, this.tokenView(tk));
  }
  cryptogram(ref, b) {
    const s = this.state;
    const tk = s.tokens[ref];
    if (!tk) return this.notFound(ref);
    if (!this.validAmount(b.amount_minor)) return this.bad('amount_minor', this.t('amount_minor is required (cents)', 'amount_minor est obligatoire (centimes)'));
    if (!/^[A-Z]{3}$/.test(String(b.currency || ''))) return this.bad('currency', this.t('currency is required, e.g. EUR', 'currency est obligatoire, par ex. EUR'));
    if (!ENUMS.crypto_channel.includes(b.channel)) return this.bad('channel', this.t('channel must be contactless, in_app, web or card_on_file', 'channel doit valoir contactless, in_app, web ou card_on_file'));
    if (tk.status !== 'active') return this.problem(422, 'token-not-active', this.t(`Token is ${tk.status}`, `Le jeton est ${tk.status}`), 'T16');
    if (!tk.domain_restrictions.channels.includes(b.channel)) return this.problem(422, 'domain-restriction', this.t(`This token works only for ${tk.domain_restrictions.channels.join(', ')}`, `Ce jeton ne fonctionne que pour ${tk.domain_restrictions.channels.join(', ')}`), 'T17');
    tk.atc += 1;
    const seed = this.brand + ref + ':' + tk.atc + ':' + b.amount_minor;
    const value = 'FAKE' + hex8(fnv(seed)) + hex8(fnv(seed + '#'));
    s.cryptograms[value] = { token_ref: ref, used: false, amount_minor: b.amount_minor, channel: b.channel };
    tk.history.push({ at: this.now(), event: 'cryptogram', atc: tk.atc, channel: b.channel });
    return new Reply(200, { token_ref: ref, cryptogram: value, atc: tk.atc, eci: '05', single_use: true, demo_only: true,
      warning: this.t('Random demo value. Not a cryptogram. No security meaning.', 'Valeur de démo aléatoire. Pas un cryptogramme. Aucune valeur de sécurité.') });
  }

  /* ---- payments P1-P7, R1-R3 */
  getPayment(id) {
    const p = this.state.payments[id];
    return p ? new Reply(200, this.paymentView(p)) : this.notFound(id);
  }
  pay(b) {
    const s = this.state;
    for (const f of ['amount_minor', 'currency', 'channel']) if (b[f] == null || b[f] === '') return this.bad(f, this.t(`${f} is required`, `${f} est obligatoire`));
    if (!this.validAmount(b.amount_minor)) return this.bad('amount_minor', this.t('amount_minor must be a whole number of cents', 'amount_minor doit être un entier en centimes'));
    if (!/^[A-Z]{3}$/.test(String(b.currency))) return this.bad('currency');
    if (!ENUMS.pay_channel.includes(b.channel)) return this.bad('channel', this.t('channel must be pos, ecom, in_app or contactless', 'channel doit valoir pos, ecom, in_app ou contactless'));
    const tds = b.three_ds == null ? 'none' : b.three_ds;
    if (!ENUMS.three_ds.includes(tds)) return this.bad('three_ds', this.t('three_ds must be authenticated, attempted or none', 'three_ds doit valoir authenticated, attempted ou none'));
    const hasPan = b.pan != null && b.pan !== '';
    const hasTok = b.payment_token != null;
    if (hasPan === hasTok) return this.problem(400, 'invalid-field', this.t('Send exactly one of pan or payment_token', 'Envoyez soit pan, soit payment_token (un seul)'), 'P1');
    let card, tk = null;
    if (hasPan) {
      const pan = String(b.pan).replace(/\s/g, '');
      card = this.cardByPan(pan);
      if (!card) return this.unknownPan(pan);
    } else {
      const pt = b.payment_token || {};
      tk = s.tokens[pt.token_ref];
      if (!tk) return this.notFound(pt.token_ref);
      if (tk.status !== 'active') return this.problem(422, 'token-not-active', this.t(`Token is ${tk.status}`, `Le jeton est ${tk.status}`), 'T16');
      const cg = s.cryptograms[pt.cryptogram];
      if (!cg || cg.token_ref !== tk.token_ref || cg.used) return this.problem(422, 'cryptogram-invalid', this.t('Ask a new demo cryptogram (POST /tokens/{ref}/cryptogram): each one works once', 'Demandez un nouveau cryptogramme de démo (POST /tokens/{ref}/cryptogram) : chacun ne sert qu\'une fois'), 'T18');
      cg.used = true;
      card = s.cards[tk.card_id];
    }
    const d = this.decide(card, b.amount_minor, b.channel);
    const at = this.now();
    s.seq.payment += 1;
    const approved = d.code === '00';
    if (approved && !d.stip) card.available_minor -= b.amount_minor;
    const msg = approved && d.stip ? STIP_MSG : AUTH_MSG[d.code];
    const p = { payment_id: 'pay_' + pad(s.seq.payment, 4), card_id: card.card_id, status: approved ? 'authorised' : 'declined',
      response_code: d.code, approved, message: this.fr ? msg[1] : msg[0], stip: d.stip,
      authorised_minor: approved ? b.amount_minor : 0, captured_minor: 0, reversed_minor: 0, refunded_minor: 0, disputed_minor: 0,
      currency: b.currency, channel: b.channel, three_ds: tk ? 'none' : tds, wallet: !!tk, authentication: tk ? 'cryptogram' : tds === 'none' ? 'none' : '3ds',
      token_ref: tk ? tk.token_ref : null, merchant: b.merchant_id || null, arn: null, authorised_at: at, captured_at: null,
      timeline: [{ at, event: approved ? 'authorised' : 'declined', amount_minor: b.amount_minor, response_code: d.code }], refunds: [] };
    s.payments[p.payment_id] = p;
    return new Reply(201, this.paymentView(p));
  }
  capture(id, b) {
    const s = this.state;
    const p = s.payments[id];
    if (!p) return this.notFound(id);
    if (!['authorised', 'partially_reversed'].includes(p.status)) return this.problem(409, 'invalid-payment-transition', this.t(`Payment is ${p.status}: only an authorised payment can be captured`, `Le paiement est ${p.status} : seul un paiement autorisé peut être remis`), 'P3');
    const left = p.authorised_minor - p.reversed_minor;
    const amt = b.amount_minor == null ? left : b.amount_minor;
    if (!Number.isInteger(amt) || amt < 1) return this.bad('amount_minor');
    if (amt > left) return this.problem(422, 'capture-exceeds-authorisation', this.t(`At most ${left} can be captured; more needs an incremental authorisation (out of scope)`, `Au plus ${left} peut être remis ; au-delà il faut une autorisation complémentaire (hors démo)`), 'P4');
    const at = this.now();
    p.captured_minor = amt; p.status = 'captured'; p.captured_at = at;
    p.arn = this.cfg.arn_prefix + pad(9000 + Number(id.slice(4)), 12);
    p.timeline.push({ at, event: 'captured', amount_minor: amt });
    if (amt < left) { p.reversed_minor += left - amt; p.timeline.push({ at, event: 'remainder_released', amount_minor: left - amt, rule: 'P5' }); }
    return new Reply(200, this.paymentView(p));
  }
  reverse(id, b) {
    const s = this.state;
    const p = s.payments[id];
    if (!p) return this.notFound(id);
    if (['captured', 'partially_refunded', 'refunded', 'disputed'].includes(p.status))
      return this.problem(409, 'already-captured', `Payment is cleared: use POST /payments/${id}/refunds`, 'P6');
    if (!['authorised', 'partially_reversed'].includes(p.status)) return this.problem(409, 'invalid-payment-transition', this.t(`Payment is ${p.status}`, `Le paiement est ${p.status}`), 'P7');
    if (b.reason != null && !ENUMS.reversal_reason.includes(b.reason)) return this.bad('reason');
    const left = p.authorised_minor - p.reversed_minor;
    const amt = b.amount_minor == null ? left : b.amount_minor;
    if (!Number.isInteger(amt) || amt < 1) return this.bad('amount_minor');
    if (amt > left) return this.problem(422, 'reversal-exceeds-authorisation', this.t(`At most ${left} can be reversed`, `Au plus ${left} peut être annulé`), 'P7');
    const at = this.now();
    p.reversed_minor += amt;
    p.status = p.reversed_minor >= p.authorised_minor ? 'reversed' : 'partially_reversed';
    const card = s.cards[p.card_id];
    if (card && !p.stip) card.available_minor += amt;
    p.timeline.push({ at, event: p.status === 'reversed' ? 'reversed' : 'partially_reversed', amount_minor: amt, reason: b.reason || null });
    return new Reply(200, this.paymentView(p));
  }
  refund(id, b) {
    const s = this.state;
    const p = s.payments[id];
    if (!p) return this.notFound(id);
    if (!['captured', 'partially_refunded', 'refunded', 'disputed'].includes(p.status))
      return this.problem(409, 'not-captured', 'Not cleared yet: use reversal', 'R1');
    const open = Object.values(s.disputes).find((d) => d.payment_id === id && OPEN_DISPUTE.includes(d.status));
    if (open) return this.problem(409, 'dispute-open', this.t(`${open.dispute_id} is open: refunding too would pay the cardholder twice`, `${open.dispute_id} est ouverte : rembourser en plus paierait le porteur deux fois`), 'R3');
    if (!Number.isInteger(b.amount_minor) || b.amount_minor < 1) return this.bad('amount_minor', this.t('amount_minor is required (cents)', 'amount_minor est obligatoire (centimes)'));
    if (b.reason != null && !ENUMS.refund_reason.includes(b.reason)) return this.bad('reason');
    const room = p.captured_minor - p.disputed_minor - p.refunded_minor;
    if (b.amount_minor > room) return this.problem(422, 'refund-exceeds-captured', this.t(`At most ${room} can still be refunded`, `Au plus ${room} peut encore être remboursé`), 'R2');
    const at = this.now();
    p.refunded_minor += b.amount_minor;
    p.status = p.refunded_minor >= p.captured_minor ? 'refunded' : 'partially_refunded';
    p.refunds.push({ at, amount_minor: b.amount_minor, reason: b.reason || null });
    p.timeline.push({ at, event: 'refunded', amount_minor: b.amount_minor, reason: b.reason || null });
    return new Reply(201, this.paymentView(p));
  }

  /* ---- chargeback lifecycle D7-D16 */
  chargeback(id, b) {
    const s = this.state;
    const p = s.payments[id];
    if (!p) return this.notFound(id);
    if (b.condition_code == null || b.condition_code === '') return this.bad('condition_code', this.t('condition_code is required, e.g. 13.1', 'condition_code est obligatoire, par ex. 13.1'));
    if (!Number.isInteger(b.amount_minor) || b.amount_minor < 1) return this.bad('amount_minor', this.t('amount_minor is required (cents)', 'amount_minor est obligatoire (centimes)'));
    const code = String(b.condition_code);
    if (!['captured', 'partially_refunded', 'refunded', 'disputed'].includes(p.status)) return this.problem(422, 'not-cleared', this.t(`Payment is ${p.status}: an authorisation hold is not charged back`, `Le paiement est ${p.status} : une autorisation seule ne fait pas l'objet d'un impayé`), 'D7');
    if (!this.conditionOk(code)) return this.problem(422, 'unknown-condition', this.t(`${code} is not a handled Visa condition (10.x-13.x)`, `${code} n'est pas un motif traité (10.x-13.x)`), 'D1');
    const age = daysBetween(p.captured_at.slice(0, 10), s.today);
    if (age > 120) return this.problem(422, 'time-limit-exceeded', this.t(`Payment was cleared ${age} days ago (limit 120)`, `Paiement compensé il y a ${age} jours (limite 120)`), 'D2');
    if (p.refunded_minor >= p.captured_minor || (code.startsWith('13.') && p.refunded_minor > 0 && b.amount_minor <= p.refunded_minor))
      return this.problem(422, 'credit-already-processed', this.t(`Already refunded ${p.refunded_minor}`, `Déjà remboursé ${p.refunded_minor}`), 'D8');
    if (code === '10.4' && (p.three_ds === 'authenticated' || p.three_ds === 'attempted' || p.authentication === 'cryptogram')) {
      const why = p.authentication === 'cryptogram' ? this.t('Wallet payment with a cryptogram', 'Paiement mobile avec cryptogramme')
        : p.three_ds === 'authenticated' ? this.t('Payment was 3-D Secure authenticated (ECI 05)', 'Paiement authentifié 3-D Secure (ECI 05)')
          : this.t('3-D Secure attempted (ECI 06): treated as shifted, to confirm per region', '3-D Secure tenté (ECI 06) : traité comme transféré, à confirmer selon la région');
      return this.problem(422, 'liability-shifted', why, 'D9');
    }
    if (code.startsWith('10.')) {
      if (!b.fraud_report_id) return this.problem(422, 'fraud-report-required', this.t('Send the fraud report first, then its fraud_report_id', 'Envoyez d\'abord la déclaration de fraude, puis son fraud_report_id'), 'D3');
      const fr = s.fraud_reports[b.fraud_report_id];
      if (!fr || !(fr.payment_id === id || (p.arn && fr.transaction_id === p.arn))) return this.problem(422, 'fraud-report-mismatch', this.t(`${b.fraud_report_id} does not cover ${id}`, `${b.fraud_report_id} ne couvre pas ${id}`), 'D3');
    }
    if (code === '13.1' && (!b.expected_delivery_date || String(b.expected_delivery_date) >= s.today))
      return this.problem(422, 'too-early', this.t('Send expected_delivery_date (in the past) for 13.1', 'Envoyez expected_delivery_date (passée) pour 13.1'), 'D11');
    const open = Object.values(s.disputes).find((d) => d.payment_id === id && OPEN_DISPUTE.includes(d.status));
    if (open) return this.problem(409, 'dispute-already-open', this.t(`${open.dispute_id} is still open`, `${open.dispute_id} est toujours ouverte`), 'D5');
    const room = p.captured_minor - p.refunded_minor - p.disputed_minor;
    if (b.amount_minor > room) return this.problem(422, 'amount-exceeds-transaction', this.t(`At most ${room} can be disputed`, `Au plus ${room} peut être contesté`), 'D4');
    const at = this.now();
    const allocation = code.startsWith('10.') || code.startsWith('11.');
    s.seq.ldispute += 1;
    const d = { dispute_id: 'DSP-2026-' + pad(s.seq.ldispute, 4), payment_id: id, transaction_id: p.arn, condition_code: code,
      condition: FIX.conditions[code], workflow: allocation ? 'allocation' : 'collaboration', status: 'chargeback',
      amount_minor: b.amount_minor, currency: p.currency, fraud_report_id: b.fraud_report_id || null,
      respond_by: allocation ? null : addDays(s.today, 30), liability: 'merchant', opened_at: at,
      ledger: [
        { at, debit: 'issuer', credit: 'cardholder', amount_minor: b.amount_minor, note: 'provisional credit' },
        { at, debit: 'acquirer', credit: 'issuer', amount_minor: b.amount_minor, note: 'chargeback' },
        { at, debit: 'merchant', credit: 'acquirer', amount_minor: b.amount_minor, note: 'chargeback passed on' }],
      history: [{ at, status: 'chargeback' }], evidence: [], kind: 'lifecycle', deadline_confidence: allocation ? null : 'to_confirm' };
    if (b.cardholder_statement) d.cardholder_statement = String(b.cardholder_statement).slice(0, 500);
    if (this.fr) { d.refund_due_by = nextBusinessDay(s.today); d.contest_until = addMonths(p.captured_at.slice(0, 10), 13); }
    s.disputes[d.dispute_id] = d;
    p.disputed_minor += b.amount_minor; p.status = 'disputed';
    p.timeline.push({ at, event: 'chargeback', amount_minor: b.amount_minor, dispute_id: d.dispute_id, condition_code: code });
    return new Reply(201, this.disputeView(d), [['Location', '/disputes/' + d.dispute_id]]);
  }
  evidenceWins(code, ev) {
    const sets = WIN_EVIDENCE[code] || [];
    return sets.some((set) => set.every((e) => ev.includes(e)));
  }
  closeDispute(d, status, at) {
    const p = this.state.payments[d.payment_id];
    d.status = status;
    d.history.push({ at, status });
    if (!p) return;
    if (status === 'won') {
      d.liability = 'issuer';
      d.ledger.push({ at, debit: 'issuer', credit: 'acquirer', amount_minor: d.amount_minor, note: 'representment accepted' },
        { at, debit: 'acquirer', credit: 'merchant', amount_minor: d.amount_minor, note: 'funds back to the merchant' });
      p.disputed_minor -= d.amount_minor;
    } else {
      d.liability = 'merchant';
    }
    p.status = p.refunded_minor > 0 ? (p.refunded_minor >= p.captured_minor ? 'refunded' : 'partially_refunded') : 'captured';
    p.timeline.push({ at, event: 'dispute_' + status, dispute_id: d.dispute_id });
  }
  represent(id, b, h) {
    const s = this.state;
    const d = s.disputes[id];
    if (!d || d.kind !== 'lifecycle') return this.notFound(id);
    if (d.workflow === 'allocation' && d.status === 'chargeback') return this.problem(422, 'no-response-step', this.t('Allocation (10.x, 11.x): the acquirer can only go to pre-arbitration', 'Allocation (10.x, 11.x) : l\'acquéreur ne peut aller qu\'en pré-arbitrage'), 'D10');
    if (d.status !== 'chargeback' || (d.respond_by && s.today > d.respond_by))
      return this.problem(422, 'response-window-closed', this.t(`Status ${d.status}, respond_by ${d.respond_by}, today ${s.today}: the merchant loses by default`, `Statut ${d.status}, réponse avant le ${d.respond_by}, aujourd'hui ${s.today} : le commerçant perd par défaut`), 'D12');
    const at = this.now();
    if (b.accept === true) { this.closeDispute(d, 'merchant_accepted', at); return new Reply(200, this.disputeView(d)); }
    const ev = Array.isArray(b.evidence) ? b.evidence.map(String) : [];
    if (!ev.length) return this.problem(400, 'invalid-field', this.t('Send evidence (list) or accept: true', 'Envoyez evidence (liste) ou accept: true'), 'D13', { field: 'evidence' });
    const badEv = ev.find((e) => !ENUMS.evidence.includes(e));
    if (badEv) return this.bad('evidence', this.t(`Unknown evidence type ${badEv}`, `Type de preuve inconnu ${badEv}`));
    d.evidence = ev;
    if (b.note) d.note = String(b.note).slice(0, 1000);
    d.history.push({ at, status: 'represented', evidence: ev });
    const forced = (h['x-mock-issuer-decision'] || '').toLowerCase();
    const win = forced === 'accept' ? true : forced === 'pre_arbitrate' ? false : this.evidenceWins(d.condition_code, ev);
    if (win) this.closeDispute(d, 'won', at);
    else {
      d.status = 'pre_arbitration'; d.liability = 'pending'; d.respond_by = addDays(s.today, 30);
      d.history.push({ at, status: 'pre_arbitration' });
    }
    return new Reply(200, this.disputeView(d));
  }
  preArbitration(id, b) {
    const s = this.state;
    const d = s.disputes[id];
    if (!d || d.kind !== 'lifecycle') return this.notFound(id);
    if (d.status !== 'pre_arbitration' || (d.respond_by && s.today > d.respond_by))
      return this.problem(422, 'response-window-closed', this.t(`Status ${d.status}, respond_by ${d.respond_by}, today ${s.today}`, `Statut ${d.status}, réponse avant le ${d.respond_by}, aujourd'hui ${s.today}`), 'D15');
    if (typeof b.accept !== 'boolean') return this.bad('accept', this.t('accept (true or false) is required', 'accept (true ou false) est obligatoire'));
    const at = this.now();
    if (b.accept) { this.closeDispute(d, 'lost', at); return new Reply(200, this.disputeView(d)); }
    const ev = [...(d.evidence || []), ...(Array.isArray(b.new_evidence) ? b.new_evidence.map(String) : [])];
    d.history.push({ at, status: 'arbitration' });
    d.status = 'arbitration';
    const win = this.evidenceWins(d.condition_code, d.evidence || []);
    d.fee_minor = FIX.arbitration_fee_minor;
    d.fee_note = this.t('Scheme filing fee charged to the loser (amount to confirm)', 'Frais d\'arbitrage à la charge du perdant (montant à confirmer)');
    d.new_evidence_ignored = ev.length > (d.evidence || []).length;
    if (win) {
      this.closeDispute(d, 'won', at);
      d.ledger.push({ at, debit: 'issuer', credit: 'scheme', amount_minor: d.fee_minor, note: 'arbitration fee' });
    } else {
      this.closeDispute(d, 'lost', at);
      d.ledger.push({ at, debit: 'merchant', credit: 'scheme', amount_minor: d.fee_minor, note: 'arbitration fee' });
    }
    return new Reply(200, this.disputeView(d));
  }
}

/* ---------------------------------------------------------------- shared singletons + URL routing */
const banks = {};
export function getBank(brand = 'harbor') {
  if (!banks[brand]) banks[brand] = new MockBank(brand);
  return banks[brand];
}

/** {brand, path} when `url` targets the mock, else null. Accepts https://issuer.example/{harbor|lumiere}/v1/...,
    mock://{harbor|lumiere}/v1/..., and any host's /mock/{harbor|lumiere}/v1/... (the local app's path). */
export function mockRoute(url, { anyHostMockPath = true } = {}) {
  let u;
  try { u = new URL(url); } catch (e) { return null; }
  let m;
  if (u.protocol === 'mock:') {
    const brand = u.host || u.hostname;
    if (!BRANDS.includes(brand)) return null;
    return { brand, path: u.pathname.replace(/^\/v1(?=\/|$)/, '') || '/', search: u.search };
  }
  if (u.hostname === MOCK_HOST) {
    if ((m = u.pathname.match(/^\/(harbor|lumiere)\/v1(\/.*)?$/))) return { brand: m[1], path: m[2] || '/', search: u.search };
    if ((m = u.pathname.match(/^\/v1(\/.*)?$/))) return { brand: 'harbor', path: m[1] || '/', search: u.search };
    return { brand: 'harbor', path: u.pathname, search: u.search };
  }
  if (anyHostMockPath && (m = u.pathname.match(/^\/mock\/(harbor|lumiere)\/v1(\/.*)?$/))) return { brand: m[1], path: m[2] || '/', search: u.search, local: true };
  return null;
}

/** Tester transport for the in-page mock. Same result shape as the proxy: {ok, status, reason, headers, body, time_ms, size, via}. */
export async function mockFetch({ method = 'GET', url, headers = [], body = '' }) {
  const r = mockRoute(url);
  if (!r) throw new Error('Not a mock URL: ' + url);
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const res = getBank(r.brand).handle({ method, path: r.path, headers, body });
  const latency = 40 + (fnv(method + url + String(body).length) % 120); // plausible latency, labelled "mock" in the UI
  await new Promise((ok) => setTimeout(ok, latency));
  const size = new TextEncoder().encode(res.body).length;
  return { ok: true, status: res.status, reason: res.reason, headers: res.headers, body: res.body, body_encoding: 'utf-8',
    time_ms: Math.round(Math.max(latency, (typeof performance !== 'undefined' ? performance : Date).now() - t0)), size, via: 'mock',
    final_url: url, redirects: 0, truncated: false };
}

/** Test-card list for pickers and warnings: [{pan, card_id, brand, expect, expiry}] for both banks. */
export function testCards() {
  const out = [];
  for (const [brand, cfg] of Object.entries(FIX.brands)) for (const c of cfg.cards) out.push({ pan: c.pan, card_id: c.card_id, brand, scheme: cfg.brand, expiry: c.expiry, expect: c.expect });
  return out;
}
export const TEST_PANS = new Set(testCards().map((c) => c.pan).concat(['4000990000000012', '4000990000000020', '4000990000000038', '4000990000000046', '4000990000000053']));
