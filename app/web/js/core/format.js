/* Formatting: dates, relative times, sizes, names. */
import { L, getLang, locale } from './i18n.js';

export const date = (t) => new Date(t * 1000).toLocaleDateString(locale(), { day: 'numeric', month: 'long', year: 'numeric' });
export const time = (t) => {
  const d = new Date(t * 1000), today = new Date().toDateString() === d.toDateString();
  return today ? d.toLocaleTimeString(locale(), { hour: '2-digit', minute: '2-digit' }) : d.toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
};
export const ago = (t) => {
  const s = Date.now() / 1000 - t;
  const pre = getLang() === 'fr' ? 'il y a ' : '';
  if (s < 60) return L('just now');
  if (s < 3600) return pre + Math.floor(s / 60) + ' ' + L('min ago');
  if (s < 86400) return pre + Math.floor(s / 3600) + ' ' + L('h ago');
  return new Date(t * 1000).toLocaleDateString(locale(), { day: 'numeric', month: 'short' });
};
export const initials = (n) => (n || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'You';
export const lower1 = (s) => (s ? s[0].toLowerCase() + s.slice(1) : '');
export const fileName = (s) => (s || 'deliverable').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').slice(0, 60);
export const greeting = () => { const h = new Date().getHours(); return L(h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'); };
export const size = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
