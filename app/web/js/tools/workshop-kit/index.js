/* Workshop kit (facilitating-workshops), owner J.
   Plan: goal · attendees · duration → timed agenda with checks (overrun, max 3 topics / 90 min, 10-min read-back,
   decision-maker present) and "Fit to duration". Live: block timer (start / pause / next) kept in the workspace state
   (wall-clock based, so it survives remounts, language switches and reloads) + capture of D-/A-/Q-/REQ- notes.
   Report: compte-rendu Markdown (skill §3 contract), Word, actions CSV. Logic = logic.js (node logic.test.mjs). */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { fmtT, h, mdTable, fileBase, wordDoc, uid } from './jshared.js';
import {
  KINDS, NOTE_TYPES, parseAttendees, checks, schedule, totalMinutes, fitToDuration, elapsed, timerStart, timerPause,
  timerNext, timerReset, timerDefaults, mmss, parseNote, addNote, byType, agendaFromCsv, actionsCsv,
} from './logic.js';

const T = register('workshop-kit', strings);
const fmt = fmtT(T);
const TONE = { ok: 'ok', warn: 'warn', bad: 'bad' };
const ICON = { ok: 'circle-check', warn: 'triangle-alert', bad: 'circle-x' };
const issues = (cs) => cs.filter((c) => c.level !== 'ok').length;

/* ------------------------------------------------------------------------------------------- Markdown report */
function toMarkdown(s) {
  const people = parseAttendees(s.attendees);
  const present = people.filter((p) => !p.absent), absent = people.filter((p) => p.absent);
  const who = (p) => (p.role ? `${p.name} (${p.role.replace(/,?\s*absent/i, '')})` : p.name);
  const notes = s.notes || [];
  const blocks = Object.fromEntries((s.agenda || []).map((b) => [b.id, b.title]));
  const D = byType(notes, 'D'), R = byType(notes, 'REQ'), Q = byType(notes, 'Q'), A = byType(notes, 'A');
  const L = [`## ${T('mdTitle')} · ${s.goal || T('mdToComplete')}`, ''];
  const when = [s.date, s.start].filter(Boolean).join(', ');
  L.push(`**${T('mdDate')}:** ${when || T('mdToComplete')}${s.location ? ` · ${s.location}` : ''} · **${T('mdObjective')}:** ${s.goal || T('mdToComplete')}`);
  L.push(`**${T('mdPresent')}:** ${present.map(who).join(', ') || T('mdToComplete')}`);
  if (absent.length) L.push(`**${T('mdAbsent')}:** ${absent.map((p) => p.name).join(', ')}`);
  if (s.preReads) L.push(`**${T('mdPreReads')}:** ${s.preReads}`);
  L.push('', `### ${T('mdSummary')}`, fmt('mdSummaryLine', { d: D.length, r: R.length, q: Q.length, a: A.length }));
  if (!present.some((p) => p.dm)) L.push('', `> ${T('mdNoDm')}`);
  L.push('', `### ${T('mdDecisions')}`, D.length ? mdTable([T('mdId'), T('mdText'), T('block')], D.map((n) => [n.id, n.text, blocks[n.block]])) : '—');
  L.push('', `### ${T('mdRequirements')}`, R.length ? mdTable([T('mdId'), T('mdText'), T('block')], R.map((n) => [n.id, n.text, blocks[n.block]])) : '—');
  L.push('', `### ${T('mdQuestions')}`, Q.length ? mdTable([T('mdId'), T('mdText'), T('owner'), T('due')], Q.map((n) => [n.id, n.text, n.owner, n.due])) : '—');
  L.push('', `### ${T('mdActions')}`, A.length ? mdTable([T('mdId'), T('mdText'), T('owner'), T('due')], A.map((n) => [n.id, n.text + (!n.owner || !n.due ? ` (${T('mdFlag')})` : ''), n.owner, n.due])) : '—');
  const sch = schedule(s.agenda, s.start);
  const spent = (s.timer && s.timer.spent) || {};
  const cur = s.timer && (s.agenda || [])[s.timer.i];
  L.push('', `### ${T('mdAgenda')}`, (s.agenda || []).length ? mdTable([T('colTime'), T('colTitle'), T('colKind'), T('colMin'), T('mdActual'), T('colTechnique')], (s.agenda || []).map((b, i) => {
    const ms = cur && cur.id === b.id ? elapsed(s.timer) : spent[b.id];
    return [sch[i].fromClock || `+${sch[i].from}`, b.title, T('kind_' + b.kind), b.minutes, ms ? mmss(ms) : '', b.technique];
  })) : '—');
  const cs = checks(s);
  L.push('', `### ${T('mdChecks')}`, ...cs.map((c) => `- ${c.level === 'ok' ? '✓' : c.level === 'warn' ? '⚠' : '✗'} ${fmt(c.key, c.vars)}`));
  L.push('', `### ${T('mdNext')}`, s.nextWorkshop || T('mdToComplete'), '');
  return L.join('\n');
}

/* ------------------------------------------------------------------------------------------- AI prompts */
const langLine = () => (getLang() === 'fr' ? 'Answer in French (Compte-rendu, Décisions, Exigences, Points ouverts, Actions).' : 'Answer in English.');
const ctxLine = () => (getLang() === 'fr'
  ? 'Context: Banque Lumière (fictional French issuer), CB cards, GIE CB rules. Anything only the CB rulebook can confirm is *to confirm*.'
  : 'Context: Harbor Bank (fictional issuer), Visa cards. Anything only the Visa rulebook can confirm is *to confirm*.');
function promptAgenda(s) {
  return [
    'You are a senior Business Analyst preparing a requirements workshop (skill: facilitating-workshops, "Prepare" mode).', ctxLine(),
    `Goal: ${s.goal || '(not set)'}`, `Attendees: ${s.attendees || '(not set)'}`, `Duration: ${s.duration || '?'} min${s.start ? `, starting ${s.start}` : ''}`,
    s.preReads ? `Pre-reads: ${s.preReads}` : '',
    'Rules: never more than 3 topics per 90 minutes; end with a 10-minute block to read the decisions and actions back; flag missing roles (no decision-maker = no decisions);',
    'one technique per topic (process walk-through, example mapping, MoSCoW, dot voting, 5 whys); open questions first then precise ones, including "what happens when it fails? who is accountable? what does audit check?".',
    'Return: 1. objective and expected outputs, 2. missing roles, 3. session risks with one mitigation each, then a CSV block that sums exactly to the duration, with this header so it can be pasted back into the tool:',
    'title,kind,minutes,technique,questions', 'kind is one of intro, topic, break, readback.', langLine(),
  ].filter(Boolean).join('\n');
}
function promptReport(s) {
  const blocks = Object.fromEntries((s.agenda || []).map((b) => [b.id, b.title]));
  const notes = (s.notes || []).map((n) => `- ${n.id} [${blocks[n.block] || '-'}] ${n.text}${n.owner ? ` · owner ${n.owner}` : ''}${n.due ? ` · due ${n.due}` : ''}`);
  return [
    'You are a senior Business Analyst writing the workshop report (compte-rendu) the same day (skill: facilitating-workshops, "Follow up" mode).', ctxLine(),
    `Workshop goal: ${s.goal || '(not set)'}`, `Date: ${[s.date, s.start].filter(Boolean).join(' ')}`, `Attendees: ${s.attendees || '(not set)'}`,
    'Agenda: ' + (s.agenda || []).map((b) => `${b.title} (${b.minutes} min)`).join(' · '),
    'Raw notes captured live:', ...(notes.length ? notes : ['(none)']),
    s.nextWorkshop ? `Next workshop notes: ${s.nextWorkshop}` : '',
    'Write: header, 3-line summary, Decisions (D-xx, by whom), Requirements (REQ-xx: testable, type, source, MoSCoW if stated), Business rules (RG-xx, if… then… with an example),',
    'Open questions (Q-xx, owner, due), Risks & dependencies, Actions (A-xx, owner, due; flag a missing owner), Next workshop.',
    'Keep the IDs above. Never invent a decision: "we\'ll see" is an open question. Mark anything inferred *(to confirm)*. Regulatory statements are "stated by X, to confirm with Compliance".',
    'Keep numbers exactly as written. No customer data: use placeholders. Label it "AI-assisted draft".', langLine(),
  ].filter(Boolean).join('\n');
}

/* ------------------------------------------------------------------------------------------- view */
function mount(el, ctx) {
  const { ui, frame } = ctx;
  const st = () => ctx.state;
  if (!Array.isArray(st().agenda)) ctx.setState({ agenda: [] }, { silent: true });
  if (!Array.isArray(st().notes)) ctx.setState({ notes: [] }, { silent: true });
  if (!st().timer) ctx.setState({ timer: timerDefaults() }, { silent: true });
  const set = (patch) => { ctx.setState(patch, { silent: true }); refresh(); };

  // ---- command bar
  const goal = ui.input({ value: st().goal || '', placeholder: T('goalPh'), onInput: (v) => set({ goal: v }) });
  const att = ui.input({ value: st().attendees || '', placeholder: T('attendeesPh'), onInput: (v) => set({ attendees: v }) });
  const dur = ui.input({ type: 'number', value: st().duration ?? '', mono: true, onInput: (v) => set({ duration: v === '' ? '' : +v }) });
  dur.min = '15'; dur.step = '5';
  const fGoal = frame.bindField('goal', ui.field({ label: T('goal'), required: true, input: goal }));
  const fAtt = frame.bindField('attendees', ui.field({ label: T('attendees'), required: true, input: att, help: T('attendeesHelp') }));
  const fDur = frame.bindField('duration', ui.field({ label: T('duration'), required: true, input: dur }));
  fGoal.classList.add('wk-goal'); fAtt.classList.add('wk-att'); fDur.classList.add('wk-dur');
  frame.command.append(fGoal, fAtt, fDur);

  // ---- advanced
  const advKeys = ['date', 'start', 'location', 'preReads', 'nextWorkshop'];
  const advCount = () => advKeys.filter((k) => String(st()[k] || '').trim()).length;
  const advGrid = h('div', { class: 'wk-adv' });
  for (const k of advKeys) {
    const inp = k === 'nextWorkshop' || k === 'preReads'
      ? ui.textarea({ value: st()[k] || '', rows: 2, onInput: (v) => { set({ [k]: v }); adv.setCount(advCount()); } })
      : ui.input({ value: st()[k] || '', type: k === 'date' ? 'date' : k === 'start' ? 'time' : 'text', onInput: (v) => { set({ [k]: v }); adv.setCount(advCount()); } });
    advGrid.append(ui.field({ label: T(k), input: inp }));
  }
  const pasteArea = ui.textarea({ rows: 3, mono: true, placeholder: 'title,kind,minutes,technique,questions' });
  const pasteField = ui.field({ label: T('pasteAgenda'), help: T('pasteHint'), input: pasteArea });
  const pasteBtn = ui.button({ label: T('pasteApply'), size: 'sm', icon: 'import', onClick: () => {
    const list = agendaFromCsv(pasteArea.value);
    if (!list.length) { pasteField.setError(T('pasteBad')); return; }
    pasteField.setError(''); pasteArea.value = '';
    set({ agenda: list, timer: timerReset() }); gridEl.setRows(list); refresh();
  } });
  const adv = ui.advanced({ label: T('advanced'), body: h('div', { class: 'wk-adv-wrap' }, advGrid, pasteField, h('div', {}, pasteBtn)), count: advCount() });

  // ---- head strip
  const pill = ui.statusPill({ tone: 'neutral', text: '' });

  // ---- PLAN: agenda grid + attendees + checks
  const curAgenda = () => (gridEl ? gridEl.getRows() : st().agenda);
  let gridEl = null;
  const kindOpts = KINDS.map((k) => ({ value: k, label: T('kind_' + k) }));
  gridEl = ui.grid({
    columns: [
      { key: '_t', label: T('colTime'), width: 64, compute: (row) => { const a = curAgenda(); const i = a.findIndex((b) => b.id === row.id); const sc = schedule(a, st().start)[i]; return sc ? (sc.fromClock || `+${sc.from}`) : ''; } },
      { key: 'title', label: T('colTitle') },
      { key: 'kind', label: T('colKind'), type: 'select', options: kindOpts, width: 128 },
      { key: 'minutes', label: T('colMin'), type: 'number', width: 80 },
      { key: 'technique', label: T('colTechnique'), width: 180 },
      { key: 'questions', label: T('colQuestions') },
      { key: '_n', label: T('colNotes'), num: true, width: 56, compute: (row) => String((st().notes || []).filter((n) => n.block === row.id).length || '') },
    ],
    rows: st().agenda, removable: true, addLabel: T('addBlock'),
    newRow: () => ({ id: 'b' + uid(), title: T('newBlock'), kind: 'topic', minutes: 15, technique: '', questions: '' }),
    onChange: (rows) => set({ agenda: rows.map((r) => ({ ...r, minutes: +r.minutes || 0 })) }),
  });
  gridEl.classList.add('wk-grid');
  const fitBtn = ui.button({ label: T('fit'), size: 'sm', variant: 'secondary', icon: 'maximize', onClick: () => {
    const a = fitToDuration(curAgenda(), st().duration, T('readbackTitle'));
    set({ agenda: a }); gridEl.setRows(a); refresh(); ui.toast(fmt('fitDone', { n: st().duration }));
  } });
  const peopleBox = h('div', { class: 'wk-people' });
  const checksBox = h('ul', { class: 'wk-checks', 'aria-live': 'polite' });
  const emptyPlan = ui.emptyState({ icon: 'timer', title: T('emptyTitle'), text: T('empty'),
    action: { label: T('addBlock'), onClick: () => gridEl.addRow(true) },
    sample: { label: T('load'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });
  const planMain = h('section', { class: 'wk-plan-main' }, h('div', { class: 'wk-sec-head' }, h('h2', { text: T('agenda') }), fitBtn), emptyPlan, gridEl);
  const planSide = h('aside', { class: 'wk-side' }, h('h2', { text: T('checks') }), checksBox, h('h2', { text: T('people') }), peopleBox);
  const planPanel = h('div', { class: 'wk-plan' }, planMain, planSide);

  // ---- LIVE: timer + capture + notes
  const tBlock = h('div', { class: 'wk-t-block' });
  const tTitle = h('div', { class: 'wk-t-title' });
  const tClock = h('div', { class: 'wk-t-clock num', role: 'timer', 'aria-label': T('timerAria') });
  const tSub = h('div', { class: 'wk-t-sub num' });
  const tBar = h('div', { class: 'wk-t-bar' }, h('i'));
  const btnPrev = ui.button({ icon: 'chevron-left', ariaLabel: T('prev'), variant: 'ghost', onClick: () => timerDo((t) => timerNext(t, curAgenda(), Date.now(), -1)) });
  const btnRun = ui.button({ label: T('startT'), icon: 'play', variant: 'primary', onClick: () => timerDo((t) => (t.startedAt ? timerPause(t) : timerStart(t))) });
  const btnNext = ui.button({ label: T('next'), iconRight: 'chevron-right', variant: 'secondary', onClick: () => timerDo((t) => timerNext(t, curAgenda())) });
  const btnReset = ui.button({ icon: 'rotate-ccw', ariaLabel: T('resetTimer'), title: T('resetTimer'), variant: 'ghost', onClick: () => timerDo(() => timerReset()) });
  const timerBox = h('section', { class: 'wk-timer panel' }, tBlock, tTitle, tClock, tSub, tBar, h('div', { class: 'wk-t-btns' }, btnPrev, btnRun, btnNext, btnReset));
  const blockList = h('ol', { class: 'wk-blocks' });
  function timerDo(fn) { set({ timer: fn({ ...timerDefaults(), ...st().timer }) }); paintTimer(); paintBlocks(); }

  let capType = 'D';
  const typeSeg = ui.segmented({ options: NOTE_TYPES.map((k) => ({ value: k, label: T('noteType_' + k) })), value: capType, label: T('capture'), onChange: (v) => { capType = v; } });
  const capInput = ui.input({ placeholder: T('capturePh'), ariaLabel: T('capture') });
  const capOwner = ui.input({ placeholder: T('owner'), ariaLabel: T('owner'), size: 'sm' });
  const capDue = ui.input({ type: 'date', ariaLabel: T('due'), size: 'sm' });
  const capAdd = () => {
    const p = parseNote(capInput.value, capType);
    if (!p.text) { capInput.focus(); return; }
    if (!p.owner) p.owner = capOwner.value.trim();
    if (!p.due) p.due = capDue.value;
    const a = curAgenda(); const blk = a[(st().timer || {}).i || 0];
    set({ notes: addNote(st().notes, p, blk && blk.id) });
    capInput.value = ''; capOwner.value = ''; capDue.value = ''; capInput.focus();
    paintNotes(); gridEl.setRows(curAgenda());
  };
  capInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); capAdd(); } });
  const capBox = h('section', { class: 'wk-capture' }, h('h2', { text: T('capture') }), typeSeg,
    h('div', { class: 'wk-cap-row' }, capInput, capOwner, capDue, ui.button({ label: T('add'), icon: 'plus', size: 'md', onClick: capAdd })),
    h('p', { class: 'wk-hint', text: T('captureHelp') }));
  const notesCount = h('p', { class: 'wk-hint num' });
  const notesBox = h('div', { class: 'wk-notes' });
  const livePanel = h('div', { class: 'wk-live' },
    h('div', { class: 'wk-live-left' }, timerBox, blockList),
    h('div', { class: 'wk-live-right' }, capBox, notesCount, notesBox));

  // ---- REPORT
  const reportBody = h('div', { class: 'wk-report markdown' });
  const reportPanel = h('div', {}, h('p', { class: 'wk-hint', text: T('reportHint') }), reportBody);

  const tabs = ui.tabs({ tabs: [{ id: 'plan', label: T('tabPlan') }, { id: 'live', label: T('tabLive') }, { id: 'report', label: T('tabReport') }],
    active: st()._tab || 'plan', panels: { plan: planPanel, live: livePanel, report: reportPanel },
    onChange: (id) => { ctx.setState({ _tab: id }, { silent: true }); if (id === 'report') paintReport(); if (id === 'live') { paintTimer(); paintBlocks(); paintNotes(); } } });
  el.append(h('div', { class: 'jk-top' }, adv, pill), tabs);

  /* painters */
  function paintTimer() {
    const a = curAgenda(); const t = { ...timerDefaults(), ...st().timer };
    if (!a.length) { tBlock.textContent = ''; tTitle.textContent = T('noAgenda'); tClock.textContent = '00:00'; tSub.textContent = ''; tBar.firstChild.style.width = '0'; btnRun.disabled = btnNext.disabled = btnPrev.disabled = true; return; }
    btnRun.disabled = btnNext.disabled = btnPrev.disabled = false;
    const i = Math.min(t.i, a.length - 1); const b = a[i];
    const ms = elapsed(t); const plan = (+b.minutes || 0) * 60000; const left = plan - ms;
    tBlock.textContent = fmt('timerBlock', { i: i + 1, n: a.length }) + ' · ' + T('kind_' + b.kind);
    tTitle.textContent = b.title;
    tClock.textContent = mmss(ms);
    tSub.textContent = `${fmt('timerPlanned', { m: b.minutes })} · ${left >= 0 ? fmt('timerLeft', { t: mmss(left) }) : fmt('timerOver', { t: mmss(-left) })}`;
    timerBox.classList.toggle('is-over', left < 0);
    tBar.firstChild.style.width = Math.min(100, plan ? (100 * ms) / plan : 0) + '%';
    btnRun.setLabel(t.startedAt ? T('pause') : ms ? T('resume') : T('startT'));
    btnPrev.disabled = i === 0; btnNext.disabled = i >= a.length - 1;
  }
  function paintBlocks() {
    const a = curAgenda(); const t = { ...timerDefaults(), ...st().timer }; const sch = schedule(a, st().start);
    blockList.replaceChildren(...a.map((b, i) => {
      const spent = i === t.i ? elapsed(t) : (t.spent || {})[b.id];
      return h('li', { class: i === t.i ? 'is-current' : '', 'aria-current': i === t.i ? 'step' : null },
        h('span', { class: 'num wk-b-time', text: sch[i].fromClock || `+${sch[i].from}` }), h('span', { class: 'wk-b-title', text: b.title }),
        h('span', { class: 'num wk-b-min', text: (spent ? mmss(spent) + ' / ' : '') + b.minutes + ' min' }));
    }));
  }
  function paintNotes() {
    const notes = st().notes || []; const a = curAgenda();
    notesCount.textContent = fmt('notesCount', { d: byType(notes, 'D').length, a: byType(notes, 'A').length, q: byType(notes, 'Q').length, r: byType(notes, 'REQ').length });
    tabs.setCount('live', notes.length || undefined);
    if (!notes.length) { notesBox.replaceChildren(h('p', { class: 'wk-hint', text: T('noNotes') })); return; }
    const groups = [...a.map((b) => ({ id: b.id, title: b.title })), { id: '', title: '—' }];
    const out = [];
    for (const g of groups) {
      const ns = notes.filter((n) => (g.id ? n.block === g.id : !a.some((b) => b.id === n.block)));
      if (!ns.length) continue;
      out.push(h('h3', { text: g.title }));
      const ul = h('ul', { class: 'wk-note-list' });
      for (const n of ns) {
        const tone = { D: 'accent', A: 'info', Q: 'warn', REQ: 'neutral' }[n.type];
        const li = h('li', {}, h('code', { text: n.id }), ui.badge({ text: T('noteType_' + n.type), tone }), h('span', { class: 'wk-n-text', text: n.text }));
        if (n.type === 'A' || n.type === 'Q') {
          const o = ui.input({ value: n.owner, placeholder: T('owner'), ariaLabel: `${T('owner')} ${n.id}`, size: 'sm', onInput: (v) => updNote(n.id, { owner: v }) });
          const d = ui.input({ value: n.due, type: 'date', ariaLabel: `${T('due')} ${n.id}`, size: 'sm', onInput: (v) => updNote(n.id, { due: v }) });
          o.classList.add('wk-n-owner'); d.classList.add('wk-n-due');
          li.append(o, d);
        }
        li.append(ui.button({ icon: 'trash-2', ariaLabel: `${T('remove')} ${n.id}`, variant: 'ghost', size: 'sm', onClick: () => { set({ notes: (st().notes || []).filter((x) => x.id !== n.id) }); paintNotes(); gridEl.setRows(curAgenda()); } }));
        ul.append(li);
      }
      out.push(ul);
    }
    notesBox.replaceChildren(...out);
  }
  function updNote(id, patch) { set({ notes: (st().notes || []).map((n) => (n.id === id ? { ...n, ...patch } : n)) }); }
  async function paintReport() {
    try { const { renderMarkdown } = await import('../../core/markdown.js'); await renderMarkdown(reportBody, toMarkdown(st())); }
    catch { reportBody.replaceChildren(h('pre', { text: toMarkdown(st()) })); }
  }
  function refresh() {
    const s = st(); const cs = checks(s); const a = s.agenda || [];
    emptyPlan.hidden = a.length > 0; gridEl.hidden = !a.length;
    checksBox.replaceChildren(...cs.map((c) => h('li', {}, ui.badge({ text: fmt(c.key, c.vars), tone: TONE[c.level], icon: ICON[c.level] }))));
    const ppl = parseAttendees(s.attendees);
    peopleBox.replaceChildren(ppl.length ? h('ul', { class: 'wk-people-list' }, ...ppl.map((p) => h('li', { class: p.absent ? 'is-absent' : '' },
      h('span', { class: 'wk-p-name', text: p.name }), h('span', { class: 'wk-p-role', text: p.role }),
      p.dm ? ui.badge({ text: T('dm'), tone: 'accent', icon: 'star' }) : null, p.absent ? ui.badge({ text: T('absent'), tone: 'neutral', icon: 'circle-x' }) : null)))
      : h('p', { class: 'wk-hint', text: T('noPeople') }));
    const n = issues(cs); const vars = { total: totalMinutes(a), duration: s.duration || 0, blocks: a.length, issues: n };
    const text = n ? fmt('meta', vars) : fmt('metaOk', vars);
    const tone = cs.some((c) => c.level === 'bad') ? 'bad' : n ? 'warn' : 'ok';
    pill.update({ tone, text }); frame.setStatus({ tone, text });
    tabs.setCount('plan', n || undefined);
    adv.setCount(advCount());
    if (tabs.active === 'live') { paintTimer(); paintBlocks(); }
    if (tabs.active === 'report') paintReport();
    return cs;
  }
  ctx.__wkRefresh = refresh;
  refresh(); paintTimer(); paintBlocks(); paintNotes();
  // the timer ticks from the wall clock; it stops when the tool leaves the screen
  const iv = setInterval(() => { if (!el.isConnected) { clearInterval(iv); return; } if (st().timer && st().timer.startedAt && tabs.active === 'live') { paintTimer(); paintBlocks(); } }, 500);
}

/* ------------------------------------------------------------------------------------------- module */
const sampleList = (lang) => SAMPLES[lang].map((s) => ({ id: s.id, label: s.label, hint: s.hint, state: s.state, autorun: true }));

export default {
  id: 'workshop-kit',
  skill: 'facilitating-workshops',
  icon: 'timer',
  title: { en: 'Workshop kit', fr: 'Kit d’atelier' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'list-checks' },
  schema: 1,
  defaults() {
    return { goal: '', attendees: '', duration: 90, date: '', start: '', location: '', preReads: '', nextWorkshop: '', agenda: [], notes: [], timer: timerDefaults() };
  },
  samples: { en: sampleList('en'), fr: sampleList('fr') },
  mount,
  validate(s) {
    const e = [];
    if (!String(s.goal || '').trim()) e.push({ field: 'goal', message: T('errGoal') });
    if (!parseAttendees(s.attendees).length) e.push({ field: 'attendees', message: T('errAttendees') });
    if (!(+s.duration > 0)) e.push({ field: 'duration', message: T('errDuration') });
    return e;
  },
  run(s, ctx) {
    const cs = ctx.__wkRefresh ? ctx.__wkRefresh() : checks(s);
    return { checks: cs.map((c) => ({ id: c.id, level: c.level })), total: totalMinutes(s.agenda), duration: +s.duration, blocks: (s.agenda || []).length, notes: (s.notes || []).length };
  },
  status(r, ms) {
    const n = r.checks.filter((c) => c.level !== 'ok').length;
    const vars = { total: r.total, duration: r.duration, blocks: r.blocks, issues: n };
    return { tone: r.checks.some((c) => c.level === 'bad') ? 'bad' : n ? 'warn' : 'ok', text: n ? fmt('meta', vars) : fmt('metaOk', vars), ms };
  },
  toMarkdown,
  exports: [
    { id: 'word', label: { en: strings.en.exWord, fr: strings.fr.exWord }, build: async (s) => ({ name: fileBase('workshop-report ' + (s.goal || '')) + '.doc', mime: 'application/msword', text: await wordDoc(T('mdTitle'), toMarkdown(s)) }) },
    { id: 'actions-csv', label: { en: strings.en.exCsv, fr: strings.fr.exCsv }, build: (s) => ({ name: 'workshop-actions.csv', mime: 'text/csv', text: actionsCsv(s) }) },
  ],
  aiActions: [
    { id: 'draft-agenda', label: { en: strings.en.aiAgenda, fr: strings.fr.aiAgenda }, expects: 'markdown', prompt: (s) => promptAgenda(s) },
    { id: 'clean-report', label: { en: strings.en.aiReport, fr: strings.fr.aiReport }, expects: 'markdown', prompt: (s) => promptReport(s) },
  ],
  _internals: { toMarkdown, promptAgenda, promptReport },
};
