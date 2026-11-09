/* Mapping grid logic (skill mapping-data). Pure, node-testable: `node logic.test.mjs`.
   - checkMapping(rows, opts): line-for-line port of skills/mapping-data/scripts/check_mapping.py (same issues, same order,
     same summary, same SQL byte for byte; parity test runs the Python script).
   - extraChecks(state): what the grid adds (unknown fields, type / length mismatch, translation tables, to confirm).
   - preview(state, record): evaluates the transformations on one sample record → the output record.
   Inputs (state):
     sources  text "table.field, type, example" per line
     targets  text "field, type, mandatory Y/N, allowed a|b, to-confirm note" per line
     rules    text "id, dimension, rule, threshold, on failure, owner" per line (DQ rules; empty = no rule check)
     translations text "table, source code, target code, label" per line (T-01, LOST, 0, Lost)
     map      [{source: 'table.field' | '', target: 'field' | '', transformation, default, rule}]
     targetTable, key, dialect */
import { parseList, toCsv, luhn } from './csv.js';

export const DIALECTS = ['postgres', 'oracle', 'sqlserver'];
const LEN = { postgres: 'LENGTH', oracle: 'LENGTH', sqlserver: 'LEN' };
const YES = ['Y', 'YES', 'O', 'OUI', 'TRUE', '1'];

/* ------------------------------------------------------------------------------------------- inputs */
export function parseSources(text) {
  return parseList(text, ['field', 'source', 'source_field', 'champ', 'table.field']).map((r) => {
    const full = r[0] || '';
    const dot = full.lastIndexOf('.');
    return { id: full, table: dot > 0 ? full.slice(0, dot) : '', field: dot > 0 ? full.slice(dot + 1) : full, type: r[1] || '', example: r.slice(2).join(', ') };
  }).filter((s) => s.field);
}
export function parseTargets(text) {
  return parseList(text, ['field', 'target', 'target_field', 'champ']).map((r) => ({
    field: r[0] || '', type: r[1] || '', mandatory: YES.includes((r[2] || '').toUpperCase()),
    allowed: (r[3] || '').split('|').map((x) => x.trim()).filter(Boolean), confirm: r.slice(4).join(', '),
  })).filter((t) => t.field);
}
export function parseRules(text) {
  return parseList(text, ['id']).map((r) => ({ id: r[0] || '', dimension: r[1] || '', rule: r[2] || '', threshold: r[3] || '', onFailure: r[4] || '', owner: r[5] || '' })).filter((r) => r.id);
}
export function parseTranslations(text) {
  const out = {};
  for (const r of parseList(text, ['table'])) {
    if (!r[0] || r[1] == null) continue;
    (out[r[0].toUpperCase()] ||= []).push({ from: r[1], to: r[2] ?? '', label: r.slice(3).join(', ') });
  }
  return out;
}
export function model(state) {
  return {
    sources: parseSources(state.sources), targets: parseTargets(state.targets), rules: parseRules(state.rules),
    tr: parseTranslations(state.translations), table: state.targetTable || 'target', map: state.map || [],
  };
}
const trRef = (s) => { const m = /\bT-\d+\b/i.exec(s || ''); return m ? m[0].toUpperCase() : null; };

/** The mapping in check_mapping.py's CSV shape: one row per mapped target + one empty row per target left out. */
export function checkRows(state) {
  const m = model(state);
  const tdef = Object.fromEntries(m.targets.map((t) => [t.field, t]));
  const sdef = Object.fromEntries(m.sources.map((s) => [s.id, s]));
  const rows = [];
  for (const r of m.map) {
    if (!r.target) continue;
    const t = tdef[r.target] || { type: '', mandatory: false, allowed: [] };
    const s = sdef[r.source] || (r.source ? { table: r.source.includes('.') ? r.source.slice(0, r.source.lastIndexOf('.')) : '', field: r.source.slice(r.source.lastIndexOf('.') + 1) } : { table: '', field: '' });
    rows.push({ target_table: m.table, target_field: r.target, type: t.type, mandatory: t.mandatory ? 'Y' : 'N',
      source_table: s.table, source_field: s.field, transformation: (r.transformation || '').trim(), default: (r.default || '').trim(),
      rule: (r.rule || '').trim(), allowed: t.allowed.join('|') });
  }
  const used = new Set(rows.map((r) => r.target_field));
  for (const t of m.targets) {
    if (used.has(t.field)) continue;
    rows.push({ target_table: m.table, target_field: t.field, type: t.type, mandatory: t.mandatory ? 'Y' : 'N', source_table: '', source_field: '', transformation: '', default: '', rule: '', allowed: t.allowed.join('|') });
  }
  return rows;
}
export const CSV_HEAD = ['target_table', 'target_field', 'type', 'mandatory', 'source_table', 'source_field', 'transformation', 'default', 'rule', 'allowed'];
export const mappingCsv = (state) => toCsv([CSV_HEAD, ...checkRows(state).map((r) => CSV_HEAD.map((k) => r[k]))]);

/* ------------------------------------------------------------------------------------------- check_mapping.py port */
export const EN_MSG = {
  dup: '{name}: mapped {n} times',
  noType: '{name}: no type',
  mandNoSrc: '{name}: mandatory but no source, transformation or default',
  notMapped: '{name}: not mapped (will stay empty)',
  mandNoDefault: '{name}: mandatory, no default: records with an empty {src} will be rejected',
  unknownRule: '{name}: rule {rid} is not in {rules}',
  allowedNoTr: '{name}: has allowed values but no translation: check every source code is valid',
  summary: '{n} fields in {t} table(s): {e} error(s), {w} warning(s).',
};
export const fill = (tpl, v = {}) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";

/** rows: objects with check_mapping.py's columns. opts: {key, dialect, ruleIds: Set|null, rulesName, file}.
    → {errors: [issue], warnings: [issue], summary, sql, exit}; issue = {code, field, vars} (EN text: fill(EN_MSG[code], vars)). */
export function checkMapping(rowsIn, { key = '', dialect = 'postgres', ruleIds = null, rulesName = 'rules.csv', file = 'mapping.csv' } = {}) {
  const length = LEN[dialect] || 'LENGTH';
  const rows = rowsIn.map((r) => {
    const o = {};
    for (const [k, v] of Object.entries(r)) if (k) o[k.trim().toLowerCase()] = String(v ?? '').trim();
    for (const k of ['target_table', 'target_field']) o[k] ??= '';
    return o;
  });
  const errors = [], warnings = [];
  const iss = (list, code, r, vars = {}) => list.push({ code, field: r ? r.target_field : '', vars: { name: r ? `${r.target_table}.${r.target_field}` : '', ...vars } });
  const seen = new Map();
  for (const r of rows) { const k = r.target_table + '\u0000' + r.target_field; seen.set(k, { r, n: (seen.get(k)?.n || 0) + 1 }); }
  for (const { r, n } of seen.values()) if (n > 1) iss(errors, 'dup', r, { n });
  for (const r of rows) {
    const mand = YES.includes((r.mandatory || '').toUpperCase());
    r._mand = mand;
    const hasSrc = !!r.source_field || !!r.transformation;
    if (!r.type) iss(errors, 'noType', r);
    if (mand && !hasSrc && !r.default) iss(errors, 'mandNoSrc', r);
    else if (!hasSrc && !r.default) iss(warnings, 'notMapped', r);
    else if (mand && hasSrc && !r.default && !(r.transformation || '').toUpperCase().includes('COALESCE')) iss(warnings, 'mandNoDefault', r, { src: r.source_field || 'source' });
    if (ruleIds && r.rule) for (const rid of r.rule.split(/[;, ]+/)) if (rid && !ruleIds.has(rid)) iss(errors, 'unknownRule', r, { rid, rules: rulesName });
    if (r.allowed && !r.default && !r.transformation) iss(warnings, 'allowedNoTr', r);
  }
  const byTable = new Map();
  for (const r of rows) { if (!byTable.has(r.target_table)) byTable.set(r.target_table, []); byTable.get(r.target_table).push(r); }
  const summary = { n: rows.length, t: byTable.size, e: errors.length, w: warnings.length };

  const out = [`-- Generated by check_mapping.py from ${file} (${dialect}). Review before running.`,
    "-- Each query returns one row per check; a non-zero 'failing' value needs a look.\n"];
  for (const [t, fields] of byTable) {
    const cnt = new Map();
    for (const r of fields) if (r.source_table) cnt.set(r.source_table, (cnt.get(r.source_table) || 0) + 1);
    let src = null, best = 0;
    for (const [k, n] of cnt) if (n > best) { src = k; best = n; }
    const keyRow = fields.find((r) => r.target_field === key) || null;
    out.push(`-- ===== ${t} =====`);
    if (src) {
      out.push(`-- 1. Row counts: source ${src} vs target ${t} (the difference should match the rejection report)`);
      out.push(`SELECT (SELECT COUNT(*) FROM ${src}) AS source_rows, (SELECT COUNT(*) FROM ${t}) AS target_rows;\n`);
    }
    if (keyRow && src && keyRow.source_field) {
      const sk = keyRow.source_field;
      out.push(`-- 2. Key reconciliation on ${key} (source ${src}.${sk})`);
      if (keyRow.transformation) out.push(`--    The key is transformed (${keyRow.transformation}): apply the same transformation to s.${sk} below.`);
      out.push(`SELECT 'missing in target' AS check_name, COUNT(*) AS failing FROM ${src} s\n` +
        `  WHERE NOT EXISTS (SELECT 1 FROM ${t} t WHERE t.${key} = s.${sk})\n` +
        `UNION ALL\nSELECT 'not in source', COUNT(*) FROM ${t} t\n` +
        `  WHERE NOT EXISTS (SELECT 1 FROM ${src} s WHERE s.${sk} = t.${key})\n` +
        `UNION ALL\nSELECT 'duplicate key in target', COUNT(*) - COUNT(DISTINCT ${key}) FROM ${t};\n`);
    } else if (!keyRow) {
      out.push(`-- 2. Key reconciliation skipped: ${key} is not a target field of ${t}\n`);
    }
    const checks = [];
    for (const r of fields) {
      const f = r.target_field, rule = r.rule || '';
      if (r._mand) checks.push([`${f} mandatory`, `${f} IS NULL OR TRIM(CAST(${f} AS VARCHAR(4000))) = ''`, rule]);
      const m = /^(?:var)?char\((\d+)\)/.exec((r.type || '').toLowerCase());
      if (m) checks.push([`${f} longer than ${m[1]}`, `${length}(${f}) > ${m[1]}`, rule]);
      if (r.allowed) {
        const vals = r.allowed.split('|').map((v) => q(v.trim())).join(', ');
        checks.push([`${f} not in allowed values`, `${f} IS NOT NULL AND ${f} NOT IN (${vals})`, rule]);
      }
      if (f.toLowerCase().includes('email')) checks.push([`${f} invalid email`, `${f} IS NOT NULL AND ${f} NOT LIKE '%_@_%._%'`, rule]);
      if (f.toLowerCase().includes('iban')) checks.push([`${f} invalid IBAN shape`, `${f} IS NOT NULL AND (${length}(${f}) NOT BETWEEN 15 AND 34 OR ${f} <> UPPER(${f}) OR ${f} LIKE '% %')`, rule]);
    }
    if (checks.length) {
      out.push(`-- 3. Data quality checks on ${t}`);
      out.push('SELECT check_name, rule, failing FROM (\n' + checks.map(([n, cond, rule]) =>
        `  SELECT ${q(n)} AS check_name, ${q(rule)} AS rule, SUM(CASE WHEN ${cond} THEN 1 ELSE 0 END) AS failing FROM ${t}`).join('\nUNION ALL\n') + '\n) c ORDER BY failing DESC;\n');
    }
  }
  return { errors, warnings, summary, sql: out.join('\n') + '\n', exit: errors.length ? 1 : 0 };
}

/* ------------------------------------------------------------------------------------------- types */
export function typeInfo(type) {
  const t = String(type || '').toLowerCase().replace(/\s+/g, '');
  let m;
  if ((m = /^(?:var)?char\((\d+)\)|^varchar2\((\d+)\)|^(?:an|ans|n)\.{0,2}(\d+)$/.exec(t))) {
    const len = +(m[1] || m[2] || m[3]);
    return { kind: t.startsWith('n') && !t.startsWith('nv') ? 'digits' : 'str', len };
  }
  if (/^(text|string|varchar|clob)$/.test(t)) return { kind: 'str', len: null };
  if (/^(int|integer|bigint|smallint|long)$/.test(t) || /^number\(\d+(,0)?\)$/.test(t)) return { kind: 'int', len: null };
  if (/^(decimal|numeric|number|float|double|real)/.test(t)) return { kind: 'dec', len: null };
  if (/^date$/.test(t)) return { kind: 'date', len: null };
  if (/^(timestamp|datetime|timestamptz)/.test(t)) return { kind: 'ts', len: null };
  if (/^(bool|boolean)$/.test(t)) return { kind: 'bool', len: null };
  return { kind: t ? 'other' : '', len: null };
}
const isPassthrough = (tr, field) => {
  const x = String(tr || '').replace(/\(.*?(never|jamais).*?\)\s*$/i, '').trim().toUpperCase();
  if (!x) return true;
  const f = String(field || '').toUpperCase();
  return [`SRC.${f}`, f, `TRIM(SRC.${f})`, `UPPER(SRC.${f})`, `LOWER(SRC.${f})`, `UPPER(TRIM(SRC.${f}))`, `TRIM(UPPER(SRC.${f}))`].includes(x);
};
const compatible = (s, t) => {
  if (!s.kind || !t.kind || s.kind === 'other' || t.kind === 'other') return true;
  if (s.kind === t.kind) return true;
  const ok = { digits: ['str', 'int'], int: ['dec', 'str'], date: ['ts', 'str'], ts: ['str'], bool: ['str'], dec: ['str'], str: [] };
  return (ok[s.kind] || []).includes(t.kind);
};

/** Checks the grid adds on top of check_mapping.py. → [{level: 'error'|'warning'|'info', code, field, vars}] */
export function extraChecks(state) {
  const m = model(state);
  const tdef = Object.fromEntries(m.targets.map((t) => [t.field, t]));
  const sdef = Object.fromEntries(m.sources.map((s) => [s.id, s]));
  const out = [];
  const add = (level, code, field, vars = {}) => out.push({ level, code, field, vars: { name: `${m.table}.${field}`, ...vars } });
  m.map.forEach((r, i) => {
    if (r.target && !tdef[r.target]) add('error', 'unknownTarget', r.target, { row: i + 1, tgt: r.target });
    if (r.source && !sdef[r.source]) add('error', 'unknownSource', r.target || r.source, { src: r.source });
    const t = tdef[r.target], s = sdef[r.source];
    if (t && s) {
      const ti = typeInfo(t.type), si = typeInfo(s.type);
      const pass = isPassthrough(r.transformation, s.field);
      if (pass && !compatible(si, ti)) add('warning', 'typeMismatch', r.target, { st: s.type, tt: t.type });
      const cut = /\b(SUBSTR|SUBSTRING|LEFT|MASK)\s*\(/i.test(r.transformation || '') || trRef(r.transformation);
      if (si.len && ti.len && ['str', 'digits'].includes(ti.kind) && si.len > ti.len && !cut) add('warning', 'lengthMismatch', r.target, { a: si.len, b: ti.len });
    }
    const tr = trRef(r.transformation);
    if (r.target && tr) {
      if (!m.tr[tr]) add('warning', 'trMissing', r.target, { tr });
      else if (t && t.allowed.length) for (const row of m.tr[tr]) if (row.to && !t.allowed.includes(row.to)) add('error', 'trNotAllowed', r.target, { tr, v: row.to });
    }
  });
  const usedSrc = new Set(m.map.filter((r) => r.target).map((r) => r.source));
  for (const s of m.sources) if (!usedSrc.has(s.id)) out.push({ level: 'info', code: 'sourceUnused', field: '', vars: { src: s.id } });
  for (const t of m.targets) if (t.confirm) add('info', 'toConfirm', t.field, { note: t.confirm });
  return out;
}

/** Everything the screen shows. */
export function analyse(state) {
  const m = model(state);
  const rows = checkRows(state);
  const res = checkMapping(rows, { key: state.key || '', dialect: state.dialect || 'postgres', ruleIds: m.rules.length ? new Set(m.rules.map((r) => r.id)) : null, rulesName: 'Rules', file: `${m.table}-mapping.csv` });
  const extra = extraChecks(state);
  const issues = [...res.errors.map((x) => ({ level: 'error', ...x })), ...extra.filter((x) => x.level === 'error'),
    ...res.warnings.map((x) => ({ level: 'warning', ...x })), ...extra.filter((x) => x.level === 'warning'), ...extra.filter((x) => x.level === 'info')];
  const count = (l) => issues.filter((x) => x.level === l).length;
  // target coverage
  const byTarget = {};
  for (const r of m.map) if (r.target) (byTarget[r.target] ||= []).push(r);
  const coverage = m.targets.map((t) => {
    const rs = byTarget[t.field] || [];
    const has = rs.some((r) => r.source || (r.transformation || '').trim() || (r.default || '').trim());
    const status = rs.length > 1 ? 'dup' : has ? 'mapped' : t.mandatory ? 'missing' : 'empty';
    return { ...t, status, sources: rs.map((r) => r.source).filter(Boolean) };
  });
  return { model: m, rows, ...res, issues, coverage, counts: { error: count('error'), warning: count('warning'), info: count('info') } };
}

/* ------------------------------------------------------------------------------------------- preview evaluator */
function tokenize(s) {
  const toks = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/\s/.test(c)) { i++; continue; }
    if (c === "'") {
      let j = i + 1, v = '';
      while (j < s.length) { if (s[j] === "'" && s[j + 1] === "'") { v += "'"; j += 2; continue; } if (s[j] === "'") break; v += s[j++]; }
      if (j >= s.length) throw new Error('quote');
      toks.push({ t: 'str', v }); i = j + 1; continue;
    }
    if (/\d/.test(c)) { const m = /^\d+(\.\d+)?/.exec(s.slice(i)); toks.push({ t: 'num', v: +m[0] }); i += m[0].length; continue; }
    if (/[A-Za-z_]/.test(c)) { const m = /^[A-Za-z_][\w]*(\.[A-Za-z_][\w]*)*/.exec(s.slice(i)); toks.push({ t: 'id', v: m[0] }); i += m[0].length; continue; }
    if (s.startsWith('||', i)) { toks.push({ t: 'op', v: '||' }); i += 2; continue; }
    if ('()+-*/,'.includes(c)) { toks.push({ t: 'op', v: c, at: i }); i++; continue; }
    toks.push({ t: 'bad', v: c, at: i }); i++;
  }
  return toks;
}
const FN = {
  TRIM: (x) => (x == null ? x : String(x).trim()),
  LTRIM: (x) => (x == null ? x : String(x).replace(/^\s+/, '')),
  RTRIM: (x) => (x == null ? x : String(x).replace(/\s+$/, '')),
  UPPER: (x) => (x == null ? x : String(x).toUpperCase()),
  LOWER: (x) => (x == null ? x : String(x).toLowerCase()),
  ROUND: (x, n = 0) => (x == null || x === '' ? null : String(+(Math.round(+x * 10 ** n) / 10 ** n).toFixed(n))),
  ABS: (x) => (x == null || x === '' ? null : String(Math.abs(+x))),
  COALESCE: (...a) => a.find((x) => x != null && x !== '') ?? null,
  NULLIF: (a, b) => (String(a) === String(b) ? null : a),
  CONCAT: (...a) => a.map((x) => x ?? '').join(''),
  SUBSTR: (x, s = 1, n) => (x == null ? x : String(x).substr(+s - 1, n == null ? undefined : +n)),
  LEFT: (x, n) => (x == null ? x : String(x).slice(0, +n)),
  RIGHT: (x, n) => (x == null ? x : String(x).slice(-n)),
  LPAD: (x, n, c = ' ') => (x == null ? x : String(x).padStart(+n, c)),
  RPAD: (x, n, c = ' ') => (x == null ? x : String(x).padEnd(+n, c)),
  MASK: (x) => { if (x == null) return x; const d = String(x).replace(/\D/g, ''); return d.length < 12 ? '*'.repeat(d.length) : d.slice(0, 6) + '*'.repeat(d.length - 10) + d.slice(-4); },
};
FN.SUBSTRING = FN.SUBSTR;
function castTo(v, type) {
  if (v == null || v === '') return null;
  const k = typeInfo(type).kind;
  if (k === 'date') { const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(v)); if (!m) throw new Error('date'); return m[1]; }
  if (k === 'int') { if (isNaN(+v)) throw new Error('int'); return String(Math.trunc(+v)); }
  if (k === 'dec') { if (isNaN(+v)) throw new Error('dec'); return String(+v); }
  return String(v);
}
/** Evaluate one transformation. → {value} or throws (not evaluable). `get(name)` reads the record. */
export function evalExpr(expr, get) {
  const toks = tokenize(expr);
  let p = 0;
  const peek = () => toks[p], next = () => toks[p++];
  const isOp = (v) => peek() && peek().t === 'op' && peek().v === v;
  const expect = (v) => { if (!isOp(v)) throw new Error('expected ' + v); p++; };
  function primary() {
    const k = next();
    if (!k) throw new Error('end');
    if (k.t === 'num' || k.t === 'str') return k.t === 'num' ? String(k.v) : k.v;
    if (k.t === 'op' && k.v === '(') { const v = add(); expect(')'); return v; }
    if (k.t === 'op' && k.v === '-') { const v = primary(); return v == null ? v : String(-v); }
    if (k.t !== 'id') throw new Error('token');
    const name = k.v.toUpperCase();
    if (isOp('(') && !k.v.includes('.')) {
      p++;
      if (name === 'CAST') {
        const v = add();
        const as = next(); if (!as || as.t !== 'id' || as.v.toUpperCase() !== 'AS') throw new Error('AS');
        let type = next().v; if (isOp('(')) { type += '('; p++; while (peek() && !isOp(')')) type += next().v; expect(')'); type += ')'; }
        expect(')');
        return castTo(v, type);
      }
      const fn = FN[name];
      if (!fn) throw new Error('fn ' + name);
      const args = [];
      if (!isOp(')')) { args.push(add()); while (isOp(',')) { p++; args.push(add()); } }
      expect(')');
      return fn(...args);
    }
    if (name === 'NULL') return null;
    const field = k.v.replace(/^src\./i, '');
    return get(field);
  }
  function mul() {
    let v = primary();
    while (isOp('*') || isOp('/')) {
      const op = next().v, w = primary();
      if (v == null || w == null || v === '' || w === '') { v = null; continue; }
      if (isNaN(+v) || isNaN(+w)) throw new Error('nan');
      v = String(op === '*' ? +v * +w : +v / +w);
    }
    return v;
  }
  function add() {
    let v = mul();
    while (isOp('+') || isOp('-') || isOp('||')) {
      const op = next().v, w = mul();
      if (op === '||') { v = (v ?? '') + (w ?? ''); continue; }
      if (v == null || w == null) { v = null; continue; }
      v = String(op === '+' ? +v + +w : +v - +w);
    }
    return v;
  }
  const v = add();
  if (p < toks.length) {
    // a trailing comment in brackets is allowed: "src.card_token (never the PAN)"
    if (!(toks[p].t === 'op' && toks[p].v === '(')) throw new Error('trailing');
  }
  return v;
}

/** The sample record: source examples, overridden by state.record[sourceId]. */
export function sampleRecord(state) {
  const rec = {};
  for (const s of parseSources(state.sources)) rec[s.id] = (state.record && state.record[s.id] != null) ? state.record[s.id] : s.example;
  return rec;
}

/** → [{target, value, status: ok|default|empty|held|bad|manual|confirm, note: {code, vars}}] */
export function preview(state, record = sampleRecord(state)) {
  const m = model(state);
  const sdef = Object.fromEntries(m.sources.map((s) => [s.id, s]));
  const byField = {};
  for (const s of m.sources) { byField[s.field.toLowerCase()] = s.id; byField[s.id.toLowerCase()] = s.id; }
  const out = [];
  for (const t of m.targets) {
    const r = m.map.find((x) => x.target === t.field);
    const res = { target: t.field, type: t.type, mandatory: t.mandatory, confirm: t.confirm, source: r ? r.source : '', value: null, status: 'empty', note: null };
    out.push(res);
    if (!r) { res.status = t.mandatory ? 'held' : 'empty'; res.note = { code: t.mandatory ? 'pvUnmappedMand' : 'pvUnmapped' }; continue; }
    const srcVal = r.source ? record[r.source] : null;
    const get = (name) => { const id = byField[String(name).toLowerCase()] || (r.source && sdef[r.source] && sdef[r.source].field.toLowerCase() === String(name).toLowerCase() ? r.source : null); if (!id) throw new Error('unknown ' + name); const v = record[id]; return v === '' ? null : v; };
    const tr = trRef(r.transformation);
    let v;
    try {
      if (tr) {
        const table = m.tr[tr];
        if (!table) { res.status = 'manual'; res.value = srcVal; res.note = { code: 'pvTrMissing', vars: { tr } }; continue; }
        const hit = table.find((x) => String(x.from).toUpperCase() === String(srcVal ?? '').trim().toUpperCase());
        if (!hit) { v = null; if (srcVal) { res.status = 'held'; res.value = null; res.note = { code: 'pvTrNoCode', vars: { tr, v: srcVal } }; continue; } }
        else v = hit.to;
      } else if ((r.transformation || '').trim()) v = evalExpr(r.transformation, get);
      else v = srcVal === '' ? null : srcVal;
    } catch (e) {
      res.status = 'manual'; res.value = srcVal; res.note = { code: 'pvManual' }; continue;
    }
    if ((v == null || v === '') && (r.default || '').trim()) { v = r.default.trim(); res.status = 'default'; }
    res.value = v ?? null;
    if (v == null || v === '') { res.status = t.mandatory ? 'held' : 'empty'; res.note = t.mandatory ? { code: 'pvHeldEmpty' } : null; continue; }
    if (res.status !== 'default') res.status = 'ok';
    // type checks on the output value
    const ti = typeInfo(t.type), s = String(v);
    if (ti.len && s.length > ti.len) { res.status = 'bad'; res.note = { code: 'pvTooLong', vars: { n: s.length, max: ti.len } }; }
    else if (ti.kind === 'int' && !/^-?\d+$/.test(s)) { res.status = 'bad'; res.note = { code: 'pvNotInt' }; }
    else if (ti.kind === 'dec' && isNaN(+s)) { res.status = 'bad'; res.note = { code: 'pvNotNum' }; }
    else if (ti.kind === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(s)) { res.status = 'bad'; res.note = { code: 'pvNotDate' }; }
    else if (t.allowed.length && !t.allowed.includes(s)) { res.status = 'bad'; res.note = { code: 'pvNotAllowed', vars: { v: s } }; }
    if (/\b\d{13,19}\b/.test(s.replace(/[\s-]/g, '')) && luhn(s.replace(/[\s-]/g, '').match(/\d{13,19}/)[0])) { res.status = 'bad'; res.note = { code: 'pvClearPan' }; }
    if (res.status === 'ok' && t.confirm) { res.status = 'confirm'; res.note = { code: 'pvConfirm', vars: { note: t.confirm } }; }
  }
  return out;
}

/** Auto-map: pick a source for each unmapped target whose name matches (same normalised name, or one contains the other). */
export function autoMap(state) {
  const m = model(state);
  const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
  const map = (state.map || []).map((r) => ({ ...r }));
  const done = new Set(map.map((r) => r.target).filter(Boolean));
  const usedSrc = new Set(map.map((r) => r.source).filter(Boolean));
  for (const t of m.targets) {
    if (done.has(t.field)) continue;
    const nt = norm(t.field);
    const s = m.sources.find((x) => !usedSrc.has(x.id) && norm(x.field) === nt) || m.sources.find((x) => !usedSrc.has(x.id) && norm(x.field).length > 2 && (nt.includes(norm(x.field)) || norm(x.field).includes(nt)));
    if (!s) continue;
    map.push({ source: s.id, target: t.field, transformation: '', default: '', rule: '' });
    usedSrc.add(s.id); done.add(t.field);
  }
  return map;
}
/** Add one row per target that has no row yet (so a default can be set). */
export function addUnmappedRows(state) {
  const m = model(state);
  const map = (state.map || []).map((r) => ({ ...r }));
  const done = new Set(map.map((r) => r.target));
  for (const t of m.targets) if (!done.has(t.field)) map.push({ source: '', target: t.field, transformation: '', default: '', rule: '' });
  return map;
}
