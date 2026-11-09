/* HTTP to the local server. In the static demo (window.KIT_DEMO, set by config.js) GETs read the exported
   JSON files and anything else throws "read-only demo".
   Local writes carry X-Kit-Token (GET /api/config, refetched once on 403 security.bad_token).
   Errors are thrown as Error with .code (B's {error: {code, message}}), message translated by t('err.' + code). */
import { L, t } from './i18n.js';

export const DEMO = window.KIT_DEMO;
export const DEMO_MSG = 'This demo is read-only. To create your own deliverables, run Analyst Kit on your computer with Claude Code (see the README on GitHub).';

const demoGet = (path) => {
  if (path === '/api/state') return 'data/state.json';
  if (path === '/api/catalog') return 'data/catalog.json';
  const m = path.match(/^\/api\/requests\/(\d+)$/);
  return m ? `data/requests/${m[1]}.json` : null;
};

let token = null;
async function getToken(force) {
  if (token && !force) return token;
  try { const r = await fetch('/api/config'); if (r.ok) token = (await r.json()).token || ''; } catch { token = ''; }
  return token;
}

/** Server reachability for the "server offline" banner: true / false, listeners on change. */
export const net = { online: true, listeners: [], set(v) { if (v !== this.online) { this.online = v; this.listeners.forEach((f) => f(v)); } } };

export class ApiError extends Error {
  constructor(message, code = '', status = 0) { super(message); this.code = code; this.status = status; }
}
const errMessage = (data, status) => {
  const e = data && data.error;
  const code = (e && typeof e === 'object' && e.code) || '';
  const msg = (e && typeof e === 'object' ? e.message : e) || L('Something went wrong');
  const tr = code ? t('err.' + code) : '';
  return new ApiError(tr && tr !== 'err.' + code ? tr : L(msg), code, status);
};

const etags = new Map(), cache = new Map();
export const api = async (path, opts = {}, retried = false) => {
  if (DEMO) {
    if (opts.method && opts.method !== 'GET') throw new ApiError(L(DEMO_MSG), 'demo.read_only');
    if (path.startsWith('/api/chat')) return { messages: [] };
    if (path.startsWith('/api/files')) return { files: [] };
    const file = demoGet(path);
    if (!file) throw new ApiError('Not found', 'request.not_found', 404);
    const r = await fetch(file);
    if (!r.ok) throw new ApiError('Not found', 'request.not_found', 404);
    return r.json();
  }
  const method = (opts.method || 'GET').toUpperCase();
  const headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  if (method !== 'GET' && method !== 'HEAD') { const tk = await getToken(); if (tk) headers['X-Kit-Token'] = tk; }
  const cacheable = method === 'GET' && (path === '/api/state' || path === '/api/catalog');
  if (cacheable && etags.has(path)) headers['If-None-Match'] = etags.get(path);
  let r;
  try { r = await fetch(path, { ...opts, method, headers }); }
  catch { net.set(false); throw new ApiError(L('The local server is not answering. Start it with python3 app/server/server.py.'), 'net.offline'); }
  net.set(true);
  if (r.status === 304 && cache.has(path)) return cache.get(path);
  if (r.status === 204) return null;
  let data = null;
  try { data = await r.json(); } catch { data = null; }
  if (!r.ok) {
    const err = errMessage(data, r.status);
    if (err.code === 'security.bad_token' && !retried) { await getToken(true); return api(path, opts, true); }
    throw err;
  }
  if (cacheable) { const et = r.headers.get('ETag'); if (et) { etags.set(path, et); cache.set(path, data); } }
  return data;
};
export const get = (path) => api(path);
export const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body) });
export const put = (path, body) => api(path, { method: 'PUT', body: JSON.stringify(body) });
export const del = (path) => api(path, { method: 'DELETE' });

/** What tools get as ctx.server: the local back end (null in the static demo). */
export const server = DEMO ? null : { get, post, put, del, api };
