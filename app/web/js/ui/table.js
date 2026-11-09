/* Read-only table (see grid.js to edit). Sticky header, hairlines + hover, numbers right-aligned and tabular.
   table({columns: [{key, label, align: 'left'|'right'|'center', num, mono, width, format(value, row) → string|Node}],
          rows, onRowClick(row, i), empty, compact, caption}) → <div class="table-wrap"> holding a <table class="table">.
   el.table is the <table>; el.setRows(rows) repaints the body. */
export function table({ columns = [], rows = [], onRowClick, empty = '', compact = true, caption = '' } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'table-wrap';
  const t = document.createElement('table');
  t.className = 'table' + (compact ? ' compact' : '');
  if (caption) { const c = t.createCaption(); c.textContent = caption; c.className = 'sr-only'; }
  const head = t.createTHead().insertRow();
  for (const c of columns) {
    const th = document.createElement('th');
    th.scope = 'col'; th.textContent = c.label ?? c.key;
    if (c.num || c.align === 'right') th.className = 'num';
    if (c.width) th.style.width = typeof c.width === 'number' ? c.width + 'px' : c.width;
    head.append(th);
  }
  const body = t.createTBody();
  wrap.append(t);
  wrap.table = t;
  wrap.setRows = (list) => {
    body.replaceChildren();
    if (!list.length && empty) {
      const td = body.insertRow().insertCell();
      td.colSpan = columns.length || 1; td.className = 'table-empty'; td.textContent = empty;
      return;
    }
    list.forEach((r, i) => {
      const tr = body.insertRow();
      if (onRowClick) { tr.tabIndex = 0; tr.className = 'clickable'; tr.onclick = () => onRowClick(r, i); tr.onkeydown = (e) => { if (e.key === 'Enter') onRowClick(r, i); }; }
      for (const c of columns) {
        const td = tr.insertCell();
        const v = c.format ? c.format(r[c.key], r) : r[c.key];
        if (v instanceof Node) td.append(v); else { td.textContent = v ?? ''; if (v != null && String(v).length > 24) td.title = String(v); }
        if (c.num || c.align === 'right') td.classList.add('num');
        if (c.align === 'center') td.classList.add('center');
        if (c.mono) td.classList.add('mono');
      }
    });
  };
  wrap.setRows(rows);
  return wrap;
}
