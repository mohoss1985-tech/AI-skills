/* DOM helpers. html`` is an escaping tagged template: every ${value} is escaped unless it is itself
   html`` (or raw()) output; arrays are joined. Assign the result to innerHTML (it stringifies). */

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

class SafeHtml {
  constructor(s) { this.s = s; }
  toString() { return this.s; }
}
const part = (v) => (v == null || v === false ? '' : v instanceof SafeHtml ? v.s : Array.isArray(v) ? v.map(part).join('') : esc(v));
export function html(strings, ...vals) {
  let out = strings[0];
  for (let i = 0; i < vals.length; i++) out += part(vals[i]) + strings[i + 1];
  return new SafeHtml(out);
}
/** Trusted markup that html`` must not escape (already-sanitised HTML, static SVG). */
export const raw = (s) => new SafeHtml(String(s ?? ''));

/** First element of an HTML string. */
export function el(markup) {
  const t = document.createElement('template');
  t.innerHTML = String(markup).trim();
  return t.content.firstElementChild;
}

export const download = (name, blob) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
};

export const isDark = () => {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
};
