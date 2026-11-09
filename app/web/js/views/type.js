/* Skill page (#/type/:id): try it, knowledge files, Xray assistant, deliverables of that type. */
import { api } from '../core/api.js';
import { $, esc } from '../core/dom.js';
import { lower1 } from '../core/format.js';
import { L, colon, tx } from '../core/i18n.js';
import { route } from '../core/router.js';
import { S, exLabel, exsOf, typeOf } from '../core/store.js';
import { dropHtml, filesHtml, upload, wireDrop } from '../ui/files.js';
import { listHtml } from '../ui/list.js';
import { toast } from '../ui/toast.js';
import { KitChat } from '../guide/help.js';
import { toolForSkill } from '../tools/registry.js';
import { iconSvg } from '../ui/icon.js';

const main = document.getElementById('main');

export function viewType(id) {
  const t = typeOf(id);
  const reqs = S.requests.filter((r) => r.type === id);
  const scope = 'skill-' + id;
  main.innerHTML = `<div class="page">
    <div class="page-head">
      <h1>${esc(tx(t, 'name'))}</h1><p>${L('You give')}${colon()}${esc(lower1(tx(t, 'gives')))}. ${L('You get')}${colon()}${esc(lower1(tx(t, 'gets')))}.</p></div>
    <div class="type-actions">${toolForSkill(id) ? `<a class="btn primary" href="#/tool/${toolForSkill(id).id}">${iconSvg(toolForSkill(id).icon)}<span>${L('Open the tool')}</span></a>` : ''}<a class="btn${toolForSkill(id) ? '' : ' primary'}" href="#/new/${id}">${iconSvg('file-plus')}<span>${L('New deliverable')}</span></a></div>
    ${tryHtml(t)}
    <div><h2 class="section-title">${L('Knowledge for this skill')}</h2>
      <div class="box"><div class="inner"><p class="help">${L('Documents used for every deliverable of this type: scheme rules, internal procedures, templates, glossaries. Upload once, Claude reads them every time.')}</p>
        <div id="kn-list"></div>${dropHtml(L('Scheme rules, procedures, templates: PDF, Word, Excel, PowerPoint or images.'))}</div></div></div>
    ${id === 'managing-xray-tests' ? `<div><h2 class="section-title">${L('Xray assistant')}</h2><div id="xray-chat"></div></div>` : ''}
    <div><h2 class="section-title">${L('Your deliverables')} <span class="count">${reqs.length}</span></h2><div id="list">${listHtml(reqs)}</div></div>
  </div>`;
  wireTry(main, t);
  const paintKn = async () => {
    const { files } = await api('/api/files?scope=' + scope);
    $('#kn-list').innerHTML = filesHtml(files, scope, true) || `<div class="empty-note">${L('No documents yet.')}</div>`;
    $('#kn-list').querySelectorAll('[data-rmfile]').forEach((b) => (b.onclick = async () => {
      await api(`/api/files?scope=${scope}&name=${encodeURIComponent(b.dataset.rmfile)}`, { method: 'DELETE' }); paintKn();
    }));
  };
  paintKn();
  wireDrop($('.drop', main), async (files) => {
    try { await upload(scope, files); toast(L('Added to the skill knowledge')); paintKn(); } catch (e) { toast(e.message); }
  });
  if ($('#xray-chat')) KitChat.mountXray($('#xray-chat'));
  return { tick: () => { $('#list').innerHTML = listHtml(S.requests.filter((r) => r.type === id)); } };
}

// Ready-made scenarios: open the finished sample, or start a new deliverable from realistic notes.
// English scenarios follow Visa rules, French ones CB rules.
export function tryHtml(t) {
  const samples = S.requests.filter((r) => r.is_sample && r.type === t.id).sort((a, b) => a.id - b.id);
  const ex = exsOf(t).filter((e) => e.notes);
  if (!samples.length && !ex.length) return '';
  return `<div><h2 class="section-title">${L('Try it')}</h2><div class="try">
    ${samples.map((s) => `<a class="try-card sample" href="#/d/${s.id}"><span class="tag">${L('Finished sample')}</span><b>${esc(s.title)}</b><span>${esc(s.client)}</span></a>`).join('')}
    ${ex.map((e, i) => `<button type="button" class="try-card" data-ex="${i}"><span class="tag">${L('Scenario')}</span><b>${esc(exLabel(e))}</b><span>${esc(e.notes.slice(0, 110))}…</span></button>`).join('')}
  </div></div>`;
}
export function wireTry(root, t) {
  root.querySelectorAll('[data-ex]').forEach((b) => (b.onclick = () => startExample(t.id, +b.dataset.ex)));
}
export function startExample(typeId, i) {
  const e = exsOf(typeOf(typeId))[i];
  if (!e) return;
  S.preset = { type: typeId, title: e.title, client: e.client, notes: e.notes, answers: e.answers };
  if (location.hash === '#/new/' + typeId) route(); else location.hash = '#/new/' + typeId;
}
