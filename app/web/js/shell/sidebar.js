/* Sidebar (232 px, DESIGN_SPEC §4): Home · Deliverables · Chat with Claude · Guide, then the 20 tools by group,
   profile at the foot. renderChrome() repaints it (and the top bar) after every refresh. */
import { DEMO } from '../core/api.js';
import { $, esc } from '../core/dom.js';
import { initials } from '../core/format.js';
import { L, pick } from '../core/i18n.js';
import { currentPath } from '../core/router.js';
import { S } from '../core/store.js';
import { GROUPS, GROUP_LABEL, TOOLS } from '../tools/registry.js';
import { iconSvg } from '../ui/icon.js';
import { renderTopbar } from './topbar.js';

const item = (nav, href, icon, label, extra = '') =>
  `<a class="nav-item" href="${href}" data-nav="${nav}">${iconSvg(icon)}<span class="label">${esc(label)}</span>${extra}</a>`;

export function renderChrome() {
  const newCount = S.requests.filter((r) => r.unseen || r.unread).length;
  const nav = $('#nav');
  nav.innerHTML = `<div class="nav-block">
      ${item('home', '#/', 'house', L('Home'))}
      ${item('deliverables', '#/deliverables', 'files', L('Deliverables'), newCount ? `<span class="count" aria-label="${newCount} ${L('new')}">${newCount}</span>` : '')}
      ${item('chat', '#/chat', 'message-circle', L('Chat with Claude'), S.chatUnread ? `<span class="badge-count" aria-label="${S.chatUnread} ${L('unread')}">${S.chatUnread}</span>` : '')}
      <button type="button" class="nav-item" id="guide-btn" aria-expanded="false">${iconSvg('circle-help')}<span class="label">${esc(L('Guide'))}</span><kbd>?</kbd></button>
    </div>
    <div class="nav-section">${esc(L('Tools'))}</div>
    ${GROUPS.map((g) => `<div class="nav-group" role="group" aria-label="${esc(L(GROUP_LABEL[g]))}"><div class="nav-group-label">${esc(L(GROUP_LABEL[g]))}</div>
      ${TOOLS.filter((t) => t.group === g).map((t) => item('tool-' + t.id, '#/tool/' + t.id, t.icon, pick(t.title))).join('')}</div>`).join('')}`;
  document.querySelectorAll('[data-i18n]').forEach((el) => (el.textContent = L(el.dataset.i18n)));
  document.documentElement.lang = S.lang;
  const total = newCount + S.chatUnread;
  document.title = (total ? `(${total}) ` : '') + 'Analyst Kit';
  $('#me-name').textContent = DEMO ? L('Guest') : S.profile.name || L('Set up your profile');
  $('#me-sub').textContent = DEMO ? L('Read-only demo') : [S.profile.title, S.profile.company].filter(Boolean).join(' · ') || L('Profile');
  $('#me-avatar').textContent = initials(S.profile.name);
  const r = currentPath();
  const sel = r === '/' ? 'home' : r.startsWith('/chat') ? 'chat' : r.startsWith('/profile') ? 'profile'
    : r.startsWith('/deliverables') || r.startsWith('/d/') || r.startsWith('/new') || r.startsWith('/type') ? 'deliverables'
    : (r.match(/^\/tool\/([a-z0-9-]+)/) || [])[1] ? 'tool-' + r.match(/^\/tool\/([a-z0-9-]+)/)[1] : '';
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === sel;
    a.classList.toggle('on', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  renderTopbar();
}

/** Kept for main.js (V1 name): the theme and language controls now live in the top bar. */
export function wireSidebar() {}
