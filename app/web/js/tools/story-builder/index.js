/* Story builder (writing-user-stories), owner H.
   Command bar: Feature · Persona · Rules → "Map examples" puts each rule on an Example Mapping board.
   Board (config pane): story tabs → rule cards (blue) → example cards (green, Given/When/Then) + question cards (red).
   Results pane: INVEST per story with plain reasons and Ready / Not ready, live Gherkin (EN Given/When/Then,
   FR Soit/Quand/Alors), preview. Offline SPIDR split by rule and example stubs; AI for real splits and examples.
   Exports: Jira CSV, .feature, Markdown. Works with no AI and no network. */
import { register, getLang, colon } from '../../core/i18n.js';
import { renderMarkdown } from '../../core/markdown.js';
import strings from './i18n.js';
import SAMPLES from './samples.js';
import { buildMap, emptyState, ids, KINDS, lintExample, newExample, newRule, newStory, POINTS, PRIORITIES, readiness, splitByRule, storyLine, stubExamples, summary, toFeature, toJiraCsv, toMarkdown } from './logic.js';
import { checkItem, debounce, fileBase, makeT } from '../prd-builder/shared.js';

register('story-builder', strings);
const TT = makeT(strings);
const T = TT.ui;
const docT = (s) => TT.doc(s.lang);

function mount(el, ctx) {
  const { ui, frame } = ctx;
  const st = () => ctx.state;
  if (!Array.isArray(st().stories)) ctx.setState(emptyState(getLang()), { silent: true, replace: true });
  const mut = (fn, repaint = true) => { const s = structuredClone(st()); fn(s); ctx.setState(s, { replace: true }); if (repaint) paintBoard(); };

  /* ---- command bar */
  const fFeature = frame.bindField('feature', ui.field({ label: T('in.feature'), help: T('in.feature.help'), required: true, input: ui.input({ value: st().feature, placeholder: T('in.feature.ph'), onInput: (v) => ctx.setState({ feature: v }) }) }));
  const fPersona = frame.bindField('persona', ui.field({ label: T('in.persona'), help: T('in.persona.help'), required: true, input: ui.input({ value: st().persona, placeholder: T('in.persona.ph'), onInput: (v) => ctx.setState({ persona: v }) }) }));
  const fRules = frame.bindField('rulesText', ui.field({ label: T('in.rules'), help: T('in.rules.help'), required: true, input: ui.textarea({ value: st().rulesText, rows: 3, placeholder: T('in.rules.ph'), onInput: (v) => ctx.setState({ rulesText: v }) }) }));
  fRules.classList.add('h-wide');
  frame.command.append(fFeature, fPersona, fRules);

  /* ---- Advanced */
  const advBody = document.createElement('div'); advBody.className = 'h-adv-grid';
  const adv = ui.advanced({ body: advBody });
  const advCount = () => ['epic', 'labels', 'project'].filter((k) => String(st()[k] || '').trim()).length + (st().lang === 'fr' && getLang() !== 'fr' ? 1 : 0);
  const advIn = (key, label, help) => advBody.append(ui.field({ label, help, input: ui.input({ value: st()[key] || '', onInput: (v) => { ctx.setState({ [key]: v }); adv.setCount(advCount()); } }) }));
  advIn('epic', T('adv.epic')); advIn('labels', T('adv.labels'), T('adv.labels.help')); advIn('project', T('adv.project'));
  advBody.append(ui.field({ label: T('adv.lang'), input: ui.segmented({ value: st().lang || 'en', label: T('adv.lang'), options: [{ value: 'en', label: 'English' }, { value: 'fr', label: 'Français' }], onChange: (v) => { ctx.setState({ lang: v }); adv.setCount(advCount()); } }) }));
  adv.setCount(advCount());

  const aiBox = document.createElement('div');
  const board = document.createElement('div'); board.className = 'sb-board-host';
  el.append(adv, aiBox, board);

  function paintAi() {
    aiBox.replaceChildren(); aiBox.className = '';
    const ai = st().ai || {};
    const got = ['split', 'examples'].filter((k) => ai[k] && Array.isArray(ai[k].stories));
    if (!got.length) return;
    aiBox.className = 'h-ai-banner';
    const p = document.createElement('p'); p.textContent = T('aiDraft.ready');
    aiBox.append(ui.badge({ text: T('aiDraft.badge'), tone: 'accent', icon: 'sparkles' }), p,
      ui.button({ label: T('aiDraft.apply'), size: 'sm', variant: 'primary', onClick: () => mut((s) => { for (const k of got) { s.stories = mergeStories(s.stories, ai[k].stories); delete s.ai[k]; } }) }),
      ui.button({ label: T('aiDraft.dismiss'), size: 'sm', variant: 'ghost', onClick: () => mut((s) => { for (const k of got) delete s.ai[k]; }) }));
  }

  /* ---- board */
  function paintBoard() {
    paintAi();
    const s = st();
    board.replaceChildren();
    if (!s.stories.length) {
      board.append(ui.emptyState({ icon: 'layout-grid', title: T('empty.title'), text: T('empty.body'), action: { label: T('run'), onClick: () => frame.runNow(), kbd: ui.kbdLabel('mod+enter') },
        sample: { label: T('sample.load'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } }));
      return;
    }
    const active = s.stories.find((x) => x.id === s.active) || s.stories[0];
    // story switcher: tabs with Ready marks in the label (text, not colour only)
    const bar = document.createElement('div'); bar.className = 'sb-storybar';
    const tabs = ui.tabs({ tabs: s.stories.map((x) => ({ id: x.id, label: `${x.id} · ${short(x.title)}`, count: readiness(x, s).ready ? '✓' : '' })), active: active.id,
      onChange: (id) => { ctx.setState({ active: id }, { silent: true }); paintBoard(); } });
    bar.append(tabs, ui.button({ label: T('add.story'), size: 'sm', icon: 'plus', variant: 'ghost', onClick: () => mut((x) => { const id = ids.story(x); x.stories.push(newStory(id, { soThat: '' })); x.active = id; }) }));
    board.append(bar, storyCard(active, s), mapBoard(active, s));
  }

  function storyCard(story, s) {
    const card = document.createElement('section');
    card.className = 'sb-card sb-story';
    card.setAttribute('aria-label', `${T('card.story')} ${story.id}`);
    const head = document.createElement('div'); head.className = 'sb-card-head';
    const tag = document.createElement('span'); tag.className = 'sb-tag'; tag.textContent = `${T('card.story')} · ${story.id}`;
    const r = readiness(story, s);
    head.append(tag, ui.badge({ text: r.ready ? T('ready') : T('notReady'), tone: r.ready ? 'ok' : 'bad', icon: r.ready ? 'circle-check' : 'circle-x' }));
    const tools = document.createElement('div'); tools.className = 'h-sec-tools';
    const split = ui.button({ label: T('split'), size: 'sm', icon: 'split', title: T('split.help'), disabled: story.rules.length < 2, onClick: () => { ctx.setState(splitByRule(st(), story.id), { replace: true }); paintBoard(); ctx.toast(T('split.done')); } });
    tools.append(split, ui.button({ icon: 'trash-2', size: 'sm', variant: 'ghost', ariaLabel: T('remove.story', { id: story.id }), title: T('remove.story', { id: story.id }), disabled: s.stories.length < 2,
      onClick: () => mut((x) => { x.stories = x.stories.filter((y) => y.id !== story.id); x.active = x.stories[0] && x.stories[0].id; }) }));
    head.append(tools);
    const set = (k, v) => mut((x) => { x.stories.find((y) => y.id === story.id)[k] = v; }, false);
    const grid = document.createElement('div'); grid.className = 'sb-story-grid';
    const title = ui.field({ label: T('f.title'), help: T('f.title.help'), input: ui.input({ value: story.title, onInput: (v) => set('title', v) }) });
    title.classList.add('h-span2');
    const want = ui.field({ label: T('f.want'), input: ui.input({ value: story.want, onInput: (v) => set('want', v) }) });
    const so = ui.field({ label: T('f.soThat'), input: ui.input({ value: story.soThat, onInput: (v) => set('soThat', v) }) });
    const pts = ui.field({ label: T('f.points'), input: ui.select({ value: String(story.points ?? ''), options: POINTS.map((p) => ({ value: String(p), label: p === '' ? '—' : String(p) })), onChange: (v) => set('points', v === '' ? '' : +v) }) });
    const prio = ui.field({ label: T('f.priority'), input: ui.select({ value: story.priority, options: PRIORITIES.map((p) => ({ value: p, label: T('prio.' + p) })), onChange: (v) => set('priority', v) }) });
    const dep = ui.field({ label: T('f.dependsOn'), help: T('f.dependsOn.help'), input: ui.input({ value: story.dependsOn, mono: true, onInput: (v) => set('dependsOn', v) }) });
    const src = ui.field({ label: T('f.source'), help: T('f.source.help'), input: ui.input({ value: story.source, onInput: (v) => set('source', v) }) });
    const chk = ui.field({ label: T('f.checklist'), help: T('f.checklist.help'), optional: true, input: ui.textarea({ value: story.checklist, rows: 2, onInput: (v) => set('checklist', v) }) });
    chk.classList.add('h-span2');
    grid.append(title, want, so, pts, prio, dep, src, chk);
    const line = document.createElement('p'); line.className = 'sb-line'; line.textContent = storyLine(story, s.persona, s.lang);
    card.append(head, line, grid);
    return card;
  }

  function mapBoard(story, s) {
    const wrap = document.createElement('div'); wrap.className = 'sb-map';
    const head = document.createElement('div'); head.className = 'h-sec-head';
    const h = document.createElement('h2'); h.textContent = T('tab.board');
    const tools = document.createElement('div'); tools.className = 'h-sec-tools';
    tools.append(
      ui.button({ label: T('add.rule'), size: 'sm', icon: 'plus', onClick: () => mut((x) => { x.stories.find((y) => y.id === story.id).rules.push(newRule(ids.rule(x), '')); }) }),
      ui.button({ label: T('stub'), size: 'sm', icon: 'sparkles', variant: 'ghost', disabled: !story.rules.some((r) => !r.examples.length), onClick: () => { ctx.setState(stubExamples(st(), story.id, TT.doc(st().lang)), { replace: true }); paintBoard(); } }),
    );
    head.append(h, tools);
    const cols = document.createElement('div'); cols.className = 'sb-cols';
    story.rules.forEach((rule) => cols.append(ruleColumn(rule, story, s)));
    cols.append(questionColumn(story));
    wrap.append(head, cols);
    return wrap;
  }

  function ruleColumn(rule, story, s) {
    const col = document.createElement('div'); col.className = 'sb-col';
    const rc = document.createElement('div'); rc.className = 'sb-card sb-rule';
    const rh = document.createElement('div'); rh.className = 'sb-card-head';
    const tag = document.createElement('span'); tag.className = 'sb-tag'; tag.textContent = `${T('card.rule')} · ${rule.id}`;
    rh.append(tag);
    if (s.stories.length > 1) {
      const sel = ui.select({ value: story.id, size: 'sm', ariaLabel: T('move.label', { id: rule.id }), options: s.stories.map((x) => ({ value: x.id, label: `${T('moveTo')} ${x.id}` })),
        onChange: (to) => mut((x) => { const from = x.stories.find((y) => y.id === story.id); const r = from.rules.find((y) => y.id === rule.id); from.rules = from.rules.filter((y) => y.id !== rule.id); x.stories.find((y) => y.id === to).rules.push(r); }) });
      rh.append(sel);
    }
    rh.append(ui.button({ icon: 'trash-2', size: 'sm', variant: 'ghost', ariaLabel: `${T('remove')} ${rule.id}`, title: `${T('remove')} ${rule.id}`, onClick: () => mut((x) => { const y = x.stories.find((z) => z.id === story.id); y.rules = y.rules.filter((z) => z.id !== rule.id); }) }));
    const ta = ui.textarea({ value: rule.text, rows: 2, ariaLabel: `${T('f.rule')} ${rule.id}`, onInput: (v) => mut((x) => { findRule(x, rule.id).text = v; }, false) });
    rc.append(rh, ta);
    col.append(rc);
    if (!rule.examples.length) { const p = document.createElement('p'); p.className = 'sb-empty'; p.textContent = T('empty.rule'); col.append(p); }
    rule.examples.forEach((e) => col.append(exampleCard(e, rule)));
    col.append(ui.button({ label: T('add.example'), size: 'sm', icon: 'plus', variant: 'ghost', onClick: () => mut((x) => { findRule(x, rule.id).examples.push(newExample(ids.example(x), findRule(x, rule.id).examples.length ? 'fail' : 'happy')); }) }));
    return col;
  }

  function exampleCard(e, rule) {
    const c = document.createElement('div'); c.className = 'sb-card sb-example';
    const h = document.createElement('div'); h.className = 'sb-card-head';
    const tag = document.createElement('span'); tag.className = 'sb-tag'; tag.textContent = `${T('card.example')} · ${e.id}`;
    const kind = ui.select({ value: e.kind, size: 'sm', ariaLabel: `${T('f.kind')} ${e.id}`, options: KINDS.map((k) => ({ value: k, label: T('kind.' + k) })), onChange: (v) => mut((x) => { findEx(x, e.id).kind = v; }, false) });
    h.append(tag, kind, ui.button({ icon: 'trash-2', size: 'sm', variant: 'ghost', ariaLabel: `${T('remove')} ${e.id}`, title: `${T('remove')} ${e.id}`, onClick: () => mut((x) => { const r = findRule(x, rule.id); r.examples = r.examples.filter((y) => y.id !== e.id); }) }));
    const lint = document.createElement('ul'); lint.className = 'sb-lint';
    const paintLint = () => { lint.replaceChildren(...lintExample(findEx(st(), e.id) || e).map((l) => checkItem(ui, { ok: false, level: 'warn', text: T(l.key, l.vars) }))); };
    const kw = st().lang === 'fr' ? { given: 'Soit', when: 'Quand', then: 'Alors' } : { given: 'Given', when: 'When', then: 'Then' };
    const step = (k) => ui.field({ label: kw[k], input: ui.textarea({ value: e[k], rows: k === 'when' ? 1 : 2, onInput: (v) => { mut((x) => { findEx(x, e.id)[k] = v; }, false); paintLint(); } }) });
    const name = ui.field({ label: T('f.exName'), input: ui.input({ value: e.name, onInput: (v) => { mut((x) => { findEx(x, e.id).name = v; }, false); paintLint(); } }) });
    c.append(h, name, step('given'), step('when'), step('then'), lint);
    paintLint();
    return c;
  }

  function questionColumn(story) {
    const col = document.createElement('div'); col.className = 'sb-col sb-qcol';
    const h = document.createElement('div'); h.className = 'sb-colhead'; h.textContent = T('card.question');
    col.append(h);
    story.questions.forEach((q) => {
      const c = document.createElement('div'); c.className = 'sb-card sb-question';
      const head = document.createElement('div'); head.className = 'sb-card-head';
      const tag = document.createElement('span'); tag.className = 'sb-tag'; tag.textContent = `${T('card.question')} · ${q.id}`;
      const open = !String(q.answer || '').trim();
      head.append(tag, ui.badge({ text: open ? T('q.open') : T('q.answered'), tone: open ? 'warn' : 'ok', icon: open ? 'circle-help' : 'check' }),
        ui.button({ icon: 'trash-2', size: 'sm', variant: 'ghost', ariaLabel: `${T('remove')} ${q.id}`, title: `${T('remove')} ${q.id}`, onClick: () => mut((x) => { const y = x.stories.find((z) => z.id === story.id); y.questions = y.questions.filter((z) => z.id !== q.id); }) }));
      const setQ = (k, v, repaint) => mut((x) => { x.stories.find((z) => z.id === story.id).questions.find((z) => z.id === q.id)[k] = v; }, repaint);
      const ans = ui.input({ value: q.answer });
      ans.addEventListener('change', () => setQ('answer', ans.value, true));
      ans.addEventListener('input', () => setQ('answer', ans.value, false));
      c.append(head, ui.field({ label: T('f.question'), input: ui.textarea({ value: q.text, rows: 2, onInput: (v) => setQ('text', v, false) }) }), ui.field({ label: T('f.answer'), help: T('f.answer.help'), input: ans }));
      col.append(c);
    });
    col.append(ui.button({ label: T('add.question'), size: 'sm', icon: 'plus', variant: 'ghost', onClick: () => mut((x) => { const y = x.stories.find((z) => z.id === story.id); const all = x.stories.flatMap((z) => z.questions.map((q) => q.id)); let n = 0; all.forEach((i) => { const m = /(\d+)$/.exec(i); if (m) n = Math.max(n, +m[1]); }); y.questions.push({ id: 'Q' + (n + 1), text: '', answer: '' }); }) }));
    return col;
  }

  ctx._sbRepaint = paintBoard;
  paintBoard();
  paintResults(ctx);
}

const short = (t) => { const s = String(t || '…'); return s.length > 28 ? s.slice(0, 27) + '…' : s; };
const findRule = (s, id) => s.stories.flatMap((x) => x.rules).find((r) => r.id === id);
const findEx = (s, id) => s.stories.flatMap((x) => x.rules.flatMap((r) => r.examples)).find((e) => e.id === id);

/** AI stories (from kit.py patch) replace stories with the same id and append the new ones. */
function mergeStories(cur, incoming) {
  const out = cur.map((x) => ({ ...x }));
  for (const n of incoming) {
    const full = { ...newStory(n.id || 'S' + (out.length + 1)), ...n, rules: (n.rules || []).map((r) => ({ id: r.id, text: r.text || '', examples: (r.examples || []).map((e) => ({ ...newExample(e.id), ...e })) })), questions: n.questions || [] };
    const i = out.findIndex((x) => x.id === full.id);
    if (i >= 0) out[i] = full; else out.push(full);
  }
  return out;
}

/* ---------------------------------------------------------------------------------------------- results */
function paintResults(ctx) {
  const { ui, frame } = ctx;
  const s = ctx.state;
  if (!s.stories || !s.stories.length) { frame.setStatus(null); frame.output.replaceChildren(ui.emptyState({ icon: 'list-checks', title: T('empty.title'), text: T('empty.body') })); return; }
  const sum = summary(s);
  frame.setStatus(statusOf(sum));

  const storiesP = document.createElement('div'); storiesP.className = 'sb-invest';
  for (const { s: story, r } of sum.list) {
    const sec = document.createElement('section'); sec.className = 'sb-inv-story';
    const h = document.createElement('div'); h.className = 'h-sec-head';
    const t = document.createElement('h2'); t.textContent = `${story.id} · ${story.title || '…'}`;
    h.append(t, ui.badge({ text: r.ready ? T('ready') : T('notReady'), tone: r.ready ? 'ok' : 'bad', icon: r.ready ? 'circle-check' : 'circle-x' }));
    const ul = document.createElement('ul'); ul.className = 'h-checks';
    for (const x of r.invest) ul.append(checkItem(ui, { ok: x.ok, level: x.level === 'warn' ? 'warn' : 'block', text: `${x.letter} · ${T('inv.' + x.letter)}${colon()}${T(x.key, x.vars)}`, onClick: x.ok ? null : () => { ctx.setState({ active: story.id }, { silent: true }); ctx._sbRepaint(); } }));
    const ac = document.createElement('p'); ac.className = 'h-note';
    const nEx = story.rules.reduce((a, rr) => a + rr.examples.length, 0);
    ac.textContent = `${T('scenarios', { n: nEx })}${String(story.checklist || '').trim() ? ` · ${T('md.checklist')}${colon()}${story.checklist.split('\n').filter(Boolean).length}` : ''}`;
    sec.append(h, ul, ac);
    storiesP.append(sec);
  }

  const ghP = document.createElement('div');
  const feature = toFeature(s);
  const ghTools = document.createElement('div'); ghTools.className = 'h-meta-row';
  ghTools.append(ui.copyButton({ text: () => toFeature(ctx.state), label: T('copy') }));
  const code = ui.codeEditor({ value: feature, lang: 'gherkin', readonly: true, rows: 24, ariaLabel: 'Gherkin' });
  ghP.append(ghTools, code);

  const prevP = document.createElement('div'); prevP.className = 'h-preview markdown';
  const mdText = toMarkdown(s, docT(s));
  renderMarkdown(prevP, mdText).catch(() => { prevP.textContent = mdText; });

  const t = ui.tabs({ tabs: [{ id: 'stories', label: T('tab.stories'), count: `${sum.ready}/${sum.stories}` }, { id: 'gherkin', label: T('tab.gherkin'), count: sum.scenarios || '' }, { id: 'preview', label: T('tab.preview') }],
    active: ctx._sbTab || 'stories', panels: { stories: storiesP, gherkin: ghP, preview: prevP }, onChange: (id) => { ctx._sbTab = id; } });
  const box = document.createElement('div'); box.className = 'h-results'; box.append(t);
  frame.output.replaceChildren(box);
}
const statusOf = (sum) => ({ tone: sum.ready === sum.stories ? 'ok' : sum.ready ? 'warn' : 'bad', text: `${T('readyCount', { ok: sum.ready, n: sum.stories })} · ${T('scenarios', { n: sum.scenarios })} · ${T('questions', { n: sum.questions })}` });

/* ---------------------------------------------------------------------------------------------- AI prompts */
const langLine = (s) => (s.lang === 'fr' ? 'Write in French (Banque Lumière, CB terms). Gherkin: # language: fr, Soit / Quand / Alors / Et.' : 'Write in English (Harbor Bank, Visa terms). Gherkin: Given / When / Then / And.');
const storyJson = '{"stories": [{"id": "S1", "title", "want", "soThat", "points", "priority": "High|Medium|Low", "source", "rules": [{"id": "R1", "text", "examples": [{"id": "E1", "kind": "happy|fail|edge", "name", "given": "one step per line", "when": "one step", "then": "one step per line"}]}], "questions": [{"id": "Q1", "text", "answer": ""}]}]}';
function activeStory(s) { return s.stories.find((x) => x.id === s.active) || s.stories[0]; }
function splitPrompt(s) {
  const st = activeStory(s);
  return [
    'You are a product owner using the writing-user-stories skill (Analyst Kit). Split the story below with SPIDR,',
    'trying in order: Paths, Interfaces, Data, Rules, Spike. Name the technique used. Never split by technical layer; each slice must deliver user value and pass INVEST.',
    `Persona: ${s.persona}`, st ? `Story ${st.id}: ${storyLine(st, s.persona, s.lang)}` : '', '', 'Its example map and scenarios:', st ? toFeature(s, st.id) : '',
    '', `Answer with a short rationale, then ONE JSON object (merged by kit.py patch <workspace> <file> --action split): ${storyJson}`,
    'Keep the existing rule and example ids where they move; use new ids (S, R, E, Q followed by the next number) for new items. Fictional data, test cards only.', langLine(s),
  ].join('\n');
}
function examplesPrompt(s) {
  const st = activeStory(s);
  return [
    'You are a product owner running an Example Mapping session (writing-user-stories skill, Analyst Kit).',
    'For each rule of the story below, propose concrete examples: one happy path, each way the rule can fail, and one edge case (limit, expired, duplicate).',
    'One behaviour per scenario, exactly one When, concrete values (amounts, times, quoted messages), observable outcomes (what the user sees, never "the API returns 200").',
    'Add the questions nobody can answer yet as question cards.',
    `Persona: ${s.persona}`, st ? `Story ${st.id}: ${storyLine(st, s.persona, s.lang)}` : '', 'Rules:', ...(st ? st.rules.map((r) => `- ${r.id}: ${r.text}`) : []),
    '', `Answer with ONE JSON object (merged by kit.py patch <workspace> <file> --action examples): ${storyJson}`, 'Return the full story with its rules and examples.', langLine(s),
  ].join('\n');
}

/* ---------------------------------------------------------------------------------------------- module */
const sample = (x) => ({ id: x.id, label: x.label, hint: T('sample.hint'), state: (({ id, label, ...rest }) => rest)(x) });

export default {
  id: 'story-builder',
  skill: 'writing-user-stories',
  icon: 'book-open',
  title: { en: strings.en.title, fr: strings.fr.title },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'layout-grid' },
  layout: 'split',
  schema: 1,
  defaults: () => emptyState(getLang()),
  samples: { en: SAMPLES.en.map(sample), fr: SAMPLES.fr.map(sample) },
  mount,
  update: debounce((state, ctx) => paintResults(ctx), 150),
  validate(s) {
    const e = [];
    if (!String(s.feature || '').trim()) e.push({ field: 'feature', message: T('err.feature') });
    if (!String(s.persona || '').trim()) e.push({ field: 'persona', message: T('err.persona') });
    if (!String(s.rulesText || '').trim() && !s.stories.length) e.push({ field: 'rulesText', message: T('err.rules') });
    return e;
  },
  run(state, ctx) {
    const next = buildMap(state);
    ctx.setState(next, { silent: true, replace: true });
    if (ctx._sbRepaint) ctx._sbRepaint();
    return summary(next);
  },
  renderResult(r, ctx) { paintResults(ctx); },
  status: (sum) => statusOf(sum),
  toMarkdown: (s) => toMarkdown(s, docT(s)),
  exports: [
    { id: 'jira', label: { en: strings.en['exp.jira'], fr: strings.fr['exp.jira'] }, build: (s) => ({ name: fileBase(s.feature || 'stories') + '-jira.csv', mime: 'text/csv', text: toJiraCsv(s, docT(s)) }) },
    { id: 'feature', label: { en: strings.en['exp.feature'], fr: strings.fr['exp.feature'] }, build: (s) => ({ name: fileBase(s.feature || 'stories') + '.feature', mime: 'text/plain', text: toFeature(s) }) },
  ],
  aiActions: [
    { id: 'split', label: { en: strings.en['ai.split'], fr: strings.fr['ai.split'] }, expects: 'json', prompt: (s) => splitPrompt(s) },
    { id: 'examples', label: { en: strings.en['ai.examples'], fr: strings.fr['ai.examples'] }, expects: 'json', prompt: (s) => examplesPrompt(s) },
  ],
};
