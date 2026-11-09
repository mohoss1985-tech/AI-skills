/* Workshop kit: pure logic (skill facilitating-workshops). No DOM. Tested by logic.test.mjs.
   Rules from the skill: max 3 topics per 90 min, end with 10 min to read decisions and actions back,
   a decision-maker must attend ("no decision-maker = no decisions"), every action needs an owner and a date. */
import { csv, nextNum, csvObjects } from './jshared.js';

export const KINDS = ['intro', 'topic', 'break', 'readback'];
export const NOTE_TYPES = ['D', 'A', 'Q', 'REQ'];
export const READBACK_MIN = 10;
const DM_WORDS = /\b(decider|decision[- ]maker|sponsor|d[ée]cideur|d[ée]cisionnaire)\b/i;

/** "Ana (Head of cards, sponsor), Tom (Card IT); Legal (absent)" → [{name, role, dm, absent}] */
export function parseAttendees(text) {
  const out = [];
  const src = String(text || '');
  let depth = 0, cur = '';
  for (const c of src) {
    if (c === '(') depth++;
    if (c === ')') depth = Math.max(0, depth - 1);
    if ((c === ',' || c === ';' || c === '\n') && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean).map((s) => {
    const m = s.match(/^([^(]+?)\s*(?:\((.*)\))?$/);
    const name = (m ? m[1] : s).trim();
    const role = (m && m[2] ? m[2] : '').trim();
    return { name, role, dm: DM_WORDS.test(role), absent: /\b(absent|excused|excus[ée])\b/i.test(role) };
  });
}

export const maxTopics = (duration) => Math.max(1, Math.floor((3 * (+duration || 0)) / 90));
export const totalMinutes = (agenda) => (agenda || []).reduce((a, b) => a + (+b.minutes || 0), 0);

/** Start offsets (min) for each block. */
export function schedule(agenda, start = '') {
  let t = 0;
  const [hh, mm] = String(start || '').split(':').map(Number);
  const base = Number.isFinite(hh) && Number.isFinite(mm) ? hh * 60 + mm : null;
  return (agenda || []).map((b) => {
    const from = t; t += +b.minutes || 0;
    const clock = (x) => (base == null ? '' : `${String(Math.floor((base + x) / 60) % 24).padStart(2, '0')}:${String((base + x) % 60).padStart(2, '0')}`);
    return { id: b.id, from, to: t, fromClock: clock(from), toClock: clock(t) };
  });
}

/** Checks → [{id, level: 'ok'|'warn'|'bad', key, vars}] (keys are i18n keys of the tool). */
export function checks(state) {
  const agenda = state.agenda || [];
  const duration = +state.duration || 0;
  const total = totalMinutes(agenda);
  const out = [];
  if (!duration) out.push({ id: 'duration', level: 'bad', key: 'chkNoDuration' });
  else if (total > duration) out.push({ id: 'duration', level: 'bad', key: 'chkOver', vars: { n: total - duration, total, duration } });
  else if (total < duration) out.push({ id: 'duration', level: 'warn', key: 'chkUnder', vars: { n: duration - total, total, duration } });
  else out.push({ id: 'duration', level: 'ok', key: 'chkFits', vars: { total } });

  const topics = agenda.filter((b) => b.kind === 'topic').length;
  const max = maxTopics(duration);
  out.push(topics > max ? { id: 'topics', level: 'bad', key: 'chkTopicsOver', vars: { n: topics, max, duration } }
    : { id: 'topics', level: 'ok', key: 'chkTopicsOk', vars: { n: topics, max } });

  const rb = agenda.filter((b) => b.kind === 'readback');
  const last = agenda[agenda.length - 1];
  if (!rb.length) out.push({ id: 'readback', level: 'bad', key: 'chkNoReadback' });
  else if (rb.reduce((a, b) => a + (+b.minutes || 0), 0) < READBACK_MIN) out.push({ id: 'readback', level: 'warn', key: 'chkShortReadback' });
  else if (last && last.kind !== 'readback') out.push({ id: 'readback', level: 'warn', key: 'chkReadbackNotLast' });
  else out.push({ id: 'readback', level: 'ok', key: 'chkReadbackOk' });

  const people = parseAttendees(state.attendees);
  const dm = people.filter((p) => p.dm && !p.absent);
  out.push(dm.length ? { id: 'dm', level: 'ok', key: 'chkDmOk', vars: { names: dm.map((p) => p.name).join(', ') } }
    : { id: 'dm', level: 'bad', key: 'chkNoDm' });

  const empty = agenda.filter((b) => !(+b.minutes > 0) || !String(b.title || '').trim());
  if (empty.length) out.push({ id: 'blocks', level: 'warn', key: 'chkEmptyBlocks', vars: { n: empty.length } });

  const acts = (state.notes || []).filter((n) => n.type === 'A');
  const orphan = acts.filter((n) => !String(n.owner || '').trim() || !String(n.due || '').trim());
  if (acts.length) out.push(orphan.length ? { id: 'actions', level: 'warn', key: 'chkActionsOwner', vars: { ids: orphan.map((n) => n.id).join(', ') } }
    : { id: 'actions', level: 'ok', key: 'chkActionsOk', vars: { n: acts.length } });
  return out;
}

const round5 = (x) => Math.max(5, Math.round(x / 5) * 5);
/** Fit the agenda to the duration: add a 10-min read-back at the end if missing, keep intro/break/read-back
    as they are, scale topics proportionally (5-min steps), give the rounding remainder to the longest topic. */
export function fitToDuration(agenda, duration, readbackTitle = 'Read back decisions and actions') {
  let a = (agenda || []).map((b) => ({ ...b, minutes: +b.minutes || 0 }));
  const D = +duration || 0;
  if (!D) return a;
  if (!a.some((b) => b.kind === 'readback')) a.push({ id: 'b' + Math.random().toString(36).slice(2, 7), title: readbackTitle, kind: 'readback', minutes: READBACK_MIN, technique: '', questions: '' });
  // read-back last
  a = [...a.filter((b) => b.kind !== 'readback'), ...a.filter((b) => b.kind === 'readback')];
  for (const b of a) if (b.kind === 'readback' && b.minutes < READBACK_MIN) b.minutes = READBACK_MIN;
  const fixed = a.filter((b) => b.kind !== 'topic').reduce((s, b) => s + b.minutes, 0);
  const topics = a.filter((b) => b.kind === 'topic');
  if (!topics.length) return a;
  const room = Math.max(5 * topics.length, D - fixed);
  const cur = topics.reduce((s, b) => s + (b.minutes || 0), 0) || topics.length;
  for (const b of topics) b.minutes = round5(((b.minutes || 1) / cur) * room);
  let diff = D - totalMinutes(a);
  const longest = topics.slice().sort((x, y) => y.minutes - x.minutes)[0];
  if (longest.minutes + diff >= 5) longest.minutes += diff;
  else { // still over: trim fixed blocks except the read-back down to 5 min
    for (const b of a) { if (diff >= 0) break; if (b.kind === 'readback') continue; const cut = Math.min(b.minutes - 5, -diff); if (cut > 0) { b.minutes -= cut; diff += cut; } }
  }
  return a;
}

/** Timer: state.timer = {i, startedAt (epoch ms) | null, acc (ms already spent on block i), spent: {blockId: ms}} */
export const timerDefaults = () => ({ i: 0, startedAt: null, acc: 0, spent: {} });
export function elapsed(timer, now = Date.now()) {
  const t = timer || timerDefaults();
  return (t.acc || 0) + (t.startedAt ? Math.max(0, now - t.startedAt) : 0);
}
export function timerStart(timer, now = Date.now()) { const t = { ...timerDefaults(), ...timer }; if (!t.startedAt) t.startedAt = now; return t; }
export function timerPause(timer, now = Date.now()) { const t = { ...timerDefaults(), ...timer }; t.acc = elapsed(t, now); t.startedAt = null; return t; }
export function timerNext(timer, agenda, now = Date.now(), dir = 1) {
  const t = { ...timerDefaults(), ...timer, spent: { ...((timer && timer.spent) || {}) } };
  const running = !!t.startedAt;
  const b = (agenda || [])[t.i];
  if (b) t.spent[b.id] = elapsed(t, now);
  t.i = Math.min(Math.max(0, t.i + dir), Math.max(0, (agenda || []).length - 1));
  const nb = (agenda || [])[t.i];
  t.acc = nb ? t.spent[nb.id] || 0 : 0;
  t.startedAt = running ? now : null;
  return t;
}
export function timerReset() { return timerDefaults(); }
export const mmss = (ms) => { const s = Math.floor(Math.abs(ms) / 1000); return `${ms < 0 ? '−' : ''}${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

/** Quick capture: "A: Ask the processor @Tom 2026-11-20" → {type, text, owner, due}. */
export function parseNote(raw, fallbackType = 'D') {
  let text = String(raw || '').trim();
  let type = fallbackType;
  const m = text.match(/^(D|A|Q|R|REQ|RQ)\s*[:\-]\s*/i);
  if (m) { const k = m[1].toUpperCase(); type = k === 'R' || k === 'RQ' ? 'REQ' : k; text = text.slice(m[0].length); }
  let owner = '', due = '';
  const o = text.match(/(?:^|\s)@([\p{L}][\p{L}\p{N}._-]*)/u);
  if (o) { owner = o[1]; text = text.replace(o[0], ' '); }
  const d = text.match(/(?:^|\s)(\d{4}-\d{2}-\d{2})\b/);
  if (d) { due = d[1]; text = text.replace(d[0], ' '); }
  return { type, text: text.replace(/\s+/g, ' ').trim(), owner, due };
}
export function addNote(notes, note, blockId) {
  const list = notes || [];
  return [...list, { id: nextNum(list.filter((n) => n.type === note.type), note.type), type: note.type, text: note.text, owner: note.owner || '', due: note.due || '', block: blockId || '' }];
}
export const byType = (notes, type) => (notes || []).filter((n) => n.type === type);

/** Agenda CSV (paste back an AI draft): title,kind,minutes,technique,questions */
export function agendaFromCsv(text) {
  return csvObjects(text).map((o, i) => ({
    id: 'b' + (i + 1) + Math.random().toString(36).slice(2, 5),
    title: o.title || o.topic || o.titre || '',
    kind: KINDS.includes((o.kind || o.type || '').toLowerCase()) ? (o.kind || o.type).toLowerCase() : 'topic',
    minutes: +(o.minutes || o.min || o.duration || 0) || 0,
    technique: o.technique || '',
    questions: o.questions || '',
  })).filter((b) => b.title);
}

export function actionsCsv(state) {
  const blocks = Object.fromEntries((state.agenda || []).map((b) => [b.id, b.title]));
  return csv([['id', 'action', 'owner', 'due', 'block', 'workshop'],
    ...byType(state.notes, 'A').map((n) => [n.id, n.text, n.owner, n.due, blocks[n.block] || '', state.goal || ''])]);
}
