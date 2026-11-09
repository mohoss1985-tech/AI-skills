/* Button. button({label, variant, size, icon, iconRight, onClick, type, kbd, title, disabled, ariaLabel}) → <button>.
   variant: 'primary' | 'secondary' (default) | 'ghost' | 'danger'. size: 'sm' (28) | 'md' (32, default) | 'lg' (40).
   V1 variants 'small' / 'big' still work. Icon-only: give `icon` + `ariaLabel`, no label.
   b.setBusy(true|false) shows an inline spinner and keeps the width; b.setLabel(text). */
import { icon as mkIcon } from './icon.js';

export function button({ label = '', variant = '', size = '', icon, iconRight, onClick, type = 'button', kbd = '', title = '', disabled = false, ariaLabel = '' } = {}) {
  const b = document.createElement('button');
  b.type = type;
  const v = variant === 'small' ? '' : variant === 'big' ? 'primary' : variant;
  const sz = size || (variant === 'small' ? 'sm' : variant === 'big' ? 'lg' : '');
  b.className = 'btn' + (v ? ' ' + v : '') + (sz ? ' ' + sz : '') + (!label && icon ? ' icon-only' : '');
  if (icon) b.append(mkIcon(icon));
  const span = document.createElement('span');
  span.className = 'btn-label';
  span.textContent = label;
  if (label) b.append(span);
  if (iconRight) b.append(mkIcon(iconRight));
  if (kbd) { const k = document.createElement('kbd'); k.textContent = kbd; b.append(k); }
  if (title) b.title = title;
  if (ariaLabel || (!label && title)) b.setAttribute('aria-label', ariaLabel || title);
  b.disabled = !!disabled;
  if (onClick) b.addEventListener('click', onClick);
  b.setLabel = (text) => { span.textContent = text; if (!span.isConnected && text) b.prepend(span); };
  b.setBusy = (on) => {
    b.classList.toggle('busy', !!on);
    b.setAttribute('aria-busy', on ? 'true' : 'false');
    b.disabled = !!on;
  };
  return b;
}

/** Shortcut label for the current platform: kbdLabel('mod+enter') → '⌘↵' on Mac, 'Ctrl+↵' elsewhere. */
export const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export function kbdLabel(combo) {
  return combo.split('+').map((k) => ({ mod: IS_MAC ? '⌘' : 'Ctrl+', shift: IS_MAC ? '⇧' : 'Shift+', alt: IS_MAC ? '⌥' : 'Alt+', enter: '↵', esc: 'Esc' }[k] ?? k.toUpperCase())).join('');
}
