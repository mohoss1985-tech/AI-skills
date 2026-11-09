/* Entry point (ES module). No globals: the Guide, sidebar and top bar import what they need. */
import { DEMO, net } from './core/api.js';
import { $ } from './core/dom.js';
import { L, onLangChange } from './core/i18n.js';
import { ensureMarkdown } from './core/markdown.js';
import { currentPath, route } from './core/router.js';
import { S, onRefresh, refresh } from './core/store.js';
import { KitChat, mountGuide } from './guide/help.js';
import { openPalette } from './shell/palette.js';
import { renderChrome } from './shell/sidebar.js';

const main = $('#main');

onRefresh(renderChrome);
// Server offline banner (research/07 §2): the poll used to swallow every error.
net.listeners.push((online) => {
  const b = $('#offline');
  b.hidden = online;
  if (!online) b.textContent = L('The local server is not answering. Start it with python3 app/server/server.py, then this page reconnects by itself.');
});
if (!DEMO) setInterval(async () => {
  try { await refresh(); if (S.view && S.view.tick) await S.view.tick(); } catch (e) { if (e.code !== 'net.offline') console.warn(e); }
}, 3000);

addEventListener('hashchange', () => { document.body.classList.remove('nav-open'); route(); });
onLangChange(() => { route(); KitChat.relang(); });
main.addEventListener('click', (e) => { const c = e.target.closest('[data-href]'); if (c) location.hash = c.dataset.href; });
document.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); openPalette(); return; }
  if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || document.activeElement.isContentEditable || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'n' && !currentPath().startsWith('/tool/')) { e.preventDefault(); location.hash = '#/new'; }
  if (e.key === '/') { const q = $('#q') || $('#ask-input'); if (q) { e.preventDefault(); q.focus(); } else { e.preventDefault(); openPalette(); } }
});
mountGuide();
ensureMarkdown().catch(() => {}).finally(() => route());
