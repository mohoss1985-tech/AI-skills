/* API tester · exports (owner C). Pure functions (Node-testable). From research/tech-draft/exporters.js.
   - curl: one request, variables resolved, https://issuer.example/<bank>/v1 rewritten to the local app's mock
     (http://localhost:4317/mock/<bank>/v1) so it really runs; real secrets become $API_TOKEN.
   - Postman v2.1: one item per step (+ "Reset mock" items), checks as pm.test, captures as collection variables.
   - pytest + requests: one test per case (data rows → parametrize), same check semantics as the tool.
   - Evidence report: Markdown and CSV (UTF-8 BOM) of the last "Run all".
   Secrets: Authorization / X-API-Key / Cookie values are never written unless they are the published demo keys. */
import { DEMO_KEYS, buildRequest, isSecretHeader, maskUrl, normReq, substitute } from './logic.js';

export const LOCAL_ORIGIN = () => {
  try { if (typeof window !== 'undefined' && !window.KIT_DEMO && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(window.location.origin)) return window.location.origin; } catch (e) { /* node */ }
  return 'http://localhost:4317';
};
/** issuer.example / mock:// URLs → the local app's mock path (exports must run outside the page). */
export function exportUrl(url, origin = LOCAL_ORIGIN()) {
  return String(url)
    .replace(/^https?:\/\/issuer\.example\/(harbor|lumiere)\/v1/, `${origin}/mock/$1/v1`)
    .replace(/^https?:\/\/issuer\.example\/v1/, `${origin}/mock/harbor/v1`)
    .replace(/^mock:\/\/(harbor|lumiere)\/v1/, `${origin}/mock/$1/v1`);
}
export const exportVars = (vars, origin) => Object.fromEntries(Object.entries(vars || {}).map(([k, v]) => [k, k === 'base_url' ? exportUrl(v, origin) : v]));
const isDemoValue = (v) => DEMO_KEYS.some((d) => String(v).includes(d));
const shq = (s) => `'${String(s).replace(/'/g, `'\\''`)}'`;
const slug = (s) => String(s || 'case').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 60) || 'case';
const secretVarNames = (env) => new Set(((env && env.vars) || []).filter((v) => v.secret && !isDemoValue(v.value)).map((v) => v.key));

/* ---------------------------------------------------------------- curl */
export function toCurl(req, vars = {}, { origin } = {}) {
  const b = buildRequest(req, vars);
  const parts = [`curl -sS -X ${b.method} ${shq(exportUrl(maskUrl(b.url), origin))}`];
  for (const [k, v] of b.headers) {
    if (isSecretHeader(k) && !isDemoValue(v)) parts.push(`-H "${String(k).replace(/["\\$`]/g, '')}: ${/^bearer /i.test(v) ? 'Bearer ' : /^basic /i.test(v) ? 'Basic ' : ''}$API_TOKEN"`);
    else parts.push(`-H ${shq(`${k}: ${v}`)}`);
  }
  if (b.body) parts.push(`--data-raw ${shq(b.body)}`);
  return parts.join(' \\\n  ');
}

/* ---------------------------------------------------------------- expand cases (data rows) */
export function expandCase(c) {
  const rows = Array.isArray(c.data) && c.data.length ? c.data : [null];
  return rows.map((row, i) => ({ label: row ? `${c.name} [${i + 1}]` : c.name, row: row || {}, steps: (c.steps || []).map((s) => ({ ...s, req: normReq(s.req) })) }));
}
const KIT_JS = [
  'function kitPath(o, p) { const parts = []; String(p).replace(/^\\$/, "").replace(/\\.([A-Za-z_$][\\w$-]*)|\\[(-?\\d+)\\]|\\[\\*\\]|\\[[\'"]([^\'"]+)[\'"]\\]/g, (m, a, b, c) => { parts.push(a != null ? a : b != null ? Number(b) : c != null ? c : "*"); return ""; }); let cur = [o], many = false; for (const k of parts) { const nx = []; for (const x of cur) { if (x == null || typeof x !== "object") continue; if (k === "*") { many = true; nx.push(...(Array.isArray(x) ? x : Object.values(x))); } else if (typeof k === "number") { const i = k < 0 ? x.length + k : k; if (Array.isArray(x) && i in x) nx.push(x[i]); } else if (k in x) nx.push(x[k]); } cur = nx; } return many ? cur : cur[0]; }',
  'function kitStr(v) { return v !== null && typeof v === "object" ? JSON.stringify(v) : String(v); }',
];
function pmCheck(c) {
  const name = `${c.target}${c.key ? ' ' + c.key : ''} ${c.op} ${c.expected}`.trim().replace(/"/g, "'");
  const e = JSON.stringify(String(c.expected));
  const t = (body) => `pm.test(${JSON.stringify(name)}, () => ${body});`;
  if (c.target === 'status' && c.op === 'eq') return t(`pm.response.to.have.status(${Number(c.expected)})`);
  if (c.target === 'status' && c.op === 'ne') return t(`pm.expect(pm.response.code).to.not.equal(${Number(c.expected)})`);
  if (c.target === 'status' && c.op === 'in') return t(`pm.expect([${String(c.expected).split(/[,\s]+/).filter(Boolean).map(Number).join(', ')}]).to.include(pm.response.code)`);
  if (c.target === 'status' && c.op === 'between') { const [a, b] = String(c.expected).split(/\s*[-–]\s*/).map(Number); return t(`pm.expect(pm.response.code).to.be.within(${a}, ${b})`); }
  if (c.target === 'time') return t(`pm.expect(pm.response.responseTime).to.be.below(${Number(c.expected) + (c.op === 'lte' ? 1 : 0)})`);
  if (c.target === 'size') return t(`pm.expect(pm.response.responseSize).to.be.below(${Number(c.expected)})`);
  if (c.target === 'body') return t(c.op === 'contains' ? `pm.expect(pm.response.text()).to.include(${e})` : `pm.expect(pm.response.text()).to.not.include(${e})`);
  if (c.target === 'header') {
    const h = `pm.response.headers.get(${JSON.stringify(c.key)})`;
    if (c.op === 'exists') return t(`pm.expect(${h}).to.exist`);
    if (c.op === 'eq') return t(`pm.expect(${h}).to.eql(${e})`);
    if (c.op === 'starts') return t(`pm.expect(String(${h})).to.match(new RegExp("^" + ${e}.replace(/[.*+?^\${}()|[\\]\\\\]/g, "\\\\$&")))`);
    return t(`pm.expect(String(${h})).to.include(${e})`);
  }
  const v = `kitPath(pm.response.json(), ${JSON.stringify(c.key)})`;
  switch (c.op) {
    case 'eq': return t(`pm.expect(kitStr(${v})).to.eql(${e})`);
    case 'ne': return t(`pm.expect(kitStr(${v})).to.not.eql(${e})`);
    case 'contains': return t(`pm.expect(kitStr(${v})).to.include(${e})`);
    case 'starts': return t(`pm.expect(kitStr(${v}).startsWith(${e})).to.be.true`);
    case 'ends': return t(`pm.expect(kitStr(${v}).endsWith(${e})).to.be.true`);
    case 'exists': return t(`pm.expect(${v}).to.not.equal(undefined)`);
    case 'not_exists': return t(`pm.expect(${v}).to.equal(undefined)`);
    case 'empty': return t(`pm.expect(${v}).to.be.empty`);
    case 'not_empty': return t(`pm.expect(${v}).to.not.be.empty`);
    case 'type': return t(`pm.expect(${v} === null ? "null" : Array.isArray(${v}) ? "array" : typeof ${v}).to.eql(${e})`);
    case 'matches': return t(`pm.expect(kitStr(${v})).to.match(new RegExp(${e}))`);
    case 'gt': return t(`pm.expect(Number(${v})).to.be.above(${Number(c.expected)})`);
    case 'lt': return t(`pm.expect(Number(${v})).to.be.below(${Number(c.expected)})`);
    case 'len': return t(`pm.expect(${v}).to.have.lengthOf(${Number(c.expected)})`);
    default: return `// check not exported: ${name}`;
  }
}
const resolveRow = (s, row) => substitute(s, row);
function pmItem(name, req, row, mockBase) {
  const headers = [];
  const a = req.auth;
  if (a.type === 'bearer' && a.token) headers.push({ key: 'Authorization', value: 'Bearer ' + resolveRow(a.token, row) });
  if (a.type === 'apikey' && a.in !== 'query' && a.key) headers.push({ key: a.key, value: resolveRow(a.value, row) });
  for (const h of req.headers) if (h.on !== false && h.key) headers.push({ key: h.key, value: resolveRow(h.value, row), disabled: false });
  const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && String(req.body || '').trim();
  if (hasBody && !headers.some((h) => /^content-type$/i.test(h.key))) headers.push({ key: 'Content-Type', value: 'application/json' });
  const params = req.params.filter((p) => p.on !== false && p.key).map((p) => ({ ...p, value: resolveRow(p.value, row) }));
  if (a.type === 'apikey' && a.in === 'query' && a.key) params.push({ key: a.key, value: resolveRow(a.value, row) });
  let url = resolveRow(req.url, row);
  if (params.length) url += '?' + params.map((p) => `${p.key}=${p.value}`).join('&');
  const exec = [...KIT_JS, ...req.checks.filter((c) => c.on !== false).map((c) => pmCheck({ ...c, key: resolveRow(c.key, row), expected: resolveRow(c.expected, row) })),
    ...(req.captures || []).filter((x) => x.var && x.path).map((x) => `pm.collectionVariables.set(${JSON.stringify(x.var)}, kitStr(kitPath(pm.response.json(), ${JSON.stringify(x.path)})));`)];
  const item = { name, request: { method: req.method, header: headers.map((h) => ({ key: h.key, value: isSecretHeader(h.key) && !isDemoValue(h.value) && !/\{\{/.test(h.value) ? (/^bearer /i.test(h.value) ? 'Bearer {{token}}' : '{{token}}') : h.value, type: 'text' })), url } };
  if (a.type === 'basic') item.request.auth = { type: 'basic', basic: [{ key: 'username', value: resolveRow(a.user, row) }, { key: 'password', value: '{{password}}' }] };
  if (hasBody) item.request.body = { mode: 'raw', raw: resolveRow(req.body, row), options: { raw: { language: 'json' } } };
  item.event = [{ listen: 'test', script: { type: 'text/javascript', exec } }];
  return item;
}
export function toPostman(name, cases, vars = {}, { origin, env } = {}) {
  const secrets = secretVarNames(env);
  const ev = exportVars(vars, origin);
  const items = [];
  for (const c of cases) {
    for (const x of expandCase(c)) {
      const sub = [];
      if (c.reset) sub.push({ name: 'Reset mock', request: { method: 'POST', header: [], url: '{{base_url}}/_mock/reset' }, event: [{ listen: 'test', script: { type: 'text/javascript', exec: ['pm.test("Mock reset", () => pm.response.to.have.status(204));'] } }] });
      x.steps.forEach((s, i) => sub.push(pmItem(s.name || s.req.name || `${i + 1}. ${s.req.method}`, s.req, x.row)));
      items.push(sub.length === 1 ? { ...sub[0], name: x.label } : { name: x.label, item: sub });
    }
  }
  return {
    info: { _postman_id: 'analyst-kit-' + slug(name), name, description: 'Generated by Analyst Kit V2 (API tester). Run with Postman or newman. The Harbor Bank / Banque Lumière mock runs in the local app (python3 app/server/server.py).',
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' },
    item: items,
    variable: Object.entries(ev).map(([key, value]) => ({ key, value: secrets.has(key) ? '' : String(value ?? '') })).concat(ev.token === undefined ? [{ key: 'token', value: '' }] : []),
  };
}

/* ---------------------------------------------------------------- pytest */
const py = (v) => JSON.stringify(v);  // a JSON string literal is a valid Python str literal for our content
const PY_HELPERS = String.raw`
_VAR = re.compile(r"\{\{\s*([\w.-]+)\s*\}\}")


def sub(s, v):
    return _VAR.sub(lambda m: str(v[m.group(1)]) if m.group(1) in v and v[m.group(1)] is not None else m.group(0), str(s or ""))


def path(obj, p):
    """JSON path like $.a.b[0].c, $.items[*].status, $.ledger[-1].debit (same syntax as the API tester)."""
    parts = []
    for a, b, c, star in re.findall(r"\.([A-Za-z_$][\w$-]*)|\[(-?\d+)\]|\['([^']+)'\]|(\[\*\])", re.sub(r"^\$", "", p)):
        parts.append(a or (int(b) if b else c) if not star else "*")
    cur, many = [obj], False
    for k in parts:
        nxt = []
        for x in cur:
            if k == "*" and isinstance(x, (list, dict)):
                many = True
                nxt.extend(x if isinstance(x, list) else x.values())
            elif isinstance(k, int) and isinstance(x, list) and -len(x) <= k < len(x):
                nxt.append(x[k])
            elif isinstance(k, str) and k != "*" and isinstance(x, dict) and k in x:
                nxt.append(x[k])
        cur = nxt
    if many:
        return True, cur, True
    return (True, cur[0], False) if cur else (False, None, False)


def _s(v):
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (dict, list)):
        return json.dumps(v, separators=(",", ":"), ensure_ascii=False)
    if isinstance(v, float) and v.is_integer():
        return str(int(v))
    return str(v)


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return float("nan")


def _apply(op, actual, e, found):
    if op == "eq":
        return found and (_s(actual) == e or (e.startswith('"') and _s(actual) == e.strip('"')))
    if op == "ne":
        return found and _s(actual) != e
    if op == "in":
        return _s(actual) in re.split(r"[,\s]+", e)
    if op == "between":
        lo, hi = re.split(r"\s*[-\u2013]\s*", e.strip())
        return float(lo) <= _num(actual) <= float(hi)
    if op == "lt":
        return _num(actual) < _num(e)
    if op == "lte":
        return _num(actual) <= _num(e)
    if op == "gt":
        return _num(actual) > _num(e)
    if op == "contains":
        return actual is not None and (any(_s(x) == e for x in actual) if isinstance(actual, list) else e in _s(actual))
    if op == "not_contains":
        return actual is None or e not in _s(actual)
    if op == "starts":
        return actual is not None and _s(actual).startswith(e)
    if op == "ends":
        return actual is not None and _s(actual).endswith(e)
    if op == "exists":
        return found
    if op == "not_exists":
        return not found
    if op == "empty":
        return found and actual in (None, "", [], {})
    if op == "not_empty":
        return found and actual not in (None, "", [], {})
    if op == "type":
        t = "null" if actual is None else "boolean" if isinstance(actual, bool) else "number" if isinstance(actual, (int, float)) else \
            "string" if isinstance(actual, str) else "array" if isinstance(actual, list) else "object"
        return found and t == e.lower()
    if op == "matches":
        return actual is not None and re.search(e, _s(actual)) is not None
    if op == "len":
        return isinstance(actual, (list, str)) and len(actual) == int(_num(e))
    return False


def check(r, ms, target, key, op, expected):
    """Same rules as the API tester's no-code checks. Fails with "expected ... got ..." in plain words."""
    found, actual, many = True, None, False
    if target == "status":
        actual = r.status_code
    elif target == "time":
        actual = ms
    elif target == "size":
        actual = len(r.content)
    elif target == "header":
        actual = r.headers.get(key)
        found = actual is not None
    elif target == "body":
        actual = r.text
    else:
        try:
            found, actual, many = path(r.json(), key)
        except ValueError:
            found, actual = False, None
    if many and op not in ("len", "exists", "not_exists", "empty", "not_empty", "contains"):
        ok = bool(actual) and all(_apply(op, a, str(expected), True) for a in actual)
    else:
        ok = _apply(op, actual, str(expected), found)
    assert ok, "%s %s: expected %s %s, got %s" % (target, key, op, expected, _s(actual) if found else "(missing)")


def send(v, method, url, headers, body):
    t0 = time.perf_counter()
    r = requests.request(method, sub(url, v), headers={sub(k, v): sub(x, v) for k, x in headers},
                         data=sub(body, v).encode("utf-8") if body else None, timeout=30)
    return r, (time.perf_counter() - t0) * 1000
`;
export function toPytest(cases, vars = {}, { origin, env, title = 'API tests' } = {}) {
  const secrets = secretVarNames(env);
  const ev = exportVars(vars, origin);
  const out = [
    `"""${title.replace(/"/g, "'")} - generated by Analyst Kit V2 (API tester).`,
    '',
    'Run:  pip install requests pytest  &&  pytest -q ' + slug(title) + '_test.py',
    'The Harbor Bank / Banque Lumière demo API is served by the local app: python3 app/server/server.py',
    'Override with env vars: BASE_URL, API_TOKEN (never commit real keys).',
    '"""',
    'import json', 'import os', 'import re', 'import time', '', 'import pytest', 'import requests', '',
    `VARS = {`,
    ...Object.entries(ev).filter(([k]) => k !== 'base_url').map(([k, v]) => `    ${py(k)}: ${secrets.has(k) ? `os.environ.get("API_TOKEN", "")` : py(String(v ?? ''))},`),
    `    "base_url": os.environ.get("BASE_URL", ${py(ev.base_url || '')}),`,
    '}', PY_HELPERS, '',
  ];
  const used = new Set();
  for (const c of cases) {
    let fn = 'test_' + slug(c.name);
    while (used.has(fn)) fn += '_x';
    used.add(fn);
    const rows = Array.isArray(c.data) && c.data.length ? c.data : null;
    if (rows) out.push(`@pytest.mark.parametrize("row", ${py(rows)})`, `def ${fn}(row):`, '    v = dict(VARS, **row)');
    else out.push(`def ${fn}():`, '    v = dict(VARS)');
    out.push(`    """${String(c.name).replace(/"/g, "'")}"""`);
    if (c.reset) out.push('    requests.post(sub("{{base_url}}/_mock/reset", v), timeout=30)');
    (c.steps || []).forEach((s, i) => {
      const r = normReq(s.req);
      const hs = [];
      const a = r.auth;
      if (a.type === 'bearer' && a.token) hs.push(['Authorization', 'Bearer ' + a.token]);
      if (a.type === 'basic') hs.push(['Authorization', '__BASIC__']);
      if (a.type === 'apikey' && a.in !== 'query' && a.key) hs.push([a.key, a.value]);
      for (const h of r.headers) if (h.on !== false && h.key) hs.push([h.key, h.value]);
      const hasBody = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method) && String(r.body || '').trim();
      if (hasBody && !hs.some(([k]) => /^content-type$/i.test(k))) hs.push(['Content-Type', 'application/json']);
      const params = r.params.filter((p) => p.on !== false && p.key);
      if (a.type === 'apikey' && a.in === 'query' && a.key) params.push({ key: a.key, value: a.value });
      const url = r.url + (params.length ? '?' + params.map((p) => `${p.key}=${p.value}`).join('&') : '');
      const hdr = hs.map(([k, v]) => (k === 'Authorization' && v === '__BASIC__' ? `("Authorization", "Basic " + __import__("base64").b64encode(sub(${py(a.user + ':' + a.pass)}, v).encode()).decode())`
        : isSecretHeader(k) && !isDemoValue(v) && !/\{\{/.test(v) ? `(${py(k)}, ${/^bearer /i.test(v) ? '"Bearer " + ' : ''}os.environ.get("API_TOKEN", ""))` : `(${py(k)}, ${py(v)})`));
      out.push(`    # step ${i + 1}: ${(s.name || r.name || r.method + ' ' + r.url).replace(/\n/g, ' ')}`);
      out.push(`    r, ms = send(v, ${py(r.method)}, ${py(url)}, [${hdr.join(', ')}], ${hasBody ? py(r.body) : 'None'})`);
      for (const ck of r.checks.filter((x) => x.on !== false)) out.push(`    check(r, ms, ${py(ck.target)}, sub(${py(ck.key || '')}, v), ${py(ck.op)}, sub(${py(ck.expected)}, v))`);
      for (const cp of (r.captures || []).filter((x) => x.var && x.path)) out.push(`    v[${py(cp.var)}] = _s(path(r.json(), ${py(cp.path)})[1])`);
    });
    out.push('', '');
  }
  return out.join('\n').replace(/\n{4,}/g, '\n\n\n');
}

/* ---------------------------------------------------------------- evidence report */
const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
export function reportRows(suite) {
  const rows = [];
  for (const c of (suite && suite.results) || []) for (const run of c.runs || []) for (const st of run.steps || []) {
    if (!st.checks.length) rows.push({ case: run.label, step: st.name, method: st.method, url: st.url, status: st.status ?? '', ms: st.ms ?? '', check: '', expected: '', actual: st.error || '', result: st.error ? 'FAIL' : 'PASS' });
    for (const k of st.checks) rows.push({ case: run.label, step: st.name, method: st.method, url: st.url, status: st.status ?? '', ms: st.ms ?? '', check: k.text, expected: k.expected, actual: k.actual, result: k.pass ? 'PASS' : 'FAIL' });
  }
  return rows;
}
export function toReportMd(suite, T, { env = '', title = '' } = {}) {
  if (!suite || !suite.results) return `# ${title || T('reportTitle')}\n\n${T('reportEmpty')}\n`;
  const s = suite.summary;
  const out = [`# ${title || T('reportTitle')}`, '',
    `**${T('reportResult')}:** ${s.passed}/${s.total} ${T('casesPassed')}${s.failed ? ` · ${s.failed} ${T('casesFailed')}` : ''}  `,
    `**${T('reportWhen')}:** ${suite.at}  `, `**${T('reportEnv')}:** ${env || '—'}  `, `**${T('reportVia')}:** ${suite.via || '—'}`, '',
    `| ${T('colCase')} | ${T('colResult')} | ${T('colChecks')} | ${T('colTime')} |`, '|---|---|---:|---:|'];
  for (const c of suite.results) for (const run of c.runs) {
    const checks = run.steps.flatMap((st) => st.checks);
    out.push(`| ${mdCell(run.label)} | ${run.pass ? 'PASS' : '**FAIL**'} | ${checks.filter((k) => k.pass).length}/${checks.length} | ${run.steps.reduce((n, st) => n + (st.ms || 0), 0)} ms |`);
  }
  out.push('', `## ${T('reportDetail')}`, '');
  for (const c of suite.results) for (const run of c.runs) {
    out.push(`### ${run.pass ? 'PASS' : 'FAIL'} · ${run.label}`, '');
    for (const st of run.steps) {
      out.push(`- \`${st.method} ${mdCell(st.url)}\` → ${st.error ? '**' + mdCell(st.error) + '**' : `${st.status} · ${st.ms} ms`}`);
      for (const k of st.checks) out.push(`  - ${k.pass ? '✓' : '✗'} ${mdCell(k.text)}`);
    }
    out.push('');
  }
  out.push('---', T('reportFooter'));
  return out.join('\n');
}
const csvCell = (v) => { const s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function toReportCsv(suite, { env = '' } = {}) {
  const head = ['case', 'step', 'method', 'url', 'status', 'time_ms', 'check', 'expected', 'actual', 'result', 'timestamp', 'environment'];
  const rows = reportRows(suite).map((r) => [r.case, r.step, r.method, r.url, r.status, r.ms, r.check, r.expected, r.actual, r.result, suite.at, env]);
  return '\uFEFF' + [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
