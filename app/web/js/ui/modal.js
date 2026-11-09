/* Modal dialog on native <dialog>: focus is trapped by the browser, Esc closes, focus returns to the opener.
   modal({title, body: Node|string, actions: [{label, variant, onClick(close) → false keeps it open}], onClose, size: 'sm'|'md'|'lg'})
   → <dialog>, already open. d.close() closes it. */
import { icon } from './icon.js';
import { t } from '../core/i18n.js';

let seq = 0;
export function modal({ title = '', body = '', actions = [], onClose, size = 'md' } = {}) {
  const opener = document.activeElement;
  const d = document.createElement('dialog');
  d.className = 'modal ' + size;
  const id = 'modal-' + ++seq;
  d.setAttribute('aria-labelledby', id);
  const head = document.createElement('div'); head.className = 'modal-head';
  const h = document.createElement('h2'); h.id = id; h.textContent = title;
  const x = document.createElement('button');
  x.type = 'button'; x.className = 'btn ghost sm icon-only'; x.setAttribute('aria-label', t('Close')); x.title = t('Close');
  x.append(icon('x')); x.onclick = () => d.close();
  head.append(h, x);
  const content = document.createElement('div'); content.className = 'modal-body';
  if (typeof body === 'string') content.textContent = body; else if (body) content.append(body);
  d.append(head, content);
  if (actions.length) {
    const foot = document.createElement('div'); foot.className = 'modal-foot';
    for (const a of actions) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'btn' + (a.variant ? ' ' + a.variant : ''); b.textContent = a.label;
      b.onclick = async () => { const keep = a.onClick ? await a.onClick(() => d.close()) : undefined; if (keep !== false) d.close(); };
      foot.append(b);
    }
    d.append(foot);
  }
  d.addEventListener('click', (e) => { if (e.target === d) d.close(); });
  d.addEventListener('close', () => { d.remove(); if (onClose) onClose(); if (opener && opener.focus) opener.focus(); });
  document.body.append(d);
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  return d;
}
