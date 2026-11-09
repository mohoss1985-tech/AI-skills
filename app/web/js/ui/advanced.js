/* "Advanced · 2 set" disclosure: hides the optional inputs but always shows how many are not default.
   advanced({label, body: Node, count = 0, open = false}) → <details class="advanced">; el.setCount(n). */
import { icon } from './icon.js';
import { t } from '../core/i18n.js';

export function advanced({ label = '', body, count = 0, open = false } = {}) {
  const d = document.createElement('details');
  d.className = 'advanced'; d.open = open;
  const s = document.createElement('summary');
  const name = document.createElement('span'); name.textContent = label || t('Advanced');
  const c = document.createElement('span'); c.className = 'adv-count';
  s.append(icon('chevron-right', { size: 14 }), name, c);
  const inner = document.createElement('div'); inner.className = 'adv-body';
  if (body) inner.append(body);
  d.append(s, inner);
  d.setCount = (n) => { c.textContent = n ? ` · ${n} ${t('set')}` : ''; };
  d.setCount(count);
  d.body = inner;
  return d;
}
