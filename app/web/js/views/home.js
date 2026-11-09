/* Home (DESIGN_SPEC §4): three demo cards first, then all 20 tools by group, ask Claude, recent deliverables,
   disclaimer. Cards are real links (keyboard reachable), not div[data-href]. */
import { DEMO, post } from '../core/api.js';
import { $, esc, html, raw } from '../core/dom.js';
import { greeting } from '../core/format.js';
import { L, pick, tx } from '../core/i18n.js';
import { S } from '../core/store.js';
import { DEMOS, GROUPS, GROUP_LABEL, TOOLS } from '../tools/registry.js';
import { iconSvg } from '../ui/icon.js';
import { listHtml } from '../ui/list.js';
import { demoNotice } from '../ui/notice.js';
import { toast } from '../ui/toast.js';

const main = document.getElementById('main');
const gets = (skill) => { const t = S.types.find((x) => x.id === skill); return t ? tx(t, 'gets') : ''; };

export function viewHome() {
  const p = S.profile;
  const recent = S.requests.slice().sort((a, b) => b.updated_at - a.updated_at).slice(0, 5);
  main.innerHTML = String(html`<div class="page page-tools">
    <div class="page-head hello"><div>
      <h1>${p.name ? `${greeting()}, ${p.name.split(' ')[0]}` : L('Working tools for payments BAs & POs')}</h1>
      <p>${L('Each tool does the job in 3–4 inputs and about 60 seconds. Claude drafts, critiques and explains on top.')}</p></div></div>
    ${DEMO ? raw(demoNotice()) : ''}
    ${!p.name && !DEMO ? html`<div class="notice"><p>${L('Add your name and company so every document says “Prepared by you”, and tell Claude how you like to work.')}</p><a class="btn sm" href="#/profile">${L('Set up profile')}</a></div>` : ''}
    <section aria-labelledby="h-demos"><h2 class="section-title" id="h-demos">${L('Try a demo in 60 seconds')}</h2>
      <div class="demo-cards">${DEMOS.map((d, i) => html`<a class="demo-card" href="${`#/tool/${d.tool}?sample=${S.lang}`}">
        <span class="demo-step">${raw(iconSvg(d.icon))}<span>${L('Demo')} ${i + 1}</span></span>
        <b>${pick(d.title)}</b><span class="demo-text">${pick(d.text)}</span>
        <span class="demo-go">${L('Open with sample')} ${raw(iconSvg('arrow-right', 14))}</span></a>`)}</div></section>
    <section aria-labelledby="h-tools"><h2 class="section-title" id="h-tools">${L('All tools')} <span class="count">${TOOLS.length}</span></h2>
      ${GROUPS.map((g) => html`<div class="tool-group"><h3>${L(GROUP_LABEL[g])}</h3><div class="tool-cards">
        ${TOOLS.filter((t) => t.group === g).map((t) => html`<a class="tool-card" href="${'#/tool/' + t.id}">${raw(iconSvg(t.icon))}<span class="tc-text"><b>${pick(t.title)}</b><span>${t.desc ? pick(t.desc) : gets(t.skill)}</span></span></a>`)}
      </div></div>`)}</section>
    <form class="ask" id="ask" ${DEMO ? 'hidden' : ''}>${raw(iconSvg('sparkles'))}<label class="sr-only" for="ask-input">${L('Ask Claude')}</label><input id="ask-input" placeholder="${L('Ask Claude anything: prepare a workshop, review a doc, draft a client email…')}" autocomplete="off"><button class="btn primary sm" type="submit">${L('Ask')}</button></form>
    <section aria-labelledby="h-recent"><h2 class="section-title" id="h-recent">${L('Recent deliverables')} <a class="section-link" href="#/deliverables">${L('See all')} ${raw(iconSvg('arrow-right', 14))}</a></h2>
      <div id="list">${raw(listHtml(recent))}</div></section>
    ${raw(disclaimer())}
  </div>`);
  $('#ask').onsubmit = async (e) => {
    e.preventDefault();
    const text = $('#ask-input').value.trim();
    if (!text) { $('#ask-input').focus(); return; }
    try { await post('/api/chat', { body: text }); location.hash = '#/chat'; } catch (err) { toast(err.message, { tone: 'bad' }); }
  };
  return { tick: () => { const l = $('#list'); if (l) l.innerHTML = listHtml(S.requests.slice().sort((a, b) => b.updated_at - a.updated_at).slice(0, 5)); } };
}

/** Disclaimer (DESIGN_SPEC §5), on Home and in the page footers. */
export const disclaimer = () => `<footer class="site-foot"><p>${esc(L('Fictional data. Not affiliated with Visa or GIE CB. No real card data.'))}</p>
  <p>${esc(L('Analyst Kit V2 · code MIT · samples and docs CC BY 4.0'))}</p></footer>`;
