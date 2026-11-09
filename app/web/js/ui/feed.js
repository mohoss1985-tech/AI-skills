/* V1 conversation feed and composer (deliverable thread, chat page). */
import { $, esc } from '../core/dom.js';
import { initials, time } from '../core/format.js';
import { L } from '../core/i18n.js';
import { renderMarkdown } from '../core/markdown.js';
import { S } from '../core/store.js';
import { claudeMark } from './badges.js';
import { toast } from './toast.js';

export function messageHtml(m) {
  if (m.role === 'claude') return `<div class="msg">${claudeMark}<div><div class="who">Claude <time>${time(m.created_at)}</time></div><div class="body md" data-md="${m.id}"></div></div></div>`;
  return `<div class="msg user"><span class="avatar">${esc(initials(S.profile.name))}</span><div><div class="who">${esc(S.profile.name || L('You'))} <time>${time(m.created_at)}</time></div><div class="body">${esc(m.body)}</div></div></div>`;
}
export async function paintFeed(feed, msgs, emptyHtml) {
  const waiting = msgs.length && msgs[msgs.length - 1].role === 'user';
  feed.innerHTML = (msgs.length ? msgs.map(messageHtml).join('') : emptyHtml) +
    (waiting ? `<div class="typing"><i></i><i></i><i></i>${L(S.online ? 'Claude is replying…' : 'Claude will reply when you say “check my requests” in your chat')}</div>` : '');
  for (const m of msgs.filter((x) => x.role === 'claude')) await renderMarkdown(feed.querySelector(`[data-md="${m.id}"]`), m.body);
  feed.scrollTop = feed.scrollHeight;
}
export function wireComposer(root, send) {
  const ta = $('textarea', root), btn = $('[data-send]', root);
  const clear = () => { try { sessionStorage.removeItem('draft:' + location.hash); } catch {} };
  const go = async () => {
    const text = ta.value.trim();
    if (!text) { ta.focus(); return; }
    btn.disabled = true;
    try { await send(text); ta.value = ''; clear(); } catch (e) { toast(e.message); }
    btn.disabled = false; ta.focus();
  };
  btn.onclick = go;
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); go(); } });
  root.querySelectorAll('[data-quick]').forEach((b) => (b.onclick = () => {
    const q = b.dataset.quick;
    if (q.endsWith(':')) { ta.value = q + ' '; ta.focus(); } else { ta.value = q; go(); }
  }));
  try { ta.value = sessionStorage.getItem('draft:' + location.hash) || ''; } catch {}
  ta.addEventListener('input', () => { try { sessionStorage.setItem('draft:' + location.hash, ta.value); } catch {} });
}
