/* Key/value editor: headers, query params, form fields. Always one empty row at the end.
   kvEditor({rows: [{key, value, on}], onChange(rows), keyPlaceholder, valuePlaceholder, toggles = true, mono = true})
   → <div class="kv-editor">. onChange gets the non-empty rows (including disabled ones, with on:false).
   el.getRows(), el.setRows(rows). */
import { icon } from './icon.js';
import { t } from '../core/i18n.js';

export function kvEditor({ rows = [], onChange, keyPlaceholder = '', valuePlaceholder = '', toggles = true, mono = true } = {}) {
  let data = rows.map((r) => ({ on: true, key: '', value: '', ...r }));
  const wrap = document.createElement('div');
  wrap.className = 'kv-editor';
  const filled = () => data.filter((r) => r.key || r.value).map((r) => ({ ...r }));
  const emit = () => onChange && onChange(filled());
  const paint = () => {
    if (!data.length || data[data.length - 1].key || data[data.length - 1].value) data.push({ key: '', value: '', on: true });
    wrap.replaceChildren(...data.map((r, i) => {
      const row = document.createElement('div');
      row.className = 'kv-row' + (r.on ? '' : ' off');
      const last = i === data.length - 1;
      if (toggles) {
        const c = document.createElement('input');
        c.type = 'checkbox'; c.checked = r.on !== false; c.disabled = last;
        c.setAttribute('aria-label', t('Include'));
        c.onchange = () => { r.on = c.checked; row.classList.toggle('off', !c.checked); emit(); };
        row.append(c);
      }
      const k = Object.assign(document.createElement('input'), { className: 'input sm' + (mono ? ' mono' : ''), value: r.key, placeholder: keyPlaceholder || t('Key') });
      const v = Object.assign(document.createElement('input'), { className: 'input sm' + (mono ? ' mono' : ''), value: r.value, placeholder: valuePlaceholder || t('Value') });
      k.setAttribute('aria-label', `${t('Key')} ${i + 1}`); v.setAttribute('aria-label', `${t('Value')} ${i + 1}`);
      k.oninput = () => { r.key = k.value; emit(); if (last && k.value) grow(); };
      v.oninput = () => { r.value = v.value; emit(); if (last && v.value) grow(); };
      row.append(k, v);
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'btn ghost sm icon-only'; del.title = t('Remove'); del.setAttribute('aria-label', `${t('Remove')} ${i + 1}`);
      del.append(icon('x', { size: 14 })); del.disabled = last;
      del.onclick = () => { data.splice(i, 1); paint(); emit(); };
      row.append(del);
      return row;
    }));
  };
  // Add the trailing empty row without stealing focus from the one being typed in.
  const grow = () => {
    data.push({ key: '', value: '', on: true });
    const a = document.activeElement, idx = [...wrap.querySelectorAll('input')].indexOf(a), pos = a && a.selectionStart;
    paint();
    const again = wrap.querySelectorAll('input')[idx];
    if (again) { again.focus(); try { again.setSelectionRange(pos, pos); } catch {} }
  };
  wrap.getRows = filled;
  wrap.setRows = (list) => { data = list.map((r) => ({ on: true, key: '', value: '', ...r })); paint(); };
  paint();
  return wrap;
}
