/* RACI & power grid (aligning-stakeholders), owner J.
   Stakeholder grid + draggable power / interest 2×2 (plain SVG, keyboard-movable) with an engagement strategy per
   quadrant; RACI matrix with live validation (exactly one A and at least one R per row; overload per person);
   decision memo (skill §2 template). Logic = logic.js (node logic.test.mjs). */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { fmtT, h, mdTable } from '../workshop-kit/jshared.js';
import { QUADS, DEFAULT_OVERLOAD, clamp, quadrant, cycle, rowCheck, analyse, nextSid, nextAid, raciCsv, stakeholdersCsv, stakeholdersFromCsv } from './logic.js';

const T = register('raci-grid', strings);
const fmt = fmtT(T);
const SVGNS = 'http://www.w3.org/2000/svg';
const svg = (name, attrs = {}, text) => { const e = document.createElementNS(SVGNS, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); if (text != null) e.textContent = text; return e; };
const strategy = (s, q) => ((s.strategies || {})[q] || '').trim() || T('s_' + q);
const issueText = (c) => c.issues.map((i) => (i === 'multiA' ? fmt('multiA', { n: c.a }) : T(i))).join(' · ');

/* ------------------------------------------------------------------------------------------- Markdown */
function memoMd(s) {
  const people = s.stakeholders || [];
  const consulted = [...new Set((s.activities || []).flatMap((a) => people.filter((p) => (a.raci || {})[p.id] === 'C').map((p) => p.name)))];
  const opts = (s.options || []).filter((o) => o.option);
  return [
    `# ${T('mdDecision')}: ${s.decision || T('mdToComplete')}`,
    `**${T('mdDecideBy')}:** ${s.decideBy || T('mdToComplete')} · **${T('mdDecider')}:** ${s.decider || T('mdToComplete')}`, '',
    `## ${T('mdContext')}`, s.context || T('mdToComplete'), '',
    `## ${T('mdOptions')}`, opts.length ? mdTable([T('colOption'), T('colCustomer'), T('colBusiness'), T('colEffort'), T('colRisk'), T('colPrefers')], opts.map((o) => [o.option, o.customer, o.business, o.effort, o.risk, o.prefers])) : T('mdToComplete'), '',
    `## ${T('mdReco')}`, s.recommendation || T('mdToComplete'), '',
    `## ${T('mdIfNot')}`, s.ifNot || T('mdToComplete'), '',
    `## ${T('mdConsulted')}`, consulted.join(', ') || T('mdToComplete'), '',
  ].join('\n');
}
function toMarkdown(s) {
  const r = analyse(s); const people = s.stakeholders || [];
  const L = [`## ${T('mdTitle')}${s.decision ? ` · ${s.decision}` : ''}`, '', `### ${T('mdMap')}`,
    people.length ? mdTable([T('colId'), T('colName'), T('colRole'), T('colCares'), T('colPower'), T('colInterest'), T('colQuad')], people.map((p) => [p.id, p.name, p.role, p.cares, clamp(p.power), clamp(p.interest), T('q_' + quadrant(p))])) : '—', '',
    `### ${T('mdQuads')}`];
  for (const q of QUADS) L.push(`- **${T('q_' + q)}** (${r.quads[q].map((p) => p.name).join(', ') || '—'}): ${strategy(s, q)}`);
  L.push('', `### ${T('mdRaci')}`, (s.activities || []).length ? mdTable([T('activity'), ...people.map((p) => p.name), T('check')],
    (s.activities || []).map((a) => { const c = rowCheck(a, people); return [`${a.id} ${a.name}`, ...people.map((p) => (a.raci || {})[p.id] || ''), c.issues.length ? '✗ ' + issueText(c) : '✓']; })) : '—');
  L.push('', `_${T('legend')}_`, '', `### ${T('mdChecks')}`);
  const bad = r.rows.filter((x) => x.issues.length);
  if (!bad.length && !r.overloaded.length) L.push(`- ✓ ${T('mdAllOk')}`);
  for (const x of bad) L.push(`- ✗ ${fmt('mdRowIssue', { id: x.id, name: x.name, issues: issueText(x) })}`);
  for (const o of r.overloaded) L.push(`- ⚠ ${fmt('mdOver', { name: (people.find((p) => p.id === o.id) || {}).name, n: o.load, t: s.overload || DEFAULT_OVERLOAD })}`);
  L.push('', memoMd(s).replace(/^# /m, '### ').replace(/^## /gm, '#### '));
  return L.join('\n');
}

/* ------------------------------------------------------------------------------------------- AI */
const ctxLine = () => (getLang() === 'fr' ? 'Context: Banque Lumière (fictional), CB cards, GIE CB. Anything only the CB rulebook can confirm is *to confirm*. Answer in French.'
  : 'Context: Harbor Bank (fictional), Visa cards. Anything only the Visa rulebook can confirm is *to confirm*. Answer in English.');
const peopleLines = (s) => (s.stakeholders || []).map((p) => `- ${p.name}, ${p.role} (power ${clamp(p.power)}, interest ${clamp(p.interest)}, ${quadrant(p)}): cares about ${p.cares || '?'}`);
function promptMemo(s) {
  return ['You are a Product Owner preparing a one-page decision memo (skill: aligning-stakeholders, §2).', ctxLine(),
    `Decision: ${s.decision}`, `Decider: ${s.decider} · decide by ${s.decideBy}`, `Context: ${s.context || '(none)'}`,
    'Stakeholders:', ...peopleLines(s),
    'Options so far:', ...(s.options || []).map((o) => `- ${o.option}: customer ${o.customer}; business ${o.business}; effort ${o.effort}; risk ${o.risk}; preferred by ${o.prefers}`),
    `Draft recommendation: ${s.recommendation || '(none)'}`,
    'Write the memo with exactly these sections: Decision needed (decide by, decider) · Context (2–3 sentences with the number that matters) · Options table (customer impact, business impact, effort, risk, who prefers it) · Recommendation (one paragraph) · If we don\'t decide · Consulted (with any dissent, not hidden).',
    'Readable in five minutes by the decider. Label it "AI-assisted draft".'].join('\n');
}
function promptSteer(s) {
  const r = analyse(s);
  return ['You are a Product Owner writing a steering committee update (skill: aligning-stakeholders, §3).', ctxLine(),
    `Topic: ${s.decision}`, `Context: ${s.context || '(none)'}`, 'Stakeholders:', ...peopleLines(s),
    `RACI issues: ${r.rows.filter((x) => x.issues.length).map((x) => `${x.name} (${x.issues.join(', ')})`).join('; ') || 'none'}`,
    'Sections, one screen each: Headline (on track / at risk / off track and why) · Outcomes vs target · Delivered since last time · Next 3 priorities · Risks & decisions needed (owner, date) · Asks.',
    'Adapt the tone to the "Manage closely" audience. Metrics are outcomes, not activity counts. Label it "AI-assisted draft".'].join('\n');
}

/* ------------------------------------------------------------------------------------------- view */
function mount(el, ctx) {
  const { ui, frame } = ctx;
  const st = () => ctx.state;
  for (const k of ['stakeholders', 'activities', 'options']) if (!Array.isArray(st()[k])) ctx.setState({ [k]: [] }, { silent: true });
  const set = (patch) => { ctx.setState(patch, { silent: true }); refresh(); };

  // ---- command bar
  const fDec = frame.bindField('decision', ui.field({ label: T('decision'), required: true, input: ui.input({ value: st().decision || '', placeholder: T('decisionPh'), onInput: (v) => set({ decision: v }) }) }));
  const fDecider = ui.field({ label: T('decider'), input: ui.input({ value: st().decider || '', placeholder: T('deciderPh'), onInput: (v) => set({ decider: v }) }) });
  const fBy = ui.field({ label: T('decideBy'), input: ui.input({ type: 'date', value: st().decideBy || '', onInput: (v) => set({ decideBy: v }) }) });
  fDec.classList.add('rg-dec'); fDecider.classList.add('rg-decider');
  frame.command.append(fDec, fDecider, fBy);

  // ---- advanced
  const ov = ui.input({ type: 'number', value: st().overload ?? DEFAULT_OVERLOAD, mono: true, size: 'sm', onInput: (v) => set({ overload: +v || DEFAULT_OVERLOAD }) }); ov.min = '1';
  const ctxIn = ui.textarea({ value: st().context || '', rows: 2, onInput: (v) => set({ context: v }) });
  const pasteArea = ui.textarea({ rows: 3, mono: true, placeholder: 'name,role,cares_about,power,interest' });
  const pasteField = ui.field({ label: T('paste'), help: T('pasteHint'), input: pasteArea });
  const pasteBtn = ui.button({ label: T('pasteApply'), size: 'sm', icon: 'import', onClick: () => {
    const list = stakeholdersFromCsv(pasteArea.value);
    if (!list.length) { pasteField.setError(T('pasteBad')); return; }
    pasteField.setError(''); pasteArea.value = ''; set({ stakeholders: list }); peopleGrid.setRows(list); refresh();
  } });
  const advCount = () => ((+st().overload || DEFAULT_OVERLOAD) !== DEFAULT_OVERLOAD ? 1 : 0) + (st().context ? 1 : 0);
  const adv = ui.advanced({ label: T('advanced'), count: advCount(), body: h('div', { class: 'rg-adv' }, ui.field({ label: T('overload'), input: ov }), ui.field({ label: T('context'), input: ctxIn }), pasteField, h('div', {}, pasteBtn)) });

  const pill = ui.statusPill({ tone: 'neutral', text: '' });

  // ---- MAP: stakeholder grid + 2×2 + strategies
  const peopleGrid = ui.grid({
    columns: [
      { key: 'id', label: T('colId'), type: 'readonly', width: 48 },
      { key: 'name', label: T('colName'), width: 120 },
      { key: 'role', label: T('colRole') },
      { key: 'cares', label: T('colCares') },
      { key: 'power', label: T('colPower'), type: 'number', width: 72 },
      { key: 'interest', label: T('colInterest'), type: 'number', width: 72 },
      { key: '_q', label: T('colQuad'), width: 140, compute: (row) => T('q_' + quadrant(row)) },
    ],
    rows: st().stakeholders, removable: true, addLabel: T('addStakeholder'),
    newRow: (rows) => ({ id: nextSid(rows), name: T('newName'), role: '', cares: '', power: 50, interest: 50 }),
    onChange: (rows) => set({ stakeholders: rows.map((r) => ({ ...r, power: clamp(r.power), interest: clamp(r.interest) })) }),
  });
  peopleGrid.classList.add('rg-people');
  const W = 420, P = 36, SZ = W - 2 * P;
  const chart = svg('svg', { viewBox: `0 0 ${W} ${W}`, class: 'rg-chart', role: 'group', 'aria-label': T('grid') });
  const stratBox = h('div', { class: 'rg-strats' });
  const empty = ui.emptyState({ icon: 'users', title: T('emptyTitle'), text: T('empty'), action: { label: T('addStakeholder'), onClick: () => peopleGrid.addRow(true) },
    sample: { label: T('load'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });
  const mapPanel = h('div', {}, empty, h('h2', { text: T('stakeholders') }), peopleGrid,
    h('div', { class: 'rg-map' }, h('section', {}, h('h2', { text: T('grid') }), h('p', { class: 'rg-hint', text: T('gridHint') }), chart),
      h('section', {}, h('h2', { text: T('strategies') }), stratBox)));

  const toXY = (p) => ({ x: P + (clamp(p.interest) / 100) * SZ, y: P + SZ - (clamp(p.power) / 100) * SZ });
  function paintChart() {
    chart.replaceChildren();
    const quadRect = [['satisfy', P, P], ['manage', P + SZ / 2, P], ['monitor', P, P + SZ / 2], ['inform', P + SZ / 2, P + SZ / 2]];
    for (const [q, x, y] of quadRect) {
      chart.append(svg('rect', { x, y, width: SZ / 2, height: SZ / 2, class: 'rg-q rg-q-' + q }));
      chart.append(svg('text', { x: x + 8, y: y + 18, class: 'rg-qlabel' }, T('q_' + q)));
    }
    chart.append(svg('text', { x: P + SZ / 2, y: W - 8, class: 'rg-axis', 'text-anchor': 'middle' }, `${T('axisInterest')} →`));
    chart.append(svg('text', { x: 14, y: P + SZ / 2, class: 'rg-axis', 'text-anchor': 'middle', transform: `rotate(-90 14 ${P + SZ / 2})` }, `${T('axisPower')} →`));
    for (const p of st().stakeholders || []) {
      const { x, y } = toXY(p);
      const g = svg('g', { class: 'rg-dot', tabindex: '0', role: 'slider', 'aria-label': fmt('dotAria', { name: p.name, p: clamp(p.power), i: clamp(p.interest) }), 'aria-valuetext': `${T('axisPower')} ${clamp(p.power)}, ${T('axisInterest')} ${clamp(p.interest)}`, transform: `translate(${x} ${y})` });
      g.append(svg('title', {}, `${p.name} · ${p.role}\n${T('axisPower')} ${clamp(p.power)} · ${T('axisInterest')} ${clamp(p.interest)}`));
      g.append(svg('circle', { r: 9 }));
      g.append(svg('text', { x: 13, y: 4, class: 'rg-dlabel' }, p.name));
      g.dataset.id = p.id;
      chart.append(g);
    }
  }
  const movePerson = (id, power, interest, final) => {
    const list = (st().stakeholders || []).map((p) => (p.id === id ? { ...p, power: clamp(power), interest: clamp(interest) } : p));
    ctx.setState({ stakeholders: list }, { silent: true });
    const p = list.find((x) => x.id === id); const g = chart.querySelector(`g[data-id="${id}"]`);
    if (g && p) { const { x, y } = toXY(p); g.setAttribute('transform', `translate(${x} ${y})`); g.setAttribute('aria-label', fmt('dotAria', { name: p.name, p: p.power, i: p.interest })); }
    if (final) { peopleGrid.setRows(list); refresh({ keepChart: true }); }
  };
  let drag = null;
  chart.addEventListener('pointerdown', (e) => {
    const g = e.target.closest('.rg-dot'); if (!g) return;
    drag = g.dataset.id; g.setPointerCapture(e.pointerId); g.classList.add('is-drag'); g.focus(); e.preventDefault();
  });
  const pt = (e) => { const m = chart.getScreenCTM().inverse(); const q = new DOMPoint(e.clientX, e.clientY).matrixTransform(m); return { interest: ((q.x - P) / SZ) * 100, power: ((P + SZ - q.y) / SZ) * 100 }; };
  chart.addEventListener('pointermove', (e) => { if (!drag) return; const v = pt(e); movePerson(drag, v.power, v.interest, false); });
  const end = (e) => { if (!drag) return; const v = pt(e); const id = drag; drag = null; chart.querySelectorAll('.is-drag').forEach((g) => g.classList.remove('is-drag')); movePerson(id, v.power, v.interest, true); };
  chart.addEventListener('pointerup', end); chart.addEventListener('pointercancel', end);
  chart.addEventListener('keydown', (e) => {
    const g = e.target.closest('.rg-dot'); if (!g) return;
    const d = { ArrowUp: [1, 0], ArrowDown: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] }[e.key]; if (!d) return;
    e.preventDefault(); const step = e.shiftKey ? 1 : 5;
    const p = (st().stakeholders || []).find((x) => x.id === g.dataset.id); if (!p) return;
    movePerson(p.id, clamp(p.power) + d[0] * step, clamp(p.interest) + d[1] * step, true);
  });
  function paintStrats() {
    const r = analyse(st());
    stratBox.replaceChildren(...QUADS.map((q) => {
      const ta = ui.textarea({ value: strategy(st(), q), rows: 2, ariaLabel: T('q_' + q), onInput: (v) => ctx.setState({ strategies: { ...(st().strategies || {}), [q]: v } }, { silent: true }) });
      return h('div', { class: 'rg-strat rg-s-' + q }, h('h3', {}, h('span', { text: T('q_' + q) }), h('span', { class: 'rg-names', text: r.quads[q].map((p) => p.name).join(', ') || T('nobody') })), ta);
    }));
  }

  // ---- RACI matrix (custom table: cells cycle R → A → C → I → empty)
  const raciBox = h('div', { class: 'rg-raci-wrap table-wrap' });
  const raciPanel = h('div', {}, h('div', { class: 'rg-sec-head' }, h('h2', { text: T('raci') }), ui.button({ label: T('addActivity'), icon: 'plus', size: 'sm', variant: 'secondary', onClick: () => {
    const acts = [...(st().activities || []), { id: nextAid(st().activities), name: T('newActivity'), raci: {} }];
    set({ activities: acts }); paintRaci(); raciBox.querySelector('tbody tr:last-child input')?.select();
  } })), h('p', { class: 'rg-hint', text: T('raciHint') }), raciBox, h('p', { class: 'rg-hint', text: T('legend') }));
  const setCell = (aid, pid, v) => {
    const acts = (st().activities || []).map((a) => (a.id === aid ? { ...a, raci: { ...(a.raci || {}), [pid]: v } } : a));
    set({ activities: acts });
  };
  function paintRaci() {
    const people = st().stakeholders || [], acts = st().activities || [];
    if (!people.length) { raciBox.replaceChildren(h('p', { class: 'rg-hint', text: T('noPeople') })); return; }
    const r = analyse(st());
    const table = h('table', { class: 'table rg-raci' });
    table.append(h('thead', {}, h('tr', {}, h('th', { scope: 'col', text: T('activity') }), ...people.map((p) => h('th', { scope: 'col', class: 'rg-c', title: p.role, text: p.name })), h('th', { scope: 'col', text: T('check') }), h('th', { scope: 'col' }, h('span', { class: 'sr-only', text: T('remove') })))));
    const tb = h('tbody');
    acts.forEach((a, ri) => {
      const c = rowCheck(a, people);
      const name = ui.input({ value: a.name, ariaLabel: `${T('activity')} ${a.id}`, size: 'sm', onChange: (v) => set({ activities: (st().activities || []).map((x) => (x.id === a.id ? { ...x, name: v } : x)) }) });
      const tr = h('tr', { class: c.issues.length ? 'is-bad' : '' }, h('th', { scope: 'row', class: 'rg-act' }, h('code', { text: a.id }), name));
      people.forEach((p, ci) => {
        const v = (a.raci || {})[p.id] || '';
        const b = h('button', { type: 'button', class: 'rg-cell rg-v-' + (v || 'none'), 'data-r': ri, 'data-c': ci, 'aria-label': `${a.name} · ${p.name}: ${v || '—'}`, text: v || '·' });
        b.onclick = () => { setCell(a.id, p.id, cycle(v)); paintRaci(); focusCell(ri, ci); };
        b.onkeydown = (e) => {
          const k = e.key.toLowerCase();
          if (['r', 'a', 'c', 'i'].includes(k)) { e.preventDefault(); setCell(a.id, p.id, k.toUpperCase()); paintRaci(); focusCell(ri, ci); }
          else if (k === 'delete' || k === 'backspace') { e.preventDefault(); setCell(a.id, p.id, ''); paintRaci(); focusCell(ri, ci); }
          else { const d = { arrowup: [-1, 0], arrowdown: [1, 0], arrowleft: [0, -1], arrowright: [0, 1] }[k]; if (d) { e.preventDefault(); focusCell(ri + d[0], ci + d[1]); } }
        };
        tr.append(h('td', { class: 'rg-c' }, b));
      });
      tr.append(h('td', {}, c.issues.length ? ui.badge({ text: issueText(c), tone: 'bad', icon: 'circle-x' }) : ui.badge({ text: T('rowOk'), tone: 'ok', icon: 'circle-check' })));
      tr.append(h('td', {}, ui.button({ icon: 'trash-2', variant: 'ghost', size: 'sm', ariaLabel: `${T('remove')} ${a.id}`, onClick: () => { set({ activities: (st().activities || []).filter((x) => x.id !== a.id) }); paintRaci(); } })));
      tb.append(tr);
    });
    if (!acts.length) tb.append(h('tr', {}, h('td', { colspan: String(people.length + 3), class: 'rg-hint', text: T('noActs') })));
    table.append(tb);
    table.append(h('tfoot', {}, h('tr', {}, h('th', { scope: 'row', text: T('loadCol') }), ...r.loads.map((l) => h('td', { class: 'rg-c num' },
      l.overloaded ? ui.badge({ text: `${l.load} · ${T('overloaded')}`, tone: 'warn', icon: 'triangle-alert' }) : h('span', { text: String(l.load) }))), h('td'), h('td'))));
    raciBox.replaceChildren(table);
  }
  const focusCell = (r, c) => raciBox.querySelector(`.rg-cell[data-r="${r}"][data-c="${c}"]`)?.focus();

  // ---- MEMO
  const optGrid = ui.grid({
    columns: [{ key: 'option', label: T('colOption'), width: 220 }, { key: 'customer', label: T('colCustomer') }, { key: 'business', label: T('colBusiness') }, { key: 'effort', label: T('colEffort'), width: 120 }, { key: 'risk', label: T('colRisk') }, { key: 'prefers', label: T('colPrefers'), width: 120 }],
    rows: st().options, removable: true, addLabel: T('addOption'), newRow: () => ({ option: '', customer: '', business: '', effort: '', risk: '', prefers: '' }),
    onChange: (rows) => { set({ options: rows }); paintMemo(); },
  });
  const recoIn = ui.textarea({ value: st().recommendation || '', rows: 3, onInput: (v) => { set({ recommendation: v }); paintMemo(); } });
  const ifNotIn = ui.textarea({ value: st().ifNot || '', rows: 2, onInput: (v) => { set({ ifNot: v }); paintMemo(); } });
  const memoPrev = h('div', { class: 'rg-memo markdown' });
  const memoPanel = h('div', { class: 'rg-memo-grid' }, h('div', {}, h('h2', { text: T('options') }), optGrid, ui.field({ label: T('recommendation'), input: recoIn }), ui.field({ label: T('ifNot'), input: ifNotIn })),
    h('section', { class: 'rg-memo-side' }, h('h2', { text: T('preview') }), memoPrev));
  async function paintMemo() {
    try { const { renderMarkdown } = await import('../../core/markdown.js'); await renderMarkdown(memoPrev, memoMd(st())); } catch { memoPrev.replaceChildren(h('pre', { text: memoMd(st()) })); }
  }

  const tabs = ui.tabs({ tabs: [{ id: 'map', label: T('tabMap') }, { id: 'raci', label: T('tabRaci') }, { id: 'memo', label: T('tabMemo') }], active: st()._tab || 'map',
    panels: { map: mapPanel, raci: raciPanel, memo: memoPanel }, onChange: (id) => { ctx.setState({ _tab: id }, { silent: true }); if (id === 'raci') paintRaci(); if (id === 'memo') paintMemo(); } });
  el.append(h('div', { class: 'jk-top' }, adv, pill), tabs);

  function refresh(opts = {}) {
    const s = st(); const r = analyse(s); const people = s.stakeholders || [];
    empty.hidden = people.length > 0 || (s.activities || []).length > 0;
    if (!opts.keepChart && !drag) paintChart();
    paintStrats();
    const vars = { people: people.length, rows: (s.activities || []).length, bad: r.badRows, over: r.overloaded.length };
    const text = r.ok ? fmt('metaOk', vars) : fmt('meta', vars);
    const tone = r.badRows ? 'bad' : r.overloaded.length ? 'warn' : 'ok';
    pill.update({ tone, text }); frame.setStatus({ tone, text });
    tabs.setCount('raci', r.badRows + r.overloaded.length || undefined);
    adv.setCount(advCount());
    if (tabs.active === 'raci' && !opts.keepRaci) paintRaci();
    return r;
  }
  ctx.__rgRefresh = refresh;
  refresh(); paintRaci(); paintMemo();
}

/* ------------------------------------------------------------------------------------------- module */
const sampleList = (lang) => SAMPLES[lang].map((s) => ({ id: s.id, label: s.label, hint: s.hint, state: s.state, autorun: true }));
export default {
  id: 'raci-grid',
  skill: 'aligning-stakeholders',
  icon: 'users',
  title: { en: 'RACI & power grid', fr: 'RACI et matrice pouvoir' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'grid-3x3' },
  schema: 1,
  defaults() { return { decision: '', decider: '', decideBy: '', context: '', stakeholders: [], activities: [], overload: DEFAULT_OVERLOAD, options: [], recommendation: '', ifNot: '', strategies: {} }; },
  samples: { en: sampleList('en'), fr: sampleList('fr') },
  mount,
  validate(s) {
    const e = [];
    if (!String(s.decision || '').trim()) e.push({ field: 'decision', message: T('errDecision') });
    if (!(s.stakeholders || []).length) e.push({ field: 'decision', message: T('errPeople') });
    return e;
  },
  run(s, ctx) {
    const r = ctx.__rgRefresh ? ctx.__rgRefresh() : analyse(s);
    return { people: (s.stakeholders || []).length, rows: r.rows.length, bad: r.badRows, over: r.overloaded.map((o) => o.id), ok: r.ok };
  },
  status(r, ms) {
    const vars = { people: r.people, rows: r.rows, bad: r.bad, over: r.over.length };
    return { tone: r.bad ? 'bad' : r.over.length ? 'warn' : 'ok', text: r.ok ? fmt('metaOk', vars) : fmt('meta', vars), ms };
  },
  toMarkdown,
  exports: [
    { id: 'raci-csv', label: { en: strings.en.exRaci, fr: strings.fr.exRaci }, build: (s) => ({ name: 'raci.csv', mime: 'text/csv', text: raciCsv(s) }) },
    { id: 'people-csv', label: { en: strings.en.exPeople, fr: strings.fr.exPeople }, build: (s) => ({ name: 'stakeholders.csv', mime: 'text/csv', text: stakeholdersCsv(s, (q) => strategy(s, q)) }) },
    { id: 'memo-md', label: { en: strings.en.exMemo, fr: strings.fr.exMemo }, build: (s) => ({ name: 'decision-memo.md', mime: 'text/markdown', text: memoMd(s) }) },
  ],
  aiActions: [
    { id: 'draft-memo', label: { en: strings.en.aiMemo, fr: strings.fr.aiMemo }, expects: 'markdown', prompt: (s) => promptMemo(s) },
    { id: 'steering', label: { en: strings.en.aiSteer, fr: strings.fr.aiSteer }, expects: 'markdown', prompt: (s) => promptSteer(s) },
  ],
  _internals: { toMarkdown, memoMd, promptMemo },
};
