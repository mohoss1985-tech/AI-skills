/* Badge: soft fill + icon + text (Pass / Fail / Blocked / Not run, Must / Should…). Never colour alone.
   badge({text, tone: 'ok'|'info'|'warn'|'bad'|'neutral'|'accent', icon}) → <span class="badge tone-…">.
   Default icons: ok check, bad x, warn triangle-alert, info arrow-right. icon: false hides it. */
import { icon as mkIcon } from './icon.js';

const ICON = { ok: 'check', bad: 'x', warn: 'triangle-alert', info: 'arrow-right' };
export function badge({ text = '', tone = 'neutral', icon } = {}) {
  const s = document.createElement('span');
  s.className = 'badge tone-' + tone;
  const name = icon === false ? null : icon || ICON[tone];
  if (name) s.append(mkIcon(name, { size: 14 }));
  s.append(document.createTextNode(text));
  return s;
}
