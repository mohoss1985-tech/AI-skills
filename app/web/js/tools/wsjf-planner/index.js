/* WSJF & PI planner (managing-backlog), owner F.
   Editable grid with Fibonacci cells → live WSJF = CoD ÷ job size, live re-sort, PI capacity cut line, dependency and
   deadline flags, PI objectives. Logic = logic.js (port of wsjf.py, parity checked by test.html / logic.test.mjs).
   Works with no AI and no network; AI actions build prompts ("Copy prompt for Claude" in the demo). */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { capacityFrom, compute, depsOf, featuresCsv, FIB, itemsFromCsv, jiraCsv, pyNum } from './logic.js';

const T = register('wsjf-planner', strings);
const fmt = (key, vars = {}) => T(key).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
const num = (x, d = 2) => (getLang() === 'fr' ? x.toFixed(d).replace('.', ',') : x.toFixed(d));
const nf = (x) => new Intl.NumberFormat(getLang() === 'fr' ? 'fr-FR' : 'en-US').format(x);

const TYPES = ['Epic', 'Feature', 'Story', 'Enabler'];
const DEADLINES = () => [{ value: '', label: T('deadlineNone') }, { value: 'in-pi', label: T('deadlineIn') }, { value: 'next-pi', label: T('deadlineNext') }];
const DEFAULT_CALC = { sprints: 4, velocity: 40, runPct: 10, bufferPct: 15 };

/** Items as the logic wants them: "F-06, F-03" in the grid becomes ["F-06", "F-03"]. */
const norm = (items) => (items || []).map((it) => ({ ...it, depends_on: depsOf(String(Array.isArray(it.depends_on) ? it.depends_on.join(';') : it.depends_on || '').replace(/[,\s]+/g, ';')) }));
const result = (s) => compute(norm(s.items), s.capacity);

function flagText(f) {
  return f.code === 'dep-out' ? fmt('flagDepOut', { dep: f.dep })
    : f.code === 'pulled' ? fmt('flagPulled', { dep: f.dep })
    : f.code === 'unknown' ? fmt('flagUnknown', { dep: f.dep })
    : f.code === 'cycle' ? T('flagCycle') : T('flagDeadline');
}
function whyText(o) {
  if (o.reason.code === 'cycle') return T('whyCycle');
  const { free, need, extra } = o.reason;
  return extra.length ? fmt('whyCapacityWith', { free, need, extra: extra.join(', ') }) : fmt('whyCapacity', { free, need });
}
const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

/* ---------------------------------------------------------------------------------------------- Markdown */
function toMarkdown(state) {
  const r = result(state);
  const L = [];
  L.push(`## ${state.title || T('items')}`, '');
  L.push(`### 1 · ${T('mdAssumptions')}`, `- ${fmt('mdCapacity', { cap: r.capacity })}`, `- ${T('mdFormula')}`, '');
  L.push(`### 2 · ${T('mdRanked')}`, '');
  L.push(`| ${T('colRank')} | ${T('colId')} | ${T('colTitle')} | ${T('colBV')} | ${T('colTC')} | ${T('colRR')} | ${T('colSize')} | ${T('colWsjf')} | ${T('colPts')} | ${T('colPI')} |`);
  L.push('|---|---|---|---|---|---|---|---|---|---|');
  r.ranked.forEach((x, i) => L.push(`| ${i + 1} | ${x.id} | ${mdCell(x.title)} | ${x.business_value} | ${x.time_criticality} | ${x.risk_reduction} | ${x.job_size} | **${pyNum(x.wsjf)}** | ${x.points} | ${r.pids.has(x.id) ? T('in') : T('out')} |`));
  L.push('', `**${fmt('mdUsed', { used: r.used, cap: r.capacity, pct: r.pct })}** ${r.late.length ? fmt('deadlineAlert', { ids: r.late.join(', ') }) : T('deadlineOk')}`, '');
  L.push(`### 3 · ${T('mdOut')}`, '');
  if (r.out.length) r.out.forEach((o) => L.push(`- **${o.item.id}** ${mdCell(o.item.title)}: ${whyText(o)}`));
  else L.push('-');
  L.push('', `### 4 · ${T('mdObjectives')}`, '');
  const objs = (state.objectives || []).filter((o) => String(o.text || '').trim());
  if (objs.length) {
    L.push(`| # | ${T('objText')} | ${T('objBV')} | |`, '|---|---|---|---|');
    objs.forEach((o, i) => L.push(`| ${i + 1} | ${mdCell(o.text)} | ${o.bv ?? ''} | ${o.committed ? T('objCommitted') : `*${T('objUncommitted')}*`} |`));
  } else L.push(T('mdNoObjectives'));
  L.push('', `### 5 · ${T('mdDeps')}`, '');
  const flagged = r.ranked.filter((x) => (r.flags[x.id] || []).length);
  if (flagged.length) flagged.forEach((x) => L.push(`- **${x.id}**: ${r.flags[x.id].map(flagText).join('; ')}`));
  else L.push(T('mdNoFlags'));
  L.push('', `### 6 · ${T('mdJira')}`, '', 'jira-import.csv', '```csv', jiraCsv(r, state.project).trimEnd(), '```', `*${T('mdJiraNote')}*`, '');
  return L.join('\n');
}

/* ---------------------------------------------------------------------------------------------- AI prompts */
const langLine = () => (getLang() === 'fr' ? 'Answer in French (Banque Lumière, CB terms).' : 'Answer in English (Harbor Bank, Visa terms).');
const tableFor = (r) => ['id | title | type | BV | TC | RR/OE | size | WSJF | points | needs | deadline | in PI',
  ...r.ranked.map((x) => [x.id, x.title, x.type, x.business_value, x.time_criticality, x.risk_reduction, x.job_size, pyNum(x.wsjf), x.points, x.depends_on.join(';') || '-', x.deadline || '-', r.pids.has(x.id) ? 'in' : 'out'].join(' | '))].join('\n');

function promptChallenge(state) {
  const r = result(state);
  return [
    'You are a SAFe Product Owner coach (skill: managing-backlog). Challenge the WSJF scores of this PI backlog.',
    `Capacity ${r.capacity} points; used ${r.used}. Scale: modified Fibonacci 1, 2, 3, 5, 8, 13, 20. WSJF = (BV + TC + RR/OE) / job size.`,
    '', tableFor(r), '',
    ...(state.items || []).filter((x) => x.note).map((x) => `Note ${x.id}: ${x.note}`),
    '',
    'For each criterion, scores must be relative: the smallest item gets 1 and the others are scored against it. Check:',
    '1. Scores that look inflated or not relative (say which item should be the 1 for each column).',
    '2. Time criticality: a regulatory or audit deadline raises TC, it does not skip the ranking.',
    '3. Job size vs points: sizes that contradict the story points.',
    '4. Dependencies: an enabler scored low but needed by high-WSJF items.',
    'Give one line of reasoning per change. End with the full corrected features CSV (header: id,title,type,business_value,time_criticality,risk_reduction,job_size,points,depends_on,deadline) so it can be pasted back into the tool.',
    'Mark anything only a scheme rulebook can confirm as *to confirm*.', langLine(),
  ].join('\n');
}
function promptObjectives(state) {
  const r = result(state);
  const inPi = r.ranked.filter((x) => r.pids.has(x.id));
  return [
    'You are a SAFe Product Owner (skill: managing-backlog). Write the PI objectives for this plan.',
    `Committed features (${r.used}/${r.capacity} points):`, ...inPi.map((x) => `- ${x.id} ${x.title}${x.note ? ` (${x.note})` : ''}`),
    'Out of the PI:', ...r.out.map((o) => `- ${o.item.id} ${o.item.title}`),
    '',
    'Write 3–6 committed objectives in business words (outcomes, not feature names), each with a proposed business value 1–10 (mark as "proposed": the business owner sets it), and 1–2 uncommitted (stretch) objectives.',
    'Answer as a Markdown table: # | objective | business value (proposed) | committed or uncommitted | features it covers.',
    langLine(),
  ].join('\n');
}

/* ---------------------------------------------------------------------------------------------- view */
function mount(el, ctx) {
  const { ui } = ctx;
  const s0 = ctx.state;
  if (!Array.isArray(s0.items)) ctx.setState({ items: [] }, { silent: true });

  // ---- command bar: capacity · project key (items, scores and size are the grid)
  const capInput = ui.input({ type: 'number', value: ctx.state.capacity ?? 120, mono: true, size: 'sm' });
  capInput.min = '0'; capInput.step = '1'; capInput.inputMode = 'numeric';
  capInput.addEventListener('input', () => { ctx.setState({ capacity: capInput.value === '' ? 0 : Math.max(0, parseInt(capInput.value, 10) || 0) }, { silent: true }); refresh({ repaint: true }); });
  const capField = ctx.frame.bindField('capacity', ui.field({ label: `${T('capacity')} (${T('capacityUnit')})`, help: T('capacityHint'), input: capInput, required: true }));
  const projInput = ui.input({ value: ctx.state.project || '', mono: true, size: 'sm', placeholder: 'CARD' });
  projInput.addEventListener('input', () => { ctx.setState({ project: projInput.value.trim().toUpperCase() }, { silent: true }); refreshAdvCount(); });
  const projField = ui.field({ label: T('project'), help: T('projectHint'), input: projInput, optional: true });
  ctx.frame.command.append(capField, projField);

  // ---- advanced: capacity from velocity, paste CSV
  const calc = { ...DEFAULT_CALC, ...(ctx.state.calc || {}) };
  const advBody = document.createElement('div');
  advBody.className = 'wsjf-adv';
  const calcBox = document.createElement('fieldset');
  calcBox.className = 'wsjf-calc';
  const lg = document.createElement('legend'); lg.textContent = T('calcTitle'); calcBox.append(lg);
  const calcRow = document.createElement('div'); calcRow.className = 'wsjf-calc-row';
  const calcOut = document.createElement('p'); calcOut.className = 'wsjf-calc-out num';
  const useCalc = ui.button({ label: '', size: 'sm', onClick: () => { const c = capacityFrom(calc); capInput.value = c.net; ctx.setState({ capacity: c.net }, { silent: true }); refresh({ repaint: true }); } });
  for (const [k, lab] of [['sprints', 'sprints'], ['velocity', 'velocity'], ['runPct', 'runPct'], ['bufferPct', 'bufferPct']]) {
    const i = ui.input({ type: 'number', value: calc[k], mono: true, size: 'sm' });
    i.min = '0';
    i.addEventListener('input', () => { calc[k] = Math.max(0, +i.value || 0); ctx.setState({ calc: { ...calc } }, { silent: true }); paintCalc(); refreshAdvCount(); });
    calcRow.append(ui.field({ label: T(lab), input: i }));
  }
  const paintCalc = () => {
    const c = capacityFrom(calc);
    calcOut.textContent = fmt('calcResult', { s: calc.sprints, v: calc.velocity, g: c.gross, r: c.run, b: c.buffer, n: c.net });
    useCalc.setLabel(fmt('useCalc', { n: c.net }));
  };
  calcBox.append(calcRow, calcOut, useCalc);
  const pasteArea = ui.textarea({ rows: 4, mono: true, placeholder: 'id,title,type,business_value,time_criticality,risk_reduction,job_size,points,depends_on,deadline' });
  const pasteField = ui.field({ label: T('pasteTitle'), help: T('pasteHint'), input: pasteArea });
  const pasteBtn = ui.button({ label: T('pasteApply'), size: 'sm', icon: 'clipboard-paste', onClick: () => {
    const items = itemsFromCsv(pasteArea.value);
    if (!items.length) { pasteField.setError(T('pasteBad')); return; }
    pasteField.setError('');
    ctx.setState({ items: rankOrder(items) }, { silent: true });
    pasteArea.value = '';
    refresh({ repaint: true });
  } });
  advBody.append(calcBox, pasteField, pasteBtn);
  const adv = ui.advanced({ label: T('advanced'), body: advBody });
  const refreshAdvCount = () => {
    let n = 0;
    if (JSON.stringify({ ...DEFAULT_CALC, ...(ctx.state.calc || {}) }) !== JSON.stringify(DEFAULT_CALC)) n++;
    adv.setCount(n);
  };
  paintCalc(); refreshAdvCount();

  // ---- results: meta strip + capacity bar
  const strip = document.createElement('div'); strip.className = 'wsjf-strip';
  const pill = ui.statusPill({ tone: 'neutral', text: T('ready') });
  const counts = document.createElement('span'); counts.className = 'wsjf-counts num';
  strip.append(pill, counts);
  const bar = document.createElement('div'); bar.className = 'wsjf-bar'; bar.setAttribute('role', 'img');
  const errorsBox = document.createElement('div'); errorsBox.className = 'wsjf-errors'; errorsBox.setAttribute('role', 'status');

  // ---- grid
  let gridEl = null;
  let last = null;  // memo of the last computed result for the grid's computed cells
  const current = () => {
    const items = gridEl ? gridEl.getRows() : ctx.state.items || [];
    const key = JSON.stringify([items, ctx.state.capacity]);
    if (!last || last.key !== key) last = { key, r: compute(norm(items), ctx.state.capacity) };
    return last.r;
  };
  const byId = (r, id) => r.ranked.find((x) => x.id === id);
  const columns = [
    { key: '_rank', label: T('colRank'), width: 36, num: true, compute: (row) => { const r = current(); const i = r.ranked.findIndex((x) => x.id === row.id); return i < 0 ? '' : String(i + 1); } },
    { key: 'id', label: T('colId'), mono: true, width: 72 },
    { key: 'title', label: T('colTitle') },
    { key: 'type', label: T('colType'), type: 'select', options: TYPES, width: 96 },
    { key: 'business_value', label: T('colBV'), type: 'fib', width: 64 },
    { key: 'time_criticality', label: T('colTC'), type: 'fib', width: 64 },
    { key: 'risk_reduction', label: T('colRR'), type: 'fib', width: 64 },
    { key: 'job_size', label: T('colSize'), type: 'fib', width: 64 },
    { key: '_cod', label: T('colCoD'), width: 52, num: true, compute: (row) => { const x = byId(current(), row.id); return x ? String(x.cod) : ''; } },
    { key: '_wsjf', label: T('colWsjf'), width: 64, num: true, compute: (row) => { const x = byId(current(), row.id); if (!x) return ''; const b = document.createElement('b'); b.className = 'wsjf-score'; b.textContent = num(x.wsjf); return b; } },
    { key: 'points', label: T('colPts'), type: 'number', width: 64 },
    { key: 'depends_on', label: T('colDeps'), mono: true, width: 96, placeholder: '—' },
    { key: 'deadline', label: T('colDeadline'), type: 'select', options: DEADLINES(), width: 104 },
    { key: '_pi', label: T('colPI'), width: 112, compute: (row) => piCell(current(), row.id) },
  ];
  function piCell(r, id) {
    const box = document.createElement('span'); box.className = 'wsjf-pi';
    if (!byId(r, id)) return box;
    const inPi = r.pids.has(id);
    box.append(ui.badge({ text: inPi ? T('piIn') : T('piOut'), tone: inPi ? 'ok' : 'neutral', icon: inPi ? 'check' : 'minus' }));
    const flags = (r.flags[id] || []).filter((f) => f.code !== 'pulled');
    if (flags.length) {
      const w = ui.badge({ text: String(flags.length), tone: flags.some((f) => f.code === 'deadline' || f.code === 'cycle') ? 'bad' : 'warn' });
      w.title = flags.map(flagText).join('\n');
      const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = ' ' + flags.map(flagText).join('; ');
      w.append(sr);
      box.append(w);
    }
    return box;
  }
  const nextId = (rows) => {
    const n = rows.map((r) => /(\d+)$/.exec(r.id || '')).filter(Boolean).map((m) => +m[1]);
    const prefix = (/^(.*?)(\d+)$/.exec((rows[0] || {}).id || '') || [0, 'F-'])[1];
    return `${prefix}${String((n.length ? Math.max(...n) : 0) + 1).padStart(2, '0')}`;
  };
  gridEl = ui.grid({
    columns, rows: ctx.state.items || [], removable: true, addLabel: T('addItem'),
    newRow: (rows) => ({ id: nextId(rows), title: '', type: 'Story', business_value: 1, time_criticality: 1, risk_reduction: 1, job_size: 1, points: 0, depends_on: '', deadline: '', note: '' }),
    onChange: (rows) => {
      ctx.setState({ items: rows }, { silent: true });
      const a = document.activeElement;
      const typing = a && gridEl.contains(a) && a.tagName === 'INPUT' && a.type !== 'checkbox';
      if (typing) { pendingSort = true; refresh(); } else refresh({ resort: true });
    },
  });
  gridEl.classList.add('wsjf-grid');
  let pendingSort = false;
  gridEl.addEventListener('focusout', (e) => {
    if (!pendingSort || (e.relatedTarget && e.relatedTarget.closest && e.relatedTarget.closest('tr') === e.target.closest('tr'))) return;
    pendingSort = false;
    setTimeout(() => refresh({ resort: true }), 0);
  });
  const hint = document.createElement('p'); hint.className = 'wsjf-hint'; hint.textContent = `${T('itemsHint')} ${T('moveHint')}`;
  const empty = ui.emptyState({ icon: 'list-ordered', title: T('emptyItems'), text: T('emptyItemsBody'),
    action: { label: T('addItem'), onClick: () => gridEl.addRow(true) },
    sample: { label: getLang() === 'fr' ? 'CB FR' : 'Visa EN', onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });

  // ---- below the grid: out of PI + flags | PI objectives
  const lower = document.createElement('div'); lower.className = 'wsjf-lower';
  const outBox = document.createElement('section'); outBox.className = 'wsjf-panel';
  const objBox = document.createElement('section'); objBox.className = 'wsjf-panel';
  lower.append(outBox, objBox);

  function paintObjectives() {
    objBox.replaceChildren();
    const h = document.createElement('h2'); h.textContent = T('objectives');
    const p = document.createElement('p'); p.className = 'wsjf-hint'; p.textContent = T('objectivesHint');
    const objGrid = ui.grid({
      columns: [
        { key: 'text', label: T('objText'), placeholder: T('objPlaceholder') },
        { key: 'bv', label: T('objBV'), type: 'select', options: ['', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10], width: 64 },
        { key: 'committed', label: T('objCommitted'), type: 'check', width: 88 },
      ],
      rows: ctx.state.objectives || [], removable: true, addLabel: T('addObjective'),
      newRow: () => ({ text: '', bv: '', committed: true }),
      onChange: (rows) => ctx.setState({ objectives: rows.map((o) => ({ ...o, bv: o.bv === '' ? '' : +o.bv })) }, { silent: true }),
    });
    objBox.append(h, p, objGrid);
  }

  function paintOut(r) {
    outBox.replaceChildren();
    const h = document.createElement('h2'); h.textContent = `${T('mdOut')} · ${r.out.length}`;
    outBox.append(h);
    if (r.late.length) {
      const n = document.createElement('p'); n.className = 'wsjf-alert';
      n.append(ui.badge({ text: T('flagDeadline'), tone: 'bad' }), document.createTextNode(' ' + fmt('deadlineAlert', { ids: r.late.join(', ') })));
      outBox.append(n);
    } else if (r.ranked.some((x) => x.deadline === 'in-pi')) {
      const n = document.createElement('p'); n.className = 'wsjf-ok';
      n.append(ui.badge({ text: T('deadlineOk'), tone: 'ok' }));
      outBox.append(n);
    }
    const ul = document.createElement('ul'); ul.className = 'wsjf-list';
    for (const o of r.out) {
      const li = document.createElement('li');
      const id = document.createElement('code'); id.textContent = o.item.id;
      const t = document.createElement('span'); t.className = 'wsjf-li-title'; t.textContent = o.item.title;
      const why = document.createElement('span'); why.className = 'wsjf-li-why'; why.textContent = whyText(o);
      li.append(id, t, why);
      ul.append(li);
    }
    if (r.out.length) outBox.append(ul);
    const flagged = r.ranked.filter((x) => (r.flags[x.id] || []).length);
    if (flagged.length) {
      const h3 = document.createElement('h3'); h3.textContent = T('mdDeps');
      const fl = document.createElement('ul'); fl.className = 'wsjf-list';
      for (const x of flagged) for (const f of r.flags[x.id]) {
        const li = document.createElement('li');
        const id = document.createElement('code'); id.textContent = x.id;
        const tone = f.code === 'pulled' ? 'info' : f.code === 'deadline' || f.code === 'cycle' ? 'bad' : 'warn';
        li.append(id, ui.badge({ text: flagText(f), tone }));
        fl.append(li);
      }
      outBox.append(h3, fl);
    }
  }

  function paintBar(r) {
    bar.replaceChildren();
    const cap = Math.max(r.capacity, r.used, 1);
    const plannedItems = r.ranked.filter((x) => r.pids.has(x.id));
    for (const x of plannedItems) {
      const seg = document.createElement('span'); seg.className = 'wsjf-seg';
      seg.style.width = `${(100 * x.points) / cap}%`;
      seg.title = `${x.id} · ${x.points} ${T('capacityUnit')}`;
      if ((100 * x.points) / cap > 6) seg.textContent = x.id;
      bar.append(seg);
    }
    bar.setAttribute('aria-label', fmt('used', { used: r.used, cap: r.capacity, pct: r.pct }));
  }

  function decorate(r) {
    const tbody = gridEl.querySelector('tbody');
    if (!tbody) return;
    tbody.querySelectorAll('tr.wsjf-cut').forEach((x) => x.remove());
    const rows = gridEl.getRows();
    const trs = [...tbody.children];
    let cutAt = -1;
    trs.forEach((tr, i) => {
      const out = rows[i] && !r.pids.has(rows[i].id);
      tr.classList.toggle('is-out', !!out);
      if (out && cutAt < 0) cutAt = i;
    });
    if (cutAt >= 0 && rows.length) {
      const tr = document.createElement('tr'); tr.className = 'wsjf-cut';
      const td = document.createElement('td'); td.colSpan = columns.length + 1;
      const lab = document.createElement('span'); lab.textContent = fmt('cutLine', { free: r.capacity - r.used });
      td.append(lab); tr.append(td);
      tbody.insertBefore(tr, trs[cutAt]);
    }
  }

  const rankOrder = (items) => { const r = compute(norm(items), ctx.state.capacity); const pos = new Map(r.ranked.map((x, i) => [x.id, i])); return items.slice().sort((a, b) => (pos.get(a.id) ?? 1e9) - (pos.get(b.id) ?? 1e9)); };

  function refresh({ resort = false, repaint = false } = {}) {
    const items = ctx.state.items || [];
    if (resort || repaint) {
      const sorted = rankOrder(items);
      const changed = sorted.some((x, i) => x !== items[i]);
      if (changed || repaint) {
        const a = document.activeElement;
        const cell = a && gridEl.contains(a) && a.dataset.cell ? a.dataset.cell.split(':').map(Number) : null;
        const focusId = cell ? (gridEl.getRows()[cell[0]] || {}).id : null;
        ctx.setState({ items: sorted }, { silent: true });
        gridEl.setRows(sorted);
        if (focusId != null) {
          const ni = sorted.findIndex((x) => x.id === focusId);
          if (ni >= 0) { const x = gridEl.querySelector(`[data-cell="${ni}:${cell[1]}"]`); if (x) x.focus(); }
          gridEl.classList.remove('is-resorted'); void gridEl.offsetWidth; gridEl.classList.add('is-resorted');
        }
      }
    }
    last = null;
    const r = result(ctx.state);
    const hasItems = (ctx.state.items || []).length > 0;
    empty.hidden = hasItems;
    gridEl.hidden = !hasItems;
    lower.hidden = !hasItems;
    bar.hidden = !hasItems;
    const real = r.errors.filter((e) => e.code !== 'unknown-dep');
    const tone = !hasItems ? 'neutral' : r.late.length || r.used > r.capacity ? 'bad' : real.length ? 'warn' : 'ok';
    pill.update({ tone, text: hasItems ? fmt('used', { used: nf(r.used), cap: nf(r.capacity), pct: r.pct }) : T('ready') });
    counts.textContent = hasItems ? `${fmt('committed', { n: r.planned.length })} · ${fmt('candidates', { n: r.out.length })}` : '';
    errorsBox.replaceChildren();
    errorsBox.hidden = !r.errors.length;
    if (r.errors.length) {
      const b = document.createElement('b'); b.textContent = T('errorsTitle');
      const ul = document.createElement('ul');
      for (const e of r.errors) { const li = document.createElement('li'); li.textContent = e.text; ul.append(li); }
      errorsBox.append(ui.icon('triangle-alert'), b, ul);
    }
    paintBar(r);
    if (hasItems) { decorate(r); paintOut(r); }
    ctx.frame.setStatus({ tone, text: pill.textContent });
    return r;
  }

  const top = document.createElement('div'); top.className = 'wsjf-top';
  const itemsHead = document.createElement('div'); itemsHead.className = 'wsjf-items-head';
  const h2 = document.createElement('h2'); h2.textContent = T('items');
  itemsHead.append(h2, strip);
  top.append(adv);
  el.append(top, itemsHead, bar, errorsBox, hint, empty, gridEl, lower);
  paintObjectives();
  ctx.__wsjfRefresh = refresh;
  refresh({ resort: true });
}

/* ---------------------------------------------------------------------------------------------- module */
const sampleList = (lang) => SAMPLES[lang].map((s) => ({ id: s.id, label: s.title, hint: s.client, state: s.state, autorun: true }));

export default {
  id: 'wsjf-planner',
  skill: 'managing-backlog',
  icon: 'list-ordered',
  title: { en: 'WSJF & PI planner', fr: 'Planification WSJF et PI' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'list-ordered' },
  schema: 1,
  defaults() {
    return { title: '', capacity: 120, project: '', calc: { ...DEFAULT_CALC }, items: [], objectives: [] };
  },
  samples: { en: sampleList('en'), fr: sampleList('fr') },
  mount,
  validate(state) {
    const errs = [];
    if (!(Number(state.capacity) > 0)) errs.push({ field: 'capacity', message: getLang() === 'fr' ? 'Saisissez une capacité en points, par ex. 120.' : 'Enter a capacity in points, e.g. 120.' });
    return errs;
  },
  run(state, ctx) {
    const r = ctx.__wsjfRefresh ? ctx.__wsjfRefresh({ resort: true }) : result(state);
    return { planned: r.planned, used: r.used, capacity: r.capacity, late: r.late, notPlanned: r.notPlanned };
  },
  status(res, ms) {
    return { tone: res.late.length ? 'bad' : 'ok', text: fmt('used', { used: res.used, cap: res.capacity, pct: res.capacity ? Math.round((100 * res.used) / res.capacity) : 0 }), ms };
  },
  toMarkdown,
  exports: [
    { id: 'jira', label: { en: strings.en.exportJira, fr: strings.fr.exportJira }, build: (s) => ({ name: 'jira-import.csv', mime: 'text/csv', text: jiraCsv(result(s), s.project || 'PROJ') }) },
    { id: 'features', label: { en: strings.en.exportFeatures, fr: strings.fr.exportFeatures }, build: (s) => ({ name: 'features.csv', mime: 'text/csv', text: featuresCsv(norm(s.items)) }) },
  ],
  aiActions: [
    { id: 'challenge-scores', label: { en: strings.en.aiChallenge, fr: strings.fr.aiChallenge }, prompt: (s) => promptChallenge(s), expects: 'markdown' },
    { id: 'write-objectives', label: { en: strings.en.aiObjectives, fr: strings.fr.aiObjectives }, prompt: (s) => promptObjectives(s), expects: 'markdown' },
  ],
  // exposed for tests
  _internals: { toMarkdown, promptChallenge, promptObjectives, result },
};
