/* Spinner + elapsed time for runs of 1–10 s (NN/g). spinner({label}) → <span class="spinner-row" role="status">;
   el.start() shows it after 200 ms and counts "Sending… 1.4 s"; el.stop(). progress('3 of 12') via el.setText(). */
import { t } from '../core/i18n.js';

export function spinner({ label = '' } = {}) {
  const s = document.createElement('span');
  s.className = 'spinner-row'; s.setAttribute('role', 'status'); s.hidden = true;
  const sp = document.createElement('i'); sp.className = 'spinner'; sp.setAttribute('aria-hidden', 'true');
  const tx = document.createElement('span');
  s.append(sp, tx);
  let t0 = 0, iv = 0, to = 0, fixed = '';
  const tick = () => { tx.textContent = fixed || `${label || t('Working…')} ${((performance.now() - t0) / 1000).toFixed(1)} s`; };
  s.start = () => { t0 = performance.now(); fixed = ''; clearTimeout(to); clearInterval(iv); to = setTimeout(() => { s.hidden = false; tick(); iv = setInterval(tick, 100); }, 200); };
  s.stop = () => { clearTimeout(to); clearInterval(iv); s.hidden = true; };
  s.setText = (txt) => { fixed = txt; tick(); };
  return s;
}
