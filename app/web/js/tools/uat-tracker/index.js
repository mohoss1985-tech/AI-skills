/* UAT tracker (running-uat), owner G.
   Run grid (case, tester, status, defect link, evidence) + defects grid → live dashboard: go / no-go gauge with plain
   reasons, progress and day-by-day burn-up, defects by severity. Figures and exit criteria = uat_report.py rules
   (logic.js, node logic.test.mjs checks parity with the script on the skill's example exports). */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { compute, casesFromCsv, defectsFromCsv, runsCsv, defectsCsv, DEFAULT_CRITERIA, CRITERIA, STATUSES, SEVERITIES, DSTATES } from './logic.js';
import { mdCell, fmtVars } from './csv.js';

const T = register('uat-tracker', strings);
const fmt = (k, v) => fmtVars(T(k), v);
const SVGNS = 'http://www.w3.org/2000/svg';
const dec = (x) => { const s = Number.isInteger(x) ? String(x) : x.toFixed(1); return getLang() === 'fr' ? s.replace('.', ',') : s; };
const signed = (x) => (x > 0 ? '+' : x < 0 ? '−' : '±') + dec(Math.abs(x));
const VTONE = { go: 'ok', goRes: 'warn', nogo: 'bad' };
const VICON = { go: 'circle-check', goRes: 'triangle-alert', nogo: 'circle-x' };
const RAGTONE = { green: 'ok', amber: 'warn', red: 'bad' };
const SEVTONE = { blocking: 'bad', major: 'warn', minor: 'neutral', enhancement: 'info' };

function svgEl(name, attrs = {}, text) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

const critLabel = (c) => fmt('c_' + c.id, c.vars);
const critValue = (c) => fmt('cv_' + c.id, { ...c.vars, pct: dec(c.vars.pct ?? 0), list: c.vars.list || T('none') });
const critReason = (c) => fmt('r_' + c.id, { ...c.vars, pct: dec(c.vars.pct ?? 0), min: dec(c.vars.min ?? 0) });
const sevName = (s) => T('sev_' + s);

/* ---------------------------------------------------------------- Markdown daily report (skill §6 "Run" contract) */
function toMarkdown(state) {
  const r = compute(state);
  const V = T('v_' + r.verdict);
  const L = [`## ${T('mdTitle')} · ${state.scope || state.title || ''} · ${fmt('mdDay', { day: r.day, days: r.days })}`, ''];
  const reasons = r.criteria.filter((c) => !c.met).map(critReason);
  L.push(`**${T('mdStatus')}${getLang() === 'fr' ? ' : ' : ': '}${T('rag_' + r.rag).toUpperCase()} · ${V}.** ${reasons.join(' ') || T('noReasons')}`, '');
  L.push(`*${r.forecast ? fmt('forecast', { day: r.day, days: r.days }) : fmt('final', { day: r.day, days: r.days })}. ${T('mdFigures')}*`, '');
  L.push(`### ${T('mdProgress')}`, '', T('mdHead'), '|---|---|---|---|---|---|---|---|');
  L.push(`| ${r.planned} | ${r.executed} | ${r.passed} | ${r.failed} | ${r.blocked} | ${r.notRun} | ${dec(r.executedPct)} % | ${dec(r.passedPct)} % |`, '');
  L.push(fmt('schedule', { day: r.day, days: r.days, exp: dec(r.expectedPct), act: dec(r.executedPct), gap: signed(r.scheduleGap) }), '');
  L.push(T('mdFeature'), '|---|---|---|---|---|');
  for (const f of r.features) L.push(`| ${mdCell(f.feature)} | ${f.pass} | ${f.fail ? `**${f.fail}**` : 0} | ${f.blocked ? `**${f.blocked}**` : 0} | ${f.notrun} |`);
  L.push('', `### ${T('mdDefects')}`, '', fmt('defectsMeta', r.defects), '', T('mdSevHead'), '|---|---|---|');
  for (const s of SEVERITIES) {
    const list = r.defects.list.filter((d) => d.severity === s && (d.status === 'open' || d.status === 'retest'));
    L.push(`| ${sevName(s)} | ${r.defects.bySev[s] ? `**${r.defects.bySev[s]}**` : 0} | ${list.map((d) => `${d.key}${d.workaround ? ` (${T('waShort')})` : ''}${d.status === 'retest' ? ` (${T('ds_retest').toLowerCase()})` : ''}`).join(', ') || '—'} |`);
  }
  L.push('', `### ${T('mdCriteria')}`, '', T('mdCritHead'), '|---|---|---|');
  for (const c of r.criteria) L.push(`| ${critLabel(c)} | ${c.met ? '✅' : '❌'} | ${critValue(c)} |`);
  const top = r.defects.list.filter((d) => (d.status === 'open' || d.status === 'retest') && d.severity !== 'enhancement')
    .sort((a, b) => SEVERITIES.indexOf(a.severity) - SEVERITIES.indexOf(b.severity) || (b.age ?? 0) - (a.age ?? 0));
  L.push('', `### ${T('mdTop')}`, '', T('mdTopHead'), '|---|---|---|---|---|');
  for (const d of top) L.push(`| **${d.key}** ${mdCell(d.summary)} | ${sevName(d.severity)} | ${T('ds_' + d.status)} | ${d.age ?? '—'} | ${d.cases.join(', ') || '—'} |`);
  L.push('', `### ${T('mdRisks')}`, '');
  const bad = (state.cases || []).filter((c) => c.status === 'fail' || c.status === 'blocked');
  if (!bad.length) L.push(`- ${T('mdNoRisk')}`);
  for (const c of bad) L.push(`- ${fmt('mdRiskFail', { id: c.id, title: mdCell(c.title), evidence: mdCell(c.evidence || T('s_' + c.status)) })}`);
  const flags = Object.entries(r.flags);
  if (flags.length) { L.push('', `**${T('mdFlags')}:** ${flags.map(([id, f]) => `${id} (${f.map((x) => T('f_' + x)).join(', ')})`).join(' · ')}`); }
  L.push('', `### ${T('mdDecisions')}`, '');
  const who = state.decisionMaker || 'PO';
  let n = 0;
  for (const d of r.defects.majorWa) L.push(`${++n}. ${fmt('mdDecRes', { who, key: `${d.key} (${mdCell(d.summary)})` })}`);
  for (const d of r.defects.enhancements) L.push(`${++n}. ${fmt('mdDecEnh', { who, key: `${d.key} (${mdCell(d.summary)})` })}`);
  if (r.defects.blocking.length && r.forecast) L.push(`${++n}. ${fmt('mdDecDate', { list: r.defects.blocking.map((d) => d.key).join(', '), days: r.days })}`);
  if (!n) L.push('- —');
  L.push('', `### ${T('mdRecommend')}`, '', `**${V}**${r.reservations.length ? ` · ${T('reservations')}: ${r.reservations.map((d) => d.key).join(', ')}` : ''}`, '');
  return L.join('\n');
}

/* ---------------------------------------------------------------- AI prompts */
function promptTriage(state) {
  const r = compute(state);
  const fr = getLang() === 'fr';
  return [
    'You are the test lead of a card-issuing UAT campaign (skill: running-uat). Triage the defects below.',
    `Scope: ${state.scope || ''}. Day ${r.day} of ${r.days}. Exit criteria: ${r.criteria.map(critLabel).join('; ')}.`,
    'For each defect: confirm or challenge the severity (Blocking = no workaround, critical business process, regulatory or financial error; never downgrade to meet the exit criteria), name an owner role, set a target fix date relative to the campaign day, and say if it is really a change request.',
    'Defects (key; summary; severity; status; workaround accepted; cases):',
    ...r.defects.list.map((d) => `- ${d.key}; ${d.summary}; ${d.severity}; ${d.status}; ${d.workaround ? 'yes' : 'no'}; ${d.cases.join(' ') || '-'}`),
    'Failed or blocked cases:', ...(state.cases || []).filter((c) => c.status === 'fail' || c.status === 'blocked').map((c) => `- ${c.id} ${c.title}: ${c.evidence}`),
    'Scheme rules you cannot verify (e.g. Exception File timings or action codes) stay marked *to confirm*.',
    'Answer as a Markdown table: Defect | Severity (yours) | Why it matters | Owner | Target | Change request?',
    fr ? 'Answer in French.' : 'Answer in English.',
  ].join('\n');
}
function promptPv(state) {
  const fr = getLang() === 'fr';
  return [
    'Draft the PV de recette (UAT sign-off report) for this campaign (skill: running-uat, Close phase).',
    'Structure: scope, period, testers, figures, exit criteria result, open defects accepted with workaround / owner / fix date, reservations, recommendation (GO, GO with reservations or NO-GO with what must happen and a new date), signature block for business owner, IT and PO (left blank: a PV is signed by people).',
    `Testers: ${state.testers || '-'}. Decision maker: ${state.decisionMaker || '-'}.`,
    'Use only the figures below; do not recompute them.', '', toMarkdown(state),
    fr ? 'Answer in French.' : 'Answer in English.',
  ].join('\n');
}

/* ---------------------------------------------------------------- charts */
function gauge(r) {
  const W = 220, H = 128, cx = 110, cy = 112, R = 92;
  const total = r.criteria.length || 1;
  const frac = r.met / total;
  const pt = (f) => [cx - R * Math.cos(Math.PI * f), cy - R * Math.sin(Math.PI * f)];
  const arc = (f0, f1) => { const [x0, y0] = pt(f0), [x1, y1] = pt(f1); return `M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'uat-gauge', role: 'img', 'aria-label': `${T('v_' + r.verdict)}: ${fmt('gaugeMet', { met: r.met, total: r.criteria.length })}` });
  svg.append(svgEl('path', { d: arc(0, 1), class: 'uat-g-track' }));
  // one tick between criteria segments
  if (frac > 0) svg.append(svgEl('path', { d: arc(0, Math.min(frac, 0.999)), class: `uat-g-fill tone-${VTONE[r.verdict]}` }));
  for (let i = 1; i < total; i++) { const [x, y] = pt(i / total); const [x2, y2] = [cx + (x - cx) * 0.82, cy + (y - cy) * 0.82]; svg.append(svgEl('line', { x1: x.toFixed(1), y1: y.toFixed(1), x2: x2.toFixed(1), y2: y2.toFixed(1), class: 'uat-g-tick' })); }
  svg.append(svgEl('text', { x: cx, y: cy - 22, 'text-anchor': 'middle', class: 'uat-g-num' }, `${r.met}/${r.criteria.length}`));
  return svg;
}

function burnup(r) {
  const W = 420, H = 190, pl = 32, pr = 12, pt = 12, pb = 26;
  const max = Math.max(r.planned, 1);
  const sx = (d) => pl + ((d - 1) / Math.max(r.days - 1, 1)) * (W - pl - pr);
  const sy = (v) => H - pb - (v / max) * (H - pt - pb);
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'uat-burn', role: 'img', 'aria-label': T('burnAlt') });
  for (const f of [0, 0.5, 1]) {
    const v = Math.round(max * f);
    svg.append(svgEl('line', { x1: pl, x2: W - pr, y1: sy(v), y2: sy(v), class: 'uat-gl' }));
    svg.append(svgEl('text', { x: pl - 6, y: sy(v) + 4, 'text-anchor': 'end', class: 'uat-tick' }, String(v)));
  }
  for (const b of r.burn) svg.append(svgEl('text', { x: sx(b.day), y: H - 8, 'text-anchor': 'middle', class: 'uat-tick' + (b.day === r.day ? ' is-today' : '') }, fmt('dayShort', { n: b.day })));
  svg.append(svgEl('line', { x1: sx(r.day), x2: sx(r.day), y1: pt, y2: H - pb, class: 'uat-today' }));
  const line = (key, cls) => {
    const pts = r.burn.filter((b) => b[key] != null).map((b) => `${sx(b.day).toFixed(1)},${sy(b[key]).toFixed(1)}`);
    if (pts.length) svg.append(svgEl('polyline', { points: pts.join(' '), class: cls }));
  };
  line('plan', 'uat-l-plan'); line('run', 'uat-l-run'); line('passed', 'uat-l-passed');
  const last = r.burn[r.day - 1];
  if (last) {
    const g = svgEl('g', { class: 'uat-dots' });
    g.append(svgEl('circle', { cx: sx(r.day), cy: sy(last.run), r: 3.5, class: 'uat-d-run' }, null));
    g.append(svgEl('circle', { cx: sx(r.day), cy: sy(last.passed), r: 3.5, class: 'uat-d-passed' }));
    g.append(svgEl('text', { x: sx(r.day) + 6, y: sy(last.run) - 4, class: 'uat-lbl' }, `${T('l_run')} ${last.run}`));
    g.append(svgEl('text', { x: sx(r.day) + 6, y: sy(last.passed) + 12, class: 'uat-lbl' }, `${T('l_passed')} ${last.passed}`));
    svg.append(g);
  }
  return svg;
}

/* ---------------------------------------------------------------- view */
function mount(el, ctx) {
  const { ui } = ctx;
  const S = () => ctx.state;
  if (!Array.isArray(S().cases)) ctx.setState({ cases: [], defects: [] }, { silent: true });

  // ---- command bar: scope · planned · day of days
  const num = (key, label, opts = {}) => {
    const i = ui.input({ type: 'number', value: S()[key] ?? '', mono: true, onInput: (v) => { ctx.setState({ [key]: v === '' ? '' : +v }, { silent: true }); refresh(); } });
    i.min = '1'; if (opts.max) i.max = String(opts.max);
    return ctx.frame.bindField(key, ui.field({ label, input: i, required: true, help: opts.help }));
  };
  const scope = ctx.frame.bindField('scope', ui.field({ label: T('scope'), required: true, help: T('scopeHint'),
    input: ui.input({ value: S().scope || '', onInput: (v) => { ctx.setState({ scope: v }, { silent: true }); } }) }));
  scope.classList.add('uat-scope');
  ctx.frame.command.append(scope, num('planned', T('planned'), { help: T('plannedHint') }), num('day', T('day')), num('days', T('days')));

  // ---- advanced: testers, decision maker, paste exports
  const adv = document.createElement('div'); adv.className = 'uat-adv';
  const row = h('div', 'uat-adv-row');
  row.append(
    ui.field({ label: T('testers'), help: T('testersHint'), input: ui.input({ value: S().testers || '', onInput: (v) => { ctx.setState({ testers: v }, { silent: true }); advCount(); } }) }),
    ui.field({ label: T('decisionMaker'), input: ui.input({ value: S().decisionMaker || '', onInput: (v) => { ctx.setState({ decisionMaker: v }, { silent: true }); advCount(); } }) }),
  );
  const pasteBlock = (labelKey, hintKey, btnKey, apply) => {
    const ta = ui.textarea({ rows: 4, mono: true });
    const f = ui.field({ label: T(labelKey), help: T(hintKey), input: ta });
    const b = ui.button({ label: T(btnKey), size: 'sm', icon: 'import', onClick: () => { const msg = apply(ta.value); if (msg && msg.error) f.setError(msg.error); else { f.setError(''); ta.value = ''; ctx.toast(msg.ok); } } });
    const w = h('div', 'uat-paste'); w.append(f, b); return w;
  };
  adv.append(row,
    pasteBlock('pasteRuns', 'pasteRunsHint', 'replaceRuns', (text) => {
      const { cases, error, unknown } = casesFromCsv(text);
      if (error || !cases.length) return { error: T('pasteNoStatus') };
      ctx.setState({ cases }, { silent: true }); runsGrid.setRows(cases); refresh();
      const u = Object.entries(unknown || {}).map(([k, n]) => `${k || '∅'} ×${n}`).join(', ');
      return { ok: fmt('pasteDone', { n: cases.length }) + (u ? ' · ' + fmt('pasteUnknown', { list: u }) : '') };
    }),
    pasteBlock('pasteDefects', 'pasteDefectsHint', 'replaceDefects', (text) => {
      const { defects, error } = defectsFromCsv(text, S().day);
      if (error || !defects.length) return { error: T('pasteNoKey') };
      ctx.setState({ defects }, { silent: true }); defectsGrid.setRows(defects); refresh();
      return { ok: fmt('pasteDone', { n: defects.length }) };
    }));
  const advanced = ui.advanced({ label: T('advanced'), body: adv });
  const advCount = () => advanced.setCount((S().testers ? 1 : 0) + (S().decisionMaker ? 1 : 0));
  advCount();

  // ---- dashboard
  const dash = h('div', 'uat-dash');
  const pGauge = h('section', 'uat-panel uat-p-gauge');
  const pProg = h('section', 'uat-panel uat-p-prog');
  const pDef = h('section', 'uat-panel uat-p-def');
  dash.append(pGauge, pProg, pDef);

  // ---- grids
  const stOpts = STATUSES.map((s) => ({ value: s, label: T('s_' + s) }));
  const flagCell = (row) => {
    const f = (current().flags[row.id] || []);
    if (!f.length) return '';
    const w = h('span', 'uat-flags');
    for (const x of f) w.append(ui.badge({ text: T('f_' + x), tone: x === 'noEvidence' ? 'neutral' : 'warn' }));
    return w;
  };
  let cache = null;
  const current = () => cache || (cache = compute(S()));
  const nextId = (rows) => {
    const pre = (rows.find((r) => r.id) || { id: 'UAT-00' }).id.replace(/\d+$/, '');
    return `${pre}${String(rows.length + 1).padStart(2, '0')}`;
  };
  const runsGrid = ui.grid({
    columns: [
      { key: 'id', label: T('colId'), mono: true, width: 76 },
      { key: 'title', label: T('colTitle') },
      { key: 'feature', label: T('colFeature'), width: 150 },
      { key: 'req', label: T('colReq'), mono: true, width: 96 },
      { key: 'tester', label: T('colTester'), width: 80 },
      { key: 'status', label: T('colStatus'), type: 'select', options: stOpts, width: 118 },
      { key: 'defect', label: T('colDefect'), mono: true, width: 96 },
      { key: 'evidence', label: T('colEvidence') },
      { key: 'day', label: T('colDay'), type: 'number', width: 56 },
      { key: '_flags', label: T('colFlags'), width: 150, compute: flagCell },
    ],
    rows: S().cases, removable: true, addLabel: T('addCase'),
    newRow: (rows) => ({ id: nextId(rows), title: '', feature: '', req: '', tester: '', status: 'notrun', defect: '', evidence: '', day: '', expected: '' }),
    onChange: (rows) => {
      const prev = S().cases || [];
      let filled = -1;
      rows.forEach((r, i) => {
        const p = prev[i];
        if (p && p.id === r.id && p.status !== r.status) {
          if (r.status === 'notrun') r.day = '';
          else if (r.day === '' || r.day == null) { r.day = +S().day || 1; filled = i; }
        }
      });
      ctx.setState({ cases: rows }, { silent: true });
      if (filled >= 0) { const a = document.activeElement; runsGrid.setRows(rows); const cell = a && a.dataset && a.dataset.cell; if (cell) { const [ri, ci] = cell.split(':').map(Number); runsGrid.focusCell(ri, ci); } }
      refresh();
    },
  });
  runsGrid.classList.add('uat-grid');

  const defectsGrid = ui.grid({
    columns: [
      { key: 'key', label: T('colKey'), mono: true, width: 96 },
      { key: 'summary', label: T('colSummary') },
      { key: 'severity', label: T('colSeverity'), type: 'select', options: SEVERITIES.map((s) => ({ value: s, label: sevName(s) })), width: 124 },
      { key: 'status', label: T('colDStatus'), type: 'select', options: DSTATES.map((s) => ({ value: s, label: T('ds_' + s) })), width: 140 },
      { key: 'feature', label: T('colFeature'), width: 150 },
      { key: 'created', label: T('colCreated'), type: 'number', width: 72 },
      { key: 'workaround', label: T('colWa'), type: 'check', width: 96 },
      { key: '_cases', label: T('colCases'), width: 120, compute: (row) => { const d = current().defects.list.find((x) => x.key === row.key); return d ? d.cases.join(', ') : ''; } },
    ],
    rows: S().defects || [], removable: true, addLabel: T('addDefect'),
    newRow: (rows) => {
      const pre = ((rows.find((r) => r.key) || {}).key || (getLang() === 'fr' ? 'CARTE-300' : 'CARD-300')).replace(/\d+$/, '');
      const max = Math.max(300, ...rows.map((r) => +String(r.key || '').replace(/^\D+/, '') || 0));
      return { key: pre + (max + 1), summary: '', severity: 'major', status: 'open', feature: '', created: +S().day || 1, workaround: false };
    },
    onChange: (rows) => { ctx.setState({ defects: rows }, { silent: true }); refresh(); },
  });
  defectsGrid.classList.add('uat-grid');

  // ---- exit criteria editor
  const critPanel = h('div', 'uat-crit');
  const critHint = h('p', 'uat-hint', T('criteriaHint'));
  const critList = h('div', 'uat-crit-list');
  const crit = { ...DEFAULT_CRITERIA, ...(S().criteria || {}) };
  const critRows = {};
  for (const id of CRITERIA) {
    const line = h('label', 'uat-crit-row');
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = crit[id] !== false;
    cb.addEventListener('change', () => { crit[id] = cb.checked; ctx.setState({ criteria: { ...crit } }, { silent: true }); refresh(); });
    const txt = h('span', 'uat-crit-txt');
    const state = h('span', 'uat-crit-state');
    line.append(cb, txt, state);
    critRows[id] = { txt, state };
    critList.append(line);
  }
  const minI = ui.input({ type: 'number', value: crit.passRateMin, mono: true, size: 'sm', onInput: (v) => { crit.passRateMin = +v || 0; ctx.setState({ criteria: { ...crit } }, { silent: true }); refresh(); } });
  minI.min = '0'; minI.max = '100';
  const minF = ui.field({ label: T('passRateMin'), input: minI }); minF.classList.add('uat-min');
  critPanel.append(critHint, critList, minF);

  const tabs = ui.tabs({ tabs: [{ id: 'runs', label: T('tabRuns') }, { id: 'defects', label: T('tabDefects') }, { id: 'criteria', label: T('tabCriteria') }],
    active: 'runs', panels: { runs: runsGrid, defects: defectsGrid, criteria: critPanel } });

  const empty = ui.emptyState({ icon: 'clipboard-check', title: T('emptyTitle'), text: T('emptyBody'),
    action: { label: T('addCase'), onClick: () => runsGrid.addRow(true) },
    sample: { label: getLang() === 'fr' ? 'CB FR' : 'Visa EN', onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });

  /* ---- paint */
  function paintGauge(r) {
    pGauge.replaceChildren();
    const head = h('div', 'uat-p-head'); head.append(h('h2', null, T('gauge')), ui.badge({ text: T('rag_' + r.rag), tone: RAGTONE[r.rag], icon: 'circle' }));
    const g = h('div', 'uat-g'); g.append(gauge(r));
    const v = h('div', `uat-verdict tone-${VTONE[r.verdict]}`);
    v.append(ui.icon(VICON[r.verdict], { size: 20 }), h('span', null, T('v_' + r.verdict)));
    const sub = h('p', 'uat-sub', `${fmt('gaugeMet', { met: r.met, total: r.criteria.length })} · ${r.forecast ? fmt('forecast', { day: r.day, days: r.days }) : fmt('final', { day: r.day, days: r.days })}`);
    g.append(v, sub);
    const list = h('ul', 'uat-crit-sum');
    for (const c of r.criteria) {
      const li = h('li', c.met ? 'is-met' : 'is-miss');
      li.append(ui.icon(c.met ? 'check' : 'x', { size: 14 }), h('span', 'uat-cs-l', critLabel(c)), h('span', 'uat-cs-v num', critValue(c)));
      list.append(li);
    }
    const why = h('div', 'uat-why');
    const miss = r.criteria.filter((c) => !c.met);
    why.append(h('h3', null, T('reasons')));
    const ul = h('ul');
    if (!miss.length) ul.append(h('li', null, T('noReasons')));
    for (const c of miss) ul.append(h('li', null, critReason(c)));
    why.append(ul);
    if (r.reservations.length) {
      why.append(h('h3', null, T('reservations')));
      const ul2 = h('ul');
      for (const d of r.reservations) ul2.append(h('li', null, fmt(d.severity === 'major' ? 'res_line' : 'res_minor', { key: d.key, summary: d.summary, sev: sevName(d.severity).toLowerCase() })));
      why.append(ul2);
    }
    pGauge.append(head, g, list, why);
  }
  function paintProgress(r) {
    pProg.replaceChildren();
    pProg.append(h('h2', null, T('progress')));
    const k = h('div', 'uat-kpis');
    const kpi = (label, n, pct, tone) => {
      const b = h('div', 'uat-kpi' + (tone ? ' tone-' + tone : ''));
      b.append(h('span', 'uat-kpi-l', label), h('span', 'uat-kpi-n num', String(n)), h('span', 'uat-kpi-s num', pct != null ? `${dec(pct)} % ${T('ofPlanned')}` : `/ ${r.planned}`));
      return b;
    };
    k.append(kpi(T('k_run'), r.executed, r.executedPct), kpi(T('k_passed'), r.passed, r.passedPct), kpi(T('k_blocked'), r.blocked, null, r.blocked ? 'warn' : ''), kpi(T('k_notRun'), r.notRun, null));
    const sch = h('p', 'uat-sub', fmt('schedule', { day: r.day, days: r.days, exp: dec(r.expectedPct), act: dec(r.executedPct), gap: signed(r.scheduleGap) }));
    const bh = h('div', 'uat-p-head'); bh.append(h('h3', null, T('burnup')));
    const leg = h('div', 'uat-legend');
    for (const [c, l] of [['plan', 'l_plan'], ['run', 'l_run'], ['passed', 'l_passed']]) { const s = h('span', 'uat-key k-' + c); s.append(h('i'), document.createTextNode(T(l))); leg.append(s); }
    bh.append(leg);
    pProg.append(k, sch, bh, burnup(r));
  }
  function paintDefects(r) {
    pDef.replaceChildren();
    pDef.append(h('h2', null, T('defectsBySev')), h('p', 'uat-sub', fmt('defectsMeta', r.defects)));
    const max = Math.max(1, ...SEVERITIES.map((s) => r.defects.bySev[s] + r.defects.closedBySev[s]));
    const bars = h('div', 'uat-bars');
    for (const s of SEVERITIES) {
      const rowEl = h('div', 'uat-bar-row');
      const lab = h('span', 'uat-bar-l'); lab.append(ui.badge({ text: sevName(s), tone: SEVTONE[s] }));
      const track = h('span', 'uat-bar-t');
      const a = h('span', `uat-bar-live tone-${SEVTONE[s]}`); a.style.width = `${(100 * r.defects.bySev[s]) / max}%`;
      const b = h('span', 'uat-bar-done'); b.style.width = `${(100 * r.defects.closedBySev[s]) / max}%`;
      track.append(a, b);
      const n = h('span', 'uat-bar-n num', `${r.defects.bySev[s]}${r.defects.closedBySev[s] ? ` + ${r.defects.closedBySev[s]}` : ''}`);
      const keys = r.defects.list.filter((d) => d.severity === s && (d.status === 'open' || d.status === 'retest')).map((d) => d.key).join(', ');
      rowEl.title = keys;
      rowEl.append(lab, track, n);
      bars.append(rowEl);
      if (keys) bars.append(h('div', 'uat-bar-keys mono', keys));
    }
    const leg = h('div', 'uat-legend');
    for (const [c, l] of [['live', 'liveLegend'], ['done', 'doneLegend']]) { const s2 = h('span', 'uat-key k-' + c); s2.append(h('i'), document.createTextNode(T(l))); leg.append(s2); }
    pDef.append(bars, leg);
  }
  function refresh() {
    cache = null;
    const r = current();
    const has = (S().cases || []).length > 0;
    empty.hidden = has; dash.hidden = !has;
    tabs.setCount && (tabs.setCount('runs', (S().cases || []).length), tabs.setCount('defects', (S().defects || []).length), tabs.setCount('criteria', r.criteria.length));
    for (const id of CRITERIA) {
      const c = r.criteria.find((x) => x.id === id) || { id, vars: { min: crit.passRateMin, pct: r.passedPct }, met: null };
      critRows[id].txt.textContent = critLabel({ ...c, vars: { ...c.vars, min: crit.passRateMin } });
      critRows[id].state.replaceChildren(c.met == null ? '' : ui.badge({ text: critValue(c), tone: c.met ? 'ok' : 'bad' }));
    }
    if (has) { paintGauge(r); paintProgress(r); paintDefects(r); }
    // recompute flag / cases columns without repainting inputs
    runsGrid.querySelectorAll('[data-cell]').length && refreshComputed(runsGrid, 9, (i) => flagCell((S().cases || [])[i] || {}));
    refreshComputed(defectsGrid, 7, (i) => { const k = ((S().defects || [])[i] || {}).key; const d = r.defects.list.find((x) => x.key === k); return d ? d.cases.join(', ') : ''; });
    ctx.frame.setStatus({ tone: VTONE[r.verdict], text: fmt('statusText', { verdict: T('v_' + r.verdict), met: r.met, total: r.criteria.length, run: dec(r.executedPct) }) });
    return r;
  }
  function refreshComputed(gridEl, ci, fn) {
    gridEl.querySelectorAll(`[data-cell$=":${ci}"]`).forEach((s) => { const ri = +s.dataset.cell.split(':')[0]; const v = fn(ri); s.replaceChildren(v instanceof Node ? v : document.createTextNode(v ?? '')); });
  }
  el.append(advanced, empty, dash, tabs);
  ctx.__uatRefresh = refresh;
  refresh();
}

/* ---------------------------------------------------------------- module */
const sampleList = (lang) => SAMPLES[lang].map((s) => ({ id: s.id, label: s.title, hint: s.client, state: s.state, autorun: true }));

export default {
  id: 'uat-tracker',
  skill: 'running-uat',
  icon: 'clipboard-check',
  title: { en: 'UAT tracker', fr: 'Suivi de recette' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'gauge' },
  schema: 1,
  defaults() {
    return { title: '', scope: '', planned: '', day: 1, days: 10, testers: '', decisionMaker: '', criteria: { ...DEFAULT_CRITERIA }, cases: [], defects: [] };
  },
  samples: { en: sampleList('en'), fr: sampleList('fr') },
  mount,
  validate(s) {
    const e = [];
    if (!String(s.scope || '').trim()) e.push({ field: 'scope', message: T('errScope') });
    if (!(+s.planned > 0)) e.push({ field: 'planned', message: T('errPlanned') });
    if (!(+s.day >= 1 && +s.days >= 1 && +s.day <= +s.days)) e.push({ field: 'day', message: T('errDay') });
    return e;
  },
  run(state, ctx) {
    const r = ctx.__uatRefresh ? ctx.__uatRefresh() : compute(state);
    return { verdict: r.verdict, met: r.met, total: r.criteria.length, executedPct: r.executedPct, passedPct: r.passedPct, rag: r.rag,
      failed: r.criteria.filter((c) => !c.met).map((c) => c.id) };
  },
  status(res, ms) {
    return { tone: VTONE[res.verdict], text: fmt('statusText', { verdict: T('v_' + res.verdict), met: res.met, total: res.total, run: dec(res.executedPct) }), ms };
  },
  toMarkdown,
  exports: [
    { id: 'runs-csv', label: { en: strings.en.exportRuns, fr: strings.fr.exportRuns }, build: (s) => ({ name: 'uat-test-runs.csv', mime: 'text/csv', text: runsCsv(s) }) },
    { id: 'defects-csv', label: { en: strings.en.exportDefects, fr: strings.fr.exportDefects }, build: (s) => ({ name: 'uat-defects.csv', mime: 'text/csv', text: defectsCsv(s) }) },
  ],
  aiActions: [
    { id: 'triage', label: { en: strings.en.aiTriage, fr: strings.fr.aiTriage }, prompt: (s) => promptTriage(s), expects: 'markdown' },
    { id: 'pv', label: { en: strings.en.aiPv, fr: strings.fr.aiPv }, prompt: (s) => promptPv(s), expects: 'markdown' },
  ],
  _internals: { toMarkdown, compute },
};
