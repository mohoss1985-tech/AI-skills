/* Field: label above, hint under the label, error under the hint (GOV.UK pattern).
   field({label, help, input, id, optional, required, error, mono}) → <div class="field">.
   Without `input` a text <input class="input"> is created. Returned element has:
     .control        the input element
     .setError(msg)  show/clear the error (red border + icon + text, aria-invalid, aria-describedby) */
import { icon } from './icon.js';
import { t } from '../core/i18n.js';

let n = 0;
export function field({ label = '', help = '', input, id, optional = false, required = false, error = '', mono = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'field';
  const control = input || document.createElement('input');
  if (!input) control.className = 'input' + (mono ? ' mono' : '');
  const target = control.matches && control.matches('input,select,textarea') ? control : control.querySelector && control.querySelector('input,select,textarea') || control;
  target.id = target.id || id || 'f-' + ++n;
  const lab = document.createElement('label');
  lab.htmlFor = target.id; lab.textContent = label;
  if (required) { const r = document.createElement('span'); r.className = 'req'; r.textContent = ' *'; r.setAttribute('aria-hidden', 'true'); lab.append(r); target.required = true; }
  if (optional) { const o = document.createElement('span'); o.className = 'opt'; o.textContent = ' ' + (optional === true ? t('optional') : optional); lab.append(o); }
  wrap.append(lab);
  const ids = [];
  if (help) { const h = document.createElement('span'); h.className = 'help'; h.id = target.id + '-help'; h.textContent = help; wrap.append(h); ids.push(h.id); }
  const err = document.createElement('span');
  err.className = 'field-error'; err.id = target.id + '-err'; err.hidden = true;
  wrap.append(err, control);
  if (ids.length) target.setAttribute('aria-describedby', ids.join(' '));
  wrap.control = target;
  wrap.setError = (msg) => {
    err.replaceChildren();
    err.hidden = !msg;
    wrap.classList.toggle('has-error', !!msg);
    if (msg) { err.append(icon('circle-alert', { size: 14 }), document.createTextNode(msg)); target.setAttribute('aria-invalid', 'true'); target.setAttribute('aria-describedby', [...ids, err.id].join(' ')); }
    else { target.removeAttribute('aria-invalid'); if (ids.length) target.setAttribute('aria-describedby', ids.join(' ')); else target.removeAttribute('aria-describedby'); }
  };
  if (error) wrap.setError(error);
  return wrap;
}

/** Plain text input. input({value, placeholder, type, mono, onInput, onChange, ariaLabel, size}) → <input class="input">. */
export function input({ value = '', placeholder = '', type = 'text', mono = false, onInput, onChange, ariaLabel = '', size = '', id } = {}) {
  const i = document.createElement('input');
  i.type = type; i.className = 'input' + (mono ? ' mono' : '') + (size ? ' ' + size : '');
  i.value = value ?? ''; if (placeholder) i.placeholder = placeholder;
  if (id) i.id = id;
  if (ariaLabel) i.setAttribute('aria-label', ariaLabel);
  if (onInput) i.addEventListener('input', () => onInput(i.value));
  if (onChange) i.addEventListener('change', () => onChange(i.value));
  return i;
}

/** Multi-line text. textarea({value, placeholder, rows, onInput, mono, ariaLabel}) → <textarea class="input textarea">. */
export function textarea({ value = '', placeholder = '', rows = 4, onInput, mono = false, ariaLabel = '', id } = {}) {
  const ta = document.createElement('textarea');
  ta.className = 'input textarea' + (mono ? ' mono' : '');
  ta.rows = rows; ta.value = value ?? ''; if (placeholder) ta.placeholder = placeholder;
  if (id) ta.id = id;
  if (ariaLabel) ta.setAttribute('aria-label', ariaLabel);
  if (onInput) ta.addEventListener('input', () => onInput(ta.value));
  return ta;
}
