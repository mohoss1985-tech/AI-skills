/* Impact heatmap (skill analysing-gaps-and-impacts), owner I.
   Command bar: change · areas · scale. Body: click-to-score 0–3 heatmap (areas × people / process / data / tech /
   compliance) with row and column totals, top risks, checks, and an as-is / to-be gap grid. Logic = logic.js. */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { compute, cycle, DIMS, GAP_TYPES, SIZES, heatmapCsv, gapsCsv, pruneScores, parseAreas } from './logic.js';
import { fill, mdTable } from '../mapping-grid/csv.js';

const T = register('impact-heatmap', strings);
const F = (k, v) => fill(T(k), v);
const dimL = (d) => T('dim_' + d);
const lvL = (scale, v) => T(`lv_${scale === 'effort' ? 'effort' : 'impact'}_${v}`);
const flagText = (f) => F(f.code, { ...f.vars, dim: f.dim ? dimL(f.dim) : '' });

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
function toMarkdown(s) {
  const r = compute(s);
  const L = [`## ${s.title || s.change || T('mdHeat')}`, ''];
  L.push(`### 1 · ${T('mdSummary')}`, '', `- **${T('mdChange')}:** ${s.change || '—'}`);
  if (s.deadline) L.push(`- **${T('mdDeadline')}:** ${s.deadline}`);
  L.push(`- ${F('mdSumLine', { grand: r.grand, max: r.max, n: r.rows.length, hot: r.hot.join(', ') || '—' })}`);
  if (s.scale === 'effort') L.push(`- ${F('effortLine', { lo: r.days[0], hi: r.days[1] })}`);
  L.push(`- **${T('mdTop')}:** ${r.top.slice(0, 3).map((t) => `${t.area} · ${dimL(t.dim)} (${t.score})`).join('; ') || '—'}`, '');
  if (s.notes) L.push(s.notes, '');
  L.push(`### 2 · ${T('mdHeat')}`, '', `${T('mdLegend')}: ${[0, 1, 2, 3].map((v) => `${v} = ${lvL(s.scale, v)}`).join(' · ')}`, '');
  L.push(mdTable([T('colArea'), ...DIMS.map(dimL), T('colTotal')], [
    ...r.rows.map((x) => [`${x.name} (${T('kind_' + x.kind)})`, ...DIMS.map((d) => (x.scores[d] === 3 ? `**${x.scores[d]}**` : String(x.scores[d]))), `**${x.total}**`]),
    [`**${T('total')}**`, ...DIMS.map((d) => `**${r.colTotals[d]}**`), `**${r.grand}**`]]), '');
  L.push(`### 3 · ${T('mdTop')}`, '');
  if (!r.top.length) L.push('- —');
  for (const t of r.top) L.push(`- **${t.score}** · ${t.area} · ${dimL(t.dim)}${t.owner ? ` · ${t.owner}` : ''}${t.gaps.length ? ` → ${t.gaps[0].toBe}` : ''}`);
  L.push('', `### 4 · ${T('mdGaps')}`, '', mdTable([T('colArea'), T('colDim'), T('colAsIs'), T('colToBe'), T('colType'), T('colOwner'), T('colSize')],
    r.gaps.map((g) => [g.area, g.dim ? dimL(g.dim) : '', g.asIs, g.toBe, g.type ? T('gt_' + g.type) : '', g.owner, g.size])), '');
  if (r.flags.length) { L.push(`### 5 · ${T('mdChecks')}`, ''); for (const f of r.flags) L.push(`- ${flagText(f)}`); L.push(''); }
  return L.join('\n');
}

/* ------------------------------------------------------------------------------------------- AI */
function promptGaps(s) {
  const r = compute(s);
  const fr = getLang() === 'fr';
  return [
    'You are a senior business analyst framing a change in a regulated card issuer (skill: analysing-gaps-and-impacts).',
    `Change: ${s.change}`, s.deadline ? `Deadline: ${s.deadline}` : '', s.notes ? `Context: ${s.notes}` : '',
    '', 'Heatmap (0–3, ' + (s.scale === 'effort' ? 'effort: 1 = S < 10 d, 2 = M 10–40 d, 3 = L 40–120 d' : 'impact') + '):',
    heatmapCsv(r).trim(), '', 'Gaps already described:', gapsCsv(r).trim(),
    '', 'For every cell scored 2 or 3 without a gap, write one concrete gap: today (as-is) vs target (to-be), type (missing / change / remove / ok), owner (a team), size (S/M/L/XL).',
    'Be concrete (which process, which application, which team). Scheme rules you cannot source (Visa / GIE CB timings) stay *to confirm*.',
    'Answer with a CSV block with exactly this header: area,dimension,score,as_is,to_be,gap_type,owner,size',
    fr ? 'Answer in French.' : 'Answer in English.',
  ].filter((x) => x !== '').join('\n');
}
function promptSummary(s) {
  const fr = getLang() === 'fr';
  return ['You are a senior business analyst (skill: analysing-gaps-and-impacts). Write the 5-line summary for the sponsor: what changes, deadline, size, top 3 impacts, decisions needed. Then 2–3 options (tactical / strategic) with cost, time and risk, and a RAID list.',
    '', toMarkdown(s), fr ? 'Answer in French.' : 'Answer in English.'].join('\n');
}

/* ------------------------------------------------------------------------------------------- view */
function mount(el, ctx) {
  const { ui } = ctx;
  const S = () => ctx.state;
  const set = (patch) => ctx.setState(patch, { silent: true });
  let timer = null;
  const later = (fn) => { clearTimeout(timer); timer = setTimeout(fn, 250); };

  // ---- command bar
  const fChange = ctx.frame.bindField('change', ui.field({ label: T('change'), required: true, input: ui.input({ value: S().change || '', placeholder: T('changePh'), onInput: (v) => set({ change: v }) }) }));
  fChange.classList.add('grow');
  const fAreas = ctx.frame.bindField('areas', ui.field({ label: T('areas'), help: T('areasHelp'), required: true,
    input: ui.textarea({ value: S().areas || '', rows: 3, mono: true, placeholder: 'Card management system, system, Card IT', onInput: (v) => { set({ areas: v }); later(rebuild); } }) }));
  fAreas.classList.add('grow');
  const seg = ui.segmented({ options: ['impact', 'effort'].map((v) => ({ value: v, label: T('sc_' + v) })), value: S().scale || 'impact', onChange: (v) => { set({ scale: v }); paintHeat(); paintSide(); } });
  const fScale = ui.field({ label: T('scale'), input: seg });
  fScale.classList.add('shrink');
  ctx.frame.command.append(fChange, fAreas, fScale);

  // ---- advanced
  const advBody = h('div', { class: 'ih-adv' },
    ui.field({ label: T('deadline'), optional: true, input: ui.input({ value: S().deadline || '', onInput: (v) => { set({ deadline: v }); adv.setCount(advCount()); } }) }),
    ui.field({ label: T('notes'), optional: true, input: ui.textarea({ value: S().notes || '', rows: 2, onInput: (v) => { set({ notes: v }); adv.setCount(advCount()); } }) }));
  const advCount = () => ['deadline', 'notes'].filter((k) => (S()[k] || '').trim()).length;
  const adv = ui.advanced({ label: T('advanced'), body: advBody, count: advCount() });

  // ---- heatmap
  const heatBox = h('section', { class: 'ih-heat' });
  let focus = [0, 0];
  function setScore(area, dim, v) {
    const scores = { ...(S().scores || {}) };
    scores[area] = { ...(scores[area] || {}), [dim]: v };
    set({ scores });
    paintHeat(true); paintSide();
  }
  function paintHeat(keepFocus = false) {
    const r = compute(S());
    const scale = S().scale || 'impact';
    const tbl = h('table', { class: 'ih-table', role: 'grid', 'aria-label': T('heatmap') });
    const thead = h('thead', {}, h('tr', {}, h('th', { scope: 'col', class: 'ih-area-h', text: T('colArea') }), ...DIMS.map((d) => h('th', { scope: 'col', text: dimL(d) })), h('th', { scope: 'col', class: 'num', text: T('colTotal') })));
    const tbody = h('tbody');
    r.rows.forEach((row, ri) => {
      const tr = h('tr', {}, h('th', { scope: 'row', class: 'ih-area' }, h('span', { class: 'ih-name', text: row.name }), h('span', { class: 'ih-kind', text: `${T('kind_' + row.kind)}${row.owner ? ' · ' + row.owner : ''}` })));
      DIMS.forEach((d, ci) => {
        const v = row.scores[d];
        const b = h('button', { type: 'button', class: `ih-cell lv-${v}`, 'data-r': ri, 'data-c': ci, tabindex: ri === focus[0] && ci === focus[1] ? '0' : '-1',
          'aria-label': F('cellAria', { area: row.name, dim: dimL(d), v, label: lvL(scale, v) }), title: `${row.name} · ${dimL(d)}: ${v} · ${lvL(scale, v)}` }, String(v));
        b.addEventListener('click', (e) => { focus = [ri, ci]; setScore(row.name, d, cycle(v, e.shiftKey)); });
        b.addEventListener('keydown', (e) => {
          let [r2, c2] = [ri, ci];
          if (e.key === 'ArrowRight') c2++; else if (e.key === 'ArrowLeft') c2--; else if (e.key === 'ArrowDown') r2++; else if (e.key === 'ArrowUp') r2--;
          else if (/^[0-3]$/.test(e.key)) { e.preventDefault(); focus = [ri, ci]; setScore(row.name, d, +e.key); return; }
          else if (e.key === ' ') { e.preventDefault(); focus = [ri, ci]; setScore(row.name, d, cycle(v, e.shiftKey)); return; }
          else return;
          e.preventDefault();
          r2 = Math.max(0, Math.min(r.rows.length - 1, r2)); c2 = Math.max(0, Math.min(DIMS.length - 1, c2));
          const nb = tbl.querySelector(`[data-r="${r2}"][data-c="${c2}"]`);
          if (nb) { b.tabIndex = -1; nb.tabIndex = 0; nb.focus(); focus = [r2, c2]; }
        });
        tr.append(h('td', { class: 'ih-td' }, b));
      });
      tr.append(h('td', { class: 'num ih-total' }, h('b', { text: String(row.total) })));
      tbody.append(tr);
    });
    const tfoot = h('tfoot', {}, h('tr', {}, h('th', { scope: 'row', text: T('total') }), ...DIMS.map((d) => h('td', { class: 'num', text: String(r.colTotals[d]) })), h('td', { class: 'num' }, h('b', { text: `${r.grand} / ${r.max}` }))));
    tbl.append(thead, tbody, tfoot);
    const legend = h('div', { class: 'ih-legend' }, ...[0, 1, 2, 3].map((v) => h('span', { class: 'ih-key' }, h('i', { class: `lv-${v}`, 'aria-hidden': 'true' }, String(v)), lvL(scale, v))));
    const extra = scale === 'effort' ? h('p', { class: 'ih-hint num', text: F('effortLine', { lo: r.days[0], hi: r.days[1] }) }) : null;
    heatBox.replaceChildren(h('div', { class: 'ih-head' }, h('h2', { text: T('heatmap') }), legend), h('p', { class: 'ih-hint', text: T('heatHint') }), h('div', { class: 'ih-scroll' }, tbl), extra);
    if (keepFocus) { const nb = tbl.querySelector(`[data-r="${focus[0]}"][data-c="${focus[1]}"]`); if (nb) nb.focus(); }
    const text = F('meta', { grand: r.grand, max: r.max, hot: r.counts[3], gaps: r.gaps.length });
    ctx.frame.setStatus({ tone: r.flags.length ? 'warn' : 'ok', text });
    return r;
  }

  // ---- side: top risks + checks
  const topBox = h('section', { class: 'ih-panel' });
  const flagBox = h('section', { class: 'ih-panel' });
  function addGap(area, dim) {
    const gaps = [...(S().gaps || []), { area, dim, asIs: '', toBe: '', type: 'change', owner: (parseAreas(S().areas).find((a) => a.name === area) || {}).owner || '', size: '' }];
    set({ gaps }); buildGrid(); paintSide();
    gridEl.focusCell(gaps.length - 1, 2);
  }
  function paintSide() {
    const r = compute(S());
    const ol = h('ol', { class: 'ih-top' });
    if (!r.top.length) ol.append(h('li', { class: 'ih-none', text: T('noTop') }));
    for (const t of r.top.slice(0, 6)) {
      const right = t.gaps.length ? h('span', { class: 'ih-gap-text', text: t.gaps[0].toBe || t.gaps[0].asIs || F('gapLinked', { n: t.gaps.length }) })
        : ui.button({ label: T('addGapFor'), size: 'sm', variant: 'ghost', icon: 'plus', onClick: () => addGap(t.area, t.dim) });
      ol.append(h('li', {}, h('span', { class: `ih-chip lv-${t.score}`, text: String(t.score) }),
        h('div', { class: 'ih-top-main' }, h('div', { class: 'ih-top-title' }, h('b', { text: t.area }), ' · ', dimL(t.dim)), h('div', { class: 'ih-top-sub' }, t.owner || '', right))));
    }
    topBox.replaceChildren(h('h3', { text: T('top') }), h('p', { class: 'ih-hint', text: T('topHint') }), ol);
    const ul = h('ul', { class: 'ih-flags' });
    if (!r.flags.length) ul.append(h('li', {}, ui.badge({ text: T('noFlags'), tone: 'ok' })));
    for (const f of r.flags) ul.append(h('li', {}, ui.badge({ text: '', tone: f.code === 'flagNoGap' ? 'bad' : 'warn' }), h('span', { text: flagText(f) })));
    const kinds = h('p', { class: 'ih-hint num', text: `${T('byKind')}: ${['system', 'team', 'process'].map((k) => `${T('kind_' + k)} ${r.byKind[k]}`).join(' · ')}` });
    flagBox.replaceChildren(h('h3', { text: T('flags') }), ul, kinds);
  }

  // ---- gap grid
  const gapHead = h('div', { class: 'ih-head' }, h('h2', { text: T('gaps') }));
  const gapHint = h('p', { class: 'ih-hint', text: T('gapsHint') });
  const gridBox = h('div');
  let gridEl = null;
  function buildGrid() {
    const areas = parseAreas(S().areas);
    const aOpts = [{ value: '', label: '—' }, ...areas.map((a) => ({ value: a.name, label: a.name }))];
    for (const g of S().gaps || []) if (g.area && !aOpts.some((o) => o.value === g.area)) aOpts.push({ value: g.area, label: g.area + ' ?' });
    gridEl = ui.grid({
      columns: [
        { key: 'area', label: T('colArea'), type: 'select', options: aOpts, width: 200 },
        { key: 'dim', label: T('colDim'), type: 'select', options: [{ value: '', label: '—' }, ...DIMS.map((d) => ({ value: d, label: dimL(d) }))], width: 120 },
        { key: 'asIs', label: T('colAsIs') },
        { key: 'toBe', label: T('colToBe') },
        { key: 'type', label: T('colType'), type: 'select', options: GAP_TYPES.map((v) => ({ value: v, label: T('gt_' + v) })), width: 120 },
        { key: 'owner', label: T('colOwner'), width: 140 },
        { key: 'size', label: T('colSize'), type: 'select', options: [{ value: '', label: '—' }, ...SIZES], width: 64 },
      ],
      rows: S().gaps || [], removable: true, addLabel: T('addGap'),
      newRow: () => ({ area: '', dim: '', asIs: '', toBe: '', type: 'change', owner: '', size: '' }),
      onChange: (rows) => { set({ gaps: rows }); later(() => { paintSide(); paintHeat(); }); },
    });
    gridEl.classList.add('ih-grid');
    gridBox.replaceChildren(gridEl);
  }

  const side = h('div', { class: 'ih-side' }, flagBox, topBox);
  const upper = h('div', { class: 'ih-upper' }, heatBox, side);
  const gapSec = h('section', { class: 'ih-gaps' }, gapHead, gapHint, gridBox);
  const empty = ui.emptyState({ icon: 'grid-3x3', title: T('emptyTitle'), text: T('emptyBody'),
    sample: { label: SAMPLES[getLang() === 'fr' ? 'fr' : 'en'][0].label, onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });

  function rebuild() {
    const has = parseAreas(S().areas).length > 0;
    empty.hidden = has; upper.hidden = !has; gapSec.hidden = !has;
    if (has) { set({ scores: pruneScores(S()) }); paintHeat(); paintSide(); buildGrid(); }
    else ctx.frame.setStatus(null);
  }
  el.append(adv, empty, upper, gapSec);
  ctx.__ihRefresh = () => { rebuild(); return compute(S()); };
  rebuild();
}

/* ------------------------------------------------------------------------------------------- module */
export default {
  id: 'impact-heatmap',
  skill: 'analysing-gaps-and-impacts',
  icon: 'grid-3x3',
  title: { en: 'Impact heatmap', fr: 'Carte des impacts' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'grid-3x3' },
  schema: 1,
  defaults() { return { title: '', change: '', areas: '', scale: 'impact', scores: {}, gaps: [], deadline: '', notes: '' }; },
  samples: SAMPLES,
  mount,
  validate(s) {
    const e = [];
    if (!(s.change || '').trim()) e.push({ field: 'change', message: getLang() === 'fr' ? 'Décrivez le changement en une phrase, par ex. « Inscription en temps réel sur la liste d’opposition ».' : 'Describe the change in one sentence, for example "Move Exception File listing to real time".' });
    if (!parseAreas(s.areas).length) e.push({ field: 'areas', message: getLang() === 'fr' ? 'Ajoutez au moins un périmètre, par ex. Serveur d’autorisation, système, Informatique carte.' : 'Add at least one area, for example Authorisation host, system, Card IT.' });
    return e;
  },
  run(s, ctx) {
    const r = ctx.__ihRefresh ? ctx.__ihRefresh() : compute(s);
    return { grand: r.grand, max: r.max, hot: r.counts[3], gaps: r.gaps.length, flags: r.flags.length, top: r.top.slice(0, 3).map((t) => `${t.area}/${t.dim}`) };
  },
  status(r, ms) { return { tone: r.flags ? 'warn' : 'ok', text: F('meta', r), ms }; },
  toMarkdown,
  exports: [
    { id: 'csv', label: { en: strings.en.exportCsv, fr: strings.fr.exportCsv }, build: (s) => ({ name: 'impact-heatmap.csv', mime: 'text/csv', text: heatmapCsv(compute(s)) }) },
    { id: 'gaps', label: { en: strings.en.exportGaps, fr: strings.fr.exportGaps }, build: (s) => ({ name: 'impact-gaps.csv', mime: 'text/csv', text: gapsCsv(compute(s)) }) },
  ],
  aiActions: [
    { id: 'draft-gaps', label: { en: strings.en.aiGaps, fr: strings.fr.aiGaps }, prompt: (s) => promptGaps(s), expects: 'markdown' },
    { id: 'sponsor-summary', label: { en: strings.en.aiSummary, fr: strings.fr.aiSummary }, prompt: (s) => promptSummary(s), expects: 'markdown' },
  ],
  _internals: { toMarkdown, promptGaps, promptSummary },
};
