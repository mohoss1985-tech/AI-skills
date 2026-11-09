/* SQL runner (generating-sql). Question · Tables · Dialect → real SQL on the Harbor Bank / Banque Lumière sample database.
   Local app: POST /api/tools/sql/run (read-only Python sqlite3). Static demo: sql.js in a worker, same seed.
   Pure logic in logic.js, engines in engine.js, samples in samples.js, AI prompts in prompts.js. Owner D. */
import { register, locale, colon } from '../../core/i18n.js';
import strings from './i18n.js';
import SAMPLES from './samples.js';
import * as L from './logic.js';
import { getSchema, MAX_ROWS, resetBrowser, runSql } from './engine.js';
import { draftPrompt, explainPrompt, translatePrompt } from './prompts.js';

const T = register('sql-runner', strings);
const fmt = (key, vars = {}) => T(key).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

// Samples: tag each with its language + id so a run can be checked against the stored answer.
for (const lang of ['en', 'fr']) for (const s of SAMPLES[lang]) { s.autorun = true; s.state.sample = `${lang}:${s.id}`; }
const sampleOf = (state) => {
  const [lang, id] = String(state.sample || '').split(':');
  const s = (SAMPLES[lang] || []).find((x) => x.id === id);
  return s && s.state.sql === state.sql ? s : null;
};

let schemaCache = null; // [{name, rows, columns}] once loaded
let view = null;        // DOM handles of the mounted screen

const ERR = { 'sql.empty': 'errEmpty', 'sql.one_statement': 'errOneStatement', 'sql.read_only': 'errReadOnly', 'sql.timeout': 'errTimeout', 'sql.engine': 'errEngine', 'sql.server': 'errServer' };
const nf = () => new Intl.NumberFormat(locale(), { maximumFractionDigits: 6 });

function runError(code, message) {
  const e = new Error(ERR[code] ? T(ERR[code]) : message || T('errEngine'));
  e.hint = T('errHint');
  return e;
}

// ---------------------------------------------------------------------------------------------- screen
function mount(el, ctx) {
  const { ui, frame } = ctx;
  const st = ctx.state;
  view = { ctx };

  // command bar: Question · Tables · Dialect
  const q = ui.field({ label: T('question'), help: T('questionHelp'), required: true,
    input: ui.input({ value: st.question, onInput: (v) => ctx.setState({ question: v }), placeholder: '' }) });
  q.classList.add('sr-question');
  const chips = document.createElement('div');
  chips.className = 'sr-chips'; chips.id = 'sr-tables'; chips.tabIndex = -1;
  const tablesField = ui.field({ label: T('tables'), help: T('tablesHelp'), input: chips });
  const dialect = ui.field({ label: T('dialect'), help: T('dialectHelp'),
    input: ui.segmented({ label: T('dialect'), value: st.dialect || 'sqlite', options: L.DIALECTS.map((d) => ({ value: d, label: L.DIALECT_LABEL[d] })), onChange: (v) => ctx.setState({ dialect: v }) }) });
  frame.command.append(q, tablesField, dialect);
  view.chips = chips;

  // config pane: AI draft notice · SQL editor · translation · schema browser · advanced
  const draft = st.ai && st.ai['draft-sql'] && st.ai['draft-sql'].sql;
  if (draft && draft !== st.sql) {
    const n = document.createElement('div');
    n.className = 'sr-ai-note panel';
    n.append(ui.badge({ text: T('aiBadge'), tone: 'accent', icon: 'sparkles' }),
      ui.button({ label: T('useDraft'), size: 'sm', onClick: () => { ctx.setState({ sql: draft, sample: null }); view.editor.value = draft; n.remove(); } }));
    el.append(n);
  }
  const editor = ui.codeEditor({ value: st.sql, lang: 'sql', rows: 14, ariaLabel: T('sql'), onChange: (v) => ctx.setState({ sql: v }) });
  view.editor = editor;
  const sqlField = frame.bindField('sql', ui.field({ label: T('sql'), help: T('sqlHelp'), input: editor }));
  const tools = document.createElement('div');
  tools.className = 'row sr-editor-tools';
  tools.append(
    ui.button({ label: T('starter'), title: T('starterTitle'), icon: 'code', size: 'sm', variant: 'secondary', onClick: () => {
      const tables = ctx.state.tables || [];
      if (!tables.length) { frame.showErrors([{ field: 'sql', message: T('starterNeedTables') }]); return; }
      const sql = L.starterQuery(tables, schemaCache || []);
      editor.value = sql; ctx.setState({ sql, sample: null }); editor.focus();
    } }),
    ui.copyButton({ text: () => ctx.state.sql || '' }),
  );
  sqlField.append(tools);
  el.append(sqlField);

  view.translation = document.createElement('div');
  view.translation.className = 'sr-translation';
  el.append(view.translation);

  const schemaBox = document.createElement('section');
  schemaBox.className = 'sr-schema';
  const sh = document.createElement('div'); sh.className = 'section-label'; sh.textContent = T('schema');
  view.schemaList = document.createElement('div');
  view.schemaList.className = 'sr-schema-list';
  view.schemaList.textContent = T('schemaLoading');
  schemaBox.append(sh, view.schemaList);
  el.append(schemaBox);

  const advBody = document.createElement('div');
  advBody.className = 'stack';
  advBody.append(
    ui.field({ label: T('engine'), help: T('engineHelp'), input: ui.segmented({ label: T('engine'), value: st.engine || 'auto',
      options: [{ value: 'auto', label: T('engineAuto') }, ...(ctx.server ? [{ value: 'local', label: T('engineLocal') }] : []), { value: 'browser', label: T('engineBrowser') }],
      onChange: (v) => { ctx.setState({ engine: v }); loadSchema(ctx); } }) }),
    ui.field({ label: T('maxRows'), help: T('maxRowsHelp'), input: ui.input({ value: String(st.maxRows || MAX_ROWS), type: 'number', mono: true, size: 'sm',
      onChange: (v) => ctx.setState({ maxRows: Math.max(1, Math.min(MAX_ROWS, parseInt(v, 10) || MAX_ROWS)) }) }) }),
    ui.button({ label: T('reset'), icon: 'rotate-ccw', size: 'sm', variant: 'ghost', onClick: () => { resetBrowser(); schemaCache = null; loadSchema(ctx).then(() => ctx.toast(T('resetDone'))); } }),
  );
  view.adv = ui.advanced({ label: T('advanced'), body: advBody });
  el.append(view.adv);

  // results pane
  if (ctx.lastRun && ctx.lastRun.ok) renderResult(ctx.lastRun, ctx);
  else frame.output.append(ui.emptyState({ icon: 'database', title: T('emptyTitle'), text: T('emptyText'),
    sample: { label: T('loadSample'), onClick: () => ctx.loadSample(ctx.lang, 0) } }));

  paintInputs(ctx.state);
  loadSchema(ctx);
}

/** Repaint what depends on the state, without touching the editor (keeps focus and caret). */
function paintInputs(state) {
  if (!view) return;
  const { ctx } = view, { ui } = ctx;
  const tables = state.tables || [];
  view.chips.replaceChildren(...(tables.length
    ? tables.map((tb) => ui.badge({ text: tb, tone: 'neutral', icon: 'table' }))
    : [Object.assign(document.createElement('span'), { className: 'muted', textContent: T('tablesNone') })]));
  for (const cb of view.schemaList.querySelectorAll('input[type=checkbox][data-table]')) cb.checked = tables.includes(cb.dataset.table);
  let n = 0;
  if ((state.engine || 'auto') !== 'auto') n++;
  if ((state.maxRows || MAX_ROWS) !== MAX_ROWS) n++;
  view.adv.setCount(n);
  paintTranslation(state);
}

function paintTranslation(state) {
  const box = view.translation;
  const d = state.dialect || 'sqlite';
  if (d === 'sqlite' || !(state.sql || '').trim()) { box.replaceChildren(); box.hidden = true; return; }
  const { ui } = view.ctx;
  const tr = L.translate(state.sql, d);
  box.hidden = false;
  const ro = ui.codeEditor({ value: tr.sql, lang: 'sql', rows: Math.min(14, tr.sql.split('\n').length + 1), readonly: true, ariaLabel: `${L.DIALECT_LABEL[d]} ${T('translated')}` });
  const f = ui.field({ label: `${L.DIALECT_LABEL[d]} · ${T('translated')}`, help: T('translatedHelp'), input: ro });
  const notes = document.createElement('ul');
  notes.className = 'sr-notes';
  for (const k of tr.notes) { const li = document.createElement('li'); li.textContent = T('note.' + k); notes.append(li); }
  const row = document.createElement('div'); row.className = 'row';
  row.append(ui.copyButton({ text: tr.sql }));
  f.append(notes, row);
  box.replaceChildren(f);
}

async function loadSchema(ctx) {
  const list = view && view.schemaList;
  try {
    const r = await getSchema({ server: ctx.server, engine: ctx.state.engine });
    schemaCache = r.tables || [];
    if (view && view.schemaList === list) paintSchema(ctx);
  } catch (e) {
    if (list) list.textContent = `${T('schemaError')}: ${e.message}`;
  }
}

function insertAtCursor(text) {
  const ta = view.editor.textarea;
  const a = ta.selectionStart ?? ta.value.length, b = ta.selectionEnd ?? a;
  ta.setRangeText(text, a, b, 'end');
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  ta.focus();
}

function paintSchema(ctx) {
  const { ui } = ctx;
  const tables = ctx.state.tables || [];
  const n = nf();
  view.schemaList.replaceChildren(...schemaCache.map((tb) => {
    const d = document.createElement('details');
    d.className = 'sr-table';
    const s = document.createElement('summary');
    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.dataset.table = tb.name; cb.checked = tables.includes(tb.name);
    cb.setAttribute('aria-label', `${T('pickTable')}: ${tb.name}`);
    cb.addEventListener('click', (e) => e.stopPropagation());
    cb.addEventListener('change', () => {
      const cur = new Set(ctx.state.tables || []);
      cb.checked ? cur.add(tb.name) : cur.delete(tb.name);
      ctx.setState({ tables: schemaCache.map((x) => x.name).filter((x) => cur.has(x)) });
    });
    const name = document.createElement('span'); name.className = 'mono sr-tname'; name.textContent = tb.name;
    const cnt = document.createElement('span'); cnt.className = 'muted num sr-tcount'; cnt.textContent = `${n.format(tb.rows)} ${T('rowsCount')}`;
    const ins = ui.button({ icon: 'corner-down-left', size: 'sm', variant: 'ghost', ariaLabel: `${T('insert')} ${tb.name}`, title: `${T('insert')} ${tb.name}`,
      onClick: (e) => { e.preventDefault(); insertAtCursor(tb.name); } });
    s.append(cb, name, cnt, ins);
    const cols = document.createElement('ul');
    cols.className = 'sr-cols';
    for (const c of tb.columns) {
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sr-col'; b.title = T('insertCol');
      const cn = document.createElement('span'); cn.className = 'mono'; cn.textContent = c.name;
      const ct = document.createElement('span'); ct.className = 'muted mono sr-ctype'; ct.textContent = (c.type || '').toLowerCase();
      b.append(cn, ct);
      if (c.pk) b.append(ui.badge({ text: T('pk'), tone: 'neutral' }));
      b.onclick = () => insertAtCursor(c.name);
      li.append(b); cols.append(li);
    }
    d.append(s, cols);
    return d;
  }));
}

// ---------------------------------------------------------------------------------------------- run + results
async function run(state, ctx) {
  const ta = view && view.editor && view.editor.textarea;
  const text = state.sql || '';
  const sql = L.pickStatement(text, ta ? ta.selectionStart : 0, ta ? ta.selectionEnd : 0);
  if (!sql.trim()) throw runError('sql.empty');
  if (L.splitStatements(sql).length > 1) throw runError('sql.one_statement');
  if (!L.isReadOnly(sql)) throw runError('sql.read_only');
  const r = await runSql({ server: ctx.server, engine: state.engine || 'auto', sql, maxRows: state.maxRows || MAX_ROWS });
  if (!r.ok) throw runError(r.error && r.error.code, r.error && r.error.message);
  const s = sampleOf(state);
  const result = { ...r, sql, at: Date.now(), checks: L.checks(r), expectOk: s ? L.matchesExpect(r, s.expect) : null };
  if (!(state.tables || []).length && schemaCache) {
    const used = L.tablesIn(sql, schemaCache.map((x) => x.name));
    if (used.length) ctx.setState({ tables: used });
  }
  return result;
}

function chartEl(spec) {
  const n = nf();
  const box = document.createElement('figure');
  box.className = 'sr-chart';
  const cap = document.createElement('figcaption'); cap.className = 'section-label';
  cap.textContent = fmt('chartOf', { value: spec.value, label: spec.label });
  box.append(cap);
  const list = document.createElement('div'); list.className = 'sr-bars'; list.setAttribute('role', 'list');
  for (const b of spec.bars) {
    const row = document.createElement('div'); row.className = 'sr-bar-row'; row.setAttribute('role', 'listitem');
    row.title = `${b.label}: ${n.format(b.value)}`;
    const l = document.createElement('span'); l.className = 'sr-bar-label'; l.textContent = b.label;
    const track = document.createElement('span'); track.className = 'sr-bar-track';
    const bar = document.createElement('span'); bar.className = 'sr-bar';
    bar.style.width = spec.max ? `${Math.max(0.5, (Math.abs(b.value) / spec.max) * 100)}%` : '0';
    track.append(bar);
    const v = document.createElement('span'); v.className = 'sr-bar-value num'; v.textContent = n.format(b.value);
    row.append(l, track, v);
    list.append(row);
  }
  box.append(list);
  return box;
}

function checksEl(r, ui) {
  const row = document.createElement('div');
  row.className = 'row sr-checks';
  if (r.expectOk != null) row.append(ui.badge({ text: T(r.expectOk ? 'matches' : 'differs'), tone: r.expectOk ? 'ok' : 'warn', icon: r.expectOk ? 'circle-check' : 'triangle-alert' }));
  for (const c of r.checks || []) {
    let text;
    if (c.id === 'rows') text = `${T('checkRows')}${colon()}${nf().format(c.n)}`;
    else if (c.id === 'nulls') text = c.ok ? T('checkNulls') : `${T('checkNullsFail')} ${c.cols.join(', ')}`;
    else text = c.ok ? fmt('checkGrain', { col: c.col }) : fmt('checkGrainFail', { n: c.n, col: c.col });
    row.append(ui.badge({ text, tone: c.ok ? 'ok' : 'warn', icon: c.ok ? 'check' : 'triangle-alert' }));
  }
  return row;
}

function renderResult(r, ctx) {
  const { ui, frame } = ctx;
  const out = frame.output;
  const kinds = L.columnKinds(r.columns, r.rows);
  const n = nf();
  const spec = L.chartSpec(r.columns, r.rows);
  const tbl = ui.table({
    caption: ctx.state.question || T('sql'),
    columns: r.columns.map((c, i) => ({ key: String(i), label: c, num: kinds[i] === 'num', mono: kinds[i] !== 'num' && /(_id|_ts|_at|code|arn|token)$/i.test(c),
      format: (v) => (v == null ? Object.assign(document.createElement('span'), { className: 'muted', textContent: 'NULL' }) : kinds[i] === 'num' ? n.format(v) : String(v)) })),
    rows: r.rows,
    empty: T('noRows'),
  });
  const body = document.createElement('div');
  body.className = 'sr-result-body';
  const chart = spec ? chartEl(spec) : null;
  const showView = (v) => { body.replaceChildren(v === 'chart' && chart ? chart : tbl); };
  showView(spec && r.columns.length === 2 ? 'chart' : 'table');

  const extra = [ui.badge({ text: T(r.where === 'local' ? 'engineLocalBadge' : 'engineBrowserBadge'), tone: 'neutral', icon: r.where === 'local' ? 'terminal' : 'layers' })];
  if (chart) extra.push(ui.segmented({ label: T('viewChart'), value: r.columns.length === 2 ? 'chart' : 'table', options: [{ value: 'table', label: T('viewTable') }, { value: 'chart', label: T('viewChart') }], onChange: showView }));
  extra.push(ui.copyButton({ text: () => L.toTsv(r.columns, r.rows), label: T('copyTsv') }),
    ui.button({ label: T('csv'), icon: 'file-down', size: 'sm', variant: 'ghost', onClick: () => ctx.download(`${L.slug(ctx.state.question)}.csv`, 'text/csv', L.toCsv(r.columns, r.rows)) }));
  frame.setStatusExtra(...extra);

  const parts = [checksEl(r, ui)];
  if (r.truncated) {
    const p = document.createElement('p'); p.className = 'muted sr-trunc';
    p.textContent = fmt('truncated', { n: n.format(r.rows.length), total: n.format(r.total) });
    parts.push(p);
  }
  parts.push(body);
  const interp = ui.field({ label: T('interpretation'), help: T('interpretationHelp'), optional: true,
    input: ui.textarea({ value: ctx.state.interpretation || '', rows: 3, onInput: (v) => ctx.setState({ interpretation: v }) }) });
  interp.classList.add('sr-interp');
  parts.push(interp);
  out.replaceChildren(...parts);
}

// ---------------------------------------------------------------------------------------------- deliverable + exports
function toMarkdown(state, run) {
  const d = state.dialect || 'sqlite';
  const lines = [`# ${state.question || T('sql')}`, ''];
  lines.push(`- **${T('mdQuestion')}**${colon()}${state.question || '—'}`);
  lines.push(`- **${T('mdTables')}**${colon()}${(state.tables || []).map((x) => '`' + x + '`').join(', ') || '—'}`);
  lines.push(`- **${T('mdDialect')}**${colon()}${L.DIALECT_LABEL[d]}`, '');
  lines.push(`## ${T('mdQuery')}`, '', '```sql', (run && run.sql) || state.sql || '', '```', '');
  if (d !== 'sqlite') {
    const tr = L.translate((run && run.sql) || state.sql || '', d);
    lines.push(`### ${L.DIALECT_LABEL[d]}`, '', '```sql', tr.sql, '```', '', ...tr.notes.map((k) => `- ${T('note.' + k)}`), '');
  }
  lines.push(`## ${T('mdResult')}`, '');
  if (run && run.ok) {
    const n = Math.min(50, run.rows.length);
    lines.push(`${run.total} ${T('rowsCount')} · ${run.ms} ms · ${T(run.where === 'local' ? 'engineLocalBadge' : 'engineBrowserBadge')}`, '');
    lines.push(L.mdTable(run.columns, run.rows.slice(0, n)), '');
    if (run.total > n) lines.push(`_${fmt('mdFirst', { n, total: run.total })}_`, '');
    const ch = (run.checks || []).map((c) => (c.id === 'rows' ? `${T('checkRows')}${colon()}${c.n}` : c.id === 'nulls' ? (c.ok ? T('checkNulls') : `${T('checkNullsFail')} ${c.cols.join(', ')}`) : c.ok ? fmt('checkGrain', { col: c.col }) : fmt('checkGrainFail', { n: c.n, col: c.col })));
    if (run.expectOk != null) ch.unshift(T(run.expectOk ? 'matches' : 'differs'));
    if (ch.length) lines.push(`## ${T('mdChecks')}`, '', ...ch.map((x) => `- ${x}`), '');
  } else lines.push(T('mdNoRun'), '');
  if (state.interpretation) lines.push(`## ${T('mdInterpretation')}`, '', state.interpretation, '');
  lines.push(`_${T('mdData')}_`, '');
  return lines.join('\n');
}

const label2 = (key) => ({ en: strings.en[key], fr: strings.fr[key] });

export default {
  id: 'sql-runner',
  skill: 'generating-sql',
  icon: 'database',
  title: { en: 'SQL runner', fr: 'Exécuteur SQL' },
  purpose: label2('purpose'),
  layout: 'split',
  primary: { label: label2('run'), icon: 'play' },
  schema: 1,
  defaults() {
    return { question: '', tables: [], dialect: 'sqlite', sql: '', interpretation: '', engine: 'auto', maxRows: MAX_ROWS, sample: null };
  },
  samples: SAMPLES,
  mount,
  update(state) { paintInputs(state); },
  validate(state) {
    return (state.sql || '').trim() ? [] : [{ field: 'sql', message: T('errEmpty') }];
  },
  run,
  renderResult,
  status(r) {
    return { tone: r.expectOk === false ? 'warn' : 'ok', text: r.truncated ? `${r.rows.length} / ${nf().format(r.total)}` : '', rows: r.total, ms: r.ms };
  },
  toMarkdown,
  exports: [
    { id: 'sql', label: label2('exportSql'), build(state, run) {
      const d = state.dialect || 'sqlite';
      const sql = (run && run.sql) || state.sql || '';
      const body = d === 'sqlite' ? `-- SQLite\n${sql}` : L.translate(sql, d).sql;
      const head = state.question ? `-- ${state.question.replace(/\n/g, ' ')}\n` : '';
      return { name: `${L.slug(state.question)}.${d}.sql`, mime: 'application/sql', text: head + body.trim() + ';\n' };
    } },
    { id: 'csv', label: label2('exportCsv'), build(state, run) {
      if (!run || !run.ok) throw new Error(T('mdNoRun'));
      return { name: `${L.slug(state.question)}.csv`, mime: 'text/csv', text: L.toCsv(run.columns, run.rows) };
    } },
  ],
  aiActions: [
    { id: 'draft-sql', label: label2('aiDraft'), expects: 'sql', prompt: (s, r) => draftPrompt(s, r, { schema: schemaCache || [], lang: view ? view.ctx.lang : 'en' }) },
    { id: 'explain', label: label2('aiExplain'), expects: 'markdown', prompt: (s, r) => explainPrompt(s, r, { lang: view ? view.ctx.lang : 'en' }) },
    { id: 'translate', label: label2('aiTranslate'), expects: 'sql', prompt: (s, r) => translatePrompt(s, r) },
  ],
};
