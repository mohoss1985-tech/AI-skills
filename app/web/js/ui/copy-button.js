/* Copy button with a "Copied" state for 1.5 s. copyButton({text: string | () => string, label}) → <button>. */
import { icon } from './icon.js';
import { t } from '../core/i18n.js';

export function copyButton({ text = '', label = '', size = 'sm', variant = 'ghost' } = {}) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = `btn ${variant} ${size}`;
  const l = document.createElement('span'); l.textContent = label || t('Copy');
  b.append(icon('copy', { size: 14 }), l);
  b.onclick = async () => {
    try { await navigator.clipboard.writeText(typeof text === 'function' ? await text() : text); l.textContent = t('Copied'); setTimeout(() => (l.textContent = label || t('Copy')), 1500); }
    catch { l.textContent = t('Copy failed'); }
  };
  return b;
}
