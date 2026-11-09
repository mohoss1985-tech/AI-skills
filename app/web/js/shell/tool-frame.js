/* Tool frame: the DESIGN_SPEC §4 tool screen template, wrapped around a tool module (§8 interface).

   ┌ page head: crumb · title · one-line purpose ·· [Visa EN | CB FR] [Load sample ▾] ┐
   ├ command bar: ctx.frame.command (the 3–4 required inputs) ······ [Run ⌘↵]        ┤
   ├ config pane (ctx.frame.config)  │ results pane: status strip + ctx.frame.output  ┤
   └ action bar: Save as deliverable ⌘S · Export ▾ · Ask Claude ▾ (demo: Copy prompt for Claude) ┘

   Full contract with examples: research/wave1-A-api.md. Everything below is additive to research/07 §3.

   Tool module fields read by the frame (all optional except id, title, mount):
     purpose {en, fr}           one line under the title
     layout  'split' | 'single' default 'split' when the tool has run(), else 'single' (mount() gets an empty body)
     primary {label: {en, fr}}  primary button label (default "Run")
     validate(state) → [{message, field}]  before run; field = a key bound with ctx.frame.bindField(key, fieldEl)
     run(state, ctx) → result   the work (pure, or ctx.server.* locally)
     renderResult(result, ctx)  paint ctx.frame.output after a run (else the tool paints in run()/update())
     status(result) → statusPill opts ({status, text, ms, bytes, rows, tone}); default "Done · n ms"
     load(state, ctx)           repaint inputs after a sample / restore (else the frame remounts the tool)
     update(state, ctx)         called after every setState (unless {silent: true})
     samples {en: [S], fr: [S]} S = {id, label: str|{en,fr}, hint?, state, autorun?}
     exports [{id, label: str|{en,fr}, build(state, lastRun) → {name, mime, text}}]  (+ Markdown from toMarkdown, always)
     aiActions [{id, label: str|{en,fr}, prompt(state, run) → string, expects}]
     onSave(ctx)                ⌘S override (API tester: save as test case)
     migrate(oldState, oldSchema) → state   when a saved workspace has an older schema (else it is ignored)
     tick(ctx)                  3 s refresh hook (local app)

   ctx = {tool, state, setState(patch, {silent, replace}), lastRun, run(), ai(id, run), store, i18n, ui, server,
          frame, T(key), lang, toast, save(), publish(), workspace, loadSample(lang, index), download(name, mime, text)} */
import { DEMO, post, server } from '../core/api.js';
import { download as dl, esc } from '../core/dom.js';
import { getLang, pick, register, t } from '../core/i18n.js';
import { store } from '../core/store.js';
import * as ui from '../ui/index.js';
import { toolMeta, GROUP_LABEL } from '../tools/registry.js';

const cssLoaded = new Set();
/** Last state per tool in this tab: a language switch or back/forward remounts without losing the last keystrokes. */
const memo = new Map();
export function loadToolCss(id) {
  if (cssLoaded.has(id) || !toolMeta(id)) return;
  cssLoaded.add(id);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `js/tools/${id}/tool.css`;
  document.head.append(link);
}

const label = (x) => (x && typeof x === 'object' ? pick(x) : x || '');
const sampleQuery = () => { const m = location.hash.match(/[?&]sample=(en|fr)(?::(\d+))?/); return m ? { lang: m[1], i: +(m[2] || 0) } : null; };
const wsQuery = () => { const m = location.hash.match(/[?&]ws=(\d+)/); return m ? +m[1] : null; };

export function makeCtx(tool) {
  let state = tool.defaults ? tool.defaults() : {};
  let saveTimer = 0;
  const ctx = {
    tool,
    get state() { return state; },
    setState(patch, { silent = false, replace = false } = {}) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = replace ? { ...p } : { ...state, ...p };
      memo.set(tool.id, { state, workspace: ctx.workspace });
      if (!silent && tool.update) tool.update(state, ctx);
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => ctx.save().catch(() => {}), 1000);
      return state;
    },
    lastRun: null,
    lastRunId: null,
    workspace: null,
    async run() {
      if (!tool.run) return null;
      const t0 = performance.now();
      ctx.lastRun = await tool.run(state, ctx);
      const ms = Math.round(performance.now() - t0);
      ctx.lastRunId = null;
      if (ctx.workspace && ctx.workspace.id) store.addRun(ctx.workspace.id, { kind: tool.id, input: state, result: ctx.lastRun, ok: 1, ms }).then((r) => { ctx.lastRunId = r && r.id; }).catch(() => {});
      return ctx.lastRun;
    },
    /** Build the aiActions[id] prompt. Demo: show it with a Copy button. Local: send it to Claude. */
    async ai(actionId, run = ctx.lastRun) {
      const action = (tool.aiActions || []).find((a) => a.id === actionId);
      if (!action) throw new Error(`Unknown AI action: ${actionId}`);
      const prompt = action.prompt(state, run);
      if (DEMO) { promptDialog(label(action.label), prompt); return { copied: true, prompt }; }
      try {
        const ws = await ctx.save();
        if (ws && ws.id) { await post(`/api/workspaces/${ws.id}/ai`, { action: actionId, prompt, run_id: ctx.lastRunId || undefined, expects: action.expects || 'markdown' }); return { sent: true, prompt }; }
      } catch (e) { /* route not there yet: fall back to the general chat */ }
      await post('/api/chat', { body: prompt });
      return { sent: true, prompt };
    },
    store,
    i18n: { t, register, pick, get lang() { return getLang(); } },
    ui,
    server,
    frame: null,
    T: (k) => t(`${tool.id}.${k}`),
    get lang() { return getLang(); },
    toast: ui.toast,
    /** Save the tool state as a workspace (autosaved 1 s after each setState). Resolves to the workspace or null. */
    async save() {
      const ws = { ...(ctx.workspace || {}), tool: tool.id, title: state.title || label(tool.title), lang: getLang(), schema: tool.schema || 1, state };
      try { const saved = await store.save(ws); if (saved && saved.id) { ctx.workspace = saved; memo.set(tool.id, { state, workspace: saved }); } return ctx.workspace; } catch { return null; }
    },
    /** "Save as deliverable": toMarkdown → a deliverable with every V1 feature. Demo: downloads the Markdown. */
    async publish() {
      const md = tool.toMarkdown ? tool.toMarkdown(state, ctx.lastRun) : '';
      const title = state.title || label(tool.title);
      if (DEMO) { ctx.download(fileBase(title) + '.md', 'text/markdown', md); ui.toast(t('Demo: downloaded as Markdown. Run the app locally to keep deliverables.')); return null; }
      const ws = await ctx.save();
      if (!ws || !ws.id) throw new Error(t('Could not save the workspace. Is the local server running?'));
      const res = await post(`/api/workspaces/${ws.id}/publish`, { output: md, title });
      const rid = res && (res.request_id || (res.request && res.request.id) || res.id);
      if (rid) { ctx.workspace = { ...ctx.workspace, request_id: rid }; ui.toast(t('Saved as deliverable. Open it'), `#/d/${rid}`); }
      return res;
    },
    loadSample: (lang, i) => null, // set by mountTool
    download(name, mime, text) { dl(name, new Blob([text], { type: (mime || 'text/plain') + ';charset=utf-8' })); },
  };
  return ctx;
}

const fileBase = (s) => String(s || 'export').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'export';

function promptDialog(title, prompt) {
  const body = document.createElement('div');
  body.className = 'prompt-dialog';
  const p = document.createElement('p');
  p.textContent = t('This demo has no Claude connection. Copy the prompt and paste it into Claude; the local app sends it for you.');
  const code = ui.codeEditor({ value: prompt, readonly: true, rows: 12, lineNumbers: false, ariaLabel: t('Prompt') });
  body.append(p, code);
  ui.modal({ title: title || t('Copy prompt for Claude'), body, size: 'lg', actions: [
    { label: t('Close') },
    { label: t('Copy prompt'), variant: 'primary', onClick: async () => { try { await navigator.clipboard.writeText(prompt); ui.toast(t('Prompt copied')); } catch { ui.toast(t('Copy failed. Select the text and copy it.')); return false; } } },
  ] });
}

/** Render `tool` into `el`. Returns the view object the router keeps ({tick} or null). */
export async function mountTool(el, tool) {
  loadToolCss(tool.id);
  const ctx = makeCtx(tool);
  const meta = toolMeta(tool.id) || {};
  const layout = tool.layout || (tool.run ? 'split' : 'single');
  const title = label(tool.title);

  const root = document.createElement('div');
  root.className = `tool-frame tool-${tool.id} layout-${layout}`;
  root.dataset.tool = tool.id;

  // ---- page head
  const head = document.createElement('header');
  head.className = 'tf-head';
  head.innerHTML = `<div class="tf-titles"><div class="tf-eyebrow">${ui.iconSvg(tool.icon || meta.icon || 'wrench', 14)}<span>${esc(t(GROUP_LABEL[meta.group] || 'Tools'))}</span>${tool.skill ? `<span aria-hidden="true">·</span><a href="#/type/${esc(tool.skill)}">${esc(t('Skill page'))}</a>` : ''}</div>
    <h1 tabindex="-1">${esc(title)}</h1>${tool.purpose ? `<p class="purpose">${esc(label(tool.purpose))}</p>` : ''}</div><div class="tf-head-actions"></div>`;
  const headActions = head.querySelector('.tf-head-actions');

  // ---- command bar
  const commandWrap = document.createElement('div');
  commandWrap.className = 'tf-command';
  commandWrap.setAttribute('role', 'group');
  commandWrap.setAttribute('aria-label', t('Required inputs'));
  const command = document.createElement('div');
  command.className = 'tf-command-inputs';
  const primary = ui.button({ label: label(tool.primary && tool.primary.label) || t('Run'), variant: 'primary', icon: (tool.primary && tool.primary.icon) || 'play', kbd: ui.kbdLabel('mod+enter'), onClick: () => runNow() });
  primary.classList.add('tf-primary');
  commandWrap.append(command);
  if (tool.run) commandWrap.append(primary);
  const errors = document.createElement('div');
  errors.className = 'tf-errors'; errors.hidden = true; errors.setAttribute('role', 'alert'); errors.tabIndex = -1;

  // ---- body: config | results
  const body = document.createElement('div');
  body.className = 'tf-body';
  const config = document.createElement('div'); config.className = 'tf-config';
  const results = document.createElement('div'); results.className = 'tf-results';
  const strip = document.createElement('div'); strip.className = 'tf-status';
  const pill = ui.statusPill({ tone: 'neutral', text: t('No run yet') });
  const spin = ui.spinner({});
  const stripExtra = document.createElement('div'); stripExtra.className = 'tf-status-extra';
  strip.append(pill, spin, stripExtra);
  const output = document.createElement('div'); output.className = 'tf-output'; output.setAttribute('aria-live', 'polite');
  results.append(strip, output);

  // ---- action bar
  const actions = document.createElement('footer');
  actions.className = 'tf-actions';
  const actionsLeft = document.createElement('div'); actionsLeft.className = 'tf-actions-main';
  const actionsExtra = document.createElement('div'); actionsExtra.className = 'tf-actions-extra';
  const saveBtn = ui.button({ label: t('Save as deliverable'), icon: 'file-check', kbd: ui.kbdLabel('mod+s'), onClick: () => publish() });
  const exportMenu = ui.menu({ label: t('Export'), icon: 'download', items: [] });
  const aiMenu = ui.menu({ label: DEMO ? t('Copy prompt for Claude') : t('Ask Claude'), icon: 'sparkles', items: [] });
  const hint = document.createElement('span'); hint.className = 'tf-hint';
  hint.innerHTML = `<kbd>${esc(ui.kbdLabel('mod+k'))}</kbd> ${esc(t('Search'))}`;
  actionsLeft.append(saveBtn, exportMenu, aiMenu, actionsExtra);
  actions.append(actionsLeft, hint);

  const paintMenus = () => {
    exportMenu.setItems([
      ...(tool.exports || []).map((x) => ({ label: label(x.label), icon: 'file-down', onClick: () => doExport(x) })),
      ...(tool.toMarkdown ? [{ label: t('Markdown (.md)'), icon: 'file-text', onClick: () => doExport({ build: (s, r) => ({ name: fileBase(ctx.state.title || title) + '.md', mime: 'text/markdown', text: tool.toMarkdown(s, r) }) }) }] : []),
    ]);
    exportMenu.hidden = !(tool.exports || []).length && !tool.toMarkdown;
    const ais = tool.aiActions || [];
    aiMenu.setItems(ais.map((a) => ({ label: label(a.label), icon: 'sparkles', onClick: () => askClaude(a.id) })));
    aiMenu.hidden = !ais.length;
    saveBtn.hidden = !tool.toMarkdown;
  };
  const doExport = async (x) => {
    try { const f = await x.build(ctx.state, ctx.lastRun); ctx.download(f.name, f.mime, f.text); }
    catch (e) { ui.toast(e.message || t('Export failed'), { tone: 'bad' }); }
  };
  const askClaude = async (id) => {
    try { const r = await ctx.ai(id); if (r.sent) ui.toast(t('Sent to Claude. The answer arrives in the deliverable chat.'), { tone: 'ok' }); }
    catch (e) { ui.toast(e.message, { tone: 'bad' }); }
  };
  const publish = async () => {
    saveBtn.setBusy(true);
    try { await ctx.publish(); } catch (e) { ui.toast(e.message || t('Something went wrong'), { tone: 'bad' }); }
    saveBtn.setBusy(false);
  };

  // ---- sample switch (Visa EN | CB FR + Load sample ▾)
  const samples = tool.samples || {};
  let sampleLang = (samples[getLang()] || []).length ? getLang() : (samples.en || []).length ? 'en' : 'fr';
  const sampleMenu = ui.menu({ label: t('Load sample'), icon: 'flask-conical', align: 'right', items: [] });
  const paintSamples = () => sampleMenu.setItems([
    ...(samples[sampleLang] || []).map((s, i) => ({ label: label(s.label) || `${t('Sample')} ${i + 1}`, hint: label(s.hint), onClick: () => loadSample(sampleLang, i) })),
    '-', { label: t('Start empty'), icon: 'eraser', onClick: () => reset() },
  ]);
  const seg = ui.segmented({ label: t('Sample set'), value: sampleLang, options: [{ value: 'en', label: 'Visa EN' }, { value: 'fr', label: 'CB FR' }], onChange: (v) => { sampleLang = v; paintSamples(); } });
  if ((samples.en || []).length || (samples.fr || []).length) headActions.append(seg, sampleMenu);
  paintSamples();

  // ---- frame API for the tool
  const fields = {};
  const frame = ctx.frame = {
    root, head, command, config, results, status: pill, output, actions: actionsExtra, body, primary,
    /** Status strip: statusPill opts, or null for "No run yet". */
    setStatus(o) { pill.update(o || { tone: 'neutral', text: t('No run yet') }); },
    /** Extra nodes at the right of the status strip (view switch, copy…). */
    setStatusExtra(...nodes) { stripExtra.replaceChildren(...nodes); },
    busy(on, text) { primary.setBusy(on); if (on) { spin.start(); if (text) spin.setText(text); } else spin.stop(); root.classList.toggle('is-busy', !!on); },
    bindField(key, fieldEl) { fields[key] = fieldEl; return fieldEl; },
    /** [{message, field}] → top summary linking to each field + the field's own error. [] clears. */
    showErrors(list = []) {
      Object.values(fields).forEach((f) => f.setError && f.setError(''));
      errors.replaceChildren();
      errors.hidden = !list.length;
      if (!list.length) return;
      const h = document.createElement('b'); h.textContent = t('Check these inputs');
      const ul = document.createElement('ul');
      for (const e of list) {
        const f = typeof e.field === 'string' ? fields[e.field] : e.field;
        if (f && f.setError) f.setError(e.message);
        const li = document.createElement('li');
        if (f && f.control) { const a = document.createElement('a'); a.href = '#'; a.textContent = e.message; a.onclick = (ev) => { ev.preventDefault(); f.control.focus(); }; li.append(a); }
        else li.textContent = e.message;
        ul.append(li);
      }
      errors.append(ui.icon('circle-alert'), h, ul);
      errors.focus();
    },
    /** Error of a run, shown in the results pane (not only a toast). */
    showError(message, detail = '') {
      frame.setStatus({ tone: 'bad', text: t('Error') });
      const box = document.createElement('div'); box.className = 'tf-run-error'; box.setAttribute('role', 'alert');
      box.append(ui.icon('circle-alert'));
      const tx = document.createElement('div');
      const b = document.createElement('b'); b.textContent = message; tx.append(b);
      if (detail) { const p = document.createElement('p'); p.textContent = detail; tx.append(p); }
      box.append(tx);
      output.replaceChildren(box);
    },
    setPrimary({ label: l, disabled } = {}) { if (l != null) primary.setLabel(label(l)); if (disabled != null) primary.disabled = !!disabled; },
    runNow: () => runNow(),
    remount: () => remount(),
    refreshMenus: paintMenus,
  };

  async function runNow() {
    if (!tool.run || primary.disabled) return;
    const errs = tool.validate ? tool.validate(ctx.state) || [] : [];
    frame.showErrors(errs);
    if (errs.length) return;
    frame.busy(true);
    const t0 = performance.now();
    try {
      const result = await ctx.run();
      const ms = Math.round(performance.now() - t0);
      if (tool.renderResult) await tool.renderResult(result, ctx);
      frame.setStatus(tool.status ? tool.status(result, ms) : { tone: 'ok', text: t('Done'), ms });
      output.classList.remove('fade-in'); void output.offsetWidth; output.classList.add('fade-in');
    } catch (e) {
      console.error(e);
      frame.showError(e.message || t('Something went wrong'), e.hint || '');
    }
    frame.busy(false);
  }

  async function remount() {
    command.replaceChildren(); config.replaceChildren(); output.replaceChildren(); actionsExtra.replaceChildren();
    for (const k of Object.keys(fields)) delete fields[k];
    frame.setStatus(null); frame.setStatusExtra();
    if (layout === 'split') {
      body.replaceChildren(ui.splitpane({ id: tool.id, left: config, right: results }));
      await tool.mount(config, ctx);
    } else {
      body.replaceChildren();
      await tool.mount(body, ctx);
    }
    commandWrap.hidden = !command.childElementCount && !tool.run;
    paintMenus();
  }
  async function applyState(s, { autorun = false } = {}) {
    ctx.setState(s, { silent: true, replace: true });
    ctx.lastRun = null;
    frame.showErrors([]);
    if (tool.load) { await tool.load(ctx.state, ctx); frame.setStatus(null); output.replaceChildren(); }
    else await remount();
    if (autorun) runNow();
  }
  async function loadSample(lang, i) {
    const s = (samples[lang] || [])[i];
    if (!s) return;
    await applyState({ ...(tool.defaults ? tool.defaults() : {}), ...structuredClone(s.state || {}) }, { autorun: !!s.autorun });
    ui.toast(`${t('Sample loaded')}: ${label(s.label)}`);
  }
  async function reset() { ctx.workspace = null; await applyState(tool.defaults ? tool.defaults() : {}); }
  ctx.loadSample = loadSample;

  // ---- keyboard: ⌘↵ run, ⌘S save (only while this frame is on screen)
  const onKey = (e) => {
    if (!root.isConnected) { document.removeEventListener('keydown', onKey); return; }
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    if (e.key === 'Enter' && tool.run) { e.preventDefault(); runNow(); }
    else if (e.key.toLowerCase() === 's' && !e.shiftKey) { e.preventDefault(); if (tool.onSave) tool.onSave(ctx); else if (tool.toMarkdown) publish(); }
  };
  document.addEventListener('keydown', onKey);

  root.append(head, commandWrap, errors, body, actions);
  el.replaceChildren(root);

  // Restore: ?sample=en:0 wins, then ?ws=<id> ("Open in tool" from a deliverable), then the last workspace, else defaults.
  const sq = sampleQuery(), wq = wsQuery();
  if (!sq) {
    try {
      let ws = null;
      const m = memo.get(tool.id);
      if (wq) ws = await store.get(wq);
      else if (m) ws = { ...(m.workspace || {}), tool: tool.id, state: m.state, schema: tool.schema || 1 };
      else {
        const list = (await store.list(tool.id)).filter((w) => !w.is_sample).sort((a, b) => (b.updated_at || 0) - (a.updated_at || 0));
        if (list[0]) ws = list[0].state ? list[0] : await store.get(list[0].id);
      }
      if (ws && ws.tool === tool.id && ws.state && typeof ws.state === 'object') {
        let st = ws.state;
        if ((ws.schema || 1) !== (tool.schema || 1)) st = tool.migrate ? tool.migrate(st, ws.schema || 1) : null;
        if (st) { ctx.workspace = ws.id ? ws : null; ctx.setState({ ...(tool.defaults ? tool.defaults() : {}), ...st }, { silent: true, replace: true }); }
      }
    } catch { /* no store yet: start from defaults */ }
  }
  await remount();
  if (sq) await loadSample(sq.lang, sq.i);
  return tool.tick ? { tick: () => tool.tick(ctx) } : null;
}
