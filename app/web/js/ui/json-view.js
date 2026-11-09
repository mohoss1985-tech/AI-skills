/* JSON viewer: collapsible tree (▸ {…} 4 keys), Pretty | Raw switch, copy button, palette syntax colours.
   jsonView({value, depth = 2, onPick(path, value), toolbar = true, maxBytes = 200000}) → <div class="json-view">.
   value: any JSON value, or a string (parsed when it is JSON, else shown raw).
   onPick: clicking a leaf value calls onPick('$.data.status', 'approved') (API tester "click a value → check").
   el.setValue(v). Large bodies (> maxBytes) render raw with a notice. */
import { icon } from './icon.js';
import { segmented } from './segmented.js';
import { t } from '../core/i18n.js';

const keyPath = (base, k) => (typeof k === 'number' ? `${base}[${k}]` : /^[A-Za-z_$][\w$]*$/.test(k) ? `${base}.${k}` : `${base}[${JSON.stringify(k)}]`);

export function jsonView({ value, depth = 2, onPick, toolbar = true, maxBytes = 200000 } = {}) {
  const root = document.createElement('div');
  root.className = 'json-view';
  const bar = document.createElement('div'); bar.className = 'json-bar';
  const body = document.createElement('div'); body.className = 'json-body';
  let mode = 'pretty', data, text = '', parsed = false;

  const leaf = (v, path) => {
    const s = document.createElement(onPick ? 'button' : 'span');
    if (onPick) { s.type = 'button'; s.title = t('Add a check on this value'); s.onclick = () => onPick(path, v); }
    const type = v === null ? 'null' : typeof v;
    s.className = 'j-' + (type === 'boolean' || type === 'null' ? 'bool' : type === 'number' ? 'num' : 'str') + (onPick ? ' j-pick' : '');
    s.textContent = type === 'string' ? JSON.stringify(v) : String(v);
    return s;
  };
  const node = (v, path, level, key, last) => {
    const line = document.createElement('div'); line.className = 'j-line';
    const k = () => { if (key == null) return; const ks = document.createElement('span'); ks.className = 'j-key'; ks.textContent = typeof key === 'number' ? '' : JSON.stringify(key); if (typeof key !== 'number') line.append(ks, punct(': ')); };
    const comma = () => { if (!last) line.append(punct(',')); };
    if (v === null || typeof v !== 'object') { k(); line.append(leaf(v, path)); comma(); return line; }
    const isArr = Array.isArray(v), entries = isArr ? v.map((x, i) => [i, x]) : Object.entries(v);
    const open = isArr ? '[' : '{', close = isArr ? ']' : '}';
    if (!entries.length) { k(); line.append(punct(open + close)); comma(); return line; }
    const det = document.createElement('details'); det.className = 'j-node'; det.open = level < depth;
    const sum = document.createElement('summary');
    const tw = document.createElement('span'); tw.className = 'j-twist'; tw.append(icon('chevron-right', { size: 14 }));
    sum.append(tw);
    if (key != null && typeof key !== 'number') { const ks = document.createElement('span'); ks.className = 'j-key'; ks.textContent = JSON.stringify(key); sum.append(ks, punct(': ')); }
    sum.append(punct(open));
    const more = document.createElement('span'); more.className = 'j-more';
    more.textContent = `…${close} ${entries.length} ${isArr ? t(entries.length === 1 ? 'item' : 'items') : t(entries.length === 1 ? 'key' : 'keys')}`;
    sum.append(more);
    const kids = document.createElement('div'); kids.className = 'j-kids';
    entries.forEach(([kk, vv], i) => kids.append(node(vv, keyPath(path, kk), level + 1, kk, i === entries.length - 1)));
    const end = document.createElement('div'); end.className = 'j-line j-end'; end.append(punct(close)); if (!last) end.append(punct(','));
    det.append(sum, kids, end);
    line.append(det);
    return line;
  };
  const punct = (s) => { const p = document.createElement('span'); p.className = 'j-punct'; p.textContent = s; return p; };

  const paint = () => {
    body.replaceChildren();
    if (!parsed || mode === 'raw' || text.length > maxBytes) {
      if (parsed && text.length > maxBytes && mode !== 'raw') { const n = document.createElement('p'); n.className = 'json-note'; n.textContent = t('Large body: shown as raw text.'); body.append(n); }
      const pre = document.createElement('pre'); pre.className = 'json-raw';
      pre.textContent = parsed && mode === 'pretty' ? JSON.stringify(data, null, 2) : text;
      body.append(pre);
    } else body.append(node(data, '$', 0, null, true));
  };
  const seg = segmented({ options: [{ value: 'pretty', label: t('Pretty') }, { value: 'raw', label: t('Raw') }], value: mode, label: t('View'), onChange: (m) => { mode = m; paint(); } });
  const copy = document.createElement('button');
  copy.type = 'button'; copy.className = 'btn ghost sm';
  const copyLabel = document.createElement('span'); copyLabel.textContent = t('Copy');
  copy.append(icon('copy', { size: 14 }), copyLabel);
  copy.onclick = async () => {
    try { await navigator.clipboard.writeText(parsed ? JSON.stringify(data, null, 2) : text); copyLabel.textContent = t('Copied'); setTimeout(() => (copyLabel.textContent = t('Copy')), 1500); } catch {}
  };
  const sp = document.createElement('span'); sp.className = 'spacer';
  bar.append(seg, sp, copy);
  if (toolbar) root.append(bar);
  root.append(body);
  root.setValue = (v) => {
    parsed = true;
    if (typeof v === 'string') { text = v; try { data = JSON.parse(v); } catch { parsed = false; } }
    else { data = v; try { text = JSON.stringify(v); } catch { text = String(v); } }
    seg.hidden = !parsed;
    paint();
  };
  root.setValue(value === undefined ? null : value);
  return root;
}
