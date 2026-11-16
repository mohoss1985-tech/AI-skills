/* RAG eval scorer (evaluating-rag-quality), owner G · V3 rebuild R2.
   Golden Q&A set + model answers (CSV) → offline CLAIM-LEVEL checks (numbers with units, polarity, terms missing from the
   context, contradiction vs the approved answer) → faithfulness / correctness / context recall / precision ratios with
   "how this is computed", per-answer explainer (claims green / amber / red + reason), manual or LLM-judge overrides,
   copy-ready LLM-judge prompt, overall score vs threshold and the score_eval.py release gates → PASS / BLOCKED.
   No LLM runs in the page. Logic and tests: logic.js, logic.test.mjs. */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { evaluate, report, resultsCsv, reasonText, METRICS, METHOD, CAUSES, DEFAULT_GATES, goldenFromCsv, answersFromCsv, factText } from './logic.js';
import { fmtVars, mdCell } from '../uat-tracker/csv.js';

const T = register('rag-eval', strings);
const fmt = (k, v) => fmtVars(T(k), v);
const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const dec = (x) => { if (x == null) return '—'; const s = (Math.round(x * 10) / 10).toFixed(1).replace(/\.0$/, ''); return getLang() === 'fr' ? s.replace('.', ',') : s; };
const ft = (q) => factText(q, getLang() === 'fr' ? 'fr' : 'en');
const facts = (list) => (list || []).map(ft).join(', ');
/** One localised sentence per claim reason (logic.js reasonText() is the English twin for CSV / prompts). */
function whyText(r) {
  const cv = r.conv ? fmt('rs_conv', { a: ft(r.ref || r.near[0]), b: ft(r.conv) }) : '';
  switch (r.code) {
    case 'qtyNotInContext': return fmt(r.near.length ? 'rs_qtyNotInContextNear' : 'rs_qtyNotInContext', { q: ft(r.q), near: facts(r.near) }) + cv;
    case 'termNotInContext': return fmt('rs_termNotInContext', { terms: r.terms.join(', ') });
    case 'polarityContext': case 'polarityGolden': return fmt('rs_' + r.code, { words: r.words.join(', '), ref: r.ref });
    case 'yesNoGolden': return fmt('rs_yesNoGolden', { says: T(r.says > 0 ? 'yes' : 'no'), ref: T(r.ref > 0 ? 'yes' : 'no') });
    case 'qtyVsGolden': case 'qtyEquivGolden': case 'qtyEquivContext': return fmt('rs_' + r.code, { q: ft(r.q), ref: ft(r.ref) }) + cv;
    default: return T('rs_' + r.code);
  }
}
const refText = (r) => fmt('ref_' + r.code, { pct: r.pct, list: facts(r.facts) }) + (r.equiv || []).map((e) => ' · ' + fmt('rs_equiv', { a: ft(e.hit), b: ft(e.q) })).join('');
/** The ratio behind a 0 / 1 score, as text: "2/3 claims", "F1 0.67", "67 %". */
function ratioText(i, m) {
  const x = (i.ratios || {})[m];
  if (!x || i.overridden.includes(m)) return '';
  if (m === 'faithfulness') return fmt('rt_faith', { num: x.num, den: x.den }) + (x.review ? ' · ' + fmt('rt_review', { n: x.review }) : '');
  if (m === 'correctness') return fmt('rt_corr', { f1: dec(x.value * 100), tp: x.tp, fp: x.fp, fn: x.fn });
  if (m === 'context_recall') return fmt(x.mode === 'ids' ? 'rt_recallIds' : 'rt_recall', { num: x.num, den: x.den });
  if (m === 'context_precision') return fmt('rt_prec', { v: dec(x.value * 100), k: x.k });
  return fmt('rt_pct', { v: dec(x.value * 100) });
}
const pc = (x) => (x == null ? '—' : `${dec(x * 100)} %`);

function reasons(r) {
  const out = [];
  if (!r.overallOk) out.push(fmt('r_overall', { score: dec(r.overall), thr: dec(r.threshold) }));
  for (const g of r.gates) if (!g.pass) out.push(g.value == null ? fmt('r_gateNone', { name: T('g_' + g.id) }) : fmt('r_gate', { name: T('g_' + g.id), value: pc(g.value), thr: dec(g.t * 100) }));
  return out;
}
function highLines(r) {
  const out = [];
  for (const i of r.highFails) {
    const bad = i.claims.filter((c) => !c.supported);
    if (!bad.length) { out.push(fmt('r_high', { id: i.id, risk: T('risk_' + i.risk), claim: i.answer.slice(0, 120), why: T('overriddenBy') })); continue; }
    for (const c of bad) out.push(fmt('r_high', { id: i.id, risk: T('risk_' + i.risk), claim: c.text, why: c.reasons.filter((x) => x.level === 'bad').map(whyText).join(' · ') }));
  }
  return out;
}

/* ---------------------------------------------------------------- Markdown */
function toMarkdown(state) {
  const r = evaluate(state);
  const L = [`## ${T('md_title')} · ${state.title || ''}`, ''];
  L.push(`**${T('md_decision')}: ${r.pass ? T('pass') + ' ✅' : T('block') + ' ❌'}** · ${fmt('overallLine', { score: dec(r.overall), thr: dec(r.threshold), ok: r.overallOk ? T('met') : T('notMet') })}`, '');
  const rs = [...reasons(r), ...highLines(r)];
  if (rs.length) { L.push(`### ${T('reasons')}`, ''); for (const x of rs) L.push(`- ${mdCell(x)}`); L.push(''); }
  L.push(`*${T('md_scorer')}*`, '', `### ${T('md_perq')}`, '', T('md_head'), '|---|---|---|---|---|---|');
  for (const i of r.items) L.push(`| ${i.id} | ${mdCell(i.category)} | ${T('risk_' + i.risk)} | ${i.score == null ? '—' : dec(i.score) + ' %'} | ${i.failed.map((m) => T('ml_' + m) + (i.overridden.includes(m) ? ' ✎' : '')).join(', ') || '—'} | ${i.failed.length ? T('c_' + (i.cause || '')) : ''} |`);
  L.push('', '---', '', report(r.rows, null, r.thr));
  return L.join('\n');
}

/* ---------------------------------------------------------------- AI prompts */
/** Ready-to-run LLM-as-judge prompt (Ragas / DeepEval method: claims → verdicts → ratios → thresholds → reason).
    Its JSON answer goes back into Advanced › "Apply judge scores". */
function promptJudge(state) {
  const r = evaluate(state);
  const fr = getLang() === 'fr';
  const cases = r.items.map((i) => {
    const notes = i.claims.flatMap((c) => c.reasons.filter((x) => x.level !== 'ok').map((x) => `  - "${c.text}" → ${reasonText(x)}`));
    return [`### ${i.id} · ${i.type} · risk ${i.risk}`, `Question: ${i.question}`, `Approved answer: ${i.expected_answer}`, `Retrieved context: ${i.context || '(none)'}`, `Model answer: ${i.answer || '(no answer)'}`,
      `Offline rule check: ${METRICS.map((m) => `${m}=${i.metrics[m] === '' ? 'n/a' : i.metrics[m]}`).join(', ')}`, ...notes].join('\n');
  });
  return [
    `# LLM-judge prompt · RAG answer evaluation (Ragas / DeepEval method)${state.title ? ' · ' + state.title : ''}`,
    '',
    'You are an impartial evaluation judge for a retrieval-augmented support assistant. Judge every test case below.',
    'Use ONLY the retrieved context and the approved answer given in each case, never your own knowledge. Regulatory or scheme time limits that the context does not state must not be assumed.',
    '',
    '## Method (apply the steps to every case)',
    '1. Claims: break the model answer into atomic claims (one fact each, pronouns resolved, no greetings).',
    '2. Faithfulness (Ragas): give each claim a verdict. "supported" only if it can be inferred from the retrieved context; otherwise "unsupported" (contradicted, or simply not there). faithfulness_ratio = supported claims / claims.',
    '3. Answer correctness (Ragas factual correctness): compare the claims with the approved answer. TP = facts present in both, FP = answer facts that contradict the approved answer, FN = approved facts missing from the answer. correctness_f1 = TP / (TP + 0.5 × (FP + FN)). The same value in another unit is the same fact (120 days ≈ 4 months); a flipped yes / no or a flipped negation is a contradiction.',
    '4. Context recall (Ragas): share of the approved answer\'s claims that can be attributed to the retrieved context.',
    '5. Answer relevancy: does the answer address the question, without padding?',
    '6. Refusal (must_refuse / must_escalate / needs_clarification cases only): did the assistant refuse / hand off / ask a clarifying question, and leak nothing?',
    '7. Thresholds (DeepEval style) → 0 or 1 per metric: faithfulness = 1 only if faithfulness_ratio = 1.0; correctness = 1 only if there is no FP and correctness_f1 ≥ 0.8; context_recall = 1 if ≥ 0.5; answer_relevance and correct_refusal are 0 or 1.',
    '8. Reason: one sentence per case that names the claim that decided the score.',
    '',
    '## Scored example',
    'Context: "you can dispute a Visa card payment up to 120 days after the transaction date". Approved answer: "Up to 120 days after the transaction date." Model answer: "You have 180 days to dispute, and there is no need to keep the receipt."',
    '{"id": "EX-1", "claims": [{"claim": "The customer has 180 days to dispute", "verdict": "unsupported", "reason": "the context says 120 days"}, {"claim": "The receipt does not need to be kept", "verdict": "unsupported", "reason": "not in the context"}], "faithfulness_ratio": 0, "correctness_f1": 0, "faithfulness": 0, "correctness": 0, "context_recall": 1, "answer_relevance": 1, "reason": "Invented 180-day time limit (source: 120 days)."}',
    '',
    `## Test cases (${r.items.length})`,
    'The "Offline rule check" lines come from a deterministic pre-check (numbers and units, negation, terms missing from the context). Treat them as hints, not as truth: confirm or overturn them.',
    '', cases.join('\n\n'), '',
    '## Output',
    'Answer ONLY with JSON, one entry per test case, in this shape:',
    '{"overrides": [{"id": "…", "claims": [{"claim": "…", "verdict": "supported|unsupported", "reason": "…"}], "faithfulness_ratio": 0.0, "correctness_f1": 0.0, "faithfulness": 0, "correctness": 0, "context_recall": 0, "answer_relevance": 0, "correct_refusal": 0, "reason": "one sentence"}]}',
    'Leave out correct_refusal on answerable cases, and answer_relevance / context_recall on refusal cases.',
    fr ? 'Write the reasons in French.' : 'Write the reasons in English.',
  ].join('\n');
}
function promptCauses(state) {
  const r = evaluate(state);
  return ['Classify each failed evaluation item by root cause (missing content → knowledge team, retrieval miss → data science, generation error → prompt / model, guardrail gap → security & compliance, wrong expected answer → fix the golden set) and give the next action and owner. Then say whether the release decision should change.',
    '', toMarkdown(state), getLang() === 'fr' ? 'Answer in French.' : 'Answer in English.'].join('\n');
}

/* ---------------------------------------------------------------- view */
let selId = null;
function mount(el, ctx) {
  const { ui } = ctx;
  const S = () => ctx.state;
  // command bar: threshold · run label
  const thr = ui.input({ type: 'number', value: S().threshold ?? 90, mono: true, onInput: (v) => ctx.setState({ threshold: v === '' ? '' : +v }, { silent: true }) });
  thr.min = '0'; thr.max = '100';
  ctx.frame.command.append(
    ctx.frame.bindField('threshold', ui.field({ label: T('threshold'), help: T('thresholdHint'), required: true, input: thr })),
    ui.field({ label: T('runLabel'), help: T('runLabelHint'), input: ui.input({ value: S().title || '', onInput: (v) => ctx.setState({ title: v }, { silent: true }) }) }),
  );
  // config: golden | answers
  const mk = (key, hintKey) => {
    const ta = ui.textarea({ value: S()[key] || '', rows: 16, mono: true, onInput: (v) => { ctx.setState({ [key]: v }, { silent: true }); info(); } });
    ta.classList.add('re-csv'); ta.spellcheck = false; ta.wrap = 'off';
    const f = ctx.frame.bindField(key, ui.field({ label: T(key), help: T(hintKey), input: ta, required: true }));
    const meta = h('p', 're-meta');
    const w = h('div', 're-tab'); w.append(f, meta);
    return { w, meta };
  };
  const g = mk('golden', 'goldenHint');
  const a = mk('answers', 'answersHint');
  const tabs = ui.tabs({ tabs: [{ id: 'golden', label: T('golden') }, { id: 'answers', label: T('answers') }], active: 'golden', panels: { golden: g.w, answers: a.w } });
  function info() {
    const gi = goldenFromCsv(S().golden || ''); const ai = answersFromCsv(S().answers || '');
    g.meta.textContent = gi.error ? T(gi.error) : fmt('parsedGolden', { n: gi.items.length, high: gi.items.filter((x) => x.risk === 'high').length });
    const miss = (gi.items || []).filter((x) => !(ai.answers || {})[x.id]).map((x) => x.id);
    a.meta.textContent = ai.error ? T(ai.error) : fmt('parsedAnswers', { n: Object.keys(ai.answers).length }) + (miss.length ? ' · ' + fmt('missing', { list: miss.join(', ') }) : '');
    tabs.setCount('golden', (gi.items || []).length || ''); tabs.setCount('answers', Object.keys(ai.answers || {}).length || '');
  }
  // advanced: gates + judge JSON
  const gates = { ...DEFAULT_GATES, ...(S().gates || {}) };
  const gw = h('div', 're-gates');
  for (const k of Object.keys(DEFAULT_GATES)) {
    const i = ui.input({ type: 'number', value: gates[k], mono: true, size: 'sm', onInput: (v) => { gates[k] = +v || 0; ctx.setState({ gates: { ...gates } }, { silent: true }); advCount(); } });
    i.min = '0'; i.max = '100';
    gw.append(ui.field({ label: `${T('g_' + k)} (%)`, input: i }));
  }
  const jta = ui.textarea({ rows: 4, mono: true, placeholder: '{"overrides": [{"id": "DSP-02", "faithfulness": 0, "reason": "…"}]}' });
  const jf = ui.field({ label: T('judgeTitle'), help: T('judgeHint'), input: jta });
  const jb = ui.button({ label: T('judgeApply'), size: 'sm', icon: 'scale', onClick: () => {
    let list = [];
    try { const txt = jta.value.slice(jta.value.indexOf('{'), jta.value.lastIndexOf('}') + 1); const j = JSON.parse(txt); list = Array.isArray(j) ? j : j.overrides || []; } catch { list = []; }
    const ov = structuredClone(S().overrides || {}); const notes = { ...(S().judgeNotes || {}) }; let n = 0;
    for (const o of list) { if (!o || !o.id) continue; let k = 0; for (const m of METRICS) if (o[m] === 0 || o[m] === 1) { ov[o.id] = ov[o.id] || {}; ov[o.id][m] = o[m]; n++; k++; } if (k && typeof o.reason === 'string' && o.reason.trim()) notes[o.id] = o.reason.trim().slice(0, 400); }
    if (!n) { jf.setError(T('judgeBad')); return; }
    jf.setError(''); jta.value = '';
    ctx.setState({ overrides: ov, judgeNotes: notes }, { silent: true }); advCount(); rerender(); ctx.toast(fmt('judgeDone', { n }));
  } });
  const clr = ui.button({ label: T('clearOverrides'), size: 'sm', variant: 'ghost', icon: 'eraser', onClick: () => { ctx.setState({ overrides: {}, judgeNotes: {} }, { silent: true }); advCount(); rerender(); } });
  const advBody = h('div', 're-adv'); const ab = h('div', 'row'); ab.append(ui.copyButton({ text: () => promptJudge(S()), label: T('copyJudge'), variant: 'secondary' }), jb, clr);
  advBody.append(h('div', 'section-label', T('gatesTitle')), gw, h('div', 'section-label', T('judgeSection')), h('p', 're-sub', T('judgeSteps')), jf, ab);
  const adv = ui.advanced({ label: T('advanced'), body: advBody });
  const advCount = () => adv.setCount(Object.keys(DEFAULT_GATES).filter((k) => gates[k] !== DEFAULT_GATES[k]).length + Object.keys(S().overrides || {}).length);
  advCount();
  el.append(tabs, adv);
  info();
  ctx.frame.output.append(ui.emptyState({ icon: 'gauge', title: T('emptyTitle'), text: T(S().golden && S().answers ? 'invite' : 'emptyBody'),
    sample: { label: getLang() === 'fr' ? 'CB FR' : 'Visa EN', onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } }));
  function rerender() { if (!ctx.lastRun || ctx.guided) return; // guided demo: nothing is scored before the presenter's first run
    const r = evaluate(S()); ctx.lastRun = summary(r); renderAll(r, ctx); ctx.frame.setStatus(statusOf(ctx.lastRun)); }
  ctx.__reRerender = rerender;
}

const summary = (r) => ({ pass: r.pass, overall: r.overall, threshold: r.threshold, failedGates: r.gates.filter((g) => !g.pass).map((g) => g.id), n: r.items.length, failed: r.items.filter((i) => i.failed.length).map((i) => i.id) });
const statusOf = (s, ms) => (s.pass ? { tone: 'ok', text: fmt('statusPass', { score: dec(s.overall), n: s.n }), ms } : { tone: 'bad', text: fmt('statusBlock', { score: dec(s.overall), g: s.failedGates.length + (s.overall != null && s.overall < s.threshold ? 1 : 0) }), ms });

function renderAll(r, ctx) {
  const { ui } = ctx;
  const out = ctx.frame.output;
  out.replaceChildren();
  // verdict
  const v = h('section', `re-verdict tone-${r.pass ? 'ok' : 'bad'}`);
  const vh = h('div', 're-v-head');
  const big = h('div', 're-v-big'); big.append(ui.icon(r.pass ? 'circle-check' : 'circle-x', { size: 20 }), h('span', null, `${T('gate')}: ${r.pass ? T('pass') : T('block')}`));
  const score = h('div', 're-v-score');
  score.append(h('span', 're-v-l', T('overall')), h('span', 're-v-n num', r.overall == null ? '—' : `${dec(r.overall)} %`));
  vh.append(big, score);
  // threshold bar
  const bar = h('div', 're-bar'); bar.setAttribute('role', 'img'); bar.setAttribute('aria-label', fmt('overallLine', { score: dec(r.overall), thr: dec(r.threshold), ok: r.overallOk ? T('met') : T('notMet') }));
  const fill = h('span', `re-bar-fill tone-${r.overallOk ? 'ok' : 'bad'}`); fill.style.width = `${Math.max(0, Math.min(100, r.overall || 0))}%`;
  const mark = h('span', 're-bar-mark'); mark.style.left = `${Math.max(0, Math.min(100, r.threshold))}%`;
  const mlab = h('span', 're-bar-lab num', `${dec(r.threshold)} %`); mlab.style.left = `${Math.max(0, Math.min(100, r.threshold))}%`;
  bar.append(fill, mark, mlab);
  v.append(vh, bar, h('p', 're-sub', fmt('overallLine', { score: dec(r.overall), thr: dec(r.threshold), ok: r.overallOk ? T('met') : T('notMet') })));
  const rs = reasons(r), hl = highLines(r);
  if (r.pass) v.append(h('p', null, fmt('passText', { score: dec(r.overall), thr: dec(r.threshold) })));
  else { v.append(h('h3', null, T('reasons'))); const ul = h('ul'); for (const x of [...rs, ...hl]) ul.append(h('li', null, x)); v.append(ul); }
  if (r.missingAnswers.length) v.append(h('p', 're-warn', fmt('missing', { list: r.missingAnswers.join(', ') })));
  if (r.orphanAnswers.length) v.append(h('p', 're-warn', fmt('orphan', { list: r.orphanAnswers.join(', ') })));
  out.append(v);
  // gates
  const gs = h('section', 're-sec');
  gs.append(h('h2', null, T('gatesH')));
  gs.append(ui.table({ columns: [
    { key: 'name', label: T('colGate') },
    { key: 'value', label: T('colResult'), num: true, width: 96, format: (x) => pc(x) },
    { key: 't', label: T('colThr'), num: true, width: 96, format: (x) => `≥ ${dec(x * 100)} %` },
    { key: 'pass', label: '', width: 96, format: (x) => ui.badge({ text: x ? T('pass') : T('block'), tone: x ? 'ok' : 'bad' }) },
  ], rows: r.gates.map((x) => ({ ...x, name: T('g_' + x.id) })) }));
  out.append(gs);
  // questions table
  const qs = h('section', 're-sec');
  const judge = h('div', 're-judge');
  judge.append(h('p', 're-sub', T('heuristic')), ui.copyButton({ text: () => promptJudge(ctx.state), label: T('copyJudge'), variant: 'secondary' }));
  const how = h('details', 're-how'); how.append(h('summary', null, T('howTitle')));
  const howList = h('dl', 're-howlist');
  for (const m of METRICS) { const dt = h('dt'); dt.append(h('span', null, T('ml_' + m)), ui.badge({ text: T('method_' + METHOD[m]), tone: METHOD[m] === 'ragas' ? 'info' : 'neutral', icon: false })); howList.append(dt, h('dd', null, T('how_' + m))); }
  how.append(howList, h('p', 're-sub', T('howNote')));
  qs.append(h('h2', null, T('questions')), judge, how);
  const cell = (i, m) => {
    const v2 = i.metrics[m];
    const s = h('span', `re-m ${v2 === 1 ? 'is-pass' : v2 === 0 ? 'is-fail' : 'is-na'}${i.overridden.includes(m) ? ' is-ov' : ''}`);
    s.append(v2 === '' ? document.createTextNode('—') : ui.icon(v2 === 1 ? 'check' : 'x', { size: 14 }));
    const x = (i.ratios || {})[m];
    if (v2 !== '' && x && x.den && !i.overridden.includes(m) && (m === 'faithfulness' || m === 'context_recall')) { s.classList.add('has-ratio'); s.append(h('span', 're-m-r num', `${x.num}/${x.den}`)); }
    const rt = ratioText(i, m);
    s.title = `${T('ml_' + m)}: ${v2 === '' ? T('na') : v2 === 1 ? T('manualPass') : T('manualFail')}${rt ? ' · ' + rt : ''}${i.overridden.includes(m) ? ' · ' + T('overriddenBy') : ''}`;
    if (v2 !== '') s.setAttribute('aria-label', s.title);
    return s;
  };
  const detail = h('section', 're-detail');
  const tbl = ui.table({ columns: [
    { key: 'id', label: T('colId'), mono: true, width: 76 },
    { key: 'category', label: T('colCat') },
    { key: 'risk', label: T('colRisk'), width: 72, format: (x) => ui.badge({ text: T('risk_' + x), tone: x === 'high' ? 'warn' : 'neutral', icon: false }) },
    ...METRICS.map((m) => ({ key: '_' + m, label: T('m_' + m), width: 64, align: 'center', format: (_, row) => cell(row, m) })),
    { key: 'score', label: T('colScore'), num: true, width: 68, format: (x) => (x == null ? '—' : `${dec(x)} %`) },
  ], rows: r.items, onRowClick: (row) => { selId = row.id; paintDetail(); mark2(); } });
  tbl.classList.add('re-qtable');
  const mark2 = () => tbl.querySelectorAll('tbody tr').forEach((tr, k) => tr.classList.toggle('is-selected', r.items[k] && r.items[k].id === selId));
  qs.append(tbl, detail);
  out.append(qs);
  if (!selId || !r.items.some((i) => i.id === selId)) selId = (r.items.find((i) => i.failed.length) || r.items[0] || {}).id;
  mark2();
  function paintDetail() {
    detail.replaceChildren();
    const i = r.items.find((x) => x.id === selId);
    if (!i) { detail.append(h('p', 're-sub', T('pickRow'))); return; }
    const head = h('div', 're-d-head');
    head.append(h('h3', null, fmt('detail', { id: i.id })), ui.badge({ text: T('t_' + i.type), tone: 'neutral', icon: false }), ui.badge({ text: `${T('colRisk')} ${T('risk_' + i.risk)}`, tone: i.risk === 'high' ? 'warn' : 'neutral', icon: false }));
    const dl = h('dl', 're-dl');
    const row = (k, val, cls) => { dl.append(h('dt', null, T(k)), h('dd', cls, val || '—')); };
    row('q', i.question); row('expected', i.expected_answer); row('answer', i.answer);
    row('sources', i.expected_sources, 'mono'); row('retrieved', i.retrieved, 'mono'); row('cited', (i.detail.cited || []).join(', '), 'mono');
    detail.append(head, dl);
    // per-answer explainer: the answer with every claim highlighted, then one line per claim with its reasons
    detail.append(h('div', 'section-label', T('claims')));
    if (i.detail.noAnswer) detail.append(h('p', 're-sub', '—'));
    else {
      const tone = (c) => (c.status === 'bad' ? 'bad' : c.status === 'warn' ? 'warn' : 'ok');
      const para = h('p', 're-answer');
      for (const sg of i.segments) {
        if (sg.claim < 0) { para.append(sg.flag ? h('mark', 're-c is-' + sg.flag, sg.raw) : document.createTextNode(sg.raw)); continue; }
        const c = i.claims[sg.claim]; const mk = h('mark', 're-c is-' + tone(c), sg.raw);
        mk.title = c.reasons.map(whyText).join(' · ') || T('st_ok'); para.append(mk);
      }
      const legend = h('p', 're-legend');
      for (const k of ['ok', 'warn', 'bad']) { const sp = h('span', null); sp.append(h('mark', 're-c is-' + k, T('st_' + k)), document.createTextNode(' ' + T('lg_' + k))); legend.append(sp); }
      detail.append(para, legend);
      if (i.detail.noContext) detail.append(h('p', 're-warn', T('noContext')));
      if (i.detail.yesNo) detail.append(h('p', 're-why is-bad', fmt('rs_yesNoGolden', { says: T(i.detail.yesNo.answer > 0 ? 'yes' : 'no'), ref: T(i.detail.yesNo.golden > 0 ? 'yes' : 'no') })));
      const ul = h('ul', 're-claims');
      for (const c of i.claims) {
        const li = h('li', 'is-' + tone(c));
        li.append(ui.badge({ text: T('st_' + tone(c)), tone: tone(c) }), h('span', 're-ctext', c.text));
        const why = h('ul', 're-whys');
        for (const x of c.reasons) { const w = h('li', 're-why is-' + x.level); w.append(h('b', null, T('sc_' + x.scope) + ' '), document.createTextNode(whyText(x))); why.append(w); }
        if (!c.reasons.length) why.append(h('li', 're-why is-ok', T(i.context ? 'rs_allFound' : 'rs_noCheck')));
        li.append(why); ul.append(li);
      }
      if (i.claims.length) detail.append(ul);
    }
    if (i.refClaims && i.refClaims.length) {
      detail.append(h('div', 'section-label', T('refClaims')));
      const ul = h('ul', 're-claims');
      for (const r of i.refClaims) {
        const li = h('li', 'is-' + r.status);
        li.append(ui.badge({ text: T('rf_' + r.status), tone: r.status }), h('span', 're-ctext', r.text));
        const why = h('ul', 're-whys'); why.append(h('li', 're-why is-' + r.status, refText(r))); li.append(why); ul.append(li);
      }
      detail.append(ul);
    }
    const notes = [];
    if (i.detail.citation) notes.push(T('cit_' + i.detail.citation));
    if (notes.length) detail.append(h('p', 're-sub', notes.join(' · ')));
    if (i.judgeNote) { const jn = h('p', 're-jnote'); jn.append(h('b', null, T('judgeSays') + ' '), document.createTextNode(i.judgeNote)); detail.append(jn); }
    // overrides
    detail.append(h('div', 'section-label', T('scores')));
    const grid = h('div', 're-ov');
    for (const m of METRICS) {
      const ov = ((ctx.state.overrides || {})[i.id] || {})[m];
      const autoTxt = i.auto[m] === '' ? T('na') : i.auto[m] === 1 ? T('manualPass') : T('manualFail');
      const sel = ui.select({ size: 'sm', value: ov === 0 || ov === 1 ? String(ov) : '', ariaLabel: T('ml_' + m), options: [{ value: '', label: `${T('auto')} (${autoTxt})` }, { value: '1', label: T('manualPass') }, { value: '0', label: T('manualFail') }],
        onChange: (val) => { const all = structuredClone(ctx.state.overrides || {}); all[i.id] = all[i.id] || {}; if (val === '') delete all[i.id][m]; else all[i.id][m] = +val; if (!Object.keys(all[i.id]).length) delete all[i.id]; ctx.setState({ overrides: all }, { silent: true }); ctx.__reRerender && ctx.__reRerender(); } });
      const f = h('label', 're-ov-row'); const lab = h('span', 're-ov-l'); lab.append(h('span', null, T('ml_' + m)), h('small', null, ratioText(i, m) || T('method_' + METHOD[m])));
      f.title = T('how_' + m); f.append(lab, sel);
      grid.append(f);
    }
    detail.append(grid);
    if (i.failed.length) {
      const csel = ui.select({ size: 'sm', value: (ctx.state.causes || {})[i.id] || '', ariaLabel: T('cause'),
        options: [{ value: '', label: i.causeSuggested ? `${T('c_' + i.cause)} (${T('suggested')})` : T('c_') }, ...CAUSES.map((c) => ({ value: c, label: T('c_' + c) }))],
        onChange: (val) => { const all = { ...(ctx.state.causes || {}) }; if (val) all[i.id] = val; else delete all[i.id]; ctx.setState({ causes: all }, { silent: true }); ctx.__reRerender && ctx.__reRerender(); } });
      const f = h('label', 're-ov-row re-cause'); f.append(h('span', null, T('cause')), csel);
      detail.append(f);
    }
  }
  paintDetail();
}

/* ---------------------------------------------------------------- module */
const sampleList = (lang) => SAMPLES[lang].map((s) => ({ id: s.id, label: s.title, hint: s.client, state: s.state }));

export default {
  id: 'rag-eval',
  skill: 'evaluating-rag-quality',
  icon: 'gauge',
  title: { en: 'RAG eval scorer', fr: 'Évaluation RAG' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  layout: 'split',
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'gauge' },
  schema: 1,
  defaults() {
    return { title: '', threshold: 90, golden: '', answers: '', gates: { ...DEFAULT_GATES }, overrides: {}, causes: {}, judgeNotes: {} };
  },
  samples: { en: sampleList('en'), fr: sampleList('fr') },
  mount,
  validate(s) {
    const e = [];
    if (s.threshold === '' || !(+s.threshold >= 0 && +s.threshold <= 100)) e.push({ field: 'threshold', message: T('errThreshold') });
    const g = goldenFromCsv(s.golden || '');
    if (g.error || !g.items.length) e.push({ field: 'golden', message: T('errGolden') });
    const a = answersFromCsv(s.answers || '');
    if (a.error || !Object.keys(a.answers).length) e.push({ field: 'answers', message: T('errAnswers') });
    return e;
  },
  run(state) { return summary(evaluate(state)); },
  renderResult(res, ctx) { renderAll(evaluate(ctx.state), ctx); },
  status: (s, ms) => statusOf(s, ms),
  toMarkdown,
  exports: [
    { id: 'csv', label: { en: strings.en.exportCsv, fr: strings.fr.exportCsv }, build: (s) => ({ name: 'eval_results.csv', mime: 'text/csv', text: resultsCsv(evaluate(s)) }) },
    { id: 'judge-prompt', label: { en: strings.en.exportJudge, fr: strings.fr.exportJudge }, build: (s) => ({ name: 'llm_judge_prompt.md', mime: 'text/markdown', text: promptJudge(s) }) },
  ],
  aiActions: [
    { id: 'judge', label: { en: strings.en.aiJudge, fr: strings.fr.aiJudge }, prompt: (s) => promptJudge(s), expects: 'json' },
    { id: 'causes', label: { en: strings.en.aiCauses, fr: strings.fr.aiCauses }, prompt: (s) => promptCauses(s), expects: 'markdown' },
  ],
  _internals: { toMarkdown, evaluate, promptJudge },
};
