/* Deliverables (#/deliverables): the V1 Home list (search, status filters) + "Start a deliverable" by type
   (V1 request flow, kept as is) with links to each skill page (knowledge files, try it, Xray assistant). */
import { $, esc } from '../core/dom.js';
import { L, colon, tx } from '../core/i18n.js';
import { S, statusOf, typeOf } from '../core/store.js';
import { sq } from '../ui/badges.js';
import { iconSvg } from '../ui/icon.js';
import { listHtml } from '../ui/list.js';
import { demoNotice } from '../ui/notice.js';
import { DEMO } from '../core/api.js';
import { disclaimer } from './home.js';

const main = document.getElementById('main');

export function viewDeliverables() {
  main.innerHTML = `<div class="page">
    <div class="page-head with-action"><div><h1>${L('Deliverables')}</h1>
      <p>${L('Documents Claude writes from your notes and files, and the ones you save from a tool. Each keeps its conversation and versions.')}</p></div>
      <a class="btn primary" href="#/new">${iconSvg('file-plus')}<span>${L('New deliverable')}</span><kbd>N</kbd></a></div>
    ${DEMO ? demoNotice() : ''}
    <div><div class="toolbar"><label class="sr-only" for="q">${L('Search by title or client')}</label><input class="input" id="q" placeholder="${L('Search by title or client')}" value="${esc(S.q)}"><div class="chips" id="filters" role="group" aria-label="${L('Filter by status')}"></div></div>
      <div id="list"></div></div>
    <div><h2 class="section-title">${L('Start a deliverable')}</h2>${(S.groups.length ? S.groups : [{ id: 'all', en: '' }]).map((g) => `
      <div class="type-group">${g.en ? `<h3>${esc(S.lang === 'fr' ? g.fr : g.en)}</h3>` : ''}<div class="types compact">${S.types.filter((t) => g.id === 'all' || t.group === g.id).map((t) => `
      <div class="type"><a class="t" href="#/new/${t.id}" title="${L('You give')}${colon()}${esc(tx(t, 'gives'))}">${sq(t)}${esc(tx(t, 'name'))}</a><p>${esc(tx(t, 'gets'))}</p>
        <a class="type-more" href="#/type/${t.id}">${L('Skill page')}</a></div>`).join('')}</div></div>`).join('')}</div>
    ${disclaimer()}
  </div>`;
  const paint = () => {
    const counts = { all: S.requests.length, progress: 0, ready: 0, sent: 0 };
    S.requests.forEach((r) => { const s = statusOf(r); if (s === 'sent') counts.sent++; else if (s === 'ready') counts.ready++; else counts.progress++; });
    const F = [['all', 'All'], ['progress', 'In progress'], ['ready', 'Ready to send'], ['sent', 'Sent to client']];
    $('#filters').innerHTML = F.map(([k, l]) => `<button type="button" class="chip ${S.filter === k ? 'on' : ''}" aria-pressed="${S.filter === k}" data-f="${k}">${L(l)}<span class="n">${counts[k]}</span></button>`).join('');
    const q = S.q.toLowerCase();
    const rows = S.requests.filter((r) => {
      const s = statusOf(r);
      const okF = S.filter === 'all' || (S.filter === 'progress' ? s === 'waiting' || s === 'working' : s === S.filter);
      return okF && (!q || (r.title + ' ' + r.client + ' ' + tx(typeOf(r.type), 'name')).toLowerCase().includes(q));
    });
    $('#list').innerHTML = listHtml(rows);
  };
  paint();
  $('#filters').onclick = (e) => { const b = e.target.closest('[data-f]'); if (b) { S.filter = b.dataset.f; paint(); $(`[data-f="${S.filter}"]`).focus(); } };
  $('#q').oninput = (e) => { S.q = e.target.value; paint(); };
  return { tick: paint };
}
