/* Toast: confirms a side effect. One at a time, bottom right, role="status" + aria-live="polite", pauses on hover.
   toast(msg)                       4 s
   toast(msg, '#/d/12')             V1 form: clicking opens that page (5 s)
   toast(msg, {href, action: {label, onClick}, tone: 'ok'|'bad'|'info', ms})   with an action: 8 s
   Errors of a run belong in the results pane, not only in a toast. */
import { $ } from '../core/dom.js';
import { icon } from './icon.js';

let timer = 0;
export function toast(msg, opts) {
  const o = typeof opts === 'string' ? { href: opts } : opts || {};
  let el = $('#toast');
  if (!el) { el = document.createElement('div'); el.id = 'toast'; el.className = 'toast'; document.body.append(el); }
  el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
  el.className = 'toast' + (o.tone ? ' ' + o.tone : '');
  el.replaceChildren();
  if (o.tone) el.append(icon(o.tone === 'bad' ? 'circle-alert' : o.tone === 'ok' ? 'circle-check' : 'info'));
  const text = document.createElement('span'); text.textContent = msg; el.append(text);
  if (o.action) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost sm'; b.textContent = o.action.label;
    b.onclick = (e) => { e.stopPropagation(); el.hidden = true; o.action.onClick(); };
    el.append(b);
  }
  el.hidden = false;
  el.style.cursor = o.href ? 'pointer' : '';
  el.onclick = o.href ? () => { location.hash = o.href; el.hidden = true; } : null;
  const ms = o.ms || (o.action ? 8000 : o.href ? 5000 : 4000);
  const arm = () => { clearTimeout(timer); timer = setTimeout(() => (el.hidden = true), ms); };
  el.onmouseenter = () => clearTimeout(timer);
  el.onmouseleave = arm;
  arm();
  return el;
}
