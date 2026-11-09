/* Split pane: config | results. Side by side at ≥ 1 200 px wide, stacked below. Draggable 6 px gutter with a 1 px line,
   keyboard-resizable (role="separator", ←/→ by 5 %), ratio remembered per `id` in localStorage, min pane 320 px.
   splitpane({left: Node, right: Node, id, ratio = 0.5}) → <div class="splitpane">; el.left / el.right are the panes. */
import { t } from '../core/i18n.js';

export function splitpane({ left, right, id = '', ratio = 0.5 } = {}) {
  const key = id ? 'kit-split:' + id : '';
  try { const r = key && parseFloat(localStorage.getItem(key)); if (r > 0.15 && r < 0.85) ratio = r; } catch {}
  const d = document.createElement('div');
  d.className = 'splitpane';
  const a = document.createElement('section'), b = document.createElement('section');
  a.className = 'pane pane-a'; b.className = 'pane pane-b';
  const g = document.createElement('div');
  g.className = 'split-gutter'; g.tabIndex = 0;
  g.setAttribute('role', 'separator'); g.setAttribute('aria-orientation', 'vertical');
  g.setAttribute('aria-label', t('Resize panes')); g.setAttribute('aria-valuemin', '20'); g.setAttribute('aria-valuemax', '80');
  if (left) a.append(left);
  if (right) b.append(right);
  d.append(a, g, b);
  const set = (r) => {
    ratio = Math.min(0.8, Math.max(0.2, r));
    d.style.setProperty('--split', `${ratio * 100}%`);
    g.setAttribute('aria-valuenow', String(Math.round(ratio * 100)));
    try { if (key) localStorage.setItem(key, String(ratio)); } catch {}
  };
  g.addEventListener('pointerdown', (e) => {
    e.preventDefault(); g.setPointerCapture(e.pointerId); d.classList.add('dragging');
    const box = d.getBoundingClientRect();
    const move = (ev) => set((ev.clientX - box.left) / box.width);
    const up = () => { d.classList.remove('dragging'); g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); };
    g.addEventListener('pointermove', move); g.addEventListener('pointerup', up);
  });
  g.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') { e.preventDefault(); set(ratio - 0.05); }
    if (e.key === 'ArrowRight') { e.preventDefault(); set(ratio + 0.05); }
  });
  set(ratio);
  d.left = a; d.right = b;
  return d;
}
