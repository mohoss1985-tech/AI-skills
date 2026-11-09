/* V1 deliverable list (Home, skill pages). */
import { esc } from '../core/dom.js';
import { ago } from '../core/format.js';
import { L, tx } from '../core/i18n.js';
import { statusOf, typeOf } from '../core/store.js';
import { pill, sq } from './badges.js';

export function listHtml(reqs) {
  if (!reqs.length) return `<div class="list"><div class="empty-note">${L('Nothing here.')}</div></div>`;
  return `<div class="list">${reqs.map((r) => {
    const t = typeOf(r.type);
    const flag = r.unseen || r.unread ? `<span class="newdot" title="${L('New')}"></span>` : '';
    const reply = r.awaiting_reply ? `<span class="pill waiting"><i></i>${L('Claude is replying')}</span>` : '';
    return `<a class="item" href="#/d/${r.id}">${sq(t)}
      <span style="min-width:0"><div class="name">${esc(r.title)}</div><div class="sub">${esc(tx(t, 'name'))}${r.client ? ' · ' + esc(r.client) : ''}</div></span>
      <span class="flags">${flag}${reply || pill(statusOf(r))}</span><span class="when">${ago(r.updated_at)}</span></a>`;
  }).join('')}</div>`;
}
