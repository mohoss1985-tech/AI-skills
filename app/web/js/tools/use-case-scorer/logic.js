/* AI use-case scorer · pure logic (skills/prioritizing-ai-use-cases). No DOM, runs under node.

   Use case = {id, name, value 1-5, feasibility 1-5, risk 1-5 (5 = a wrong answer does real harm),
               knowledge 1-5 (optional, readiness of approved content), volume (monthly contacts, optional),
               guardrail (bool: guardrail + human hand-off defined), regulated (bool: excluded topic), note}
   Score = Σ(score × weight) / Σ(weights), risk inverted (6 − risk), one decimal.
   Gates (skill §2): risk gate = risk ≥ 4 needs a guardrail before "Now"; knowledge gate = readiness 1–2 means content first.
   Lanes: Now (score ≥ nowMin, gates passed, within nowSlots), Next (score ≥ nextMin or gated), Later, Excluded (regulated). */

export const CRITERIA = ['value', 'feasibility', 'risk'];
export const DEFAULT_WEIGHTS = { value: 50, feasibility: 30, risk: 20 };
export const DEFAULT_RULES = { nowMin: 3.5, nextMin: 2.5, nowSlots: 3, riskGate: 4, knowledgeGate: 2 };

const clamp = (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(5, Math.max(1, n)) : 3;
};
const round1 = (x) => Math.round((x + Number.EPSILON) * 10) / 10;

export function score(u, weights = DEFAULT_WEIGHTS) {
  const w = { ...DEFAULT_WEIGHTS, ...weights };
  const total = CRITERIA.reduce((s, k) => s + Math.max(0, Number(w[k]) || 0), 0);
  if (!total) return 0;
  const part = (k) => (k === 'risk' ? 6 - clamp(u.risk) : clamp(u[k])) * Math.max(0, Number(w[k]) || 0);
  return round1(CRITERIA.reduce((s, k) => s + part(k), 0) / total);
}

/** 2×2 quadrant on value × feasibility (midpoint 3 counts as high). */
export function quadrant(u) {
  const hv = clamp(u.value) >= 3, hf = clamp(u.feasibility) >= 3;
  return hv && hf ? 'quick-win' : hv ? 'big-bet' : hf ? 'fill-in' : 'trap';
}

export function gates(u, rules = DEFAULT_RULES) {
  const r = { ...DEFAULT_RULES, ...rules };
  const out = [];
  if (clamp(u.risk) >= r.riskGate && !u.guardrail) out.push('risk');
  const k = u.knowledge === '' || u.knowledge == null ? null : clamp(u.knowledge);
  if (k !== null && k <= r.knowledgeGate) out.push('knowledge');
  return out;
}

export function compute(useCases, weights = DEFAULT_WEIGHTS, rules = DEFAULT_RULES) {
  const r = { ...DEFAULT_RULES, ...rules };
  const rows = useCases.map((u, i) => ({
    ...u,
    value: clamp(u.value), feasibility: clamp(u.feasibility), risk: clamp(u.risk),
    knowledge: u.knowledge === '' || u.knowledge == null ? null : clamp(u.knowledge),
    volume: Number(u.volume) || 0,
    order: i,
    score: score(u, weights),
    quadrant: quadrant(u),
    gates: u.regulated ? [] : gates(u, r),
  }));
  // Rank: score desc, then value desc, then volume desc, then input order.
  const ranked = rows.slice().sort((a, b) => (b.score - a.score) || (b.value - a.value) || (b.volume - a.volume) || (a.order - b.order));
  let slots = Number(r.nowSlots);
  if (!Number.isFinite(slots) || slots < 0) slots = DEFAULT_RULES.nowSlots;
  ranked.forEach((u, i) => {
    u.rank = i + 1;
    if (u.regulated) { u.lane = 'excluded'; u.why = 'regulated'; return; }
    if (u.score >= r.nowMin && !u.gates.length && slots > 0) { u.lane = 'now'; u.why = 'top'; slots--; return; }
    if (u.score >= r.nowMin && !u.gates.length) { u.lane = 'next'; u.why = 'capacity'; return; }
    if (u.score >= r.nowMin && u.gates.length) { u.lane = 'next'; u.why = 'gate'; return; }
    if (u.score >= r.nextMin) { u.lane = 'next'; u.why = u.gates.length ? 'gate' : 'score'; return; }
    u.lane = 'later'; u.why = 'low';
  });
  const lanes = { now: [], next: [], later: [], excluded: [] };
  for (const u of ranked) lanes[u.lane].push(u);
  return { ranked, lanes, weights: { ...DEFAULT_WEIGHTS, ...weights }, rules: r };
}

/* CSV ------------------------------------------------------------------------------------------- */
export const CSV_COLUMNS = ['id', 'name', 'value', 'feasibility', 'risk', 'knowledge', 'volume', 'guardrail', 'regulated', 'note'];

export function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Scores CSV: rank order, with computed columns. */
export function scoresCsv(res) {
  const head = ['rank', 'id', 'use_case', 'value', 'feasibility', 'risk', 'knowledge', 'volume', 'score', 'quadrant', 'lane', 'gates', 'guardrail', 'regulated', 'note'];
  const lines = [head.join(',')];
  for (const u of res.ranked) {
    lines.push([u.rank, u.id, u.name, u.value, u.feasibility, u.risk, u.knowledge ?? '', u.volume || '', u.score.toFixed(1),
      u.quadrant, u.lane, u.gates.join(';'), u.guardrail ? 'yes' : 'no', u.regulated ? 'yes' : 'no', u.note || ''].map(csvCell).join(','));
  }
  return lines.join('\n') + '\n';
}

export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

const yes = (v) => /^(1|y|yes|true|oui|o|x)$/i.test(String(v || '').trim());

/** CSV with a header (columns of CSV_COLUMNS or scoresCsv, any order) → use cases. */
export function useCasesFromCsv(text) {
  const [head, ...body] = parseCsv(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase().replace(/[\s-]+/g, '_'));
  const alias = { use_case: 'name', title: 'name', intent: 'name', cas_d_usage: 'name', valeur: 'value', faisabilite: 'feasibility', risque: 'risk' };
  return body.map((cells, i) => {
    const u = { id: `UC-${String(i + 1).padStart(2, '0')}`, name: '', value: 3, feasibility: 3, risk: 3, knowledge: '', volume: '', guardrail: false, regulated: false, note: '' };
    keys.forEach((k, j) => {
      const key = alias[k] || k;
      if (!(key in u)) return;
      const v = (cells[j] ?? '').trim();
      u[key] = key === 'guardrail' || key === 'regulated' ? yes(v) : ['value', 'feasibility', 'risk'].includes(key) ? clamp(v) : v;
    });
    return u;
  }).filter((u) => u.name);
}

/** Bubble chart geometry (plain numbers, the view draws the SVG): x = feasibility, y = value, r from risk. */
export function bubbles(res, { w = 520, h = 360, pad = 40 } = {}) {
  const sx = (f) => pad + ((f - 1) / 4) * (w - 2 * pad);
  const sy = (v) => h - pad - ((v - 1) / 4) * (h - 2 * pad);
  // Spread bubbles that share a cell so labels never sit on top of each other.
  const seen = new Map();
  return res.ranked.map((u) => {
    const key = `${u.feasibility}:${u.value}`;
    const n = seen.get(key) || 0;
    seen.set(key, n + 1);
    const angle = n * 2.1;
    const off = n ? 16 : 0;
    return { u, x: sx(u.feasibility) + Math.cos(angle) * off, y: sy(u.value) + Math.sin(angle) * off, r: 6 + u.risk * 3 };
  });
}
