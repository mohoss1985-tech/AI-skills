/* Editable grid (spreadsheet-like): WSJF items, UAT cases, mappings, RACI…
   grid({columns, rows, onChange(rows), addLabel, removable, newRow() → {}, compact}) → <div class="grid-wrap">.
   columns: [{key, label, type: 'text'|'number'|'select'|'fib'|'readonly'|'check', options: [v|{value,label}],
              width, num, mono, placeholder, format(value, row) (readonly display), compute(row) (readonly computed)}]
   'fib' = select of 1 2 3 5 8 13 20. Keyboard: arrows move between cells (←/→ when the caret is at the edge),
   Enter moves down (adds a row on the last one when addLabel is set), Esc restores the cell.
   el.getRows(), el.setRows(rows) (no onChange), el.focusCell(row, col). */
import { icon } from './icon.js';
import { t } from '../core/i18n.js';

export const FIB = [1, 2, 3, 5, 8, 13, 20];

export function grid({ columns = [], rows = [], onChange, addLabel = '', removable = false, newRow, compact = true } = {}) {
  let data = rows.map((r) => ({ ...r }));
  const wrap = document.createElement('div');
  wrap.className = 'grid-wrap table-wrap';
  const tbl = document.createElement('table');
  tbl.className = 'table grid' + (compact ? ' compact' : '');
  tbl.setAttribute('role', 'grid');
  const head = tbl.createTHead().insertRow();
  for (const c of columns) {
    const th = document.createElement('th');
    th.scope = 'col'; th.textContent = c.label ?? c.key;
    if (c.num || c.type === 'number' || c.type === 'fib') th.className = 'num';
    if (c.width) th.style.width = typeof c.width === 'number' ? c.width + 'px' : c.width;
    head.append(th);
  }
  if (removable) { const th = document.createElement('th'); th.className = 'grid-act'; th.innerHTML = '<span class="sr-only"></span>'; th.firstChild.textContent = t('Actions'); head.append(th); }
  const body = tbl.createTBody();
  wrap.append(tbl);
  const emit = () => { if (onChange) onChange(data.map((r) => ({ ...r }))); };

  const cellControl = (c, r, ri, ci) => {
    const type = c.compute ? 'readonly' : c.type || 'text';
    const label = `${c.label ?? c.key} ${ri + 1}`;
    if (type === 'readonly') {
      const s = document.createElement('span');
      s.className = 'grid-ro'; s.tabIndex = -1; s.dataset.cell = `${ri}:${ci}`;
      const v = c.compute ? c.compute(r) : c.format ? c.format(r[c.key], r) : r[c.key];
      if (v instanceof Node) s.append(v); else s.textContent = v ?? '';
      return s;
    }
    if (type === 'check') {
      const i = document.createElement('input');
      i.type = 'checkbox'; i.checked = !!r[c.key]; i.dataset.cell = `${ri}:${ci}`; i.setAttribute('aria-label', label);
      i.onchange = () => { r[c.key] = i.checked; refreshComputed(); emit(); };
      return i;
    }
    if (type === 'select' || type === 'fib') {
      const s = document.createElement('select');
      s.className = 'cell-input'; s.dataset.cell = `${ri}:${ci}`; s.setAttribute('aria-label', label);
      const opts = type === 'fib' ? ['', ...FIB] : c.options || [];
      for (const o of opts) {
        const opt = document.createElement('option');
        const v = typeof o === 'object' ? o.value : o;
        opt.value = v; opt.textContent = typeof o === 'object' ? o.label ?? v : v === '' ? '—' : v;
        if (String(v) === String(r[c.key] ?? '')) opt.selected = true;
        s.append(opt);
      }
      s.onchange = () => { r[c.key] = type === 'fib' ? (s.value === '' ? null : +s.value) : s.value; refreshComputed(); emit(); };
      return s;
    }
    const i = document.createElement('input');
    i.className = 'cell-input' + (c.mono ? ' mono' : '') + (type === 'number' || c.num ? ' num' : '');
    i.type = type === 'number' ? 'number' : 'text';
    i.value = r[c.key] ?? ''; i.dataset.cell = `${ri}:${ci}`; i.setAttribute('aria-label', label);
    if (c.placeholder) i.placeholder = c.placeholder;
    let before = i.value;
    i.onfocus = () => { before = i.value; };
    i.oninput = () => { r[c.key] = type === 'number' ? (i.value === '' ? null : +i.value) : i.value; refreshComputed(); emit(); };
    i.onkeydown = (e) => { if (e.key === 'Escape' && i.value !== before) { e.stopPropagation(); i.value = before; i.oninput(); } };
    return i;
  };
  function refreshComputed() {
    columns.forEach((c, ci) => {
      if (!c.compute) return;
      data.forEach((r, ri) => { const s = body.querySelector(`[data-cell="${ri}:${ci}"]`); if (s) { const v = c.compute(r); s.replaceChildren(v instanceof Node ? v : document.createTextNode(v ?? '')); } });
    });
  }
  function paint() {
    body.replaceChildren();
    data.forEach((r, ri) => {
      const tr = body.insertRow();
      columns.forEach((c, ci) => {
        const td = tr.insertCell();
        if (c.num || c.type === 'number' || c.type === 'fib') td.className = 'num';
        td.append(cellControl(c, r, ri, ci));
      });
      if (removable) {
        const td = tr.insertCell(); td.className = 'grid-act';
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'btn ghost sm icon-only'; b.setAttribute('aria-label', `${t('Remove row')} ${ri + 1}`); b.title = t('Remove row');
        b.append(icon('trash-2', { size: 14 }));
        b.onclick = () => { data.splice(ri, 1); paint(); emit(); };
        td.append(b);
      }
    });
  }
  function addRow(focus = true) {
    data.push(newRow ? newRow(data) : Object.fromEntries(columns.map((c) => [c.key, ''])));
    paint(); emit();
    if (focus) wrap.focusCell(data.length - 1, columns.findIndex((c) => !c.compute && c.type !== 'readonly'));
  }
  wrap.focusCell = (ri, ci) => { const x = body.querySelector(`[data-cell="${ri}:${ci}"]`); if (x) { x.focus(); if (x.select && x.tagName === 'INPUT' && x.type === 'text') x.select(); } };
  body.addEventListener('keydown', (e) => {
    const cell = e.target.closest('[data-cell]');
    if (!cell) return;
    const [ri, ci] = cell.dataset.cell.split(':').map(Number);
    const isText = cell.tagName === 'INPUT' && cell.type !== 'checkbox';
    const atStart = !isText || (cell.selectionStart === 0 && cell.selectionEnd === 0) || cell.type === 'number';
    const atEnd = !isText || cell.selectionEnd === cell.value.length || cell.type === 'number';
    let to = null;
    if (e.key === 'ArrowDown' && cell.tagName !== 'SELECT') to = [ri + 1, ci];
    else if (e.key === 'ArrowUp' && cell.tagName !== 'SELECT') to = [ri - 1, ci];
    else if (e.key === 'ArrowLeft' && atStart) to = [ri, ci - 1];
    else if (e.key === 'ArrowRight' && atEnd) to = [ri, ci + 1];
    else if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
      if (ri === data.length - 1 && addLabel) { e.preventDefault(); addRow(false); wrap.focusCell(ri + 1, ci); return; }
      to = [ri + 1, ci];
    }
    if (!to) return;
    const x = body.querySelector(`[data-cell="${to[0]}:${to[1]}"]`);
    if (x) { e.preventDefault(); wrap.focusCell(to[0], to[1]); }
  });
  if (addLabel) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'btn ghost sm grid-add';
    b.append(icon('plus', { size: 14 }), document.createTextNode(addLabel));
    b.onclick = () => addRow(true);
    wrap.append(b);
  }
  wrap.getRows = () => data.map((r) => ({ ...r }));
  wrap.setRows = (list) => { data = list.map((r) => ({ ...r })); paint(); };
  wrap.addRow = addRow;
  paint();
  return wrap;
}
