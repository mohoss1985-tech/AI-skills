/* Lucide icon from the vendored sprite (icons/lucide.svg, ISC licence).
   icon(name, {size: 16|14|20, label}) → <svg class="icon">. Decorative (aria-hidden) unless `label` is given. */
const NS = 'http://www.w3.org/2000/svg';
export const SPRITE = 'icons/lucide.svg';

export function icon(name, { size = 16, label = '', className = '' } = {}) {
  const s = document.createElementNS(NS, 'svg');
  s.setAttribute('class', 'icon' + (className ? ' ' + className : ''));
  s.setAttribute('width', size); s.setAttribute('height', size);
  s.setAttribute('viewBox', '0 0 24 24');
  if (label) { s.setAttribute('role', 'img'); s.setAttribute('aria-label', label); } else s.setAttribute('aria-hidden', 'true');
  const u = document.createElementNS(NS, 'use');
  u.setAttribute('href', `${SPRITE}#${name}`);
  s.append(u);
  return s;
}
/** Same icon as a markup string, for html`` templates: html`${raw(iconSvg('send'))}`. */
export const iconSvg = (name, size = 16) =>
  `<svg class="icon" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true"><use href="${SPRITE}#${name}"></use></svg>`;
