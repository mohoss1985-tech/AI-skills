/* API tester (testing-apis). Owner C. Method + URL · Auth · Data · Expect → a real HTTP call, a readable answer,
   no-code checks, test cases, Run all, and UAT evidence (curl / Postman / pytest / Markdown / CSV).
   Transports in send.js (in-page mock · local proxy · browser fetch), pure logic in logic.js, case runner in
   runner.js, exports in exporters.js, samples in samples.js, YAML reader for OpenAPI import in yaml.js.
   The mock bank (Harbor Bank EN / Banque Lumière FR) lives in ../../mock/bank.js (shared with the K simulators). */
import { register, getLang } from '../../core/i18n.js';
import { DEMO } from '../../core/api.js';
import strings from './i18n.js';
import * as L from './logic.js';
import { sendRequest, resetMockFor, routeFor } from './send.js';
import { runSuite } from './runner.js';
import { toCurl, toPostman, toPytest, toReportCsv, toReportMd } from './exporters.js';
import { parseYaml } from './yaml.js';
import { SAMPLES, envFor } from './samples.js';
import { testCards } from '../../mock/bank.js';

const T = register('api-tester', strings);
const F = (key, vars = {}) => T(key).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
register('err', {
  en: { 'http.timeout': 'No answer in time. Check the URL or raise the timeout under More.', 'http.production_confirm': 'This host looks like production.', 'http.cors': 'The browser blocked this call (CORS).' },
  fr: { 'http.timeout': 'Pas de réponse à temps. Vérifiez l\'URL ou augmentez le délai dans Plus.', 'http.production_confirm': 'Cet hôte ressemble à de la production.', 'http.cors': 'Le navigateur a bloqué cet appel (CORS).' },
});

let V = null;          // mounted view: {ctx, ui, frame, refs...}
let mode = { kind: 'send' };

/* ---------------------------------------------------------------- state */
function defaults() {
  const lang = getLang() === 'fr' ? 'fr' : 'en';
  return { req: L.emptyReq(), env: envFor(lang), settings: { timeout: 30, follow: true, verifyTls: true }, cases: [], history: [],
    editing: null, touched: false, tab: 'auth', side: 'cases', vars: {}, results: {}, lastSuite: null, resetFirst: false, guide: false, ai: {} };
}
const S = () => V.ctx.state;
const set = (patch) => V.ctx.setState(patch);
const setReq = (patch) => set({ req: { ...S().req, ...patch } });
const allVars = (st = S()) => L.varsOf(st.env, st.vars);
const editingCase = (st = S()) => st.editing && st.cases.find((c) => c.id === st.editing.caseId);

/** Secrets never go into history or saved cases unless they are {{variables}} or the published demo keys. */
function sanitizeReq(req) {
  const r = L.normReq(L.clone(req));
  const keep = (v) => !v || /\{\{/.test(v) || L.DEMO_KEYS.includes(v);
  if (!keep(r.auth.token)) r.auth.token = '';
  if (!keep(r.auth.value)) r.auth.value = '';
  if (!keep(r.auth.pass)) r.auth.pass = '';
  r.headers = r.headers.map((h) => (L.isSecretHeader(h.key) && !keep(h.value) ? { ...h, value: '' } : h));
  return r;
}

/* ---------------------------------------------------------------- module */
const tool = {
  id: 'api-tester',
  skill: 'testing-apis',
  icon: 'send',
  title: { en: 'API tester', fr: 'Testeur d\'API' },
  purpose: { en: 'Send a real request, read the answer, turn it into checks and test cases. No code.', fr: 'Envoyez une vraie requête, lisez la réponse, transformez-la en contrôles et cas de test. Sans code.' },
  primary: { label: { en: 'Send', fr: 'Envoyer' }, icon: 'send' },
  layout: 'split',
  schema: 1,
  defaults,
  samples: SAMPLES,
  mount,
  validate(st) {
    if (mode.kind !== 'send') return [];
    if (!String(st.req.url || '').trim()) return [{ field: 'url', message: T('errUrl') }];
    return [];
  },
  run,
  renderResult,
  status(r, ms) {
    if (!r) return null;
    if (r.kind === 'send') {
      if (!r.res.ok) return { tone: 'bad', text: T('noAnswer'), ms: r.res.time_ms };
      const c = L.caseSummary(r.checks);
      return { status: r.res.status, text: r.res.reason + (c.total ? ` · ${c.passed}/${c.total} ${c.pass ? '✓' : '✗'}` : ''), ms: r.res.time_ms, bytes: r.res.size };
    }
    const s = r.summary;
    return { tone: s.failed ? 'bad' : 'ok', text: `${s.passed}/${s.total} ${T('casesPassed')} ${s.failed ? '✗' : '✓'}`, ms };
  },
  toMarkdown,
  exports: [
    { id: 'curl', label: { en: 'cURL (this request)', fr: 'cURL (cette requête)' }, build: (st) => ({ name: 'request.sh', mime: 'text/x-shellscript', text: curlNote() + toCurl(st.req, allVars(st)) + '\n' }) },
    { id: 'postman', label: { en: 'Postman collection v2.1 (with tests)', fr: 'Collection Postman v2.1 (avec tests)' }, build: (st) => ({ name: 'analyst-kit.postman_collection.json', mime: 'application/json', text: JSON.stringify(toPostman(T('collectionName'), casesForExport(st), allVars(st), { env: st.env }), null, 2) }) },
    { id: 'pytest', label: { en: 'pytest file', fr: 'Fichier pytest' }, build: (st) => ({ name: 'analyst_kit_api_test.py', mime: 'text/x-python', text: toPytest(casesForExport(st), allVars(st), { env: st.env, title: T('collectionName') }) }) },
    { id: 'report-md', label: { en: 'Evidence report (Markdown)', fr: 'Rapport de preuve (Markdown)' }, build: (st, r) => ({ name: 'api-test-report.md', mime: 'text/markdown', text: toReportMd(suiteFor(st, r), T, { env: st.env.name }) }) },
    { id: 'report-csv', label: { en: 'Evidence report (CSV)', fr: 'Rapport de preuve (CSV)' }, build: (st, r) => ({ name: 'api-test-report.csv', mime: 'text/csv', text: toReportCsv(suiteFor(st, r), { env: st.env.name }) }) },
  ],
  aiActions: [
    { id: 'generate-cases', label: { en: 'Generate test cases from this endpoint', fr: 'Générer des cas de test pour ce point d\'accès' }, expects: 'json', prompt: promptGenerate },
    { id: 'explain-failure', label: { en: 'Explain this failure', fr: 'Expliquer cet échec' }, expects: 'markdown', prompt: promptExplain },
  ],
  onSave() { saveAsCase(); },
  async tick(ctx) {
    // Claude's structured answer (kit.py patch) lands in workspace.state.ai['generate-cases']: show it when it arrives.
    if (!V || V.ctx !== ctx || !ctx.workspace || !ctx.workspace.id || !ctx.store) return;
    try {
      const ws = await ctx.store.get(ctx.workspace.id);
      const ai = ws && ws.state && ws.state.ai;
      if (ai && JSON.stringify(ai) !== JSON.stringify(S().ai || {})) { ctx.setState({ ai }); paintAiNote(); }
    } catch (e) { /* offline: try again next tick */ }
  },
  migrate: (old) => ({ ...defaults(), ...old }),
};
export default tool;

function casesForExport(st) {
  if (st.cases.length) return st.cases;
  return [{ id: 'current', name: st.req.name || `${st.req.method} ${L.shortUrl(st.req.url)}`, reset: L.isMock(L.buildRequest(st.req, allVars(st)).url), steps: [{ req: st.req }] }];
}
const suiteFor = (st, r) => (r && r.kind === 'suite' ? r : st.lastSuite);
const curlNote = () => (DEMO ? `# ${T('curlNoteDemo')}\n` : '');

/* ---------------------------------------------------------------- mount */
const div = (cls, text) => { const d = document.createElement('div'); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; };
const el = (tag, cls, text) => { const d = document.createElement(tag); if (cls) d.className = cls; if (text != null) d.textContent = text; return d; };

function mount(root, ctx) {
  const { ui, frame } = ctx;
  V = { ctx, ui, frame, root };
  if (!ctx.state.req) ctx.setState(defaults(), { silent: true, replace: true });

  // command bar: Method + URL (the primary Send button is the frame's)
  const method = ui.select({ options: L.METHODS, value: S().req.method, ariaLabel: T('method'), mono: true, id: 'api-method', onChange: (v) => { setReq({ method: v }); paintTabs(); paintWarn(); } });
  V.method = method;
  const url = ui.input({ value: S().req.url, mono: true, placeholder: T('urlPlaceholder'), ariaLabel: T('url'), id: 'api-url',
    onInput: (v) => onUrlInput(v), onChange: (v) => onUrlCommit(v) });
  V.url = url;
  url.addEventListener('paste', (e) => {
    const text = (e.clipboardData || window.clipboardData).getData('text');
    if (L.looksLikeCurl(text)) { e.preventDefault(); importCurl(text); }
  });
  const mField = ui.field({ label: T('method'), input: method, id: 'api-method' });
  mField.classList.add('at-method');
  const uField = frame.bindField('url', ui.field({ label: T('url'), help: T('urlHelp'), required: true, input: url, mono: true, id: 'api-url' }));
  uField.classList.add('at-url');
  frame.command.append(mField, uField);

  // config pane
  V.guide = div('at-guide');
  V.ai = div('at-ai');
  V.warn = div('at-warn');
  V.reqBox = div('at-req');
  V.side = div('at-side panel');
  root.append(V.guide, V.ai, V.warn, V.reqBox, V.side);
  paintGuide(); paintAiNote(); paintWarn(); paintTabs(); paintSide();

  // results: empty state until the first send
  frame.output.append(ui.emptyState({ icon: 'send', title: T('emptyTitle'), text: T('emptyText'),
    sample: { label: T('loadDemo'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } }));
  frame.output.append(fourInputs());

  // ⌘⇧C copies the request as curl
  const onKey = (e) => {
    if (!V || V.root !== root || !root.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'c') { e.preventDefault(); copyCurl(); }
  };
  document.addEventListener('keydown', onKey);
}

function fourInputs() {
  const box = div('at-four');
  box.append(el('h3', 'section-label', T('fourTitle')));
  const ol = el('ol');
  for (const k of ['four1', 'four2', 'four3', 'four4']) { const li = el('li'); const [a, b] = T(k).split(' · '); li.append(el('b', '', a), document.createTextNode(b ? ' · ' + b : '')); ol.append(li); }
  box.append(ol);
  return box;
}

function onUrlInput(v) {
  if (L.looksLikeCurl(v)) return; // handled on paste / commit
  setReq({ url: v });
  paintWarn();
}
function onUrlCommit(v) {
  if (L.looksLikeCurl(v)) { importCurl(v); return; }
  if (v.includes('?')) {
    const { base, params } = L.splitUrl(v);
    const keep = S().req.params.filter((p) => !params.some((q) => q.key === p.key));
    setReq({ url: base, params: [...keep, ...params] });
    V.url.value = base;
    paintTabs();
  }
}
function importCurl(text) {
  try {
    const { req, notes } = L.parseCurl(text);
    set({ req, editing: null, touched: true, tab: req.body ? 'body' : 'auth' });
    afterLoad();
    V.ui.toast(T('curlImported') + (notes.includes('form') ? ' · ' + T('curlFormNote') : ''), { tone: 'ok' });
  } catch (e) {
    V.frame.showErrors([{ field: 'url', message: T('curlBad') }]);
  }
}

/* ---------------------------------------------------------------- guide, AI note, warnings */
function paintGuide() {
  V.guide.replaceChildren();
  if (!S().guide) return;
  const box = div('panel at-guide-box');
  const head = div('at-guide-head');
  head.append(V.ui.badge({ text: T('guideBadge'), tone: 'accent', icon: 'timer' }), el('b', '', T('guideTitle')));
  head.append(V.ui.button({ icon: 'x', ariaLabel: T('close'), variant: 'ghost', size: 'sm', onClick: () => { set({ guide: false }); paintGuide(); } }));
  const ol = el('ol');
  for (const k of ['guide1', 'guide2', 'guide3', 'guide4']) ol.append(el('li', '', T(k)));
  box.append(head, ol);
  V.guide.append(box);
}
function paintAiNote() {
  if (!V) return;
  V.ai.replaceChildren();
  const g = S().ai && S().ai['generate-cases'];
  const list = g && Array.isArray(g.cases) ? g.cases : [];
  if (!list.length) return;
  const box = div('panel at-ai-box');
  box.append(V.ui.badge({ text: T('aiBadge'), tone: 'accent', icon: 'sparkles' }), el('span', '', F('aiReady', { n: list.length })));
  box.append(V.ui.button({ label: T('aiAdd'), size: 'sm', variant: 'primary', onClick: () => {
    const add = list.map((c) => ({ id: L.uid('case'), name: '[AI] ' + (c.name || T('untitled')), reset: !!c.reset, data: c.data,
      steps: (c.steps || []).map((s) => ({ name: s.name || '', req: L.normReq(s.req || s) })) })).filter((c) => c.steps.length);
    const ai = { ...S().ai }; delete ai['generate-cases'];
    set({ cases: [...S().cases, ...add], ai, side: 'cases' });
    paintAiNote(); paintSide();
    V.ui.toast(F('aiAdded', { n: add.length }), { tone: 'ok' });
  } }), V.ui.button({ label: T('dismiss'), size: 'sm', variant: 'ghost', onClick: () => { const ai = { ...S().ai }; delete ai['generate-cases']; set({ ai }); paintAiNote(); } }));
  V.ai.append(box);
}
function paintWarn() {
  if (!V) return;
  V.warn.replaceChildren();
  const r = S().req;
  const pans = L.scanPans([r.url, r.body, ...r.params.map((p) => p.value)].join(' '));
  const alert = (tone, icon, text) => { const box = div('at-alert ' + tone); if (tone === 'bad') box.setAttribute('role', 'alert'); box.append(V.ui.icon(icon), el('div', '', text)); V.warn.append(box); };
  if (pans.length) alert('bad', 'shield-alert', F('panWarn', { pan: pans.map(L.maskPan).join(', ') }));
  const b = L.buildRequest(r, allVars());
  if (L.BODY_METHODS.includes(r.method) && L.productionLike(b.url)) alert('warn', 'triangle-alert', T('prodWarn'));
  if (b.missing.length && r.url) alert('info', 'braces', F('missingVars', { vars: b.missing.map((m) => '{{' + m + '}}').join(', ') }));
}

/* ---------------------------------------------------------------- request tabs: Auth · Params · Body · Expect · More */
function paintTabs() {
  const { ui } = V;
  const st = S(), r = st.req;
  V.reqBox.replaceChildren();
  V.paintCheckEditor = null;
  if (!st.touched) {
    const more = ui.button({ label: T('showOptions'), icon: 'sliders-horizontal', variant: 'ghost', onClick: () => { set({ touched: true }); paintTabs(); } });
    more.classList.add('at-reveal');
    V.reqBox.append(more);
    return;
  }
  const hasBody = L.BODY_METHODS.includes(r.method);
  let active = st.tab;
  if (active === 'body' && !hasBody) active = 'params';
  const moreCount = r.headers.filter((h) => h.key && h.on !== false).length + (r.captures || []).filter((c) => c.var).length
    + (st.settings.timeout !== 30 || !st.settings.follow || !st.settings.verifyTls ? 1 : 0);
  const authLabel = { none: '', bearer: 'Bearer', apikey: T('authApiKey'), basic: 'Basic' }[r.auth.type];
  const tabs = [
    { id: 'auth', label: T('tabAuth'), count: authLabel },
    { id: 'params', label: T('tabParams'), count: r.params.filter((p) => p.key && p.on !== false).length || '' },
    ...(hasBody ? [{ id: 'body', label: T('tabBody'), count: String(r.body || '').trim() ? 'JSON' : '' }] : []),
    { id: 'expect', label: T('tabExpect'), count: r.checks.filter((c) => c.on !== false).length || '' },
    { id: 'more', label: T('tabMore'), count: moreCount || '' },
  ];
  const panels = { auth: authPanel(), params: paramsPanel(), expect: expectPanel(), more: morePanel() };
  if (hasBody) panels.body = bodyPanel();
  V.tabs = ui.tabs({ tabs, active, panels, onChange: (id) => set({ tab: id }) });
  V.reqBox.append(V.tabs);
}
const labelled = (label, input, help) => V.ui.field({ label, input, help });
function authPanel() {
  const { ui } = V;
  const a = S().req.auth;
  const box = div('stack');
  const upd = (patch) => setReq({ auth: { ...S().req.auth, ...patch } });
  box.append(labelled(T('authWho'), ui.segmented({ label: T('tabAuth'), value: a.type, options: [{ value: 'none', label: T('authNone') }, { value: 'bearer', label: 'Bearer' }, { value: 'apikey', label: T('authApiKey') }, { value: 'basic', label: 'Basic' }],
    onChange: (v) => { upd({ type: v }); paintTabs(); } })));
  const secret = (value, onInput, label) => {
    const wrap = div('at-secret');
    const i = ui.input({ value, mono: true, onInput, ariaLabel: label });
    i.type = /\{\{/.test(value) || L.DEMO_KEYS.includes(value) ? 'text' : 'password';
    i.autocomplete = 'off';
    wrap.append(i, ui.button({ icon: 'eye', variant: 'ghost', size: 'sm', ariaLabel: T('showSecret'), onClick: () => { i.type = i.type === 'password' ? 'text' : 'password'; } }));
    return wrap;
  };
  if (a.type === 'bearer') box.append(labelled(T('token'), secret(a.token, (v) => upd({ token: v }), T('token')), T('tokenHelp')));
  if (a.type === 'apikey') {
    const row = div('at-grid2');
    row.append(labelled(T('keyName'), ui.input({ value: a.key, mono: true, onInput: (v) => upd({ key: v }) })),
      labelled(T('keyValue'), secret(a.value, (v) => upd({ value: v }), T('keyValue')), T('keyHelp')));
    box.append(row, labelled(T('keyWhere'), ui.segmented({ label: T('keyWhere'), value: a.in, options: [{ value: 'header', label: T('inHeader') }, { value: 'query', label: T('inQuery') }], onChange: (v) => upd({ in: v }) })));
  }
  if (a.type === 'basic') {
    const row = div('at-grid2');
    row.append(labelled(T('user'), ui.input({ value: a.user, onInput: (v) => upd({ user: v }) })), labelled(T('password'), secret(a.pass, (v) => upd({ pass: v }), T('password'))));
    box.append(row);
  }
  if (a.type === 'none') box.append(el('p', 'muted', T('authNoneHelp')));
  box.append(el('p', 'muted at-small', T('secretsNote')));
  return box;
}
function paramsPanel() {
  const box = div('stack');
  box.append(el('p', 'muted at-small', T('paramsHelp')));
  box.append(V.ui.kvEditor({ rows: S().req.params, keyPlaceholder: T('name'), valuePlaceholder: T('value'), onChange: (rows) => { setReq({ params: rows }); paintWarn(); if (V.tabs) V.tabs.setCount('params', rows.filter((p) => p.key && p.on !== false).length || ''); } }));
  return box;
}
function bodyPanel() {
  const { ui } = V;
  const box = div('stack');
  const status = el('span', 'at-small muted');
  const jsonState = () => {
    const v = String(S().req.body || '').trim();
    if (!v) { status.textContent = T('bodyEmpty'); status.className = 'at-small muted'; return; }
    try { JSON.parse(v.replace(/\{\{[^}]+\}\}/g, '0')); status.textContent = T('jsonOk'); status.className = 'at-small ok'; }
    catch (e) { status.textContent = T('jsonBad') + ' ' + e.message; status.className = 'at-small bad'; }
  };
  const ed = ui.codeEditor({ value: S().req.body, lang: 'json', rows: 12, ariaLabel: T('tabBody'), onChange: (v) => { setReq({ body: v }); paintWarn(); jsonState(); } });
  const bar = div('row at-body-bar');
  bar.append(ui.button({ label: T('format'), icon: 'wand-sparkles', size: 'sm', onClick: () => {
    try { const v = JSON.stringify(JSON.parse(S().req.body), null, 2); setReq({ body: v }); ed.value = v; } catch (e) { /* shown below */ }
    jsonState();
  } }), cardPicker(ed), status);
  box.append(bar, ed);
  jsonState();
  return box;
}
function cardPicker(ed) {
  const brand = /lumiere/.test(JSON.stringify(S().env.vars)) ? 'lumiere' : 'harbor';
  const items = testCards().filter((c) => c.brand === brand).map((c) => ({ label: `${L.maskPan(c.pan)} · ${c.card_id}`, hint: c.expect, onClick: () => {
    let v = S().req.body;
    try { const o = JSON.parse(v || '{}'); o.pan = c.pan; o.expiry = c.expiry; v = JSON.stringify(o, null, 2); } catch (e) { v = String(v).replace(/"pan"\s*:\s*"[^"]*"/, `"pan": "${c.pan}"`); }
    setReq({ body: v }); ed.value = v; paintWarn();
  } }));
  return V.ui.menu({ label: T('testCards'), icon: 'credit-card', size: 'sm', items: [{ group: T('testCardsHelp') }, ...items] });
}

/* ---- Expect: rows of target · operator · expected */
const TARGETS = ['status', 'time', 'json', 'header', 'body', 'size'];
function expectPanel() {
  const { ui } = V;
  const box = div('stack');
  box.append(el('p', 'muted at-small', T('expectHelp')));
  const list = div('at-checks-edit');
  const paint = () => {
    list.replaceChildren();
    S().req.checks.forEach((c, i) => {
      const row = div('at-check-row');
      const upd = (patch) => { setReq({ checks: S().req.checks.map((x, j) => (j === i ? { ...x, ...patch } : x)) }); refreshChecks(); };
      const on = el('input'); on.type = 'checkbox'; on.checked = c.on !== false; on.setAttribute('aria-label', T('checkOn')); on.onchange = () => upd({ on: on.checked });
      const tgt = ui.select({ options: TARGETS.map((x) => ({ value: x, label: T('tgt_' + x) })), value: c.target, size: 'sm', ariaLabel: T('target'), onChange: (v) => { upd({ target: v, op: L.OPS[v][0], key: v === 'json' ? '$.' : v === 'header' ? 'Content-Type' : '' }); paint(); } });
      const key = ui.input({ value: c.key, mono: true, size: 'sm', placeholder: c.target === 'json' ? '$.response_code' : T('headerName'), ariaLabel: T('checkKey'), onInput: (v) => upd({ key: v }) });
      key.hidden = !['json', 'header'].includes(c.target);
      const op = ui.select({ options: L.OPS[c.target].map((x) => ({ value: x, label: T('op_' + x) })), value: c.op, size: 'sm', ariaLabel: T('operator'), onChange: (v) => { upd({ op: v }); paint(); } });
      const exp = ui.input({ value: c.expected, mono: true, size: 'sm', placeholder: T('expected'), ariaLabel: T('expected'), onInput: (v) => upd({ expected: v }) });
      exp.hidden = L.NO_VALUE_OPS.includes(c.op);
      const del = ui.button({ icon: 'trash-2', variant: 'ghost', size: 'sm', ariaLabel: T('remove'), onClick: () => { setReq({ checks: S().req.checks.filter((_, j) => j !== i) }); paint(); refreshChecks(); } });
      row.append(on, tgt, key, op, exp, del);
      list.append(row);
    });
  };
  paint();
  V.paintCheckEditor = paint;
  box.append(list, ui.button({ label: T('addCheck'), icon: 'plus', size: 'sm', onClick: () => { setReq({ checks: [...S().req.checks, L.newCheck('json', '$.', 'eq', '')] }); paint(); } }));
  return box;
}
function morePanel() {
  const { ui } = V;
  const st = S();
  const box = div('stack');
  box.append(el('h3', 'section-label', T('headers')),
    ui.kvEditor({ rows: st.req.headers, keyPlaceholder: 'Content-Type', valuePlaceholder: 'application/json', onChange: (rows) => setReq({ headers: rows }) }),
    el('p', 'muted at-small', T('headersHelp')));
  box.append(el('h3', 'section-label', F('variables', { env: st.env.name })),
    ui.kvEditor({ rows: st.env.vars, keyPlaceholder: 'base_url', valuePlaceholder: 'https://…', onChange: (rows) => { set({ env: { ...S().env, vars: rows } }); paintWarn(); } }),
    el('p', 'muted at-small', T('variablesHelp')));
  const cap = Object.entries(st.vars || {});
  if (cap.length) {
    const p = div('at-captured');
    p.append(el('span', 'at-small muted', T('captured')), ...cap.map(([k, v]) => el('code', 'mono', `{{${k}}} = ${String(v).slice(0, 40)}`)),
      ui.button({ label: T('clear'), size: 'sm', variant: 'ghost', onClick: () => { set({ vars: {} }); paintTabs(); } }));
    box.append(p);
  }
  box.append(el('h3', 'section-label', T('capturesTitle')),
    ui.kvEditor({ rows: (st.req.captures || []).map((c) => ({ key: c.var, value: c.path, on: true })), keyPlaceholder: 'token_ref', valuePlaceholder: '$.token_ref',
      onChange: (rows) => setReq({ captures: rows.filter((r) => r.key).map((r) => ({ var: r.key, path: r.value })) }) }),
    el('p', 'muted at-small', T('capturesHelp')));
  const s = st.settings;
  const settings = div('at-grid3');
  const timeout = ui.input({ value: String(s.timeout), type: 'number', size: 'sm', onInput: (v) => set({ settings: { ...S().settings, timeout: Math.max(1, Math.min(60, Number(v) || 30)) } }) });
  const chk = (label, value, key) => { const l = el('label', 'at-check'); const i = el('input'); i.type = 'checkbox'; i.checked = value; i.onchange = () => set({ settings: { ...S().settings, [key]: i.checked } }); l.append(i, document.createTextNode(' ' + label)); return l; };
  settings.append(labelled(T('timeout'), timeout, T('timeoutHelp')), chk(T('follow'), s.follow, 'follow'), chk(T('verifyTls'), s.verifyTls, 'verifyTls'));
  box.append(el('h3', 'section-label', T('settings')), settings);
  return box;
}

/* ---------------------------------------------------------------- side panel: Cases | History */
function paintSide() {
  const { ui } = V;
  const st = S();
  V.side.replaceChildren();
  const head = div('panel-head at-side-head');
  head.append(ui.segmented({ label: T('cases'), size: 'sm', value: st.side, options: [{ value: 'cases', label: `${T('cases')} ${st.cases.length || ''}`.trim() }, { value: 'history', label: `${T('history')} ${st.history.length || ''}`.trim() }], onChange: (v) => { set({ side: v }); paintSide(); } }));
  const acts = div('row');
  if (st.side === 'cases') {
    acts.append(importMenu());
    if (st.cases.length) acts.append(ui.button({ label: F('runAll', { n: st.cases.length }), icon: 'play', size: 'sm', onClick: () => runAll() }));
  } else if (st.history.length) acts.append(ui.button({ label: T('clear'), size: 'sm', variant: 'ghost', onClick: () => { set({ history: [] }); paintSide(); } }));
  head.append(acts);
  V.side.append(head);
  const body = div('at-side-body');
  V.side.append(body);
  if (st.side === 'history') {
    if (!st.history.length) { body.append(el('p', 'muted at-pad', T('historyEmpty'))); return; }
    const ul = el('ul', 'at-list');
    for (const h of st.history) {
      const li = el('li');
      const b = el('button', 'at-item');
      b.type = 'button';
      b.append(ui.methodChip({ method: h.method }), el('span', 'at-item-url mono', L.shortUrl(h.url)), statusBadge(h.status), el('span', 'at-small muted num', `${h.ms ?? ''} ms · ${String(h.at).slice(11, 16)}`));
      b.onclick = () => { if (h.req) { set({ req: L.normReq(h.req), editing: null }); afterLoad(); } };
      li.append(b);
      ul.append(li);
    }
    body.append(ul);
    return;
  }
  if (!st.cases.length) body.append(el('p', 'muted at-pad', T('casesEmpty')));
  else {
    const ul = el('ul', 'at-list');
    for (const c of st.cases) {
      const li = el('li', 'at-case');
      const res = st.results[c.id];
      const row = div('at-case-row');
      const open = st.editing && st.editing.caseId === c.id;
      const name = el('button', 'at-item at-case-name');
      name.type = 'button';
      name.setAttribute('aria-expanded', open ? 'true' : 'false');
      name.append(ui.icon(open ? 'chevron-down' : 'chevron-right'), el('span', 'at-case-title', c.name),
        el('span', 'at-small muted', `${c.steps.length} ${c.steps.length > 1 ? T('steps') : T('step')}${c.data && c.data.length ? ' · ' + c.data.length + ' ' + T('rows') : ''}`));
      name.onclick = () => loadStep(c.id, 0);
      row.append(name);
      if (res) row.append(ui.badge({ text: `${res.pass ? T('pass') : T('fail')} ${res.passed}/${res.total}`, tone: res.pass ? 'ok' : 'bad', icon: res.pass ? 'check' : 'x' }));
      row.append(ui.button({ icon: 'play', size: 'sm', variant: 'ghost', ariaLabel: F('runCase', { name: c.name }), title: T('runCaseShort'), onClick: () => runOne(c.id) }),
        ui.button({ icon: 'trash-2', size: 'sm', variant: 'ghost', ariaLabel: T('remove'), title: T('remove'), onClick: () => removeCase(c.id) }));
      li.append(row);
      if (open) {
        const steps = el('ol', 'at-steps');
        c.steps.forEach((s, i) => {
          const sl = el('li');
          const cur = st.editing.step === i;
          const b = el('button', 'at-item' + (cur ? ' is-current' : ''));
          b.type = 'button';
          if (cur) b.setAttribute('aria-current', 'step');
          b.append(el('span', 'at-step-n num', String(i + 1)), ui.methodChip({ method: s.req.method }), el('span', 'at-item-url', s.name || s.req.name || L.shortUrl(s.req.url)));
          b.onclick = () => loadStep(c.id, i);
          sl.append(b);
          steps.append(sl);
        });
        li.append(steps);
        if (c.data && c.data.length) li.append(el('p', 'at-small muted at-pad', F('dataRows', { n: c.data.length, vars: Object.keys(c.data[0]).map((k) => '{{' + k + '}}').join(' ') })));
      }
      ul.append(li);
    }
    body.append(ul);
  }
  const foot = div('row at-side-foot');
  if (editingCase()) foot.append(ui.button({ label: F('updateStep', { n: S().editing.step + 1 }), icon: 'save', size: 'sm', onClick: () => updateStep() }));
  foot.append(ui.button({ label: T('saveCase'), icon: 'bookmark-plus', size: 'sm', onClick: () => saveAsCase() }));
  V.side.append(foot);
}
function statusBadge(status) {
  if (status == null) return V.ui.badge({ text: T('noAnswer'), tone: 'bad', icon: 'x' });
  return V.ui.badge({ text: String(status), tone: status < 300 ? 'ok' : status < 400 ? 'info' : status < 500 ? 'warn' : 'bad' });
}
function loadStep(caseId, i) {
  const c = S().cases.find((x) => x.id === caseId);
  if (!c || !c.steps[i]) return;
  const row = (c.data && c.data[0]) || {};
  set({ req: L.normReq(L.clone(c.steps[i].req)), editing: { caseId, step: i }, resetFirst: i === 0 && !!c.reset, vars: i === 0 ? { ...row } : { ...row, ...S().vars }, touched: true });
  afterLoad();
}
function afterLoad() {
  V.url.value = S().req.url; V.method.value = S().req.method;
  paintTabs(); paintWarn(); paintSide();
}
function removeCase(id) {
  const c = S().cases.find((x) => x.id === id);
  const results = { ...S().results }; delete results[id];
  set({ cases: S().cases.filter((x) => x.id !== id), results, editing: S().editing && S().editing.caseId === id ? null : S().editing });
  paintSide();
  V.ui.toast(F('caseRemoved', { name: c ? c.name : '' }), { action: { label: T('undo'), onClick: () => { set({ cases: [...S().cases, c] }); paintSide(); } } });
}
function updateStep() {
  const ed = S().editing;
  set({ cases: S().cases.map((c) => (c.id !== ed.caseId ? c : { ...c, steps: c.steps.map((s, i) => (i === ed.step ? { ...s, req: sanitizeReq(S().req) } : s)) })) });
  V.ui.toast(T('stepUpdated'), { tone: 'ok' });
}
function saveAsCase() {
  const { ui } = V;
  const r = S().req;
  const last = V.ctx.lastRun && V.ctx.lastRun.kind === 'send' && V.ctx.lastRun.res.ok ? V.ctx.lastRun.res.status : null;
  const name = ui.input({ value: r.name || `${r.method} ${L.shortUrl(r.url)}${last ? ' → ' + last : ''}`, id: 'at-case-name' });
  const body = div('stack');
  body.append(ui.field({ label: T('caseName'), input: name, id: 'at-case-name' }), el('p', 'muted at-small', T('saveCaseHelp')));
  ui.modal({ title: T('saveCase'), body, size: 'sm', actions: [
    { label: T('cancel') },
    { label: T('save'), variant: 'primary', onClick: () => {
      const req = { ...sanitizeReq(r), name: name.value.trim() };
      const c = { id: L.uid('case'), name: name.value.trim() || T('untitled'), reset: L.isMock(L.buildRequest(r, allVars()).url), steps: [{ name: req.name, req }] };
      set({ cases: [...S().cases, c], side: 'cases', editing: { caseId: c.id, step: 0 } });
      paintSide();
      V.ui.toast(F('caseSaved', { name: c.name }), { tone: 'ok' });
    } }] });
  setTimeout(() => name.focus(), 50);
}

/* ---------------------------------------------------------------- import: cURL · Postman v2.1 · OpenAPI 3 */
function importMenu() {
  return V.ui.menu({ label: T('import'), icon: 'file-up', size: 'sm', align: 'right', items: [
    { label: T('importCurl'), icon: 'terminal', onClick: () => importDialog('curl') },
    { label: T('importPostman'), icon: 'package', onClick: () => importDialog('postman') },
    { label: T('importOpenApi'), icon: 'file-json', onClick: () => importDialog('openapi') },
    '-', { label: T('importDemoSpec'), icon: 'landmark', onClick: () => importDemoSpec() },
  ] });
}
function importDialog(kind) {
  const { ui } = V;
  const area = ui.textarea({ rows: 10, mono: true, placeholder: T('ph_' + kind), ariaLabel: T('import') });
  const file = el('input'); file.type = 'file'; file.accept = kind === 'curl' ? '.sh,.txt' : '.json,.yaml,.yml';
  file.setAttribute('aria-label', T('chooseFile'));
  file.onchange = async () => { const f = file.files[0]; if (f) area.value = await f.text(); };
  const err = el('p', 'at-small bad'); err.setAttribute('role', 'alert');
  const body = div('stack');
  body.append(el('p', 'muted', T('help_' + kind)), area, file, err);
  ui.modal({ title: T('import_' + kind), body, size: 'md', actions: [
    { label: T('cancel') },
    { label: T('import'), variant: 'primary', onClick: () => {
      try { doImport(kind, area.value); return true; } catch (e) { const k = 'e_' + e.message; err.textContent = T('importFail') + ' ' + (T(k) !== 'api-tester.' + k ? T(k) : e.message); return false; }
    } }] });
}
function doImport(kind, text) {
  const src = String(text || '').trim();
  if (!src) throw new Error('empty');
  if (kind === 'curl' || L.looksLikeCurl(src)) { importCurl(src); return; }
  let doc;
  try { doc = JSON.parse(src); } catch (e) { doc = parseYaml(src); }
  if (doc && doc.info && Array.isArray(doc.item)) {
    const r = L.importPostman(doc);
    const vars = [...S().env.vars];
    for (const v of r.vars) if (!vars.some((x) => x.key === v.key)) vars.push(v);
    set({ cases: [...S().cases, ...r.cases], env: { ...S().env, vars }, side: 'cases' });
    paintSide(); paintTabs();
    V.ui.toast(F('imported', { n: r.cases.length, what: r.name }), { tone: 'ok' });
    return;
  }
  openApiPicker(L.importOpenApi(doc));
}
async function importDemoSpec() {
  try {
    const r = await fetch('js/tools/api-tester/harbor-bank-openapi.yaml');
    if (!r.ok) throw new Error('fetch');
    const fr = /lumiere/.test(JSON.stringify(S().env.vars));
    openApiPicker(L.importOpenApi(parseYaml(await r.text()), { server: fr ? 'https://issuer.example/lumiere/v1' : 'https://issuer.example/harbor/v1' }));
  } catch (e) { V.ui.toast(T('importFail'), { tone: 'bad' }); }
}
function openApiPicker(spec) {
  const { ui } = V;
  const body = div('stack');
  let dlg = null;
  body.append(el('p', 'muted', F('openapiFound', { n: spec.endpoints.length, title: spec.title, server: spec.server || '—' })));
  body.append(ui.table({ columns: [{ key: 'method', label: T('method'), format: (v) => ui.methodChip({ method: v }) }, { key: 'path', label: T('path'), mono: true }, { key: 'summary', label: T('summary') }],
    rows: spec.endpoints, onRowClick: (row) => { useEndpoint(spec, row); if (dlg && dlg.close) dlg.close(); } }));
  body.append(el('p', 'muted at-small', T('pickEndpointHelp')));
  dlg = ui.modal({ title: T('pickEndpoint'), body, size: 'lg', actions: [
    { label: T('cancel') },
    { label: F('addAllCases', { n: spec.endpoints.length }), variant: 'primary', onClick: () => {
      setBase(spec);
      const cases = spec.endpoints.map((e) => ({ id: L.uid('case'), name: `${e.method} ${e.path}${e.summary ? ' · ' + e.summary : ''}`, reset: L.isMock(spec.server || ''), steps: [{ name: e.summary, req: e.req }] }));
      set({ cases: [...S().cases, ...cases], side: 'cases' });
      paintSide();
      V.ui.toast(F('imported', { n: cases.length, what: spec.title }), { tone: 'ok' });
    } }] });
}
function setBase(spec) {
  if (!spec.server) return;
  const vars = S().env.vars.filter((v) => v.key !== 'base_url');
  vars.unshift({ key: 'base_url', value: spec.server, on: true });
  if (spec.auth && spec.auth.type === 'apikey' && !vars.some((v) => v.key === 'api_key')) vars.push({ key: 'api_key', value: /harbor/.test(spec.server) ? 'hb_test_demo_key' : /lumiere/.test(spec.server) ? 'bl_test_demo_key' : '', on: true });
  set({ env: { ...S().env, vars } });
}
function useEndpoint(spec, e) {
  setBase(spec);
  set({ req: L.normReq(L.clone(e.req)), editing: null, touched: true, tab: e.req.body ? 'body' : 'params' });
  afterLoad();
}

/* ---------------------------------------------------------------- run */
function confirmDialog(title, text, okLabel) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (v) => { if (!done) { done = true; resolve(v); } };
    V.ui.modal({ title, body: text, size: 'sm', onClose: () => finish(false), actions: [
      { label: T('cancel'), onClick: () => finish(false) },
      { label: okLabel, variant: 'danger', onClick: () => finish(true) }] });
  });
}
const transportOpts = (extra = {}) => ({ timeout: S().settings.timeout, follow: S().settings.follow, verifyTls: S().settings.verifyTls, server: V.ctx.server, ...extra });
const runChecks = (res, checks, vars) => L.runChecks(res, checks, vars).map((c) => ({ ...c, text: L.explain(c, T) }));
const fail = (msg, hint) => Object.assign(new Error(msg), { hint });

async function run(st, ctx) {
  const m = mode; mode = { kind: 'send' };
  if (m.kind === 'case' || m.kind === 'suite') return runCases(m.kind === 'case' ? st.cases.filter((c) => m.ids.includes(c.id)) : st.cases);
  const vars = allVars(st);
  const built = L.buildRequest(st.req, vars);
  if (built.missing.length) throw fail(F('missingVars', { vars: built.missing.map((x) => '{{' + x + '}}').join(', ') }), T('missingHint'));
  try { new URL(built.url); } catch (e) { throw fail(T('errUrlBad'), T('errUrlBadHint')); }
  const pans = L.scanPans(built.url + ' ' + built.body);
  if (pans.length && !(await confirmDialog(T('panTitle'), F('panConfirm', { pan: pans.map(L.maskPan).join(', ') }), T('sendAnyway')))) throw fail(T('cancelled'), T('panHint'));
  let confirmProduction = false;
  if (L.BODY_METHODS.includes(built.method) && L.productionLike(built.url)) {
    if (!(await confirmDialog(T('prodTitle'), F('prodConfirm', { method: built.method, host: new URL(built.url).host }), T('sendAnyway')))) throw fail(T('cancelled'), T('prodHint'));
    confirmProduction = true;
  }
  if (st.resetFirst && L.isMock(built.url)) { await resetMockFor(built.url, transportOpts()); ctx.setState({ resetFirst: false }, { silent: true }); }
  let res = await sendRequest(built, transportOpts({ confirmProduction }));
  if (!res.ok && res.code === 'http.production_confirm' && !confirmProduction && await confirmDialog(T('prodTitle'), res.error, T('sendAnyway'))) {
    res = await sendRequest(built, transportOpts({ confirmProduction: true }));
  }
  let checksDef = st.req.checks;
  if (res.ok && !checksDef.length) checksDef = L.suggestChecks(res);  // first answer → first checks (D4)
  const checks = runChecks(res, checksDef, vars);
  const captured = { ...st.vars };
  const js = L.parseJsonBody(res);
  for (const c of st.req.captures || []) if (c.var && c.path && js.ok) { const g = L.getPath(js.value, c.path); if (g.found) captured[c.var] = typeof g.value === 'string' ? g.value : JSON.stringify(g.value); }
  const at = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const history = [{ at, method: built.method, url: L.maskUrl(built.url), status: res.ok ? res.status : null, ms: res.time_ms, via: res.via, req: sanitizeReq(st.req) }, ...st.history].slice(0, 100);
  ctx.setState({ req: { ...st.req, checks: checksDef }, vars: captured, history, touched: true });
  setTimeout(() => { if (V && V.ctx === ctx) { paintTabs(); paintSide(); } }, 0);
  return { kind: 'send', at, built: { ...built, headers: L.maskHeaders(built.headers), url: L.maskUrl(built.url) }, res, checks, via: res.via, route: routeFor(built.url) };
}
async function runCases(cases) {
  if (!cases.length) throw fail(T('casesEmpty'), '');
  const suite = await runSuite(cases, { vars: allVars(), T, send: (b) => sendRequest(b, transportOpts()), reset: (u) => resetMockFor(u, transportOpts()),
    onCase: (i, n) => V.frame.busy(true, F('nOfN', { i: i + 1, n })) });
  suite.via = [...new Set(suite.results.flatMap((r) => r.runs.flatMap((x) => x.steps.map((s) => s.via))).filter(Boolean))].map((v) => T(VIA[v] || 'viaProxy')).join(', ');
  const results = { ...S().results };
  for (const r of suite.results) {
    const checks = r.runs.flatMap((x) => x.steps.flatMap((s) => s.checks));
    results[r.caseId] = { pass: r.pass, passed: checks.filter((c) => c.pass).length, total: checks.length, at: suite.at };
  }
  set({ results, lastSuite: cases.length === S().cases.length ? suite : S().lastSuite });
  setTimeout(() => V && paintSide(), 0);
  return suite;
}
function runOne(id) { mode = { kind: 'case', ids: [id] }; V.frame.runNow(); }
function runAll() { mode = { kind: 'suite' }; V.frame.runNow(); }

/* ---------------------------------------------------------------- results */
const VIA = { mock: 'viaMock', proxy: 'viaProxy', browser: 'viaBrowser' };
function renderResult(r, ctx) {
  if (!r) return;
  if (r.kind === 'send') renderSend(r, ctx);
  else renderSuite(r, ctx);
}
function renderSend(r, ctx) {
  const { ui, frame } = ctx;
  const out = frame.output;
  out.replaceChildren();
  const res = r.res;
  const meta = div('at-meta');
  meta.append(ui.methodChip({ method: r.built.method }), el('span', 'mono at-meta-url', r.built.url),
    ui.badge({ text: T(VIA[res.via] || 'viaProxy'), tone: res.via === 'mock' ? 'accent' : 'neutral', icon: res.via === 'mock' ? 'flask-conical' : res.via === 'browser' ? 'globe' : 'server' }));
  out.append(meta);
  frame.setStatusExtra(ui.button({ label: T('copyCurl'), icon: 'terminal', size: 'sm', variant: 'ghost', onClick: copyCurl }));
  if (!res.ok) {
    const box = div('tf-run-error at-error');
    box.setAttribute('role', 'alert');
    box.append(ui.icon('circle-alert'));
    const t = div();
    t.append(el('b', '', errorTitle(res)), el('p', '', errorHelp(res)));
    if (res.error && res.code !== 'http.cors' && res.code !== 'net.offline') t.append(el('p', 'mono at-small muted', res.error));
    box.append(t);
    out.append(box);
    return;
  }
  const hint = statusHint(res.status);
  if (hint) out.append(el('p', 'at-small muted at-hint', hint));
  if (res.truncated) out.append(el('p', 'at-small warn', T('truncated')));
  V.checksBox = div('at-checks');
  out.append(V.checksBox);
  paintCheckResults(r.checks);
  let view = 'pretty';
  const bodyBox = div('at-body');
  const js = L.parseJsonBody(res);
  const paintBody = () => {
    bodyBox.replaceChildren();
    if (view === 'headers') {
      bodyBox.append(ui.table({ columns: [{ key: 'k', label: T('header'), mono: true }, { key: 'v', label: T('value'), mono: true }], rows: res.headers.map(([k, v]) => ({ k, v })) }));
      if (res.via === 'browser') bodyBox.append(el('p', 'at-small muted', T('browserHeaders')));
    } else if (view === 'raw' || !js.ok) {
      const pre = el('pre', 'at-raw mono'); pre.textContent = res.body_encoding === 'base64' ? T('binaryBody') : res.body || T('emptyBody'); bodyBox.append(pre);
    } else {
      bodyBox.append(ui.jsonView({ value: js.value, depth: 3, toolbar: false, onPick: (path, value) => addCheck(L.checkFromPick(path, value)) }));
      bodyBox.append(el('p', 'at-small muted', T('pickHint')));
    }
  };
  const seg = ui.segmented({ label: T('view'), size: 'sm', value: view, options: [{ value: 'pretty', label: T('pretty') }, { value: 'raw', label: T('raw') }, { value: 'headers', label: `${T('headers')} ${res.headers.length}` }], onChange: (v) => { view = v; paintBody(); } });
  const lim = Math.max(500, Math.ceil(res.time_ms * 2 / 100) * 100);
  const quick = div('row at-quick');
  quick.append(ui.button({ label: F('addStatus', { s: res.status }), icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => addCheck(L.newCheck('status', '', 'eq', res.status)) }),
    ui.button({ label: F('addTime', { ms: lim }), icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => addCheck(L.newCheck('time', '', 'lt', lim)) }));
  const bodyHead = div('at-body-head');
  bodyHead.append(el('h3', 'section-label', T('response')), seg, quick);
  out.append(bodyHead, bodyBox);
  paintBody();
  frame.setStatusExtra(ui.copyButton({ text: () => res.body || '', label: T('copyBody'), size: 'sm', variant: 'ghost' }),
    ui.button({ label: T('copyCurl'), icon: 'terminal', size: 'sm', variant: 'ghost', onClick: copyCurl }));
  const ed = editingCase();
  if (ed && S().editing.step + 1 < ed.steps.length) {
    const n = S().editing.step + 1;
    const nx = div('at-next');
    nx.append(ui.button({ label: F('nextStep', { n: n + 1, name: ed.steps[n].name || L.shortUrl(ed.steps[n].req.url) }), icon: 'arrow-right', variant: 'primary', size: 'sm', onClick: () => { loadStep(ed.id, n); V.frame.runNow(); } }),
      ui.button({ label: T('runCaseShort'), icon: 'play', size: 'sm', onClick: () => runOne(ed.id) }));
    out.prepend(nx);
  }
}
function paintCheckResults(results) {
  const { ui } = V;
  if (!V.checksBox) return;
  V.checksBox.replaceChildren();
  const s = L.caseSummary(results);
  const head = div('at-checks-head');
  head.append(el('h3', 'section-label', T('checks')), results.length ? ui.badge({ text: `${s.passed}/${s.total} ${s.pass ? T('passed') : T('failedShort')}`, tone: s.pass ? 'ok' : 'bad', icon: s.pass ? 'check' : 'x' }) : el('span', 'muted at-small', T('noChecks')));
  head.append(ui.button({ label: T('editChecks'), icon: 'list-checks', size: 'sm', variant: 'ghost', onClick: () => { set({ tab: 'expect', touched: true }); paintTabs(); } }));
  V.checksBox.append(head);
  const ul = el('ul', 'at-check-results');
  for (const c of results) {
    const li = el('li', c.pass ? 'ok' : 'bad');
    li.append(ui.icon(c.pass ? 'circle-check' : 'circle-x', { label: c.pass ? T('pass') : T('fail') }), el('span', '', c.text));
    ul.append(li);
  }
  V.checksBox.append(ul);
}
function addCheck(check) {
  setReq({ checks: [...S().req.checks, check] });
  refreshChecks();
  if (V.paintCheckEditor) V.paintCheckEditor();
  if (V.tabs) V.tabs.setCount('expect', S().req.checks.filter((c) => c.on !== false).length);
  V.ui.toast(F('checkAdded', { text: L.explain({ ...check, pass: true }, T) }), { tone: 'ok' });
}
/** Re-evaluate the checks on the last answer without sending again. */
function refreshChecks() {
  const r = V.ctx.lastRun;
  if (!r || r.kind !== 'send' || !r.res.ok) return;
  r.checks = runChecks(r.res, S().req.checks, allVars());
  paintCheckResults(r.checks);
  V.frame.setStatus(tool.status(r));
}
function errorTitle(res) {
  return T({ 'http.cors': 'corsTitle', 'http.timeout': 'timeoutTitle', 'http.dns': 'dnsTitle', 'http.refused': 'refusedTitle', 'http.tls': 'tlsTitle', 'http.production_confirm': 'prodTitle', 'net.offline': 'offlineTitle' }[res.code] || 'noAnswer');
}
function errorHelp(res) {
  if (res.code === 'http.cors') return T('corsHelp');
  if (res.code === 'http.timeout') return T('timeoutHelp2');
  if (res.code === 'net.offline') return T('offlineHelp');
  return res.error || T('noAnswerHelp');
}
function statusHint(s) {
  const k = { 400: 'h400', 401: 'h401', 403: 'h403', 404: 'h404', 405: 'h405', 409: 'h409', 415: 'h415', 422: 'h422', 429: 'h429' }[s] || (s >= 500 ? 'h5xx' : '');
  return k ? T(k) : '';
}
function renderSuite(suite, ctx) {
  const { ui, frame } = ctx;
  const out = frame.output;
  out.replaceChildren();
  const s = suite.summary;
  const head = div('at-suite-head');
  head.append(ui.badge({ text: `${s.passed}/${s.total} ${T('casesPassed')}`, tone: s.failed ? 'bad' : 'ok', icon: s.failed ? 'x' : 'check' }),
    el('span', 'muted at-small', `${suite.at.slice(0, 16).replace('T', ' ')} UTC · ${S().env.name}${suite.via ? ' · ' + suite.via : ''}`));
  out.append(head);
  const rows = suite.results.flatMap((c) => c.runs.map((r) => {
    const checks = r.steps.flatMap((x) => x.checks);
    return { label: r.label, pass: r.pass, checks: `${checks.filter((k) => k.pass).length}/${checks.length}`, ms: r.steps.reduce((n, x) => n + (x.ms || 0), 0), run: r };
  }));
  out.append(ui.table({ columns: [
    { key: 'pass', label: T('colResult'), format: (v) => ui.badge({ text: v ? T('pass') : T('fail'), tone: v ? 'ok' : 'bad', icon: v ? 'check' : 'x' }) },
    { key: 'label', label: T('colCase') }, { key: 'checks', label: T('colChecks'), num: true }, { key: 'ms', label: T('colTime'), num: true, format: (v) => `${v} ms` }], rows }));
  const fails = rows.filter((r) => !r.pass);
  if (fails.length) {
    out.append(el('h3', 'section-label', T('whyFailed')));
    for (const f of fails) {
      const box = div('panel at-fail');
      box.append(el('b', '', f.label));
      const ul = el('ul');
      for (const st of f.run.steps) {
        if (st.error) ul.append(el('li', 'bad', `${st.method} ${L.shortUrl(st.url)} · ${st.error}`));
        for (const k of st.checks.filter((x) => !x.pass)) ul.append(el('li', 'bad', `${st.name} · ${k.text}`));
      }
      box.append(ul);
      out.append(box);
    }
  }
  const acts = div('row at-suite-acts');
  acts.append(ui.button({ label: T('reportMd'), icon: 'file-text', size: 'sm', onClick: () => ctx.download('api-test-report.md', 'text/markdown', toReportMd(suite, T, { env: S().env.name })) }),
    ui.button({ label: T('reportCsv'), icon: 'sheet', size: 'sm', onClick: () => ctx.download('api-test-report.csv', 'text/csv', toReportCsv(suite, { env: S().env.name })) }));
  out.append(acts);
  frame.setStatusExtra();
}
async function copyCurl() {
  const text = curlNote() + toCurl(S().req, allVars());
  try { await navigator.clipboard.writeText(text); V.ui.toast(T('curlCopied'), { tone: 'ok' }); }
  catch (e) { const pre = el('pre', 'at-raw mono'); pre.textContent = text; V.ui.modal({ title: 'cURL', body: pre, actions: [{ label: T('close') }] }); }
}

/* ---------------------------------------------------------------- deliverable + AI prompts */
function toMarkdown(st, lastRun) {
  const r = lastRun;
  const out = [`# ${T('mdTitle')}${st.req.name ? ' · ' + st.req.name : ''}`, '', `**${T('reportEnv')}:** ${st.env.name}  `, `**${T('mdDate')}:** ${new Date().toISOString().slice(0, 10)}`, ''];
  out.push(`## ${T('mdRequest')}`, '', '```bash', toCurl(st.req, allVars(st)), '```', '');
  if (r && r.kind === 'send') {
    out.push(`## ${T('mdAnswer')}`, '', r.res.ok ? `\`${r.res.status} ${r.res.reason}\` · ${r.res.time_ms} ms · ${L.fmtBytes(r.res.size)} · ${T(VIA[r.res.via] || 'viaProxy')}` : `**${errorTitle(r.res)}** ${errorHelp(r.res)}`, '');
    if (r.checks.length) {
      out.push(`| ${T('colResult')} | ${T('checks')} |`, '|---|---|');
      for (const c of r.checks) out.push(`| ${c.pass ? 'PASS' : '**FAIL**'} | ${String(c.text).replace(/\|/g, '\\|')} |`);
      out.push('');
    }
    if (r.res.ok && r.res.body) out.push('```json', r.res.body.length > 4000 ? r.res.body.slice(0, 4000) + '\n…' : r.res.body, '```', '');
  }
  const suite = suiteFor(st, r);
  if (suite) out.push(toReportMd(suite, T, { env: st.env.name, title: T('reportTitle') }).replace(/^# /, '## ').replace(/\n### /g, '\n#### ').replace(/\n## (?!#)/g, '\n### '), '');
  else if (st.cases.length) { out.push(`## ${T('cases')}`, ''); for (const c of st.cases) out.push(`- ${c.name} (${c.steps.length} ${c.steps.length > 1 ? T('steps') : T('step')})`); out.push(''); }
  out.push('---', T('mdFooter'));
  return out.join('\n');
}
function promptGenerate(st, r) {
  const b = L.buildRequest(st.req, L.varsOf(st.env, st.vars));
  const sample = r && r.kind === 'send' && r.res.ok ? `\nObserved answer: ${r.res.status} ${r.res.reason}\n${String(r.res.body || '').slice(0, 3000)}\n` : '';
  return [
    'Use the testing-apis skill. Design the test matrix for this endpoint (happy path, validation, boundaries, business rules, auth/BOLA, idempotency, errors) and return it as JSON for the Analyst Kit API tester.',
    `Language for case names: ${getLang() === 'fr' ? 'French' : 'English'}. Test data: demo test cards only (never a real PAN). Keep {{base_url}} and {{api_key}} as variables.`,
    '', `Endpoint: ${b.method} ${st.req.url}`, `Auth: ${st.req.auth.type}${st.req.auth.type === 'apikey' ? ' header ' + st.req.auth.key : ''}`,
    st.req.body ? `Body:\n${st.req.body}` : '', sample,
    'Answer with JSON only, matching app/server/tools/schemas/api-tester.json, then run: python3 app/server/kit.py patch <workspace_id> <file.json> --action generate-cases',
    '{"cases": [{"name": "...", "reset": true, "steps": [{"name": "...", "req": {"method": "POST", "url": "{{base_url}}/...", "auth": {"type": "apikey", "key": "X-API-Key", "value": "{{api_key}}"}, "body": "{...}", "checks": [{"target": "status|time|json|header|body", "key": "$.path or header name", "op": "eq|ne|contains|exists|not_exists|matches|lt|gt|len|type|starts|ends|in|between", "expected": "..."}], "captures": [{"var": "id", "path": "$.id"}]}}]}]}',
  ].filter((x) => x !== '').join('\n');
}
function promptExplain(st, r) {
  const fails = r && r.kind === 'send' ? r.checks.filter((c) => !c.pass).map((c) => '- ' + c.text) : [];
  const suiteFails = r && r.kind === 'suite' ? r.results.filter((c) => !c.pass).flatMap((c) => c.runs.flatMap((x) => x.steps.flatMap((s) => s.checks.filter((k) => !k.pass).map((k) => `- ${x.label} / ${s.name}: ${k.text}`)))) : [];
  return [
    'Use the testing-apis skill. Explain this API test failure to a business analyst in plain words: what happened, the most likely cause (test data, environment, auth, or a real defect), and what to do next. Say if it should be logged as a defect, with a one-line title.',
    `Request: ${st.req.method} ${L.shortUrl(st.req.url)}`,
    r && r.kind === 'send' ? (r.res.ok ? `Answer: ${r.res.status} ${r.res.reason}\n${String(r.res.body || '').slice(0, 3000)}` : `No answer: ${r.res.error || r.res.code}`) : '',
    'Failed checks:', ...(fails.length || suiteFails.length ? [...fails, ...suiteFails] : ['- (none recorded)']),
    `Reply in ${getLang() === 'fr' ? 'French' : 'English'}, under 200 words.`,
  ].filter(Boolean).join('\n');
}
