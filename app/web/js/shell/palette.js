/* Command palette (⌘K / Ctrl+K, research/04 §2.9): groups Tools · Samples · Pages · Actions · Deliverables,
   fuzzy match on EN + FR labels and keywords, ↑/↓ loop, Enter runs, Esc closes and returns focus. */
import { esc } from '../core/dom.js';
import { L, pick } from '../core/i18n.js';
import { S } from '../core/store.js';
import { DEMOS, GROUP_LABEL, TOOLS } from '../tools/registry.js';
import { iconSvg } from '../ui/icon.js';
import { toggleGuide } from '../guide/help.js';

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const KEYWORDS = {
  'api-tester': 'api rest http request postman curl requete', 'sql-runner': 'sql query requete database base decline refus',
  'bpmn-editor': 'bpmn process processus diagram diagramme', 'payment-lifecycle': 'chargeback impaye rejeu refund remboursement dispute litige reversal annulation',
  'tokenization': 'token wallet apple pay google pay dpan cryptogram', 'wsjf-planner': 'backlog jira pi capacity priorite', 'uat-tracker': 'uat recette test campaign campagne',
  'story-builder': 'user story stories gherkin invest jira', 'prd-builder': 'prd product requirements exigences', 'raci-grid': 'raci stakeholder parties prenantes',
};
/** Every word of the query must match somewhere; score = sum of word scores. */
function multi(q, text) {
  const words = q.split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  let total = 0;
  for (const w of words) { const s = score(w, text); if (!s) return 0; total += s; }
  return total;
}
function score(q, text) {
  if (!q) return 1;
  const t = norm(text);
  const i = t.indexOf(q);
  if (i >= 0) return 100 - i;
  let k = 0;
  for (const c of t) if (c === q[k]) k++;
  return k === q.length ? 10 : 0;
}

function commands() {
  const go = (h) => () => { location.hash = h; };
  const list = [];
  for (const t of TOOLS) list.push({ group: L('Tools'), icon: t.icon, label: pick(t.title), hint: L(GROUP_LABEL[t.group]), keys: `${t.title.en} ${t.title.fr} ${t.skill} ${t.id} ${KEYWORDS[t.id] || ''}`, run: go('#/tool/' + t.id) });
  for (const d of DEMOS) list.push({ group: L('Samples'), icon: 'flask-conical', label: pick(d.title), hint: pick(TOOLS.find((t) => t.id === d.tool).title), keys: `${d.title.en} ${d.title.fr}`, run: go(`#/tool/${d.tool}?sample=${S.lang}`) });
  list.push(
    { group: L('Pages'), icon: 'house', label: L('Home'), keys: 'home accueil', run: go('#/') },
    { group: L('Pages'), icon: 'files', label: L('Deliverables'), keys: 'deliverables livrables documents', run: go('#/deliverables') },
    { group: L('Pages'), icon: 'file-plus', label: L('New deliverable'), keys: 'new nouveau livrable create', kbd: 'N', run: go('#/new') },
    { group: L('Pages'), icon: 'message-circle', label: L('Chat with Claude'), keys: 'chat claude discussion', run: go('#/chat') },
    { group: L('Pages'), icon: 'user', label: L('Profile'), keys: 'profile profil settings', run: go('#/profile') },
    { group: L('Actions'), icon: 'circle-help', label: L('Open the guide'), keys: 'guide help aide', kbd: '?', run: () => toggleGuide(true) },
    { group: L('Actions'), icon: 'moon', label: L('Switch theme (light / dark)'), keys: 'theme dark light sombre clair', run: () => document.getElementById('theme-btn').click() },
    { group: L('Actions'), icon: 'languages', label: S.lang === 'fr' ? 'Switch to English' : 'Passer en français', keys: 'language langue english francais', run: () => document.getElementById('lang-btn').click() },
  );
  for (const r of S.requests.slice(0, 40)) list.push({ group: L('Deliverables'), icon: 'file-text', label: r.title, hint: r.client, keys: `${r.title} ${r.client}`, run: go('#/d/' + r.id) });
  return list;
}

let dlg = null;
export function openPalette() {
  if (dlg) return;
  const opener = document.activeElement;
  dlg = document.createElement('dialog');
  dlg.className = 'palette';
  dlg.setAttribute('aria-label', L('Command palette'));
  dlg.innerHTML = `<div class="palette-search">${iconSvg('search')}<input type="text" role="combobox" aria-expanded="true" aria-controls="palette-list" aria-autocomplete="list"
      placeholder="${esc(L('Search tools, samples, actions'))}" aria-label="${esc(L('Search tools, samples, actions'))}"><kbd>Esc</kbd></div>
    <div class="palette-list" id="palette-list" role="listbox"></div>`;
  document.body.append(dlg);
  const input = dlg.querySelector('input'), listEl = dlg.querySelector('.palette-list');
  const all = commands();
  let shown = [], cur = 0;
  const paint = () => {
    const q = norm(input.value.trim());
    shown = all.map((c) => ({ c, s: Math.max(multi(q, c.label), multi(q, c.label + ' ' + c.keys) * 0.9) })).filter((x) => x.s > 0)
      .sort((a, b) => (q ? b.s - a.s : 0)).map((x) => x.c).slice(0, 60);
    if (!q) shown = all.filter((c) => c.group !== L('Deliverables')).concat(all.filter((c) => c.group === L('Deliverables')).slice(0, 5));
    cur = Math.min(cur, Math.max(0, shown.length - 1));
    let last = '';
    listEl.innerHTML = shown.length ? shown.map((c, i) => {
      const g = c.group !== last ? `<div class="palette-group" role="presentation">${esc(c.group)}</div>` : '';
      last = c.group;
      return `${g}<div class="palette-item${i === cur ? ' on' : ''}" role="option" id="pal-${i}" aria-selected="${i === cur}" data-i="${i}">${iconSvg(c.icon)}<span class="pl">${esc(c.label)}</span>${c.hint ? `<span class="ph">${esc(c.hint)}</span>` : ''}${c.kbd ? `<kbd>${esc(c.kbd)}</kbd>` : ''}</div>`;
    }).join('') : `<div class="palette-empty">${esc(L('No match. Try another word, in English or French.'))}</div>`;
    input.setAttribute('aria-activedescendant', shown.length ? 'pal-' + cur : '');
    const on = listEl.querySelector('.on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  const runAt = (i) => { const c = shown[i]; if (!c) return; close(); c.run(); };
  const close = () => { if (!dlg) return; dlg.close(); };
  input.addEventListener('input', () => { cur = 0; paint(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cur = (cur + 1) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); cur = (cur - 1 + shown.length) % Math.max(1, shown.length); paint(); }
    else if (e.key === 'Enter') { e.preventDefault(); runAt(cur); }
  });
  listEl.addEventListener('click', (e) => { const it = e.target.closest('[data-i]'); if (it) runAt(+it.dataset.i); });
  listEl.addEventListener('mousemove', (e) => { const it = e.target.closest('[data-i]'); if (it && +it.dataset.i !== cur) { cur = +it.dataset.i; paint(); } });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  dlg.addEventListener('close', () => { dlg.remove(); dlg = null; if (opener && opener.focus && opener.isConnected) opener.focus(); });
  dlg.showModal();
  paint();
  input.focus();
}
