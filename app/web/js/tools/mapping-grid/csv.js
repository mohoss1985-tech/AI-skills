/* Small CSV helpers shared by the three owner-I tools (mapping-grid, impact-heatmap, kb-audit). Pure, node-testable.
   parseRows(text): RFC 4180-ish (quotes, "" escapes; a separator inside brackets does not split: decimal(9,2)), comma / semicolon / tab separated (detected per text),
   blank lines and lines starting with # skipped. toCsv(rows): quotes when needed; a formula-injection guard
   prefixes ' to cells starting with = + - @ (except plain numbers and dates). */

export function sepOf(text) {
  const first = String(text || '').split(/\r?\n/).find((l) => l.trim() && !l.trim().startsWith('#')) || '';
  if (first.includes('\t')) return '\t';
  const c = (first.match(/,/g) || []).length, s = (first.match(/;/g) || []).length;
  return s > c ? ';' : ',';
}

export function parseRows(text, sep) {
  const src = String(text || '');
  sep = sep || sepOf(src);
  const rows = [];
  let row = [], cell = '', q = false, i = 0, depth = 0;
  const push = () => { row.push(cell.trim()); cell = ''; depth = 0; };
  const end = () => { push(); if (!(row.length === 1 && row[0] === '') && !row[0].startsWith('#')) rows.push(row); row = []; };
  while (i < src.length) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i += 2; continue; }
      if (ch === '"') { q = false; i++; continue; }
      cell += ch; i++; continue;
    }
    if (ch === '"' && cell.trim() === '') { q = true; cell = ''; i++; continue; }
    if (ch === '(') depth++;
    else if (ch === ')' && depth > 0) depth--;
    if (ch === sep && depth === 0) { push(); i++; continue; }
    if (ch === '\r') { i++; continue; }
    if (ch === '\n') { end(); i++; continue; }
    cell += ch; i++;
  }
  if (cell !== '' || row.length) end();
  return rows;
}

/** Parse with an optional header row: if the first row's first cell matches one of `headerWords`, drop it. */
export function parseList(text, headerWords = []) {
  const rows = parseRows(text);
  if (rows.length && headerWords.includes((rows[0][0] || '').toLowerCase())) rows.shift();
  return rows;
}

const safe = (v) => {
  const s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s) && !/^[-+]?\d+([.,]\d+)?$/.test(s)) return "'" + s;
  return s;
};
export const cell = (v) => {
  const s = safe(v);
  return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export const toCsv = (rows) => rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';

/** Markdown table cell. */
export const md = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
export const mdTable = (head, rows) => [`| ${head.map(md).join(' | ')} |`, `|${head.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.map((c) => (c === '' || c == null ? '—' : md(c))).join(' | ')} |`)].join('\n');

/** Luhn check (used to spot a clear PAN in an output record). */
export function luhn(digits) {
  const d = String(digits).replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0;
}

/** "{name}: x" templates. */
export const fill = (tpl, v = {}) => String(tpl).replace(/\{(\w+)\}/g, (_, k) => (v[k] ?? ''));
