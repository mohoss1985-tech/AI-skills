/* Status pill: "● 200 OK · 182 ms · 1.2 KB" (dot = status colour, never colour alone: the text says it).
   statusPill({status, text, ms, bytes, rows, tone, label}) → <span class="status-pill tone-…">.
   tone: 'ok' | 'info' | 'warn' | 'bad' | 'wait' | 'neutral' ('fail' = 'bad'). Default from the HTTP status:
   1xx/3xx info, 2xx ok, 4xx warn, 5xx and 0 (network error) bad, none = wait. el.update(opts) repaints. */
import { t } from '../core/i18n.js';

export const httpTone = (s) => (s == null ? 'wait' : s === 0 || s >= 500 ? 'bad' : s >= 400 ? 'warn' : s >= 300 || s < 200 ? 'info' : 'ok');
export const fmtMs = (ms) => (ms >= 10000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`);
export const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

export function statusPill(opts = {}) {
  const s = document.createElement('span');
  s.update = ({ status, text = '', ms, bytes, rows, tone, label } = {}) => {
    let tn = tone || httpTone(status);
    if (tn === 'fail') tn = 'bad';
    s.className = 'status-pill tone-' + tn;
    const parts = [[status, text].filter((x) => x != null && x !== '').join(' ')];
    if (rows != null) parts.push(`${rows} ${t(rows === 1 ? 'row' : 'rows')}`);
    if (ms != null) parts.push(fmtMs(ms));
    if (bytes != null) parts.push(fmtBytes(bytes));
    const dot = document.createElement('i'); dot.setAttribute('aria-hidden', 'true');
    const txt = document.createElement('span'); txt.textContent = parts.filter(Boolean).join(' · ');
    s.replaceChildren(dot, txt);
    if (label) s.setAttribute('aria-label', label);
  };
  s.update(opts);
  return s;
}
