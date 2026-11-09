/* Chat with Claude (#/chat): the general thread. */
import { api, post } from '../core/api.js';
import { $, esc } from '../core/dom.js';
import { L } from '../core/i18n.js';
import { paintFeed, wireComposer } from '../ui/feed.js';

const main = document.getElementById('main');

export async function viewChat() {
  main.innerHTML = `<div class="chatpage">
    <div class="head"><h1>${L('Chat with Claude')}</h1><p>${L("Anything that isn't a deliverable: prep a workshop, review a document, plan your week, draft a client email.")}</p></div>
    <div class="feed" id="feed"></div>
    <div class="composer" id="composer">
      <textarea placeholder="${L('Message Claude…')}"></textarea>
      <div class="row"><span class="hint">${L('⌘↵ to send')}</span><button class="btn primary" data-send>${L('Send')}</button></div>
    </div></div>`;
  const SUG = [
    ['Prepare a client workshop', 'Agenda, questions and exercises for a 90-minute discovery workshop'],
    ['Draft a cover email', 'A short email sending the latest deliverable to my client'],
    ['Review my document', "I'll paste a PRD or story. Tell me what's weak"],
    ['Prepare me for an interview', 'Mock product owner interview questions with strong answers'],
  ].map(([a, b]) => [L(a), L(b)]);
  const empty = `<div class="feed-empty"><b>${L('Start with one of these, or write your own.')}</b><div class="suggest">${SUG.map(([a, b]) => `<button data-s="${esc(a + ': ' + b)}"><b>${esc(a)}</b>${esc(b)}</button>`).join('')}</div></div>`;
  const feed = $('#feed');
  let msgs = (await api('/api/chat')).messages;
  await paintFeed(feed, msgs, empty);
  const send = async (text) => { await post('/api/chat', { body: text }); msgs = (await api('/api/chat')).messages; await paintFeed(feed, msgs, empty); };
  wireComposer($('#composer'), send);
  feed.addEventListener('click', (e) => { const b = e.target.closest('[data-s]'); if (b) { const ta = $('#composer textarea'); ta.value = b.dataset.s; ta.focus(); } });
  $('#composer textarea').focus();
  return {
    tick: async () => {
      const fresh = (await api('/api/chat')).messages;
      if (fresh.length !== msgs.length) { msgs = fresh; await paintFeed(feed, msgs, empty); }
      else if (msgs.length && msgs[msgs.length - 1].role === 'user') await paintFeed(feed, msgs, empty);
    },
  };
}
