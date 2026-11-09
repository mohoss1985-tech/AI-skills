/* AI use-case scorer (prioritizing-ai-use-cases), owner F.
   Weighted score (value, feasibility, inverted risk; weights adjustable), risk and knowledge gates, value × feasibility
   bubble chart (plain SVG, bubble size = risk), Now / Next / Later lanes. Logic = logic.js (node logic.test.mjs). */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { bubbles, compute, DEFAULT_RULES, DEFAULT_WEIGHTS, scoresCsv, useCasesFromCsv } from './logic.js';

const T = register('use-case-scorer', strings);
const fmt = (key, vars = {}) => T(key).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
const dec = (x) => (getLang() === 'fr' ? x.toFixed(1).replace('.', ',') : x.toFixed(1));
const nf = (x) => (x ? new Intl.NumberFormat(getLang() === 'fr' ? 'fr-FR' : 'en-US').format(x) : '');
const SVGNS = 'http://www.w3.org/2000/svg';
const LANES = ['now', 'next', 'later', 'excluded'];
const QUAD = { 'quick-win': 'qQuickWin', 'big-bet': 'qBigBet', 'fill-in': 'qFillIn', trap: 'qTrap' };

const result = (s) => compute(s.useCases || [], s.weights, s.rules);
const pct = (w) => {
  const x = { ...DEFAULT_WEIGHTS, ...w };
  const tot = (+x.value || 0) + (+x.feasibility || 0) + (+x.risk || 0);
  const p = (k) => (tot ? Math.round((100 * (+x[k] || 0)) / tot) : 0);
  return { v: p('value'), f: p('feasibility'), r: p('risk') };
};
function whyText(u) {
  if (u.why === 'gate') return u.gates.includes('risk') ? T('whyGateRisk') : T('whyGateKnowledge');
  return T({ top: 'whyTop', capacity: 'whyCapacity', score: 'whyScore', low: 'whyLow', regulated: 'whyRegulated' }[u.why] || 'whyLow');
}
const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

/* ---------------------------------------------------------------------------------------------- Markdown */
function toMarkdown(state) {
  const r = result(state);
  const p = pct(state.weights);
  const L = [`## ${state.title || T('useCases')}`, ''];
  L.push(`### 1 · ${T('mdAssumptions')}`, `- ${fmt('mdWeights', { v: p.v, f: p.f, r: p.r })}`,
    `- ${fmt('mdGates', { rg: r.rules.riskGate, kg: r.rules.knowledgeGate })}`, `- ${T('mdVolumes')}`, '');
  L.push(`### 2 · ${T('mdScoring')}`, '');
  L.push(`| ${T('colRank')} | ${T('colId')} | ${T('colName')} | ${T('colValue')} | ${T('colFeas')} | ${T('colRisk')} | ${T('colKnow')} | ${T('colVolume')} | ${T('colScore')} | Gates | ${T('colLane')} |`);
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  for (const u of r.ranked) {
    const g = u.regulated ? '—' : `risk ${u.gates.includes('risk') ? '✗' : '✓'} · knowledge ${u.gates.includes('knowledge') ? '✗' : '✓'}`;
    L.push(`| ${u.rank} | ${u.id} | ${mdCell(u.name)} | ${u.value} | ${u.feasibility} | ${u.risk} | ${u.knowledge ?? '—'} | ${nf(u.volume) || '—'} | **${dec(u.score)}** | ${g} | ${T(u.lane)} |`);
  }
  L.push('', `### 3 · ${T('mdQuadrant')}`, '');
  for (const q of Object.keys(QUAD)) {
    const xs = r.ranked.filter((u) => u.quadrant === q && !u.regulated);
    L.push(`- **${T(QUAD[q])}**: ${xs.length ? xs.map((u) => `${u.id} ${u.name}`).join(' · ') : '—'}`);
  }
  L.push('', `### 4 · ${T('mdRoadmap')}`, '');
  for (const lane of ['now', 'next', 'later']) {
    L.push(`**${T(lane)}** (${T(lane + 'Sub')})`, '');
    if (!r.lanes[lane].length) L.push('- —');
    for (const u of r.lanes[lane]) L.push(`- ${u.id} ${mdCell(u.name)} · ${dec(u.score)} · ${whyText(u)}${u.note ? ` · ${mdCell(u.note)}` : ''}`);
    L.push('');
  }
  L.push(`### 5 · ${T('mdTradeoffs')}`, '');
  const not = [...r.lanes.excluded, ...r.lanes.later];
  if (!not.length) L.push('- —');
  for (const u of not) L.push(`- ${u.id} ${mdCell(u.name)}: ${whyText(u)}`);
  L.push('');
  return L.join('\n');
}

/* ---------------------------------------------------------------------------------------------- AI prompt */
function promptSuggest(state) {
  const fr = getLang() === 'fr';
  const have = (state.useCases || []).map((u) => `- ${u.id} ${u.name} (value ${u.value}, feasibility ${u.feasibility}, risk ${u.risk})`);
  return [
    'You are the Product Owner of a card-servicing AI assistant (skill: prioritizing-ai-use-cases).',
    fr ? 'Context: Banque Lumière, CB cards (contestation, remboursement J+1 art. L133-18 CMF, impayés).'
      : 'Context: Harbor Bank, Visa cards (disputes, Visa dispute conditions 10.x / 13.x, chargebacks).',
    'Suggest 5 to 8 use cases for card disputes that the assistant could handle (customer intent in their words: "I was charged twice", "the merchant never delivered"...).',
    have.length ? 'Already in the list (do not repeat):' : '', ...have,
    '',
    'Score each 1–5: value (customer value + business impact), feasibility (answerable with existing sources/APIs), risk (5 = a wrong answer moves money, gives regulated advice or exposes personal data), knowledge (readiness of approved content).',
    'Set guardrail=yes only if a guardrail and human hand-off are realistic now; regulated=yes for regulated advice. Never invent volumes: leave volume empty.',
    'Mark dispute deadlines or reason codes that only the scheme rulebook can confirm as *to confirm*.',
    'Answer with one line of rationale per use case, then a CSV block with exactly this header so it can be pasted back into the tool:',
    'id,name,value,feasibility,risk,knowledge,volume,guardrail,regulated,note',
    fr ? 'Answer in French.' : 'Answer in English.',
  ].filter((x) => x !== '').join('\n');
}

/* ---------------------------------------------------------------------------------------------- chart */
function svgEl(name, attrs = {}, text) {
  const e = document.createElementNS(SVGNS, name);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text != null) e.textContent = text;
  return e;
}
function chart(r) {
  const W = 560, H = 380, pad = 44;
  const svg = svgEl('svg', { viewBox: `0 0 ${W} ${H}`, class: 'ucs-chart', role: 'img', 'aria-label': T('chartAlt') });
  const sx = (f) => pad + ((f - 1) / 4) * (W - 2 * pad);
  const sy = (v) => H - pad - ((v - 1) / 4) * (H - 2 * pad);
  // grid + quadrant midlines at 3
  for (let i = 1; i <= 5; i++) {
    svg.append(svgEl('line', { x1: sx(i), x2: sx(i), y1: sy(1), y2: sy(5), class: i === 3 ? 'ucs-mid' : 'ucs-gl' }));
    svg.append(svgEl('line', { y1: sy(i), y2: sy(i), x1: sx(1), x2: sx(5), class: i === 3 ? 'ucs-mid' : 'ucs-gl' }));
    svg.append(svgEl('text', { x: sx(i), y: H - pad + 16, class: 'ucs-tick', 'text-anchor': 'middle' }, String(i)));
    svg.append(svgEl('text', { x: pad - 10, y: sy(i) + 4, class: 'ucs-tick', 'text-anchor': 'end' }, String(i)));
  }
  svg.append(svgEl('text', { x: W / 2, y: H - 6, class: 'ucs-axis', 'text-anchor': 'middle' }, `${T('axisFeas')} →`));
  svg.append(svgEl('text', { x: 12, y: H / 2, class: 'ucs-axis', 'text-anchor': 'middle', transform: `rotate(-90 12 ${H / 2})` }, `${T('axisValue')} →`));
  const q = (x, y, k, anchor) => svg.append(svgEl('text', { x, y, class: 'ucs-quad', 'text-anchor': anchor }, T(k)));
  q(sx(5) - 4, sy(5) + 14, 'qQuickWin', 'end'); q(sx(1) + 4, sy(5) + 14, 'qBigBet', 'start');
  q(sx(5) - 4, sy(1) - 6, 'qFillIn', 'end'); q(sx(1) + 4, sy(1) - 6, 'qTrap', 'start');
  // bubbles: biggest first so small ones stay on top
  const bs = bubbles(r, { w: W, h: H, pad }).sort((a, b) => b.r - a.r);
  for (const b of bs) {
    const g = svgEl('g', { class: `ucs-bubble lane-${b.u.lane}`, tabindex: '0' });
    g.append(svgEl('title', {}, `${b.u.id} · ${b.u.name}\n${T('colValue')} ${b.u.value} · ${T('colFeas')} ${b.u.feasibility} · ${T('colRisk')} ${b.u.risk}\n${T('colScore')} ${dec(b.u.score)} · ${T(b.u.lane)}`));
    g.append(svgEl('circle', { cx: b.x.toFixed(1), cy: b.y.toFixed(1), r: b.r }));
    g.append(svgEl('text', { x: b.x.toFixed(1), y: (b.y - b.r - 4).toFixed(1), 'text-anchor': 'middle', class: 'ucs-label' }, b.u.id));
    svg.append(g);
  }
  return svg;
}

/* ---------------------------------------------------------------------------------------------- view */
function mount(el, ctx) {
  const { ui } = ctx;
  if (!Array.isArray(ctx.state.useCases)) ctx.setState({ useCases: [] }, { silent: true });
  const weights = { ...DEFAULT_WEIGHTS, ...(ctx.state.weights || {}) };
  const rules = { ...DEFAULT_RULES, ...(ctx.state.rules || {}) };

  // ---- command bar: the three weights (use cases + scores are the grid)
  const wHint = document.createElement('p'); wHint.className = 'ucs-whint num';
  for (const [k, lab] of [['value', 'wValue'], ['feasibility', 'wFeasibility'], ['risk', 'wRisk']]) {
    const i = ui.input({ type: 'number', value: weights[k], mono: true, size: 'sm' });
    i.min = '0'; i.max = '100'; i.step = '5';
    i.addEventListener('input', () => { weights[k] = Math.max(0, +i.value || 0); ctx.setState({ weights: { ...weights } }, { silent: true }); refresh(); });
    ctx.frame.command.append(ctx.frame.bindField('w-' + k, ui.field({ label: T(lab), input: i, required: true })));
  }

  // ---- advanced: lane rules, paste CSV
  const advBody = document.createElement('div'); advBody.className = 'ucs-adv';
  const rulesRow = document.createElement('div'); rulesRow.className = 'ucs-rules';
  for (const [k, lab, step, max] of [['nowMin', 'nowMin', 0.1, 5], ['nextMin', 'nextMin', 0.1, 5], ['nowSlots', 'nowSlots', 1, 20], ['riskGate', 'riskGate', 1, 5], ['knowledgeGate', 'knowledgeGate', 1, 5]]) {
    const i = ui.input({ type: 'number', value: rules[k], mono: true, size: 'sm' });
    i.min = '0'; i.max = String(max); i.step = String(step);
    i.addEventListener('input', () => { rules[k] = +i.value || 0; ctx.setState({ rules: { ...rules } }, { silent: true }); refresh(); });
    rulesRow.append(ui.field({ label: T(lab), input: i }));
  }
  const rulesHint = document.createElement('p'); rulesHint.className = 'ucs-hint'; rulesHint.textContent = T('rulesHint');
  const pasteArea = ui.textarea({ rows: 4, mono: true, placeholder: 'id,name,value,feasibility,risk,knowledge,volume,guardrail,regulated,note' });
  const pasteField = ui.field({ label: T('pasteTitle'), help: T('pasteHint'), input: pasteArea });
  const pasteBtn = ui.button({ label: T('pasteApply'), size: 'sm', icon: 'clipboard-paste', onClick: () => {
    const list = useCasesFromCsv(pasteArea.value);
    if (!list.length) { pasteField.setError(T('pasteBad')); return; }
    pasteField.setError(''); pasteArea.value = '';
    ctx.setState({ useCases: list }, { silent: true });
    gridEl.setRows(list); refresh();
  } });
  advBody.append(rulesRow, rulesHint, pasteField, pasteBtn);
  const adv = ui.advanced({ label: T('advanced'), body: advBody });

  // ---- grid
  const scale = ['1', '2', '3', '4', '5'];
  let gridEl = null;
  const current = () => compute(gridEl ? gridEl.getRows() : ctx.state.useCases, weights, rules);
  const find = (id) => current().ranked.find((u) => u.id === id);
  const columns = [
    { key: 'id', label: T('colId'), mono: true, width: 72 },
    { key: 'name', label: T('colName') },
    { key: 'value', label: T('colValue'), type: 'select', options: scale, width: 64 },
    { key: 'feasibility', label: T('colFeas'), type: 'select', options: scale, width: 64 },
    { key: 'risk', label: T('colRisk'), type: 'select', options: scale, width: 64 },
    { key: 'knowledge', label: T('colKnow'), type: 'select', options: [{ value: '', label: '—' }, ...scale], width: 64 },
    { key: 'volume', label: T('colVolume'), type: 'number', width: 96 },
    { key: 'guardrail', label: T('colGuard'), type: 'check', width: 72 },
    { key: 'regulated', label: T('colReg'), type: 'check', width: 72 },
    { key: '_score', label: T('colScore'), num: true, width: 56, compute: (row) => { const u = find(row.id); if (!u) return ''; const b = document.createElement('b'); b.className = 'ucs-score'; b.textContent = dec(u.score); return b; } },
    { key: '_lane', label: T('colLane'), width: 112, compute: (row) => { const u = find(row.id); return u ? laneBadge(u) : ''; } },
  ];
  function laneBadge(u) {
    const tone = { now: 'accent', next: 'info', later: 'neutral', excluded: 'neutral' }[u.lane];
    const icon = { now: 'arrow-right', next: 'clock', later: 'minus', excluded: 'ban' }[u.lane];
    const b = ui.badge({ text: T(u.lane), tone, icon });
    b.title = whyText(u);
    return b;
  }
  const nextId = (rows) => `UC-${String(rows.length + 1).padStart(2, '0')}`;
  gridEl = ui.grid({
    columns, rows: ctx.state.useCases, removable: true, addLabel: T('addUseCase'),
    newRow: (rows) => ({ id: nextId(rows), name: '', value: 3, feasibility: 3, risk: 3, knowledge: '', volume: '', guardrail: false, regulated: false, note: '' }),
    onChange: (rows) => { ctx.setState({ useCases: rows.map(clean) }, { silent: true }); refresh(); },
  });
  gridEl.classList.add('ucs-grid');
  const clean = (u) => ({ ...u, value: +u.value || 3, feasibility: +u.feasibility || 3, risk: +u.risk || 3, knowledge: u.knowledge === '' || u.knowledge == null ? '' : +u.knowledge });

  const empty = ui.emptyState({ icon: 'target', title: T('emptyTitle'), text: T('emptyBody'),
    action: { label: T('addUseCase'), onClick: () => gridEl.addRow(true) },
    sample: { label: getLang() === 'fr' ? 'CB FR' : 'Visa EN', onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });

  // ---- strip, chart, lanes
  const head = document.createElement('div'); head.className = 'ucs-head';
  const h2 = document.createElement('h2'); h2.textContent = T('useCases');
  const strip = document.createElement('div'); strip.className = 'ucs-strip';
  const pill = ui.statusPill({ tone: 'neutral', text: '' });
  strip.append(pill, wHint);
  head.append(h2, strip);
  const hint = document.createElement('p'); hint.className = 'ucs-hint'; hint.textContent = `${T('useCasesHint')} ${T('weightsHint')}`;

  const lower = document.createElement('div'); lower.className = 'ucs-lower';
  const chartBox = document.createElement('section'); chartBox.className = 'ucs-panel';
  const lanesBox = document.createElement('section'); lanesBox.className = 'ucs-panel';
  lower.append(chartBox, lanesBox);

  function paintChart(r) {
    chartBox.replaceChildren();
    const h = document.createElement('h2'); h.textContent = T('chart');
    const legend = document.createElement('div'); legend.className = 'ucs-legend';
    for (const l of LANES) {
      const s = document.createElement('span'); s.className = `ucs-key lane-${l}`;
      const dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true');
      s.append(dot, document.createTextNode(T(l)));
      legend.append(s);
    }
    const size = document.createElement('span'); size.className = 'ucs-size'; size.textContent = T('sizeLegend');
    legend.append(size);
    chartBox.append(h, legend, chart(r));
  }
  function paintLanes(r) {
    lanesBox.replaceChildren();
    const h = document.createElement('h2'); h.textContent = T('lanes');
    const wrap = document.createElement('div'); wrap.className = 'ucs-lanes';
    for (const l of LANES) {
      const col = document.createElement('div'); col.className = `ucs-lane lane-${l}`;
      const lh = document.createElement('h3');
      const name = document.createElement('span'); name.textContent = T(l);
      const n = document.createElement('span'); n.className = 'ucs-n num'; n.textContent = String(r.lanes[l].length);
      lh.append(name, n);
      const sub = document.createElement('p'); sub.className = 'ucs-sub'; sub.textContent = T(l + 'Sub');
      const ul = document.createElement('ul');
      if (!r.lanes[l].length) { const li = document.createElement('li'); li.className = 'ucs-none'; li.textContent = T('laneEmpty'); ul.append(li); }
      for (const u of r.lanes[l]) {
        const li = document.createElement('li');
        const top = document.createElement('div'); top.className = 'ucs-li-top';
        const id = document.createElement('code'); id.textContent = u.id;
        const sc = document.createElement('b'); sc.className = 'num'; sc.textContent = dec(u.score);
        top.append(id, sc);
        const nm = document.createElement('div'); nm.className = 'ucs-li-name'; nm.textContent = u.name;
        const why = document.createElement('div'); why.className = 'ucs-li-why';
        if (u.why === 'gate') why.append(ui.badge({ text: whyText(u), tone: 'warn' }));
        else why.textContent = whyText(u);
        li.append(top, nm, why);
        ul.append(li);
      }
      col.append(lh, sub, ul);
      wrap.append(col);
    }
    lanesBox.append(h, wrap);
  }

  function refresh() {
    const r = result(ctx.state);
    const has = (ctx.state.useCases || []).length > 0;
    empty.hidden = has; gridEl.hidden = !has; lower.hidden = !has;
    const p = pct(weights);
    wHint.textContent = fmt('weightsSum', p);
    const text = fmt('meta', { n: r.ranked.length, now: r.lanes.now.length, next: r.lanes.next.length, later: r.lanes.later.length });
    pill.update({ tone: has ? 'ok' : 'neutral', text });
    ctx.frame.setStatus({ tone: has ? 'ok' : 'neutral', text });
    let n = 0;
    for (const k of Object.keys(DEFAULT_RULES)) if (rules[k] !== DEFAULT_RULES[k]) n++;
    adv.setCount(n);
    if (has) { paintChart(r); paintLanes(r); }
    return r;
  }
  el.append(adv, head, hint, empty, gridEl, lower);
  ctx.__ucsRefresh = refresh;
  refresh();
}

/* ---------------------------------------------------------------------------------------------- module */
const sampleList = (lang) => SAMPLES[lang].map((s) => ({ id: s.id, label: s.title, hint: s.client, state: s.state, autorun: true }));

export default {
  id: 'use-case-scorer',
  skill: 'prioritizing-ai-use-cases',
  icon: 'target',
  title: { en: 'Use-case scorer', fr: "Priorisation des cas d'usage" },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'target' },
  schema: 1,
  defaults() {
    return { title: '', weights: { ...DEFAULT_WEIGHTS }, rules: { ...DEFAULT_RULES }, useCases: [] };
  },
  samples: { en: sampleList('en'), fr: sampleList('fr') },
  mount,
  validate(state) {
    const w = { ...DEFAULT_WEIGHTS, ...(state.weights || {}) };
    if ((+w.value || 0) + (+w.feasibility || 0) + (+w.risk || 0) > 0) return [];
    return [{ field: 'w-value', message: getLang() === 'fr' ? 'Donnez un poids à au moins un critère, par ex. valeur 50.' : 'Give at least one criterion a weight, e.g. value 50.' }];
  },
  run(state, ctx) {
    const r = ctx.__ucsRefresh ? ctx.__ucsRefresh() : result(state);
    return { lanes: Object.fromEntries(LANES.map((l) => [l, r.lanes[l].map((u) => u.id)])), scores: Object.fromEntries(r.ranked.map((u) => [u.id, u.score])) };
  },
  status(res, ms) {
    return { tone: 'ok', text: fmt('meta', { n: Object.keys(res.scores).length, now: res.lanes.now.length, next: res.lanes.next.length, later: res.lanes.later.length }), ms };
  },
  toMarkdown,
  exports: [
    { id: 'csv', label: { en: strings.en.exportCsv, fr: strings.fr.exportCsv }, build: (s) => ({ name: 'ai-use-case-scores.csv', mime: 'text/csv', text: scoresCsv(result(s)) }) },
  ],
  aiActions: [
    { id: 'suggest-disputes', label: { en: strings.en.aiSuggest, fr: strings.fr.aiSuggest }, prompt: (s) => promptSuggest(s), expects: 'markdown' },
  ],
  _internals: { toMarkdown, promptSuggest, result },
};
