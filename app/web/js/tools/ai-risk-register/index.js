/* AI risk register (governing-ai-risk), owner J.
   EU AI Act tier wizard (Art. 5 → Annex III with the 5(b) fraud carve-out and the Art. 6(3) derogation → Art. 50 →
   minimal; "unsure" puts items *to confirm*) + risk register (likelihood × impact, heat grid, owner, control, test,
   NIST AI RMF function, status). Logic = logic.js (node logic.test.mjs). */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES, STARTER } from './samples.js';
import { fmtT, h, mdTable } from '../workshop-kit/jshared.js';
import { ANSWERS, NIST, STATUS, QUESTIONS, STEPS, classify, score, level, registerChecks, heat, nextRid, registerCsv, risksFromCsv } from './logic.js';

const T = register('ai-risk-register', strings);
const fmt = fmtT(T);
const TIER_TONE = { prohibited: 'bad', high: 'warn', limited: 'info', minimal: 'ok' };
const TIER_ICON = { prohibited: 'ban', high: 'shield-alert', limited: 'info', minimal: 'shield-check' };
const LV_TONE = { high: 'bad', medium: 'warn', low: 'ok' };
const chkText = (c) => fmt(c.key, { ids: c.ids.join(', ') });
const issuesOf = (s) => registerChecks(s.risks).filter((c) => c.level !== 'ok');

/* ------------------------------------------------------------------------------------------- Markdown */
function toMarkdown(s) {
  const c = classify(s.answers); const rs = s.risks || [];
  const L = [`## ${T('mdTitle')} · ${s.system || '—'}`, '', `### 1 · ${T('mdExposure')}`,
    `- **${T('mdUse')}:** ${s.use || '—'}`, `- **${T('mdSees')}:** ${s.data || '—'}`, `- **${T('mdDoes')}:** ${s.does || '—'}`,
    `- **${T('mdUsers')}:** ${s.users || '—'}`, `- **${T('mdHosting')}:** ${s.hosting || '—'}`, '',
    `### 2 · ${T('mdTier')}: ${T('tier_' + c.tier)}${c.confirm.length ? ` (${T('toConfirm')})` : ''}`, T('tierSub_' + c.tier), ''];
  for (const r of c.reasons) L.push(`- ${r.ref}: ${T(r.key)}`);
  for (const r of c.confirm) L.push(`- *${T('confirmList')}* · ${r.ref}: ${T(r.why)}`);
  if (c.open.length) L.push(`- ${fmt('unanswered', { n: c.open.length })}`);
  L.push('', `**${T('obligations')}:** ${T('ob_' + c.tier)}`, '', `> ${T('mdDisclaimer')}`, '', `#### ${T('mdAnswers')}`,
    mdTable([T('mdRef'), T('mdQuestion'), T('mdAnswer')], QUESTIONS.map((q) => [q.ref, T('q_' + q.id), s.answers && s.answers[q.id] ? T('a_' + s.answers[q.id]) : ''])), '',
    `### 3 · ${T('mdRegister')}`,
    rs.length ? mdTable([T('colId'), T('colRisk'), T('colCat'), T('colL'), T('colI'), T('colScore'), T('colOwner'), T('colControl'), T('colTest'), T('colNist'), T('colStatus')],
      rs.map((r) => [r.id, r.risk, r.category, r.likelihood, r.impact, `${score(r)} ${T('lv_' + level(score(r)))}`, r.owner, r.control, r.test, r.nist, T('st_' + (r.status || 'open'))])) : T('mdNone'),
    '', `### 4 · ${T('mdChecks')}`, ...registerChecks(rs).map((x) => `- ${x.level === 'ok' ? '✓' : x.level === 'bad' ? '✗' : '⚠'} ${chkText(x)}`), '');
  return L.join('\n');
}

/* ------------------------------------------------------------------------------------------- AI */
const ctxLine = () => (getLang() === 'fr' ? 'Context: Banque Lumière (fictional French issuer), CB cards, GIE CB. Answer in French.' : 'Context: Harbor Bank (fictional issuer), Visa cards. Answer in English.');
const sysLines = (s) => [`System: ${s.system}`, `Intended use: ${s.use}`, `Data used: ${s.data}`, `Can do: ${s.does || '?'}`, `Users: ${s.users || '?'}`, `Hosting: ${s.hosting || '?'}`];
function promptRisks(s) {
  return ['You are the Product Owner of an AI feature in a bank (skill: governing-ai-risk). You are not the lawyer: legal points are items to confirm.', ctxLine(), ...sysLines(s),
    'Already in the register:', ...((s.risks || []).map((r) => `- ${r.id} ${r.risk} (L${r.likelihood}×I${r.impact})`)),
    'Suggest 5 to 8 additional risks (OWASP Top 10 for LLM Applications 2025 plus banking-specific: regulated advice, vulnerable customers, scheme-rule errors, stand-in and Exception File timing).',
    'For each: likelihood and impact 1–5, an owner role, one testable control (GR-xx style), one red-team or regression test, and the NIST AI RMF function (Govern, Map, Measure or Manage).',
    'Never include real card numbers; use masked test PANs only. Answer with one line of rationale per risk, then a CSV block with this header so it can be pasted back into the tool:',
    'risk,category,likelihood,impact,owner,control,test,nist,status'].join('\n');
}
function promptReview(s) {
  const c = classify(s.answers);
  return ['You are reviewing an EU AI Act (Regulation (EU) 2024/1689) screening done by a Product Owner. You are not giving legal advice: list what Legal must confirm.', ctxLine(), ...sysLines(s),
    'Answers:', ...QUESTIONS.map((q) => `- ${q.ref} · ${strings.en['q_' + q.id]} → ${(s.answers || {})[q.id] || 'not answered'}`),
    `Tool result: ${c.tier}${c.carveOut ? ' (fraud-detection carve-out of Annex III 5(b) applied)' : ''}${c.derogation ? ' (Art. 6(3) derogation claimed)' : ''}. To confirm: ${c.confirm.map((x) => x.ref).join(', ') || 'none'}.`,
    'Check: Art. 5 prohibitions; Annex III (note 5(b) excludes systems used to detect financial fraud from the creditworthiness item); Art. 6(3) derogation and the profiling rule; Art. 50 transparency (chatbots, synthetic content); deployer duties (Art. 26, Art. 27 FRIA); dates of application and any proposed postponement.',
    'Return: agree / disagree with the tier and why, the questions to settle with Legal and the DPO (owner per question), and GDPR / DORA points. Label it "AI-assisted draft".'].join('\n');
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
    pasteField.setError(''); pasteArea.value = ''; set({ risks: list }); riskGrid.setRows(list); refresh();
  } });
  const adv = ui.advanced({ label: T('advanced'), count: advCount(), body: h('div', { class: 'ar-adv' },
    h('div', { class: 'ar-adv-row' }, ...advKeys.map((k) => ui.field({ label: T(k), input: ui.input({ value: st()[k] || '', onInput: (v) => { set({ [k]: v }); } }) }))),
    pasteField, h('div', {}, pasteBtn)) });
  const pill = ui.statusPill({ tone: 'neutral', text: '' });

  // ---- WIZARD
  const qBox = h('div', { class: 'ar-questions' });
  for (const step of STEPS) {
    const sec = h('fieldset', { class: 'ar-step' }, h('legend', { text: T('step_' + step) }));
    for (const q of QUESTIONS.filter((x) => x.step === step)) {
      const seg = ui.segmented({ options: ANSWERS.map((a) => ({ value: a, label: T('a_' + a) })), value: (st().answers || {})[q.id] || '', label: T('q_' + q.id),
        onChange: (v) => { set({ answers: { ...(st().answers || {}), [q.id]: v } }); row.classList.toggle('is-unsure', v === 'unsure'); } });
      if (!(st().answers || {})[q.id]) seg.querySelector('button').tabIndex = 0;
      const note = q.id === 'h2' ? T('h2Note') : q.id === 'h7' ? T('h7Note') : '';
      const row = h('div', { class: 'ar-q' + ((st().answers || {})[q.id] === 'unsure' ? ' is-unsure' : '') },
        h('div', { class: 'ar-q-text' }, h('span', { class: 'ar-ref mono', text: q.ref }), h('span', { text: T('q_' + q.id) }), note ? h('span', { class: 'ar-note', text: note }) : null), seg);
      sec.append(row);
    }
    qBox.append(sec);
  }
  const result = h('section', { class: 'ar-result panel', 'aria-live': 'polite' });
  const wizPanel = h('div', { class: 'ar-wiz' }, qBox, result);
  function paintResult() {
    const c = classify(st().answers);
    const kids = [h('div', { class: 'section-label', text: T('tier') }),
      h('div', { class: 'ar-tier' }, ui.badge({ text: T('tier_' + c.tier), tone: TIER_TONE[c.tier], icon: TIER_ICON[c.tier] }), c.confirm.length ? ui.badge({ text: T('toConfirm'), tone: 'warn', icon: 'circle-help' }) : null),
      h('p', { class: 'ar-sub', text: T('tierSub_' + c.tier) })];
    if (c.reasons.length) kids.push(h('h3', { text: T('reasons') }), h('ul', { class: 'ar-list' }, ...c.reasons.map((r) => h('li', {}, h('span', { class: 'mono ar-ref', text: r.ref }), ' ', T(r.key)))));
    if (c.confirm.length) kids.push(h('h3', { text: T('confirmList') }), h('ul', { class: 'ar-list ar-confirm' }, ...c.confirm.map((r) => h('li', {}, h('span', { class: 'mono ar-ref', text: r.ref }), ' ', T(r.why), ' ', h('em', { text: `(${T('toConfirm')})` })))));
    if (c.open.length) kids.push(h('p', { class: 'ar-sub', text: fmt('unanswered', { n: c.open.length }) }));
    kids.push(h('h3', { text: T('obligations') }), h('p', { class: 'ar-sub', text: T('ob_' + c.tier) }));
    result.replaceChildren(...kids);
    return c;
  }

  // ---- REGISTER
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
    newRow: (rows) => ({ id: nextRid(rows), risk: '', category: '', likelihood: 3, impact: 3, owner: '', control: '', test: '', nist: 'Manage', status: 'open' }),
    onChange: (rows) => set({ risks: rows.map((r) => ({ ...r, likelihood: +r.likelihood || 3, impact: +r.impact || 3 })) }),
  });
  riskGrid.classList.add('ar-grid');
  const starterBtn = ui.button({ label: T('starter'), icon: 'list-checks', size: 'sm', variant: 'secondary', onClick: () => {
    let list = [...(st().risks || [])];
    for (const r of STARTER[getLang() === 'fr' ? 'fr' : 'en']) list.push({ ...r, id: nextRid(list) });
    set({ risks: list }); riskGrid.setRows(list); refresh(); ui.toast(fmt('starterDone', { n: STARTER.en.length }));
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
    const high = rs.filter((r) => level(score(r)) === 'high').length;
    const vars = { tier: T('tier_' + c.tier) + (c.confirm.length ? ` (${T('toConfirm')})` : ''), n: rs.length, high, issues };
    const tone = c.tier === 'prohibited' || cks.some((x) => x.level === 'bad') ? 'bad' : issues || c.confirm.length ? 'warn' : 'ok';
    const text = issues ? fmt('meta', vars) : fmt('metaOk', vars);
    pill.update({ tone, text }); frame.setStatus({ tone, text });
    tabs.setCount('wizard', c.confirm.length || undefined); tabs.setCount('register', issues || undefined);
    adv.setCount(advCount());
    return { c, cks };
  }
  ctx.__arRefresh = refresh;
  refresh();
}

/* ------------------------------------------------------------------------------------------- module */
const sampleList = (lang) => SAMPLES[lang].map((s) => ({ id: s.id, label: s.label, hint: s.hint, state: s.state, autorun: true }));
export default {
  id: 'ai-risk-register',
  skill: 'governing-ai-risk',
  icon: 'shield-alert',
  title: { en: 'AI risk register', fr: 'Registre des risques IA' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'single',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'shield-check' },
  schema: 1,
  defaults() { return { system: '', use: '', data: '', does: '', users: '', hosting: '', answers: {}, risks: [] }; },
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
    const c = classify(s.answers); if (ctx.__arRefresh) ctx.__arRefresh();
    const cks = registerChecks(s.risks);
    return { tier: c.tier, confirm: c.confirm.map((x) => x.id), n: (s.risks || []).length, high: (s.risks || []).filter((r) => level(score(r)) === 'high').length, issues: cks.filter((x) => x.level !== 'ok').length, bad: cks.some((x) => x.level === 'bad') };
  },
  status(r, ms) {
    const vars = { tier: T('tier_' + r.tier) + (r.confirm.length ? ` (${T('toConfirm')})` : ''), n: r.n, high: r.high, issues: r.issues };
    return { tone: r.tier === 'prohibited' || r.bad ? 'bad' : r.issues || r.confirm.length ? 'warn' : 'ok', text: r.issues ? fmt('meta', vars) : fmt('metaOk', vars), ms };
  },
  toMarkdown,
  exports: [{ id: 'register-csv', label: { en: strings.en.exCsv, fr: strings.fr.exCsv }, build: (s) => ({ name: 'ai-risk-register.csv', mime: 'text/csv', text: registerCsv(s.risks) }) }],
  aiActions: [
    { id: 'suggest-risks', label: { en: strings.en.aiRisks, fr: strings.fr.aiRisks }, expects: 'markdown', prompt: (s) => promptRisks(s) },
    { id: 'review-tier', label: { en: strings.en.aiReview, fr: strings.fr.aiReview }, expects: 'markdown', prompt: (s) => promptReview(s) },
  ],
  _internals: { toMarkdown, promptRisks, promptReview },
};
