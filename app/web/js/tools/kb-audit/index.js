/* KB audit grid (skill curating-knowledge-bases), owner I.
   Command bar: articles · owners · questions (pasteable lists). Body: four tiles (freshness, owner coverage, question
   coverage, backlog), then tabs Articles | Questions | Owners | Actions. Logic = logic.js (node logic.test.mjs). */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { audit, actionsCsv, auditCsv, coverageCsv, DEFAULT_CYCLES, TYPES } from './logic.js';
import { fill, mdTable } from '../mapping-grid/csv.js';

const T = register('kb-audit', strings);
const F = (k, v) => fill(T(k), v);
const nf = (x) => new Intl.NumberFormat(getLang() === 'fr' ? 'fr-FR' : 'en-US').format(x || 0);
const B_TONE = { fresh: 'ok', due: 'info', stale: 'warn', never: 'bad' };
const O_TONE = { ok: 'ok', none: 'bad', unknown: 'warn', left: 'bad' };
const C_TONE = { ok: 'ok', partial: 'warn', stale: 'warn', gap: 'bad', internal: 'bad' };

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}
function actionText(a) {
  if (a.type === 'owner') return F(a.vars.who ? 'a_ownerLeft' : 'a_owner', a.vars);
  if (a.type === 'review' && a.vars.age === '—') return F('a_reviewNever', a.vars);
  return F('a_' + a.type, { ...a.vars, q: a.vars.q });
}
const weekText = (a) => (a.week === 0 ? T('now') : a.week == null ? T('unplanned') : String(a.week));

/* ------------------------------------------------------------------------------------------- markdown */
function toMarkdown(s) {
  const r = audit(s);
  const L = [`## ${s.title || T('mdInventory')}`, ''];
  L.push(`### 1 · ${T('mdSummary')}`, '', F('mdAsOf', { d: r.asOf, c: TYPES.map((t) => `${T('type_' + t)} ${r.cycles[t]}`).join(', ') }), '');
  L.push(`- **${T('tileFresh')}:** ${['fresh', 'due', 'stale', 'never'].map((b) => `${T('b_' + b)} ${r.summary.fresh[b]}`).join(' · ')}`);
  L.push(`- **${T('tileOwners')}:** ${F('ownedOf', { a: r.summary.owned, b: r.summary.articles })}`);
  L.push(`- **${T('tileQuestions')}:** ${F('coveredOf', { p: r.summary.coveredPct })}; ${F('gapLine', { n: r.summary.gaps, v: nf(r.summary.gapVolume) })}`);
  L.push(`- **${T('tileBacklog')}:** ${F('backlogLine', { e: r.summary.effort })}${r.summary.weeks ? ` · ${F('weeksLine', { w: r.summary.weeks, n: s.writers })}` : ''}`, '');
  if (s.notes) L.push(s.notes, '');
  L.push(`### 2 · ${T('mdInventory')}`, '', mdTable([T('colId'), T('colTitle'), T('colOwner'), T('colType'), T('colAudience'), T('colLast'), T('colAge'), T('colFresh'), T('colQs')],
    r.articles.map((a) => [a.id, a.title, a.owner ? `${a.owner}${a.ownerStatus !== 'ok' ? ` (${T('o_' + a.ownerStatus)})` : ''}` : T('o_none'), T('type_' + a.type), T('aud_' + a.audience), a.last, a.age ?? '', T('b_' + a.bucket), a.questions.join(' ')])), '');
  L.push(`### 3 · ${T('mdCoverage')}`, '', mdTable([T('colQuestion'), T('colVolume'), T('colArticles'), T('colCoverage')],
    [...r.questions].sort((a, b) => b.volume - a.volume).map((q) => [q.text, nf(q.volume), q.refs.join(' '), T('c_' + q.coverage)])), '');
  L.push(`### 4 · ${T('mdBacklog')}`, '', mdTable(['#', T('colAction'), T('colVolume'), T('colEffort'), T('colWeek'), T('colOwner')],
    r.actions.map((a) => [a.n, actionText(a), nf(a.volume), a.effort, weekText(a), a.owner])), '');
  return L.join('\n');
}

/* ------------------------------------------------------------------------------------------- AI */
function promptBacklog(s) {
  const r = audit(s);
  const fr = getLang() === 'fr';
  return [
    'You are the Product Owner of the knowledge behind a card-support assistant (skill: curating-knowledge-bases).',
    fr ? 'Context: Banque Lumière, CB cards.' : 'Context: Harbor Bank, Visa cards.', s.notes ? 'Notes: ' + s.notes : '',
    '', 'Content backlog from the audit (highest monthly volume first):', ...r.actions.filter((a) => a.effort).map((a) => `- ${actionText(a)} · ${a.volume}/month`),
    '', 'Write one writer-ready content story per item: "As a <customer>, I want <answer> so that <outcome>", the customer wording for the title, what the first two sentences must say, conditions and exceptions, owner, and 2–3 acceptance criteria (self-contained section, dated and owned, metadata audience / product / valid_from).',
    'Scheme deadlines (chargeback, dispute, impayé timelines) you cannot source stay *to confirm*. Never include card numbers.',
    fr ? 'Answer in French.' : 'Answer in English.',
  ].filter((x) => x !== '').join('\n');
}
function promptStandard(s) {
  const fr = getLang() === 'fr';
  return ['You are the Product Owner of a card-support knowledge base (skill: curating-knowledge-bases).',
    'Draft a one-page writing standard and a minimal metadata schema (audience, product, customer_segment, channel, language, valid_from / valid_to, confidentiality, owner) for the writers, with a review calendar per content type:',
    TYPES.map((t) => `${t}: ${(s.cycles || DEFAULT_CYCLES)[t]} days`).join(', '),
    'Include: one question per article in the customer wording, answer in the first two sentences, self-contained sections, explicit conditions, plain-text tables, dated and owned.',
    fr ? 'Answer in French.' : 'Answer in English.'].join('\n');
}

/* ------------------------------------------------------------------------------------------- view */
function mount(el, ctx) {
  const { ui } = ctx;
  const S = () => ctx.state;
  const set = (patch) => ctx.setState(patch, { silent: true });
  let timer = null;
  const later = () => { clearTimeout(timer); timer = setTimeout(paint, 250); };

  const area = (key, label, help, ph, grow) => {
    const f = ctx.frame.bindField(key, ui.field({ label, help, required: true, input: ui.textarea({ value: S()[key] || '', rows: 3, mono: true, placeholder: ph, onInput: (v) => { set({ [key]: v }); later(); } }) }));
    if (grow) f.classList.add('grow');
    return f;
  };
  ctx.frame.command.append(
    area('articles', T('articles'), T('articlesHelp'), 'KB-01, I lost my card, Priya Shah, 2026-09-30, procedure, customer', true),
    area('owners', T('owners'), T('ownersHelp'), 'Priya Shah, Card servicing, active', false),
    area('questions', T('questions'), T('questionsHelp'), 'I lost my card, 6500, KB-01, Y', true));

  // ---- advanced
  const num = (key, label, step = 1) => {
    const i = ui.input({ type: 'number', value: S()[key] ?? '', mono: true, size: 'sm', onInput: (v) => { set({ [key]: v === '' ? '' : +v }); later(); } });
    i.min = '0'; i.step = String(step);
    return ui.field({ label, input: i });
  };
  const cyc = h('div', { class: 'kb-cycles' }, ...TYPES.map((t) => {
    const i = ui.input({ type: 'number', value: (S().cycles || DEFAULT_CYCLES)[t], mono: true, size: 'sm', onInput: (v) => { set({ cycles: { ...DEFAULT_CYCLES, ...(S().cycles || {}), [t]: +v || DEFAULT_CYCLES[t] } }); later(); } });
    i.min = '1';
    return ui.field({ label: T('type_' + t), input: i });
  }));
  const asOf = ui.input({ type: 'date', value: S().asOf || '', onInput: (v) => { set({ asOf: v }); later(); } });
  const advBody = h('div', { class: 'kb-adv' },
    h('div', { class: 'kb-adv-row' }, ui.field({ label: T('asOf'), input: asOf }), num('dueWindow', T('dueWindow')), num('writers', T('writers')), num('perWriter', T('perWriter'), 0.5)),
    h('div', {}, h('p', { class: 'section-label', text: T('cyclesLabel') }), cyc),
    ui.field({ label: T('notes'), optional: true, input: ui.textarea({ value: S().notes || '', rows: 2, onInput: (v) => set({ notes: v }) }) }));
  const adv = ui.advanced({ label: T('advanced'), body: advBody, count: 0 });
  const advCount = () => {
    const c = S().cycles || DEFAULT_CYCLES;
    return TYPES.filter((t) => +c[t] !== DEFAULT_CYCLES[t]).length + (S().asOf ? 1 : 0) + ((S().notes || '').trim() ? 1 : 0);
  };

  // ---- body
  const tiles = h('div', { class: 'kb-tiles' });
  const panels = { articles: h('div'), questions: h('div'), owners: h('div'), actions: h('div') };
  const tabs = ui.tabs({ tabs: [{ id: 'articles', label: T('tabArticles') }, { id: 'questions', label: T('tabQuestions') }, { id: 'owners', label: T('tabOwners') }, { id: 'actions', label: T('tabActions') }],
    active: S().tab || 'articles', onChange: (id) => set({ tab: id }), panels });
  const main = h('div', { class: 'kb-main' }, tiles, tabs);
  const empty = ui.emptyState({ icon: 'library', title: T('emptyTitle'), text: T('emptyBody'),
    sample: { label: SAMPLES[getLang() === 'fr' ? 'fr' : 'en'][0].label, onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });
  const badge = (text, tone) => ui.badge({ text, tone });

  function tile(title, big, sub, extra) {
    return h('div', { class: 'kb-tile' }, h('div', { class: 'kb-tile-t', text: title }), h('div', { class: 'kb-tile-big', text: big }), extra || null, h('div', { class: 'kb-tile-sub', text: sub }));
  }
  function paint() {
    const r = audit(S());
    const has = r.articles.length > 0 || r.questions.length > 0;
    empty.hidden = has; main.hidden = !has;
    adv.setCount(advCount());
    if (!has) { ctx.frame.setStatus(null); return r; }
    const sm = r.summary;
    // freshness bar: one segment per bucket, labelled (never colour alone)
    const bar = h('div', { class: 'kb-bar', role: 'img', 'aria-label': ['fresh', 'due', 'stale', 'never'].map((b) => `${T('b_' + b)} ${sm.fresh[b]}`).join(', ') },
      ...['fresh', 'due', 'stale', 'never'].filter((b) => sm.fresh[b]).map((b) => h('span', { class: 'kb-seg b-' + b, style: `flex:${sm.fresh[b]}`, title: `${T('b_' + b)}: ${sm.fresh[b]}` })));
    const legend = h('div', { class: 'kb-legend' }, ...['fresh', 'due', 'stale', 'never'].map((b) => h('span', {}, h('i', { class: 'b-' + b, 'aria-hidden': 'true' }), `${T('b_' + b)} ${sm.fresh[b]}`)));
    tiles.replaceChildren(
      tile(T('tileFresh'), `${sm.fresh.fresh + sm.fresh.due} / ${sm.articles}`, '', h('div', {}, bar, legend)),
      tile(T('tileOwners'), `${sm.owned} / ${sm.articles}`, F('ownedOf', { a: sm.owned, b: sm.articles })),
      tile(T('tileQuestions'), `${sm.coveredPct} %`, `${F('coveredOf', { p: sm.coveredPct })} · ${F('gapLine', { n: sm.gaps, v: nf(sm.gapVolume) })}`),
      tile(T('tileBacklog'), F('backlogLine', { e: sm.effort }), sm.weeks ? F('weeksLine', { w: sm.weeks, n: S().writers }) : T('noCapacity')));

    panels.articles.replaceChildren(ui.table({
      columns: [
        { key: 'id', label: T('colId'), mono: true },
        { key: 'title', label: T('colTitle') },
        { key: 'owner', label: T('colOwner'), format: (v, a) => (a.ownerStatus === 'ok' ? v : h('span', { class: 'kb-owner' }, v || '', badge(T('o_' + a.ownerStatus), O_TONE[a.ownerStatus]))) },
        { key: 'type', label: T('colType'), format: (v) => T('type_' + v) },
        { key: 'audience', label: T('colAudience'), format: (v) => (v === 'internal' ? badge(T('aud_internal'), 'neutral') : T('aud_' + v)) },
        { key: 'last', label: T('colLast'), mono: true, format: (v) => v || '—' },
        { key: 'age', label: T('colAge'), num: true, format: (v, a) => (v == null ? '—' : `${v} / ${a.cycle}`) },
        { key: 'bucket', label: T('colFresh'), format: (v) => badge(T('b_' + v), B_TONE[v]) },
        { key: 'questions', label: T('colQs'), mono: true, format: (v) => v.join(' ') },
        { key: 'volume', label: T('colVolume'), num: true, format: (v) => (v ? nf(v) : '—') },
      ], rows: r.articles }));
    panels.questions.replaceChildren(ui.table({
      columns: [
        { key: 'id', label: '#', mono: true },
        { key: 'text', label: T('colQuestion'), format: (v, q) => (q.unknown.length ? h('span', {}, v, ' ', badge(F('unknownRefs', { ids: q.unknown.join(', ') }), 'warn')) : v) },
        { key: 'volume', label: T('colVolume'), num: true, format: (v) => nf(v) },
        { key: 'refs', label: T('colArticles'), mono: true, format: (v) => v.join(' ') || '—' },
        { key: 'coverage', label: T('colCoverage'), format: (v, q) => h('span', { class: 'kb-cov' }, badge(T('c_' + v), C_TONE[v]), q.dup ? badge('×' + q.articles.filter((a) => a.audience !== 'internal').length, 'neutral') : null) },
      ], rows: [...r.questions].sort((a, b) => b.volume - a.volume) }));
    panels.owners.replaceChildren(ui.table({
      columns: [
        { key: 'name', label: T('colOwner') }, { key: 'team', label: T('colTeam') },
        { key: 'left', label: T('colStatus'), format: (v) => badge(v ? T('left') : T('active'), v ? 'bad' : 'ok') },
        { key: 'n', label: T('colN'), num: true }, { key: 'stale', label: T('colStale'), num: true }, { key: 'volume', label: T('colVolume'), num: true, format: (v) => nf(v) },
      ], rows: [...r.owners, ...(r.articles.some((a) => a.ownerStatus === 'none') ? [{ name: T('o_none'), team: '', left: false, n: r.articles.filter((a) => a.ownerStatus === 'none').length, stale: r.articles.filter((a) => a.ownerStatus === 'none' && (a.bucket === 'stale' || a.bucket === 'never')).length, volume: r.articles.filter((a) => a.ownerStatus === 'none').reduce((x, a) => x + a.volume, 0) }] : [])] }));
    panels.actions.replaceChildren(ui.table({
      columns: [
        { key: 'n', label: '#', num: true },
        { key: 'type', label: T('colAction'), format: (v, a) => actionText(a) },
        { key: 'volume', label: T('colVolume'), num: true, format: (v) => (v ? nf(v) : '—') },
        { key: 'effort', label: T('colEffort'), num: true, format: (v) => (v ? String(v).replace('.', getLang() === 'fr' ? ',' : '.') : '—') },
        { key: 'week', label: T('colWeek'), format: (v, a) => weekText(a) },
        { key: 'owner', label: T('colOwner'), format: (v) => v || '—' },
      ], rows: r.actions }));
    tabs.setCount('articles', sm.articles); tabs.setCount('questions', sm.questions); tabs.setCount('owners', r.owners.length); tabs.setCount('actions', r.actions.length);
    const text = F('meta', { a: sm.articles, s: sm.fresh.stale + sm.fresh.never, g: sm.gaps, p: sm.coveredPct });
    ctx.frame.setStatus({ tone: sm.gaps || sm.fresh.stale ? 'warn' : 'ok', text });
    return r;
  }
  el.append(adv, empty, main);
  ctx.__kbRefresh = paint;
  paint();
}

/* ------------------------------------------------------------------------------------------- module */
export default {
  id: 'kb-audit',
  skill: 'curating-knowledge-bases',
  icon: 'library',
  title: { en: 'KB audit grid', fr: 'Audit de la base de connaissances' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'list-checks' },
  schema: 1,
  defaults() { return { title: '', articles: '', owners: '', questions: '', asOf: '', dueWindow: 30, writers: 2, perWriter: 2, cycles: { ...DEFAULT_CYCLES }, notes: '', tab: 'articles' }; },
  samples: SAMPLES,
  mount,
  validate(s) {
    const e = [];
    if (!(s.articles || '').trim()) e.push({ field: 'articles', message: getLang() === 'fr' ? 'Collez au moins un article, par ex. KB-01, J’ai perdu ma carte, Claire Dubois, 2026-09-30, procédure, client.' : 'Paste at least one article, for example KB-01, I lost my card, Priya Shah, 2026-09-30, procedure, customer.' });
    if (!(s.questions || '').trim()) e.push({ field: 'questions', message: getLang() === 'fr' ? 'Collez au moins une question client, par ex. J’ai perdu ma carte, 6500, KB-01, O.' : 'Paste at least one customer question, for example I lost my card, 6500, KB-01, Y.' });
    return e;
  },
  run(s, ctx) {
    const r = ctx.__kbRefresh ? ctx.__kbRefresh() : audit(s);
    return { articles: r.summary.articles, stale: r.summary.fresh.stale + r.summary.fresh.never, gaps: r.summary.gaps, covered: r.summary.coveredPct, actions: r.actions.length };
  },
  status(r, ms) { return { tone: r.gaps || r.stale ? 'warn' : 'ok', text: F('meta', { a: r.articles, s: r.stale, g: r.gaps, p: r.covered }), ms }; },
  toMarkdown,
  exports: [
    { id: 'actions', label: { en: strings.en.exportActions, fr: strings.fr.exportActions }, build: (s) => ({ name: 'kb-content-backlog.csv', mime: 'text/csv', text: actionsCsv(audit(s), actionText) }) },
    { id: 'audit', label: { en: strings.en.exportAudit, fr: strings.fr.exportAudit }, build: (s) => ({ name: 'kb-article-audit.csv', mime: 'text/csv', text: auditCsv(audit(s)) }) },
    { id: 'coverage', label: { en: strings.en.exportCoverage, fr: strings.fr.exportCoverage }, build: (s) => ({ name: 'kb-question-coverage.csv', mime: 'text/csv', text: coverageCsv(audit(s)) }) },
  ],
  aiActions: [
    { id: 'content-stories', label: { en: strings.en.aiBacklog, fr: strings.fr.aiBacklog }, prompt: (s) => promptBacklog(s), expects: 'markdown' },
    { id: 'writing-standard', label: { en: strings.en.aiStandard, fr: strings.fr.aiStandard }, prompt: (s) => promptStandard(s), expects: 'markdown' },
  ],
  _internals: { toMarkdown, promptBacklog, promptStandard },
};
