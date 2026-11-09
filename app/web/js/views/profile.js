/* Your profile (#/profile): name, company, preferences and what Claude learned. */
import { post } from '../core/api.js';
import { $, esc } from '../core/dom.js';
import { L } from '../core/i18n.js';
import { S, refresh } from '../core/store.js';
import { toast } from '../ui/toast.js';

const main = document.getElementById('main');

export function viewProfile() {
  const p = S.profile;
  let learned = [...S.learned];
  const opt = (list, v) => list.map((x) => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  main.innerHTML = `<div class="page">
    <div class="page-head">
      <h1>${L('Your profile')}</h1><p>${L('Claude reads this before writing anything for you. Your name and company appear on every document.')}</p></div>
    <form class="form" id="pf">
      <div class="two">
        <div class="field"><label for="p-name">${L('Your name')}</label><input class="input" id="p-name" value="${esc(p.name)}" placeholder="e.g. Sam Rivera"></div>
        <div class="field"><label for="p-title">${L('Your title')}</label><input class="input" id="p-title" value="${esc(p.title)}" placeholder="e.g. Senior Product Owner"></div>
      </div>
      <div class="two">
        <div class="field"><label for="p-company">${L('Company or brand')}</label><input class="input" id="p-company" value="${esc(p.company)}" placeholder="e.g. Rivera Product Consulting"><span class="help">${L('Shown as “Prepared by …” on documents.')}</span></div>
        <div class="field"><label for="p-tool">${L('Backlog tool your clients use')}</label><select class="input" id="p-tool">${opt(['Jira', 'Linear', 'Azure DevOps', 'Trello', 'Other'], p.tool)}</select></div>
      </div>
      <div class="two">
        <div class="field"><label for="p-language">${L('Document language')}</label><select class="input" id="p-language">${opt(['English', 'French', 'Arabic', 'Spanish', 'German', 'Dutch'], p.language)}</select></div>
        <div class="field"><label for="p-tone">${L('Writing style')}</label><select class="input" id="p-tone">${opt(['Clear and concise', 'Formal for executives', 'Detailed for developers', 'Friendly'], p.tone)}</select></div>
      </div>
      <div class="field"><label>${L('What Claude has learned about how you work')}</label>
        <span class="help">${L("Claude adds notes here from your feedback, so you don't repeat yourself. Remove anything that's wrong.")}</span>
        <div class="learned" id="learned"></div></div>
      <div class="form-foot"><span></span><button class="btn primary big" type="submit">${L('Save profile')}</button></div>
    </form></div>`;
  const paintLearned = () => {
    $('#learned').innerHTML = learned.length
      ? `<ul>${learned.map((l, i) => `<li><span>${esc(l)}</span><button type="button" class="btn ghost" data-rm="${i}">${L('Remove')}</button></li>`).join('')}</ul>`
      : `<div class="expect">${L('Nothing yet. As you give feedback in conversations, Claude notes your preferences here.')}</div>`;
    $('#learned').querySelectorAll('[data-rm]').forEach((b) => (b.onclick = () => { learned.splice(+b.dataset.rm, 1); paintLearned(); }));
  };
  paintLearned();
  $('#pf').onsubmit = async (e) => {
    e.preventDefault();
    const v = (k) => $('#p-' + k).value;
    try {
      await post('/api/profile', { name: v('name'), title: v('title'), company: v('company'), tool: v('tool'), language: v('language'), tone: v('tone'), learned });
      await refresh(); toast(L('Profile saved'));
    } catch (err) { toast(err.message); }
  };
  return null;
}
