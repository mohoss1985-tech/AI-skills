/* Markdown and diagrams: marked + DOMPurify, Mermaid (strict) and BPMN (bpmn-js viewer), file bars on import files.
   V2: the libraries are vendored and loaded on first use through core/lazy.js (no CDN, nothing loaded up front
   except marked + DOMPurify, preloaded by main.js because the Guide renders markdown synchronously). */
import { download, esc, isDark } from './dom.js';
import { loadBpmnViewer, loadMarked, loadMermaid, loadPurify } from './lazy.js';
import { fileName } from './format.js';
import { L } from './i18n.js';
import { toast } from '../ui/toast.js';
import { iconSvg } from '../ui/icon.js';

/** Load marked + DOMPurify (call once at boot; renderMarkdown also awaits it). */
export const ensureMarkdown = () => Promise.all([loadMarked(), loadPurify()]);
/** Sanitised HTML of a markdown string, synchronously. Before the libraries are loaded: escaped text. */
export function mdHtml(md) {
  if (window.marked && window.DOMPurify) return DOMPurify.sanitize(marked.parse(md || '', { gfm: true }));
  return esc(md || '').replace(/\n/g, '<br>');
}
/** Re-read the theme colours into Mermaid (after a theme change). Lazy: applied when Mermaid is loaded. */
export function initMermaid() {
  if (window.mermaid) configureMermaid();
}
function configureMermaid() {
  const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  mermaid.initialize({
    startOnLoad: false, securityLevel: 'strict', theme: 'base', fontFamily: 'Inter, sans-serif',
    flowchart: { curve: 'basis', padding: 12 },
    themeVariables: {
      darkMode: isDark(), fontSize: '13px', background: v('--bg'),
      primaryColor: v('--surface'), primaryTextColor: v('--fg'), primaryBorderColor: v('--line-strong'),
      lineColor: v('--muted'), textColor: v('--fg-2'), clusterBkg: v('--hover'), clusterBorder: v('--line-strong'),
      edgeLabelBackground: v('--bg'), tertiaryColor: v('--surface'), secondaryColor: v('--active'),
    },
  });
}
let seq = 0;
const isBpmn = (code) => code.classList.contains('language-bpmn') || /<bpmn:definitions/.test(code.textContent);
const LEGEND = [['#e7f6ec', '#1f7a45', 'Start'], ['#e8f0fe', '#1d4ed8', 'Task'], ['#fff6e0', '#b54708', 'Decision'], ['#f1ebfb', '#6941c6', 'Wait / message'], ['#fdecec', '#b42318', 'End']];
// Fit the diagram, but never below a readable zoom: wide processes start at the left and can be dragged.
function readableFit(viewer, min = 0.72) {
  const c = viewer.get('canvas');
  c.zoom('fit-viewport', 'auto');
  if (c.zoom() >= min) return;
  const { inner, outer } = c.viewbox();
  c.viewbox({ x: inner.x - 16, y: inner.y + inner.height / 2 - outer.height / min / 2, width: outer.width / min, height: outer.height / min });
}
export async function mountBpmn(container, xml, min) {
  const BpmnJS = await loadBpmnViewer();
  const viewer = new BpmnJS({ container });
  await viewer.importXML(xml);
  readableFit(viewer, min);
  return viewer;
}
export async function bpmnSvg(xml) {
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-10000px;top:0;width:1400px;height:900px';
  document.body.appendChild(host);
  try { const v = await mountBpmn(host, xml, 0); const { svg } = await v.saveSVG(); v.destroy(); return svg; }
  finally { host.remove(); }
}
export async function svgTextToPng(svgText, maxW = 620) {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml').documentElement;
  const vb = (doc.getAttribute('viewBox') || '').split(/\s+/).map(Number);
  const w = vb[2] || parseFloat(doc.getAttribute('width')) || 1200, h = vb[3] || parseFloat(doc.getAttribute('height')) || 600;
  const img = new Image();
  await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgText); });
  const c = document.createElement('canvas'); c.width = w * 2; c.height = h * 2;
  const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
  return { src: c.toDataURL('image/png'), w: Math.min(w, maxW), canvas: c };
}
export function openFullscreen(xml, title) {
  const ov = document.createElement('div');
  ov.className = 'bpmn-full';
  ov.innerHTML = `<div class="bpmn-full-bar"><b>${esc(title || L('Process diagram'))}</b><span class="spacer"></span>
    <button class="btn" data-z="in">${L('Zoom in')}</button><button class="btn" data-z="out">${L('Zoom out')}</button><button class="btn" data-z="fit">${L('Fit')}</button>
    <button class="btn primary" data-close>${L('Close')} <kbd>Esc</kbd></button></div><div class="bpmn-full-canvas"></div>`;
  document.body.appendChild(ov);
  let viewer;
  mountBpmn(ov.querySelector('.bpmn-full-canvas'), xml, 0.5).then((v) => (viewer = v));
  const close = () => { viewer && viewer.destroy(); ov.remove(); removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  addEventListener('keydown', onKey);
  ov.querySelector('[data-close]').onclick = close;
  ov.querySelectorAll('[data-z]').forEach((b) => (b.onclick = () => zoom(viewer, b.dataset.z)));
}
function zoom(viewer, how) {
  if (!viewer) return;
  const c = viewer.get('canvas');
  if (how === 'fit') c.zoom('fit-viewport', 'auto');
  else if (how === 'read') readableFit(viewer);
  else c.zoom(c.zoom() * (how === 'in' ? 1.25 : 0.8));
}
export async function renderBpmnBox(box, xml) {
  box._xml = xml;
  const title = (document.querySelector('.paper-head h1') || {}).textContent || 'process';
  const base = fileName(title);
  box.innerHTML = `<div class="bpmn-tools">
      <button class="btn" data-a="full">${L('Open full screen')}</button>
      <button class="btn icon-only" data-a="in" title="${L('Zoom in')}" aria-label="${L('Zoom in')}">${iconSvg('zoom-in')}</button><button class="btn icon-only" data-a="out" title="${L('Zoom out')}" aria-label="${L('Zoom out')}">${iconSvg('zoom-out')}</button><button class="btn" data-a="fit">${L('Whole process')}</button>
      <span class="hint">${L('Drag to move · pinch or ⌘+scroll to zoom')}</span><span class="spacer"></span>
      <button class="btn" data-a="png">PNG</button><button class="btn" data-a="svg">SVG</button><button class="btn" data-a="bpmn" title="${L('Opens in Camunda, bpmn.io, Signavio…')}">${L('.bpmn file')}</button></div>
    <div class="bpmn-canvas"></div>
    <div class="bpmn-legend">${LEGEND.map(([f, s, l]) => `<span><i style="background:${f};border-color:${s}"></i>${L(l)}</span>`).join('')}
      <span class="spacer"></span><a href="https://demo.bpmn.io/new" target="_blank" rel="noopener">${L('Edit online at bpmn.io')}</a></div>`;
  let viewer;
  try { viewer = await mountBpmn(box.querySelector('.bpmn-canvas'), xml); }
  catch (e) { box.innerHTML = `<pre><code>${esc(xml)}</code></pre>`; return; }
  box.querySelectorAll('[data-a]').forEach((b) => (b.onclick = async () => {
    const a = b.dataset.a;
    if (a === 'full') return openFullscreen(xml, title);
    if (['in', 'out', 'fit'].includes(a)) return zoom(viewer, a);
    if (a === 'bpmn') return download(base + '.bpmn', new Blob([xml], { type: 'application/xml' }));
    const { svg } = await viewer.saveSVG();
    if (a === 'svg') return download(base + '.svg', new Blob([svg], { type: 'image/svg+xml' }));
    const p = await svgTextToPng(svg);
    p.canvas.toBlob((blob) => download(base + '.png', blob));
  }));
}
// Import files (CSV, .feature, JSON…) get Copy and Download, named after the file name written just above the block.
const FILE_EXT = { csv: 'csv', gherkin: 'feature', json: 'json', sql: 'sql', yaml: 'yaml', xml: 'xml', bash: 'sh', python: 'py' };
function addFileBar(code) {
  const lang = (code.className.match(/language-(\w+)/) || [])[1];
  if (!FILE_EXT[lang]) return;
  const pre = code.parentElement, prev = pre.previousElementSibling;
  const named = prev && (prev.textContent.match(/[\w.-]+\.(csv|feature|json|sql|ya?ml|xml|sh|py)\b/) || [])[0];
  const name = named || (fileName((document.querySelector('.paper-head h1') || {}).textContent) + '.' + FILE_EXT[lang]);
  const bar = document.createElement('div');
  bar.className = 'file-bar no-print';
  bar.innerHTML = `<span>${esc(name)}</span><button class="btn" data-copy>${L('Copy')}</button>${lang === 'bash' ? '' : `<button class="btn" data-dl>${L('Download')}</button>`}`;
  bar.querySelector('[data-copy]').onclick = async () => { try { await navigator.clipboard.writeText(code.textContent); toast(L('Copied')); } catch { toast(L("Couldn't copy")); } };
  const dl = bar.querySelector('[data-dl]');
  if (dl) dl.onclick = () => download(name, new Blob([code.textContent], { type: lang === 'json' ? 'application/json' : 'text/plain;charset=utf-8' }));
  pre.before(bar);
}
export async function renderMarkdown(el, md) {
  await ensureMarkdown();
  el.innerHTML = DOMPurify.sanitize(marked.parse(md || '', { gfm: true }));
  if (el.querySelector('pre > code.language-mermaid')) { await loadMermaid(); configureMermaid(); }
  await Promise.all([...el.querySelectorAll('pre > code')].filter(isBpmn).map(async (code) => {
    const box = document.createElement('div');
    box.className = 'bpmn-box';
    const xml = code.textContent;
    code.parentElement.replaceWith(box);
    await renderBpmnBox(box, xml);
  }));
  el.querySelectorAll('pre > code[class*="language-"]').forEach(addFileBar);
  await Promise.all([...el.querySelectorAll('pre > code.language-mermaid')].map(async (code) => {
    const box = document.createElement('div');
    box.className = 'mermaid-box';
    const src = code.textContent;
    code.parentElement.replaceWith(box);
    try { box.innerHTML = (await mermaid.render('m' + ++seq, src)).svg; }
    catch { box.innerHTML = `<pre><code>${esc(src)}</code></pre>`; }
  }));
}
