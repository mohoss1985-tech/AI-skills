/* PRD builder (writing-prds), owner H.
   Command bar: Problem · Users · Goal metric · Scope → "Build draft" fills the empty sections (G1, M1, FR-1…).
   Config pane: section editor (problem, users, goals and non-goals, metrics, requirements, out of scope, risks,
   open questions) as editable grids. Results pane: live trace meter (every goal ≥ 1 requirement and ≥ 1 metric,
   orphan requirements flagged), checks, trace matrix, offline critique, preview. Works with no AI and no network. */
import { register, getLang, colon } from '../../core/i18n.js';
import { renderMarkdown } from '../../core/markdown.js';
import strings from './i18n.js';
import SAMPLES from './samples.js';
import { buildDraft, critique, emptyState, meter, nextId, parseIds, PREFIX, PRIORITIES, METRIC_TYPES, RISK_TYPES, toMarkdown, traceMatrix } from './logic.js';
import { checkItem, debounce, fileBase, makeT, sectionHead, wordDoc } from './shared.js';
import { draftPrompt, critiquePrompt, applyAiDraft } from './ai.js';

register('prd-builder', strings);
const TT = makeT(strings);
const T = TT.ui;
const docT = (s) => TT.doc(s.lang);
const md = (s) => toMarkdown(s, docT(s));

const SECTIONS = ['problem', 'users', 'goals', 'metrics', 'reqs', 'scope', 'risks', 'questions'];
const TONE = { ready: 'ok', fixes: 'warn', 'not-ready': 'bad' };

function counts(s) {
  return { problem: '', users: s.personas.length, goals: s.goals.length, metrics: s.metrics.length, reqs: s.reqs.length, scope: s.nonGoals.length, risks: s.risks.length, questions: s.questions.length };
}

function mount(el, ctx) {
  const { ui, frame } = ctx;
  const st = () => ctx.state;
  if (!Array.isArray(st().goals)) ctx.setState(emptyState(getLang()), { silent: true, replace: true });

  /* ---- command bar: the four required inputs */
  const taProblem = ui.textarea({ value: st().problem, rows: 2, placeholder: T('in.problem.ph'), onInput: (v) => ctx.setState({ problem: v }) });
  const inUsers = ui.input({ value: st().users, placeholder: T('in.users.ph'), onInput: (v) => ctx.setState({ users: v }) });
  const inGoal = ui.input({ value: st().goalMetric, placeholder: T('in.goal.ph'), onInput: (v) => ctx.setState({ goalMetric: v }) });
  const taScope = ui.textarea({ value: st().scope, rows: 2, placeholder: T('in.scope.ph'), onInput: (v) => ctx.setState({ scope: v }) });
  const fProblem = frame.bindField('problem', ui.field({ label: T('in.problem'), help: T('in.problem.help'), input: taProblem, required: true }));
  const fUsers = frame.bindField('users', ui.field({ label: T('in.users'), help: T('in.users.help'), input: inUsers, required: true }));
  const fGoal = frame.bindField('goalMetric', ui.field({ label: T('in.goal'), help: T('in.goal.help'), input: inGoal, required: true }));
  const fScope = ui.field({ label: T('in.scope'), help: T('in.scope.help'), input: taScope });
  fProblem.classList.add('h-wide'); fScope.classList.add('h-wide');
  frame.command.append(fProblem, fUsers, fGoal, fScope);

  /* ---- Advanced: document metadata + notes for "Draft from my notes" */
  const advBody = document.createElement('div');
  advBody.className = 'h-adv-grid';
  const advKeys = ['title', 'owner', 'deadline', 'status', 'lang', 'notes'];
  const advCount = () => advKeys.filter((k) => k === 'status' ? st().status !== 'draft' : k === 'lang' ? false : String(st()[k] || '').trim()).length;
  const adv = ui.advanced({ body: advBody, count: 0 });
  const advField = (key, label, control) => { advBody.append(ui.field({ label, input: control })); };
  advField('title', T('adv.title'), ui.input({ value: st().title, onInput: (v) => { ctx.setState({ title: v }); adv.setCount(advCount()); } }));
  advField('owner', T('adv.owner'), ui.input({ value: st().owner, onInput: (v) => { ctx.setState({ owner: v }); adv.setCount(advCount()); } }));
  advField('deadline', T('adv.deadline'), ui.input({ value: st().deadline, onInput: (v) => { ctx.setState({ deadline: v }); adv.setCount(advCount()); } }));
  advField('status', T('adv.status'), ui.select({ value: st().status, options: ['draft', 'review', 'approved'].map((v) => ({ value: v, label: T('status.' + v) })), onChange: (v) => { ctx.setState({ status: v }); adv.setCount(advCount()); } }));
  advField('lang', T('adv.lang'), ui.segmented({ value: st().lang || 'en', options: [{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }], label: T('adv.lang'), onChange: (v) => ctx.setState({ lang: v }) }));
  const notes = ui.textarea({ value: st().notes || '', rows: 4, placeholder: T('ai.notes'), onInput: (v) => { ctx.setState({ notes: v }); adv.setCount(advCount()); } });
  const nf = ui.field({ label: T('ai.notes'), help: T('ai.draft'), input: notes, optional: true });
  nf.classList.add('h-span2');
  advBody.append(nf);
  adv.setCount(advCount());

  /* ---- AI draft banner (state.ai.draft written by `kit.py patch`) */
  const aiBox = document.createElement('div');
  const paintAi = () => {
    aiBox.replaceChildren();
    const d = st().ai && st().ai.draft;
    if (!d || typeof d !== 'object') return;
    aiBox.className = 'h-ai-banner';
    const p = document.createElement('p'); p.textContent = T('aiDraft.ready');
    aiBox.append(ui.badge({ text: T('aiDraft.badge'), tone: 'accent', icon: 'sparkles' }), p,
      ui.button({ label: T('aiDraft.apply'), size: 'sm', variant: 'primary', onClick: () => { ctx.setState(applyAiDraft(st())); paintSections(); } }),
      ui.button({ label: T('aiDraft.dismiss'), size: 'sm', variant: 'ghost', onClick: () => { const ai = { ...(st().ai || {}) }; delete ai.draft; ctx.setState({ ai }); paintAi(); } }));
  };

  /* ---- section editor (tabs with counts) */
  const host = document.createElement('div');
  host.className = 'h-sections';
  let activeTab = 'reqs';
  let tabsEl = null;

  const P = () => PREFIX[st().lang] || PREFIX.en;
  const goalOpts = () => [{ value: '', label: '—' }, ...st().goals.map((g) => ({ value: g.id, label: g.id }))];
  const setList = (key) => (rows) => { ctx.setState({ [key]: rows }); if (tabsEl) tabsEl.setCount(tabOf(key), counts(st())[tabOf(key)] || ''); };
  const tabOf = (key) => ({ personas: 'users', nonGoals: 'scope' }[key] || key);

  function panelFor(id) {
    const s = st();
    const wrap = document.createElement('div');
    wrap.className = 'h-panel';
    if (id === 'problem') {
      const tl = ui.textarea({ value: s.tldr, rows: 3, onInput: (v) => ctx.setState({ tldr: v }) });
      const ev = ui.textarea({ value: s.evidence, rows: 3, onInput: (v) => ctx.setState({ evidence: v }) });
      const pr = ui.textarea({ value: s.problem, rows: 5, onInput: (v) => { ctx.setState({ problem: v }); taProblem.value = v; } });
      wrap.append(ui.field({ label: T('sec.problem'), help: T('in.problem.help'), input: pr }), ui.field({ label: T('sec.evidence'), input: ev, optional: true }), ui.field({ label: T('sec.tldr'), input: tl, optional: true }));
    } else if (id === 'users') {
      wrap.append(ui.grid({ columns: [{ key: 'name', label: T('col.persona'), width: '28%' }, { key: 'job', label: T('col.job') }], rows: s.personas, removable: true, addLabel: T('add.persona'), newRow: () => ({ name: '', job: '' }), onChange: setList('personas') }));
    } else if (id === 'goals') {
      wrap.append(ui.grid({ columns: [{ key: 'id', label: T('col.id'), width: 72, mono: true }, { key: 'text', label: T('col.goalText') }], rows: s.goals, removable: true, addLabel: T('add.goal'),
        newRow: (rows) => ({ id: nextId(rows.map((r) => r.id), P().goal), text: '' }), onChange: (rows) => { setList('goals')(rows); } }));
      const ng = ui.grid({ columns: [{ key: 'text', label: T('col.nonGoal') }], rows: s.nonGoals.map((text) => ({ text })), removable: true, addLabel: T('add.nonGoal'), newRow: () => ({ text: '' }), onChange: (rows) => setList('nonGoals')(rows.map((r) => r.text)) });
      wrap.append(sectionHead(T('md.nonGoals')), ng);
    } else if (id === 'metrics') {
      wrap.append(ui.grid({ columns: [
        { key: 'id', label: T('col.id'), width: 56, mono: true }, { key: 'name', label: T('col.metric') },
        { key: 'type', label: T('col.type'), type: 'select', width: 120, options: METRIC_TYPES.map((v) => ({ value: v, label: T('mtype.' + v) })) },
        { key: 'baseline', label: T('col.baseline'), width: 120 }, { key: 'target', label: T('col.target'), width: 140 },
        { key: 'how', label: T('col.how'), width: 150 }, { key: 'goal', label: T('col.goal'), type: 'select', width: 76, options: goalOpts() },
      ], rows: s.metrics, removable: true, addLabel: T('add.metric'), newRow: (rows) => ({ id: nextId(rows.map((r) => r.id), P().metric), name: '', type: 'primary', baseline: '', target: '', how: '', goal: '' }), onChange: setList('metrics') }));
    } else if (id === 'reqs') {
      wrap.append(ui.grid({ columns: [
        { key: 'id', label: T('col.id'), width: 64, mono: true }, { key: 'text', label: T('col.req') },
        { key: 'priority', label: T('col.priority'), type: 'select', width: 96, options: PRIORITIES },
        { key: 'goal', label: T('col.goal'), type: 'select', width: 76, options: goalOpts() }, { key: 'notes', label: T('col.notes'), width: 160 },
      ], rows: s.reqs, removable: true, addLabel: T('add.req'), newRow: (rows) => ({ id: nextId(rows.map((r) => r.id), P().req), text: '', priority: 'Must', goal: '', notes: '' }), onChange: setList('reqs') }));
    } else if (id === 'scope') {
      wrap.append(ui.grid({ columns: [{ key: 'text', label: T('col.nonGoal') }], rows: s.nonGoals.map((text) => ({ text })), removable: true, addLabel: T('add.nonGoal'), newRow: () => ({ text: '' }), onChange: (rows) => setList('nonGoals')(rows.map((r) => r.text)) }));
    } else if (id === 'risks') {
      wrap.append(ui.grid({ columns: [
        { key: 'type', label: T('col.type'), type: 'select', width: 130, options: RISK_TYPES.map((v) => ({ value: v, label: T('rtype.' + v) })) },
        { key: 'item', label: T('col.item') }, { key: 'mitigation', label: T('col.mitigation') },
      ], rows: s.risks, removable: true, addLabel: T('add.risk'), newRow: () => ({ type: 'risk', item: '', mitigation: '' }), onChange: setList('risks') }));
    } else if (id === 'questions') {
      wrap.append(ui.grid({ columns: [{ key: 'q', label: T('col.question') }, { key: 'owner', label: T('col.owner'), width: 140 }, { key: 'due', label: T('col.due'), width: 100 }],
        rows: s.questions, removable: true, addLabel: T('add.question'), newRow: () => ({ q: '', owner: '', due: '' }), onChange: setList('questions') }));
    }
    return wrap;
  }

  function paintSections(tab = activeTab) {
    activeTab = tab;
    const c = counts(st());
    const panels = Object.fromEntries(SECTIONS.map((id) => [id, panelFor(id)]));
    tabsEl = ui.tabs({ tabs: SECTIONS.map((id) => ({ id, label: T('sec.' + id), count: c[id] || '' })), active: tab, panels, onChange: (id) => {
      activeTab = id;
      // goal options in the grids depend on the goals list: rebuild the panel when it is opened
      const p = tabsEl.querySelector(`[role="tabpanel"]:not([hidden])`);
      if (p && (id === 'metrics' || id === 'reqs')) p.replaceChildren(panelFor(id));
    } });
    host.replaceChildren(tabsEl);
  }
  ctx._prdShow = (tab) => { paintSections(tab); host.scrollIntoView({ block: 'nearest' }); };

  el.append(adv, aiBox, host);
  paintAi();
  paintSections();
  paintResults(ctx);
}

/* ---------------------------------------------------------------------------------------------- results pane */
function paintResults(ctx) {
  const { ui, frame } = ctx;
  const s = ctx.state;
  const out = frame.output;
  if (!s.built && !s.goals.length && !s.reqs.length) {
    frame.setStatus(null);
    out.replaceChildren(ui.emptyState({ icon: 'gauge', title: T('empty.title'), text: T('empty.body'),
      action: { label: T('run'), onClick: () => frame.runNow(), kbd: ui.kbdLabel('mod+enter') },
      sample: { label: T('sample.load'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } }));
    return;
  }
  const m = meter(s);
  frame.setStatus({ tone: TONE[m.verdict], text: `${T('meter.pct', { pct: m.pct })} · ${T('verdict.' + m.verdict)}` });

  const box = document.createElement('div');
  box.className = 'h-results';
  // meter: one segment per trace check, filled when it passes
  const meterBox = document.createElement('section');
  meterBox.className = 'h-meter';
  meterBox.setAttribute('aria-label', T('meter.title'));
  const top = document.createElement('div'); top.className = 'h-meter-top';
  const big = document.createElement('div'); big.className = 'h-meter-pct num'; big.textContent = `${m.pct} %`;
  const lab = document.createElement('div'); lab.className = 'h-meter-label';
  const l1 = document.createElement('b'); l1.textContent = T('meter.title');
  const l2 = document.createElement('span'); l2.textContent = `${T('meter.goals', { ok: m.goalsOk, n: m.goals })} · ${T('meter.orphans', { n: m.orphans })}`;
  lab.append(l1, l2);
  top.append(big, lab, ui.badge({ text: T('verdict.' + m.verdict), tone: TONE[m.verdict], icon: m.verdict === 'ready' ? 'circle-check' : m.verdict === 'fixes' ? 'triangle-alert' : 'circle-x' }));
  const bar = document.createElement('div'); bar.className = 'h-meter-bar'; bar.setAttribute('role', 'meter');
  bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '100'); bar.setAttribute('aria-valuenow', String(m.pct));
  bar.setAttribute('aria-valuetext', T('meter.checks', { ok: m.okTrace, n: m.totalTrace }));
  m.checks.filter((c) => c.trace).forEach((c) => { const seg = document.createElement('span'); seg.className = 'h-seg ' + (c.ok ? 'is-ok' : 'is-bad'); seg.title = T(c.key, c.vars); bar.append(seg); });
  meterBox.append(top, bar);
  box.append(meterBox);

  // tabs: Checks · Trace · Critique · Preview
  const failing = m.checks.filter((c) => !c.ok);
  const checksP = document.createElement('div');
  const ul = document.createElement('ul'); ul.className = 'h-checks';
  failing.forEach((c) => ul.append(checkItem(ui, { ok: false, level: c.level, text: T(c.key, c.vars), onClick: () => ctx._prdShow && ctx._prdShow(c.section) })));
  ul.append(checkItem(ui, { ok: true, text: T('checks.passed', { n: m.checks.length - failing.length, total: m.checks.length }) }));
  checksP.append(ul);

  const traceP = document.createElement('div');
  const tm = traceMatrix(s);
  traceP.append(ui.table({ columns: [
    { key: 'goal', label: T('col.goal'), mono: true, width: 64 }, { key: 'text', label: T('col.goalText') },
    { key: 'reqs', label: T('col.reqs'), mono: true }, { key: 'metrics', label: T('col.metrics'), mono: true },
    { key: 'ok', label: T('col.state'), format: (v) => ui.badge({ text: v ? T('trace.ok') : T('trace.gap'), tone: v ? 'ok' : 'bad', icon: v ? 'check' : 'x' }) },
  ], rows: tm.rows.map((r) => ({ goal: r.goal.id, text: r.goal.text, reqs: r.reqs.join(', ') || '—', metrics: r.metrics.join(', ') || '—', ok: !!(r.reqs.length && r.metrics.length) })), empty: T('meter.empty') }));
  if (tm.orphanReqs.length) {
    const p = document.createElement('p'); p.className = 'h-note';
    p.append(ui.icon('triangle-alert', { size: 14 }), document.createTextNode(` ${T('md.orphans')}${colon()}${tm.orphanReqs.map((r) => `${r.id} ${r.text}`).join(' · ')}`));
    traceP.append(p);
  }

  const critP = document.createElement('div');
  const crit = critique(s, T);
  if (!crit.length) { const p = document.createElement('p'); p.className = 'h-note'; p.textContent = T('critique.none'); critP.append(p); }
  else critP.append(ui.table({ columns: [{ key: 'section', label: T('col.section'), width: 120 }, { key: 'issue', label: T('col.issue') }, { key: 'why', label: T('col.why') }, { key: 'fix', label: T('col.fix') }], rows: crit }));
  const verdictP = document.createElement('p'); verdictP.className = 'h-verdict';
  verdictP.textContent = `${T('critique.verdict')}${colon()}${T('verdict.' + m.verdict)}`;
  critP.append(verdictP);

  const prevP = document.createElement('div'); prevP.className = 'h-preview markdown';
  renderMarkdown(prevP, md(s)).catch(() => { prevP.textContent = md(s); });

  const resTabs = ui.tabs({ tabs: [
    { id: 'checks', label: T('tab.checks'), count: failing.length || '' }, { id: 'trace', label: T('tab.trace') },
    { id: 'critique', label: T('critique.title'), count: crit.length || '' }, { id: 'preview', label: T('tab.preview') },
  ], active: ctx._prdResTab || 'checks', panels: { checks: checksP, trace: traceP, critique: critP, preview: prevP }, onChange: (id) => { ctx._prdResTab = id; } });
  box.append(resTabs);
  out.replaceChildren(box);
}

/* ---------------------------------------------------------------------------------------------- module */
const sample = (x) => ({ id: x.id, label: x.label, hint: T('sample.hint'), state: (({ id, label, ...rest }) => rest)(x) });

export default {
  id: 'prd-builder',
  skill: 'writing-prds',
  icon: 'file-text',
  title: { en: strings.en.title, fr: strings.fr.title },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'gauge' },
  layout: 'split',
  schema: 1,
  defaults: () => emptyState(getLang()),
  samples: { en: SAMPLES.en.map(sample), fr: SAMPLES.fr.map(sample) },
  mount,
  update: debounce((state, ctx) => paintResults(ctx), 150),
  validate(s) {
    const e = [];
    if (String(s.problem || '').trim().length < 10) e.push({ field: 'problem', message: T('err.problem') });
    if (!String(s.users || '').trim() && !s.personas.length) e.push({ field: 'users', message: T('err.users') });
    if (!String(s.goalMetric || '').trim() && !s.goals.length) e.push({ field: 'goalMetric', message: T('err.goal') });
    return e;
  },
  run(state, ctx) {
    const next = buildDraft(state);
    ctx.setState(next, { silent: true, replace: true });
    ctx.frame.remount();
    return meter(next);
  },
  renderResult(r, ctx) { paintResults(ctx); },
  status: (m) => ({ tone: TONE[m.verdict], text: `${T('meter.pct', { pct: m.pct })} · ${T('verdict.' + m.verdict)}` }),
  toMarkdown: (state) => md(state),
  exports: [
    { id: 'word', label: { en: strings.en['exp.word'], fr: strings.fr['exp.word'] }, build: async (s) => ({ name: fileBase(s.title || 'prd') + '.doc', mime: 'application/msword', text: await wordDoc(s.title || 'PRD', md(s)) }) },
    { id: 'epic-csv', label: { en: strings.en['exp.csv'], fr: strings.fr['exp.csv'] }, build: (s) => ({ name: fileBase(s.title || 'prd') + '-jira.csv', mime: 'text/csv', text: epicCsv(s) }) },
  ],
  aiActions: [
    { id: 'draft', label: { en: strings.en['ai.draft'], fr: strings.fr['ai.draft'] }, expects: 'json', prompt: (s) => draftPrompt(s) },
    { id: 'critique', label: { en: strings.en['ai.critique'], fr: strings.fr['ai.critique'] }, expects: 'markdown', prompt: (s) => critiquePrompt(s, md(s)) },
  ],
};

/** Jira CSV: one Epic (the PRD) + one Story per requirement, Parent = the epic summary (map it in the import wizard). */
function epicCsv(s) {
  const cell = (v) => { const x = v == null ? '' : String(v); return /[",\n\r;]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  const prio = { Must: 'High', Should: 'Medium', Could: 'Low', "Won't": 'Lowest' };
  const rows = [['Summary', 'Issue Type', 'Description', 'Priority', 'Labels', 'Parent']];
  const title = s.title || 'PRD';
  rows.push([title, 'Epic', [s.tldr || s.problem, '', ...s.goals.map((g) => `${g.id}: ${g.text}`)].join('\n'), 'High', 'prd', '']);
  for (const r of s.reqs) rows.push([`${r.id} ${r.text}`.slice(0, 250), 'Story', `${r.text}\n\nGoal: ${parseIds(r.goal).join(', ') || '—'}${r.notes ? `\n${r.notes}` : ''}`, prio[r.priority] || 'Medium', 'prd', title]);
  return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
}
