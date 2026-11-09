/* Xray builder (managing-xray-tests), owner G.
   Test list + editor (Manual steps table, Cucumber Gherkin, Generic definition), live validator per target (Xray Cloud /
   Server-DC, unverified fields marked "to confirm"), column checker for a pasted CSV, file previews.
   Sources: pasted list, the UAT tracker's saved campaign, the API tester's saved cases (same workspace store).
   Files = port of build_xray.py (node parity.mjs proves tests.csv, .feature and results.json are byte-identical). */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { SAMPLES as UAT_SAMPLES } from '../uat-tracker/samples.js';
import { toSpec, validate, testsCsv, featureFiles, executionJson, testsBulkJson, importGuide, checkColumns, testsFromList, testsFromUat, testsFromApi, TYPES, JIRA_PRIORITIES, labelsOf } from './logic.js';
import { fmtVars, mdCell } from '../uat-tracker/csv.js';

const T = register('xray-builder', strings);
const fmt = (k, v) => fmtVars(T(k), v);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const TYPE_ICON = { manual: 'list-checks', cucumber: 'code', generic: 'bot' };
const RES = ['', 'passed', 'failed', 'todo', 'executing'];
const RES_TONE = { passed: 'ok', failed: 'bad', todo: 'neutral', executing: 'info' };
const targetName = (t) => T(t === 'server' ? 'server' : 'cloud');

const specOf = (s) => ({ ...toSpec(s), serverStepColumn: s.stepColumn || 'Action' });
const issueText = (i, spec) => {
  const vars = { ...i.vars, project: spec.project };
  if (i.code === 'labelSpace') vars.fix = getLang() === 'fr' ? `« ${String(i.vars.label).replace(/\s+/g, '-')} »` : `"${String(i.vars.label).replace(/\s+/g, '-')}"`;
  return fmt('v_' + i.code, vars);
};

/* ---------------------------------------------------------------- Markdown (skill §7 output contract) */
function toMarkdown(state) {
  const spec = specOf(state);
  const target = state.target || 'cloud';
  const issues = validate(spec, target);
  const L = [`## ${state.title || 'Xray'} · ${spec.project} · ${targetName(target)}`, ''];
  const reqs = [...new Set(spec.tests.flatMap((t) => t.requirements))];
  L.push(`### 1 · ${T('md1')}`, '', `- ${fmt('mdTarget', { target: targetName(target), project: spec.project, n: spec.tests.length })} (${Object.keys(TYPES).map((k) => `${spec.tests.filter((t) => t.type === k).length} ${TYPES[k]}`).join(', ')})`, `- ${T('mdStories')}: ${reqs.join(', ') || '—'}`, '');
  L.push(`### 2 · ${T('md2')}`, '', `| ${T('mdStory')} | ${T('tests')} |`, '|---|---|');
  for (const r of reqs) L.push(`| ${r}${spec.features[r] ? ' ' + mdCell(spec.features[r]) : ''} | ${spec.tests.filter((t) => t.requirements.includes(r)).map((t) => t.id).join(', ')} |`);
  const orphan = spec.tests.filter((t) => !t.requirements.length);
  if (orphan.length) L.push(`| *(${T('mdNoStory')})* | ${orphan.map((t) => t.id).join(', ')} |`);
  L.push('', `### 3 · ${T('md3')}`, '', `| ${T('colId')} | ${T('colTypeH')} | ${T('colSummary')} | ${T('f_labels')} | ${T('f_priority')} | ${T('colResult')} |`, '|---|---|---|---|---|---|');
  for (const t of state.tests || []) L.push(`| ${t.id} | ${TYPES[t.type]} | ${mdCell(t.summary)} | ${labelsOf(t.labels).join(', ')} | ${t.priority || ''} | ${t.status ? T('s_' + t.status) : '—'} |`);
  L.push('', `### 4 · ${T('md4')}`, '');
  for (const t of spec.tests) {
    L.push(`#### ${t.id} · ${t.summary}`, '');
    if (t.precondition) L.push(`*${T('f_pre')}:* ${t.precondition}`, '');
    if (t.type === 'manual') { L.push(`| # | ${T('stepAction')} | ${T('stepData')} | ${T('stepResult')} |`, '|---|---|---|---|'); t.steps.forEach((s, i) => L.push(`| ${i + 1} | ${mdCell(s.action)} | ${mdCell(s.data)} | ${mdCell(s.result)} |`)); }
    else if (t.type === 'cucumber') L.push('```gherkin', t.scenario, '```');
    else L.push(`Generic · definition \`${t.definition}\``);
    L.push('');
  }
  L.push(`### 5 · ${T('md5')}`, '');
  const csv = testsCsv(spec, target);
  if (csv) L.push('`tests.csv`', '', '```csv', csv.replace(/\r\n/g, '\n').trimEnd(), '```', '');
  for (const f of featureFiles(spec)) L.push(`\`${f.name}\``, '', '```gherkin', f.text.trimEnd(), '```', '');
  const ex = executionJson(spec, target);
  if (ex) L.push(`\`results-${target}.json\``, '', '```json', JSON.stringify(ex, null, 2), '```', '');
  L.push(`### 6 · ${T('md6')}`, '', importGuide(spec, target).replace(/^# .*\n/, '').replace(/^## /gm, '#### '), '');
  L.push(`### 7 · ${T('md7')}`, '');
  const conf = issues.filter((i) => i.confirm || i.level !== 'info');
  if (!conf.length) L.push('- —');
  for (const i of conf) L.push(`- ${i.test ? `**${i.test}** ` : ''}${issueText(i, spec)}${i.confirm ? ` *${T('toConfirm')}*` : ''}`);
  L.push('');
  return L.join('\n');
}

/* ---------------------------------------------------------------- AI prompts */
function promptDraft(state) {
  const spec = specOf(state);
  const fr = getLang() === 'fr';
  return [
    'You are a QA lead writing Xray tests for a Product Owner (skill: managing-xray-tests).',
    `Project ${spec.project}, target ${targetName(state.target)}. Stories: ${Object.entries(spec.features).map(([k, v]) => `${k} ${v}`).join('; ') || '(see the existing tests)'}.`,
    'Write the missing tests so that every acceptance criterion and every unhappy path is covered: one behaviour per test, every manual step with a yes / no expected result, explicit test data (test cards such as 4111 1111 1111 1111 only, never real data), labels without spaces.',
    'Choose the type: journeys → Manual, behaviour rules → Cucumber (Scenario Outline for many phrasings), automated suites → Generic.',
    'Existing tests (do not repeat):', ...spec.tests.map((t) => `- ${t.id} [${TYPES[t.type]}] ${t.summary}`),
    'Scheme rules you cannot verify (response codes, Exception File timings) stay marked *to confirm*.',
    'Answer as a plain list I can paste into "Add tests from › A pasted list": one block per test, blank line between tests, first line "ID: summary", then "req: KEY", "labels: a b", then steps "action | data | expected" or Gherkin lines.',
    fr ? 'Answer in French (Gherkin with Soit / Quand / Alors / Et).' : 'Answer in English.',
  ].join('\n');
}
function promptReview(state) {
  const spec = specOf(state);
  return ['Review these Xray tests against the managing-xray-tests quality check: one behaviour per test, checkable expected results, explicit test data, every branch covered, labels without spaces, statuses and field names right for the target. List each problem with the test ID and the fix, then the coverage gaps per story.',
    `Target: ${targetName(state.target)}.`, '', toMarkdown(state).split('### 5 ·')[0], getLang() === 'fr' ? 'Answer in French.' : 'Answer in English.'].join('\n');
}

/* ---------------------------------------------------------------- view */
function mount(el, ctx) {
  const { ui } = ctx;
  const S = () => ctx.state;
  if (!Array.isArray(S().tests)) ctx.setState({ tests: [] }, { silent: true });
  let sel = Math.min(ctx.__xraySel ?? 0, Math.max(0, (S().tests || []).length - 1));
  const setTests = (tests, { repaintEditor = false } = {}) => { ctx.setState({ tests }, { silent: true }); refresh(); if (repaintEditor) paintEditor(); };
  const patchTest = (patch, opts) => { const tests = S().tests.map((t, i) => (i === sel ? { ...t, ...patch } : t)); setTests(tests, opts); };

  // ---- command bar
  const proj = ui.input({ value: S().project || '', mono: true, onInput: (v) => { ctx.setState({ project: v.toUpperCase().trim() }, { silent: true }); refresh(); } });
  proj.addEventListener('blur', () => { proj.value = S().project || ''; });
  const projF = ctx.frame.bindField('project', ui.field({ label: T('project'), help: T('projectHint'), required: true, input: proj }));
  const tgt = ui.segmented({ label: T('target'), value: S().target || 'cloud', options: [{ value: 'cloud', label: T('cloud') }, { value: 'server', label: T('server') }],
    onChange: (v) => { ctx.setState({ target: v }, { silent: true }); ctx.frame.setPrimary({ label: `${T('run')} · ${targetName(v)}` }); refresh(); paintColumns(); } });
  const tgtF = ui.field({ label: T('target'), input: tgt });
  const addMenu = ui.menu({ label: T('addFrom'), icon: 'import', items: [
    { label: T('fromList'), icon: 'import', onClick: () => pasteDialog() },
    { label: T('fromUat'), hint: T('fromUatHint'), icon: 'clipboard-check', onClick: () => fromTool('uat-tracker') },
    { label: T('fromApi'), hint: T('fromApiHint'), icon: 'send', onClick: () => fromTool('api-tester') },
  ] });
  const addWrap = h('div', 'field xr-addfrom'); addWrap.append(h('span', 'xr-fake-label', T('addFrom')), addMenu);
  addWrap.firstChild.setAttribute('aria-hidden', 'true');
  ctx.frame.command.append(projF, tgtF, addWrap);
  ctx.frame.setPrimary({ label: `${T('run')} · ${targetName(S().target)}` });

  // ---- advanced
  const advBody = h('div', 'xr-adv');
  const ex = { summary: '', testPlanKey: '', version: '', environments: '', ...(S().execution || {}) };
  const exField = (k, label, mono) => ui.field({ label, input: ui.input({ value: ex[k] || '', mono, onInput: (v) => { ex[k] = v; ctx.setState({ execution: { ...ex } }, { silent: true }); refresh(); advCount(); } }) });
  const row1 = h('div', 'xr-adv-row');
  row1.append(ui.field({ label: T('folder'), help: T('folderHint'), input: ui.input({ value: S().folder || '', onInput: (v) => { ctx.setState({ folder: v }, { silent: true }); refresh(); advCount(); } }) }),
    ui.field({ label: T('stepCol'), help: T('stepColHint'), input: ui.select({ options: ['Action', 'Step'], value: S().stepColumn || 'Action', onChange: (v) => { ctx.setState({ stepColumn: v }, { silent: true }); refresh(); advCount(); } }) }));
  const exTitle = h('h3', 'xr-h3', T('execTitle'));
  const row2 = h('div', 'xr-adv-row xr-adv-4');
  row2.append(exField('summary', T('execSummary')), exField('testPlanKey', T('execPlan'), true), exField('version', T('execVersion'), true), exField('environments', T('execEnv'), true));
  const csvTa = ui.textarea({ rows: 3, mono: true, placeholder: 'Test ID,Summary,Test Type,Step,Data,Expected' });
  const csvOut = h('div', 'xr-cols');
  csvTa.addEventListener('input', () => paintColumns());
  advBody.append(row1, exTitle, row2, ui.field({ label: T('checkCsv'), help: T('checkCsvHint'), input: csvTa }), csvOut);
  const adv = ui.advanced({ label: T('advanced'), body: advBody });
  const advCount = () => adv.setCount((S().folder ? 1 : 0) + ((S().stepColumn || 'Action') !== 'Action' ? 1 : 0) + ['summary', 'testPlanKey', 'version', 'environments'].filter((k) => ex[k]).length);
  advCount();
  function paintColumns() {
    csvOut.replaceChildren();
    if (!csvTa.value.trim()) return;
    const { issues } = checkColumns(csvTa.value, S().target || 'cloud');
    const tone = { ok: 'ok', warn: 'warn', error: 'bad' };
    const ul = h('ul', 'xr-col-list');
    for (const i of issues) {
      const li = h('li');
      li.append(h('code', null, i.column), ui.badge({ text: fmt(i.code, i.vars || {}), tone: tone[i.level] }));
      if (i.confirm) li.append(h('em', 'xr-confirm', T('toConfirm')));
      ul.append(li);
    }
    csvOut.append(ul);
  }

  // ---- body: list | editor
  const main = h('div', 'xr-main');
  const listBox = h('section', 'xr-list');
  const edBox = h('section', 'xr-editor');
  main.append(listBox, edBox);
  const listHead = h('div', 'xr-head');
  const addBtns = h('div', 'xr-add');
  const newTest = (type) => {
    const tests = S().tests || [];
    const pre = ((tests[0] || {}).id || `${S().project || 'TEST'}-T00`).replace(/\d+$/, '');
    const max = Math.max(0, ...tests.map((t) => +String(t.id || '').match(/(\d+)$/)?.[1] || 0));
    const t = { id: pre + String(max + 1).padStart(2, '0'), type, summary: '', priority: 'Medium', requirements: (tests[sel] || {}).requirements || '', labels: '', folder: '', precondition: '', steps: type === 'manual' ? [{ action: '', data: '', result: '' }] : [], scenario: '', definition: '' };
    sel = tests.length; ctx.__xraySel = sel;
    setTests([...tests, t], { repaintEditor: true });
    setTimeout(() => { const i = edBox.querySelector('.xr-summary input'); if (i) i.focus(); }, 0);
  };
  for (const ty of ['manual', 'cucumber', 'generic']) addBtns.append(ui.button({ label: T('add' + ty[0].toUpperCase() + ty.slice(1)), icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => newTest(ty) }));
  listHead.append(h('h2', null, T('tests')), addBtns);
  const table = ui.table({ columns: [
    { key: 'id', label: T('colId'), mono: true, width: 100 },
    { key: 'type', label: T('colTypeH'), width: 104, format: (v) => ui.badge({ text: T('t_' + v), tone: 'neutral', icon: TYPE_ICON[v] }) },
    { key: 'summary', label: T('colSummary') },
    { key: 'status', label: T('colResult'), width: 84, format: (v) => (v ? ui.badge({ text: T('s_' + v), tone: RES_TONE[v] }) : '—') },
    { key: '_n', label: T('colIssues'), width: 84, format: (v, r) => (r._e ? ui.badge({ text: String(r._e), tone: 'bad' }) : r._w ? ui.badge({ text: String(r._w), tone: 'warn' }) : ui.badge({ text: '0', tone: 'ok' })) },
  ], rows: [], onRowClick: (row, i) => { sel = i; ctx.__xraySel = i; paintEditor(); markSel(); } });
  listBox.append(listHead, table);
  const markSel = () => table.querySelectorAll('tbody tr').forEach((tr, i) => { tr.classList.toggle('is-selected', i === sel); tr.setAttribute('aria-selected', String(i === sel)); });

  // ---- validation + previews
  const lower = h('div', 'xr-lower');
  const valBox = h('section', 'xr-panel xr-val');
  const pvBox = h('section', 'xr-panel xr-pv');
  lower.append(valBox, pvBox);
  const pv = {};
  for (const k of ['csv', 'feature', 'results', 'bulk', 'guide']) pv[k] = h('div', 'xr-pv-body');
  const pvTabs = ui.tabs({ tabs: ['csv', 'feature', 'results', 'bulk', 'guide'].map((k) => ({ id: k, label: T('pv_' + k) })), active: 'csv', panels: pv });
  pvBox.append(h('h2', null, T('preview')), pvTabs);

  const empty = ui.emptyState({ icon: 'scan-line', title: T('emptyTitle'), text: T('emptyBody'),
    action: { label: T('addTest'), onClick: () => newTest('manual') },
    sample: { label: getLang() === 'fr' ? 'CB FR' : 'Visa EN', onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });

  // ---- editor of the selected test
  function paintEditor() {
    edBox.replaceChildren();
    const t = (S().tests || [])[sel];
    if (!t) { edBox.append(h('p', 'xr-hint', T('selectHint'))); return; }
    const head = h('div', 'xr-head');
    head.append(h('h2', 'mono', t.id || '—'));
    const acts = h('div', 'xr-add');
    acts.append(ui.button({ label: T('duplicate'), icon: 'copy', size: 'sm', variant: 'ghost', onClick: () => { const tests = S().tests.slice(); const c = structuredClone(t); c.id = (t.id || 'T') + '-copy'; tests.splice(sel + 1, 0, c); sel++; ctx.__xraySel = sel; setTests(tests, { repaintEditor: true }); } }),
      ui.button({ label: T('deleteTest'), icon: 'trash-2', size: 'sm', variant: 'ghost', onClick: () => { const tests = S().tests.filter((_, i) => i !== sel); sel = Math.max(0, sel - 1); ctx.__xraySel = sel; setTests(tests, { repaintEditor: true }); } }));
    head.append(acts);
    const txt = (k, label, opts = {}) => {
      const f = ui.field({ label, help: opts.help, input: ui.input({ value: t[k] || '', mono: opts.mono, onInput: (v) => patchTest({ [k]: v }) }) });
      f.dataset.field = k; if (opts.cls) f.classList.add(opts.cls);
      return f;
    };
    const typeSeg = ui.segmented({ label: T('f_type'), value: t.type, options: Object.keys(TYPES).map((k) => ({ value: k, label: T('t_' + k) })),
      onChange: (v) => patchTest({ type: v, steps: v === 'manual' && !(t.steps || []).length ? [{ action: '', data: '', result: '' }] : t.steps }, { repaintEditor: true }) });
    const r1 = h('div', 'xr-row xr-row-3');
    r1.append(txt('id', T('f_id'), { mono: true }), ui.field({ label: T('f_type'), help: T('typeHint_' + t.type), input: typeSeg }),
      ui.field({ label: T('f_priority'), input: ui.select({ options: [...new Set([...JIRA_PRIORITIES, t.priority || 'Medium'])], value: t.priority || 'Medium', onChange: (v) => patchTest({ priority: v }) }) }));
    const sum = txt('summary', T('f_summary'), { help: T('f_summaryHint'), cls: 'xr-summary' });
    const r2 = h('div', 'xr-row xr-row-3');
    r2.append(txt('requirements', T('f_req'), { mono: true, help: T('f_reqHint') }), txt('labels', T('f_labels'), { help: T('f_labelsHint') }), txt('folder', T('f_folder'), { help: S().folder ? `${T('folder')}: ${S().folder}` : '' }));
    edBox.append(head, r1, sum, r2);
    if (t.type === 'manual') {
      edBox.append(ui.field({ label: T('f_pre'), input: ui.textarea({ value: t.precondition || '', rows: 2, onInput: (v) => patchTest({ precondition: v }) }) }));
      const steps = ui.grid({ columns: [
        { key: 'action', label: T('stepAction') }, { key: 'data', label: T('stepData'), width: '22%' }, { key: 'result', label: T('stepResult') },
      ], rows: (t.steps || []).map((s) => ({ ...s })), removable: true, addLabel: T('addStep'), newRow: () => ({ action: '', data: '', result: '' }),
      onChange: (rows) => patchTest({ steps: rows.map(({ action, data, result }) => ({ action: action || '', data: data || '', result: result || '' })) }) });
      steps.classList.add('xr-steps');
      const sf = h('div', 'xr-steps-wrap'); sf.append(h('div', 'section-label', T('f_steps')), steps);
      edBox.append(sf);
    } else if (t.type === 'cucumber') {
      const code = ui.codeEditor({ value: t.scenario || '', lang: 'gherkin', rows: 9, onChange: (v) => patchTest({ scenario: v }), ariaLabel: T('f_scenario') });
      const f = ui.field({ label: T('f_scenario'), input: code }); f.dataset.field = 'scenario';
      edBox.append(f);
    } else {
      edBox.append(txt('definition', T('f_definition'), { mono: true }));
    }
    const r3 = h('div', 'xr-row xr-row-3');
    r3.append(ui.field({ label: T('f_status'), input: ui.select({ options: RES.map((v) => ({ value: v, label: T('s_' + (v || 'none')) })), value: t.status || '', onChange: (v) => patchTest({ status: v }) }) }),
      txt('comment', T('f_comment')), txt('defects', T('f_defects'), { mono: true }));
    edBox.append(r3, h('div', 'xr-ed-issues'));
    paintEditorIssues();
  }
  function paintEditorIssues() {
    const box = edBox.querySelector('.xr-ed-issues');
    if (!box) return;
    box.replaceChildren();
    const t = (S().tests || [])[sel];
    if (!t) return;
    const spec = specOf(S());
    const mine = validate(spec, S().target || 'cloud').filter((i) => i.test === (t.id || `#${sel + 1}`) && i.level !== 'info');
    edBox.querySelectorAll('[data-field]').forEach((f) => f.setError && f.setError(''));
    for (const i of mine) {
      const f = edBox.querySelector(`[data-field="${i.field}"]`);
      if (f && f.setError && i.level === 'error') f.setError(issueText(i, spec));
      else box.append(issueLine(i, spec));
    }
  }
  const issueLine = (i, spec) => {
    const li = h('div', `xr-issue lvl-${i.level}`);
    li.append(ui.icon(i.level === 'error' ? 'circle-x' : i.level === 'warn' ? 'triangle-alert' : 'info', { size: 14 }));
    const tx = h('span', null, issueText(i, spec));
    li.append(tx);
    if (i.confirm) li.append(h('em', 'xr-confirm', T('toConfirm')));
    return li;
  };

  function refresh() {
    const s = S();
    const tests = s.tests || [];
    const target = s.target || 'cloud';
    const spec = specOf(s);
    const issues = validate(spec, target);
    const byTest = (id) => issues.filter((i) => i.test === id);
    table.setRows(tests.map((t, i) => { const id = t.id || `#${i + 1}`; const mine = byTest(id); return { ...t, _e: mine.filter((x) => x.level === 'error').length, _w: mine.filter((x) => x.level === 'warn').length }; }));
    markSel();
    const has = tests.length > 0;
    empty.hidden = has; main.hidden = !has; lower.hidden = !has;
    // validation panel
    valBox.replaceChildren();
    const e = issues.filter((i) => i.level === 'error').length, w = issues.filter((i) => i.level === 'warn').length;
    const vh = h('div', 'xr-head'); vh.append(h('h2', null, fmt('validation', { target: targetName(target) })), ui.badge({ text: fmt('counts', { e, w }), tone: e ? 'bad' : w ? 'warn' : 'ok' }));
    valBox.append(vh);
    if (!e) valBox.append(h('p', 'xr-valid', fmt('valid', { target: targetName(target) })));
    const groups = new Map();
    for (const i of issues) { const k = i.test || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(i); }
    const order = { error: 0, warn: 1, info: 2 };
    for (const [k, list] of groups) {
      const g = h('div', 'xr-group');
      const gh = h(k ? 'button' : 'div', 'xr-group-h mono', k || T('general'));
      if (k) { gh.type = 'button'; gh.addEventListener('click', () => { const idx = tests.findIndex((t, i) => (t.id || `#${i + 1}`) === k); if (idx >= 0) { sel = idx; ctx.__xraySel = idx; paintEditor(); markSel(); edBox.scrollIntoView({ block: 'nearest' }); } }); }
      g.append(gh);
      for (const i of list.sort((a, b) => order[a.level] - order[b.level])) g.append(issueLine(i, spec));
      valBox.append(g);
    }
    // previews
    const pre = (text, lang) => { const c = ui.codeEditor({ value: text, lang, readonly: true, rows: 14 }); const w2 = h('div', 'xr-code'); w2.append(ui.copyButton({ text, size: 'sm', variant: 'ghost' }), c); return w2; };
    const csv = testsCsv(spec, target);
    pv.csv.replaceChildren(csv ? pre(csv.replace(/\r\n/g, '\n'), 'bash') : h('p', 'xr-hint', T('noManual')));
    const files = featureFiles(spec);
    pv.feature.replaceChildren(...(files.length ? files.map((f) => { const d = h('div', 'xr-file'); d.append(h('div', 'xr-fname mono', f.name), pre(f.text, 'gherkin')); return d; }) : [h('p', 'xr-hint', T('noCucumber'))]));
    const exj = executionJson(spec, target);
    pv.results.replaceChildren(exj && exj.tests.length ? pre(JSON.stringify(exj, null, 2), 'json') : h('p', 'xr-hint', T('noResults')));
    pv.bulk.replaceChildren(pre(JSON.stringify(testsBulkJson(spec), null, 2), 'json'));
    pv.guide.replaceChildren(pre(importGuide(spec, target), 'bash'));
    pvTabs.setCount('feature', files.length || '');
    ctx.frame.setStatus(e ? { tone: 'bad', text: fmt('statusBad', { e, target: targetName(target) }) } : { tone: 'ok', text: fmt('statusOk', { n: tests.length, target: targetName(target) }) });
    paintEditorIssues();
    return { errors: e, warnings: w, tests: tests.length, target };
  }

  // ---- sources
  function pasteDialog() {
    const ta = ui.textarea({ rows: 12, mono: true, placeholder: 'CARD-T10: Card blocked twice shows one confirmation\nreq: CARD-110\nTap Block on a blocked card | Test card 4111… | The button is disabled' });
    const f = ui.field({ label: T('pasteTitle'), help: T('pasteHelp'), input: ta });
    const apply = (replace) => (close) => {
      const list = testsFromList(ta.value, { prefix: `${S().project || 'TEST'}-T` });
      if (!list.length) { f.setError(T('pasteNone')); return false; }
      const tests = replace ? list : [...(S().tests || []), ...list];
      sel = replace ? 0 : (S().tests || []).length; ctx.__xraySel = sel;
      setTests(tests, { repaintEditor: true });
      ctx.toast(fmt('added', { n: list.length }));
      close && close();
    };
    ui.modal({ title: T('pasteTitle'), body: f, size: 'lg', actions: [{ label: T('cancel') }, { label: T('pasteReplace'), onClick: apply(true) }, { label: T('pasteAdd'), variant: 'primary', onClick: apply(false) }] });
    setTimeout(() => ta.focus(), 0);
  }
  async function fromTool(tool) {
    let st = null;
    try {
      const list = (await ctx.store.list(tool)).filter((w) => !w.is_sample).sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
      for (const w of list) { const full = w.state ? w : await ctx.store.get(w.id); if (full && full.state && (tool === 'uat-tracker' ? (full.state.cases || []).length : ((full.state.cases || []).length || (full.state.req && full.state.req.url)))) { st = full.state; break; } }
    } catch { /* store unavailable */ }
    let added = [];
    if (tool === 'uat-tracker') {
      if (!st) { st = UAT_SAMPLES[getLang() === 'fr' ? 'fr' : 'en'][0].state; ctx.toast(T('noUat'), { tone: 'info' }); }
      added = testsFromUat(st);
      if (!S().project && added[0]) ctx.setState({ project: (added[0].requirements || '').split('-')[0] }, { silent: true });
    } else {
      if (!st) { ctx.toast(T('noApi'), { tone: 'info' }); return; }
      added = testsFromApi(st);
    }
    const ids = new Set((S().tests || []).map((t) => t.id));
    added = added.filter((t) => !ids.has(t.id));
    sel = (S().tests || []).length; ctx.__xraySel = sel;
    setTests([...(S().tests || []), ...added], { repaintEditor: true });
    ctx.toast(fmt('added', { n: added.length }));
  }

  // ---- extra action: download every .feature file
  ctx.frame.actions.append(ui.button({ label: T('downloadFeatures'), icon: 'code', variant: 'ghost', onClick: () => { for (const f of featureFiles(specOf(S()))) ctx.download(f.name, 'text/plain', f.text); } }));

  el.append(adv, empty, main, lower);
  ctx.__xrayRefresh = refresh;
  refresh();
  paintEditor();
}

/* ---------------------------------------------------------------- module */
const sampleList = (lang) => SAMPLES[lang].map((s) => ({ id: s.id, label: s.title, hint: s.client, state: s.state, autorun: true }));
const tgtOf = (s) => s.target || 'cloud';

export default {
  id: 'xray-builder',
  skill: 'managing-xray-tests',
  icon: 'scan-line',
  title: { en: 'Xray builder', fr: 'Générateur Xray' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'shield-check' },
  schema: 1,
  defaults() {
    return { title: '', project: '', target: 'cloud', folder: '', stepColumn: 'Action', features: {}, background: {}, execution: { summary: '', testPlanKey: '', version: '', environments: '' }, tests: [] };
  },
  samples: { en: sampleList('en'), fr: sampleList('fr') },
  mount,
  validate(s) {
    const e = [];
    if (!/^[A-Z][A-Z0-9_]+$/.test(s.project || '')) e.push({ field: 'project', message: T('errProject') });
    if (!(s.tests || []).length) e.push({ field: 'project', message: T('errNoTests') });
    return e;
  },
  run(state, ctx) {
    const r = ctx.__xrayRefresh ? ctx.__xrayRefresh() : null;
    const issues = validate(specOf(state), tgtOf(state));
    return r || { errors: issues.filter((i) => i.level === 'error').length, warnings: issues.filter((i) => i.level === 'warn').length, tests: (state.tests || []).length, target: tgtOf(state) };
  },
  status(r, ms) {
    return r.errors ? { tone: 'bad', text: fmt('statusBad', { e: r.errors, target: targetName(r.target) }), ms } : { tone: 'ok', text: fmt('statusOk', { n: r.tests, target: targetName(r.target) }), ms };
  },
  toMarkdown,
  exports: [
    { id: 'csv', label: { en: strings.en.exportCsv, fr: strings.fr.exportCsv }, build: (s) => { const t = testsCsv(specOf(s), tgtOf(s)); if (!t) throw new Error(T('noManual')); return { name: `tests-${tgtOf(s)}.csv`, mime: 'text/csv', text: t }; } },
    { id: 'bulk', label: { en: strings.en.exportBulk, fr: strings.fr.exportBulk }, build: (s) => ({ name: `tests-${tgtOf(s)}.json`, mime: 'application/json', text: JSON.stringify(testsBulkJson(specOf(s)), null, 2) + '\n' }) },
    { id: 'results', label: { en: strings.en.exportResults, fr: strings.fr.exportResults }, build: (s) => { const j = executionJson(specOf(s), tgtOf(s)); if (!j || !j.tests.length) throw new Error(T('noResults')); return { name: `results-${tgtOf(s)}.json`, mime: 'application/json', text: JSON.stringify(j, null, 2) + '\n' }; } },
    { id: 'guide', label: { en: strings.en.exportGuide, fr: strings.fr.exportGuide }, build: (s) => ({ name: `IMPORT-${tgtOf(s)}.md`, mime: 'text/markdown', text: importGuide(specOf(s), tgtOf(s)) }) },
  ],
  aiActions: [
    { id: 'draft', label: { en: strings.en.aiDraft, fr: strings.fr.aiDraft }, prompt: (s) => promptDraft(s), expects: 'markdown' },
    { id: 'review', label: { en: strings.en.aiReview, fr: strings.fr.aiReview }, prompt: (s) => promptReview(s), expects: 'markdown' },
  ],
  _internals: { toMarkdown, specOf },
};
