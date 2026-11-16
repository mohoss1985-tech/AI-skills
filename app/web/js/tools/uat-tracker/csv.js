/* Tiny CSV helpers shared by owner G's tools (UAT tracker, Xray builder, RAG eval). No DOM.
   parseCsv(text) auto-detects , ; or tab from the header line, handles "quoted, ""cells""" and CRLF.
   toCsv(rows, {eol}) quotes like Python's csv.writer (QUOTE_MINIMAL): only cells with the delimiter, a quote or a newline. */

export function detectDelim(text) {
  const first = String(text || '').split(/\r?\n/).find((l) => l.trim()) || '';
  const counts = [',', ';', '\t'].map((d) => [d, first.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ',';
}

export function parseRows(text, delim) {
  const s = String(text || '').replace(/^﻿/, '');
  const d = delim || detectDelim(s);
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) {
      if (c === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"' && cell === '') q = true;
    else if (c === d) { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim() !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim() !== '')) rows.push(row);
  return rows;
}

/** → [{header: value}] with headers trimmed (case kept). */
export function parseCsv(text, delim) {
  const rows = parseRows(text, delim);
  if (!rows.length) return { header: [], rows: [] };
  const header = rows[0].map((h) => h.trim());
  return { header, rows: rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()]))) };
}

/** Finds the first header matching one of the aliases (case and accent insensitive). */
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
export function pickCol(header, aliases) {
  const n = header.map(norm);
  for (const a of aliases) { const i = n.indexOf(norm(a)); if (i >= 0) return header[i]; }
  return null;
}

/** SFD builder rules CSV ("ID, Rule, Example, Source, Message, Stories, Test idea") → [{id, text, example, source, msg, stories}].
    This is the file the SFD builder's "Rules CSV" export writes; the UAT tracker and the Xray builder both import it.
    → {error: 'notSfd'} when the header does not look like it (needs ID + Rule and one of Example / Source / Message / Stories). */
export function sfdRulesFromCsv(text) {
  const { header, rows } = parseCsv(text);
  const id = pickCol(header, ['ID', 'Identifiant']), rule = pickCol(header, ['Rule', 'Règle', 'Regle']);
  const ex = pickCol(header, ['Example', 'Exemple']), src = pickCol(header, ['Source']), msg = pickCol(header, ['Message', 'Messages']);
  const st = pickCol(header, ['Stories', 'Story', 'Histoires', 'Histoire']);
  if (!id || !rule || !(ex || src || msg || st)) return { error: 'notSfd', rules: [] };
  const rules = rows.filter((r) => r[id] && r[rule]).map((r) => ({ id: r[id], text: r[rule], example: ex ? r[ex] : '', source: src ? r[src] : '', msg: msg ? r[msg] : '', stories: st ? r[st] : '' }));
  return { rules };
}

export function toCsv(rows, { delim = ',', eol = '\r\n' } = {}) {
  const q = (v) => {
    const s = v == null ? '' : String(v);
    return s.includes(delim) || s.includes('"') || s.includes('\n') || s.includes('\r') ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(q).join(delim)).join(eol) + eol;
}

export const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
export const fmtVars = (str, vars = {}) => String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));
