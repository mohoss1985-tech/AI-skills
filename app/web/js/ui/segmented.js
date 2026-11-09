/* Segmented control (radiogroup): an immediate value switch such as Pretty | Raw or Visa EN | CB FR.
   segmented({options: [{value, label}], value, onChange, label}) → <div role="radiogroup">; el.value; el.set(v). */
export function segmented({ options = [], value, onChange, label = '', size = 'sm' } = {}) {
  const g = document.createElement('div');
  g.className = 'segmented ' + size;
  g.setAttribute('role', 'radiogroup');
  if (label) g.setAttribute('aria-label', label);
  let cur = value ?? (options[0] && options[0].value);
  const btns = options.map((o) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'radio'); b.dataset.value = o.value;
    b.textContent = o.label ?? o.value;
    b.onclick = () => { g.set(o.value); if (onChange) onChange(o.value); };
    return b;
  });
  g.append(...btns);
  g.set = (v) => {
    cur = v;
    btns.forEach((b) => { const on = b.dataset.value === String(v); b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  };
  g.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const i = options.findIndex((o) => String(o.value) === String(cur));
    const n = options[(i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length];
    g.set(n.value); if (onChange) onChange(n.value);
    btns.find((b) => b.dataset.value === String(n.value)).focus();
  });
  Object.defineProperty(g, 'value', { get: () => cur });
  g.set(cur);
  return g;
}
