/* SFD builder (writing-functional-specs), owner H.
   Command bar: Feature · Business rules · Fields → "Build tables" numbers the rules RG-01… and parses the fields.
   Config pane: rules table, field list (name · type · mandatory · validation · source · rule), screens and flow,
   messages, stories to trace, NFR, open points. Results pane: checks, rule × story traceability matrix with fields
   and test ideas, review box, preview. Exports: Markdown, Word, rules CSV (for Xray / UAT). No AI needed. */
import { register, getLang } from '../../core/i18n.js';
import { renderMarkdown } from '../../core/markdown.js';
import strings from './i18n.js';
import SAMPLES from './samples.js';
import { buildTables, emptyState, msgId, nextNum, parseIds, review, rgId, rulesCsv, testIdeas, toMarkdown, traceMatrix, TYPES } from './logic.js';
import { checkItem, debounce, fileBase, makeT, sectionHead, wordDoc } from '../prd-builder/shared.js';

register('sfd-builder', strings);
const TT = makeT(strings);
const T = TT.ui;
const docT = (s) => TT.doc(s.lang);
const md = (s) => toMarkdown(s, docT(s));
const TONE = { ready: 'ok', fixes: 'warn', 'not-ready': 'bad' };
const TABS = ['rules', 'fields', 'screens'];

function mount(el, ctx) {
  const { ui, frame } = ctx;
  const st = () => ctx.state;
  if (!Array.isArray(st().rules)) ctx.setState(emptyState(getLang()), { silent: true, replace: true });

  /* ---- command bar */
  const fF = frame.bindField('feature', ui.field({ label: T('in.feature'), help: T('in.feature.help'), required: true, input: ui.input({ value: st().feature, placeholder: T('in.feature.ph'), onInput: (v) => ctx.setState({ feature: v }) }) }));
  const fR = frame.bindField('rulesText', ui.field({ label: T('in.rules'), help: T('in.rules.help'), required: true, input: ui.textarea({ value: st().rulesText, rows: 3, placeholder: T('in.rules.ph'), onInput: (v) => ctx.setState({ rulesText: v }) }) }));
  const fL = frame.bindField('fieldsText', ui.field({ label: T('in.fields'), help: T('in.fields.help'), input: ui.textarea({ value: st().fieldsText, rows: 3, mono: true, placeholder: T('in.fields.ph'), onInput: (v) => ctx.setState({ fieldsText: v }) }) }));
  frame.command.append(fF, fR, fL);

  /* ---- Advanced: document control, context, scope */
  const advBody = document.createElement('div'); advBody.className = 'h-adv-grid';
  const adv = ui.advanced({ body: advBody });
  const advKeys = ['version', 'author', 'reviewers', 'context', 'scopeIn', 'scopeOut'];
  const advCount = () => advKeys.filter((k) => String(st()[k] || '').trim() && !(k === 'version' && st()[k] === '0.1')).length + (st().status !== 'draft' ? 1 : 0) + (st().level !== 'SFD' ? 1 : 0);
  const upd = (k) => (v) => { ctx.setState({ [k]: v }); adv.setCount(advCount()); };
  advBody.append(
    ui.field({ label: T('adv.level'), input: ui.segmented({ value: st().level, label: T('adv.level'), options: [{ value: 'SFD', label: T('lvl.SFD') }, { value: 'SFG', label: T('lvl.SFG') }], onChange: upd('level') }) }),
    ui.field({ label: T('adv.lang'), input: ui.segmented({ value: st().lang || 'en', label: T('adv.lang'), options: [{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }], onChange: upd('lang') }) }),
    ui.field({ label: T('adv.version'), input: ui.input({ value: st().version, mono: true, onInput: upd('version') }) }),
    ui.field({ label: T('adv.status'), input: ui.select({ value: st().status, options: ['draft', 'review', 'approved'].map((v) => ({ value: v, label: T('status.' + v) })), onChange: upd('status') }) }),
    ui.field({ label: T('adv.author'), input: ui.input({ value: st().author, onInput: upd('author') }) }),
    ui.field({ label: T('adv.reviewers'), input: ui.input({ value: st().reviewers, onInput: upd('reviewers') }) }),
  );
  for (const k of ['context', 'scopeIn', 'scopeOut']) { const f = ui.field({ label: T('adv.' + k), input: ui.textarea({ value: st()[k], rows: 2, onInput: upd(k) }) }); f.classList.add('h-span2'); advBody.append(f); }
  adv.setCount(advCount());

  const host = document.createElement('div'); host.className = 'h-sections';
  el.append(adv, host);
  let active = 'rules', tabsEl = null;

  const setList = (key) => (rows) => { ctx.setState({ [key]: rows }); if (tabsEl && TABS.includes(key)) tabsEl.setCount(key, rows.length || ''); };
  const ruleOpts = () => [{ value: '', label: '—' }, ...st().rules.map((r) => ({ value: r.id, label: r.id }))];
  const screenOpts = () => [{ value: '', label: '—' }, ...st().screens.map((r) => ({ value: r.id, label: r.id }))];

  function panel(id) {
    const s = st();
    const w = document.createElement('div'); w.className = 'h-panel';
    if (id === 'rules') {
      w.append(ui.grid({ columns: [
        { key: 'id', label: T('col.id'), width: 72, mono: true }, { key: 'text', label: T('col.rule') }, { key: 'example', label: T('col.example'), width: '24%' },
        { key: 'source', label: T('col.source'), width: 130 }, { key: 'msg', label: T('col.msg'), width: 84, mono: true }, { key: 'stories', label: T('col.stories'), width: 84, mono: true },
      ], rows: s.rules, removable: true, addLabel: T('add.rule'), newRow: (rows) => ({ id: rgId(nextNum(rows.map((r) => r.id))), text: '', example: '', source: '', msg: '', stories: '' }), onChange: setList('rules') }));
    } else if (id === 'fields') {
      w.append(ui.grid({ columns: [
        { key: 'screen', label: T('col.screen'), type: 'select', width: 84, options: screenOpts() }, { key: 'name', label: T('col.field'), width: '18%' },
        { key: 'type', label: T('col.type'), type: 'select', width: 120, options: TYPES.map((v) => ({ value: v, label: T('type.' + v) })) },
        { key: 'mandatory', label: T('col.mandatory'), type: 'check', width: 84 }, { key: 'validation', label: T('col.validation') },
        { key: 'source', label: T('col.fsource'), width: 120 }, { key: 'rule', label: T('col.rg'), type: 'select', width: 88, options: ruleOpts() },
      ], rows: s.fields, removable: true, addLabel: T('add.field'), newRow: () => ({ screen: s.screens[0] ? s.screens[0].id : '', name: '', type: 'text', mandatory: false, validation: '', source: '', rule: '' }), onChange: setList('fields') }));
    } else {
      w.append(sectionHead(T('sec.screens')), ui.grid({ columns: [{ key: 'id', label: T('col.id'), width: 72, mono: true }, { key: 'name', label: T('col.name') }, { key: 'purpose', label: T('col.purpose') }],
        rows: s.screens, removable: true, addLabel: T('add.screen'), newRow: (rows) => ({ id: `E-${String(nextNum(rows.map((r) => r.id))).padStart(2, '0')}`, name: '', purpose: '' }), onChange: setList('screens') }));
      const flow = ui.field({ label: T('f.flow'), help: T('f.flow.help'), input: ui.textarea({ value: s.flow, rows: 5, onInput: (v) => ctx.setState({ flow: v }) }) });
      const err = ui.field({ label: T('f.errorPath'), optional: true, input: ui.textarea({ value: s.errorPath, rows: 2, onInput: (v) => ctx.setState({ errorPath: v }) }) });
      w.append(flow, err, sectionHead(T('sec.messages')), ui.grid({ columns: [{ key: 'id', label: T('col.id'), width: 84, mono: true }, { key: 'when', label: T('col.when'), width: '28%' }, { key: 'text', label: T('col.text') }],
        rows: s.messages, removable: true, addLabel: T('add.message'), newRow: (rows) => ({ id: msgId(nextNum(rows.map((r) => r.id))), when: '', text: '' }), onChange: setList('messages') }));
      const sh = sectionHead(T('sec.stories'));
      const help = document.createElement('p'); help.className = 'h-note'; help.textContent = T('sec.stories.help');
      w.append(sh, help, ui.grid({ columns: [{ key: 'id', label: T('col.id'), width: 72, mono: true }, { key: 'title', label: T('col.title') }],
        rows: s.stories, removable: true, addLabel: T('add.story'), newRow: (rows) => ({ id: 'S' + nextNum(rows.map((r) => r.id)), title: '' }), onChange: setList('stories') }));
      w.append(ui.field({ label: T('f.nfr'), help: T('f.nfr.help'), optional: true, input: ui.textarea({ value: s.nfr, rows: 3, onInput: (v) => ctx.setState({ nfr: v }) }) }));
      w.append(sectionHead(T('sec.open')), ui.grid({ columns: [{ key: 'q', label: T('col.question') }, { key: 'owner', label: T('col.owner'), width: 140 }, { key: 'due', label: T('col.due'), width: 100 }],
        rows: s.openPoints, removable: true, addLabel: T('add.open'), newRow: () => ({ q: '', owner: '', due: '' }), onChange: setList('openPoints') }));
    }
    return w;
  }

  function paint(tab = active) {
    active = tab;
    const s = st();
    if (!s.built && !s.rules.length) {
      host.replaceChildren(ui.emptyState({ icon: 'table', title: T('empty.title'), text: T('empty.body'), action: { label: T('run'), onClick: () => frame.runNow(), kbd: ui.kbdLabel('mod+enter') },
        sample: { label: T('sample.load'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } }));
      return;
    }
    const n = { rules: s.rules.length, fields: s.fields.length, screens: s.screens.length };
    tabsEl = ui.tabs({ tabs: TABS.map((id) => ({ id, label: T('tab.' + id), count: n[id] || '' })), active: tab, panels: Object.fromEntries(TABS.map((id) => [id, panel(id)])),
      onChange: (id) => { active = id; const p = tabsEl.querySelector('[role="tabpanel"]:not([hidden])'); if (p && id === 'fields') p.replaceChildren(panel(id)); } });
    host.replaceChildren(tabsEl);
  }
  ctx._sfdShow = (where) => paint(where === 'trace' ? 'screens' : TABS.includes(where) ? where : 'rules');
  ctx._sfdPaint = () => paint();
  paint();
  paintResults(ctx);
}

/* ---------------------------------------------------------------------------------------------- results */
function statusOf(rv) {
  return { tone: TONE[rv.verdict], text: `${T('verdict.' + rv.verdict)} · ${T('meta.rules', { n: rv.rules })} · ${T('meta.traced', { n: rv.traced, t: rv.rules })}` };
}

function paintResults(ctx) {
  const { ui, frame } = ctx;
  const s = ctx.state;
  if (!s.built && !s.rules.length) { frame.setStatus(null); frame.output.replaceChildren(ui.emptyState({ icon: 'list-ordered', title: T('empty.title'), text: T('empty.body') })); return; }
  const rv = review(s);
  frame.setStatus(statusOf(rv));

  const box = document.createElement('div'); box.className = 'h-results';
  const stats = document.createElement('div'); stats.className = 'sfd-stats';
  const stat = (n, label) => { const d = document.createElement('div'); d.className = 'sfd-stat'; const b = document.createElement('b'); b.className = 'num'; b.textContent = n; const sp = document.createElement('span'); sp.textContent = label; d.append(b, sp); return d; };
  stats.append(stat(rv.rules, T('stat.rules')), stat(rv.fields, T('stat.fields')), stat(`${rv.traced}/${rv.rules}`, T('stat.traced')), stat(`${rv.withEx}/${rv.rules}`, T('stat.examples')), stat(rv.confirm, T('meta.confirmShort')));
  box.append(stats);

  const failing = rv.checks.filter((c) => !c.ok);
  const checksP = document.createElement('div');
  const ul = document.createElement('ul'); ul.className = 'h-checks';
  failing.forEach((c) => ul.append(checkItem(ui, { ok: false, level: c.level, text: T(c.key, c.vars), onClick: () => ctx._sfdShow(c.where) })));
  ul.append(checkItem(ui, { ok: true, text: T('checks.passed', { n: rv.checks.length - failing.length, total: rv.checks.length }) }));
  checksP.append(ul);

  // traceability: rows = rules, one column per story (✓), then fields and the test idea
  const traceP = document.createElement('div');
  if (!s.stories.length) { const p = document.createElement('p'); p.className = 'h-note'; p.textContent = T('trace.none'); traceP.append(p); }
  const ideas = testIdeas(s, T);
  const cols = [{ key: 'id', label: T('col.rule'), mono: true, width: 72 },
    ...s.stories.map((x) => ({ key: 'st_' + x.id, label: x.id, align: 'center', width: 56, format: (v) => (v ? ui.badge({ text: '✓', tone: 'ok' }) : '·') })),
    { key: 'fields', label: T('col.fieldsUsing') }, { key: 'test', label: T('col.test') }];
  const rows = traceMatrix(s).map((x, i) => ({ id: x.rule.id, ...Object.fromEntries(s.stories.map((y) => ['st_' + y.id, x.stories.includes(y.id.toUpperCase())])), fields: x.fields.join('; ') || '—', test: ideas[i].idea }));
  traceP.append(ui.table({ columns: cols, rows }));

  const prevP = document.createElement('div'); prevP.className = 'h-preview markdown';
  const text = md(s);
  renderMarkdown(prevP, text).catch(() => { prevP.textContent = text; });

  box.append(ui.tabs({ tabs: [{ id: 'checks', label: T('tab.checks'), count: failing.length || '' }, { id: 'trace', label: T('tab.trace') }, { id: 'preview', label: T('tab.preview') }],
    active: ctx._sfdTab || 'checks', panels: { checks: checksP, trace: traceP, preview: prevP }, onChange: (id) => { ctx._sfdTab = id; } }));
  frame.output.replaceChildren(box);
}

/* ---------------------------------------------------------------------------------------------- AI prompts */
const langLine = (s) => (s.lang === 'fr' ? 'Write in French with the French headings (Suivi du document, Règles de gestion…), Banque Lumière, CB terms.' : 'Write in English, Harbor Bank, Visa terms.');
function prosePrompt(s) {
  return [
    'You are an AMOA business analyst (writing-functional-specs skill, Analyst Kit). Write the full SFD around the tables below:',
    'context, scope, actors and rights, target process with error paths, interfaces (system, direction, trigger, fields, errors and timeouts), NFR, acceptance test ideas (one per rule plus boundary values), open points.',
    'Keep the RG / MSG / E- ids and the tables unchanged; "must" for requirements; no "should ideally", no "etc."; numbers not in the input are marked *(to confirm)*.',
    'End with the review box: number of rules, screens, messages, open points, and the 3 riskiest assumptions. Fictional data, test cards only.', langLine(s), '', '---', md(s),
  ].join('\n');
}
function reviewPrompt(s) {
  const rv = review(s);
  return [
    'Review this functional spec (writing-functional-specs skill, review mode).',
    `Offline checks found: ${rv.checks.filter((c) => !c.ok).map((c) => c.id).join(', ') || 'nothing'}.`,
    'Score each section present / incomplete / missing, then list defects by severity: ambiguous rule, missing error case, untestable statement, contradiction between rules (amounts, dates, statuses), missing field format, untraced requirement.',
    'Give the corrected text for the top 5.', langLine(s), '', '---', md(s),
  ].join('\n');
}

/* ---------------------------------------------------------------------------------------------- module */
const sample = (x) => ({ id: x.id, label: x.label, hint: T('sample.hint'), state: (({ id, label, ...rest }) => rest)(x) });

export default {
  id: 'sfd-builder',
  skill: 'writing-functional-specs',
  icon: 'list-checks',
  title: { en: strings.en.title, fr: strings.fr.title },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'table' },
  layout: 'split',
  schema: 1,
  defaults: () => emptyState(getLang()),
  samples: { en: SAMPLES.en.map(sample), fr: SAMPLES.fr.map(sample) },
  mount,
  update: debounce((state, ctx) => paintResults(ctx), 150),
  validate(s) {
    const e = [];
    if (!String(s.feature || '').trim()) e.push({ field: 'feature', message: T('err.feature') });
    if (!String(s.rulesText || '').trim() && !s.rules.length) e.push({ field: 'rulesText', message: T('err.rules') });
    return e;
  },
  run(state, ctx) {
    const next = buildTables(state);
    ctx.setState(next, { silent: true, replace: true });
    if (ctx._sfdPaint) ctx._sfdPaint();
    return review(next);
  },
  renderResult(r, ctx) { paintResults(ctx); },
  status: (rv) => statusOf(rv),
  toMarkdown: (s) => md(s),
  exports: [
    { id: 'word', label: { en: strings.en['exp.word'], fr: strings.fr['exp.word'] }, build: async (s) => ({ name: fileBase(s.feature || 'sfd') + '.doc', mime: 'application/msword', text: await wordDoc(s.feature || 'SFD', md(s)) }) },
    { id: 'rules-csv', label: { en: strings.en['exp.csv'], fr: strings.fr['exp.csv'] }, build: (s) => ({ name: fileBase(s.feature || 'sfd') + '-rules.csv', mime: 'text/csv', text: rulesCsv(s, docT(s)) }) },
  ],
  aiActions: [
    { id: 'prose', label: { en: strings.en['ai.prose'], fr: strings.fr['ai.prose'] }, expects: 'markdown', prompt: (s) => prosePrompt(s) },
    { id: 'review', label: { en: strings.en['ai.review'], fr: strings.fr['ai.review'] }, expects: 'markdown', prompt: (s) => reviewPrompt(s) },
  ],
};
