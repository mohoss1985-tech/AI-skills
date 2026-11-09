/* API tester · case runner (owner C). Transport is injected, so it runs the same in the page and in Node tests.
   runCase(case, {vars, send(built) → res, reset(url) → res, onStep(info), T}) → {caseId, name, pass, runs: [{label, pass, steps}]}
   - data rows (TC-04 style): one run per row, row values become {{variables}};
   - case.reset: POST /_mock/reset on the case's bank before each run (mock URLs only);
   - captures: "save $.token_ref as {{token_ref}}" for the next steps (chaining). */
import { buildRequest, explain, getPath, parseJsonBody, runChecks, scanPans } from './logic.js';
import { mockRoute } from '../../mock/bank.js';

export async function runSteps(steps, { vars = {}, send, onStep, T, label = '', checkPans = true }) {
  const v = { ...vars };
  const out = [];
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const built = buildRequest(s.req, v);
    if (onStep) onStep({ label, index: i, total: steps.length, built });
    const info = { name: s.name || s.req.name || `${built.method} ${built.url}`, method: built.method, url: built.url, missing: built.missing };
    const pans = checkPans ? scanPans(built.url + ' ' + built.body) : [];
    if (pans.length) { out.push({ ...info, error: T ? T('panBlocked') : 'non-test PAN', checks: [], pass: false, blocked: true }); break; }
    const res = await send(built);
    const checks = runChecks(res, s.req.checks, v).map((c) => ({ ...c, text: T ? explain(c, T) : `${c.target} ${c.op} ${c.expected}`,
      actual: c.actual === undefined ? '' : typeof c.actual === 'string' ? c.actual : JSON.stringify(c.actual) }));
    const js = parseJsonBody(res);
    for (const cp of s.req.captures || []) {
      if (!cp.var || !cp.path || !js.ok) continue;
      const g = getPath(js.value, cp.path);
      if (g.found) v[cp.var] = typeof g.value === 'string' ? g.value : JSON.stringify(g.value);
    }
    out.push({ ...info, status: res.ok ? res.status : null, reason: res.reason, ms: res.time_ms, size: res.size, via: res.via,
      error: res.ok ? '' : (res.error || res.code || 'error'), code: res.code, checks, pass: !!res.ok && checks.every((c) => c.pass), res });
  }
  return { steps: out, vars: v, pass: out.length === steps.length && out.every((x) => x.pass) };
}

export async function runCase(c, { vars = {}, send, reset, onStep, T }) {
  const rows = Array.isArray(c.data) && c.data.length ? c.data : [null];
  const runs = [];
  for (let r = 0; r < rows.length; r++) {
    const label = rows[r] ? `${c.name} [${r + 1}: ${Object.values(rows[r]).slice(0, 2).join(', ')}]` : c.name;
    const first = c.steps[0] && buildRequest(c.steps[0].req, { ...vars, ...(rows[r] || {}) }).url;
    if (c.reset && reset && first && mockRoute(first)) await reset(first);
    const res = await runSteps(c.steps, { vars: { ...vars, ...(rows[r] || {}) }, send, onStep, T, label });
    runs.push({ label, pass: res.pass, steps: res.steps.map(({ res: _r, ...x }) => x), vars: res.vars });
  }
  return { caseId: c.id, name: c.name, pass: runs.every((x) => x.pass), runs };
}

export async function runSuite(cases, opts) {
  const results = [];
  for (let i = 0; i < cases.length; i++) {
    if (opts.onCase) opts.onCase(i, cases.length, cases[i]);
    results.push(await runCase(cases[i], opts));
  }
  const total = results.length, passed = results.filter((r) => r.pass).length;
  return { kind: 'suite', at: new Date().toISOString().replace(/\.\d+Z$/, 'Z'), results, summary: { total, passed, failed: total - passed } };
}
