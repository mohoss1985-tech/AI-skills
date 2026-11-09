/* API tester · transports (owner C). One sendRequest(), three routes, one result shape:
     {ok, status, reason, headers: [[k, v]], body, body_encoding, size, time_ms, via: 'mock'|'proxy'|'browser', final_url, redirects, truncated}
     or {ok: false, code, error, time_ms, via}
   1. Static demo (window.KIT_DEMO) + mock URL (https://issuer.example/<bank>/v1, mock://, /mock/<bank>/v1) → in-page mock.
   2. Local app → POST /api/tools/http/send (server/tools/http_proxy.py). Mock URLs are rewritten to the app's own
      /mock/<bank>/v1 path, which the proxy answers in-process: the tester, curl and pytest share one mock state.
   3. Static demo + any other URL → direct fetch (CORS-enabled APIs only, e.g. httpbin.org), plain-words CORS message. */
import { mockFetch, mockRoute } from '../../mock/bank.js';

const DEMO = () => typeof window !== 'undefined' && !!window.KIT_DEMO;

export function routeFor(url) {
  const m = mockRoute(url);
  if (m) return DEMO() ? 'mock' : 'proxy-mock';
  return DEMO() ? 'browser' : 'proxy';
}
export function localMockUrl(url) {
  const m = mockRoute(url);
  if (!m) return url;
  return `${window.location.origin}/mock/${m.brand}/v1${m.path === '/' ? '' : m.path}${m.search || ''}`;
}

/** built = {method, url, headers, body}; opts = {timeout, follow, verifyTls, confirmProduction, server}. */
export async function sendRequest(built, opts = {}) {
  const route = routeFor(built.url);
  if (route === 'mock') return mockFetch(built);
  if (route === 'browser') return directFetch(built, opts);
  const server = opts.server;
  if (!server) return { ok: false, via: 'proxy', code: 'net.offline', error: 'offline', time_ms: 0 };
  const payload = { method: built.method, url: route === 'proxy-mock' ? localMockUrl(built.url) : built.url, headers: built.headers,
    body: built.body, timeout: opts.timeout || 30, follow_redirects: opts.follow !== false, verify_tls: opts.verifyTls !== false,
    confirm_production: !!opts.confirmProduction };
  try {
    const r = await server.post('/api/tools/http/send', payload);
    return { ...r, via: r.via || 'proxy', final_url: route === 'proxy-mock' ? built.url : r.final_url };
  } catch (e) {
    return { ok: false, via: 'proxy', code: e.code || 'net.offline', error: e.message, time_ms: 0 };
  }
}

export async function directFetch({ method, url, headers, body }, { timeout = 30 } = {}) {
  const t0 = performance.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout * 1000);
  try {
    const r = await fetch(url, {
      method, headers: (headers || []).filter(([k]) => k && !/^(user-agent|cookie|host)$/i.test(k)),
      body: ['GET', 'HEAD'].includes(method) || !body ? undefined : body,
      signal: ctl.signal, redirect: 'follow', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer',
    });
    const buf = await r.arrayBuffer();
    return { ok: true, status: r.status, reason: r.statusText, via: 'browser', headers: [...r.headers.entries()],
      body: new TextDecoder().decode(buf), body_encoding: 'utf-8', size: buf.byteLength, final_url: r.url || url, redirects: r.redirected ? 1 : 0,
      time_ms: Math.round(performance.now() - t0), truncated: false };
  } catch (e) {
    return { ok: false, via: 'browser', time_ms: Math.round(performance.now() - t0), code: e.name === 'AbortError' ? 'http.timeout' : 'http.cors', error: e.message };
  } finally { clearTimeout(timer); }
}

/** POST /_mock/reset on the bank behind `url` (before each test case). */
export async function resetMockFor(url, opts) {
  const m = mockRoute(url);
  if (!m) return null;
  const base = url.slice(0, url.length - (m.path === '/' ? 0 : m.path.length) - (m.search || '').length).replace(/\/$/, '');
  return sendRequest({ method: 'POST', url: base + '/_mock/reset', headers: [], body: '' }, opts);
}
