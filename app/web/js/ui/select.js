/* Select. select({options: [value | {value, label}], value, onChange, id, ariaLabel, size, mono}) → <select class="input">.
   Use segmented() for ≤ 5 options applied immediately, select above 5 (research/04 §2.4). */
export function select({ options = [], value = '', onChange, id, ariaLabel = '', size = '', mono = false } = {}) {
  const s = document.createElement('select');
  s.className = 'input select' + (size ? ' ' + size : '') + (mono ? ' mono' : '');
  if (id) s.id = id;
  if (ariaLabel) s.setAttribute('aria-label', ariaLabel);
  for (const o of options) {
    const opt = document.createElement('option');
    const v = typeof o === 'object' ? o.value : o;
    opt.value = v; opt.textContent = typeof o === 'object' ? o.label ?? v : v;
    if (String(v) === String(value)) opt.selected = true;
    s.append(opt);
  }
  if (onChange) s.addEventListener('change', () => onChange(s.value));
  return s;
}
