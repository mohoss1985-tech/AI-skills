/* API tester · pure logic (no DOM, runs in Node for tests). Owner C.
   Request model (state.req):
     {method, url, auth: {type: 'none'|'bearer'|'apikey'|'basic', token, key, value, in: 'header'|'query', user, pass},
      params: [{key, value, on}], headers: [{key, value, on}], body: '', checks: [Check], captures: [{var, path}], name}
   Check: {id, target: 'status'|'time'|'size'|'header'|'json'|'body', key, op, expected, on}
   Case:  {id, name, reset: bool, data?: [{var: value}], steps: [{name?, req}]}
   Built request (what goes on the wire): {method, url, headers: [[k, v]], body} */
import { FIXTURES, TEST_PANS, luhn, mockRoute } from '../../mock/bank.js';

export const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
export const BODY_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];
let n = 0;
export const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${(n++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const clone = (o) => JSON.parse(JSON.stringify(o));

export function emptyReq() {
  return { name: '', method: 'GET', url: '', auth: { type: 'none', token: '', key: 'X-API-Key', value: '', in: 'header', user: '', pass: '' },
    params: [], headers: [], body: '', checks: [newCheck('status', '', 'eq', '200')], captures: [] };
}
export function newCheck(target = 'status', key = '', op = '', expected = '') {
  return { id: uid('chk'), target, key, op: op || OPS[target][0], expected: String(expected ?? ''), on: true };
}
export function normReq(r) {
  const base = emptyReq();
  const out = { ...base, ...(r || {}) };
  out.auth = { ...base.auth, ...((r && r.auth) || {}) };
  for (const k of ['params', 'headers', 'checks', 'captures']) out[k] = Array.isArray(out[k]) ? out[k] : [];
  out.checks = out.checks.map((c) => ({ id: c.id || uid('chk'), on: c.on !== false, key: '', expected: '', ...c, expected: String(c.expected ?? '') }));
  out.method = String(out.method || 'GET').toUpperCase();
  return out;
}

/* ---------------------------------------------------------------- operators */
export const OPS = {
  status: ['eq', 'ne', 'in', 'between'],
  time: ['lt', 'lte'],
  size: ['lt'],
  header: ['exists', 'eq', 'contains', 'starts'],
  json: ['eq', 'ne', 'contains', 'starts', 'ends', 'exists', 'not_exists', 'empty', 'not_empty', 'type', 'matches', 'gt', 'lt', 'len'],
  body: ['contains', 'not_contains'],
};
export const NO_VALUE_OPS = ['exists', 'not_exists', 'empty', 'not_empty'];

/* ---------------------------------------------------------------- variables */
const VAR_RX = /\{\{\s*([\w.-]+)\s*\}\}/g;
export function substitute(s, vars) {
  return String(s ?? '').replace(VAR_RX, (m, k) => (vars && Object.prototype.hasOwnProperty.call(vars, k) && vars[k] != null ? String(vars[k]) : m));
}
export const unresolved = (s) => [...new Set([...String(s ?? '').matchAll(VAR_RX)].map((m) => m[1]))];
export function varsOf(env, extra = {}) {
  const v = {};
  for (const r of (env && env.vars) || []) if (r.key && r.on !== false) v[r.key] = r.value;
  return { ...v, ...extra };
}

/* ---------------------------------------------------------------- URL <-> params */
export function splitUrl(url) {
  const s = String(url || '');
  const i = s.indexOf('?');
  if (i < 0) return { base: s, params: [] };
  const hash = s.indexOf('#', i);
  const q = s.slice(i + 1, hash < 0 ? undefined : hash);
  const params = q ? q.split('&').filter(Boolean).map((kv) => {
    const j = kv.indexOf('=');
    const dec = (x) => { try { return decodeURIComponent(x.replace(/\+/g, ' ')); } catch (e) { return x; } };
    return { key: dec(j < 0 ? kv : kv.slice(0, j)), value: j < 0 ? '' : dec(kv.slice(j + 1)), on: true };
  }) : [];
  return { base: s.slice(0, i), params };
}
const encQ = (s) => String(s).split(/(\{\{[^}]+\}\})/).map((p, i) => (i % 2 ? p : encodeURIComponent(p))).join('');
export function joinUrl(base, params) {
  const on = (params || []).filter((p) => p.on !== false && p.key);
  if (!on.length) return base;
  return base + '?' + on.map((p) => encQ(p.key) + (p.value === '' ? '' : '=' + encQ(p.value))).join('&');
}

/* ---------------------------------------------------------------- build */
const b64 = (s) => (typeof btoa === 'function' ? btoa(unescape(encodeURIComponent(s))) : Buffer.from(s, 'utf8').toString('base64'));
export function buildRequest(req, vars = {}) {
  const r = normReq(req);
  const sub = (s) => substitute(s, vars);
  const params = r.params.filter((p) => p.on !== false && p.key).map((p) => ({ key: sub(p.key), value: sub(p.value), on: true }));
  const headers = r.headers.filter((h) => h.on !== false && h.key).map((h) => [sub(h.key), sub(h.value)]);
  const a = r.auth;
  if (a.type === 'bearer' && a.token) headers.push(['Authorization', 'Bearer ' + sub(a.token)]);
  if (a.type === 'basic' && (a.user || a.pass)) headers.push(['Authorization', 'Basic ' + b64(sub(a.user) + ':' + sub(a.pass))]);
  if (a.type === 'apikey' && a.key) {
    if (a.in === 'query') params.push({ key: sub(a.key), value: sub(a.value), on: true });
    else headers.push([sub(a.key), sub(a.value)]);
  }
  const hasBody = BODY_METHODS.includes(r.method) && String(r.body || '').trim() !== '';
  const body = hasBody ? sub(r.body) : '';
  if (hasBody && !headers.some(([k]) => k.toLowerCase() === 'content-type')) {
    let json = false; try { JSON.parse(body); json = true; } catch (e) { /* not JSON */ }
    headers.push(['Content-Type', json ? 'application/json' : 'text/plain']);
  }
  const url = joinUrl(sub(r.url).trim(), params);
  const missing = unresolved(url + ' ' + headers.map((h) => h.join(':')).join(' ') + ' ' + body);
  return { method: r.method, url, headers, body, missing };
}

/* ---------------------------------------------------------------- JSON path */
export function parsePath(path) {
  const s = String(path || '').trim().replace(/^\$/, '');
  const out = [];
  const rx = /\.([A-Za-z_$][\w$-]*)|\[(-?\d+)\]|\[\*\]|\.\*|\[['"]([^'"]+)['"]\]/y;
  let i = 0;
  if (s && !/^[.[]/.test(s)) return parsePath('$.' + s);
  while (i < s.length) {
    rx.lastIndex = i;
    const m = rx.exec(s);
    if (!m) return null;
    if (m[1] != null) out.push(m[1]);
    else if (m[2] != null) out.push(Number(m[2]));
    else if (m[3] != null) out.push(m[3]);
    else out.push('*');
    i = rx.lastIndex;
  }
  return out;
}
/** {found, value, many}: many = the path has [*] and value is the list of matches. */
export function getPath(obj, path) {
  const parts = parsePath(path);
  if (!parts) return { found: false, value: undefined, bad: true };
  let cur = [obj];
  let many = false;
  for (const p of parts) {
    const next = [];
    for (const o of cur) {
      if (o == null || typeof o !== 'object') continue;
      if (p === '*') { many = true; next.push(...(Array.isArray(o) ? o : Object.values(o))); }
      else if (typeof p === 'number') { if (Array.isArray(o)) { const idx = p < 0 ? o.length + p : p; if (idx in o) next.push(o[idx]); } }
      else if (Object.prototype.hasOwnProperty.call(o, p)) next.push(o[p]);
    }
    cur = next;
  }
  if (many) return { found: true, value: cur, many: true };
  return cur.length ? { found: true, value: cur[0] } : { found: false, value: undefined };
}
/** Path for a key under a parent path, in the jsonView's format. */
export const childPath = (parent, key) => (typeof key === 'number' ? `${parent}[${key}]` : /^[A-Za-z_$][\w$-]*$/.test(key) ? `${parent}.${key}` : `${parent}['${key}']`);

/* ---------------------------------------------------------------- checks */
function parseExpected(e) {
  const s = String(e ?? '').trim();
  if (s === '') return { has: false, raw: s };
  try { return { has: true, raw: s, val: JSON.parse(s) }; } catch (x) { return { has: true, raw: s, val: s }; }
}
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const looseEq = (actual, e) => {
  if (actual === undefined) return false;
  const p = parseExpected(e);
  if (deepEq(actual, p.val)) return true;
  if (actual !== null && typeof actual === 'object') return false;
  return String(actual) === p.raw || (typeof p.val === 'string' && String(actual) === p.val);
};
const typeName = (v) => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v);
const num = (v) => (typeof v === 'number' ? v : v != null && v !== '' && !isNaN(Number(v)) ? Number(v) : NaN);
export function headerValue(headers, name) {
  const k = String(name || '').toLowerCase();
  const h = (headers || []).find(([x]) => String(x).toLowerCase() === k);
  return h ? h[1] : undefined;
}
export function parseJsonBody(res) {
  if (!res || res.body == null || res.body === '') return { ok: false };
  try { return { ok: true, value: JSON.parse(res.body) }; } catch (e) { return { ok: false }; }
}
function apply(op, actual, expected, found = actual !== undefined) {
  const e = String(expected ?? '');
  switch (op) {
    case 'eq': return looseEq(actual, e);
    case 'ne': return found && !looseEq(actual, e);
    case 'in': return e.split(/[,\s]+/).filter(Boolean).some((x) => String(actual) === x);
    case 'between': { const m = e.match(/^\s*(-?\d+)\s*[-–]\s*(-?\d+)\s*$/); return !!m && Number(actual) >= Number(m[1]) && Number(actual) <= Number(m[2]); }
    case 'lt': return num(actual) < num(e);
    case 'lte': return num(actual) <= num(e);
    case 'gt': return num(actual) > num(e);
    case 'contains': return actual != null && (Array.isArray(actual) ? actual.some((x) => looseEq(x, e)) : (typeof actual === 'object' ? JSON.stringify(actual) : String(actual)).includes(e));
    case 'not_contains': return actual == null || !String(actual).includes(e);
    case 'starts': return actual != null && String(actual).startsWith(e);
    case 'ends': return actual != null && String(actual).endsWith(e);
    case 'exists': return found;
    case 'not_exists': return !found;
    case 'empty': return found && (actual === null || actual === '' || (Array.isArray(actual) && !actual.length) || (typeof actual === 'object' && actual && !Object.keys(actual).length));
    case 'not_empty': return found && !apply('empty', actual, e, found);
    case 'type': return found && typeName(actual) === e.trim().toLowerCase();
    case 'matches': try { return actual != null && new RegExp(e).test(String(actual)); } catch (x) { return false; }
    case 'len': return actual != null && (Array.isArray(actual) || typeof actual === 'string') && actual.length === num(e);
    default: return false;
  }
}
/** Evaluate checks against a response {status, time_ms, size, headers, body}. Pure, no eval of user code. */
export function runChecks(res, checks, vars = {}) {
  const js = parseJsonBody(res);
  return (checks || []).filter((c) => c.on !== false).map((c) => {
    const expected = substitute(c.expected, vars);
    const key = substitute(c.key, vars);
    let actual, found = true, pass = false, note = '';
    if (!res || !res.ok) { return { ...c, key, expected, actual: undefined, found: false, pass: false, note: 'no_response' }; }
    if (c.target === 'status') actual = res.status;
    else if (c.target === 'time') actual = res.time_ms;
    else if (c.target === 'size') actual = res.size;
    else if (c.target === 'header') { actual = headerValue(res.headers, key); found = actual !== undefined; }
    else if (c.target === 'body') actual = res.body || '';
    else if (c.target === 'json') {
      if (!js.ok) { found = false; note = 'not_json'; }
      else { const g = getPath(js.value, key); found = g.found; actual = g.value; if (g.bad) note = 'bad_path'; }
    }
    if (c.target === 'json' && found && Array.isArray(actual) && getPath(js.value, key).many && !['len', 'exists', 'not_exists', 'empty', 'not_empty', 'contains'].includes(c.op)) {
      pass = actual.length > 0 && actual.every((v) => apply(c.op, v, expected, true));
      note = 'every';
    } else pass = apply(c.op, actual, expected, found);
    return { ...c, key, expected, actual, found, pass, note };
  });
}
const show = (v) => (v === undefined ? '—' : typeof v === 'string' ? v : JSON.stringify(v));
/** Plain-words explanation of one check result. T = namespaced i18n function. */
export function explain(r, T) {
  const what = r.target === 'status' ? T('tgtStatus') : r.target === 'time' ? T('tgtTime') : r.target === 'size' ? T('tgtSize')
    : r.target === 'body' ? T('tgtBody') : r.target === 'header' ? `${T('tgtHeader')} ${r.key}` : r.key;
  const op = T('op_' + r.op);
  const exp = NO_VALUE_OPS.includes(r.op) ? '' : ` ${r.expected}${r.target === 'time' ? ' ms' : r.target === 'size' ? ' B' : ''}`;
  if (r.pass) return `${what} ${op}${exp}`;
  if (r.note === 'no_response') return T('failNoResponse');
  if (r.note === 'not_json') return T('failNotJson').replace('{what}', what);
  if (r.note === 'bad_path') return T('failBadPath').replace('{path}', r.key);
  if (!r.found && !['not_exists', 'exists'].includes(r.op)) return T('failMissing').replace('{what}', what).replace('{op}', op).replace('{exp}', exp.trim());
  const got = r.target === 'body' ? T('gotBody') : show(r.actual) + (r.target === 'time' ? ' ms' : r.target === 'size' ? ' B' : '');
  return T('failGeneric').replace('{what}', what).replace('{op}', op).replace('{exp}', exp.trim()).replace('{got}', got);
}
/** First checks from a response: status equals actual, time under max(500, 2x actual) rounded up to 100. */
export function suggestChecks(res) {
  if (!res || !res.ok) return [];
  return [newCheck('status', '', 'eq', res.status), newCheck('time', '', 'lt', Math.max(500, Math.ceil((res.time_ms * 2) / 100) * 100))];
}
export function checkFromPick(path, value) {
  if (value === null) return newCheck('json', path, 'eq', 'null');
  if (typeof value === 'string') return newCheck('json', path, 'eq', value);
  return newCheck('json', path, 'eq', JSON.stringify(value));
}

/* ---------------------------------------------------------------- safety */
/** Luhn-valid 13-19 digit numbers in text that are NOT demo test PANs (warn: possible real card). */
export function scanPans(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/(?<![\d])(?:\d[ -]?){12,18}\d(?![\d])/g)) {
    const d = m[0].replace(/[ -]/g, '');
    if (d.length >= 13 && d.length <= 19 && luhn(d) && !TEST_PANS.has(d) && !/^(\d)\1+$/.test(d)) out.add(d);
  }
  return [...out];
}
export const maskPan = (p) => String(p).slice(0, 6) + '******' + String(p).slice(-4);
const SAFE_HOSTS = ['httpbin.org', 'jsonplaceholder.typicode.com', 'dummyjson.com', 'reqres.in', 'postman-echo.com', 'echo.free.beeceptor.com', 'api.restful-api.dev', 'restful-booker.herokuapp.com'];
const SAFE_WORDS = /(^|[.-])(sandbox|test|testing|uat|sit|qa|dev|staging|stage|stg|preprod|demo|mock|local)([.-]|\d|$)/i;
/** Same rule as server/tools/http_proxy.py production_like(). */
export function productionLike(url) {
  let h;
  try { h = new URL(url).hostname.toLowerCase().replace(/^\[|\]$/g, ''); } catch (e) { return false; }
  if (!h || h === 'localhost' || /\.(example|test|invalid|localhost|local|internal)$/.test(h) || h === 'issuer.example') return false;
  if (/^(\d+\.){3}\d+$/.test(h)) return !/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/.test(h);
  if (h.includes(':')) return false;
  if (SAFE_HOSTS.some((s) => h === s || h.endsWith('.' + s))) return false;
  return !SAFE_WORDS.test(h);
}
export const isMock = (url) => !!mockRoute(url);
const SECRET_HEADER = /^(authorization|x-api-key|api-key|apikey|cookie|proxy-authorization|x-auth-token)$/i;
const SECRET_PARAM = /^(api[_-]?key|key|token|access_token|secret|password|sig|signature)$/i;
export const DEMO_KEYS = ['hb_test_demo_key', 'hb_test_readonly', 'bl_test_demo_key', 'bl_test_readonly'];
export function maskUrl(url) {
  const { base, params } = splitUrl(url);
  return joinUrl(base, params.map((p) => (SECRET_PARAM.test(p.key) && !DEMO_KEYS.includes(p.value) ? { ...p, value: '***' } : p)));
}
export function maskHeaders(headers) {
  return (headers || []).map(([k, v]) => [k, SECRET_HEADER.test(k) && !DEMO_KEYS.some((d) => String(v).includes(d)) ? (/^bearer /i.test(v) ? 'Bearer ***' : /^basic /i.test(v) ? 'Basic ***' : '***') : v]);
}
export const isSecretHeader = (k) => SECRET_HEADER.test(k);

/* ---------------------------------------------------------------- curl import */
export function tokenizeShell(src) {
  const s = String(src).replace(/\\\r?\n/g, ' ').replace(/\^\r?\n/g, ' ');
  const out = [];
  let cur = null, i = 0;
  const push = () => { if (cur !== null) out.push(cur); cur = null; };
  while (i < s.length) {
    const ch = s[i];
    if (/\s/.test(ch)) { push(); i++; continue; }
    cur = cur ?? '';
    if (ch === "'") { const j = s.indexOf("'", i + 1); cur += s.slice(i + 1, j < 0 ? undefined : j); i = j < 0 ? s.length : j + 1; continue; }
    if (ch === '$' && s[i + 1] === "'") {
      i += 2;
      while (i < s.length && s[i] !== "'") {
        if (s[i] === '\\' && i + 1 < s.length) {
          const e = s[i + 1];
          const map = { n: '\n', t: '\t', r: '\r', '\\': '\\', "'": "'", '"': '"' };
          if (e === 'u' || e === 'x') { const len = e === 'u' ? 4 : 2; cur += String.fromCharCode(parseInt(s.substr(i + 2, len), 16)); i += 2 + len; continue; }
          cur += map[e] ?? e; i += 2; continue;
        }
        cur += s[i++];
      }
      i++; continue;
    }
    if (ch === '"') {
      i++;
      while (i < s.length && s[i] !== '"') { if (s[i] === '\\' && /["\\$`]/.test(s[i + 1])) { cur += s[i + 1]; i += 2; } else cur += s[i++]; }
      i++; continue;
    }
    if (ch === '\\' && i + 1 < s.length) { cur += s[i + 1]; i += 2; continue; }
    cur += ch; i++;
  }
  push();
  return out;
}
export const looksLikeCurl = (s) => /^\s*curl(\.exe)?\s/i.test(String(s || ''));
/** curl command → {req, notes[]}. Handles -X -H -d/--data* --json -u --url -G -k -L -A -b, Chrome "Copy as cURL" quoting. */
export function parseCurl(text) {
  const tk = tokenizeShell(text);
  if (!tk.length || !/^curl(\.exe)?$/i.test(tk[0])) throw new Error('not_curl');
  const req = emptyReq();
  req.checks = [newCheck('status', '', 'eq', '200')];
  const notes = [];
  let method = null, url = '', data = [], get = false, insecure = false;
  const headers = [];
  for (let i = 1; i < tk.length; i++) {
    let a = tk[i];
    let val = null;
    const eq = a.startsWith('--') ? a.indexOf('=') : -1;
    if (eq > 0) { val = a.slice(eq + 1); a = a.slice(0, eq); }
    const next = () => (val != null ? val : tk[++i]);
    if (a === '-X' || a === '--request') method = String(next()).toUpperCase();
    else if (/^-X[A-Z]+$/.test(a)) method = a.slice(2);
    else if (a === '-H' || a === '--header') { const h = next() || ''; const j = h.indexOf(':'); if (j > 0) headers.push([h.slice(0, j).trim(), h.slice(j + 1).trim()]); }
    else if (['-d', '--data', '--data-raw', '--data-binary', '--data-ascii', '--data-urlencode'].includes(a)) { const d = next(); data.push(d && d.startsWith('@') && a !== '--data-raw' ? (notes.push('file_body'), '') : d); }
    else if (a === '--json') { data.push(next()); if (!headers.some(([k]) => /^content-type$/i.test(k))) headers.push(['Content-Type', 'application/json']); if (!headers.some(([k]) => /^accept$/i.test(k))) headers.push(['Accept', 'application/json']); }
    else if (a === '-u' || a === '--user') { const u = next() || ''; const j = u.indexOf(':'); req.auth = { ...req.auth, type: 'basic', user: j < 0 ? u : u.slice(0, j), pass: j < 0 ? '' : u.slice(j + 1) }; }
    else if (a === '--url') url = next();
    else if (a === '-G' || a === '--get') get = true;
    else if (a === '-k' || a === '--insecure') insecure = true;
    else if (a === '-A' || a === '--user-agent') headers.push(['User-Agent', next()]);
    else if (a === '-b' || a === '--cookie') headers.push(['Cookie', next()]);
    else if (a === '-e' || a === '--referer') headers.push(['Referer', next()]);
    else if (a === '-F' || a === '--form') { next(); notes.push('form'); }
    else if (['-o', '--output', '-m', '--max-time', '--connect-timeout', '-w', '--write-out', '--retry', '-x', '--proxy', '--cacert', '--cert', '--key', '-T', '--upload-file'].includes(a)) { next(); }
    else if (a.startsWith('-')) { /* -s -S -L -i -v --compressed ... ignored */ }
    else if (!url) url = a;
  }
  if (!url) throw new Error('no_url');
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(url) && !url.startsWith('{{')) url = 'https://' + url;
  let body = data.join('&');
  if (get && body) { url += (url.includes('?') ? '&' : '?') + body; body = ''; }
  req.method = method || (body ? 'POST' : 'GET');
  const { base, params } = splitUrl(url);
  req.url = base; req.params = params;
  for (const [k, v] of headers) {
    if (/^authorization$/i.test(k) && /^bearer\s+/i.test(v) && req.auth.type === 'none') req.auth = { ...req.auth, type: 'bearer', token: v.replace(/^bearer\s+/i, '') };
    else if (/^authorization$/i.test(k) && /^basic\s+/i.test(v) && req.auth.type === 'none') {
      let dec = ''; try { dec = typeof atob === 'function' ? decodeURIComponent(escape(atob(v.slice(6).trim()))) : Buffer.from(v.slice(6).trim(), 'base64').toString('utf8'); } catch (e) { dec = ''; }
      const j = dec.indexOf(':');
      if (j >= 0) req.auth = { ...req.auth, type: 'basic', user: dec.slice(0, j), pass: dec.slice(j + 1) };
      else req.headers.push({ key: k, value: v, on: true });
    } else if (/^(x-api-key|api-key|apikey)$/i.test(k) && req.auth.type === 'none') req.auth = { ...req.auth, type: 'apikey', key: k, value: v, in: 'header' };
    else if (/^content-type$/i.test(k) && /json/i.test(v) && body) { /* added automatically */ }
    else req.headers.push({ key: k, value: v, on: true });
  }
  if (body) { try { req.body = JSON.stringify(JSON.parse(body), null, 2); } catch (e) { req.body = body; if (!req.headers.some((h) => /^content-type$/i.test(h.key))) req.headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded', on: true }); } }
  if (insecure) notes.push('insecure');
  return { req, notes, insecure };
}

/* ---------------------------------------------------------------- Postman v2.1 import */
export function importPostman(json) {
  const col = typeof json === 'string' ? JSON.parse(json) : json;
  if (!col || !col.info || !Array.isArray(col.item)) throw new Error('not_postman');
  const vars = (col.variable || []).filter((v) => v.key).map((v) => ({ key: v.key, value: v.value == null ? '' : String(v.value), secret: /token|key|secret|password/i.test(v.key), on: true }));
  const cases = [];
  const authOf = (a) => {
    if (!a || !a.type) return null;
    const get = (k) => { const arr = a[a.type] || []; const x = Array.isArray(arr) ? arr.find((e) => e.key === k) : null; return x ? String(x.value ?? '') : ''; };
    if (a.type === 'bearer') return { type: 'bearer', token: get('token') };
    if (a.type === 'basic') return { type: 'basic', user: get('username'), pass: get('password') };
    if (a.type === 'apikey') return { type: 'apikey', key: get('key') || 'X-API-Key', value: get('value'), in: get('in') === 'query' ? 'query' : 'header' };
    if (a.type === 'noauth') return { type: 'none' };
    return null;
  };
  const walk = (items, folder, inherited) => {
    for (const it of items || []) {
      const auth = authOf(it.auth) || inherited;
      if (Array.isArray(it.item)) {
        const leaves = it.item.every((x) => !Array.isArray(x.item) && x.request);
        if (leaves && it.item.length) {
          const steps = [], before = cases.length;
          walk(it.item, '', auth);
          const made = cases.splice(before);
          for (const m of made) if (!/^reset mock$/i.test(m.name)) steps.push({ name: m.name, req: m.steps[0].req });
          cases.push({ id: uid('case'), name: (folder ? folder + ' / ' : '') + it.name, reset: made.some((m) => /^reset mock$/i.test(m.name)), steps });
          continue;
        }
        walk(it.item, folder ? folder + ' / ' + it.name : it.name, auth); continue;
      }
      const r = it.request;
      if (!r) continue;
      const req = emptyReq();
      req.name = it.name || '';
      req.method = String((typeof r === 'string' ? 'GET' : r.method) || 'GET').toUpperCase();
      const raw = typeof r === 'string' ? r : typeof r.url === 'string' ? r.url : (r.url && (r.url.raw || [r.url.protocol ? r.url.protocol + '://' : '', [].concat(r.url.host || []).join('.'), '/' + [].concat(r.url.path || []).join('/')].join(''))) || '';
      const { base, params } = splitUrl(raw);
      req.url = base; req.params = params;
      if (r.url && Array.isArray(r.url.query) && !params.length) req.params = r.url.query.map((q) => ({ key: q.key, value: q.value ?? '', on: !q.disabled }));
      req.headers = (r.header || []).filter((h) => h.key).map((h) => ({ key: h.key, value: String(h.value ?? ''), on: !h.disabled }));
      const ki = req.headers.findIndex((h) => /^(x-api-key|api-key|apikey)$/i.test(h.key));
      if (ki >= 0 && !r.auth) { const h = req.headers.splice(ki, 1)[0]; req.auth = { ...req.auth, type: 'apikey', key: h.key, value: h.value, in: 'header' }; }
      const ra = authOf(r.auth) || (ki >= 0 ? null : auth);
      if (ra) req.auth = { ...req.auth, ...ra };
      if (r.body) {
        if (r.body.mode === 'raw') req.body = r.body.raw || '';
        else if (r.body.mode === 'urlencoded') { req.body = (r.body.urlencoded || []).filter((p) => !p.disabled).map((p) => encodeURIComponent(p.key) + '=' + encodeURIComponent(p.value ?? '')).join('&'); req.headers.push({ key: 'Content-Type', value: 'application/x-www-form-urlencoded', on: true }); }
      }
      const tests = (it.event || []).filter((e) => e.listen === 'test').flatMap((e) => [].concat((e.script && e.script.exec) || []));
      req.checks = checksFromPmTests(tests.join('\n'));
      for (const t of tests) { const mm = t.match(/collectionVariables\.set\((".*?"), kitStr\(kitPath\(pm\.response\.json\(\), (".*?")\)\)\)/); if (mm) req.captures.push({ var: JSON.parse(mm[1]), path: JSON.parse(mm[2]) }); }
      if (!req.checks.length) req.checks = [newCheck('status', '', 'eq', '200')];
      req.notes = tests.filter((t) => !/^function kit|pm\.test\(|collectionVariables/.test(t)).join('\n');
      cases.push({ id: uid('case'), name: (folder ? folder + ' / ' : '') + (it.name || req.method + ' ' + base), reset: false, steps: [{ req }] });
    }
  };
  walk(col.item, '', authOf(col.auth));
  return { name: col.info.name || 'Postman collection', cases, vars };
}
/** Recognise the pm.test lines our own export writes (round trip); other scripts stay as notes. */
export function checksFromPmTests(src) {
  const out = [];
  for (const line of String(src || '').split('\n')) {
    let m;
    if ((m = line.match(/to\.have\.status\((\d+)\)/))) out.push(newCheck('status', '', 'eq', m[1]));
    else if ((m = line.match(/responseTime\)\.to\.be\.below\((\d+)\)/))) out.push(newCheck('time', '', 'lt', m[1]));
    else if ((m = line.match(/pm\.response\.text\(\)\)\.to\.include\((".*")\)/))) out.push(newCheck('body', '', 'contains', JSON.parse(m[1])));
    else if ((m = line.match(/kitStr\(kitPath\(pm\.response\.json\(\), (".*?")\)\)\)\.to\.eql\((".*")\)\);$/))) out.push(newCheck('json', JSON.parse(m[1]), 'eq', JSON.parse(m[2])));
  }
  return out;
}

/* ---------------------------------------------------------------- OpenAPI 3 import */
const MOCK_SERVER = { 'mock://harbor/v1': 'https://issuer.example/harbor/v1', 'mock://lumiere/v1': 'https://issuer.example/lumiere/v1' };
function deref(doc, o, depth = 0) {
  if (!o || typeof o !== 'object' || depth > 8) return o;
  if (o.$ref && typeof o.$ref === 'string' && o.$ref.startsWith('#/')) {
    const target = o.$ref.slice(2).split('/').reduce((x, k) => (x ? x[k.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined), doc);
    return deref(doc, target, depth + 1);
  }
  return o;
}
function exampleFromSchema(doc, s, depth = 0) {
  s = deref(doc, s);
  if (!s || depth > 5) return null;
  if (s.example !== undefined) return s.example;
  if (Array.isArray(s.examples) && s.examples.length) return s.examples[0];
  if (s.enum) return s.enum[0];
  if (s.allOf) return Object.assign({}, ...s.allOf.map((x) => exampleFromSchema(doc, x, depth + 1) || {}));
  const t = Array.isArray(s.type) ? s.type.find((x) => x !== 'null') : s.type;
  if (t === 'object' || s.properties) {
    const o = {};
    for (const [k, v] of Object.entries(s.properties || {})) if (!s.required || s.required.includes(k)) o[k] = exampleFromSchema(doc, v, depth + 1);
    return o;
  }
  if (t === 'array') return [exampleFromSchema(doc, s.items, depth + 1)].filter((x) => x != null);
  if (t === 'integer' || t === 'number') return s.minimum ?? 1;
  if (t === 'boolean') return true;
  if (t === 'string') return s.format === 'date' ? '2026-11-08' : s.format === 'date-time' ? '2026-11-08T10:00:00Z' : 'string';
  return null;
}
/** The demo YAML still carries the old non-Luhn PANs (research/09 decision 12): swap them for the corrected ones. */
export const fixLegacyPans = (s) => String(s).replace(/\d{16}/g, (p) => FIXTURES.legacy_pans[p] || p);
/** OpenAPI 3.x object → {title, server, endpoints: [{id, method, path, summary, tag, req}], authHint}. */
export function importOpenApi(doc, { server } = {}) {
  if (!doc || typeof doc !== 'object' || !(doc.openapi || doc.swagger) || !doc.paths) throw new Error('not_openapi');
  let base = server || (doc.servers && doc.servers[0] && doc.servers[0].url) || '';
  base = MOCK_SERVER[base] || base;
  const schemes = (doc.components && doc.components.securitySchemes) || {};
  const globalSec = doc.security || [];
  const authFor = (sec) => {
    for (const req of sec || []) for (const name of Object.keys(req)) {
      const sc = deref(doc, schemes[name]);
      if (!sc) continue;
      if (sc.type === 'apiKey' && sc.in !== 'cookie') return { type: 'apikey', key: sc.name, value: '{{api_key}}', in: sc.in === 'query' ? 'query' : 'header' };
      if (sc.type === 'http' && sc.scheme === 'bearer') return { type: 'bearer', token: '{{token}}' };
      if (sc.type === 'http' && sc.scheme === 'basic') return { type: 'basic', user: '{{user}}', pass: '{{password}}' };
    }
    return null;
  };
  const endpoints = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
      const op = item && item[method];
      if (!op) continue;
      const req = emptyReq();
      req.method = method.toUpperCase();
      req.name = op.summary || op.operationId || `${req.method} ${path}`;
      const params = [...(item.parameters || []), ...(op.parameters || [])].map((p) => deref(doc, p)).filter(Boolean);
      let p = path;
      for (const prm of params) {
        const ex = prm.example ?? (prm.schema && deref(doc, prm.schema) && (deref(doc, prm.schema).example ?? (deref(doc, prm.schema).enum || [])[0]));
        if (prm.in === 'path') p = p.replace(`{${prm.name}}`, ex != null ? String(ex) : `{{${prm.name}}}`);
        else if (prm.in === 'query' && (prm.required || ex != null)) req.params.push({ key: prm.name, value: ex != null ? String(ex) : '', on: !!prm.required });
        else if (prm.in === 'header' && prm.required) req.headers.push({ key: prm.name, value: ex != null ? String(ex) : '', on: true });
      }
      req.url = '{{base_url}}' + p;
      const rb = deref(doc, op.requestBody);
      if (rb && rb.content) {
        const media = rb.content['application/json'] || Object.values(rb.content)[0];
        if (media) {
          let ex = media.example;
          if (ex === undefined && media.examples) { const first = Object.values(media.examples)[0]; ex = deref(doc, first) && deref(doc, first).value; }
          if (ex === undefined) ex = exampleFromSchema(doc, media.schema);
          if (ex !== undefined && ex !== null) req.body = fixLegacyPans(JSON.stringify(ex, null, 2));
        }
      }
      const auth = authFor(op.security !== undefined ? op.security : globalSec);
      if (auth) req.auth = { ...req.auth, ...auth };
      const codes = Object.keys(op.responses || {});
      const ok = codes.find((c) => /^2\d\d$/.test(c)) || codes.find((c) => /^2/.test(c));
      req.checks = [newCheck('status', '', 'eq', ok && /^\d+$/.test(ok) ? ok : '200')];
      endpoints.push({ id: `${req.method} ${path}`, method: req.method, path, summary: op.summary || '', tag: (op.tags || [])[0] || '', req });
    }
  }
  return { title: (doc.info && doc.info.title) || 'OpenAPI', server: base, endpoints, auth: authFor(globalSec) };
}

/* ---------------------------------------------------------------- results summary */
export function caseSummary(results) {
  const total = results.length, passed = results.filter((r) => r.pass).length;
  return { total, passed, failed: total - passed, pass: total > 0 && passed === total };
}
export const fmtBytes = (n) => (n == null ? '' : n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? (n / 1024).toFixed(1) + ' KB' : n + ' B');
export const pathOf = (url) => { try { const u = new URL(url.replace(/\{\{[^}]+\}\}/g, 'x')); return u.pathname; } catch (e) { return String(url).replace(/^\{\{base_url\}\}/, ''); } };
export const shortUrl = (url) => String(url || '').replace(/^\{\{base_url\}\}/, '').replace(/^https?:\/\/issuer\.example\/(harbor|lumiere)\/v1/, '') || url;
