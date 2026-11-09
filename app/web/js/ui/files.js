/* V1 documents: drop zone, file list, upload (the privileged source of a deliverable). */
import { $, esc } from '../core/dom.js';
import { size } from '../core/format.js';
import { L } from '../core/i18n.js';
import { post } from '../core/api.js';

export const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.md,.png,.jpg,.jpeg,.pptx';
export const KIND_LABEL = { pdf: 'PDF', word: 'Word', excel: 'Excel', table: 'CSV', text: 'Text', image: 'Image', slides: 'PowerPoint', file: 'File' };
export const kindOf = (name) => {
  const e = (name.match(/\.(\w+)$/) || [])[1] || '';
  return { pdf: 'pdf', doc: 'word', docx: 'word', xls: 'excel', xlsx: 'excel', csv: 'table', txt: 'text', md: 'text', png: 'image', jpg: 'image', jpeg: 'image', pptx: 'slides' }[e.toLowerCase()] || 'file';
};
export const readFile = (f) => new Promise((ok, bad) => { const rd = new FileReader(); rd.onload = () => ok({ name: f.name, data: rd.result }); rd.onerror = bad; rd.readAsDataURL(f); });
export function dropHtml(hint) {
  return `<div class="drop" tabindex="0"><input type="file" multiple accept="${ACCEPT}" hidden>
    <div class="drop-main"><b>${L('Drop documents here')}</b> <span>${L('or')}</span> <button type="button" class="btn small" data-pick>${L('Choose files')}</button></div>
    <span class="drop-hint">${esc(hint || L('PDF, Word, Excel, PowerPoint, CSV or images. Claude treats them as the main source.'))}</span></div>`;
}
export function wireDrop(el, onFiles) {
  const input = $('input', el);
  $('[data-pick]', el).onclick = () => input.click();
  input.onchange = () => { onFiles([...input.files]); input.value = ''; };
  el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('over'); });
  el.addEventListener('dragleave', () => el.classList.remove('over'));
  el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('over'); onFiles([...e.dataTransfer.files]); });
}
export function filesHtml(list, scope, removable) {
  if (!list.length) return '';
  return `<ul class="files">${list.map((f) => `<li><span class="fkind ${f.kind || kindOf(f.name)}">${L(KIND_LABEL[f.kind || kindOf(f.name)])}</span>
    ${scope ? `<a href="/files/${scope}/${encodeURIComponent(f.name)}" target="_blank" rel="noopener">${esc(f.name)}</a>` : `<span>${esc(f.name)}</span>`}
    <span class="fsize">${size(f.size)}</span>${removable ? `<button type="button" class="btn ghost small" data-rmfile="${esc(f.name)}">${L('Remove')}</button>` : ''}</li>`).join('')}</ul>`;
}
export async function upload(scope, files) {
  const payload = await Promise.all(files.map(readFile));
  return post('/api/files', { scope, files: payload });
}
