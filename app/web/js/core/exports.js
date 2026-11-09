/* Exports of a deliverable: Word (HTML-as-.doc), rich copy. PDF is window.print() with print.css. */
import { esc } from './dom.js';
import { date, fileName } from './format.js';
import { L, tx } from './i18n.js';
import { bpmnSvg, initMermaid, renderMarkdown, svgTextToPng } from './markdown.js';
import { prepared } from './store.js';
import { toast } from '../ui/toast.js';

export async function svgToPng(svg) {
  const xml = new XMLSerializer().serializeToString(svg);
  const box = svg.viewBox.baseVal;
  const w = box && box.width ? box.width : 800, h = box && box.height ? box.height : 400;
  const img = new Image();
  await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml); });
  const c = document.createElement('canvas');
  c.width = w * 2; c.height = h * 2;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, 0, 0, c.width, c.height);
  return { src: c.toDataURL('image/png'), w: Math.min(w, 620) };
}
// The client copy always uses light colours, with diagrams turned into images.
export async function clientHtml(md) {
  const root = document.documentElement, prev = root.dataset.theme;
  root.dataset.theme = 'light'; initMermaid();
  const tmp = document.createElement('div');
  tmp.style.cssText = 'position:absolute;left:-9999px;top:0;width:820px';
  document.body.appendChild(tmp);
  await renderMarkdown(tmp, md);
  for (const box of tmp.querySelectorAll('.bpmn-box')) {
    try { const p = await svgTextToPng(await bpmnSvg(box._xml)); box.outerHTML = `<p><img src="${p.src}" width="${Math.round(p.w)}"></p>`; } catch {}
  }
  for (const box of tmp.querySelectorAll('.mermaid-box')) {
    const svg = box.querySelector('svg');
    if (!svg) continue;
    try { const p = await svgToPng(svg); box.outerHTML = `<p><img src="${p.src}" width="${Math.round(p.w)}"></p>`; } catch {}
  }
  tmp.querySelectorAll('.file-bar').forEach((b) => b.remove());
  const html = tmp.innerHTML;
  tmp.remove();
  if (prev) root.dataset.theme = prev; else delete root.dataset.theme;
  initMermaid();
  return html;
}
export async function downloadWord(r, t, version) {
  toast(L('Preparing the Word file…'));
  const body = await clientHtml(version || r.output);
  const by = prepared();
  const doc = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${esc(r.title)}</title>
    <style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt;color:#1b1c20;line-height:1.45}h1{font-size:20pt;margin:0 0 4pt}h2{font-size:15pt;margin:16pt 0 6pt}h3{font-size:12.5pt;margin:14pt 0 4pt}
    table{border-collapse:collapse;width:100%;margin:6pt 0 10pt}th,td{border:1px solid #d6d8de;padding:4pt 6pt;vertical-align:top;font-size:10pt}th{background:#f4f5f7;text-align:left}
    pre{background:#f4f5f7;border:1px solid #e5e6ea;padding:8pt;font-family:Consolas,monospace;font-size:9pt;white-space:pre-wrap}code{font-family:Consolas,monospace;font-size:9.5pt}.meta{color:#6b6f78;margin:0 0 2pt}</style></head>
    <body><p style="color:#6b6f78;text-transform:uppercase;letter-spacing:1px;font-size:9pt">${esc(tx(t, 'name'))}</p><h1>${esc(r.title)}</h1>
    <p class="meta">${r.client ? esc(r.client) + ' · ' : ''}${date(r.updated_at)}</p>${by ? `<p class="meta">${by}</p>` : ''}<hr>${body}</body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿', doc], { type: 'application/msword' }));
  a.download = fileName((r.client ? r.client + ' ' : '') + r.title) + '.doc';
  document.body.appendChild(a); a.click(); a.remove();
  toast(L('Word file downloaded'));
}
export async function copyRich(r, version) {
  const md = version || r.output;
  try {
    const html = await clientHtml(md);
    await navigator.clipboard.write([new ClipboardItem({
      'text/html': new Blob([`<h1>${esc(r.title)}</h1>${html}`], { type: 'text/html' }),
      'text/plain': new Blob([md], { type: 'text/plain' }),
    })]);
    toast(L('Copied. Paste it into an email, Word, Notion or Confluence'));
  } catch {
    try { await navigator.clipboard.writeText(md); toast(L('Copied as text')); } catch { toast(L("Couldn't copy")); }
  }
}
