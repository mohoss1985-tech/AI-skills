/* RACI & power grid: pure logic (skill aligning-stakeholders). No DOM. Tested by logic.test.mjs.
   Power / interest 0–100 (50 = midline). RACI rule: exactly one A and at least one R per row; a person is overloaded
   when they are R or A on more rows than the threshold. */
import { csv, csvObjects } from '../workshop-kit/jshared.js';

export const QUADS = ['manage', 'satisfy', 'inform', 'monitor'];
export const ROLES = ['', 'R', 'A', 'C', 'I'];
export const DEFAULT_OVERLOAD = 4;
export const clamp = (x) => Math.max(0, Math.min(100, Math.round(+x || 0)));

export function quadrant(s) {
  const p = clamp(s.power) >= 50, i = clamp(s.interest) >= 50;
  return p && i ? 'manage' : p ? 'satisfy' : i ? 'inform' : 'monitor';
}
export const cycle = (v) => ROLES[(ROLES.indexOf(v || '') + 1) % ROLES.length];

/** One row → {a, r, issues: ['noA'|'multiA'|'noR']} */
export function rowCheck(act, people) {
  const ids = new Set((people || []).map((p) => p.id));
  const vals = Object.entries(act.raci || {}).filter(([k]) => ids.has(k)).map(([, v]) => v);
  const a = vals.filter((v) => v === 'A').length, r = vals.filter((v) => v === 'R').length;
  const issues = [];
  if (a === 0) issues.push('noA'); if (a > 1) issues.push('multiA'); if (r === 0) issues.push('noR');
  return { a, r, issues };
}
/** Per person: counts of R/A/C/I, load = R + A, overloaded flag. */
export function loads(people, acts, threshold = DEFAULT_OVERLOAD) {
  return (people || []).map((p) => {
    const c = { R: 0, A: 0, C: 0, I: 0 };
    for (const a of acts || []) { const v = (a.raci || {})[p.id]; if (c[v] != null) c[v]++; }
    const load = c.R + c.A;
    return { id: p.id, ...c, load, overloaded: load > (+threshold || DEFAULT_OVERLOAD) };
  });
}
export function analyse(state) {
  const people = state.stakeholders || [], acts = state.activities || [];
  const rows = acts.map((a) => ({ id: a.id, name: a.name, ...rowCheck(a, people) }));
  const ld = loads(people, acts, state.overload);
  const quads = Object.fromEntries(QUADS.map((q) => [q, people.filter((p) => quadrant(p) === q)]));
  const bad = rows.filter((r) => r.issues.length);
  return { rows, loads: ld, quads, badRows: bad.length, overloaded: ld.filter((l) => l.overloaded), ok: !bad.length && !ld.some((l) => l.overloaded) };
}
export const nextSid = (people) => {
  let m = 0; for (const p of people || []) { const k = String(p.id).match(/^S(\d+)$/); if (k) m = Math.max(m, +k[1]); }
  return 'S' + (m + 1);
};
export const nextAid = (acts) => {
  let m = 0; for (const a of acts || []) { const k = String(a.id).match(/^R(\d+)$/); if (k) m = Math.max(m, +k[1]); }
  return 'R' + (m + 1);
};
/** Spread dots that sit on the same spot (display only). */
export function layoutDots(people, size = 100) {
  const seen = {};
  return (people || []).map((p) => {
    const k = `${clamp(p.interest)}:${clamp(p.power)}`; const n = (seen[k] = (seen[k] || 0) + 1) - 1;
    return { p, x: (clamp(p.interest) / 100) * size + n * 3, y: size - (clamp(p.power) / 100) * size + n * 3 };
  });
}

export function raciCsv(state) {
  const people = state.stakeholders || [];
  return csv([['id', 'activity', ...people.map((p) => p.name || p.id), 'check'],
    ...(state.activities || []).map((a) => { const c = rowCheck(a, people); return [a.id, a.name, ...people.map((p) => (a.raci || {})[p.id] || ''), c.issues.join(' ') || 'ok']; })]);
}
export function stakeholdersCsv(state, strategyOf = (q) => q) {
  return csv([['id', 'name', 'role', 'cares_about', 'power', 'interest', 'quadrant', 'strategy'],
    ...(state.stakeholders || []).map((p) => [p.id, p.name, p.role, p.cares, clamp(p.power), clamp(p.interest), quadrant(p), strategyOf(quadrant(p))])]);
}
/** name,role,cares_about,power,interest → stakeholders */
export function stakeholdersFromCsv(text) {
  const list = [];
  for (const o of csvObjects(text)) {
    if (!(o.name || o.nom)) continue;
    list.push({ id: nextSid(list), name: o.name || o.nom, role: o.role || o['rôle'] || '', cares: o.cares_about || o.cares || '', power: clamp(o.power ?? 50), interest: clamp(o.interest ?? 50) });
  }
  return list;
}
