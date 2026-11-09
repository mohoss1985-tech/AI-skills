/* Small YAML reader for OpenAPI import (owner C). Covers what API specs use: block mappings and sequences,
   flow collections {..} [..] (also over several lines), quoted and plain scalars, block scalars | and > (with
   -/+ chomping), comments, documents with a leading ---. Not covered on purpose: anchors/aliases, tags, complex keys.
   parseYaml(text) → JS value; throws Error('yaml: line n: …'). */

const isNum = /^[-+]?(\d+(\.\d*)?|\.\d+)([eE][-+]?\d+)?$/;
function scalar(raw) {
  const s = raw.trim();
  if (s === '' || s === '~' || s === 'null' || s === 'Null' || s === 'NULL') return null;
  if (/^(true|True|TRUE)$/.test(s)) return true;
  if (/^(false|False|FALSE)$/.test(s)) return false;
  if (/^0x[0-9a-fA-F]+$/.test(s)) return parseInt(s, 16);
  if (isNum.test(s) && !/^[-+]?0\d/.test(s)) return Number(s);
  if (s.startsWith('"')) return JSON.parse(s.replace(/\\'/g, "'"));
  if (s.startsWith("'")) return s.slice(1, -1).replace(/''/g, "'");
  return s;
}
function stripComment(line) {
  let q = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === q) { if (q === "'" && line[i + 1] === "'") { i++; continue; } q = null; } else if (c === '\\' && q === '"') i++; continue; }
    if (c === '"' || c === "'") { if (i === 0 || /[\s:[{,-]/.test(line[i - 1])) q = c; continue; }
    if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i).replace(/\s+$/, '');
  }
  return line.replace(/\s+$/, '');
}
/* ---- flow collections */
function parseFlow(src, lineNo) {
  let i = 0;
  const err = (m) => { throw new Error(`yaml: line ${lineNo}: ${m}`); };
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };
  const quoted = () => {
    const q = src[i]; let j = i + 1;
    while (j < src.length) { if (src[j] === q) { if (q === "'" && src[j + 1] === "'") { j += 2; continue; } break; } if (q === '"' && src[j] === '\\') j++; j++; }
    const raw = src.slice(i, j + 1); i = j + 1; return scalar(raw);
  };
  const plain = (stops) => {
    let j = i;
    while (j < src.length && !stops.includes(src[j]) && !(src[j] === ':' && /[\s,}\]]/.test(src[j + 1] || ' '))) j++;
    const raw = src.slice(i, j); i = j; return scalar(raw);
  };
  const value = (stops) => {
    ws();
    if (src[i] === '{') return map();
    if (src[i] === '[') return seq();
    if (src[i] === '"' || src[i] === "'") return quoted();
    return plain(stops);
  };
  function map() {
    i++; const o = {};
    for (;;) {
      ws();
      if (src[i] === '}') { i++; return o; }
      const k = (src[i] === '"' || src[i] === "'") ? quoted() : plain([',', '}']);
      ws();
      let v = null;
      if (src[i] === ':') { i++; v = value([',', '}']); }
      o[String(k)] = v;
      ws();
      if (src[i] === ',') { i++; continue; }
      if (src[i] === '}') { i++; return o; }
      err('expected , or }');
    }
  }
  function seq() {
    i++; const a = [];
    for (;;) {
      ws();
      if (src[i] === ']') { i++; return a; }
      let v = value([',', ']']);
      ws();
      if (src[i] === ':' ) { i++; const val = value([',', ']']); v = { [String(v)]: val }; ws(); }
      a.push(v);
      if (src[i] === ',') { i++; continue; }
      if (src[i] === ']') { i++; return a; }
      err('expected , or ]');
    }
  }
  const out = value([]);
  ws();
  if (i < src.length) err('unexpected text after flow value');
  return out;
}
const balance = (s) => { let d = 0, q = null; for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === q) q = null; else if (c === '\\' && q === '"') i++; continue; } if (c === '"' || c === "'") { if (i === 0 || /[\s:[{,]/.test(s[i - 1])) q = c; } else if (c === '{' || c === '[') d++; else if (c === '}' || c === ']') d--; } return d; };

export function parseYaml(text) {
  const rawLines = String(text).replace(/\r\n?/g, '\n').replace(/^﻿/, '').split('\n');
  const lines = [];   // {indent, text, no, raw}
  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i];
    if (/^(---|\.\.\.)\s*$/.test(raw)) continue;
    const t = stripComment(raw);
    if (!t.trim()) { lines.push({ blank: true, raw, no: i + 1 }); continue; }
    lines.push({ indent: t.match(/^ */)[0].length, text: t.trim(), no: i + 1, raw });
  }
  let p = 0;
  const skipBlank = () => { while (p < lines.length && lines[p].blank) p++; };
  const err = (l, m) => { throw new Error(`yaml: line ${l ? l.no : '?'}: ${m}`); };

  function flowFrom(first, line) {
    let src = first;
    while (balance(src) > 0 && p < lines.length) { const l = lines[p++]; if (!l.blank) src += ' ' + l.text; }
    return parseFlow(src, line.no);
  }
  function blockScalar(header, parentIndent) {
    const fold = header[0] === '>';
    const chomp = header.includes('-') ? 'strip' : header.includes('+') ? 'keep' : 'clip';
    const body = [];
    let ind = null;
    while (p < lines.length) {
      const l = lines[p];
      const rawIndent = l.raw.match(/^ */)[0].length;
      if (!l.blank && rawIndent <= parentIndent) break;
      if (l.blank) { body.push(''); p++; continue; }
      if (ind === null) ind = rawIndent;
      body.push(l.raw.slice(ind));
      p++;
    }
    while (chomp !== 'keep' && body.length && body[body.length - 1] === '') body.pop();
    let s;
    if (fold) s = body.reduce((acc, ln, i) => (i === 0 ? ln : ln === '' ? acc + '\n' : (body[i - 1] === '' || /^\s/.test(ln) ? acc + ln : acc + ' ' + ln)), '');
    else s = body.join('\n');
    return chomp === 'strip' ? s : s + '\n';
  }
  function valueAfterColon(rest, line, indent) {
    const r = rest.trim();
    if (r === '') {
      skipBlank();
      if (p < lines.length && (lines[p].indent > indent || (lines[p].indent === indent && lines[p].text.startsWith('- ')) || (lines[p].indent === indent && lines[p].text === '-'))) return block(lines[p].indent);
      return null;
    }
    if (/^[|>][-+]?\d*$/.test(r)) return blockScalar(r, indent);
    if (r[0] === '{' || r[0] === '[') return flowFrom(r, line);
    if ((r[0] === '"' || r[0] === "'") ) {
      let src = r;
      const q = r[0];
      const closed = (s) => { let j = 1; while (j < s.length) { if (s[j] === q) { if (q === "'" && s[j + 1] === "'") { j += 2; continue; } return j === s.length - 1; } if (q === '"' && s[j] === '\\') j++; j++; } return false; };
      while (!closed(src) && p < lines.length) { const l = lines[p++]; src += ' ' + (l.blank ? '' : l.text); }
      return scalar(src);
    }
    // plain multi-line scalar continuation
    let s = r;
    while (p < lines.length && !lines[p].blank && lines[p].indent > indent && !/^-\s|^[^\s:]+:(\s|$)/.test(lines[p].text)) s += ' ' + lines[p++].text;
    return scalar(s);
  }
  const keyRx = /^("(?:[^"\\]|\\.)*"|'(?:[^']|'')*'|[^\s'"{[\]#][^:]*?|[^:]+?)\s*:(?:\s+(.*)|$)/;
  function mapping(indent, firstText, firstLine) {
    const o = {};
    let text = firstText, line = firstLine;
    for (;;) {
      const m = text.match(keyRx);
      if (!m) err(line, 'expected "key: value"');
      const key = String(scalar(m[1]));
      o[key] = valueAfterColon(m[2] || '', line, indent);
      skipBlank();
      if (p >= lines.length || lines[p].indent !== indent || lines[p].text.startsWith('- ') || lines[p].text === '-') break;
      line = lines[p++]; text = line.text;
    }
    return o;
  }
  function sequence(indent) {
    const a = [];
    for (;;) {
      skipBlank();
      if (p >= lines.length || lines[p].indent !== indent || !(lines[p].text.startsWith('- ') || lines[p].text === '-')) break;
      const line = lines[p++];
      const rest = line.text === '-' ? '' : line.text.slice(2).trim();
      const childIndent = indent + 2 + (line.text.slice(2).match(/^ */) || [''])[0].length;
      if (rest === '') { skipBlank(); a.push(p < lines.length && lines[p].indent > indent ? block(lines[p].indent) : null); continue; }
      if (rest[0] === '{' || rest[0] === '[') { a.push(flowFrom(rest, line)); continue; }
      if (/^[|>][-+]?\d*$/.test(rest)) { a.push(blockScalar(rest, indent)); continue; }
      if (keyRx.test(rest) && !/^["']/.test(rest) || /^["'][^"']*["']\s*:/.test(rest)) { a.push(mapping(childIndent, rest, line)); continue; }
      a.push(valueAfterColon(rest, line, indent));
    }
    return a;
  }
  function block(indent) {
    skipBlank();
    if (p >= lines.length) return null;
    const l = lines[p];
    if (l.text.startsWith('- ') || l.text === '-') return sequence(l.indent);
    if (l.text[0] === '{' || l.text[0] === '[') { p++; return flowFrom(l.text, l); }
    if (keyRx.test(l.text)) { p++; return mapping(l.indent, l.text, l); }
    p++;
    return valueAfterColon(l.text, l, indent - 1);
  }
  const out = block(0);
  skipBlank();
  if (p < lines.length) err(lines[p], 'unexpected indentation');
  return out;
}
