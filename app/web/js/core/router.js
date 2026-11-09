/* Hash router. Routes: #/ · #/deliverables · #/new[/:type] · #/type/:id · #/d/:id · #/chat · #/profile · #/tool/:id[?sample=en:0|?ws=12].
   Each view renders into #main and may return {tick()} that the 3-second refresh calls.
   After each route, focus moves to the page heading (h1) so screen readers announce the new page. */
import { S, refresh } from './store.js';
import { viewChat } from '../views/chat.js';
import { viewDeliverable } from '../views/deliverable.js';
import { viewDeliverables } from '../views/deliverables.js';
import { viewHome } from '../views/home.js';
import { viewNew } from '../views/new.js';
import { viewProfile } from '../views/profile.js';
import { viewTool } from '../views/tool.js';
import { viewType } from '../views/type.js';

/** The current route path without '#', e.g. '/tool/api-tester'. */
export const currentPath = () => location.hash.replace(/^#/, '') || '/';
export const navigate = (hash) => { location.hash = hash; };

let seq = 0, lastPath = null;
export async function route() {
  const mine = ++seq;
  S.view = null;
  try { await refresh(); } catch (e) { console.warn(e); }
  if (mine !== seq) return;
  const r = currentPath();
  const main = document.getElementById('main');
  const samePage = lastPath === r.split('?')[0];
  const keepFocus = samePage && main.contains(document.activeElement) && document.activeElement !== main;
  lastPath = r.split('?')[0];
  let m;
  if ((m = r.match(/^\/d\/(\d+)/))) S.view = await viewDeliverable(+m[1]);
  else if (r.startsWith('/deliverables')) S.view = viewDeliverables();
  else if ((m = r.match(/^\/new(?:\/([a-z-]+))?/))) { const pre = S.preset && S.preset.type === m[1] ? S.preset : {}; S.preset = null; S.view = viewNew(m[1], pre); }
  else if ((m = r.match(/^\/type\/([a-z-]+)/))) S.view = viewType(m[1]);
  else if ((m = r.match(/^\/tool\/([a-z0-9-]+)/))) S.view = await viewTool(m[1]);
  else if (r.startsWith('/chat')) S.view = await viewChat();
  else if (r.startsWith('/profile')) S.view = viewProfile();
  else S.view = viewHome();
  if (!samePage) main.scrollTop = 0;
  if (!keepFocus && !samePage) {
    const h = main.querySelector('h1');
    const focusable = document.activeElement && main.contains(document.activeElement) && document.activeElement.matches('input,textarea,select');
    if (h && !focusable) { if (!h.hasAttribute('tabindex')) h.tabIndex = -1; h.focus({ preventScroll: true }); }
  }
}
