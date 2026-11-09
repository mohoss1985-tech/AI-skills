/* Mapping grid (skill mapping-data), owner I.
   Command bar: source fields · target fields · DQ rules (pasteable lists). Body: two-column mapper (A's grid), checks ported
   from check_mapping.py (+ type / length / translation checks), target coverage, and a live "test with a sample record"
   preview. Logic = logic.js (node logic.test.mjs: parity with the Python script). */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { analyse, preview, sampleRecord, mappingCsv, autoMap, addUnmappedRows, DIALECTS, fill, model } from './logic.js';
import { mdTable } from './csv.js';

const T = register('mapping-grid', strings);
const F = (k, v) => fill(T(k), v);
const issueText = (x) => F(x.code, x.vars);
const LEVEL_TONE = { error: 'bad', warning: 'warn', info: 'neutral' };
const ST_TONE = { ok: 'ok', default: 'info', empty: 'neutral', held: 'warn', bad: 'bad', manual: 'neutral', confirm: 'warn' };
const COV_TONE = { mapped: 'ok', missing: 'bad', empty: 'neutral', dup: 'bad' };

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else e.setAttribute(k, v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}

/* ------------------------------------------------------------------------------------------- markdown */
function toMarkdown(state) {
  const a = analyse(state);
  const m = a.model;
  const L = [`## ${state.title || T('mdMapping')}`, ''];
  if (state.notes) L.push(state.notes, '');
  const srcTables = [...new Set(m.sources.map((s) => s.table).filter(Boolean))].map((t) => '`' + t + '`').join(', ');
  L.push(`### 1 · ${T('mdScope')}`, '', mdTable(['', ''], [[T('mdSource'), srcTables], [T('mdTarget'), '`' + m.table + '`'], [T('mdKey'), state.key ? '`' + state.key + '`' : '']]), '');
  L.push(`### 2 · ${T('mdMapping')}`, '', mdTable([T('colTarget'), 'Type', T('colMand'), T('colSource'), T('colTransformation'), T('colDefault'), T('colRule')],
    a.rows.map((r) => [r.target_field, r.type, r.mandatory, r.source_field ? `${r.source_table}.${r.source_field}` : '', r.transformation, r.default, r.rule])), '');
  L.push('```csv', mappingCsv(state).trim(), '```', '');
  const trs = Object.entries(m.tr);
  if (trs.length) {
    L.push(`### 3 · ${T('mdTranslations')}`, '');
    for (const [name, rows] of trs) L.push(`**${name}**`, '', mdTable([T('mdTrCols').split('|')[1], T('mdTrCols').split('|')[2], T('mdTrCols').split('|')[3]], rows.map((r) => [r.from, r.to, r.label])), '');
  }
  if (m.rules.length) L.push(`### 4 · ${T('mdRules')}`, '', mdTable(T('mdRuleCols').split('|'), m.rules.map((r) => [r.id, r.dimension, r.rule, r.threshold, r.onFailure, r.owner])), '');
  L.push(`### 5 · ${T('mdChecks')}`, '', F('mdCheckLine', { e: a.counts.error, w: a.counts.warning }), '');
  for (const x of a.issues.filter((i) => i.level !== 'info')) L.push(`- **${T('lvl_' + x.level)}** ${issueText(x)}`);
  L.push('');
  const p = preview(state);
  L.push(`### 6 · ${T('mdPreview')}`, '', mdTable([T('colField'), T('colValue'), T('colStatus'), ''], p.map((r) => [r.target, r.value ?? '', T('st_' + r.status), r.note ? F(r.note.code, r.note.vars) : ''])), '');
  const open = m.targets.filter((t) => t.confirm);
  if (open.length) { L.push(`### 7 · ${T('mdOpen')}`, ''); for (const t of open) L.push(`- \`${t.field}\`: *${t.confirm}*`); L.push(''); }
  return L.join('\n');
}

/* ------------------------------------------------------------------------------------------- AI prompts */
function promptTransform(state) {
  const a = analyse(state);
  const fr = getLang() === 'fr';
  return [
    'You are a data-minded business analyst (skill: mapping-data) on a card-payments interface.',
    fr ? 'Context: Banque Lumière, CB cards, declaration to GIE CB. Codes not public stay *à confirmer*.' : 'Context: Harbor Bank, Visa cards. Scheme codes not in public sources stay *to confirm*.',
    state.notes ? 'Notes: ' + state.notes : '',
    '', 'Source fields (table.field, type, example):', state.sources || '(none)',
    '', 'Target fields (field, type, mandatory, allowed, to-confirm note):', state.targets || '(none)',
    '', 'Current mapping CSV:', '```csv', mappingCsv(state).trim(), '```',
    '', 'Open issues from the checker:', ...a.issues.filter((i) => i.level !== 'info').map((i) => '- ' + issueText(i)),
    '', 'Propose a source and a precise transformation for every target field (TRIM, UPPER, ROUND(src.x * 100), CAST(src.x AS DATE), COALESCE, CONCAT, SUBSTR, MASK, "translation table T-nn"), a default only when inventing a value is safe, and list every code-value translation (every source code, including unknown).',
    'Never put a clear card number in any field. Answer with a short rationale, then the full mapping as a CSV block with exactly this header:',
    'target_table,target_field,type,mandatory,source_table,source_field,transformation,default,rule,allowed',
    fr ? 'Answer in French.' : 'Answer in English.',
  ].filter((x) => x !== '').join('\n');
}
function promptRules(state) {
  const fr = getLang() === 'fr';
  return [
    'You are a data-minded business analyst (skill: mapping-data).',
    'Draft data quality rules DQ-01… for this mapping, one per line: id, dimension (completeness, validity, uniqueness, consistency, timeliness, accuracy), rule, threshold, on failure (reject, default, fix at source, accept with flag), owner.',
    'Include a rule that no clear PAN reaches the target. Mark scheme deadlines you cannot source as *to confirm*.',
    '', '```csv', mappingCsv(state).trim(), '```', '', 'Existing rules:', state.rules || '(none)',
    'Answer with a CSV block (id,dimension,rule,threshold,on_failure,owner) that can be pasted into the Rules field.',
    fr ? 'Answer in French.' : 'Answer in English.',
  ].join('\n');
}

/* ------------------------------------------------------------------------------------------- view */
function mount(el, ctx) {
  const { ui } = ctx;
  const S = () => ctx.state;
  const set = (patch) => ctx.setState(patch, { silent: true });
  let timer = null;
  const later = (fn) => { clearTimeout(timer); timer = setTimeout(fn, 250); };

  // ---- command bar
  const area = (key, label, help, ph) => {
    const ta = ui.textarea({ value: S()[key] || '', rows: 3, mono: true, placeholder: ph, onInput: (v) => { set({ [key]: v }); later(rebuild); } });
    const f = ctx.frame.bindField(key, ui.field({ label, help, input: ta, required: key !== 'rules', optional: key === 'rules' }));
    f.classList.add('grow');
    return f;
  };
  ctx.frame.command.append(
    area('sources', T('sources'), T('sourcesHelp'), 'fraud_case.case_no, varchar(12), CASE-0421'),
    area('targets', T('targets'), T('targetsHelp'), 'case_id, varchar(12), Y'),
    area('rules', T('rules'), T('rulesHelp'), 'DQ-01, Uniqueness, One report per transaction, 100%, Do not send, Fraud ops'),
  );

  // ---- advanced
  const advBody = h('div', { class: 'mg-adv' });
  const tTable = ui.input({ value: S().targetTable || '', mono: true, onInput: (v) => { set({ targetTable: v }); later(refresh); } });
  const tKey = ui.input({ value: S().key || '', mono: true, onInput: (v) => { set({ key: v }); later(refresh); } });
  const tDialect = ui.segmented({ options: DIALECTS.map((d) => ({ value: d, label: d === 'postgres' ? 'PostgreSQL' : d === 'oracle' ? 'Oracle' : 'SQL Server' })), value: S().dialect || 'postgres', onChange: (v) => set({ dialect: v }) });
  const tTr = ui.textarea({ value: S().translations || '', rows: 6, mono: true, placeholder: 'T-01, LOST, 0, Lost', onInput: (v) => { set({ translations: v }); later(refresh); } });
  const tNotes = ui.textarea({ value: S().notes || '', rows: 2, onInput: (v) => set({ notes: v }) });
  advBody.append(
    h('div', { class: 'mg-adv-row' }, ui.field({ label: T('targetTable'), input: tTable }), ui.field({ label: T('key'), input: tKey }), ui.field({ label: T('dialect'), input: tDialect })),
    ui.field({ label: T('translations'), help: T('translationsHelp'), input: tTr }),
    ui.field({ label: T('notes'), input: tNotes, optional: true }));
  const advCount = () => ['translations', 'notes', 'key'].filter((k) => (S()[k] || '').trim()).length + ((S().dialect || 'postgres') !== 'postgres' ? 1 : 0);
  const adv = ui.advanced({ label: T('advanced'), body: advBody, count: advCount() });

  // ---- mapper
  const head = h('div', { class: 'mg-head' }, h('h2', { text: T('mapper') }));
  const tools = h('div', { class: 'row' },
    ui.button({ label: T('autoMap'), size: 'sm', variant: 'secondary', icon: 'wand-sparkles', onClick: () => {
      const before = (S().map || []).length; const map = autoMap(S()); set({ map }); rebuild();
      ui.toast(map.length > before ? F('autoMapped', { n: map.length - before }) : T('nothingToAdd'));
    } }),
    ui.button({ label: T('addUnmapped'), size: 'sm', variant: 'secondary', icon: 'list-plus', onClick: () => {
      const before = (S().map || []).length; const map = addUnmappedRows(S()); set({ map }); rebuild();
      if (map.length === before) ui.toast(T('nothingToAdd'));
    } }));
  head.append(tools);
  const hint = h('p', { class: 'mg-hint', text: T('mapperHint') });
  const gridBox = h('div', { class: 'mg-gridbox' });
  let gridEl = null;
  let A = null; // last analysis

  function rowBadge(row) {
    if (!A || (!row.target && !row.source)) return '';
    const list = A.issues.filter((x) => x.level !== 'info' && row.target && x.field === row.target);
    const pv = A.pv.find((p) => p.target === row.target);
    if (!list.length) {
      if (!row.target) return ui.badge({ text: T('covEmpty'), tone: 'neutral', icon: false });
      if (pv && pv.status === 'confirm') { const b = ui.badge({ text: T('st_confirm'), tone: 'warn' }); b.title = pv.confirm; return b; }
      return ui.badge({ text: T('st_ok'), tone: 'ok' });
    }
    const worst = list.find((x) => x.level === 'error') || list[0];
    const b = ui.badge({ text: list.length > 1 ? `${T('lvl_' + worst.level)} · ${list.length}` : T('lvl_' + worst.level), tone: LEVEL_TONE[worst.level] });
    b.title = list.map(issueText).join('\n');
    return b;
  }
  function buildGrid() {
    const m = model(S());
    const rows = S().map || [];
    const srcOpts = [{ value: '', label: T('none') }, ...m.sources.map((s) => ({ value: s.id, label: s.id }))];
    const tgtOpts = [{ value: '', label: T('none') }, ...m.targets.map((t) => ({ value: t.field, label: t.mandatory ? `${t.field} *` : t.field }))];
    for (const r of rows) {
      if (r.source && !srcOpts.some((o) => o.value === r.source)) srcOpts.push({ value: r.source, label: r.source + ' ?' });
      if (r.target && !tgtOpts.some((o) => o.value === r.target)) tgtOpts.push({ value: r.target, label: r.target + ' ?' });
    }
    const tdef = Object.fromEntries(m.targets.map((t) => [t.field, t]));
    gridEl = ui.grid({
      columns: [
        { key: 'source', label: T('colSource'), type: 'select', options: srcOpts, mono: true },
        { key: '_arrow', label: '', width: 24, compute: () => ui.icon('arrow-right', { size: 14 }) },
        { key: 'target', label: T('colTarget'), type: 'select', options: tgtOpts, mono: true },
        { key: 'transformation', label: T('colTransformation'), mono: true, placeholder: 'src.field' },
        { key: 'default', label: T('colDefault'), mono: true, width: 96 },
        { key: '_mand', label: T('colMand'), width: 88, compute: (r) => (tdef[r.target] && tdef[r.target].mandatory ? T('yes') : '') },
        { key: 'rule', label: T('colRule'), mono: true, width: 80 },
        { key: '_check', label: T('colCheck'), width: 120, compute: rowBadge },
      ],
      rows, removable: true, addLabel: T('addRow'),
      newRow: () => ({ source: '', target: '', transformation: '', default: '', rule: '' }),
      onChange: (list) => { set({ map: list.map(({ source, target, transformation, default: d, rule }) => ({ source, target, transformation: transformation || '', default: d || '', rule: rule || '' })) }); later(refreshKeepGrid); },
    });
    gridEl.classList.add('mg-grid');
    gridBox.replaceChildren(gridEl);
  }

  // ---- lower panels
  const checksBox = h('section', { class: 'mg-panel' });
  const covBox = h('section', { class: 'mg-panel' });
  const pvBox = h('section', { class: 'mg-panel mg-preview' });
  const lower = h('div', { class: 'mg-lower' }, h('div', { class: 'mg-col' }, checksBox, covBox), pvBox);
  const empty = ui.emptyState({ icon: 'arrow-left-right', title: T('emptyTitle'), text: T('emptyBody'),
    sample: { label: SAMPLES[getLang() === 'fr' ? 'fr' : 'en'][0].label, onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });

  function paintChecks() {
    const list = A.issues;
    const ul = h('ul', { class: 'mg-issues' });
    if (!list.length) ul.append(h('li', { class: 'mg-none', text: T('noIssues') }));
    // three or more issues of the same kind fold into one line (e.g. the 8 "mandatory, no default" warnings)
    const groups = [];
    for (const x of list) { const g = groups.find((y) => y.code === x.code && y.level === x.level); if (g) g.items.push(x); else groups.push({ code: x.code, level: x.level, items: [x] }); }
    for (const g of groups) {
      const items = g.items.length >= 3 ? [g.items] : g.items.map((x) => [x]);
      for (const it of items) {
        const badge = ui.badge({ text: T('lvl_' + g.level), tone: LEVEL_TONE[g.level], icon: g.level === 'info' ? 'info' : undefined });
        if (it.length === 1) { ul.append(h('li', { class: 'lvl-' + g.level }, badge, h('span', { text: issueText(it[0]) }))); continue; }
        const det = h('details', { class: 'mg-group' }, h('summary', { text: `${issueText(it[0])} (+${it.length - 1})` }), h('ul', {}, ...it.slice(1).map((x) => h('li', { text: issueText(x) }))));
        ul.append(h('li', { class: 'lvl-' + g.level }, badge, det));
      }
    }
    checksBox.replaceChildren(h('h3', { text: `${T('checks')} · ${A.counts.error} / ${A.counts.warning}` }), h('p', { class: 'mg-hint', text: T('checksHint') }), ul);
  }
  function paintCoverage() {
    const ul = h('ul', { class: 'mg-cov' });
    for (const c of A.coverage) {
      const b = ui.badge({ text: T({ mapped: 'covMapped', missing: 'covMissing', empty: 'covEmpty', dup: 'covDup' }[c.status]), tone: COV_TONE[c.status] });
      const badges = h('span', { class: 'mg-cov-b' }, b);
      if (c.confirm) { const cb = ui.badge({ text: T('st_confirm'), tone: 'warn' }); cb.title = c.confirm; badges.prepend(cb); }
      const li = h('li', {}, h('code', { text: c.field + (c.mandatory ? ' *' : '') }), h('span', { class: 'mg-cov-src mono', text: c.sources.join(', ') }), badges);
      ul.append(li);
    }
    covBox.replaceChildren(h('h3', { text: T('coverage') }), h('p', { class: 'mg-hint', text: T('coverageHint') }), ul);
  }
  const outWrap = h('div', { class: 'mg-out' });
  function paintOutput() {
    const p = A.pv = preview(S());
    const tbl = ui.table({
      columns: [
        { key: 'target', label: T('colField'), mono: true },
        { key: 'value', label: T('colValue'), mono: true, format: (v) => (v == null ? '—' : String(v)) },
        { key: 'status', label: T('colStatus'), format: (v, r) => { const b = ui.badge({ text: T('st_' + v), tone: ST_TONE[v] }); if (r.note) b.title = F(r.note.code, r.note.vars); return b; } },
        { key: 'note', label: '', format: (v) => (v ? F(v.code, v.vars) : '') },
      ],
      rows: p,
    });
    outWrap.replaceChildren(h('h4', { text: T('outputRecord') }), tbl);
  }
  function paintPreview() {
    const m = model(S());
    const rec = sampleRecord(S());
    const inp = h('div', { class: 'mg-rec' });
    for (const s of m.sources) {
      const i = ui.input({ value: rec[s.id] ?? '', mono: true, size: 'sm', ariaLabel: s.id, onInput: (v) => { set({ record: { ...(S().record || {}), [s.id]: v } }); A.pv = preview(S()); paintOutput(); } });
      inp.append(h('label', { class: 'mg-rec-k mono', text: s.id }), i);
    }
    const reset = ui.button({ label: T('resetRecord'), size: 'sm', variant: 'ghost', icon: 'rotate-ccw', onClick: () => { set({ record: {} }); paintPreview(); } });
    paintOutput();
    pvBox.replaceChildren(h('h3', { text: T('preview') }), h('p', { class: 'mg-hint', text: T('previewHint') }),
      h('div', { class: 'mg-pv-cols' }, h('div', {}, h('div', { class: 'mg-pv-head' }, h('h4', { text: T('inputRecord') }), reset), inp), outWrap));
  }

  function refreshKeepGrid() {
    A = analyse(S());
    A.pv = preview(S());
    const has = model(S()).targets.length > 0 || (S().map || []).length > 0;
    empty.hidden = has; lower.hidden = !has; gridBox.hidden = !has; head.hidden = !has; hint.hidden = !has;
    if (gridEl) { const rows = gridEl.getRows(); gridEl.querySelectorAll('tbody tr').forEach((tr, ri) => {
      const cell = tr.cells[7]; if (cell && rows[ri]) { const b = rowBadge(rows[ri]); cell.firstChild.replaceChildren(b instanceof Node ? b : document.createTextNode(b)); } }); }
    paintChecks(); paintCoverage(); paintPreview();
    adv.setCount(advCount());
    const text = F('meta', { n: A.coverage.length, e: A.counts.error, w: A.counts.warning });
    ctx.frame.setStatus({ tone: A.counts.error ? 'bad' : A.counts.warning ? 'warn' : 'ok', text });
    return A;
  }
  function rebuild() { A = analyse(S()); A.pv = preview(S()); buildGrid(); refreshKeepGrid(); }
  const refresh = refreshKeepGrid;

  el.append(adv, head, hint, empty, gridBox, lower);
  ctx.__mgRefresh = refreshKeepGrid;
  rebuild();
}

/* ------------------------------------------------------------------------------------------- module */
export default {
  id: 'mapping-grid',
  skill: 'mapping-data',
  icon: 'arrow-left-right',
  title: { en: 'Mapping grid', fr: 'Grille de mapping' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'list-checks' },
  schema: 1,
  defaults() {
    return { title: '', sources: '', targets: '', rules: '', translations: '', targetTable: 'target', key: '', dialect: 'postgres', map: [], record: {}, notes: '' };
  },
  samples: SAMPLES,
  mount,
  validate(s) {
    const errs = [];
    if (!(s.sources || '').trim()) errs.push({ field: 'sources', message: getLang() === 'fr' ? 'Collez au moins un champ source, par ex. dossier.num_dossier, varchar(12), CASE-0405.' : 'Paste at least one source field, for example fraud_case.case_no, varchar(12), CASE-0421.' });
    if (!(s.targets || '').trim()) errs.push({ field: 'targets', message: getLang() === 'fr' ? 'Collez au moins un champ cible, par ex. numero_dossier, varchar(12), O.' : 'Paste at least one target field, for example case_id, varchar(12), Y.' });
    return errs;
  },
  run(state, ctx) {
    const a = ctx.__mgRefresh ? ctx.__mgRefresh() : analyse(state);
    return { targets: a.coverage.length, errors: a.counts.error, warnings: a.counts.warning, unmapped: a.coverage.filter((c) => c.status === 'missing').map((c) => c.field) };
  },
  status(r, ms) {
    return { tone: r.errors ? 'bad' : r.warnings ? 'warn' : 'ok', text: F('meta', { n: r.targets, e: r.errors, w: r.warnings }), ms };
  },
  toMarkdown,
  exports: [
    { id: 'csv', label: { en: strings.en.exportCsv, fr: strings.fr.exportCsv }, build: (s) => ({ name: `${s.targetTable || 'target'}-mapping.csv`, mime: 'text/csv', text: mappingCsv(s) }) },
    { id: 'sql', label: { en: strings.en.exportSql, fr: strings.fr.exportSql }, build: (s) => ({ name: `${s.targetTable || 'target'}-checks.sql`, mime: 'text/plain', text: analyse(s).sql }) },
  ],
  aiActions: [
    { id: 'suggest-transformations', label: { en: strings.en.aiTransform, fr: strings.fr.aiTransform }, prompt: (s) => promptTransform(s), expects: 'markdown' },
    { id: 'draft-dq-rules', label: { en: strings.en.aiRules, fr: strings.fr.aiRules }, prompt: (s) => promptRules(s), expects: 'markdown' },
  ],
  _internals: { toMarkdown, promptTransform, promptRules },
};
