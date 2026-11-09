/* Impact heatmap logic (skill analysing-gaps-and-impacts). Pure, node-testable: `node logic.test.mjs`.
   state: change, deadline, areas (text "name, kind, owner" per line; kind system | team | process),
   scale ('impact' | 'effort'), scores {areaName: {people, process, data, tech, compliance: 0..3}},
   gaps [{area, dim, asIs, toBe, type: missing|change|remove|ok, owner, size: S|M|L|XL}]. */
import { parseList, toCsv } from '../mapping-grid/csv.js';

export const DIMS = ['people', 'process', 'data', 'tech', 'compliance'];
export const KINDS = ['system', 'team', 'process'];
export const GAP_TYPES = ['missing', 'change', 'remove', 'ok'];
export const SIZES = ['S', 'M', 'L', 'XL'];
export const SCALES = ['impact', 'effort'];
/** Effort basis (skill §4): S < 10 days, M 10–40, L 40–120 (a 3 covers L and XL). Days range per score. */
export const EFFORT_DAYS = { 0: [0, 0], 1: [1, 10], 2: [10, 40], 3: [40, 120] };

const KIND_ALIAS = { system: 'system', systems: 'system', 'système': 'system', systeme: 'system', application: 'system', app: 'system',
  team: 'team', teams: 'team', 'équipe': 'team', equipe: 'team', org: 'team', process: 'process', processus: 'process', procédure: 'process' };

export function parseAreas(text) {
  const seen = new Set();
  return parseList(text, ['area', 'name', 'zone', 'domaine']).map((r) => ({
    name: r[0] || '', kind: KIND_ALIAS[(r[1] || '').toLowerCase()] || 'system', owner: r.slice(2).join(', '),
  })).filter((a) => a.name && !seen.has(a.name) && seen.add(a.name));
}

export const cycle = (v, back = false) => ((+v || 0) + (back ? 3 : 1)) % 4;
const cell = (scores, a, d) => Math.max(0, Math.min(3, +((scores || {})[a] || {})[d] || 0));

export function compute(state) {
  const areas = parseAreas(state.areas);
  const gaps = (state.gaps || []).filter((g) => g && (g.area || g.asIs || g.toBe));
  const rows = areas.map((a) => {
    const scores = Object.fromEntries(DIMS.map((d) => [d, cell(state.scores, a.name, d)]));
    return { ...a, scores, total: DIMS.reduce((s, d) => s + scores[d], 0) };
  });
  const colTotals = Object.fromEntries(DIMS.map((d) => [d, rows.reduce((s, r) => s + r.scores[d], 0)]));
  const grand = rows.reduce((s, r) => s + r.total, 0);
  const max = rows.length * DIMS.length * 3;
  const gapFor = (a, d) => gaps.filter((g) => g.area === a && g.dim === d);
  const top = [];
  for (const r of rows) for (const d of DIMS) if (r.scores[d] >= 2) top.push({ area: r.name, kind: r.kind, owner: r.owner, dim: d, score: r.scores[d], areaTotal: r.total, gaps: gapFor(r.name, d) });
  top.sort((x, y) => y.score - x.score || y.areaTotal - x.areaTotal || rows.findIndex((r) => r.name === x.area) - rows.findIndex((r) => r.name === y.area) || DIMS.indexOf(x.dim) - DIMS.indexOf(y.dim));
  const flags = [];
  const names = new Set(rows.map((r) => r.name));
  for (const t of top) if (t.score === 3 && !t.gaps.length) flags.push({ code: 'flagNoGap', area: t.area, dim: t.dim, vars: { area: t.area } });
  gaps.forEach((g, i) => {
    if (g.area && !names.has(g.area)) flags.push({ code: 'flagUnknownArea', vars: { n: i + 1, area: g.area } });
    else if (g.area && g.dim && cell(state.scores, g.area, g.dim) === 0 && g.type !== 'ok') flags.push({ code: 'flagZeroCell', vars: { n: i + 1, area: g.area } , dim: g.dim });
    if (!(g.owner || '').trim() && g.type !== 'ok') flags.push({ code: 'flagNoOwner', vars: { n: i + 1, area: g.area || '?' }, dim: g.dim });
    if (!g.size && g.type !== 'ok') flags.push({ code: 'flagNoSize', vars: { n: i + 1, area: g.area || '?' }, dim: g.dim });
  });
  for (const r of rows) if (r.total > 0 && !r.owner) flags.push({ code: 'flagAreaNoOwner', vars: { area: r.name } });
  const days = rows.reduce((s, r) => { for (const d of DIMS) { s[0] += EFFORT_DAYS[r.scores[d]][0]; s[1] += EFFORT_DAYS[r.scores[d]][1]; } return s; }, [0, 0]);
  const byKind = Object.fromEntries(KINDS.map((k) => [k, rows.filter((r) => r.kind === k).reduce((s, r) => s + r.total, 0)]));
  const hot = rows.filter((r) => r.total > 0).sort((a, b) => b.total - a.total).slice(0, 3).map((r) => r.name);
  const counts = [0, 1, 2, 3].map((v) => rows.reduce((s, r) => s + DIMS.filter((d) => r.scores[d] === v).length, 0));
  return { rows, colTotals, grand, max, top, flags, gaps, days, byKind, hot, counts };
}

/** Keep scores in step when an area is renamed / removed: drop scores of names no longer listed. */
export function pruneScores(state) {
  const names = new Set(parseAreas(state.areas).map((a) => a.name));
  return Object.fromEntries(Object.entries(state.scores || {}).filter(([k]) => names.has(k)));
}

export function heatmapCsv(r, labels = {}) {
  const L = (k) => labels[k] || k;
  return toCsv([['area', 'kind', 'owner', ...DIMS, 'total'], ...r.rows.map((x) => [x.name, x.kind, x.owner, ...DIMS.map((d) => x.scores[d]), x.total]),
    ['TOTAL', '', '', ...DIMS.map((d) => r.colTotals[d]), r.grand]].map((row) => row.map((c) => (typeof c === 'string' && labels[c] ? L(c) : c))));
}
export function gapsCsv(r) {
  return toCsv([['area', 'dimension', 'score', 'as_is', 'to_be', 'gap_type', 'owner', 'size'],
    ...r.gaps.map((g) => [g.area, g.dim, g.area && g.dim ? (r.rows.find((x) => x.name === g.area)?.scores[g.dim] ?? '') : '', g.asIs, g.toBe, g.type, g.owner, g.size])]);
}
