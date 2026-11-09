/* Message templates for both K tools: a logic message {k, p} becomes text in the current language.
   {name} placeholders are filled from p; a param whose value has a 'val.<value>' key is translated. */
import { t } from '../../core/i18n.js';

export function makeTr(ns, fmt = {}) {
  const has = (k) => t(`${ns}.${k}`) !== `${ns}.${k}`;
  const T = (k) => t(`${ns}.${k}`);
  const val = (v) => (v != null && has(`val.${v}`) ? T(`val.${v}`) : v ?? '');
  const tr = (msg) => {
    if (msg == null) return '';
    if (typeof msg === 'string') return msg;
    return T(msg.k).replace(/\{(\w+)\}/g, (_, name) => { const v = msg.p ? msg.p[name] : ''; return String(fmt[name] && v != null && v !== '' ? fmt[name](v) : val(v)); });
  };
  return { T, tr, val, has, fill: (k, p) => tr({ k, p }) };
}
