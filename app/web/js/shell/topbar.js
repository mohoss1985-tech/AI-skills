/* Top bar (44 px, DESIGN_SPEC §4): mobile menu · crumb · ⌘K search · Claude online dot · theme · EN/FR.
   topbar({crumb}) is the Wave 0 helper (returns a crumb element); renderTopbar() paints #topbar from the route.
   setCrumb([{label, href}]) lets a view override the computed crumb (deliverable title, tool name). */
import { DEMO } from '../core/api.js';
import { $, esc, isDark } from '../core/dom.js';
import { L, getLang, pick, setLang } from '../core/i18n.js';
import { initMermaid } from '../core/markdown.js';
import { currentPath, route } from '../core/router.js';
import { S } from '../core/store.js';
import { GROUP_LABEL, toolMeta } from '../tools/registry.js';
import { kbdLabel } from '../ui/button.js';
import { iconSvg } from '../ui/icon.js';
import { openPalette } from './palette.js';

export function topbar({ crumb = [] } = {}) {
  const c = document.createElement('nav');
  c.className = 'crumb';
  c.setAttribute('aria-label', L('Breadcrumb'));
  c.innerHTML = crumbHtml(crumb);
  return c;
}
const crumbHtml = (parts) => parts.map((p, i) => {
  const last = i === parts.length - 1;
  const inner = p.href && !last ? `<a href="${esc(p.href)}">${esc(p.label)}</a>` : `<span${last ? ' aria-current="page"' : ''}>${esc(p.label)}</span>`;
  return (i ? '<span class="sep" aria-hidden="true">/</span>' : '') + inner;
}).join('');

let override = null, overridePath = '';
export function setCrumb(parts) { override = parts; overridePath = currentPath(); paintCrumb(); }

function computeCrumb() {
  const r = currentPath();
  const home = { label: L('Home'), href: '#/' };
  const dels = { label: L('Deliverables'), href: '#/deliverables' };
  let m;
  if (r === '/') return [home];
  if ((m = r.match(/^\/tool\/([a-z0-9-]+)/))) { const t = toolMeta(m[1]); return [home, { label: L(GROUP_LABEL[t ? t.group : ''] || 'Tools') }, { label: t ? pick(t.title) : L('Not found') }]; }
  if (r.startsWith('/deliverables')) return [home, dels];
  if ((m = r.match(/^\/d\/(\d+)/))) { const d = S.requests.find((x) => x.id === +m[1]); return [home, dels, { label: d ? d.title : '#' + m[1] }]; }
  if (r.startsWith('/new')) return [home, dels, { label: L('New deliverable') }];
  if ((m = r.match(/^\/type\/([a-z-]+)/))) { const t = S.types.find((x) => x.id === m[1]); return [home, dels, { label: t ? (getLang() === 'fr' && t.fr && t.fr.name) || t.name : m[1] }]; }
  if (r.startsWith('/chat')) return [home, { label: L('Chat with Claude') }];
  if (r.startsWith('/profile')) return [home, { label: L('Profile') }];
  return [home];
}
function paintCrumb() {
  const c = $('#topbar .crumb');
  if (!c) return;
  c.innerHTML = crumbHtml(override && overridePath === currentPath() ? override : computeCrumb());
}

let wired = false;
export function renderTopbar() {
  const bar = $('#topbar');
  if (!bar) return;
  if (!wired) {
    wired = true;
    bar.innerHTML = `<button type="button" class="btn ghost sm icon-only menu-btn" id="menu-btn" aria-controls="sidebar" aria-expanded="false">${iconSvg('menu')}</button>
      <nav class="crumb" aria-label="Breadcrumb"></nav><span class="spacer"></span>
      <button type="button" class="search-btn" id="search-btn">${iconSvg('search')}<span class="search-label"></span><kbd>${esc(kbdLabel('mod+k'))}</kbd></button>
      <span class="presence" id="presence"><span class="dot" aria-hidden="true"></span><span id="presence-label"></span></span>
      <button type="button" class="btn ghost sm icon-only" id="theme-btn"></button>
      <button type="button" class="btn ghost sm lang-btn" id="lang-btn"></button>`;
    $('#search-btn').onclick = () => openPalette();
    $('#theme-btn').onclick = toggleTheme;
    $('#lang-btn').onclick = toggleLang;
    $('#menu-btn').onclick = () => {
      const open = !document.body.classList.contains('nav-open');
      document.body.classList.toggle('nav-open', open);
      $('#menu-btn').setAttribute('aria-expanded', String(open));
    };
  }
  $('#menu-btn').setAttribute('aria-label', L('Menu'));
  $('#topbar .crumb').setAttribute('aria-label', L('Breadcrumb'));
  $('#search-btn .search-label').textContent = L('Search tools, samples, actions');
  $('#search-btn').setAttribute('aria-label', L('Search tools, samples, actions'));
  const dark = isDark();
  const tb = $('#theme-btn');
  tb.innerHTML = iconSvg(dark ? 'sun' : 'moon');
  tb.title = L(dark ? 'Switch to light theme' : 'Switch to dark theme'); tb.setAttribute('aria-label', tb.title);
  const lb = $('#lang-btn');
  lb.textContent = getLang() === 'fr' ? 'EN' : 'FR';
  lb.title = getLang() === 'fr' ? 'Switch to English' : 'Passer en français';
  lb.setAttribute('aria-label', lb.title);
  lb.lang = getLang() === 'fr' ? 'en' : 'fr';
  const p = $('#presence');
  p.className = 'presence' + (S.online ? ' on' : '') + (DEMO ? ' demo' : '');
  $('#presence-label').textContent = DEMO ? L('Read-only demo') : L(S.online ? 'Claude is online' : 'Claude is offline');
  p.title = DEMO ? L('Tools work in the browser; deliverables and chat are read-only.') : L(S.online ? 'Requests and messages are picked up automatically' : 'Type "check my requests" in your Claude chat');
  paintCrumb();
}

export function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem('kit-theme', next); } catch {}
  initMermaid();
  renderTopbar();
  if (/^\/(d\/|chat|type\/|$)/.test(currentPath()) || currentPath() === '/') route();
}
export function toggleLang() {
  setLang(getLang() === 'fr' ? 'en' : 'fr');
}
