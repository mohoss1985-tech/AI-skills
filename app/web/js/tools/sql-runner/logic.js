/* SQL runner · pure logic (no DOM, node-testable): statement picking, dialect translation, starter queries,
   result checks, chart detection, CSV/Markdown, sample-answer check. Owner D. */

// ---------------------------------------------------------------------------------------------- schema facts
/** Join keys of the sample database (used by the starter query and the AI prompt). */
export const JOINS = [
  ['authorisations', 'card_id', 'cards', 'card_id'],
  ['authorisations', 'merchant_id', 'merchants', 'merchant_id'],
  ['authorisations', 'response_code', 'response_codes', 'code'],
  ['merchants', 'mcc', 'mcc_codes', 'mcc'],
  ['fraud_reports', 'auth_id', 'authorisations', 'auth_id'],
  ['fraud_reports', 'card_id', 'cards', 'card_id'],
  ['disputes', 'auth_id', 'authorisations', 'auth_id'],
  ['disputes', 'fraud_report_id', 'fraud_reports', 'fraud_report_id'],
];
export const ALIAS = { authorisations: 'a', cards: 'c', merchants: 'm', mcc_codes: 'mc', response_codes: 'rc', fraud_reports: 'f', disputes: 'd' };
const aliasOf = (t) => ALIAS[t] || t.slice(0, 2);

export const DIALECTS = ['sqlite', 'postgres', 'oracle'];
export const DIALECT_LABEL = { sqlite: 'SQLite', postgres: 'PostgreSQL', oracle: 'Oracle' };

// ---------------------------------------------------------------------------------------------- lexing
/** Mask string literals, quoted identifiers and comments with spaces (same length), so regexes see code only. */
export function maskSql(sql) {
  let out = '';
  for (let i = 0; i < sql.length; ) {
    const c = sql[i], n = sql[i + 1];
    if (c === '-' && n === '-') { const j = sql.indexOf('\n', i); const e = j < 0 ? sql.length : j; out += ' '.repeat(e - i); i = e; continue; }
    if (c === '/' && n === '*') { const j = sql.indexOf('*/', i + 2); const e = j < 0 ? sql.length : j + 2; out += sql.slice(i, e).replace(/[^\n]/g, ' '); i = e; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < sql.length) { if (sql[j] === c) { if (sql[j + 1] === c) { j += 2; continue; } break; } j++; }
      out += c + ' '.repeat(Math.max(0, Math.min(j, sql.length) - i - 1)) + (j < sql.length ? c : '');
      i = j + 1; continue;
    }
    out += c; i++;
  }
  return out;
}

/** Split a script into statements (on ; outside strings/comments). Returns [{text, start, end}] without empty ones. */
export function splitStatements(sql) {
  const m = maskSql(sql);
  const out = [];
  let start = 0;
  for (let i = 0; i <= m.length; i++) {
    if (i === m.length || m[i] === ';') {
      const text = sql.slice(start, i);
      if (maskSql(text).trim()) out.push({ text: text.trim(), start, end: i });
      start = i + 1;
    }
  }
  return out;
}

/** The statement to run: the selection if any, else the statement under the cursor, else the only one. */
export function pickStatement(sql, selStart = 0, selEnd = 0) {
  if (selEnd > selStart) {
    const sel = sql.slice(selStart, selEnd);
    const parts = splitStatements(sel);
    return parts.length === 1 ? parts[0].text : sel.trim();
  }
  const parts = splitStatements(sql);
  if (parts.length <= 1) return parts[0] ? parts[0].text : '';
  const hit = parts.find((p) => selStart >= p.start && selStart <= p.end + 1);
  return (hit || parts[parts.length - 1]).text;
}

/** Leading verb of a statement, ignoring comments ('SELECT', 'WITH', 'DELETE'…). */
export const verbOf = (sql) => (maskSql(sql).trim().match(/^[A-Za-z]+/) || [''])[0].toUpperCase();
const WRITE_VERBS = ['INSERT', 'UPDATE', 'DELETE', 'REPLACE', 'UPSERT', 'MERGE', 'CREATE', 'DROP', 'ALTER', 'ATTACH', 'DETACH', 'VACUUM', 'REINDEX', 'ANALYZE', 'BEGIN', 'COMMIT', 'ROLLBACK', 'SAVEPOINT', 'RELEASE', 'TRUNCATE', 'GRANT', 'REVOKE'];
/** False only for statements that clearly write; anything else goes to the engine (which reports syntax errors). */
export const isReadOnly = (sql) => !WRITE_VERBS.includes(verbOf(sql));

// ---------------------------------------------------------------------------------------------- top-level parsing
const CLAUSES = ['SELECT', 'FROM', 'WHERE', 'GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'WINDOW'];

/** Positions of the final SELECT's clauses at paren depth 0: {SELECT: i, FROM: i, ...}. */
function clauseIndex(masked) {
  const idx = {};
  let depth = 0;
  const up = masked.toUpperCase();
  for (let i = 0; i < up.length; i++) {
    const ch = up[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (depth !== 0 || !/[A-Z]/.test(ch) || (i > 0 && /[A-Z0-9_]/.test(up[i - 1]))) continue;
    for (const k of CLAUSES) {
      const re = new RegExp('^' + k.replace(' ', '\\s+') + '(?![A-Z0-9_])');
      const mm = up.slice(i).match(re);
      if (mm) {
        if (k === 'SELECT') { for (const c of CLAUSES) delete idx[c]; } // a later top-level SELECT (after a CTE / UNION) wins
        idx[k] = { at: i, len: mm[0].length };
        break;
      }
    }
  }
  return idx;
}

/** Split by commas at depth 0. Works on masked text, returns slices of the original. */
function splitTop(orig, masked) {
  const parts = [];
  let depth = 0, start = 0;
  for (let i = 0; i <= masked.length; i++) {
    const ch = masked[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (i === masked.length || (ch === ',' && depth === 0)) { parts.push(orig.slice(start, i)); start = i + 1; }
  }
  return parts;
}

/** Select-list aliases of the final SELECT: {alias(lowercase): expression}. */
export function selectAliases(sql) {
  const m = maskSql(sql);
  const ix = clauseIndex(m);
  if (!ix.SELECT || !ix.FROM) return {};
  const a = ix.SELECT.at + ix.SELECT.len, b = ix.FROM.at;
  const out = {};
  for (const item of splitTop(sql.slice(a, b), m.slice(a, b))) {
    const mm = maskSql(item).match(/\s+AS\s+([A-Za-z_][A-Za-z0-9_]*)\s*$/i);
    if (mm) {
      const cut = maskSql(item).lastIndexOf(mm[0]);
      out[mm[1].toLowerCase()] = item.slice(0, cut).trim();
    }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- dialect translation
/** Find FN( … ) calls (case-insensitive) and replace them with fn(args[]) → string. Handles nesting. */
function replaceCalls(sql, name, fn) {
  let out = sql, guard = 0;
  for (;;) {
    const m = maskSql(out);
    const re = new RegExp('(?<![A-Za-z0-9_.])' + name + '\\s*\\(', 'i');
    const hit = m.match(re);
    if (!hit || guard++ > 200) return out;
    const open = hit.index + hit[0].length - 1;
    let depth = 0, close = -1;
    for (let i = open; i < m.length; i++) { if (m[i] === '(') depth++; else if (m[i] === ')' && --depth === 0) { close = i; break; } }
    if (close < 0) return out;
    const args = splitTop(out.slice(open + 1, close), m.slice(open + 1, close)).map((s) => s.trim());
    out = out.slice(0, hit.index) + fn(args) + out.slice(close + 1);
  }
}

/** SQLite → PostgreSQL / Oracle, rule-based. Returns {sql, notes: [i18n keys or text]}. Covers what the samples use
    (boolean SUM, julianday, strftime, substr, LIMIT, alias in WHERE / GROUP BY); everything else is listed as to check. */
export function translate(sql, dialect) {
  const notes = [];
  if (!dialect || dialect === 'sqlite') return { sql, notes };
  let s = sql;
  const pg = dialect === 'postgres';

  // SUM(a = 'x') → SUM(CASE WHEN a = 'x' THEN 1 ELSE 0 END): booleans are not numbers in PostgreSQL / Oracle
  s = replaceCalls(s, 'SUM', (args) => {
    const a = args[0] || '';
    const isCmp = /(<>|!=|<=|>=|=|<|>|\bIS\b|\bLIKE\b|\bIN\b)/i.test(maskSql(a)) && !/^\s*CASE\b/i.test(a);
    if (isCmp) { notes.push('boolean_sum'); return `SUM(CASE WHEN ${a} THEN 1 ELSE 0 END)`; }
    return `SUM(${args.join(', ')})`;
  });
  // julianday(x) → a day number
  s = replaceCalls(s, 'julianday', ([x]) => {
    notes.push('julianday');
    return pg ? `(EXTRACT(EPOCH FROM CAST(${x} AS timestamp)) / 86400.0)`
      : `(TO_DATE(SUBSTR(REPLACE(${x}, 'T', ' '), 1, 19), 'YYYY-MM-DD HH24:MI:SS') - DATE '1970-01-01')`;
  });
  // strftime(fmt, x) → TO_CHAR
  s = replaceCalls(s, 'strftime', ([fmt, x]) => {
    notes.push('strftime');
    const map = { '%Y': 'YYYY', '%m': 'MM', '%d': 'DD', '%H': 'HH24', '%M': 'MI', '%S': 'SS', '%W': 'IW' };
    const f = (fmt || "''").replace(/%[YmdHMSW]/g, (k) => map[k]).replace(/T/g, '"T"').replace(/Z/g, '"Z"');
    return pg ? `TO_CHAR(CAST(${x} AS timestamp), ${f})`
      : `TO_CHAR(TO_DATE(SUBSTR(REPLACE(${x}, 'T', ' '), 1, 19), 'YYYY-MM-DD HH24:MI:SS'), ${f})`;
  });
  if (!pg) s = replaceCalls(s, 'substr', (args) => `SUBSTR(${args.join(', ')})`);
  if (/\b(datetime|date|time|printf|ifnull|group_concat|iif)\s*\(/i.test(maskSql(s))) notes.push('functions');

  // alias used in WHERE: SQLite accepts it, PostgreSQL / Oracle do not → wrap the query in a subquery
  const aliases = selectAliases(s);
  let m = maskSql(s);
  let ix = clauseIndex(m);
  if (ix.WHERE) {
    const end = ['GROUP BY', 'HAVING', 'ORDER BY', 'LIMIT', 'WINDOW'].map((k) => ix[k]?.at).filter((x) => x > ix.WHERE.at);
    const wEnd = end.length ? Math.min(...end) : s.length;
    const cond = s.slice(ix.WHERE.at + ix.WHERE.len, wEnd);
    const used = Object.keys(aliases).filter((al) => new RegExp('(?<![A-Za-z0-9_.])' + al + '(?![A-Za-z0-9_(])', 'i').test(maskSql(cond)));
    const blocking = ['GROUP BY', 'HAVING', 'WINDOW'].some((k) => ix[k]?.at > ix.WHERE.at);
    if (used.length && !blocking) {
      const sel = s.slice(0, ix.SELECT.at);
      const body = s.slice(ix.SELECT.at, ix.WHERE.at).trimEnd();
      const tail = s.slice(wEnd).trim();
      s = `${sel}SELECT *\nFROM (\n${body.replace(/^/gm, '  ')}\n) q\nWHERE ${cond.trim()}${tail ? '\n' + tail : ''}`;
      notes.push('alias_where');
    }
  }
  // alias in GROUP BY: Oracle (before 23ai) wants the expression
  if (!pg) {
    m = maskSql(s); ix = clauseIndex(m);
    const al = selectAliases(s);
    if (ix['GROUP BY']) {
      const after = ['HAVING', 'ORDER BY', 'LIMIT', 'WINDOW'].map((k) => ix[k]?.at).filter((x) => x > ix['GROUP BY'].at);
      const a = ix['GROUP BY'].at + ix['GROUP BY'].len, b = after.length ? Math.min(...after) : s.length;
      const items = splitTop(s.slice(a, b), m.slice(a, b));
      let changed = false;
      const fixed = items.map((it) => { const k = it.trim().toLowerCase(); if (al[k]) { changed = true; return ' ' + al[k]; } return it; });
      if (changed) { s = s.slice(0, a) + fixed.join(',').replace(/\s+$/, '') + '\n' + s.slice(b); notes.push('alias_group'); }
    }
    // LIMIT n → FETCH FIRST n ROWS ONLY
    m = maskSql(s); ix = clauseIndex(m);
    if (ix.LIMIT) {
      const tail = s.slice(ix.LIMIT.at + ix.LIMIT.len);
      const n = tail.match(/^\s*(\d+)(\s+OFFSET\s+(\d+))?/i);
      if (n) {
        const rep = (n[3] ? `OFFSET ${n[3]} ROWS ` : '') + `FETCH FIRST ${n[1]} ROWS ONLY`;
        s = s.slice(0, ix.LIMIT.at) + rep + tail.slice(n[0].length);
        notes.push('limit');
      }
    }
    if (/\bAS\s+[a-z_]+\s+(JOIN|ON|WHERE)\b/i.test(maskSql(s))) notes.push('table_as');
  }
  notes.push('types');
  const head = `-- ${DIALECT_LABEL[dialect]} translation of a SQLite query (Analyst Kit, rule-based). Check before running.\n`;
  return { sql: head + s.replace(/^-- (PostgreSQL|Oracle) translation[^\n]*\n/, ''), notes: [...new Set(notes)] };
}

// ---------------------------------------------------------------------------------------------- starter query (no AI)
/** A runnable SELECT joining the picked tables on the known keys. */
export function starterQuery(tables, schema = []) {
  const picked = tables.filter(Boolean);
  if (!picked.length) return '';
  const cols = (t) => (schema.find((s) => s.name === t)?.columns || []).map((c) => c.name);
  const [first, ...rest] = picked;
  const joined = [first];
  const joins = [];
  for (const t of rest) {
    const j = JOINS.find(([a, , b]) => (a === t && joined.includes(b)) || (b === t && joined.includes(a)));
    if (j) {
      const [a, ac, b, bc] = j;
      joins.push(`JOIN ${t} ${aliasOf(t)} ON ${aliasOf(a)}.${ac} = ${aliasOf(b)}.${bc}`);
    } else joins.push(`CROSS JOIN ${t} ${aliasOf(t)}  -- no known key: add the join condition`);
    joined.push(t);
  }
  const list = picked.flatMap((t) => cols(t).slice(0, picked.length > 1 ? 4 : 8).map((c) => `${aliasOf(t)}.${c}`));
  return ['SELECT ' + (list.length ? list.join(',\n       ') : '*'), `FROM ${first} ${aliasOf(first)}`, ...joins, 'LIMIT 50'].join('\n');
}

/** Tables a query reads (names from the schema that appear after FROM / JOIN). */
export function tablesIn(sql, names) {
  const m = maskSql(sql);
  return names.filter((n) => new RegExp('\\b(FROM|JOIN)\\s+' + n + '\\b', 'i').test(m));
}

// ---------------------------------------------------------------------------------------------- results
export const isNum = (v) => typeof v === 'number' || (typeof v === 'bigint');

/** Column kinds from the values: 'num' if every non-null value is a number. */
export function columnKinds(columns, rows) {
  return columns.map((_, i) => {
    let seen = 0;
    for (const r of rows) { const v = r[i]; if (v == null) continue; if (!isNum(v)) return 'text'; seen++; }
    return seen ? 'num' : 'text';
  });
}

/** Mini chart spec: first text column as labels + the first numeric column, 2-40 rows. Null if not chartable. */
export function chartSpec(columns, rows) {
  if (!columns || columns.length < 2 || !rows || rows.length < 2 || rows.length > 40) return null;
  const kinds = columnKinds(columns, rows);
  const li = kinds.indexOf('text');
  const vi = kinds.findIndex((k, i) => k === 'num' && i !== li);
  if (li < 0 || vi < 0) return null;
  const bars = rows.map((r) => ({ label: String(r[li] ?? ''), value: Number(r[vi]) || 0 }));
  return { label: columns[li], value: columns[vi], bars, max: Math.max(...bars.map((b) => Math.abs(b.value)), 0) };
}

/** Analyst checks on a result (skill §5 validation): row count, NULLs per column, duplicate first column. */
export function checks(run) {
  if (!run || !run.ok) return [];
  const out = [{ id: 'rows', ok: run.total > 0, n: run.total }];
  const nulls = run.columns.map((c, i) => [c, run.rows.filter((r) => r[i] == null).length]).filter(([, n]) => n > 0);
  out.push({ id: 'nulls', ok: nulls.length === 0, cols: nulls.map(([c, n]) => `${c} (${n})`) });
  if (run.rows.length > 1) {
    const seen = new Map();
    for (const r of run.rows) seen.set(r[0], (seen.get(r[0]) || 0) + 1);
    const dup = [...seen.values()].filter((n) => n > 1).length;
    out.push({ id: 'grain', ok: dup === 0, col: run.columns[0], n: dup });
  }
  return out;
}

/** Does the run match a sample's stored answer? expect = {rows, first: {col: value}, contains: [[col, value]]}. */
export function matchesExpect(run, expect) {
  if (!expect || !run || !run.ok) return null;
  if (expect.rows != null && run.total !== expect.rows) return false;
  const get = (row, col) => row[run.columns.indexOf(col)];
  if (expect.first) {
    const r = run.rows[0];
    if (!r) return false;
    for (const [c, v] of Object.entries(expect.first)) if (String(get(r, c)) !== String(v)) return false;
  }
  for (const [c, v] of expect.contains || []) if (!run.rows.some((r) => String(get(r, c)) === String(v))) return false;
  return true;
}

// ---------------------------------------------------------------------------------------------- export formats
const csvCell = (v) => {
  if (v == null) return '';
  const raw = String(v);
  const inject = /^[=+\-@\t\r]/.test(raw) && !/^-?\d+([.,]\d+)?$/.test(raw);
  const s = inject ? "'" + raw : raw;
  return inject || /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
/** RFC 4180 CSV (CRLF), with a guard against spreadsheet formula injection. */
export const toCsv = (columns, rows) => [columns, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
export const toTsv = (columns, rows) => [columns, ...rows].map((r) => r.map((v) => (v == null ? '' : String(v).replace(/[\t\n]/g, ' '))).join('\t')).join('\n');

const mdCell = (v) => (v == null ? '' : String(v).replace(/\|/g, '\\|').replace(/\n/g, ' '));
export function mdTable(columns, rows, kinds = columnKinds(columns, rows)) {
  if (!columns.length) return '';
  const head = `| ${columns.map(mdCell).join(' | ')} |`;
  const sep = `|${kinds.map((k) => (k === 'num' ? ' ---: ' : ' --- ')).join('|')}|`;
  return [head, sep, ...rows.map((r) => `| ${r.map(mdCell).join(' | ')} |`)].join('\n');
}

/** Slug for file names: "Top decline codes" → "top-decline-codes". */
export const slug = (s, dflt = 'query') =>
  (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 48).replace(/^-+|-+$/g, '') || dflt;

/** Schema as compact DDL-ish text for prompts: "cards(card_id TEXT PK, …) · 20 rows". */
export function schemaText(schema, only = []) {
  const list = only.length ? schema.filter((t) => only.includes(t.name)) : schema;
  return list.map((t) => `${t.name}(${t.columns.map((c) => `${c.name} ${c.type}${c.pk ? ' PK' : ''}`).join(', ')}) -- ${t.rows} rows`).join('\n');
}

// ---------------------------------------------------------------------------------------------- question → SQL (offline templates)
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, ' ');
const MONTHS = { jan: '01', janv: '01', feb: '02', fev: '02', mar: '03', apr: '04', avr: '04', may: '05', mai: '05', jun: '06', juin: '06', jul: '07', juil: '07', aug: '08', aou: '08', sep: '09', oct: '10', nov: '11', dec: '12' };

/** Turn a plain-words question into SQL for the sample database, or null when no template fits (then Claude is needed). */
export function questionToSql(question) {
  const q = ' ' + norm(question) + ' ';
  const has = (re) => re.test(q);
  const dispute = has(/\b(dispute|disputes|litige|litiges|chargeback|chargebacks|impaye|impayes|contestation)/);
  const rate = has(/approval rate|acceptance rate|approval|taux d ?acceptation|taux d approbation|acceptation/);
  const declines = has(/declin|refus|rejet|denied|reject/);
  const amount = has(/\b(amount|value|volume|montant|total spend|euros?)\b/);
  const topM = q.match(/\b(?:top|les|premiers?)\s+(\d{1,2})\b/);
  const limit = topM ? Math.min(50, Math.max(1, +topM[1])) : 0;
  let month = null;
  const mm = q.match(/\b(jan|janv|january|janvier|feb|fev|february|fevrier|mar|march|mars|apr|avr|april|avril|may|mai|jun|juin|june|jul|juil|july|juillet|aug|aou|august|aout|sep|sept|september|septembre|oct|october|octobre|nov|november|novembre|dec|december|decembre)\b/);
  if (mm) month = MONTHS[mm[1]] || MONTHS[mm[1].slice(0, 4)] || MONTHS[mm[1].slice(0, 3)] || null;
  const year = (q.match(/\b(20\d\d)\b/) || [])[1] || '2026';

  if (dispute) {
    const by = has(/\b(condition|reason|motif|code)\b/) ? 'condition_code' : has(/\b(status|statut|state|etat)\b/) ? 'status' : null;
    const sel = by ? `d.${by} AS ${by},\n       ` : '';
    const sql = `-- ${String(question).replace(/\s+/g, ' ').trim()}\nSELECT ${sel}COUNT(*) AS disputes,\n       ROUND(SUM(d.amount_minor) / 100.0, 2) AS amount_eur\nFROM disputes d\n${by ? `GROUP BY d.${by}\nORDER BY disputes DESC` : ''}`.trim();
    return { sql, notes: 'disputes' };
  }

  let dim = null, dimSel = '', dimJoin = '';
  if (has(/\b(channel|canal|canaux)\b/)) { dim = 'channel'; dimSel = 'a.channel AS channel'; }
  else if (has(/\b(mcc|categor\w*|sector|secteur)\b/)) { dim = 'merchant_category'; dimSel = 'mc.label_en AS merchant_category'; dimJoin = 'JOIN merchants m  ON m.merchant_id = a.merchant_id\nJOIN mcc_codes mc ON mc.mcc = m.mcc'; }
  else if (has(/\b(merchant|merchants|commercant|commercants)\b/)) { dim = 'merchant'; dimSel = 'm.name AS merchant'; dimJoin = 'JOIN merchants m ON m.merchant_id = a.merchant_id'; }
  else if (has(/\b(response code|response codes|decline code|decline codes|code|codes|reason|reasons|motif|motifs)\b/)) { dim = 'response'; dimSel = "a.response_code AS response_code,\n       rc.label_en AS meaning"; dimJoin = 'JOIN response_codes rc ON rc.code = a.response_code'; }
  else if (has(/\b(day|days|daily|jour|jours|quotidien|date)\b/)) { dim = 'day'; dimSel = 'substr(a.auth_ts, 1, 10) AS day'; }
  else if (has(/\b(scheme|schemes|reseau|reseaux|visa|cb)\b/) && has(/\b(by|per|par|each|chaque)\b/)) { dim = 'scheme'; dimSel = 'a.scheme AS scheme'; }
  else if (has(/\b(entry mode|mode de saisie|contactless|chip)\b/)) { dim = 'entry_mode'; dimSel = 'a.entry_mode AS entry_mode'; }
  if (!dim && !rate && !declines && !amount && !has(/\b(how many|count|number|combien|nombre)\b/)) return null;
  if (!has(/\b(authori[sz]ations?|autorisations?|transactions?|payments?|paiements?|cards?|cartes?|merchant|merchants|commercant|commercants|decline|declined|declines|refus|approval|acceptation)\b/) && !dim) return null;

  const where = [];
  if (declines && !rate) where.push("a.response_code <> '00'");
  if (has(/stand ?in|stip/)) where.push('a.stip = 1');
  if (has(/\bvisa\b/) && dim !== 'scheme') where.push("a.scheme = 'VISA'");
  else if (has(/\bcb\b/) && dim !== 'scheme') where.push("a.scheme = 'CB'");
  if (has(/\b(ecom|e commerce|online|en ligne)\b/) && dim !== 'channel') where.push("a.channel = 'ecom'");
  if (month) {
    const ny = month === '12' ? +year + 1 : +year, nm = month === '12' ? '01' : String(+month + 1).padStart(2, '0');
    where.push(`a.auth_ts >= '${year}-${month}-01' AND a.auth_ts < '${ny}-${nm}-01'`);
  }
  const measure = rate ? "ROUND(100.0 * SUM(CASE WHEN a.response_code = '00' THEN 1 ELSE 0 END) / COUNT(*), 1) AS approval_pct"
    : amount ? 'ROUND(SUM(a.amount_minor) / 100.0, 2) AS amount_eur'
      : declines ? 'COUNT(*) AS declined' : 'COUNT(*) AS auths';
  const mName = rate ? 'approval_pct' : amount ? 'amount_eur' : declines ? 'declined' : 'auths';
  const n = limit || (dim && dim !== 'day' && dim !== 'channel' && dim !== 'scheme' ? 10 : 0);
  const lines = [`-- ${String(question).replace(/\s+/g, ' ').trim()}`, `SELECT ${dimSel ? dimSel + ',\n       ' : ''}${measure}`, 'FROM authorisations a'];
  if (dimJoin) lines.push(dimJoin);
  if (where.length) lines.push('WHERE ' + where.join('\n  AND '));
  if (dim) {
    lines.push('GROUP BY ' + (dim === 'response' ? 'a.response_code, rc.label_en' : dim === 'day' ? 'substr(a.auth_ts, 1, 10)' : dim === 'merchant_category' ? 'mc.label_en' : dim === 'merchant' ? 'm.name' : 'a.' + dim));
    lines.push(dim === 'day' ? 'ORDER BY day' : `ORDER BY ${mName} DESC`);
  }
  if (n) lines.push('LIMIT ' + n);
  return { sql: lines.join('\n'), notes: 'authorisations' };
}
