/* Empty state: one sentence of what this area will show + the primary action + "Load sample".
   emptyState({icon, title, text, action: {label, onClick, kbd}, sample: {label, onClick}}) → <div class="empty-state">. */
import { icon as mkIcon } from './icon.js';
import { button } from './button.js';

export function emptyState({ icon, title = '', text = '', action, sample } = {}) {
  const d = document.createElement('div');
  d.className = 'empty-state empty-note';
  if (icon) d.append(mkIcon(icon, { size: 20 }));
  if (title) { const b = document.createElement('b'); b.textContent = title; d.append(b); }
  if (text) { const p = document.createElement('p'); p.textContent = text; d.append(p); }
  if (action || sample) {
    const row = document.createElement('div'); row.className = 'empty-actions';
    if (action) row.append(button({ label: action.label, variant: 'primary', size: 'sm', onClick: action.onClick, kbd: action.kbd }));
    if (sample) row.append(button({ label: sample.label, size: 'sm', icon: 'flask-conical', onClick: sample.onClick }));
    d.append(row);
  }
  return d;
}
