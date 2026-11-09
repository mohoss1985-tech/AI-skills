// Draft: one "send" for the API tester, three transports.
//   1. host issuer.example  -> in-page mock card-issuer API (mock-issuer.js), local app AND static demo
//   2. local app            -> POST /api/proxy (no CORS, any URL, real wire)
//   3. static demo          -> direct fetch (works only for CORS-enabled APIs; we explain the failure)
// All return the same shape: {ok, status, reason, headers:[[k,v]], body, time_ms, size, via, error?}

const DEMO = !!window.KIT_DEMO;

async function sendRequest({ method = 'GET', url, headers = [], body = '', timeout = 30 }) {
  const u = new URL(url); // throws on bad URL -> show "Check the URL" inline
  if (u.hostname === window.MockIssuer?.HOST) return window.MockIssuer.handle({ method, url, headers, body });
  if (!DEMO) {
    const r = await fetch('api/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kit-Proxy': '1' },
      body: JSON.stringify({ method, url, headers, body, timeout }),
    });
    return { ...(await r.json()), via: 'proxy' };
  }
  return directFetch({ method, url, headers, body, timeout });
}

async function directFetch({ method, url, headers, body, timeout }) {
  const t0 = performance.now();
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout * 1000);
  try {
    const r = await fetch(url, {
      method, headers: headers.filter(([k]) => k.trim()),
      body: ['GET', 'HEAD'].includes(method) || !body ? undefined : body,
      signal: ctl.signal, redirect: 'follow', credentials: 'omit', cache: 'no-store',
    });
    const buf = await r.arrayBuffer();
    return {
      ok: true, status: r.status, reason: r.statusText, via: 'browser',
      headers: [...r.headers.entries()], // only CORS-safelisted + exposed headers are visible
      body: new TextDecoder().decode(buf), size: buf.byteLength,
      time_ms: Math.round(performance.now() - t0),
    };
  } catch (e) {
    const timedOut = e.name === 'AbortError';
    return {
      ok: false, via: 'browser', time_ms: Math.round(performance.now() - t0),
      error: timedOut ? `Timed out after ${timeout} s`
        // fetch gives no detail on CORS failures: name the likely cause in plain words
        : 'The browser blocked this call (the API does not allow web pages to call it - CORS) or the server is unreachable. ' +
          'Try a demo API (httpbin.org, jsonplaceholder, dummyjson, reqres) or run Analyst Kit on your computer to call any API.',
    };
  } finally { clearTimeout(timer); }
}

// Assertions: the 4 checks analysts ask for, evaluated client-side for every transport.
function runAssertions(res, checks) {
  let json; try { json = JSON.parse(res.body); } catch { json = undefined; }
  const get = (obj, path) => path.replace(/^\$\.?/, '').split(/\.|\[(\d+)\]/).filter(Boolean)
    .reduce((o, k) => (o == null ? undefined : o[k]), obj);
  return checks.map((c) => {
    let actual, pass;
    if (c.type === 'status') { actual = res.status; pass = String(actual) === String(c.expected); }
    else if (c.type === 'time') { actual = res.time_ms; pass = actual <= Number(c.expected); }
    else if (c.type === 'json') { actual = get(json, c.path); pass = String(actual) === String(c.expected); }
    else if (c.type === 'contains') { actual = (res.body || '').includes(c.expected); pass = actual; }
    return { ...c, actual, pass };
  });
}
