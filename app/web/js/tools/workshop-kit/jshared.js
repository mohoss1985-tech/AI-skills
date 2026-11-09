/* Small helpers shared by builder J's three tools (workshop-kit, raci-grid, ai-risk-register). Pure, no DOM except h(). */

/** CSV (RFC 4180): quote when needed, CRLF line ends so Excel opens it cleanly. */
export const csvCell = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
};
export const csv = (rows) => rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';

/** Parse CSV text (comma or semicolon, quoted fields) into arrays. */
export function parseCsv(text) {
  const src = String(text || '').replace(/^﻿/, '');
  const first = src.split(/\r?\n/)[0] || '';
  const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = []; let cell = ''; let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c;
    } else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && src[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((x) => x.trim() !== ''));
}
/** CSV with a header row → objects keyed by lower-case header. */
export function csvObjects(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  return rows.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, (r[i] ?? '').trim()])));
}

/** Markdown table cell. */
export const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ').trim();
export const mdTable = (head, rows) => [
  `| ${head.map(mdCell).join(' | ')} |`,
  `|${head.map(() => '---').join('|')}|`,
  ...rows.map((r) => `| ${r.map((c) => mdCell(c) || '—').join(' | ')} |`),
].join('\n');

/** "{n} min" templating on a T() function. */
export const fmtT = (T) => (key, vars = {}) => T(key).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

export const fileBase = (s) => String(s || 'export').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'export';

export const pad2 = (n) => String(n).padStart(2, '0');
export const nextNum = (items, prefix) => {
  let m = 0;
  for (const x of items || []) { const k = String(x.id || '').match(new RegExp('^' + prefix + '-(\\d+)$')); if (k) m = Math.max(m, +k[1]); }
  return `${prefix}-${pad2(m + 1)}`;
};
export const uid = () => Math.random().toString(36).slice(2, 9);

/** Tiny DOM builder: h('div', {class: 'x', onclick}, 'text', node). Strings are text, never HTML. */
export function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
    else if (k === 'text') e.textContent = v;
    else if (k in e && typeof v !== 'string') e[k] = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return e;
}

/** Word export (DESIGN_SPEC §1: HTML saved as .doc), body rendered by core/exports clientHtml (light theme). */
export async function wordDoc(title, md) {
  const { clientHtml } = await import('../../core/exports.js');
  const { esc } = await import('../../core/dom.js');
  const body = await clientHtml(md);
  return '﻿' + `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1b1c20;line-height:1.45}h1{font-size:20pt;margin:0 0 4pt}h2{font-size:15pt;margin:16pt 0 6pt}h3{font-size:12.5pt;margin:14pt 0 4pt}
table{border-collapse:collapse;width:100%;margin:6pt 0 10pt}th,td{border:1px solid #d6d8de;padding:4pt 6pt;vertical-align:top;font-size:10pt}th{background:#f4f5f7;text-align:left}code{font-family:Consolas,monospace;font-size:9.5pt}</style></head>
<body>${body}</body></html>`;
}
