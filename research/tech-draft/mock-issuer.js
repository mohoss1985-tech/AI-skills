// Draft: in-page mock card-issuer API for demos (static demo + local app). No Service Worker needed.
// Base URL https://issuer.example/v1 - ".example" is reserved by RFC 2606, so it can never hit a real server.
// The same request exported to curl/Postman will fail outside Analyst Kit: the export notes that it targets the mock.
//
// Endpoints (Visa EN / CB FR samples use these):
//   POST /v1/authorisations         {pan, expiry, cvv, amount, currency, merchant}  -> 201 approved | 402 declined
//   GET  /v1/authorisations/{id}                                                     -> 200 | 404
//   POST /v1/authorisations/{id}/reversal                                            -> 200 | 409 already reversed
//   POST /v1/cards/{last4}/block    {reason}  (PAN declaration: lost/stolen)         -> 200
//   POST /v1/chargebacks            {authorisation_id, reason_code}                  -> 201 | 422
// Auth: header "Authorization: Bearer demo-token" or "x-api-key: demo-key", otherwise 401.

(function () {
  const HOST = 'issuer.example';
  const db = { auths: new Map(), blocked: new Set(), seq: 1000 };
  // Test PANs (public test numbers): approve, decline insufficient funds, decline stolen card.
  const CARDS = {
    '4111111111111111': { scheme: 'VISA', balance: 5000 },
    '4000000000009995': { scheme: 'VISA', balance: 0 },          // -> 51 insufficient funds
    '4000000000000069': { scheme: 'VISA', expired: true },       // -> 54 expired card
    '4970100000000154': { scheme: 'CB', balance: 2000 },
  };
  const luhn = (pan) => [...pan].reverse().map(Number)
    .reduce((s, d, i) => s + (i % 2 ? (d * 2 > 9 ? d * 2 - 9 : d * 2) : d), 0) % 10 === 0;
  const mask = (pan) => pan.slice(0, 6) + '******' + pan.slice(-4);

  function reply(status, obj, t0, extra = {}) {
    const body = obj == null ? '' : JSON.stringify(obj, null, 2);
    const time_ms = Math.round(40 + Math.random() * 120); // plausible latency, shown as such
    return new Promise((ok) => setTimeout(() => ok({
      ok: true, status, reason: STATUS[status] || '', via: 'mock', time_ms,
      size: new TextEncoder().encode(body).length, body,
      headers: [['content-type', 'application/json'], ['x-request-id', crypto.randomUUID()], ...Object.entries(extra)],
    }), time_ms));
  }
  const STATUS = { 200: 'OK', 201: 'Created', 400: 'Bad Request', 401: 'Unauthorized', 402: 'Payment Required',
    404: 'Not Found', 405: 'Method Not Allowed', 409: 'Conflict', 422: 'Unprocessable Entity' };
  const err = (status, code, message, field) => [status, { error: { code, message, ...(field && { field }) } }];

  function route(method, path, h, b) {
    const auth = h.authorization === 'Bearer demo-token' || h['x-api-key'] === 'demo-key';
    if (!auth) return err(401, 'unauthorised', 'Send Authorization: Bearer demo-token or x-api-key: demo-key');
    let m;
    if (path === '/v1/authorisations' && method === 'POST') {
      for (const f of ['pan', 'expiry', 'amount', 'currency']) if (b[f] == null) return err(400, 'missing_field', `${f} is required`, f);
      const pan = String(b.pan).replace(/\s/g, '');
      if (!/^\d{13,19}$/.test(pan) || !luhn(pan)) return err(422, 'invalid_pan', 'PAN fails the Luhn check', 'pan');
      if (!(Number(b.amount) > 0)) return err(422, 'invalid_amount', 'amount must be > 0 (minor units)', 'amount');
      const card = CARDS[pan] || { scheme: pan[0] === '4' ? 'VISA' : 'OTHER', balance: 1000 };
      let response_code = '00', status = 'approved';
      if (db.blocked.has(pan.slice(-4))) [response_code, status] = ['43', 'declined']; // stolen card, pick up
      else if (card.expired) [response_code, status] = ['54', 'declined'];
      else if (Number(b.amount) > card.balance * 100) [response_code, status] = ['51', 'declined'];
      const id = 'auth_' + ++db.seq;
      const a = { id, status, response_code, approval_code: status === 'approved' ? String(100000 + db.seq) : null,
        pan: mask(pan), scheme: card.scheme, amount: Number(b.amount), currency: b.currency,
        merchant: b.merchant || null, created_at: new Date().toISOString() };
      db.auths.set(id, a);
      return [status === 'approved' ? 201 : 402, a];
    }
    if ((m = path.match(/^\/v1\/authorisations\/(auth_\d+)$/)) && method === 'GET')
      return db.auths.has(m[1]) ? [200, db.auths.get(m[1])] : err(404, 'not_found', `No authorisation ${m[1]}`);
    if ((m = path.match(/^\/v1\/authorisations\/(auth_\d+)\/reversal$/)) && method === 'POST') {
      const a = db.auths.get(m[1]);
      if (!a) return err(404, 'not_found', `No authorisation ${m[1]}`);
      if (a.status === 'reversed') return err(409, 'already_reversed', 'This authorisation was already reversed');
      a.status = 'reversed'; return [200, a];
    }
    if ((m = path.match(/^\/v1\/cards\/(\d{4})\/block$/)) && method === 'POST') {
      db.blocked.add(m[1]); return [200, { last4: m[1], blocked: true, reason: b.reason || 'lost' }];
    }
    if (path === '/v1/chargebacks' && method === 'POST') {
      const a = db.auths.get(b.authorisation_id);
      if (!a || a.status !== 'approved') return err(422, 'not_disputable', 'Only approved authorisations can be disputed');
      return [201, { id: 'cb_' + ++db.seq, authorisation_id: a.id, reason_code: b.reason_code || '10.4', stage: 'first_chargeback' }];
    }
    return err(path.startsWith('/v1/') ? 405 : 404, 'no_route', `${method} ${path} is not part of the demo API`);
  }

  async function handle({ method, url, headers, body }) {
    const t0 = performance.now();
    const h = Object.fromEntries(headers.filter(([k]) => k).map(([k, v]) => [k.toLowerCase(), v]));
    let b = {};
    if (body) { try { b = JSON.parse(body); } catch { return reply(...err(400, 'invalid_json', 'Body is not valid JSON'), t0); } }
    const [status, obj] = route(method.toUpperCase(), new URL(url).pathname, h, b);
    return reply(status, obj, t0);
  }

  window.MockIssuer = { HOST, BASE: `https://${HOST}/v1`, handle, reset: () => { db.auths.clear(); db.blocked.clear(); } };
})();
