/* New deliverable form (#/new/:type). Also mounted by the Wave 0 tool stubs: viewNew(skill, {}, el). */
import { DEMO, post } from '../core/api.js';
import { $, esc } from '../core/dom.js';
import { L, colon, tx } from '../core/i18n.js';
import { S, exLabel, exsOf, typeOf } from '../core/store.js';
import { sq } from '../ui/badges.js';
import { ACCEPT, dropHtml, filesHtml, readFile, wireDrop } from '../ui/files.js';
import { demoNotice } from '../ui/notice.js';
import { questionsHtml } from '../ui/questions.js';
import { toast } from '../ui/toast.js';

const main = document.getElementById('main');

export function viewNew(typeId, preset = {}, root = main) {
  let type = typeId || S.types[0].id;
  let answers = { ...(preset.answers || {}) };
  let pending = [];
  root.innerHTML = `<div class="page">
    <div class="page-head">
      <h1>${L('New deliverable')}</h1><p>${L('Answer a few short questions and add your documents. Claude treats the documents as the main source and asks if something is missing.')}</p></div>
    ${DEMO ? demoNotice() : ''}
    <form class="form" id="new-form" autocomplete="off">
      <div class="field"><label>${L('What do you need?')}</label><div class="seg" id="seg"></div></div>
      <div class="expect" id="expect"></div>
      <div class="two">
        <div class="field"><label for="f-client">${L('Client or project')}</label><input class="input" id="f-client" list="client-list" placeholder="${L('e.g. Harbor Bank, card issuing')}">
          <datalist id="client-list">${S.clients.map((c) => `<option value="${esc(c)}">`).join('')}</datalist></div>
        <div class="field"><label for="f-title">${L('Title')}</label><input class="input" id="f-title" placeholder="${L('e.g. Lost card declaration')}"></div>
      </div>
      <div id="f-questions"></div>
      <div class="field"><label>${L('Documents (main source)')}</label>${dropHtml()}<div id="f-files"></div></div>
      <div class="field"><label for="f-notes">${L('Notes')} <span class="opt">${L('optional')}</span></label>
        <textarea class="textarea" id="f-notes"></textarea>
        <span class="help">${L('Anything else: meeting notes, an email thread, context the documents don\'t cover.')}</span></div>
      <div class="form-foot">
        <div class="left"><span class="ex-label">${L('Try a scenario:')}</span><div class="chips" id="f-examples"></div></div>
        <div style="display:flex;align-items:center;gap:12px"><span class="err" id="f-err"></span><button class="btn primary big" type="submit" id="f-submit">${L('Create deliverable')} <kbd>⌘↵</kbd></button></div>
      </div>
    </form></div>`;
  const readAnswers = () => root.querySelectorAll('[data-q]').forEach((el) => { answers[el.dataset.q] = el.value.trim(); });
  const paint = () => {
    const t = typeOf(type);
    const btn = (x) => `<button type="button" data-t="${x.id}" class="${x.id === type ? 'on' : ''}">${sq(x)}${esc(tx(x, 'name'))}</button>`;
    $('#seg').innerHTML = S.groups.length
      ? S.groups.map((g) => `<div class="seg-group"><span>${esc(S.lang === 'fr' ? g.fr : g.en)}</span>${S.types.filter((x) => x.group === g.id).map(btn).join('')}</div>`).join('')
      : S.types.map(btn).join('');
    $('#expect').innerHTML = `<b>${L("You'll get")}${colon().trimEnd()}</b> ${esc(tx(t, 'gets'))}.`;
    $('#f-questions').innerHTML = questionsHtml(t, answers);
    $('#f-notes').placeholder = tx(t, 'placeholder');
    $('#f-examples').innerHTML = exsOf(t).filter((e) => e.notes).map((e, i) => `<button type="button" class="chip" data-ex="${i}">${esc(exLabel(e))}</button>`).join('');
  };
  const paintFiles = () => {
    $('#f-files').innerHTML = filesHtml(pending.map((f) => ({ name: f.name, size: f.size })), null, true);
    $('#f-files').querySelectorAll('[data-rmfile]').forEach((b) => (b.onclick = () => { pending = pending.filter((f) => f.name !== b.dataset.rmfile); paintFiles(); }));
  };
  paint();
  $('#f-client').value = preset.client || S.clients[0] || '';
  $('#f-title').value = preset.title || '';
  $('#f-notes').value = preset.notes || '';
  $('#seg').onclick = (e) => { const b = e.target.closest('button'); if (b) { readAnswers(); type = b.dataset.t; answers = {}; paint(); } };
  $('#f-examples').onclick = (e) => {
    const b = e.target.closest('[data-ex]');
    if (!b) return;
    const ex = exsOf(typeOf(type))[+b.dataset.ex];
    $('#f-notes').value = ex.notes;
    if (ex.title) $('#f-title').value = ex.title;
    if (ex.client) $('#f-client').value = ex.client + (S.lang === 'fr' ? ' (exemple)' : ' (sample)');
    if (ex.answers) { answers = { ...ex.answers }; paint(); }
  };
  wireDrop($('.drop', root), (files) => {
    const bad = files.filter((f) => !ACCEPT.split(',').includes((f.name.match(/\.\w+$/) || [''])[0].toLowerCase()));
    if (bad.length) toast(L('Not supported') + ': ' + bad.map((f) => f.name).join(', '));
    pending = pending.concat(files.filter((f) => !bad.includes(f) && !pending.some((p) => p.name === f.name)));
    paintFiles();
    if (!$('#f-title').value && pending[0]) $('#f-title').value = pending[0].name.replace(/\.\w+$/, '');
  });
  const submit = async () => {
    readAnswers();
    const missing = (typeOf(type).questions || []).filter((q) => q.req && !answers[q.id]);
    root.querySelectorAll('.q.missing').forEach((el) => el.classList.remove('missing'));
    if (missing.length) {
      missing.forEach((q) => $('#q-' + q.id).closest('.q').classList.add('missing'));
      $('#f-err').textContent = L('Answer the questions marked *'); $('#q-' + missing[0].id).focus(); return;
    }
    const btn = $('#f-submit');
    btn.disabled = true; $('#f-err').textContent = pending.length ? L('Uploading documents…') : '';
    try {
      const files = await Promise.all(pending.map(readFile));
      const { id } = await post('/api/requests', { type, client: $('#f-client').value, title: $('#f-title').value, notes: $('#f-notes').value, answers, files });
      location.hash = '#/d/' + id;
    } catch (err) { $('#f-err').textContent = err.message; btn.disabled = false; }
  };
  $('#new-form').onsubmit = (e) => { e.preventDefault(); submit(); };
  $('#new-form').addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); } });
  setTimeout(() => { const first = root.querySelector('[data-q]'); (preset.notes ? $('#f-title') : first || $('#f-notes')).focus(); }, 0);
  return null;
}
