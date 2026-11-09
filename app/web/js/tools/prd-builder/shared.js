/* Helpers shared by owner H's three tools (PRD, Story, SFD builders). No DOM state of its own. */
import { getLang } from '../../core/i18n.js';
import { clientHtml } from '../../core/exports.js';
import { esc } from '../../core/dom.js';

/** Translator with {var} filling. ui(k, vars) follows the interface language; doc(lang)(k, vars) a fixed language
    (the Markdown / exports follow the document's language, not the UI's). */
export function makeT(strings) {
  const fill = (s, v = {}) => String(s).replace(/\{(\w+)\}/g, (_, x) => (v[x] ?? ''));
  const get = (lang, k) => (strings[lang] && strings[lang][k]) ?? strings.en[k] ?? k;
  return {
    ui: (k, v) => fill(get(getLang(), k), v),
    doc: (lang) => (k, v) => fill(get(lang === 'fr' ? 'fr' : 'en', k), v),
  };
}

export function debounce(fn, ms = 120) {
  let id = 0;
  return (...a) => { clearTimeout(id); id = setTimeout(() => fn(...a), ms); };
}

export const fileBase = (s) => String(s || 'export').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'export';

/** Word export (V1 approach kept by DESIGN_SPEC §1: HTML saved as .doc), body rendered by A's core/exports clientHtml. */
export async function wordDoc(title, md, sub = '') {
  const body = await clientHtml(md);
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1b1c20;line-height:1.45}h1{font-size:20pt;margin:0 0 4pt}h2{font-size:15pt;margin:16pt 0 6pt}h3{font-size:12.5pt;margin:14pt 0 4pt}
table{border-collapse:collapse;width:100%;margin:6pt 0 10pt}th,td{border:1px solid #d6d8de;padding:4pt 6pt;vertical-align:top;font-size:10pt}th{background:#f4f5f7;text-align:left}
pre{background:#f4f5f7;border:1px solid #e5e6ea;padding:8pt;font-family:Consolas,monospace;font-size:9pt;white-space:pre-wrap}code{font-family:Consolas,monospace;font-size:9.5pt}.meta{color:#6b6f78;margin:0 0 2pt}</style></head>
<body>${sub ? `<p class="meta">${esc(sub)}</p>` : ''}${body}</body></html>`;
  return '﻿' + doc;
}

/** A section header row: title + optional count + right-side nodes. */
export function sectionHead(title, ...right) {
  const h = document.createElement('div');
  h.className = 'h-sec-head';
  const t = document.createElement('h2');
  t.textContent = title;
  h.append(t);
  if (right.length) { const r = document.createElement('div'); r.className = 'h-sec-tools'; r.append(...right.filter(Boolean)); h.append(r); }
  return h;
}

/** Wrap a field-producing input with a change hook that writes state[key]. */
export function bindInput(ctx, key, el, after) {
  const handler = () => { ctx.setState({ [key]: el.value }); if (after) after(el.value); };
  el.addEventListener('input', handler);
  return el;
}

/** Plain-text list item with a status icon (never colour-only). */
export function checkItem(ui, { ok, level, text, onClick }) {
  const li = document.createElement('li');
  li.className = 'h-check ' + (ok ? 'is-ok' : level === 'warn' ? 'is-warn' : 'is-bad');
  li.append(ui.icon(ok ? 'circle-check' : level === 'warn' ? 'triangle-alert' : 'circle-x', { size: 16 }));
  const span = document.createElement(onClick ? 'button' : 'span');
  if (onClick) { span.type = 'button'; span.className = 'h-check-link'; span.onclick = onClick; }
  span.textContent = text;
  li.append(span);
  return li;
}
