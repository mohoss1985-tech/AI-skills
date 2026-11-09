/* Tabs: switch which panel is shown (Params · Headers 3 · Body). Accent underline, scrolls instead of wrapping.
   tabs({tabs: [{id, label, count}], active, onChange, panels}) → <div class="tabs-wrap"> when `panels` ({id: Node}) is given
   (tab bar + panels, hidden ones get [hidden]), else the bare <div role="tablist">.
   el.select(id) changes the tab; el.setCount(id, n) updates a badge. Arrow keys move between tabs. */
let seq = 0;
export function tabs({ tabs: items = [], active, onChange, panels } = {}) {
  const uid = 'tab' + ++seq;
  const bar = document.createElement('div');
  bar.className = 'tabs';
  bar.setAttribute('role', 'tablist');
  let cur = active ?? (items[0] && items[0].id);
  const btns = new Map();
  for (const t of items) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'tab'; b.id = `${uid}-${t.id}`;
    b.setAttribute('role', 'tab');
    const l = document.createElement('span'); l.textContent = t.label; b.append(l);
    const c = document.createElement('span'); c.className = 'tab-count'; b.append(c);
    if (t.count) c.textContent = t.count;
    if (panels) b.setAttribute('aria-controls', `${uid}-${t.id}-panel`);
    b.onclick = () => { select(t.id); if (onChange) onChange(t.id); };
    btns.set(t.id, b); bar.append(b);
  }
  bar.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const ids = items.map((t) => t.id), i = ids.indexOf(cur);
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? ids.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length;
    select(ids[n]); if (onChange) onChange(ids[n]); btns.get(ids[n]).focus();
  });
  const root = panels ? document.createElement('div') : bar;
  if (panels) {
    root.className = 'tabs-wrap';
    root.append(bar);
    for (const t of items) {
      const p = document.createElement('div');
      p.className = 'tab-panel'; p.id = `${uid}-${t.id}-panel`;
      p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', `${uid}-${t.id}`);
      if (panels[t.id]) p.append(panels[t.id]);
      root.append(p);
    }
  }
  function select(id) {
    cur = id;
    for (const [k, b] of btns) {
      const on = k === id;
      b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
      if (panels) root.querySelector(`#${uid}-${k}-panel`).hidden = !on;
    }
  }
  root.select = select;
  root.setCount = (id, n) => { const b = btns.get(id); if (b) b.querySelector('.tab-count').textContent = n ? String(n) : ''; };
  Object.defineProperty(root, 'active', { get: () => cur });
  select(cur);
  return root;
}
