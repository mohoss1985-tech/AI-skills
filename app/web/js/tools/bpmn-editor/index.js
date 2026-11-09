/* BPMN editor (modeling-processes), owner E.
   Process name · Actors · Steps → "Generate diagram" builds BPMN 2.0 with lanes and auto-layout (logic.js, a port of the
   skill's build_bpmn.py), then the user edits it in the bpmn-js 18.31.1 Modeler (vendored, lazy-loaded by core/lazy.js).
   Import/export .bpmn, SVG, PNG, step table synced from the diagram, validation hints. Works with no AI and no network.
   Licence: the bpmn.io watermark (bottom-right of the canvas) stays visible: nothing of ours sits over that corner. */
import { register, getLang } from '../../core/i18n.js';
import { loadBpmnModeler } from '../../core/lazy.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { buildXml, csvCell, GROUP, lint, modelFromXml, modelText, splitActors, stepRows, stepsToSpec } from './logic.js';

const T = register('bpmn-editor', strings);
const fmt = (k, v = {}) => T(k).replace(/\{(\w+)\}/g, (_, x) => (v[x] ?? ''));
const words = () => ({ start: T('wStart'), end: T('wEnd'), process: T('wProcess'), actor: T('wActor') });
const fileBase = (s) => String(s || 'process').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'process';
const typeLabel = (r) => {
  const merge = GROUP(r.type) === 'gateway' && r.type === 'exclusive' && !r.name && (r.next || []).length <= 1;
  const base = T('t_' + (merge ? 'merge' : r.type));
  return r.trigger && T('tr_' + r.trigger) !== 'bpmn-editor.tr_' + r.trigger ? `${base} (${T('tr_' + r.trigger)})` : base;
};

/* One live editor per screen. */
const live = { modeler: null, stage: null, canvas: null, ctx: null, model: null, checks: [], parse: [], syncTimer: 0, prevXml: null };

function buildFromInputs(state) {
  const { spec, problems } = stepsToSpec(state, words());
  if (!spec) return { xml: '', problems };
  return { xml: buildXml(spec), problems };
}

function lintMessage(c) {
  const name = c.name || T('unnamed');
  return fmt('lint_' + c.code, { name, n: c.n });
}
function parseMessage(p) { return fmt('p_' + p.code, p); }

/* ------------------------------------------------------------------ modeler */
async function ensureModeler(ctx) {
  const { output } = ctx.frame;
  if (!live.stage || !live.stage.isConnected) { output.replaceChildren(buildStage(ctx)); }
  if (live.modeler && live.modelerCanvas === live.canvas) return live.modeler;
  if (live.modeler) { try { live.modeler.destroy(); } catch {} live.modeler = null; }
  live.loading.hidden = false;
  let Modeler;
  try { Modeler = await loadBpmnModeler(); } catch (e) { live.loading.hidden = true; const err = new Error(T('errModeler')); err.hint = e.message; throw err; }
  live.loading.hidden = true;
  live.modeler = new Modeler({ container: live.canvas });
  live.modelerCanvas = live.canvas;
  live.modeler.on('commandStack.changed', () => { clearTimeout(live.syncTimer); live.syncTimer = setTimeout(() => sync(true), 250); });
  return live.modeler;
}

async function showXml(ctx, xml, { edited = false } = {}) {
  const m = await ensureModeler(ctx);
  live.empty.hidden = true;
  live.canvas.hidden = false;
  try { await m.importXML(xml); }
  catch (e) { const err = new Error(T('errImport')); err.hint = String(e.message || '').slice(0, 200); throw err; }
  readableFit(m);
  await sync(edited);
}

/** Fit the diagram; if that makes text too small, keep 65 % and start at the left (right of the palette): the user pans. */
function readableFit(m) {
  try {
    const c = m.get('canvas');
    c.zoom('fit-viewport', 'auto');
    const vb = c.viewbox();
    if (vb.scale < 0.65) { const s = 0.65; c.viewbox({ x: vb.inner.x - 96 / s, y: vb.inner.y - 24 / s, width: vb.outer.width / s, height: vb.outer.height / s }); }
  } catch { /* empty diagram */ }
}

/** Diagram → XML in state, step table, checks, status pill. */
async function sync(edited) {
  const ctx = live.ctx;
  if (!live.modeler || !ctx) return;
  let xml;
  try { ({ xml } = await live.modeler.saveXML({ format: true })); } catch { return; }
  if (edited) { ctx.setState({ xml, edited: true }, { silent: true }); live.parse = []; }
  else ctx.setState({ xml }, { silent: true });
  paintModel(ctx, xml);
}

function paintModel(ctx, xml) {
  try { live.model = modelFromXml(xml); } catch { live.model = null; }
  live.checks = live.model ? lint(live.model) : [];
  const rows = live.model ? stepRows(live.model) : [];
  if (live.table) live.table.setRows(rows.map((r) => ({ ...r, kind: typeLabel(r), nextText: r.next.map((x) => (x.label ? `[${x.label}] ` : '') + (x.name || T('unnamed'))).join(' · ') })));
  paintChecks(ctx);
  if (live.tabs) { live.tabs.setCount('steps', rows.length); live.tabs.setCount('checks', live.checks.filter((c) => c.level !== 'info').length + live.parse.length); }
  if (live.badge) live.badge.textContent = ctx.state.edited ? T('edited') : T('generated');
  ctx.frame.setStatus(statusFor(ctx));
}

function statusFor() {
  if (!live.model) return null;
  const n = live.model.nodes.length, l = live.model.lanes.length;
  const issues = live.checks.filter((c) => c.level !== 'info').length + live.parse.length;
  const bad = live.checks.some((c) => c.level === 'bad');
  return { tone: bad ? 'bad' : issues ? 'warn' : 'ok', text: `${fmt('statusText', { n, l })} · ${issues ? fmt('statusChecks', { n: issues }) : T('statusOk')}` };
}

function selectIds(ids) {
  if (!live.modeler || !ids || !ids.length) return;
  const reg = live.modeler.get('elementRegistry');
  const els = ids.map((id) => reg.get(id)).filter(Boolean);
  if (!els.length) return;
  live.modeler.get('selection').select(els);
  try { live.modeler.get('canvas').scrollToElement(els[0]); } catch {}
  live.canvas.querySelector('.djs-container')?.focus?.();
}

function paintChecks(ctx) {
  const ui = ctx.ui;
  if (!live.checksEl) return;
  const list = [...live.parse.map((p) => ({ level: 'warn', text: parseMessage(p), ids: [], src: true })), ...live.checks.map((c) => ({ level: c.level, text: lintMessage(c), ids: c.ids }))];
  live.checksEl.replaceChildren();
  if (!list.length) {
    const p = document.createElement('p'); p.className = 'be-ok';
    p.append(ui.icon('circle-check', { size: 16 }), document.createTextNode(T(live.model ? 'noChecks' : 'tableEmpty')));
    live.checksEl.append(p);
    return;
  }
  const ul = document.createElement('ul'); ul.className = 'be-checks';
  for (const c of list) {
    const li = document.createElement('li');
    li.append(ui.badge({ text: T('lvl_' + c.level), tone: c.level === 'info' ? 'info' : c.level, icon: c.level === 'bad' ? 'circle-x' : c.level === 'warn' ? 'triangle-alert' : 'info' }));
    const s = document.createElement('span'); s.textContent = c.text; li.append(s);
    if (c.ids && c.ids.length && live.modeler) li.append(ui.button({ label: T('show'), size: 'sm', variant: 'ghost', onClick: () => selectIds(c.ids) }));
    ul.append(li);
  }
  live.checksEl.append(ul);
}

/* ------------------------------------------------------------------ stage (results pane) */
function buildStage(ctx) {
  const { ui } = ctx;
  const stage = document.createElement('div'); stage.className = 'be-stage';
  const bar = document.createElement('div'); bar.className = 'be-bar';
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.bpmn,.xml,application/xml,text/xml'; file.hidden = true;
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0]; file.value = '';
    if (f) await importFile(ctx, f);
  });
  const imp = ui.button({ label: T('import'), icon: 'upload', size: 'sm', onClick: () => file.click() });
  const fit = ui.button({ label: T('fit'), icon: 'maximize', size: 'sm', variant: 'ghost', onClick: () => { try { live.modeler.get('canvas').zoom('fit-viewport', 'auto'); } catch {} } });
  const badge = document.createElement('span'); badge.className = 'be-src muted';
  const note = document.createElement('div'); note.className = 'be-note'; note.hidden = true; note.setAttribute('role', 'status');
  bar.append(imp, fit, file, badge, note);
  const wrap = document.createElement('div'); wrap.className = 'be-canvas-wrap'; wrap.setAttribute('aria-live', 'off');
  const canvas = document.createElement('div'); canvas.className = 'be-canvas'; canvas.setAttribute('role', 'application'); canvas.setAttribute('aria-label', T('canvasLabel')); canvas.hidden = true;
  const loading = document.createElement('div'); loading.className = 'be-loading muted'; loading.textContent = T('loading'); loading.hidden = true;
  const empty = ui.emptyState({ icon: 'workflow', title: T('emptyTitle'), text: T('emptyText'),
    action: { label: T('primary'), onClick: () => ctx.frame.runNow(), kbd: ui.kbdLabel('mod+enter') },
    sample: { label: T('loadSample'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });
  empty.classList.add('be-empty');
  wrap.append(canvas, loading, empty);
  stage.append(bar, wrap);
  Object.assign(live, { stage, canvas, loading, empty, badge, note });
  return stage;
}

function showNote(ctx, text, action) {
  const n = live.note; if (!n) return;
  n.replaceChildren(document.createTextNode(text));
  if (action) n.append(ctx.ui.button({ label: action.label, size: 'sm', variant: 'ghost', onClick: () => { n.hidden = true; action.onClick(); } }));
  n.hidden = false;
  clearTimeout(n._t); n._t = setTimeout(() => { n.hidden = true; }, 12000);
}

async function importFile(ctx, f) {
  const text = await f.text();
  try {
    const model = modelFromXml(text);
    await showXml(ctx, text, { edited: true });
    const patch = { xml: live.model ? ctx.state.xml : text, edited: true };
    if (!ctx.state.title && model.pools[0] && model.pools[0].name) patch.title = model.pools[0].name;
    if (!ctx.state.actors && model.lanes.length) patch.actors = model.lanes.map((l) => l.name).filter(Boolean).join(', ');
    ctx.setState(patch, { silent: true });
    showNote(ctx, fmt('imported', { name: f.name }));
  } catch (e) {
    ctx.frame.setStatus({ tone: 'bad', text: T('errImport') });
    showNote(ctx, T('errImport'));
  }
}

/* ------------------------------------------------------------------ AI draft (state.ai.draft, patched by kit.py) */
function readDraft(state) {
  let d = state.ai && state.ai.draft;
  if (!d) return null;
  if (typeof d === 'string') { const m = d.match(/\{[\s\S]*\}/); try { d = JSON.parse(m ? m[0] : d); } catch { return { bad: true }; } }
  if (!d || typeof d !== 'object' || !d.steps) return { bad: true };
  const steps = Array.isArray(d.steps) ? d.steps.join('\n') : String(d.steps);
  const actors = Array.isArray(d.actors) ? d.actors.join(', ') : String(d.actors || '');
  return { title: d.title || '', actors, steps, trigger: d.trigger || '', open: d.open_questions || [] };
}
function paintDraft(ctx) {
  const box = live.draftBox; if (!box) return;
  box.replaceChildren();
  const d = readDraft(ctx.state);
  if (!d || ctx.state.aiDismissed === JSON.stringify(ctx.state.ai && ctx.state.ai.draft)) { box.hidden = true; return; }
  box.hidden = false;
  const p = document.createElement('p');
  p.append(ctx.ui.icon('sparkles', { size: 16 }), document.createTextNode(d.bad ? T('draftBad') : fmt('draftReady', { n: d.steps.split('\n').filter((x) => x.trim()).length, a: splitActors(d.actors).length })));
  box.append(p);
  const row = document.createElement('div'); row.className = 'row';
  if (!d.bad) row.append(ctx.ui.button({ label: T('apply'), size: 'sm', variant: 'secondary', icon: 'check', onClick: async () => {
    ctx.setState({ title: d.title || ctx.state.title, actors: d.actors || ctx.state.actors, steps: d.steps, trigger: d.trigger || ctx.state.trigger, aiDismissed: JSON.stringify(ctx.state.ai.draft) }, { silent: true });
    await ctx.frame.remount();
    ctx.frame.runNow();
    showNote(ctx, T('draftApplied'));
  } }));
  row.append(ctx.ui.button({ label: T('dismiss'), size: 'sm', variant: 'ghost', onClick: () => { ctx.setState({ aiDismissed: JSON.stringify(ctx.state.ai.draft) }, { silent: true }); box.hidden = true; } }));
  box.append(row);
}

/* ------------------------------------------------------------------ exports helpers */
async function currentXml(state) {
  if (live.modeler && live.ctx && live.stage && live.stage.isConnected) { try { return (await live.modeler.saveXML({ format: true })).xml; } catch {} }
  if (state.xml) return state.xml;
  const { xml } = buildFromInputs(state);
  if (!xml) throw new Error(T('errNoDiagram'));
  return xml;
}
async function currentSvg() {
  if (!(live.modeler && live.stage && live.stage.isConnected && live.model)) throw new Error(T('errNoDiagram'));
  return (await live.modeler.saveSVG()).svg;
}
async function svgToPngBlob(svg) {
  const doc = new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement;
  const vb = (doc.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number);
  const w = Math.ceil(vb[2] || parseFloat(doc.getAttribute('width')) || 1200), h = Math.ceil(vb[3] || parseFloat(doc.getAttribute('height')) || 600);
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise((ok, bad) => { img.onload = ok; img.onerror = () => bad(new Error('PNG')); img.src = url; });
    const scale = Math.min(2, 8000 / Math.max(w, h));
    const c = document.createElement('canvas'); c.width = Math.round(w * scale); c.height = Math.round(h * scale);
    const g = c.getContext('2d'); g.fillStyle = 'white'; g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((ok) => c.toBlob(ok, 'image/png'));
  } finally { URL.revokeObjectURL(url); }
}

function modelFor(state) {
  const xml = state.xml || buildFromInputs(state).xml;
  if (!xml) return { xml: '', model: null };
  try { return { xml, model: modelFromXml(xml) }; } catch { return { xml, model: null }; }
}
const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');

function toMarkdown(state) {
  const { xml, model } = modelFor(state);
  const L = [`## ${state.title || T('wProcess')}`, ''];
  if (!model) return L.concat(T('emptyText'), '').join('\n');
  L.push(`**${T('mdDiagram')}:** ${fmt('mdDiagramLine', { l: model.lanes.length, lanes: model.lanes.map((l) => l.name).join(', ') })}`, '');
  L.push('```bpmn', xml.trim(), '```', '');
  L.push(`### ${T('mdSteps')}`, '', `| ${T('colN')} | ${T('colType')} | ${T('colName')} | ${T('colLane')} | ${T('colNext')} |`, '|---|---|---|---|---|');
  for (const r of stepRows(model)) L.push(`| ${r.n} | ${typeLabel(r)} | ${mdCell(r.name || T('unnamed'))} | ${mdCell(r.lane)} | ${mdCell(r.next.map((x) => (x.label ? `[${x.label}] ` : '') + (x.name || '')).join(' · '))} |`);
  L.push('', `### ${T('mdChecks')}`, '');
  const checks = lint(model);
  if (checks.length) checks.forEach((c) => L.push(`- **${T('lvl_' + c.level)}:** ${lintMessage(c)}`)); else L.push(T('mdNoChecks'));
  if ((state.notes || '').trim()) L.push('', `### ${T('mdNotes')}`, '', ...state.notes.trim().split('\n').map((x) => '> ' + x));
  L.push('');
  return L.join('\n');
}

/* ------------------------------------------------------------------ AI prompts */
const langLine = () => (getLang() === 'fr' ? 'Answer in French (Banque Lumière, CB terms). Keep anything only the CB rulebook can confirm marked "à confirmer".' : 'Answer in English (Harbor Bank, Visa terms). Keep anything only a scheme rulebook can confirm marked "to confirm".');
const GRAMMAR = `Steps grammar (one step per line):
- "Actor: step" = a task in that actor's lane (verb + object, e.g. "Verify invoice").
- "Actor: question?" = a decision. Its branches follow, indented two spaces: "  Yes → Actor: step". Repeat the label for the next step of the same branch. "  Yes →" with nothing after = continue with the next unindented line.
- "(end) Outcome" = a named end event; "(wait) Delay" = timer; "(message) Event" = message event.
- "[id] step" names a step; "@id" jumps back to it (retries, loops).`;

function promptDraft(state) {
  const notes = (state.notes || '').trim() || (state.steps || '').trim();
  return [`You are a senior business process analyst (skill: modeling-processes). Turn the notes below into a BPMN process for the Analyst Kit BPMN editor.`,
    langLine(), '',
    'Method: list participants as lanes in hand-off order (roles, not people), the trigger, activities as verb + object, decisions as questions with every exit labelled, exceptions and rejections as branches, every path ending in a named end event. Anything the notes do not say goes into open_questions, never silently into the model.', '',
    GRAMMAR, '',
    'Return ONLY a JSON object: {"title": "...", "actors": ["lane 1", "lane 2"], "trigger": "...", "steps": "the steps text in the grammar above", "open_questions": ["..."]}', '',
    `Process name: ${state.title || '(not given)'}`, `Actors so far: ${state.actors || '(not given)'}`, '', 'Notes:', '"""', notes || '(no notes: ask the three questions that would unblock the model)', '"""'].join('\n');
}
function promptReview(state) {
  const { model } = modelFor(state);
  const checks = model ? lint(model).map((c) => `- ${c.level}: ${lintMessage(c)}`).join('\n') || '- none' : '- no diagram';
  return [`You are a senior business process analyst (skill: modeling-processes). Review this BPMN process: "${state.title || 'Process'}".`, langLine(), '',
    model ? modelText(model) : '(no diagram yet)', '', 'Automatic checks already found:', checks, '',
    'Review against: every task is verb + object and sits in a lane; every gateway is a question with labelled exits; every path ends in a named end event; exceptions and rejections are modelled, not only the happy path; 7–15 activities per level; one term per concept.',
    'Return Markdown: 1) verdict in one line, 2) issues as a table (element | problem | fix), 3) numbered open questions a stakeholder can answer yes/no or with a name, 4) at most 5 improvement notes (bottlenecks, missing controls, automation candidates), kept separate from the as-is model.',
    state.notes ? `\nSource notes:\n"""\n${state.notes}\n"""` : ''].join('\n');
}

/* ------------------------------------------------------------------ tool module */
export default {
  id: 'bpmn-editor',
  skill: 'modeling-processes',
  icon: 'workflow',
  title: { en: 'BPMN editor', fr: 'Éditeur BPMN' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  primary: { label: { en: strings.en.primary, fr: strings.fr.primary }, icon: 'workflow' },
  layout: 'split',
  schema: 1,
  defaults() {
    return { title: '', actors: '', steps: '', trigger: '', happyEnd: '', pool: '', notes: '', xml: '', edited: false };
  },
  samples: SAMPLES,

  mount(el, ctx) {
    const { ui, frame } = ctx;
    live.ctx = ctx;
    live.parse = [];
    const s = ctx.state;
    const set = (k) => (v) => { ctx.setState({ [k]: v }, { silent: true }); if (k in ADV) adv.setCount(advCount()); };
    frame.command.append(
      frame.bindField('title', ui.field({ label: T('name'), required: true, input: ui.input({ value: s.title, placeholder: T('namePh'), onInput: set('title') }) })),
      frame.bindField('actors', ui.field({ label: T('actors'), required: true, help: T('actorsHelp'), input: ui.input({ value: s.actors, placeholder: T('actorsPh'), onInput: set('actors') }) })),
    );
    frame.command.classList.add('be-command');
    const steps = frame.bindField('steps', ui.field({ label: T('steps'), required: true, help: T('stepsHelp'), input: ui.textarea({ value: s.steps, placeholder: T('stepsPh'), rows: 12, mono: true, onInput: set('steps') }) }));
    steps.classList.add('be-steps');
    const syn = document.createElement('details'); syn.className = 'be-syntax';
    const sum = document.createElement('summary'); sum.textContent = T('syntax');
    const ul = document.createElement('ul');
    for (const k of ['syn1', 'syn2', 'syn3', 'syn4', 'syn5', 'syn6']) { const li = document.createElement('li'); li.textContent = T(k); ul.append(li); }
    syn.append(sum, ul);

    const ADV = { trigger: 1, happyEnd: 1, pool: 1, notes: 1 };
    const advCount = () => Object.keys(ADV).filter((k) => String(ctx.state[k] || '').trim()).length;
    const advBody = document.createElement('div'); advBody.className = 'stack';
    advBody.append(
      ui.field({ label: T('trigger'), help: T('triggerHelp'), optional: true, input: ui.input({ value: s.trigger, onInput: set('trigger') }) }),
      ui.field({ label: T('happyEnd'), help: T('happyEndHelp'), optional: true, input: ui.input({ value: s.happyEnd, onInput: set('happyEnd') }) }),
      ui.field({ label: T('pool'), help: T('poolHelp'), optional: true, input: ui.input({ value: s.pool, onInput: set('pool') }) }),
      ui.field({ label: T('notes'), help: T('notesHelp'), optional: true, input: ui.textarea({ value: s.notes, rows: 5, onInput: set('notes') }) }),
    );
    const adv = ui.advanced({ label: T('advanced'), body: advBody, count: advCount() });

    const draftBox = document.createElement('div'); draftBox.className = 'be-draft'; draftBox.hidden = true;
    live.draftBox = draftBox;

    live.table = ui.table({
      columns: [
        { key: 'n', label: T('colN'), num: true, width: 40 },
        { key: 'kind', label: T('colType') },
        { key: 'name', label: T('colName'), format: (v) => v || T('unnamed') },
        { key: 'lane', label: T('colLane') },
        { key: 'nextText', label: T('colNext') },
      ],
      rows: [], empty: T('tableEmpty'), onRowClick: (r) => selectIds([r.id]),
    });
    live.checksEl = document.createElement('div'); live.checksEl.className = 'be-checks-wrap';
    live.tabs = ui.tabs({ tabs: [{ id: 'steps', label: T('tabSteps') }, { id: 'checks', label: T('tabChecks') }], active: 'checks', panels: { steps: live.table, checks: live.checksEl } });
    live.tabs.classList.add('be-tabs');
    el.append(steps, syn, adv, draftBox, live.tabs);
    paintDraft(ctx);

    frame.output.replaceChildren(buildStage(ctx));
    paintChecks(ctx);
    if (s.xml) {
      showXml(ctx, s.xml, { edited: false }).then(() => ctx.setState({ edited: s.edited }, { silent: true }), (e) => { ctx.frame.setStatus({ tone: 'bad', text: e.message }); showNote(ctx, e.message); });
    }
  },

  validate(s) {
    const e = [];
    if (!String(s.title || '').trim()) e.push({ field: 'title', message: T('errName') });
    if (!splitActors(s.actors).length) e.push({ field: 'actors', message: T('errActors') });
    if (String(s.steps || '').split('\n').filter((x) => x.trim()).length < 2) e.push({ field: 'steps', message: T('errSteps') });
    return e;
  },

  run(state) {
    const { xml, problems } = buildFromInputs(state);
    if (!xml) throw new Error(T('p_noSteps'));
    return { xml, problems };
  },

  async renderResult(r, ctx) {
    live.ctx = ctx;
    const prev = ctx.state.edited && ctx.state.xml ? ctx.state.xml : null;
    ctx.setState({ xml: r.xml, edited: false }, { silent: true });
    await showXml(ctx, r.xml, { edited: false });
    live.parse = r.problems.filter((p) => p.code !== 'noSteps');
    paintModel(ctx, ctx.state.xml);
    live.tabs.select(live.parse.length || live.checks.some((c) => c.level !== 'info') ? 'checks' : 'steps');
    if (prev) showNote(ctx, T('replaced'), { label: T('undo'), onClick: async () => { await showXml(ctx, prev, { edited: true }); showNote(ctx, T('restored')); } });
  },

  status() { return statusFor(); },

  tick: async (ctx) => {
    const id = ctx.workspace && ctx.workspace.id;
    if (!id) return;
    try {
      const ws = await ctx.store.get(id);
      const ai = ws && ws.state && ws.state.ai;
      if (ai && JSON.stringify(ai) !== JSON.stringify(ctx.state.ai || null)) { ctx.setState({ ai }, { silent: true }); paintDraft(ctx); }
    } catch { /* offline: try again on the next tick */ }
  },

  toMarkdown,

  exports: [
    { id: 'bpmn', label: { en: strings.en.exBpmn, fr: strings.fr.exBpmn }, build: async (s) => ({ name: fileBase(s.title) + '.bpmn', mime: 'application/xml', text: await currentXml(s) }) },
    { id: 'svg', label: { en: strings.en.exSvg, fr: strings.fr.exSvg }, build: async (s) => ({ name: fileBase(s.title) + '.svg', mime: 'image/svg+xml', text: await currentSvg() }) },
    { id: 'png', label: { en: strings.en.exPng, fr: strings.fr.exPng }, build: async (s) => ({ name: fileBase(s.title) + '.png', mime: 'image/png', text: await svgToPngBlob(await currentSvg()) }) },
    { id: 'csv', label: { en: strings.en.exCsv, fr: strings.fr.exCsv }, build: (s) => {
      const { model } = modelFor(s);
      if (!model) throw new Error(T('errNoDiagram'));
      const rows = [[T('colN'), T('colType'), T('colName'), T('colLane'), T('colNext')], ...stepRows(model).map((r) => [r.n, typeLabel(r), r.name, r.lane, r.next.map((x) => (x.label ? `[${x.label}] ` : '') + x.name).join(' · ')])];
      return { name: fileBase(s.title) + '-steps.csv', mime: 'text/csv', text: '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n' };
    } },
  ],

  aiActions: [
    { id: 'draft', label: { en: strings.en.aiDraft, fr: strings.fr.aiDraft }, expects: 'json', prompt: (s) => promptDraft(s) },
    { id: 'review', label: { en: strings.en.aiReview, fr: strings.fr.aiReview }, expects: 'markdown', prompt: (s) => promptReview(s) },
  ],
};
