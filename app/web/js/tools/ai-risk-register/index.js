/* AI risk register (governing-ai-risk), owner J · V3 rebuild R1.
   EU AI Act screening as a visible decision tree (logic.js): Art. 5 → Art. 6 / Annex I / Annex III (5(b) fraud
   exception, Art. 6(3) derogation) → Art. 50 → minimal, with the reasoning path, the obligations by role and the
   application dates after Regulation (EU) 2026/1744. Unanswered = "Incomplete", never "Minimal".
   Guided demo: a sample fills the inputs only; the tier appears when the primary button is pressed (state._classified),
   then it follows the answers live. The risk register (likelihood × impact, heat grid, checks) is always live.
   Screening aid, not legal advice. Logic = logic.js (node --test logic.test.mjs). */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES, STARTER } from './samples.js';
import { fmtT, h, mdTable } from '../workshop-kit/jshared.js';
import { ANSWERS, ROLES, NIST, STATUS, QUESTIONS, STEPS, LEGAL, classify, visibleQuestions, obligations, keyDates, addUnique,
  score, level, registerChecks, heat, nextRid, registerCsv, risksFromCsv } from './logic.js';

const T = register('ai-risk-register', strings);
const fmt = fmtT(T);
const TIER_TONE = { prohibited: 'bad', high: 'warn', limited: 'info', minimal: 'ok', incomplete: 'neutral' };
const TIER_ICON = { prohibited: 'ban', high: 'shield-alert', limited: 'info', minimal: 'shield-check', incomplete: 'circle-help' };
const LV_TONE = { high: 'bad', medium: 'warn', low: 'ok' };
const NOTES = { p6: 'p6Note', h2: 'h2Note', h7: 'h7Note', h6: 'h6Note', t1: 't1Note' };
const chkText = (c) => fmt(c.key, { ids: c.ids.join(', ') });
const refOf = (id) => QUESTIONS.find((q) => q.id === id).ref;
const fmtDate = (iso) => new Date(iso + 'T00:00:00Z').toLocaleDateString(getLang() === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dateText = (d) => fmt(d.applies ? 'since' : 'from', { date: fmtDate(d.iso) });
const role = (s) => (ROLES.includes(s.role) ? s.role : '');
const pathText = (p, c) => (p.gate === 'result' ? fmt('path_result', { tier: T('tier_' + c.tier) }) : fmt(`path_${p.gate}_${p.outcome}`, { refs: p.refs.join(', ') }));
/** Tone of one step of the reasoning path. */
function pathTone(p) {
  if (p.gate === 'result') return TIER_TONE[p.outcome];
  if (p.outcome === 'clear' || p.outcome === 'granted' || p.outcome === 'exception') return 'ok';
  if (p.outcome === 'open') return 'neutral';
  if (p.outcome === 'hit') return p.gate === 'art5' ? 'bad' : p.gate === 'art50' ? 'info' : 'warn';
  return 'warn';
}
const today = () => new Date().toISOString().slice(0, 10);
const obDate = (o) => (o.date ? dateText({ ...LEGAL.dates[o.date], applies: LEGAL.dates[o.date].iso <= today() }) : '');
const unansweredText = (c) => fmt('unanswered', { n: c.open.length, refs: [...new Set(c.open.map(refOf))].join(', ') });

/* ------------------------------------------------------------------------------------------- Markdown */
function toMarkdown(s) {
  const c = classify(s.answers); const rs = s.risks || []; const vis = visibleQuestions(s.answers);
  const L = [`## ${T('mdTitle')} · ${s.system || '—'}`, '', `### 1 · ${T('mdExposure')}`,
    `- **${T('mdUse')}:** ${s.use || '—'}`, `- **${T('mdSees')}:** ${s.data || '—'}`, `- **${T('mdDoes')}:** ${s.does || '—'}`,
    `- **${T('mdUsers')}:** ${s.users || '—'}`, `- **${T('mdHosting')}:** ${s.hosting || '—'}`, `- **${T('mdRole')}:** ${role(s) ? T('role_' + role(s)) : '—'}`, ''];
  if (!s._classified) L.push(`### 2 · ${T('mdTier')}`, T('mdNotRun'), '');
  else {
    L.push(`### 2 · ${T('mdTier')}: ${T('tier_' + c.tier)} · ${T('rs_' + c.status)}`, T('tierSub_' + c.tier), '');
    if (c.tier === 'incomplete' && c.atLeast) L.push(`- ${fmt('atLeast', { tier: T('tier_' + c.atLeast) })}`);
    if (c.worstCase) L.push(`- ${fmt('worst', { tier: T('tier_' + c.worstCase) })}`);
    L.push('', `**${T('pathTitle')}**`, '', ...c.path.map((p, i) => `${i + 1}. ${pathText(p, c)}`), '');
    if (c.reasons.length) L.push(`**${T('reasons')}**`, '', ...c.reasons.map((r) => `- ${r.ref}: ${T(r.key)}`), '');
    for (const r of c.confirm) L.push(`- *${T('confirmList')}* · ${r.ref}: ${T(r.why)}`);
    if (c.open.length) L.push(`- ${unansweredText(c)}`);
    const obs = obligations(c, role(s));
    if (obs.length) L.push('', `**${T('obligations')}**`, '', mdTable([T('mdWho'), T('mdRef'), T('mdObligation'), T('mdApplies')], obs.map((o) => [T('who_' + o.who), o.ref, T('ob_' + o.id), obDate(o)])));
    const ds = keyDates(c);
    if (ds.length) L.push('', `**${T('datesTitle')}**`, '', ...ds.map((d) => `- ${T('d_' + d.key)}: ${dateText(d)} (${d.ref})`));
    if (c.tier === 'high') L.push(`- ${T('legacyNote')}`);
    L.push('');
  }
  L.push(`> ${T('mdDisclaimer')}`, '>', `> ${fmt('legalBasis', { date: fmtDate(LEGAL.checked) })} ${T('scope')}`, '', `#### ${T('mdAnswers')}`,
    mdTable([T('mdRef'), T('mdQuestion'), T('mdAnswer')], QUESTIONS.map((q) => [q.ref, T('q_' + q.id), !vis.includes(q.id) ? T('mdNotAsked') : s.answers && s.answers[q.id] ? T('a_' + s.answers[q.id]) : ''])), '',
    `### 3 · ${T('mdRegister')}`,
    rs.length ? mdTable([T('colId'), T('colRisk'), T('colCat'), T('colL'), T('colI'), T('colScore'), T('colOwner'), T('colControl'), T('colTest'), T('colNist'), T('colStatus')],
      rs.map((r) => [r.id, r.risk, r.category, r.likelihood, r.impact, `${score(r)} ${T('lv_' + level(score(r)))}`, r.owner, r.control, r.test, r.nist, T('st_' + (r.status || 'open'))])) : T('mdNone'),
    '', `### 4 · ${T('mdChecks')}`, ...registerChecks(rs).map((x) => `- ${x.level === 'ok' ? '✓' : x.level === 'bad' ? '✗' : '⚠'} ${chkText(x)}`), '');
  return L.join('\n');
}

/* ------------------------------------------------------------------------------------------- AI */
const ctxLine = () => (getLang() === 'fr' ? 'Context: Banque Lumière (fictional French issuer), CB cards, GIE CB. Answer in French.' : 'Context: Harbor Bank (fictional issuer), Visa cards. Answer in English.');
const sysLines = (s) => [`System: ${s.system}`, `Intended use: ${s.use}`, `Data used: ${s.data}`, `Can do: ${s.does || '?'}`, `Users: ${s.users || '?'}`, `Hosting: ${s.hosting || '?'}`, `Role of the bank: ${role(s) || 'not stated'}`];
function promptRisks(s) {
  return ['You are the Product Owner of an AI feature in a bank (skill: governing-ai-risk). You are not the lawyer: legal points are items to confirm.', ctxLine(), ...sysLines(s),
    'Already in the register:', ...((s.risks || []).map((r) => `- ${r.id} ${r.risk} (L${r.likelihood}×I${r.impact})`)),
    'Suggest 5 to 8 additional risks (OWASP Top 10 for LLM Applications 2025 plus banking-specific: regulated advice, vulnerable customers, scheme-rule errors, stand-in and Exception File timing).',
    'For each: likelihood and impact 1–5, an owner role, one testable control (GR-xx style), one red-team or regression test, and the NIST AI RMF function (Govern, Map, Measure or Manage).',
    'Never include real card numbers; use masked test PANs only. Answer with one line of rationale per risk, then a CSV block with this header so it can be pasted back into the tool:',
    'risk,category,likelihood,impact,owner,control,test,nist,status'].join('\n');
}
function promptReview(s) {
  const c = classify(s.answers); const vis = visibleQuestions(s.answers);
  return ['You are reviewing an EU AI Act screening done by a Product Owner. Legal basis: Regulation (EU) 2024/1689 as amended by Regulation (EU) 2026/1744 (Digital Omnibus on AI, OJ L 24.7.2026). You are not giving legal advice: list what counsel must confirm.', ctxLine(), ...sysLines(s),
    'Answers:', ...QUESTIONS.filter((q) => vis.includes(q.id)).map((q) => `- ${q.ref} · ${strings.en['q_' + q.id]} → ${(s.answers || {})[q.id] || 'not answered'}`),
    `Tool result: ${c.tier} (${c.status}). Reasoning path: ${c.path.map((p) => `${p.gate}=${p.outcome}`).join(' → ')}. To confirm: ${c.confirm.map((x) => x.ref).join(', ') || 'none'}. Unanswered: ${c.open.map(refOf).join(', ') || 'none'}.`,
    'Check, with article numbers: Art. 5 prohibitions including the new points (ba) and (bb); Art. 6(1) and Annex I; Annex III (point 5(b) excludes only systems used for the purpose of detecting financial fraud, a system that also evaluates creditworthiness stays high-risk); the Art. 6(3) derogation, its four conditions and the rule that profiling of natural persons is always high-risk; Art. 50 transparency, which applies on top of high-risk (Art. 50(6)); provider duties (Art. 9–17, 43, 47–49, 72–73) versus deployer duties (Art. 26, 27, 86).',
    'Dates to use: prohibitions since 2 February 2025 (new points from 2 December 2026); Art. 50 from 2 August 2026 (Art. 50(2) by 2 December 2026 for systems already on the market); Annex III high-risk from 2 December 2027; Annex I from 2 August 2028.',
    'Return: agree / disagree with the tier and why, the questions to settle with Legal and the DPO (owner per question), and GDPR / DORA points. Label it "AI-assisted draft, not legal advice".'].join('\n');
}

/* ------------------------------------------------------------------------------------------- view */
function mount(el, ctx) {
  const { ui, frame } = ctx;
  const st = () => ctx.state;
  if (!Array.isArray(st().risks)) ctx.setState({ risks: [] }, { silent: true });
  if (!st().answers) ctx.setState({ answers: {} }, { silent: true });
  const set = (patch) => { ctx.setState(patch, { silent: true }); refresh(); };

  // ---- command bar
  for (const [k, ph] of [['system', 'systemPh'], ['use', 'usePh'], ['data', 'dataPh']]) {
    const f = frame.bindField(k, ui.field({ label: T(k), required: true, input: ui.input({ value: st()[k] || '', placeholder: T(ph), onInput: (v) => set({ [k]: v }) }) }));
    f.classList.add('ar-' + k); frame.command.append(f);
  }
  // ---- advanced
  const advKeys = ['does', 'users', 'hosting'];
  const advCount = () => advKeys.filter((k) => String(st()[k] || '').trim()).length;
  const pasteArea = ui.textarea({ rows: 3, mono: true, placeholder: 'risk,category,likelihood,impact,owner,control,test,nist,status' });
  const pasteField = ui.field({ label: T('paste'), help: T('pasteHint'), input: pasteArea });
  const pasteBtn = ui.button({ label: T('pasteApply'), size: 'sm', icon: 'import', onClick: () => {
    const before = (st().risks || []).length; const list = risksFromCsv(pasteArea.value, st().risks);
    if (list.length === before) { pasteField.setError(T('pasteBad')); return; }
    pasteField.setError(''); pasteArea.value = ''; setRisks(list);
  } });
  const adv = ui.advanced({ label: T('advanced'), count: advCount(), body: h('div', { class: 'ar-adv' },
    h('div', { class: 'ar-adv-row' }, ...advKeys.map((k) => ui.field({ label: T(k), input: ui.input({ value: st()[k] || '', onInput: (v) => { set({ [k]: v }); } }) }))),
    pasteField, h('div', {}, pasteBtn)) });
  const pill = ui.statusPill({ tone: 'neutral', text: '' });

  // ---- WIZARD: role, then the three gates. Art. 6(3) questions appear only after an Annex III hit.
  const qBox = h('div', { class: 'ar-questions' });
  const rows = {};
  const roleSeg = ui.segmented({ options: ROLES.map((r) => ({ value: r, label: T('role_' + r) })), value: role(st()), label: T('roleQ'), onChange: (v) => set({ role: v }) });
  if (!role(st())) roleSeg.querySelector('button').tabIndex = 0;
  qBox.append(h('fieldset', { class: 'ar-step' }, h('legend', { text: T('step_role') }),
    h('div', { class: 'ar-q' }, h('div', { class: 'ar-q-text' }, h('span', { class: 'ar-ref mono', text: 'Art. 3(3)–(4)' }), h('span', { text: T('roleQ') }), h('span', { class: 'ar-note', text: T('roleHint') })), roleSeg)));
  const derHead = h('div', { class: 'ar-der-head', text: T('derTitle') });
  for (const step of STEPS) {
    const sec = h('fieldset', { class: 'ar-step' }, h('legend', { text: T('step_' + step) }));
    for (const q of QUESTIONS.filter((x) => x.step === step)) {
      const seg = ui.segmented({ options: ANSWERS.map((a) => ({ value: a, label: T('a_' + a) })), value: (st().answers || {})[q.id] || '', label: T('q_' + q.id),
        onChange: (v) => { row.classList.toggle('is-unsure', v === 'unsure'); set({ answers: { ...(st().answers || {}), [q.id]: v } }); } });
      if (!(st().answers || {})[q.id]) seg.querySelector('button').tabIndex = 0;
      const note = NOTES[q.id] ? T(NOTES[q.id]) : '';
      const row = h('div', { class: 'ar-q' + (q.derogation ? ' ar-q-der' : '') + ((st().answers || {})[q.id] === 'unsure' ? ' is-unsure' : '') },
        h('div', { class: 'ar-q-text' }, h('span', { class: 'ar-ref mono', text: q.ref }), h('span', { text: T('q_' + q.id) }), note ? h('span', { class: 'ar-note', text: note }) : null), seg);
      if (q.id === 'h7') sec.append(derHead);
      rows[q.id] = row; sec.append(row);
    }
    qBox.append(sec);
  }
  const result = h('section', { class: 'ar-result panel', 'aria-live': 'polite' });
  const wizPanel = h('div', { class: 'ar-wiz' }, qBox, result);
  const legalFoot = () => h('div', { class: 'ar-legal' },
    h('p', { class: 'ar-disclaimer' }, ui.badge({ text: T('disclaimer'), tone: 'warn', icon: 'scale' })),
    h('p', { class: 'ar-sub', text: `${fmt('legalBasis', { date: fmtDate(LEGAL.checked) })} ${T('scope')}` }));

  function paintResult() {
    const s = st(); const c = classify(s.answers);
    const vis = visibleQuestions(s.answers);
    for (const q of QUESTIONS) rows[q.id].hidden = !vis.includes(q.id);
    derHead.hidden = !vis.includes('h7');
    if (ctx.guided || !s._classified) {   // shell contract: inputs only until the presenter's first run
      result.replaceChildren(h('div', { class: 'section-label', text: T('tier') }),
        h('div', { class: 'ar-invite' }, ui.badge({ text: T('inviteTitle'), tone: 'neutral', icon: 'circle-help' }), h('p', { text: T('invite') })), legalFoot());
      return c;
    }
    const kids = [h('div', { class: 'section-label', text: T('tier') }),
      h('div', { class: 'ar-tier' }, ui.badge({ text: T('tier_' + c.tier), tone: TIER_TONE[c.tier], icon: TIER_ICON[c.tier] }),
        c.tier !== 'incomplete' ? ui.badge({ text: c.status === 'final' ? T('rs_final') : T('toConfirm'), tone: c.status === 'final' ? 'ok' : 'warn', icon: c.status === 'final' ? 'circle-check' : 'circle-help' }) : null,
        c.tier === 'incomplete' && c.atLeast ? ui.badge({ text: fmt('atLeast', { tier: T('tier_' + c.atLeast) }), tone: TIER_TONE[c.atLeast], icon: TIER_ICON[c.atLeast] }) : null,
        c.worstCase ? ui.badge({ text: fmt('worst', { tier: T('tier_' + c.worstCase) }), tone: TIER_TONE[c.worstCase], icon: 'triangle-alert' }) : null),
      h('p', { class: 'ar-sub', text: T('tierSub_' + c.tier) })];
    if (c.open.length) kids.push(h('p', { class: 'ar-open', text: unansweredText(c) }));
    kids.push(h('h3', { text: T('pathTitle') }), h('ol', { class: 'ar-path' }, ...c.path.map((p) => h('li', { class: `ar-step-${pathTone(p)}${p.gate === 'result' ? ' is-result' : ''}` }, h('span', { class: 'ar-dot', 'aria-hidden': 'true' }), h('span', { text: pathText(p, c) })))));
    if (c.reasons.length) kids.push(h('h3', { text: T('reasons') }), h('ul', { class: 'ar-list' }, ...c.reasons.map((r) => h('li', {}, h('span', { class: 'mono ar-ref', text: r.ref }), ' ', T(r.key)))));
    if (c.confirm.length) kids.push(h('h3', { text: T('confirmList') }), h('ul', { class: 'ar-list ar-confirm' }, ...c.confirm.map((r) => h('li', {}, h('span', { class: 'mono ar-ref', text: r.ref }), ' ', T(r.why), ' ', h('em', { text: `(${T('toConfirm')})` })))));
    const obs = obligations(c, role(s));
    kids.push(h('h3', { text: T('obligations') }));
    if (!obs.length) kids.push(h('p', { class: 'ar-sub', text: T('ob_none') }));
    else {
      kids.push(h('ul', { class: 'ar-obs' }, ...obs.map((o) => h('li', {}, h('span', { class: `ar-who ar-who-${o.who}`, text: T('who_' + o.who) }),
        h('span', { class: 'ar-ob-text' }, h('span', { class: 'mono ar-ref', text: o.ref }), ' ', T('ob_' + o.id), o.date ? h('span', { class: 'ar-ob-date', text: ' · ' + obDate(o) }) : null)))));
      kids.push(h('div', {}, ui.button({ label: T('addDuties'), icon: 'plus', size: 'sm', variant: 'secondary', onClick: () => {
        const dutyRows = obs.filter((o) => o.id !== 'other').map((o) => ({ id: '', risk: fmt('dutyRisk', { text: T('ob_' + o.id), ref: o.ref }), category: T('dutyCat'), likelihood: 3, impact: 4, owner: '', control: '', test: '', nist: 'Govern', status: 'open' }));
        const r = addUnique(st().risks, dutyRows);
        if (r.added) setRisks(r.risks);
        ui.toast(r.added ? fmt('dutiesDone', { n: r.added }) : T('dutiesNone'));
      } })));
    }
    const ds = keyDates(c);
    if (ds.length) kids.push(h('h3', { text: T('datesTitle') }), h('ul', { class: 'ar-dates' }, ...ds.map((d) => h('li', {}, h('span', { text: T('d_' + d.key) }),
      h('span', { class: 'ar-date ' + (d.applies ? 'is-now' : 'is-later') }, dateText(d), ' ', h('span', { class: 'mono ar-ref', text: d.ref }))))));
    if (c.tier === 'high') kids.push(h('p', { class: 'ar-sub', text: T('legacyNote') }));
    kids.push(legalFoot());
    result.replaceChildren(...kids);
    return c;
  }

  // ---- REGISTER (always live)
  const scale = ['1', '2', '3', '4', '5'];
  const riskGrid = ui.grid({
    columns: [
      { key: 'id', label: T('colId'), type: 'readonly', width: 64, mono: true },
      { key: 'risk', label: T('colRisk') },
      { key: 'category', label: T('colCat'), width: 140 },
      { key: 'likelihood', label: T('colL'), type: 'select', options: scale, width: 64 },
      { key: 'impact', label: T('colI'), type: 'select', options: scale, width: 64 },
      { key: '_s', label: T('colScore'), width: 112, compute: (r) => { const s = score(r); return ui.badge({ text: `${s} · ${T('lv_' + level(s))}`, tone: LV_TONE[level(s)] }); } },
      { key: 'owner', label: T('colOwner'), width: 140 },
      { key: 'control', label: T('colControl') },
      { key: 'test', label: T('colTest'), width: 160 },
      { key: 'nist', label: T('colNist'), type: 'select', options: NIST, width: 112 },
      { key: 'status', label: T('colStatus'), type: 'select', options: STATUS.map((v) => ({ value: v, label: T('st_' + v) })), width: 128 },
    ],
    rows: st().risks, removable: true, addLabel: T('addRisk'),
    newRow: (rs) => ({ id: nextRid(rs), risk: '', category: '', likelihood: 3, impact: 3, owner: '', control: '', test: '', nist: 'Manage', status: 'open' }),
    onChange: (rs) => set({ risks: rs.map((r) => ({ ...r, likelihood: +r.likelihood || 3, impact: +r.impact || 3 })) }),
  });
  riskGrid.classList.add('ar-grid');
  function setRisks(list) { ctx.setState({ risks: list }, { silent: true }); riskGrid.setRows(list); refresh(); }
  const starterBtn = ui.button({ label: T('starter'), icon: 'list-checks', size: 'sm', variant: 'secondary', onClick: () => {
    const r = addUnique(st().risks, STARTER[getLang() === 'fr' ? 'fr' : 'en']);   // pressing twice adds nothing new
    if (r.added) setRisks(r.risks);
    ui.toast(r.added ? fmt('starterDone', { n: r.added }) : T('starterNone'));
  } });
  const heatBox = h('div', { class: 'ar-heat' });
  const checksBox = h('ul', { class: 'ar-checks' });
  const nistBox = h('ul', { class: 'ar-nist' });
  const noRisks = h('p', { class: 'ar-sub', text: T('noRisks') });
  const regPanel = h('div', {},
    h('div', { class: 'ar-sec-head' }, h('h2', { text: T('register') }), starterBtn), noRisks, riskGrid,
    h('div', { class: 'ar-lower' },
      h('section', {}, h('h2', { text: T('heat') }), h('p', { class: 'ar-sub', text: T('heatHint') }), heatBox),
      h('section', {}, h('h2', { text: T('checks') }), checksBox, h('h3', { text: T('nistBy') }), nistBox)));
  function paintHeat() {
    const cells = heat(st().risks);
    const tbl = h('table', { class: 'ar-heat-t' });
    const cap = h('caption', { class: 'sr-only', text: T('heat') }); tbl.append(cap);
    for (let i = 5; i >= 1; i--) {
      const tr = h('tr', {}, h('th', { scope: 'row', class: 'num', text: String(i) }));
      for (let l = 1; l <= 5; l++) {
        const ids = cells[i - 1][l - 1]; const lv = level(i * l);
        tr.append(h('td', { class: `ar-h ar-h-${lv}${ids.length ? ' has' : ''}`, title: fmt('heatCell', { l, i, ids: ids.join(', ') || '—' }) }, h('span', { class: 'ar-h-ids', text: ids.join(' ') })));
      }
      tbl.append(tr);
    }
    tbl.append(h('tr', {}, h('td'), ...[1, 2, 3, 4, 5].map((l) => h('th', { scope: 'col', class: 'num', text: String(l) }))));
    heatBox.replaceChildren(h('div', { class: 'ar-heat-wrap' }, h('span', { class: 'ar-axis-y', text: `${T('impact')} →` }), tbl), h('div', { class: 'ar-axis-x', text: `${T('likelihood')} →` }));
  }

  const empty = ui.emptyState({ icon: 'shield-alert', title: T('emptyTitle'), text: T('empty'), sample: { label: T('load'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });
  const tabs = ui.tabs({ tabs: [{ id: 'wizard', label: T('tabWizard') }, { id: 'register', label: T('tabRegister') }], active: st()._tab || 'wizard',
    panels: { wizard: wizPanel, register: regPanel }, onChange: (id) => ctx.setState({ _tab: id }, { silent: true }) });
  el.append(h('div', { class: 'jk-top' }, adv, pill), empty, tabs);

  function refresh() {
    const s = st(); const c = paintResult(); const rs = s.risks || [];
    empty.hidden = !!(s.system || s.use || s.data || rs.length || Object.keys(s.answers || {}).length);
    noRisks.hidden = rs.length > 0; riskGrid.hidden = !rs.length;
    paintHeat();
    const cks = registerChecks(rs);
    checksBox.replaceChildren(...cks.map((x) => h('li', {}, ui.badge({ text: chkText(x), tone: x.level, icon: x.level === 'ok' ? 'circle-check' : x.level === 'bad' ? 'circle-x' : 'triangle-alert' }))));
    nistBox.replaceChildren(...NIST.map((f) => h('li', {}, h('span', { text: f }), h('span', { class: 'num', text: String(rs.filter((r) => r.nist === f).length) }))));
    const issues = cks.filter((x) => x.level !== 'ok').length;
    const st1 = statusOf(summary(s, c, cks));
    pill.update(st1); frame.setStatus(st1);
    tabs.setCount('wizard', s._classified && !ctx.guided ? (c.confirm.length + c.open.length) || undefined : undefined); tabs.setCount('register', issues || undefined);
    adv.setCount(advCount());
    return { c, cks };
  }
  ctx.__arRefresh = refresh;
  refresh();
}

/* ------------------------------------------------------------------------------------------- module */
const summary = (s, c, cks) => ({ classified: !!s._classified, tier: c.tier, status: c.status, confirm: c.confirm.map((x) => x.id), open: c.open, n: (s.risks || []).length,
  high: (s.risks || []).filter((r) => level(score(r)) === 'high').length, issues: cks.filter((x) => x.level !== 'ok').length, bad: cks.some((x) => x.level === 'bad') });
function statusOf(r, ms) {
  const vars = { tier: r.classified ? T('tier_' + r.tier) + (r.tier !== 'incomplete' && r.status === 'provisional' ? ` (${T('toConfirm')})` : '') : T('tierPending'), n: r.n, high: r.high, issues: r.issues };
  const tone = (r.classified && r.tier === 'prohibited') || r.bad ? 'bad' : r.issues || !r.classified || r.status !== 'final' ? 'warn' : 'ok';
  return { tone, text: r.issues ? fmt('meta', vars) : fmt('metaOk', vars), ms };
}
const sampleList = (lang) => SAMPLES[lang].map((s) => ({ id: s.id, label: s.label, hint: s.hint, state: s.state }));
export default {
  id: 'ai-risk-register',
  skill: 'governing-ai-risk',
  icon: 'shield-alert',
  title: { en: 'AI risk register', fr: 'Registre des risques IA' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'shield-check' },
  schema: 1,
  defaults() { return { system: '', use: '', data: '', does: '', users: '', hosting: '', role: '', answers: {}, risks: [], _classified: false }; },
  samples: { en: sampleList('en'), fr: sampleList('fr') },
  mount,
  validate(s) {
    const e = [];
    if (!String(s.system || '').trim()) e.push({ field: 'system', message: T('errSystem') });
    if (!String(s.use || '').trim()) e.push({ field: 'use', message: T('errUse') });
    if (!String(s.data || '').trim()) e.push({ field: 'data', message: T('errData') });
    return e;
  },
  run(s, ctx) {
    if (!s._classified) ctx.setState({ _classified: true }, { silent: true });
    if (ctx.__arRefresh) ctx.__arRefresh();
    return summary({ ...s, _classified: true }, classify(s.answers), registerChecks(s.risks));
  },
  status: (r, ms) => statusOf(r, ms),
  toMarkdown,
  exports: [{ id: 'register-csv', label: { en: strings.en.exCsv, fr: strings.fr.exCsv }, build: (s) => ({ name: 'ai-risk-register.csv', mime: 'text/csv', text: registerCsv(s.risks) }) }],
  aiActions: [
    { id: 'suggest-risks', label: { en: strings.en.aiRisks, fr: strings.fr.aiRisks }, expects: 'markdown', prompt: (s) => promptRisks(s) },
    { id: 'review-tier', label: { en: strings.en.aiReview, fr: strings.fr.aiReview }, expects: 'markdown', prompt: (s) => promptReview(s) },
  ],
  _internals: { toMarkdown, promptRisks, promptReview },
};
