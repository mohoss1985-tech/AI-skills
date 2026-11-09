/* Deliverable (#/d/:id): the document, exports, versions, sources, next steps and the conversation. */
import { DEMO, api, post } from '../core/api.js';
import { $, esc } from '../core/dom.js';
import { date, time } from '../core/format.js';
import { L, colon, tx } from '../core/i18n.js';
import { copyRich, downloadWord } from '../core/exports.js';
import { renderMarkdown } from '../core/markdown.js';
import { S, prepared, statusOf, typeOf } from '../core/store.js';
import { pill, sq } from '../ui/badges.js';
import { paintFeed, wireComposer } from '../ui/feed.js';
import { dropHtml, filesHtml, upload, wireDrop } from '../ui/files.js';
import { answersHtml } from '../ui/questions.js';
import { toast } from '../ui/toast.js';
import { iconSvg } from '../ui/icon.js';
import { setCrumb } from '../shell/topbar.js';

const main = document.getElementById('main');

export async function viewDeliverable(id) {
  let r;
  try { r = await api('/api/requests/' + id); } catch { main.innerHTML = `<div class="page"><div class="page-head"><h1>${L('Not found')}</h1><p><a href="#/">${L('Back home')}</a></p></div></div>`; return null; }
  const t = typeOf(r.type);
  let shownVersion = null;
  setCrumb([{ label: L('Home'), href: '#/' }, { label: L('Deliverables'), href: '#/deliverables' }, { label: r.title }]);
  main.innerHTML = `<div class="page wide">
    <div class="split">
      <div class="left">
        <div id="actions"></div>
        <article class="paper"><header class="paper-head">
          <a class="kind" href="#/type/${t.id}">${sq(t)}${esc(tx(t, 'name'))}</a><h1>${esc(r.title)}</h1>
          <span class="meta">${r.client ? esc(r.client) + ' · ' : ''}<span id="doc-date">${date(r.updated_at)}</span></span>
          ${prepared() ? `<span class="prepared">${prepared()}</span>` : ''}
        </header><div id="doc"></div></article>
        <div id="next"></div>
        <div class="box"><div class="inner sources">
          <h3>${L('Documents for this deliverable')}</h3><div id="src-list"></div>
          ${dropHtml(L('Add evidence or a newer version: Claude uses it when you ask for changes.'))}
          <div id="kn-mini"></div></div></div>
        <details class="box"><summary>${L('Your original notes')}</summary><div class="inner">${answersHtml(t, r.answers)}<div class="notes">${esc(r.notes)}</div></div></details>
        ${DEMO ? '' : `<div><button class="btn ghost" id="a-del">${L('Delete this deliverable')}</button></div>`}
      </div>
      <aside class="panel" id="panel">
        <div class="panel-head"><h2>${L('Conversation')}</h2><span>${L('⌘↵ to send')}</span></div>
        <div class="feed" id="feed"></div>
        <div class="composer" id="composer">
          <div class="quick" id="quick"></div>
          <textarea placeholder="${L('Ask a question, give feedback, or request changes…')}"></textarea>
          <div class="row"><span class="hint">${L('Claude updates the document when you ask for changes.')}</span><button class="btn primary" data-send>${L('Send')}</button></div>
        </div>
      </aside>
    </div></div>`;

  const paintSources = () => {
    $('#src-list').innerHTML = filesHtml(r.sources || [], 'req-' + r.id, false) || `<div class="empty-note">${L('No documents yet.')}</div>`;
    $('#kn-mini').innerHTML = (r.knowledge || []).length ? `<p class="help">${L('Also read from the skill knowledge')}${colon().trimEnd()}</p>${filesHtml(r.knowledge, 'skill-' + r.type, false)}` : '';
  };
  paintSources();
  wireDrop($('.sources .drop', main), async (files) => {
    try {
      const { saved } = await upload('req-' + r.id, files);
      r = await api('/api/requests/' + id); paintSources();
      const ta = $('#composer textarea');
      ta.value = (S.lang === 'fr' ? `J'ai ajouté ${saved.join(', ')}. Utilise-le comme source principale et mets à jour le document.` : `I added ${saved.join(', ')}. Use it as the main source and update the document.`);
      ta.focus(); toast(L('Document added. Send the message to update the deliverable'));
    } catch (e) { toast(e.message); }
  });
  const paintActions = () => {
    const ready = r.status === 'ready';
    const vers = r.versions.length;
    $('#actions').innerHTML = ready ? `<div class="doc-actions">
        <button class="btn primary" id="a-word">${iconSvg('file-down')}<span>${L('Download Word')}</span></button>
        <button class="btn" id="a-pdf">${iconSvg('printer')}<span>${L('Save as PDF')}</span></button>
        <button class="btn" id="a-copy">${iconSvg('copy')}<span>${L('Copy')}</span></button>
        ${r.workspace ? `<a class="btn" href="#/tool/${esc(r.workspace.tool)}?ws=${r.workspace.id}">${iconSvg('wrench')}<span>${L('Open in tool')}</span></a>` : ''}
        ${DEMO ? '' : `<button class="btn" id="a-sent">${L(r.sent_at ? '✓ Sent to client' : 'Mark as sent')}</button>`}
        <span class="spacer"></span>
        ${vers ? `<span class="verbar">${L('Version')} <select id="ver">${r.versions.map((v, i) => `<option value="${v.id}">${i + 1} · ${time(v.created_at)}</option>`).join('')}<option value="" selected>${vers + 1} · ${L('latest')}</option></select></span>` : ''}
        ${pill(statusOf(r))}</div>` : '';
    if (!ready) return;
    $('#a-pdf').onclick = () => window.print();
    $('#a-word').onclick = () => downloadWord(r, t, shownVersion);
    $('#a-copy').onclick = () => copyRich(r, shownVersion);
    if (!DEMO) $('#a-sent').onclick = async () => { await post(`/api/requests/${r.id}/sent`, { sent: !r.sent_at }); r.sent_at = r.sent_at ? null : Date.now() / 1000; paintActions(); toast(L(r.sent_at ? 'Marked as sent to client' : 'Marked as not sent')); };
    const ver = $('#ver');
    if (ver) ver.onchange = async () => {
      shownVersion = ver.value ? (await api('/api/versions/' + ver.value)).output : null;
      paintDoc();
    };
  };
  const paintDoc = async () => {
    const doc = $('#doc');
    if (r.status !== 'ready') {
      doc.innerHTML = `<div class="working"><div class="spinner"></div>
        <h2>${L(r.status === 'working' ? 'Claude is writing this now' : 'Waiting for Claude')}</h2>
        <p>${L(S.online ? 'Claude has it and will start in a moment. You can add context in the conversation while you wait.' : 'Type <b>“check my requests”</b> in your Claude chat. This page updates by itself.')}</p></div>`;
      return;
    }
    doc.innerHTML = (shownVersion ? `<div class="old-note">${L("You're viewing an earlier version. Downloads use this version. Pick “latest” to go back.")}</div>` : '') + '<div class="md" id="out"></div>';
    await renderMarkdown($('#out'), shownVersion || r.output);
  };
  const paintNext = () => {
    const nx = (t.next || []).map(typeOf);
    $('#next').innerHTML = r.status === 'ready' && nx.length ? `<div class="next"><h2 class="section-title">${L('Continue from this document')}</h2>
      <div class="chips">${nx.map((n) => `<button class="chip" data-next="${n.id}">${sq(n)}${L('Create')} ${esc(tx(n, 'name'))}</button>`).join('')}</div></div>` : '';
    $('#next').querySelectorAll('[data-next]').forEach((b) => (b.onclick = () => {
      S.preset = { type: b.dataset.next, client: r.client, title: r.title, notes: `Based on the ${t.name} “${r.title}”:\n\n${r.output}` };
      location.hash = '#/new/' + b.dataset.next;
    }));
  };
  const QUICK = r.status === 'ready'
    ? ['Make it shorter', 'Add more detail', 'Make it more formal for the client', S.lang === 'fr' ? 'Translate to English' : 'Translate to French', 'What questions should I ask the client?']
    : ['Here is more context:', 'Make it a one-pager'];
  $('#quick').innerHTML = QUICK.map((q) => `<button data-quick="${esc(L(q))}">${esc(L(q))}</button>`).join('');
  const feed = $('#feed');
  const empty = `<div class="feed-empty"><b>${L('Talk to Claude about this document')}</b><span>${L('Ask why something is there, give feedback, or request changes. Claude answers here and updates the document.')}</span></div>`;
  paintActions(); paintNext(); await paintDoc(); await paintFeed(feed, r.messages, empty);
  wireComposer($('#composer'), async (text) => {
    await post(`/api/requests/${r.id}/messages`, { body: text });
    r = await api('/api/requests/' + id); await paintFeed(feed, r.messages, empty);
  });
  const del = $('#a-del');
  if (del) del.onclick = async () => {
    if (!del.dataset.armed) { del.dataset.armed = 1; del.textContent = L('Click again to delete'); return; }
    await api('/api/requests/' + r.id, { method: 'DELETE' }); toast(L('Deleted')); location.hash = '#/deliverables';
  };

  return {
    tick: async () => {
      const fresh = await api('/api/requests/' + id);
      const docChanged = fresh.updated_at !== r.updated_at || fresh.status !== r.status;
      const msgsChanged = fresh.messages.length !== r.messages.length;
      r = fresh;
      if (docChanged) {
        shownVersion = null; paintActions(); paintNext(); await paintDoc(); $('#doc-date').textContent = date(r.updated_at);
        if (r.status === 'ready') toast(L(r.versions.length ? 'Document updated' : 'Your document is ready'));
      }
      if (msgsChanged || docChanged) await paintFeed(feed, r.messages, empty);
    },
  };
}
