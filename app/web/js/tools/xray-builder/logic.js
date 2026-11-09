/* Xray builder · pure logic (no DOM; node logic.test.mjs checks parity with skills/managing-xray-tests/scripts/build_xray.py).
   Spec (same shape as the script's spec): {project, folder, features: {REQ: name}, background: {REQ: text},
     tests: [{id, key?, type: manual|cucumber|generic, summary, priority, requirements: [], labels: [], folder?, description?,
              precondition?, steps: [{action, data, result}], scenario, definition}],
     execution?: {summary, version, testPlanKey, testExecutionKey, environments: [], start, finish, results: [{test, status, comment, defects}]}}
   The tool state keeps labels / requirements as text ("a b" / "CARD-110, CARD-111"); toSpec() turns it into the spec.
   Target: 'cloud' | 'server' (Server / Data Center). */
import { toCsv, parseRows } from '../uat-tracker/csv.js';

export const KEY = /^[A-Z][A-Z0-9_]+-\d+$/;
export const PROJECT = /^[A-Z][A-Z0-9_]+$/;
export const TYPES = { manual: 'Manual', cucumber: 'Cucumber', generic: 'Generic' };
export const STATUS = {
  cloud: { passed: 'PASSED', failed: 'FAILED', todo: 'TODO', executing: 'EXECUTING' },
  server: { passed: 'PASS', failed: 'FAIL', todo: 'TODO', executing: 'EXECUTING' },
};
export const TYPE_FIELD = { cloud: 'type', server: 'testType' };
// English keywords (script) + French keywords (Gherkin "# language: fr"); the script only knows English.
const GHERKIN_EN = /^\s*(Given|When|Then|And|But|\*|Examples:|\|)/i;
const GHERKIN_FR = /^\s*(Soit|Sachant que|Etant donné|Étant donné|Quand|Lorsque|Alors|Et|Mais|Exemples\s*:|\*|\|)/i;
export const isGherkin = (l) => GHERKIN_EN.test(l) || GHERKIN_FR.test(l);
const isFrench = (txt) => /^\s*(Soit|Quand|Lorsque|Alors|Etant|Étant|Sachant)\b/im.test(txt || '') && !/^\s*(Given|When|Then)\b/im.test(txt || '');
export const JIRA_PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];

const words = (s) => String(s || '').split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
/** Labels: comma-separated when the text has a comma (so "high risk" stays one label and gets flagged), else space-separated. */
export const labelsOf = (v) => (Array.isArray(v) ? v.filter(Boolean) : /,/.test(v || '') ? String(v).split(',').map((x) => x.trim()).filter(Boolean) : words(v));
export const listOf = (v) => (Array.isArray(v) ? v.filter(Boolean) : words(v));

/** Tool state → script spec. */
export function toSpec(state) {
  return {
    project: String(state.project || '').trim(),
    folder: state.folder || '',
    features: state.features || {},
    background: state.background || {},
    tests: (state.tests || []).map((t) => {
      const o = { id: String(t.id || '').trim(), type: t.type, summary: t.summary || '' };
      if (t.key) o.key = t.key;
      if (t.priority) o.priority = t.priority;
      o.requirements = listOf(t.requirements);
      o.labels = labelsOf(t.labels);
      if (t.folder) o.folder = t.folder;
      if (t.description) o.description = t.description;
      if (t.precondition) o.precondition = t.precondition;
      if (t.type === 'manual') o.steps = (t.steps || []).filter((s) => s && (s.action || s.data || s.result));
      if (t.type === 'cucumber') o.scenario = t.scenario || '';
      if (t.type === 'generic') o.definition = t.definition || '';
      return o;
    }),
    execution: state.execution && (state.tests || []).some((t) => t.status) ? {
      ...state.execution,
      environments: listOf(state.execution.environments),
      results: (state.tests || []).filter((t) => t.status).map((t) => ({ test: t.id, status: t.status, ...(t.comment ? { comment: t.comment } : {}), ...(t.defects ? { defects: listOf(t.defects) } : {}) })),
    } : null,
  };
}

/* ---------------------------------------------------------------- validation
   Issue: {level: 'error'|'warn'|'info', code, test (id or ''), field, vars, confirm (true when research could not verify it)}.
   Errors = the script's validate() (same rules); warn / info = target rules of the tool. */
export function validate(spec, target = 'cloud') {
  const out = [];
  const err = (code, test, field, vars = {}) => out.push({ level: 'error', code, test, field, vars });
  const warn = (code, test, field, vars = {}, confirm = false, level = 'warn') => out.push({ level, code, test, field, vars, confirm });
  if (!PROJECT.test(spec.project || '')) err('project', '', 'project');
  const ids = new Set();
  const summaries = new Map();
  (spec.tests || []).forEach((t, i) => {
    const w = t.id || `#${i + 1}`;
    if (!t.id) err('noId', w, 'id');
    else if (ids.has(t.id)) err('dupId', w, 'id');
    ids.add(t.id);
    if (!TYPES[t.type]) err('type', w, 'type');
    if (!(t.summary || '').trim()) err('noSummary', w, 'summary');
    if (t.key && !KEY.test(t.key)) err('badKey', w, 'key', { key: t.key });
    for (const r of t.requirements || []) if (!KEY.test(r)) err('badReq', w, 'requirements', { req: r });
    for (const l of t.labels || []) if (/\s/.test(l)) err('labelSpace', w, 'labels', { label: l });
    if (t.type === 'manual') {
      const steps = t.steps || [];
      if (!steps.length) err('noSteps', w, 'steps');
      steps.forEach((s, j) => {
        if (!(s.action || '').trim()) err('noAction', w, 'steps', { n: j + 1 });
        if (!(s.result || '').trim()) err('noResult', w, 'steps', { n: j + 1 });
      });
    }
    if (t.type === 'cucumber') {
      const lines = (t.scenario || '').split('\n').filter((l) => l.trim());
      if (!lines.length) err('noScenario', w, 'scenario');
      for (const l of lines) if (!isGherkin(l)) err('notGherkin', w, 'scenario', { line: l.trim() });
      if (isFrench(t.scenario)) warn('frGherkin', w, 'scenario', {}, false, 'info');
    }
    if (t.type === 'generic' && !(t.definition || '').trim()) err('noDefinition', w, 'definition');
    // tool rules
    if (t.priority && !JIRA_PRIORITIES.includes(t.priority)) warn('priority', w, 'priority', { p: t.priority, list: JIRA_PRIORITIES.join(', ') }, true);
    if (!(t.requirements || []).length) warn('noReq', w, 'requirements');
    for (const r of t.requirements || []) if (KEY.test(r) && spec.project && !r.startsWith(spec.project + '-')) warn('otherProject', w, 'requirements', { req: r, project: spec.project }, false, 'info');
    const sk = (t.summary || '').trim().toLowerCase();
    if (sk) { if (summaries.has(sk)) warn('dupSummary', w, 'summary', { other: summaries.get(sk) }); else summaries.set(sk, w); }
    if (t.type === 'manual') (t.steps || []).forEach((s, j) => { if (/works correctly|fonctionne correctement|is ok$|est ok$/i.test(s.result || '')) warn('vagueResult', w, 'steps', { n: j + 1 }); });
    if (t.key) warn('overwrite', w, 'key', { key: t.key }, false, 'info');
  });
  const tests = spec.tests || [];
  const n = (ty) => tests.filter((t) => t.type === ty).length;
  if (n('cucumber')) warn('cucumberNotCsv', '', 'type', { n: n('cucumber') }, false, 'info');
  if (n('generic')) warn('genericNotCsv', '', 'type', { n: n('generic') }, false, 'info');
  if (target === 'server' && n('manual')) warn('serverStepColumn', '', 'csv', {}, true);
  if (target === 'server' && tests.some((t) => t.folder || spec.folder)) warn('serverRepoPath', '', 'folder', {}, true);
  if (tests.length) warn(target === 'cloud' ? 'bulkJsonCloud' : 'bulkJsonServer', '', 'json', {}, true, 'info');
  const ex = spec.execution;
  if (ex) {
    if (ex.testExecutionKey && !KEY.test(ex.testExecutionKey)) err('execKey', '', 'execution');
    if (ex.testPlanKey && !KEY.test(ex.testPlanKey)) err('planKey', '', 'execution');
    const byId = Object.fromEntries(tests.map((t) => [t.id, t]));
    for (const r of ex.results || []) {
      if (!byId[r.test]) err('resultUnknown', r.test, 'status');
      if (!STATUS.cloud[r.status]) err('resultStatus', r.test, 'status', { s: r.status });
    }
    warn('statusVocab', '', 'status', { list: Object.values(STATUS[target]).join(', '), field: TYPE_FIELD[target] }, false, 'info');
  }
  return out;
}

/* ---------------------------------------------------------------- CSV (port of write_csv; Python csv.writer → CRLF) */
export function testsCsv(spec, target = 'cloud') {
  const manual = (spec.tests || []).filter((t) => t.type === 'manual');
  if (!manual.length) return '';
  const nReq = Math.max(1, ...manual.map((t) => (t.requirements || []).length));
  const nLab = Math.max(1, ...manual.map((t) => (t.labels || []).length));
  const step = target === 'server' && spec.serverStepColumn === 'Step' ? 'Step' : 'Action';
  const head = ['Test ID', 'Summary', 'Description', 'Test Type', 'Priority', 'Test Repository Path',
    ...Array(nReq).fill('Requirement'), ...Array(nLab).fill('Labels'), step, 'Data', 'Expected Result'];
  const rows = [head];
  for (const t of manual) {
    let desc = (t.description || '').trim();
    if (t.precondition) desc = (desc ? desc + '\n\n' : '') + 'Precondition: ' + t.precondition.trim();
    const reqs = [...(t.requirements || []), ...Array(nReq - (t.requirements || []).length).fill('')];
    const labs = [...(t.labels || []), ...Array(nLab - (t.labels || []).length).fill('')];
    const first = [t.id, t.summary, desc, 'Manual', t.priority || '', t.folder || spec.folder || '', ...reqs, ...labs];
    const blank = [t.id, ...Array(first.length - 1).fill('')];
    (t.steps || []).forEach((s, j) => rows.push([...(j === 0 ? first : blank), s.action, s.data || '', s.result]));
  }
  return toCsv(rows);
}

/* ---------------------------------------------------------------- .feature files (port of write_features) */
const slug = (s) => (String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50)) || 'tests';
export function featureFiles(spec) {
  const groups = new Map();
  for (const t of spec.tests || []) if (t.type === 'cucumber') {
    const req = (t.requirements || [])[0] || null;
    if (!groups.has(req)) groups.set(req, []);
    groups.get(req).push(t);
  }
  const files = [];
  for (const [req, tests] of groups) {
    const name = (spec.features || {})[req || ''] || tests[0].summary;
    const fr = tests.some((t) => isFrench(t.scenario));
    const out = [];
    if (fr) out.push('# language: fr');
    if (req) out.push(`@${req}`);
    out.push(`${fr ? 'Fonctionnalité' : 'Feature'}: ${name}`);
    const bg = (spec.background || {})[req || ''];
    if (bg) { out.push('', `  ${fr ? 'Contexte' : 'Background'}:`); for (const l of bg.split('\n')) if (l.trim()) out.push(`    ${l.trim()}`); }
    for (const t of tests) {
      const tags = [...(t.key ? [`@${t.key}`] : []), ...(t.requirements || []).slice(1).map((r) => `@${r}`), ...(t.labels || []).map((l) => `@${l}`)];
      const outline = /Examples:|Exemples\s*:/.test(t.scenario || '');
      const kind = fr ? (outline ? 'Plan du scénario' : 'Scénario') : (outline ? 'Scenario Outline' : 'Scenario');
      out.push('', ...(tags.length ? [`  ${tags.join(' ')}`] : []), `  ${kind}: ${t.summary}`);
      for (const l of (t.scenario || '').split('\n')) if (l.trim()) out.push((l.trim().startsWith('|') ? '      ' : '    ') + l.trim());
    }
    files.push({ name: `${(req || 'no-requirement').toLowerCase()}-${slug(name)}.feature`, text: out.join('\n') + '\n', count: tests.length });
  }
  return files;
}

/* ---------------------------------------------------------------- JSON */
export function testInfo(spec, t, target) {
  const info = { projectKey: spec.project, summary: t.summary, [TYPE_FIELD[target]]: TYPES[t.type] };
  if ((t.requirements || []).length) info.requirementKeys = t.requirements;
  if ((t.labels || []).length) info.labels = t.labels;
  if (t.type === 'manual') info.steps = t.steps.map((s) => ({ action: s.action, data: s.data || '', result: s.result }));
  else if (t.type === 'cucumber') info.scenario = t.scenario.split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
  else info.definition = t.definition;
  return info;
}
/** Execution results (port of execution_json): the format the skill documents for both targets. */
export function executionJson(spec, target) {
  const ex = spec.execution;
  if (!ex) return null;
  const byId = Object.fromEntries(spec.tests.map((t) => [t.id, t]));
  const st = STATUS[target];
  const doc = {};
  if (ex.testExecutionKey) doc.testExecutionKey = ex.testExecutionKey;
  const info = { project: spec.project };
  for (const [a, b] of [['summary', 'summary'], ['description', 'description'], ['version', 'version'], ['revision', 'revision'], ['start', 'startDate'], ['finish', 'finishDate'], ['testPlanKey', 'testPlanKey']]) if (ex[a]) info[b] = ex[a];
  if ((ex.environments || []).length) info.testEnvironments = ex.environments;
  doc.info = info;
  doc.tests = [];
  for (const r of ex.results || []) {
    const t = byId[r.test];
    if (!t) continue;
    const item = t.key ? { testKey: t.key } : { testInfo: testInfo(spec, t, target) };
    item.status = st[r.status];
    if (r.comment) item.comment = r.comment;
    if ((r.steps || []).length) item.steps = r.steps.map((s) => (typeof s === 'string' ? { status: st[s] }
      : { status: st[s.status], ...Object.fromEntries(Object.entries(s).filter(([k]) => k === 'comment' || k === 'actualResult')) }));
    if ((r.defects || []).length) item.defects = r.defects;
    doc.tests.push(item);
  }
  return doc;
}
/** Test definitions in bulk (research/05: Cloud `POST /api/v2/import/test/bulk`; field names *to confirm* with one real import).
    Server / DC: same body shape assumed, endpoint `/rest/raven/1.0/import/test/bulk` *to confirm*. */
export function testsBulkJson(spec) {
  return (spec.tests || []).map((t) => {
    const fields = { summary: t.summary, project: { key: spec.project } };
    if ((t.labels || []).length) fields.labels = t.labels;
    if (t.priority) fields.priority = { name: t.priority };
    const desc = [(t.description || '').trim(), t.precondition ? 'Precondition: ' + t.precondition.trim() : ''].filter(Boolean).join('\n\n');
    if (desc) fields.description = desc;
    const o = { testtype: TYPES[t.type], fields };
    if (t.type === 'manual') o.steps = (t.steps || []).map((s) => ({ action: s.action, data: s.data || '', result: s.result }));
    if (t.type === 'cucumber') o.gherkin_def = (t.scenario || '').split('\n').map((l) => l.trim()).filter(Boolean).join('\n');
    if (t.type === 'generic') o.unstructured_def = t.definition;
    if ((t.requirements || []).length) o.xray_requirements = t.requirements; // *to confirm*: requirement link field of the bulk API
    if (t.folder || spec.folder) o.xray_test_repository_folder = t.folder || spec.folder; // *to confirm*
    return o;
  });
}

/* ---------------------------------------------------------------- column checker (pasted CSV header) */
// confirmed = documented in the skill / research 05; false = *to confirm* (research could not verify it).
export const COLUMNS = {
  cloud: [
    { name: 'Test ID', confirmed: true }, { name: 'Summary', confirmed: true }, { name: 'Description', confirmed: true },
    { name: 'Test Type', confirmed: true }, { name: 'Priority', confirmed: true }, { name: 'Test Repository Path', confirmed: true },
    { name: 'Requirement', confirmed: true, repeat: true }, { name: 'Labels', confirmed: true, repeat: true },
    { name: 'Action', confirmed: true }, { name: 'Data', confirmed: true }, { name: 'Expected Result', confirmed: true },
    { name: 'Precondition', confirmed: false }, { name: 'Gherkin', confirmed: false }, { name: 'Generic Definition', confirmed: false },
    { name: 'Test Key', confirmed: false }, { name: 'Component', confirmed: false }, { name: 'Fix Version', confirmed: false },
  ],
  server: [
    { name: 'Test ID', confirmed: true }, { name: 'Summary', confirmed: true }, { name: 'Description', confirmed: true },
    { name: 'Test Type', confirmed: true }, { name: 'Priority', confirmed: true }, { name: 'Test Repository Path', confirmed: false },
    { name: 'Requirement', confirmed: true, repeat: true }, { name: 'Labels', confirmed: true, repeat: true },
    { name: 'Action', confirmed: false, alt: 'Step' }, { name: 'Step', confirmed: false, alt: 'Action' }, { name: 'Data', confirmed: true },
    { name: 'Expected Result', confirmed: true }, { name: 'Precondition', confirmed: false }, { name: 'Gherkin', confirmed: false },
    { name: 'Generic Definition', confirmed: false }, { name: 'Test Key', confirmed: false }, { name: 'Component', confirmed: false },
  ],
};
const SYNONYMS = { 'expected': 'Expected Result', 'expected result': 'Expected Result', 'expected results': 'Expected Result', 'result': 'Expected Result',
  'résultat attendu': 'Expected Result', 'step': 'Action', 'steps': 'Action', 'action': 'Action', 'test step': 'Action', 'étape': 'Action',
  'test case id': 'Test ID', 'tc id': 'Test ID', 'id': 'Test ID', 'title': 'Summary', 'name': 'Summary', 'titre': 'Summary', 'résumé': 'Summary',
  'type': 'Test Type', 'label': 'Labels', 'requirements': 'Requirement', 'story': 'Requirement', 'exigence': 'Requirement',
  'folder': 'Test Repository Path', 'path': 'Test Repository Path', 'test data': 'Data', 'données': 'Data', 'issue type': null };
/** → [{column, level, code, vars, confirm}] for each header cell of a pasted CSV. */
export function checkColumns(csvText, target = 'cloud') {
  const rows = parseRows(csvText);
  if (!rows.length) return { header: [], issues: [], types: [] };
  const header = rows[0].map((h) => h.trim());
  const known = COLUMNS[target];
  const issues = [];
  const seen = new Set();
  header.forEach((h, i) => {
    const exact = known.find((c) => c.name === h);
    const ci = known.find((c) => c.name.toLowerCase() === h.toLowerCase());
    if (exact) {
      if (seen.has(h) && !exact.repeat) issues.push({ column: h, idx: i, level: 'error', code: 'colDup' });
      else if (!exact.confirmed) issues.push({ column: h, idx: i, level: 'warn', code: exact.alt ? 'colAlt' : 'colConfirm', vars: { alt: exact.alt || '' }, confirm: true });
      else issues.push({ column: h, idx: i, level: 'ok', code: 'colOk' });
      if (target === 'cloud' && h === 'Step') issues.push({ column: h, idx: i, level: 'warn', code: 'colStepCloud' });
    } else if (ci) issues.push({ column: h, idx: i, level: 'warn', code: 'colCase', vars: { expected: ci.name } });
    else {
      const k = h.toLowerCase();
      if (k in SYNONYMS && SYNONYMS[k] === null) issues.push({ column: h, idx: i, level: 'error', code: 'colJira' });
      else if (SYNONYMS[k]) issues.push({ column: h, idx: i, level: 'warn', code: 'colRename', vars: { expected: SYNONYMS[k] } });
      else issues.push({ column: h, idx: i, level: 'warn', code: 'colUnknown' });
    }
    seen.add(h);
  });
  if (target === 'cloud' && header.includes('Step') && !header.includes('Action')) issues.push({ column: 'Step', level: 'warn', code: 'colStepCloud' });
  for (const must of ['Summary', 'Expected Result']) if (!header.some((h) => h.toLowerCase() === must.toLowerCase() || SYNONYMS[h.toLowerCase()] === must)) issues.push({ column: must, level: 'error', code: 'colMissing' });
  // types: Test Type values
  const tCol = header.findIndex((h) => /^test type$/i.test(h) || /^type$/i.test(h));
  const types = [];
  if (tCol >= 0) for (const r of rows.slice(1)) { const v = (r[tCol] || '').trim(); if (v && !Object.values(TYPES).includes(v)) types.push(v); }
  for (const v of [...new Set(types)]) issues.push({ column: header[tCol], level: 'error', code: 'colType', vars: { v, list: Object.values(TYPES).join(', ') } });
  return { header, issues };
}

/* ---------------------------------------------------------------- import sources */
/** Pasted list → tests. Blocks separated by a blank line; first line = summary ("ID: summary", "ID | summary" or "- summary");
    Gherkin lines → Cucumber; "action | data | expected" or "action -> expected" lines → Manual steps; "definition: x" → Generic. */
export function testsFromList(text, { prefix = 'T' } = {}) {
  const blocks = String(text || '').replace(/\r/g, '').split(/\n\s*\n/).map((b) => b.split('\n').map((l) => l.replace(/\s+$/, '')).filter((l) => l.trim()));
  const tests = [];
  let n = 0;
  const one = (lines) => {
    let head = lines[0].replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim();
    let id = '';
    const m = head.match(/^([A-Z][A-Z0-9_]*-[A-Z]*\d+)\s*(?:[:|–-])\s*(.+)$/);
    if (m) { id = m[1]; head = m[2].trim(); }
    const rest = lines.slice(1).map((l) => l.trim().replace(/^\s*(?:[-*•]|\d+[.)])\s+/, ''));
    const t = { id: id || `${prefix}-${String(++n).padStart(2, '0')}`, type: 'manual', summary: head, priority: 'Medium', labels: '', requirements: '', folder: '', precondition: '', steps: [], scenario: '', definition: '' };
    if (rest.length && rest.every((l) => isGherkin(l))) { t.type = 'cucumber'; t.scenario = rest.join('\n'); }
    else if (rest.length === 1 && /^definition\s*:/i.test(rest[0])) { t.type = 'generic'; t.definition = rest[0].replace(/^definition\s*:\s*/i, ''); }
    else {
      for (const l of rest) {
        const req = l.match(/^(?:req|requirement|exigence|story)\s*:\s*(.+)$/i);
        if (req) { t.requirements = req[1]; continue; }
        const pre = l.match(/^(?:pre(?:condition)?|précondition|prérequis)\s*:\s*(.+)$/i);
        if (pre) { t.precondition = pre[1]; continue; }
        const lab = l.match(/^(?:labels?|étiquettes?)\s*:\s*(.+)$/i);
        if (lab) { t.labels = lab[1]; continue; }
        if (l.includes('|')) { const [action, data, result] = l.split('|').map((x) => x.trim()); t.steps.push(result === undefined ? { action, data: '', result: data || '' } : { action, data, result }); }
        else if (/\s(->|→|=>)\s/.test(l)) { const [action, result] = l.split(/\s(?:->|→|=>)\s/); t.steps.push({ action: action.trim(), data: '', result: (result || '').trim() }); }
        else t.steps.push({ action: l, data: '', result: '' });
      }
    }
    return t;
  };
  for (const b of blocks) {
    if (!b.length) continue;
    // a block of single lines without detail = one test per line
    if (b.length > 1 && b.every((l) => /^\s*(?:[-*•]|\d+[.)])\s+/.test(l))) b.forEach((l) => tests.push(one([l])));
    else tests.push(one(b));
  }
  return tests;
}

/** UAT tracker state → tests (one Manual test per case, one step; status → execution result). */
export function testsFromUat(uat) {
  const ST = { pass: 'passed', fail: 'failed', blocked: 'todo', notrun: '' };
  const slugLabel = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return (uat.cases || []).filter((c) => c.title).map((c) => ({
    id: c.id, type: 'manual', summary: c.title, priority: 'Medium', labels: ['uat', slugLabel(c.feature)].filter(Boolean).join(' '),
    requirements: c.req || '', folder: c.feature ? '/' + c.feature : '', precondition: '',
    steps: [{ action: c.title, data: '', result: c.expected || '' }], scenario: '', definition: '',
    status: ST[c.status] || '', comment: c.evidence || '', defects: c.defect || '',
  }));
}

/** API tester state (owner C: {cases: [{id, name, steps: [{name, req}]}], req}) → Manual tests, one step per request. */
export function testsFromApi(api) {
  const checkText = (req) => (req.checks || []).filter((c) => c.on !== false).map((c) => `${c.target}${c.key ? ' ' + c.key : ''} ${c.op} ${c.expected}`.trim()).join('; ');
  const stepOf = (s) => {
    const req = s.req || s;
    return { action: `${s.name ? s.name + ': ' : ''}${req.method || 'GET'} ${req.url || ''}`.trim(), data: req.body ? String(req.body).slice(0, 2000) : '', result: checkText(req) || 'status eq 200' };
  };
  let cases = Array.isArray(api.cases) ? api.cases : [];
  if (!cases.length && api.req && api.req.url) cases = [{ id: 'api-1', name: api.req.name || `${api.req.method} ${api.req.url}`, steps: [{ req: api.req }] }];
  return cases.map((c, i) => ({
    id: `API-${String(i + 1).padStart(2, '0')}`, type: 'manual', summary: c.name || c.id, priority: 'Medium', labels: 'api',
    requirements: '', folder: '/API', precondition: '', steps: (c.steps || []).map(stepOf), scenario: '', definition: '',
  }));
}

/* ---------------------------------------------------------------- import guide (port of import_guide, EN) */
export function importGuide(spec, target) {
  const p = spec.project;
  const base = target === 'cloud' ? 'https://xray.cloud.getxray.app/api/v2' : 'https://YOUR-JIRA/rest/raven';
  const auth = target === 'cloud' ? '-H "Authorization: Bearer $XRAY_TOKEN"' : '-H "Authorization: Bearer $JIRA_PAT"';
  const featUrl = target === 'cloud' ? `${base}/import/feature?projectKey=${p}` : `${base}/1.0/import/feature?projectKey=${p}`;
  const execUrl = target === 'cloud' ? `${base}/import/execution` : `${base}/2.0/import/execution`;
  const title = target === 'cloud' ? 'Xray Cloud' : 'Xray Server / Data Center';
  const login = target === 'cloud'
    ? `# get a token (valid 24 h)\nexport XRAY_TOKEN=$(curl -s -H "Content-Type: application/json" -X POST --data '{"client_id":"'$XRAY_CLIENT_ID'","client_secret":"'$XRAY_CLIENT_SECRET'"}' ${base}/authenticate | tr -d '"')`
    : '# JIRA_PAT = a Jira personal access token (Profile › Personal Access Tokens)';
  const tests = spec.tests || [];
  const nCsv = tests.filter((t) => t.type === 'manual').length;
  const files = featureFiles(spec);
  const nFeat = files.reduce((a, f) => a + f.count, 0);
  const ex = executionJson(spec, target);
  const g = [`# Import guide · ${title} · project ${p}`, ''];
  let step = 1;
  if (nCsv) {
    g.push(`## ${step++}. Manual tests (${nCsv}) · \`tests.csv\``, '', 'Jira › Xray › **Test Case Importer** › CSV. Delimiter `,`, encoding UTF-8. Tick **Create folders** if the repository folders don\'t exist yet.', '',
      '| CSV column | Map to |', '|---|---|', '| Test ID | Test Case Identifier (groups the step rows of one test) |', '| Summary | Summary |', '| Description | Description |',
      '| Test Type | Test Type |', '| Priority | Priority |', '| Test Repository Path | Test Repository Path |', '| Requirement (each column) | Link "Tests" |', '| Labels (each column) | Labels |',
      `| Action · Data · Expected Result | ${target === 'cloud' ? 'Action · Data · Expected Result' : 'Step · Data · Expected Result (named Action in recent versions) *to confirm on your version*'} |`, '',
      'Save the mapping as a configuration file at the end: next imports take one click.', '');
  }
  if (nFeat) {
    g.push(`## ${step++}. Cucumber tests (${nFeat} in ${files.length} file${files.length > 1 ? 's' : ''}) · \`features/\``, '',
      'Each `.feature` file is tagged with its requirement key, so Xray links the tests to the story. A `Background` becomes a Precondition. Scenarios tagged with an existing test key update that test.', '',
      '```bash', login, ...files.map((f) => `curl -H "Content-Type: multipart/form-data" ${auth} -F "file=@features/${f.name}" "${featUrl}"`), '```', '',
      'No API access? Zip the `features` folder and use **Import Cucumber Tests** in the Xray menu.', '');
  }
  if (ex && ex.tests.length) {
    g.push(`## ${step++}. Execution results (${ex.tests.length} tests) · \`results-${target}.json\``, '', `Statuses use the ${title} vocabulary (${Object.values(STATUS[target]).join(', ')}). Tests without a key are created by this import.`, '');
    const dup = (spec.execution.results || []).filter((r) => { const t = tests.find((x) => x.id === r.test); return t && !t.key && (t.type === 'manual' || t.type === 'cucumber'); }).map((r) => r.test);
    if (dup.length && (nCsv || nFeat)) g.push(`> **Avoid duplicates.** ${dup.join(', ')} are also in the files above but have no Jira key yet. Pick one route: **(A)** import the tests first, copy the keys Xray gives them into the tool (Key), then import the results; or **(B)** skip the steps above and let the results file create the tests with their results in one go.`, '');
    g.push('```bash', ...(nFeat ? [] : [login]), `curl -H "Content-Type: application/json" ${auth} --data @results-${target}.json "${execUrl}"`, '```', '', 'Then check the Test Execution in Jira: every test listed, statuses right, defects linked.', '');
  }
  g.push('## Before importing', '', `- Requirement keys and project \`${p}\` exist and you can create Test issues in it.`, '- Try with 2 or 3 tests first, check them in Jira, then import the rest.',
    '- Never paste a token or secret into a file you share: use environment variables as above.', '- Fields marked *to confirm* (bulk test JSON, Server / DC step column) were not verified against a live Xray: check them on one real import.', '');
  return g.join('\n');
}
