/* WSJF & PI planner · pure logic, a line-for-line port of skills/managing-backlog/scripts/wsjf.py.
   No DOM, no i18n: runs in the browser, in the static demo and under `node` (test.html / logic.test.mjs).

   Item = {id, title, type, business_value, time_criticality, risk_reduction, job_size, points,
           depends_on ("F-06;F-03" or array), deadline ("in-pi" | "next-pi" | "")}
   WSJF = (business_value + time_criticality + risk_reduction) / job_size, rounded to 2 decimals like Python round(). */

export const FIB = [1, 2, 3, 5, 8, 13, 20];
export const SCORE_KEYS = ['business_value', 'time_criticality', 'risk_reduction', 'job_size'];
export const CSV_COLUMNS = ['id', 'title', 'type', 'business_value', 'time_criticality', 'risk_reduction',
  'job_size', 'points', 'depends_on', 'deadline'];

/** Python's round(n / d, 2) for integers n, d > 0 (half to even on the exact value, which is what
    Python does for these ratios: the only exact ties are n/8, and those are exact in binary). */
export function round2(n, d) {
  if (!Number.isInteger(n) || !Number.isInteger(d)) return Math.round((n / d) * 100) / 100;
  const num = n * 100;
  let q = Math.floor(num / d);
  const r = num - q * d;
  if (2 * r > d || (2 * r === d && q % 2 === 1)) q += 1;
  return q / 100;
}

/** str(float) in Python: 3.0, 8.2, 9.67 (JS would print 3). */
export const pyNum = (x) => (Number.isInteger(x) ? x.toFixed(1) : String(x));

export const depsOf = (v) => (Array.isArray(v) ? v : String(v || '').split(';')).map((d) => String(d).trim()).filter(Boolean);

function toInt(v) {
  const s = String(v ?? '').trim();
  return /^[+-]?\d+$/.test(s) ? parseInt(s, 10) : NaN;
}

/** wsjf.py load(): normalise rows, compute cod and wsjf, collect the same error messages. */
export function load(items) {
  const rows = [];
  const errors = [];
  items.forEach((it, i) => {
    const n = i + 2;  // CSV line number (header = line 1), same numbering as the script
    const r = {};
    for (const k of Object.keys(it)) r[k] = typeof it[k] === 'string' ? it[k].trim() : it[k];
    r.id = String(r.id ?? '').trim();
    r.title = String(r.title ?? '').trim();
    r.type = String(r.type ?? '').trim();
    r.deadline = String(r.deadline ?? '').trim();
    for (const c of SCORE_KEYS) {
      const v = toInt(r[c]);
      if (Number.isNaN(v)) {
        errors.push({ code: 'nan', id: r.id || '?', field: c, line: n, text: `line ${n} (${r.id || '?'}): ${c} must be a number` });
        r[c] = 1;
      } else {
        r[c] = v;
        if (!FIB.includes(v)) errors.push({ code: 'scale', id: r.id, field: c, value: v, line: n, text: `line ${n} (${r.id}): ${c}=${v} is not on the scale 1,2,3,5,8,13,20` });
      }
    }
    const p = String(r.points ?? '').trim() === '' ? 0 : toInt(r.points);
    if (Number.isNaN(p)) {
      errors.push({ code: 'points', id: r.id, field: 'points', line: n, text: `line ${n} (${r.id}): points must be a number` });
      r.points = 0;
    } else r.points = p;
    r.depends_on = depsOf(r.depends_on);
    r.cod = r.business_value + r.time_criticality + r.risk_reduction;
    r.wsjf = r.job_size > 0 ? round2(r.cod, r.job_size) : 0;
    rows.push(r);
  });
  const ids = new Set(rows.map((r) => r.id));
  for (const r of rows) for (const d of r.depends_on) {
    if (!ids.has(d)) errors.push({ code: 'unknown-dep', id: r.id, dep: d, text: `${r.id}: depends on unknown item ${d}` });
  }
  const seen = new Set();
  for (const r of rows) {
    if (r.id && seen.has(r.id)) errors.push({ code: 'dup', id: r.id, text: `${r.id}: duplicate id` });
    seen.add(r.id);
  }
  return { rows, errors };
}

/** wsjf.py plan(): rank, then fit items with their dependencies into the capacity.
    Unknown dependencies are ignored here (load() reports them), so the grid stays live while typing. */
export function plan(rows, capacity) {
  const cmp = (a, b) => (b.wsjf - a.wsjf)
    || ((a.deadline !== 'in-pi') - (b.deadline !== 'in-pi'))
    || (a.job_size - b.job_size);
  const ranked = rows.slice().sort(cmp);  // stable, like Python's sorted()
  const byId = new Map(rows.map((r) => [r.id, r]));
  const planned = [];
  let used = 0;

  function closure(r, seen = []) {
    if (seen.includes(r.id)) return null;
    const out = [];
    for (const d of r.depends_on) {
      const dep = byId.get(d);
      if (!dep) continue;
      if (planned.includes(dep) || out.includes(dep)) continue;
      const sub = closure(dep, [...seen, r.id]);
      if (sub === null) return null;
      for (const x of sub) if (!out.includes(x)) out.push(x);
    }
    return [...out, r];
  }

  for (const r of ranked) {
    if (planned.includes(r)) continue;
    const group = closure(r);
    const need = group ? group.reduce((s, x) => s + x.points, 0) : null;
    if (group && used + need <= capacity) {
      planned.push(...group);
      used += need;
    }
  }
  const out = [];
  for (const r of ranked) {
    if (planned.includes(r)) continue;
    const group = closure(r);
    if (group === null) {
      out.push({ item: r, reason: { code: 'cycle' }, why: 'circular dependency' });
      continue;
    }
    const extra = group.filter((x) => x !== r).map((x) => x.id);
    const need = group.reduce((s, x) => s + x.points, 0);
    const free = capacity - used;
    const why = `no capacity left (${free} pts free, needs ${need}` + (extra.length ? ` with ${extra.join(', ')})` : ')');
    out.push({ item: r, reason: { code: 'capacity', free, need, extra }, why });
  }
  return { ranked, planned, used, out };
}

/** Everything the UI needs in one call. */
export function compute(items, capacity) {
  const cap = Number(capacity) || 0;
  const { rows, errors } = load(items);
  const { ranked, planned, used, out } = plan(rows, cap);
  const pids = new Set(planned.map((p) => p.id));
  const late = out.filter((o) => o.item.deadline === 'in-pi').map((o) => o.item.id);
  const rank = new Map(ranked.map((r, i) => [r.id, i + 1]));
  // Dependency flags per item: a committed item whose dependency is out, or a dependency ranked lower
  // (it is pulled in early by the item that needs it: say so).
  const flags = {};
  for (const r of ranked) {
    const f = [];
    for (const d of r.depends_on) {
      if (!rows.some((x) => x.id === d)) f.push({ code: 'unknown', dep: d });
      else if (!pids.has(d)) f.push({ code: 'dep-out', dep: d });
      else if (rank.get(d) > rank.get(r.id)) f.push({ code: 'pulled', dep: d });
    }
    const o = out.find((x) => x.item === r);
    if (o && o.reason.code === 'cycle') f.push({ code: 'cycle' });
    if (late.includes(r.id)) f.push({ code: 'deadline' });
    flags[r.id] = f;
  }
  // Cut line: index in the ranked list after which the first item that does not fit appears.
  const cut = ranked.findIndex((r) => !pids.has(r.id));
  return {
    ranked, planned: planned.map((p) => p.id), pids, used, capacity: cap, out,
    notPlanned: Object.fromEntries(out.map((o) => [o.item.id, o.why])),
    late, errors, flags, cut: cut === -1 ? ranked.length : cut,
    pct: cap > 0 ? Math.round((100 * used) / cap) : 0,
  };
}

/** Same shape as `wsjf.py --json`. */
export function toScriptJson(res) {
  return {
    ranked: res.ranked.map((r) => ({ id: r.id, title: r.title, cod: r.cod, job_size: r.job_size, wsjf: r.wsjf, points: r.points })),
    planned: res.planned, used: res.used, capacity: res.capacity,
    not_planned: res.notPlanned, deadline_missed: res.late,
  };
}

/** Python csv.writer QUOTE_MINIMAL. */
export function csvCell(v) {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const csvLine = (cells) => cells.map(csvCell).join(',');

/** wsjf.py jira_csv(): Summary, Issue Type, Description, Labels, Labels, Story Points (two Labels columns on purpose:
    Jira's importer maps each to the Labels field). Rows in WSJF order. */
export function jiraCsv(res, project = 'PROJ') {
  const lines = [csvLine(['Summary', 'Issue Type', 'Description', 'Labels', 'Labels', 'Story Points'])];
  for (const r of res.ranked) {
    let desc = `WSJF ${pyNum(r.wsjf)} (BV ${r.business_value} + TC ${r.time_criticality} + RR ${r.risk_reduction}) / size ${r.job_size}. Ref ${r.id}.`;
    if (r.depends_on.length) desc += ' Depends on: ' + r.depends_on.join(', ') + '.';
    lines.push(csvLine([r.title, r.type || 'Story', desc,
      res.pids.has(r.id) ? 'PI-committed' : 'PI-candidate', `${project || 'PROJ'}-WSJF`, r.points || '']));
  }
  return lines.join('\n') + '\n';
}

/** Input CSV in the script's format (so the user can run wsjf.py on it). */
export function featuresCsv(items) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const it of items) lines.push(csvLine(CSV_COLUMNS.map((c) => (c === 'depends_on' ? depsOf(it[c]).join(';') : it[c] ?? ''))));
  return lines.join('\n') + '\n';
}

/** Minimal CSV parser (quotes, commas, CRLF). */
export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', q = false;
  const s = String(text || '').replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (ch === '"') q = false;
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Features CSV (script columns, any order, header required) → items. Unknown columns are ignored. */
export function itemsFromCsv(text) {
  const [head, ...body] = parseCsv(text);
  if (!head) return [];
  const keys = head.map((h) => h.trim().toLowerCase().replace(/[\s/-]+/g, '_'));
  const alias = { bv: 'business_value', tc: 'time_criticality', rr: 'risk_reduction', rr_oe: 'risk_reduction', size: 'job_size', needs: 'depends_on', feature: 'title', summary: 'title' };
  return body.map((cells) => {
    const it = { id: '', title: '', type: '', business_value: 1, time_criticality: 1, risk_reduction: 1, job_size: 1, points: 0, depends_on: '', deadline: '' };
    keys.forEach((k, i) => { const key = alias[k] || k; if (key in it) it[key] = (cells[i] ?? '').trim(); });
    for (const c of SCORE_KEYS) it[c] = toInt(it[c]) || 1;
    it.points = toInt(it.points) || 0;
    return it;
  });
}

/** Capacity helper from the skill: sprints × velocity, minus run share and buffer (rounded down). */
export function capacityFrom({ sprints = 4, velocity = 40, runPct = 10, bufferPct = 15 } = {}) {
  const gross = sprints * velocity;
  return { gross, run: Math.round((gross * runPct) / 100), buffer: Math.round((gross * bufferPct) / 100),
    net: gross - Math.round((gross * runPct) / 100) - Math.round((gross * bufferPct) / 100) };
}
