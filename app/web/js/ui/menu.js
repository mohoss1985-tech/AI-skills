/* Dropdown menu (Export ▾, Ask Claude ▾, Load sample ▾).
   menu({label, icon, variant, size, items: [{label, hint, icon, kbd, onClick, disabled} | {group: 'Title'} | '-'], align: 'left'|'right'})
   → <div class="menu-wrap"> with a trigger button (aria-haspopup, aria-expanded) and a role="menu" popover.
   Arrow keys move, Enter/Space runs, Esc closes and returns focus. el.setItems(items) replaces the list. */
import { icon as mkIcon } from './icon.js';

let open = null;
document.addEventListener('pointerdown', (e) => { if (open && !open.contains(e.target)) open.close(); });

export function menu({ label = '', icon, variant = '', size = 'sm', items = [], align = 'left', ariaLabel = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'menu-wrap';
  const btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'btn' + (variant ? ' ' + variant : '') + (size ? ' ' + size : '');
  btn.setAttribute('aria-haspopup', 'menu'); btn.setAttribute('aria-expanded', 'false');
  if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
  if (icon) btn.append(mkIcon(icon));
  const l = document.createElement('span'); l.className = 'btn-label'; l.textContent = label; if (label) btn.append(l);
  btn.append(mkIcon('chevron-down', { size: 14, className: 'chev' }));
  const list = document.createElement('div');
  list.className = 'menu ' + align; list.setAttribute('role', 'menu'); list.hidden = true;
  wrap.append(btn, list);
  const entries = () => [...list.querySelectorAll('[role="menuitem"]:not([disabled])')];
  wrap.setItems = (its) => {
    list.replaceChildren(...its.map((it) => {
      if (it === '-') { const h = document.createElement('div'); h.className = 'menu-sep'; h.setAttribute('role', 'separator'); return h; }
      if (it.group) { const h = document.createElement('div'); h.className = 'menu-group'; h.textContent = it.group; return h; }
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'menu-item'; b.setAttribute('role', 'menuitem'); b.tabIndex = -1;
      if (it.icon) b.append(mkIcon(it.icon));
      const tx = document.createElement('span'); tx.className = 'menu-label'; tx.textContent = it.label; b.append(tx);
      if (it.hint) { const h = document.createElement('span'); h.className = 'menu-hint'; h.textContent = it.hint; b.append(h); }
      if (it.kbd) { const k = document.createElement('kbd'); k.textContent = it.kbd; b.append(k); }
      b.disabled = !!it.disabled;
      b.onclick = () => { wrap.close(); if (it.onClick) it.onClick(); };
      return b;
    }));
  };
  wrap.open = () => {
    if (open && open !== wrap) open.close();
    list.hidden = false; btn.setAttribute('aria-expanded', 'true'); open = wrap;
    const f = entries()[0]; if (f) f.focus();
  };
  wrap.close = (refocus) => {
    if (list.hidden) return;
    list.hidden = true; btn.setAttribute('aria-expanded', 'false'); if (open === wrap) open = null;
    if (refocus) btn.focus();
  };
  btn.onclick = () => (list.hidden ? wrap.open() : wrap.close());
  btn.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); wrap.open(); } });
  list.addEventListener('keydown', (e) => {
    const es = entries(), i = es.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); es[(i + 1) % es.length].focus(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); es[(i - 1 + es.length) % es.length].focus(); }
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); wrap.close(true); }
    else if (e.key === 'Tab') wrap.close();
  });
  wrap.button = btn;
  wrap.setItems(items);
  return wrap;
}
