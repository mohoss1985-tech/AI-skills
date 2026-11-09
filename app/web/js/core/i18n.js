/* Interface language. t(key) returns the string in the current language.
   - V1 strings use the English text as the key: t('New deliverable') → 'Nouveau livrable' in French.
   - Tools register namespaced strings: register('api-tester', {en: {send: 'Send'}, fr: {send: 'Envoyer'}})
     then t('api-tester.send'), or use the scoped function register() returns: T('send').
   Missing keys fall back to English, then to the key itself. */
import en from '../i18n/en.js';
import fr from '../i18n/fr.js';

const dicts = { en: { ...en }, fr: { ...fr } };
const listeners = [];
let current = 'en';
try { current = localStorage.getItem('kit-lang') || (navigator.language || '').slice(0, 2) === 'fr' && 'fr' || 'en'; } catch {}

export const LANGS = ['en', 'fr'];
export const getLang = () => current;
export function setLang(lang) {
  current = lang === 'fr' ? 'fr' : 'en';
  try { localStorage.setItem('kit-lang', current); } catch {}
  listeners.forEach((fn) => fn(current));
}
export const onLangChange = (fn) => { listeners.push(fn); };

export function t(key) {
  return (dicts[current] && dicts[current][key]) || dicts.en[key] || key;
}
/** V1 name for t(): L('English text'). */
export const L = t;

export function register(ns, { en: e = {}, fr: f = {} } = {}) {
  for (const [k, v] of Object.entries(e)) dicts.en[`${ns}.${k}`] = v;
  for (const [k, v] of Object.entries(f)) dicts.fr[`${ns}.${k}`] = v;
  return (k) => t(`${ns}.${k}`);
}

/** Field of a deliverable type in the current language: tx(type, 'name'). */
export const tx = (type, k) => (current === 'fr' && type.fr && type.fr[k]) || type[k];
/** Pick the right side of a {en, fr} object. */
export const pick = (o) => (o && (o[current] || o.en)) || '';
export const locale = () => (current === 'fr' ? 'fr-FR' : undefined);
export const colon = () => (current === 'fr' ? ' : ' : ': ');
