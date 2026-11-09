/* Journey builder (designing-conversational-journeys), owner E.
   Intent · Channel · Steps → "Build flow" draws a node canvas (plain HTML + SVG: drag nodes, drag a port to connect,
   branch on the customer's reply), a test chat that walks the flow from the start or from any node, and design checks
   (fallback on every question = no unhandled input, a hand-off exists, AI disclosure, no PIN/PAN asks). Export JSON,
   Mermaid, Markdown (journey card, flow, Gherkin). Works with no AI and no network. Logic: logic.js. */
import { register, getLang } from '../../core/i18n.js';
import strings from './i18n.js';
import { SAMPLES } from './samples.js';
import { checkGraph, DECISION, fromJson, isFallback, layout, matchReply, NODE_W, nextId, nodeOf, outOf, replyChoices, stepsToGraph, TERMINAL, toJson, toMermaid, TYPES, walk } from './logic.js';

const T = register('journey-builder', strings);
const fmt = (k, v = {}) => T(k).replace(/\{(\w+)\}/g, (_, x) => (v[x] ?? ''));
const fileBase = (s) => String(s || 'journey').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'journey';
const ICON = { start: 'user', message: 'message-square', question: 'circle-help', check: 'git-branch', action: 'wrench', handoff: 'users', end: 'square-check' };
const clone = (g) => structuredClone(g);
const short = (s, n = 60) => { const x = String(s || ''); return x.length > n ? x.slice(0, n - 1) + '…' : x; };

const live = { zoom: 1, ctx: null, canvas: null, world: null, svg: null, chat: null, inspector: null, checksEl: null, checks: [], parse: [], sim: null, note: null };

/* ------------------------------------------------------------------ graph state */
const G = () => (live.ctx && live.ctx.state.graph) || { nodes: [], edges: [] };
function commit(g, { layoutAgain = false, edited = true } = {}) {
  if (layoutAgain) layout(g);
  live.ctx.setState({ graph: g, ...(edited ? { edited: true } : {}) }, { silent: true });
  paintCanvas(); paintChecks(); paintInspector();
  live.ctx.frame.setStatus(statusFor());
}
function select(id, { focus = false } = {}) {
  live.ctx.setState({ sel: id }, { silent: true });
  for (const el of live.world ? live.world.querySelectorAll('.jb-node') : []) el.classList.toggle('is-selected', el.dataset.id === id);
  paintInspector();
  if (focus && live.world) {
    const el = live.world.querySelector(`.jb-node[data-id="${CSS.escape(id)}"]`);
    if (el) { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); el.focus({ preventScroll: true }); }
  }
}

/* ------------------------------------------------------------------ canvas */
function buildStage(ctx) {
  const { ui } = ctx;
  const stage = document.createElement('div'); stage.className = 'jb-stage';
  const bar = document.createElement('div'); bar.className = 'jb-bar';
  const addLabel = document.createElement('span'); addLabel.className = 'muted jb-add-label'; addLabel.textContent = T('add');
  bar.append(addLabel);
  for (const t of ['message', 'question', 'action', 'check', 'handoff', 'end']) bar.append(ui.button({ label: T('t_' + t), icon: ICON[t], size: 'sm', variant: 'ghost', onClick: () => addNode(t) }));
  const sep = document.createElement('span'); sep.className = 'jb-sep'; sep.setAttribute('aria-hidden', 'true');
  const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
  file.addEventListener('change', async () => { const f = file.files && file.files[0]; file.value = ''; if (f) importJson(ctx, f); });
  bar.append(sep, ui.button({ label: T('tidy'), icon: 'layout-grid', size: 'sm', variant: 'ghost', onClick: () => { const g = clone(G()); commit(g, { layoutAgain: true }); } }),
    ui.button({ label: T('importJson'), icon: 'upload', size: 'sm', variant: 'ghost', onClick: () => file.click() }), file);
  const zl = document.createElement('span'); zl.className = 'jb-zoom mono'; zl.setAttribute('aria-live', 'polite');
  bar.append(sep.cloneNode(), ui.button({ icon: 'zoom-out', ariaLabel: T('zoomOut'), size: 'sm', variant: 'ghost', onClick: () => setZoom(live.zoom / 1.2) }), zl,
    ui.button({ icon: 'zoom-in', ariaLabel: T('zoomIn'), size: 'sm', variant: 'ghost', onClick: () => setZoom(live.zoom * 1.2) }),
    ui.button({ label: T('fit'), icon: 'maximize', size: 'sm', variant: 'ghost', onClick: () => fitZoom(0.3) }));
  live.zoomLabel = zl;
  const note = document.createElement('div'); note.className = 'jb-note'; note.hidden = true; note.setAttribute('role', 'status');
  bar.append(note);
  live.note = note;

  const grid = document.createElement('div'); grid.className = 'jb-grid';
  const canvas = document.createElement('div'); canvas.className = 'jb-canvas'; canvas.tabIndex = -1;
  canvas.setAttribute('role', 'region'); canvas.setAttribute('aria-label', T('canvasLabel'));
  const world = document.createElement('div'); world.className = 'jb-world';
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.classList.add('jb-edges'); svg.setAttribute('aria-hidden', 'true');
  svg.innerHTML = '<defs><marker id="jb-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="jb-arrow"/></marker><marker id="jb-arrow-fb" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" class="jb-arrow fb"/></marker></defs><g class="jb-paths"></g><path class="jb-temp" hidden></path>';
  world.append(svg);
  const scaler = document.createElement('div'); scaler.className = 'jb-scaler';
  scaler.append(world);
  canvas.append(scaler);
  live.scaler = scaler;
  const empty = ui.emptyState({ icon: 'message-square', title: T('emptyTitle'), text: T('emptyText'),
    action: { label: T('primary'), onClick: () => ctx.frame.runNow(), kbd: ui.kbdLabel('mod+enter') },
    sample: { label: T('loadSample'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } });
  empty.classList.add('jb-empty');
  const canvasWrap = document.createElement('div'); canvasWrap.className = 'jb-canvas-wrap';
  canvasWrap.append(canvas, empty);
  grid.append(canvasWrap, buildChat(ctx));
  stage.append(bar, grid);
  Object.assign(live, { canvas, world, svg, empty });
  return stage;
}

function paintCanvas() {
  if (!live.world) return;
  const g = G();
  live.empty.hidden = !!g.nodes.length;
  live.canvas.hidden = !g.nodes.length;
  for (const el of live.world.querySelectorAll('.jb-node, .jb-label')) el.remove();
  const sel = live.ctx.state.sel, cur = live.sim && live.sim.at;
  const checksBy = new Map();
  for (const c of live.checks) for (const id of c.ids || []) if (c.level !== 'info') checksBy.set(id, c.level === 'bad' || checksBy.get(id) === 'bad' ? 'bad' : 'warn');
  for (const nd of g.nodes) {
    const el = document.createElement('div');
    el.className = `jb-node t-${nd.type}` + (nd.id === sel ? ' is-selected' : '') + (nd.id === cur ? ' is-current' : '');
    el.dataset.id = nd.id; el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.setAttribute('aria-label', `${T('t_' + nd.type)}: ${nd.text}`);
    el.style.left = nd.x + 'px'; el.style.top = nd.y + 'px';
    const head = document.createElement('div'); head.className = 'jb-node-head';
    head.append(live.ctx.ui.icon(ICON[nd.type] || 'circle', { size: 14 }));
    const tl = document.createElement('span'); tl.textContent = T('t_' + nd.type); head.append(tl);
    if (checksBy.has(nd.id)) {
      const flag = document.createElement('span'); flag.className = 'jb-flag ' + checksBy.get(nd.id);
      flag.append(live.ctx.ui.icon(checksBy.get(nd.id) === 'bad' ? 'circle-x' : 'triangle-alert', { size: 14 }));
      const sr = document.createElement('span'); sr.className = 'sr-only'; sr.textContent = T('lvl_' + checksBy.get(nd.id)); flag.append(sr);
      head.append(flag);
    }
    const tx = document.createElement('div'); tx.className = 'jb-node-text'; tx.textContent = nd.type === 'start' ? `“${nd.text}”` : nd.text || T('noText');
    el.append(head, tx);
    const choices = DECISION.has(nd.type) ? replyChoices(g, nd) : [];
    if (choices.length) {
      const o = document.createElement('div'); o.className = 'jb-node-opts';
      for (const c of choices.slice(0, 6)) { const s = document.createElement('span'); s.textContent = c; o.append(s); }
      el.append(o);
    }
    if (!TERMINAL.has(nd.type)) {
      const port = document.createElement('button'); port.type = 'button'; port.className = 'jb-port';
      port.setAttribute('aria-label', fmt('connectFrom', { name: short(nd.text, 40) }));
      port.title = T('connectHint');
      el.append(port);
      wirePort(port, nd.id);
    }
    wireNode(el, nd.id);
    live.world.append(el);
  }
  routeEdges();
}

const box = (id) => {
  const el = live.world.querySelector(`.jb-node[data-id="${CSS.escape(id)}"]`);
  const nd = nodeOf(G(), id);
  return el && nd ? { x: nd.x, y: nd.y, w: el.offsetWidth || NODE_W, h: el.offsetHeight || 72 } : null;
};
function curve(a, b) {
  const sx = a.x + a.w, sy = a.y + a.h / 2, tx = b.x, ty = b.y + b.h / 2;
  if (tx > sx + 16) { const dx = Math.max(40, (tx - sx) / 2); return { d: `M${sx},${sy} C${sx + dx},${sy} ${tx - dx},${ty} ${tx},${ty}`, mx: (sx + tx) / 2, my: (sy + ty) / 2 }; }
  // backwards or same column: leave right, go round below both nodes, come in from the left
  const yb = Math.max(a.y + a.h, b.y + b.h) + 28;
  return { d: `M${sx},${sy} C${sx + 60},${sy} ${sx + 60},${yb} ${sx},${yb} L${tx},${yb} C${tx - 60},${yb} ${tx - 60},${ty} ${tx},${ty}`, mx: (sx + tx) / 2, my: yb };
}
function applyZoom() {
  if (!live.world || !live.size) return;
  live.world.style.transform = `scale(${live.zoom})`;
  live.scaler.style.width = live.size.W * live.zoom + 'px'; live.scaler.style.height = live.size.H * live.zoom + 'px';
  if (live.zoomLabel) live.zoomLabel.textContent = Math.round(live.zoom * 100) + ' %';
}
function setZoom(z) { live.zoom = Math.min(1.5, Math.max(0.3, z)); applyZoom(); }
/** Fit the whole flow in the canvas (never above 100 %, never below 45 % so text stays readable; scroll for the rest). */
function fitZoom(min = 0.45) {
  if (!live.canvas || !live.size || live.canvas.hidden) return;
  const cw = live.canvas.clientWidth, ch = live.canvas.clientHeight;
  if (!cw || !ch) return;
  setZoom(Math.max(min, Math.min(1, cw / live.size.W, ch / live.size.H)));
  live.canvas.scrollTo(0, 0);
}
function routeEdges() {
  const g = G();
  const paths = live.svg.querySelector('.jb-paths');
  paths.replaceChildren();
  for (const el of live.world.querySelectorAll('.jb-label')) el.remove();
  let maxX = 0, maxY = 0;
  for (const nd of g.nodes) { const b = box(nd.id); if (b) { maxX = Math.max(maxX, b.x + b.w); maxY = Math.max(maxY, b.y + b.h); } }
  for (const e of g.edges) {
    const a = box(e.from), b = box(e.to);
    if (!a || !b) continue;
    const c = curve(a, b);
    maxY = Math.max(maxY, c.my);
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    p.setAttribute('d', c.d);
    const fb = isFallback(e.label);
    p.setAttribute('class', 'jb-path' + (fb ? ' fb' : '') + (live.sim && live.sim.lastEdge === e.id ? ' is-walked' : ''));
    p.setAttribute('marker-end', fb ? 'url(#jb-arrow-fb)' : 'url(#jb-arrow)');
    paths.append(p);
    if (e.label) {
      const l = document.createElement('div'); l.className = 'jb-label' + (fb ? ' fb' : '');
      l.textContent = fb ? T('fallback') : short(e.label.split(/\s*[/|]\s*/)[0], 28);
      l.title = e.label;
      l.style.left = c.mx + 'px'; l.style.top = c.my + 'px';
      live.world.append(l);
    }
  }
  const W = maxX + 120, H = maxY + 80;
  live.world.style.width = W + 'px'; live.world.style.height = H + 'px';
  live.size = { W, H };
  applyZoom();
  live.svg.setAttribute('width', W); live.svg.setAttribute('height', H);
}

function wireNode(el, id) {
  el.addEventListener('pointerdown', (ev) => {
    if (ev.button !== 0 || ev.target.closest('.jb-port')) return;
    const g = G(), nd = nodeOf(g, id);
    const x0 = ev.clientX, y0 = ev.clientY, nx = nd.x, ny = nd.y;
    let moved = false;
    try { el.setPointerCapture(ev.pointerId); } catch { /* synthetic or lost pointer */ }
    const move = (e) => {
      const dx = (e.clientX - x0) / live.zoom, dy = (e.clientY - y0) / live.zoom;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 4) return;
      moved = true; el.classList.add('is-dragging');
      nd.x = Math.max(8, Math.round((nx + dx) / 8) * 8); nd.y = Math.max(8, Math.round((ny + dy) / 8) * 8);
      el.style.left = nd.x + 'px'; el.style.top = nd.y + 'px';
      routeEdges();
    };
    const up = () => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.classList.remove('is-dragging');
      if (moved) live.ctx.setState({ graph: g, edited: true }, { silent: true });
      else select(id);
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
  el.addEventListener('keydown', (ev) => {
    const g = G(), nd = nodeOf(g, id);
    const step = ev.shiftKey ? 32 : 8;
    const mv = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[ev.key];
    if (mv && ev.altKey === false && (ev.target === el)) {
      ev.preventDefault();
      nd.x = Math.max(8, nd.x + mv[0]); nd.y = Math.max(8, nd.y + mv[1]);
      el.style.left = nd.x + 'px'; el.style.top = nd.y + 'px'; routeEdges();
      live.ctx.setState({ graph: g, edited: true }, { silent: true });
    } else if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); select(id); live.inspector.querySelector('textarea, input, select')?.focus(); }
    else if ((ev.key === 'Delete' || ev.key === 'Backspace') && ev.target === el && nd.type !== 'start') { ev.preventDefault(); removeNode(id); }
  });
}

function wirePort(port, fromId) {
  port.addEventListener('pointerdown', (ev) => {
    ev.preventDefault(); ev.stopPropagation();
    const temp = live.svg.querySelector('.jb-temp');
    const a = box(fromId);
    const wr = live.world.getBoundingClientRect();
    temp.hidden = false;
    try { port.setPointerCapture(ev.pointerId); } catch { /* synthetic or lost pointer */ }
    const move = (e) => {
      const x = (e.clientX - wr.left) / live.zoom, y = (e.clientY - wr.top) / live.zoom;
      temp.setAttribute('d', `M${a.x + a.w},${a.y + a.h / 2} L${x},${y}`);
    };
    const up = (e) => {
      port.removeEventListener('pointermove', move); port.removeEventListener('pointerup', up);
      temp.hidden = true; temp.removeAttribute('d');
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const target = hit && hit.closest && hit.closest('.jb-node');
      if (target && target.dataset.id !== fromId) connect(fromId, target.dataset.id);
    };
    move(ev);
    port.addEventListener('pointermove', move); port.addEventListener('pointerup', up);
  });
  port.addEventListener('click', (ev) => { ev.stopPropagation(); select(fromId); live.inspector.querySelector('.jb-add-edge')?.focus(); });
}

function defaultLabel(g, from) {
  const nd = nodeOf(g, from);
  if (nd.type === 'question') {
    const used = outOf(g, from).map((e) => e.label.split(/\s*[/|]\s*/)[0].toLowerCase());
    const free = (nd.options || []).find((o) => !used.includes(o.toLowerCase()));
    return free || (outOf(g, from).some((e) => isFallback(e.label)) ? T('newReply') : '*');
  }
  if (nd.type === 'check') { const used = outOf(g, from).map((e) => e.label); return [T('yes'), T('no')].find((x) => !used.includes(x)) || ''; }
  return '';
}
function connect(from, to) {
  const g = clone(G());
  g.edges.push({ id: nextId(g, 'e'), from, to, label: defaultLabel(g, from) });
  commit(g);
  select(from);
}
function addNode(type) {
  const g = clone(G());
  const sel = g.nodes.find((x) => x.id === live.ctx.state.sel);
  const id = nextId(g, 'n');
  const maxY = Math.max(0, ...g.nodes.map((x) => x.y));
  const nd = { id, type, text: T('new_' + type), options: type === 'question' ? [T('yes'), T('no')] : [], x: sel ? sel.x + 264 : 24, y: sel ? sel.y + 40 : maxY + 132 };
  g.nodes.push(nd);
  if (sel && !TERMINAL.has(sel.type)) g.edges.push({ id: nextId(g, 'e'), from: sel.id, to: id, label: defaultLabel(g, sel.id) });
  commit(g);
  select(id, { focus: true });
}
function removeNode(id) {
  const g = clone(G());
  g.nodes = g.nodes.filter((x) => x.id !== id);
  g.edges = g.edges.filter((e) => e.from !== id && e.to !== id);
  live.ctx.setState({ sel: null }, { silent: true });
  commit(g);
  showNote(T('nodeDeleted'));
}

/* ------------------------------------------------------------------ inspector + checks (config pane) */
function paintInspector() {
  const box = live.inspector; if (!box) return;
  const ui = live.ctx.ui;
  const g = G();
  const nd = nodeOf(g, live.ctx.state.sel);
  box.replaceChildren();
  const h = document.createElement('h3'); h.className = 'section-label'; h.textContent = T('inspector'); box.append(h);
  if (!nd) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = g.nodes.length ? T('selectHint') : T('inspectorEmpty'); box.append(p); return; }
  const edit = (fn, { relayout = false } = {}) => { const g2 = clone(G()); fn(g2, nodeOf(g2, nd.id)); live.ctx.setState({ graph: g2, edited: true }, { silent: true }); clearTimeout(live.edT); live.edT = setTimeout(() => { if (relayout) layout(G()); paintCanvas(); paintChecks(); live.ctx.frame.setStatus(statusFor()); }, 200); };
  if (nd.type !== 'start') {
    box.append(ui.field({ label: T('nodeType'), input: ui.select({ value: nd.type, options: TYPES.filter((x) => x !== 'start').map((x) => ({ value: x, label: T('t_' + x) })), onChange: (v) => { edit((_, n) => { n.type = v; if (v !== 'question') n.options = n.options || []; }); setTimeout(paintInspector, 220); } }) }));
  }
  box.append(ui.field({ label: nd.type === 'start' ? T('startText') : T('nodeText'), help: nd.type === 'start' ? T('startHelp') : '', input: ui.textarea({ value: nd.text, rows: 3, onInput: (v) => edit((_, n) => { n.text = v; }) }) }));
  if (nd.type === 'question') box.append(ui.field({ label: T('options'), help: T('optionsHelp'), input: ui.input({ value: (nd.options || []).join(' | '), onInput: (v) => edit((_, n) => { n.options = v.split('|').map((x) => x.trim()).filter(Boolean); }) }) }));
  // connections
  const outs = outOf(g, nd.id);
  const cl = document.createElement('div'); cl.className = 'jb-conns';
  const ch = document.createElement('div'); ch.className = 'section-label'; ch.textContent = DECISION.has(nd.type) ? T('branches') : T('next'); cl.append(ch);
  if (DECISION.has(nd.type)) { const p = document.createElement('p'); p.className = 'jb-help'; p.textContent = T('branchesHelp'); cl.append(p); }
  const targets = g.nodes.filter((x) => x.id !== nd.id && x.type !== 'start').map((x) => ({ value: x.id, label: `${T('t_' + x.type)} · ${short(x.text, 36)}` }));
  for (const e of outs) {
    const row = document.createElement('div'); row.className = 'jb-conn';
    if (DECISION.has(nd.type) || e.label) row.append(ui.input({ value: e.label, ariaLabel: T('replyLabel'), placeholder: T('replyPh'), onInput: (v) => edit((g2) => { const x = g2.edges.find((y) => y.id === e.id); if (x) x.label = v; }) }));
    row.append(ui.select({ value: e.to, options: targets, ariaLabel: T('goesTo'), onChange: (v) => edit((g2) => { const x = g2.edges.find((y) => y.id === e.id); if (x) x.to = v; }) }));
    row.append(ui.button({ icon: 'x', ariaLabel: T('removeConn'), size: 'sm', variant: 'ghost', onClick: () => { const g2 = clone(G()); g2.edges = g2.edges.filter((y) => y.id !== e.id); commit(g2); } }));
    cl.append(row);
  }
  if (!TERMINAL.has(nd.type) && targets.length) {
    const add = ui.button({ label: T('addConn'), icon: 'plus', size: 'sm', variant: 'ghost', onClick: () => { const g2 = clone(G()); const t = targets.find((x) => !outOf(g2, nd.id).some((e) => e.to === x.value)) || targets[0]; g2.edges.push({ id: nextId(g2, 'e'), from: nd.id, to: t.value, label: defaultLabel(g2, nd.id) }); commit(g2); } });
    add.classList.add('jb-add-edge');
    cl.append(add);
  }
  box.append(cl);
  const act = document.createElement('div'); act.className = 'row';
  act.append(ui.button({ label: T('testHere'), icon: 'play', size: 'sm', variant: 'secondary', onClick: () => startSim(nd.id) }));
  if (nd.type !== 'start') act.append(ui.button({ label: T('deleteNode'), icon: 'trash-2', size: 'sm', variant: 'ghost', onClick: () => removeNode(nd.id) }));
  box.append(act);
}

function statusFor() {
  const g = G();
  if (!g.nodes.length) return null;
  const issues = live.checks.filter((c) => c.level !== 'info').length + live.parse.length;
  const bad = live.checks.some((c) => c.level === 'bad');
  return { tone: bad ? 'bad' : issues ? 'warn' : 'ok', text: `${fmt('statusText', { n: g.nodes.length, q: g.nodes.filter((x) => x.type === 'question').length })} · ${issues ? fmt('statusChecks', { n: issues }) : T('statusOk')}` };
}
const checkText = (c) => fmt('chk_' + c.code, { text: short(c.text, 70), n: c.n });
function paintChecks() {
  const ctx = live.ctx; if (!live.checksEl || !ctx) return;
  live.checks = checkGraph(G(), ctx.state.channel);
  const list = [...live.parse.map((p) => ({ level: 'warn', text: fmt('p_' + p.code, p), ids: [] })), ...live.checks.map((c) => ({ level: c.level, text: checkText(c), ids: c.ids }))];
  live.checksEl.replaceChildren();
  const h = document.createElement('h3'); h.className = 'section-label'; h.textContent = `${T('checks')} · ${list.filter((x) => x.level !== 'info').length}`; live.checksEl.append(h);
  if (!G().nodes.length) { const p = document.createElement('p'); p.className = 'muted'; p.textContent = T('checksEmpty'); live.checksEl.append(p); return; }
  if (!list.length) { const p = document.createElement('p'); p.className = 'jb-ok'; p.append(ctx.ui.icon('circle-check', { size: 16 }), document.createTextNode(T('noChecks'))); live.checksEl.append(p); return; }
  const ul = document.createElement('ul'); ul.className = 'jb-checks';
  for (const c of list) {
    const li = document.createElement('li');
    li.append(ctx.ui.badge({ text: T('lvl_' + c.level), tone: c.level === 'info' ? 'info' : c.level, icon: c.level === 'bad' ? 'circle-x' : c.level === 'warn' ? 'triangle-alert' : 'info' }));
    const s = document.createElement('span'); s.textContent = c.text; li.append(s);
    if (c.ids && c.ids.length) li.append(ctx.ui.button({ label: T('show'), size: 'sm', variant: 'ghost', onClick: () => select(c.ids[0], { focus: true }) }));
    ul.append(li);
  }
  live.checksEl.append(ul);
}

/* ------------------------------------------------------------------ test chat */
function buildChat(ctx) {
  const { ui } = ctx;
  const wrap = document.createElement('section'); wrap.className = 'jb-chat'; wrap.setAttribute('aria-label', T('chat'));
  const head = document.createElement('div'); head.className = 'jb-chat-head';
  const h = document.createElement('h3'); h.textContent = T('chat');
  const ch = document.createElement('span'); ch.className = 'muted jb-chan';
  head.append(h, ch, ui.button({ label: T('restart'), icon: 'rotate-ccw', size: 'sm', variant: 'ghost', onClick: () => startSim() }));
  const log = document.createElement('div'); log.className = 'jb-log'; log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite');
  const replies = document.createElement('div'); replies.className = 'jb-replies';
  const form = document.createElement('form'); form.className = 'jb-send';
  const inp = ui.input({ placeholder: T('typeReply'), ariaLabel: T('typeReply') });
  const send = ui.button({ label: T('send'), icon: 'send', size: 'sm', type: 'submit', variant: 'secondary' });
  form.append(inp, send);
  form.addEventListener('submit', (e) => { e.preventDefault(); const v = inp.value.trim(); if (!v) return; inp.value = ''; userReply(v); });
  const tests = ui.button({ label: T('testGibberish'), icon: 'shield-alert', size: 'sm', variant: 'ghost', onClick: () => userReply(T('gibberish')) });
  tests.classList.add('jb-gib');
  wrap.append(head, log, replies, form, tests);
  live.chat = { wrap, log, replies, inp, chan: ch, form };
  return wrap;
}
function line(kind, text, extra) {
  const { log } = live.chat;
  const d = document.createElement('div'); d.className = 'jb-msg ' + kind;
  const ui = live.ctx.ui;
  const voice = live.ctx.state.channel === 'voice';
  if (kind === 'bot' || kind === 'user') {
    if (voice) d.append(ui.icon(kind === 'bot' ? 'bot' : 'user', { size: 14 }));
    const s = document.createElement('span'); s.textContent = text; d.append(s);
  } else {
    const icon = { action: 'wrench', handoff: 'users', end: 'square-check', warn: 'triangle-alert', bad: 'circle-x', fb: 'corner-down-left', check: 'git-branch' }[kind] || 'info';
    d.append(ui.icon(icon, { size: 14 }));
    const s = document.createElement('span'); s.textContent = text; d.append(s);
  }
  if (extra) d.append(extra);
  log.append(d);
  log.scrollTop = log.scrollHeight;
}
function startSim(fromId) {
  const g = G();
  if (!live.chat) return;
  live.chat.log.replaceChildren(); live.chat.replies.replaceChildren();
  live.chat.chan.textContent = T('ch_' + (live.ctx.state.channel || 'chat'));
  const start = fromId || (g.nodes.find((x) => x.type === 'start') || {}).id;
  live.sim = { at: null, misses: 0, lastEdge: null };
  if (!start) { line('info', T('chatEmpty')); setInput(false); return; }
  if (fromId && nodeOf(g, fromId).type !== 'start') line('info', fmt('fromHere', { name: short(nodeOf(g, fromId).text, 50) }));
  advance(start);
}
function advance(id) {
  const g = G();
  const { events, wait } = walk(g, id);
  for (const ev of events) {
    const nd = ev.node;
    if (ev.kind === 'user') line('user', nd.text);
    else if (ev.kind === 'bot') line('bot', nd.text);
    else if (ev.kind === 'action') line('action', `${T('simAction')} · ${nd.text}`);
    else if (ev.kind === 'check') line('check', `${T('simCheck')} · ${nd.text}`);
    else if (ev.kind === 'handoff') line('handoff', `${T('simHandoff')} · ${nd.text}`);
    else if (ev.kind === 'end') line('end', `${T('simEnd')} · ${nd.text}`);
    else if (ev.kind === 'dead') line('warn', fmt('simDead', { name: short(nd.text, 50) }));
    else if (ev.kind === 'loop') line('warn', T('simLoop'));
  }
  live.sim.at = wait;
  paintReplies();
  for (const el of live.world.querySelectorAll('.jb-node')) el.classList.toggle('is-current', el.dataset.id === (wait || (events.at(-1) && events.at(-1).node.id)));
}
function setInput(on) { live.chat.inp.disabled = !on; live.chat.form.querySelector('button').disabled = !on; live.chat.wrap.querySelector('.jb-gib').disabled = !on; }
function paintReplies() {
  const r = live.chat.replies; r.replaceChildren();
  const g = G(), nd = live.sim && live.sim.at && nodeOf(g, live.sim.at);
  if (!nd) { setInput(false); const b = live.ctx.ui.button({ label: T('restart'), icon: 'rotate-ccw', size: 'sm', variant: 'secondary', onClick: () => startSim() }); r.append(b); return; }
  const isCheck = nd.type === 'check';
  setInput(!isCheck);
  const lab = document.createElement('span'); lab.className = 'muted jb-replies-label';
  lab.textContent = isCheck ? T('systemResult') : live.ctx.state.channel === 'voice' ? T('saySpoken') : T('quickReplies');
  r.append(lab);
  const choices = isCheck ? outOf(g, nd.id).map((e) => e.label || T('next')) : replyChoices(g, nd);
  for (const c of choices) r.append(live.ctx.ui.button({ label: c, size: 'sm', variant: 'secondary', onClick: () => (isCheck ? checkChoice(c) : userReply(c)) }));
}
function checkChoice(label) {
  const g = G(), at = live.sim.at;
  const e = outOf(g, at).find((x) => (x.label || T('next')) === label);
  if (!e) return;
  line('check', `${T('systemResult')}: ${label}`);
  live.sim.lastEdge = e.id; routeEdges();
  advance(e.to);
}
function userReply(text) {
  const g = G(), at = live.sim && live.sim.at;
  if (!at) return;
  line('user', text);
  const { edge, fallback } = matchReply(g, at, text);
  if (!edge) {
    line('bad', fmt('unhandled', { text: short(text, 40) }));
    live.sim.misses++;
    return;
  }
  if (fallback) { live.sim.misses++; line('fb', fmt('tookFallback', { n: live.sim.misses })); }
  else live.sim.misses = 0;
  live.sim.lastEdge = edge.id; routeEdges();
  advance(edge.to);
}

/* ------------------------------------------------------------------ misc */
function showNote(text, action) {
  const n = live.note; if (!n) return;
  n.replaceChildren(document.createTextNode(text));
  if (action) n.append(live.ctx.ui.button({ label: action.label, size: 'sm', variant: 'ghost', onClick: () => { n.hidden = true; action.onClick(); } }));
  n.hidden = false;
  clearTimeout(n._t); n._t = setTimeout(() => { n.hidden = true; }, 12000);
}
async function importJson(ctx, f) {
  try {
    const { meta, graph } = fromJson(await f.text());
    if (!graph.nodes.length) throw new Error('empty');
    ctx.setState({ ...meta, intent: meta.intent || ctx.state.intent, graph, edited: true, sel: null }, { silent: true });
    await ctx.frame.remount();
    showNote(fmt('imported', { name: f.name }));
  } catch { showNote(T('errImport')); }
}

function paintAll() { paintChecks(); paintCanvas(); paintInspector(); live.ctx.frame.setStatus(statusFor()); }

/* ------------------------------------------------------------------ Markdown */
const mdCell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\n/g, ' ');
function gherkin(state, g) {
  const L = [`Feature: ${state.intent || state.title}`, ''];
  const ch = T('ch_' + (state.channel || 'chat')).toLowerCase();
  const first = g.nodes.find((x) => x.type === 'message' || x.type === 'question');
  if (first) L.push(`  Scenario: ${T('gDisclosure')}`, `    Given ${fmt('gGiven', { ch })}`, `    When ${fmt('gSays', { text: state.intent })}`, `    Then ${fmt('gReplies', { text: first.text })}`, '');
  let n = 0;
  for (const q of g.nodes.filter((x) => x.type === 'question')) {
    for (const e of outOf(g, q.id)) {
      if (++n > 14) break;
      const to = nodeOf(g, e.to); if (!to) continue;
      const reply = isFallback(e.label) ? T('gUnrelated') : e.label.split(/\s*[/|]\s*/)[0];
      L.push(`  Scenario: ${short(q.text, 50)} · ${isFallback(e.label) ? T('fallback') : reply}`, `    Given ${fmt('gAsked', { text: q.text })}`, `    When ${fmt('gSays', { text: reply })}`,
        `    Then ${fmt('gThen_' + to.type, { text: to.text })}`, '');
    }
  }
  return L.join('\n');
}
function toMarkdown(state) {
  const g = state.graph && state.graph.nodes && state.graph.nodes.length ? state.graph : stepsToGraph(state, { resolved: T('resolved') }).graph;
  const L = [`## ${state.title || state.intent || T('title')}`, ''];
  L.push(`### 1 · ${T('mdCard')}`, '', `| | |`, '|---|---|',
    `| ${T('intent')} | ${mdCell(state.intent)} |`, `| ${T('channel')} | ${T('ch_' + (state.channel || 'chat'))} |`,
    `| ${T('solved')} | ${mdCell(state.solved || '—')} |`, `| ${T('handoff')} | ${mdCell(state.handoff || '—')} |`, '');
  L.push(`### 2 · ${T('mdFlow')}`, '', `| # | ${T('nodeType')} | ${T('mdSays')} | ${T('mdNext')} |`, '|---|---|---|---|');
  g.nodes.forEach((nd, i) => L.push(`| ${i + 1} | ${T('t_' + nd.type)} | ${mdCell(nd.text)}${nd.options && nd.options.length ? ` *[${mdCell(nd.options.join(' · '))}]*` : ''} | ${mdCell(outOf(g, nd.id).map((e) => (e.label ? `${isFallback(e.label) ? T('fallback') : e.label} → ` : '→ ') + short((nodeOf(g, e.to) || {}).text, 40)).join('; ') || '—')} |`));
  L.push('', `### 3 · ${T('checks')}`, '');
  const c = checkGraph(g, state.channel);
  if (c.length) c.forEach((x) => L.push(`- **${T('lvl_' + x.level)}:** ${checkText(x)}`)); else L.push(T('noChecks'));
  L.push('', `### 4 · ${T('mdDiagram')}`, '', '```mermaid', toMermaid(g), '```', '');
  const utt = String(state.utterances || '').split('\n').map((x) => x.trim()).filter(Boolean);
  if (utt.length) L.push(`### 5 · ${T('mdUtterances')}`, '', ...utt.map((u) => `- ${u}`), '');
  L.push(`### ${utt.length ? 6 : 5} · ${T('mdStories')}`, '', '```gherkin', gherkin(state, g).trimEnd(), '```', '');
  L.push(`### ${utt.length ? 7 : 6} · ${T('mdMetrics')}`, '', T('mdMetricsText'), '');
  return L.join('\n');
}

/* ------------------------------------------------------------------ AI prompts */
const langLine = () => (getLang() === 'fr' ? 'Answer in French (Banque Lumière, CB terms).' : 'Answer in English (Harbor Bank, Visa terms).');
const GRAMMAR = `Steps grammar (one per line): "Say: text" (assistant message) · "Ask: question [Option 1 | Option 2]" · "Do: system action" · "Check: system condition?" · "Handoff: to whom, with what context" · "End: outcome".
Branches under Ask/Check, indented two spaces: "  Lost / lost it / can't find → Do: Block card". The "/" alternatives are what customers may type. "  * → ..." is the fallback for anything else. "[id] step" names a step, "@id" jumps to it. FR keywords: Dire, Demander, Faire, Vérifier, Transfert, Fin.`;
const graphText = (g) => g.nodes.map((nd) => `${nd.id} ${nd.type}: ${nd.text}${nd.options && nd.options.length ? ` [${nd.options.join(' | ')}]` : ''} → ${outOf(g, nd.id).map((e) => `${e.label ? `(${e.label}) ` : ''}${e.to}`).join(', ') || '-'}`).join('\n');
const RULES = 'Rules: disclose the AI in the first message; one clarifying question with 2–4 options, never more than two clarifications in a row; every question has a fallback branch; sensitive topics (fraud, disputes, vulnerability) and "human please" go to a hand-off with context; never ask for full card numbers, PINs, passwords or one-time codes; answer first, max ~3 short sentences per turn; quick replies plus free text.';
function promptDraft(s) {
  return [`You are a Product Owner and conversation designer (skill: designing-conversational-journeys). Design the ${s.channel || 'chat'} journey for the customer need "${s.intent}".`, langLine(), '', RULES, '', GRAMMAR, '',
    'Return ONLY JSON: {"intent": "...", "steps": "the journey in the grammar above", "utterances": ["10 to 15 realistic customer phrasings, including typos, slang, angry and vague ones"], "solved": "observable outcome"}', '',
    `What solved means: ${s.solved || '(not given)'}`, `Hand-off rule: ${s.handoff || '(not given)'}`, '', 'Current steps (improve them, keep what works):', '"""', s.steps || '(none)', '"""'].join('\n');
}
function promptUtterances(s) {
  return [`Write 15 test utterances for the intent "${s.intent}" on the ${s.channel || 'chat'} channel, for the evaluation set (skill: evaluating-rag-quality).`, langLine(),
    'Mix: plain, typos, slang, angry, vague, two intents in one message, out-of-scope, and 2 that must go to a human. Return Markdown: a table utterance | expected branch | why it is hard.', '', 'Flow branches:', graphText(G().nodes.length ? G() : stepsToGraph(s).graph)].join('\n');
}
function promptReview(s) {
  const g = G().nodes.length ? G() : stepsToGraph(s).graph;
  return [`Review this conversational journey (skill: designing-conversational-journeys). Intent "${s.intent}", channel ${s.channel}.`, langLine(), '', RULES, '', 'Flow (id type: text → (reply) next):', graphText(g), '',
    'Automatic checks:', checkGraph(g, s.channel).map((c) => `- ${c.level}: ${checkText(c)}`).join('\n') || '- none', '',
    'Return Markdown: 1) verdict in one line, 2) table node | problem | fix, 3) missing branches (ambiguous, low confidence, out of scope, sensitive, frustration, authentication), 4) rewritten copy for the 3 weakest turns, 5) two user stories with Gherkin conversational acceptance criteria.'].join('\n');
}
function readDraft(state) {
  let d = state.ai && state.ai.draft;
  if (!d) return null;
  if (typeof d === 'string') { const m = d.match(/\{[\s\S]*\}/); try { d = JSON.parse(m ? m[0] : d); } catch { return { bad: true }; } }
  if (!d || !d.steps) return { bad: true };
  return { intent: d.intent || '', steps: Array.isArray(d.steps) ? d.steps.join('\n') : String(d.steps), utterances: Array.isArray(d.utterances) ? d.utterances.join('\n') : String(d.utterances || ''), solved: d.solved || '' };
}
function paintDraft() {
  const ctx = live.ctx, box = live.draftBox; if (!box) return;
  box.replaceChildren();
  const d = readDraft(ctx.state);
  if (!d || ctx.state.aiDismissed === JSON.stringify(ctx.state.ai && ctx.state.ai.draft)) { box.hidden = true; return; }
  box.hidden = false;
  const p = document.createElement('p'); p.append(ctx.ui.icon('sparkles', { size: 16 }), document.createTextNode(d.bad ? T('draftBad') : fmt('draftReady', { n: d.steps.split('\n').filter((x) => x.trim()).length })));
  const row = document.createElement('div'); row.className = 'row';
  if (!d.bad) row.append(ctx.ui.button({ label: T('apply'), icon: 'check', size: 'sm', variant: 'secondary', onClick: async () => {
    ctx.setState({ intent: d.intent || ctx.state.intent, steps: d.steps, utterances: d.utterances || ctx.state.utterances, solved: d.solved || ctx.state.solved, aiDismissed: JSON.stringify(ctx.state.ai.draft) }, { silent: true });
    await ctx.frame.remount(); ctx.frame.runNow();
  } }));
  row.append(ctx.ui.button({ label: T('dismiss'), size: 'sm', variant: 'ghost', onClick: () => { ctx.setState({ aiDismissed: JSON.stringify(ctx.state.ai.draft) }, { silent: true }); box.hidden = true; } }));
  box.append(p, row);
}

/* ------------------------------------------------------------------ tool module */
export default {
  id: 'journey-builder',
  skill: 'designing-conversational-journeys',
  icon: 'message-square',
  title: { en: 'Journey builder', fr: 'Parcours conversationnel' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  primary: { label: { en: strings.en.primary, fr: strings.fr.primary }, icon: 'split' },
  layout: 'split',
  schema: 1,
  defaults() { return { title: '', intent: '', channel: 'chat', steps: '', solved: '', handoff: '', utterances: '', graph: null, sel: null, edited: false }; },
  samples: SAMPLES,

  mount(el, ctx) {
    const { ui, frame } = ctx;
    live.ctx = ctx; live.parse = []; live.sim = null;
    const s = ctx.state;
    const ADV = ['solved', 'handoff', 'utterances', 'title'];
    const advCount = () => ADV.filter((k) => String(ctx.state[k] || '').trim()).length;
    const set = (k) => (v) => { ctx.setState({ [k]: v }, { silent: true }); if (ADV.includes(k)) adv.setCount(advCount()); };
    const chan = ui.segmented({ label: T('channel'), value: s.channel || 'chat', options: ['chat', 'voice', 'app'].map((v) => ({ value: v, label: T('ch_' + v) })),
      onChange: (v) => { ctx.setState({ channel: v }, { silent: true }); paintChecks(); paintCanvas(); live.ctx.frame.setStatus(statusFor()); if (live.chat) live.chat.chan.textContent = T('ch_' + v); } });
    const chanField = document.createElement('div'); chanField.className = 'field jb-chan-field';
    const cl = document.createElement('span'); cl.className = 'jb-field-label'; cl.textContent = T('channel'); cl.setAttribute('aria-hidden', 'true');
    chanField.append(cl, chan);
    frame.command.append(
      frame.bindField('intent', ui.field({ label: T('intent'), required: true, help: T('intentHelp'), input: ui.input({ value: s.intent, placeholder: T('intentPh'), onInput: (v) => { set('intent')(v); if (!ctx.state.title) ctx.setState({}, { silent: true }); } }) })),
      chanField,
    );
    frame.command.classList.add('jb-command');
    const steps = frame.bindField('steps', ui.field({ label: T('steps'), required: true, help: T('stepsHelp'), input: ui.textarea({ value: s.steps, placeholder: T('stepsPh'), rows: 12, mono: true, onInput: set('steps') }) }));
    steps.classList.add('jb-steps');
    const syn = document.createElement('details'); syn.className = 'jb-syntax';
    const sum = document.createElement('summary'); sum.textContent = T('syntax');
    const ul = document.createElement('ul');
    for (const k of ['syn1', 'syn2', 'syn3', 'syn4', 'syn5']) { const li = document.createElement('li'); li.textContent = T(k); ul.append(li); }
    syn.append(sum, ul);
    const advBody = document.createElement('div'); advBody.className = 'stack';
    advBody.append(
      ui.field({ label: T('solved'), help: T('solvedHelp'), optional: true, input: ui.input({ value: s.solved, onInput: set('solved') }) }),
      ui.field({ label: T('handoff'), help: T('handoffHelp'), optional: true, input: ui.input({ value: s.handoff, onInput: set('handoff') }) }),
      ui.field({ label: T('utterances'), help: T('utterancesHelp'), optional: true, input: ui.textarea({ value: s.utterances, rows: 5, onInput: set('utterances') }) }),
      ui.field({ label: T('titleField'), help: T('titleHelp'), optional: true, input: ui.input({ value: s.title, onInput: set('title') }) }),
    );
    const adv = ui.advanced({ label: T('advanced'), body: advBody, count: advCount() });
    live.draftBox = document.createElement('div'); live.draftBox.className = 'jb-draft'; live.draftBox.hidden = true;
    live.inspector = document.createElement('section'); live.inspector.className = 'jb-inspector panel';
    live.checksEl = document.createElement('section'); live.checksEl.className = 'jb-checks-wrap';
    el.append(steps, syn, adv, live.draftBox, live.inspector, live.checksEl);
    paintDraft();
    frame.output.replaceChildren(buildStage(ctx));
    paintAll();
    requestAnimationFrame(() => fitZoom(0.8));
    startSim();
  },

  validate(s) {
    const e = [];
    if (!String(s.intent || '').trim()) e.push({ field: 'intent', message: T('errIntent') });
    if (String(s.steps || '').split('\n').filter((x) => x.trim()).length < 2) e.push({ field: 'steps', message: T('errSteps') });
    return e;
  },
  run(s) {
    const { graph, problems } = stepsToGraph(s, { resolved: T('resolved') });
    if (graph.nodes.length < 2) throw new Error(T('errSteps'));
    return { graph, problems };
  },
  renderResult(r, ctx) {
    live.ctx = ctx;
    const prev = ctx.state.edited && ctx.state.graph ? ctx.state.graph : null;
    live.parse = r.problems.filter((p) => p.code !== 'noSteps');
    ctx.setState({ graph: r.graph, edited: false, sel: null, title: ctx.state.title || '' }, { silent: true });
    if (!live.world || !live.world.isConnected) ctx.frame.output.replaceChildren(buildStage(ctx));
    paintAll();
    fitZoom(0.8);
    startSim();
    if (prev) showNote(T('replaced'), { label: T('undo'), onClick: () => { commit(prev); showNote(T('restored')); } });
  },
  status() { return statusFor(); },
  tick: async (ctx) => {
    const id = ctx.workspace && ctx.workspace.id;
    if (!id) return;
    try {
      const ws = await ctx.store.get(id);
      const ai = ws && ws.state && ws.state.ai;
      if (ai && JSON.stringify(ai) !== JSON.stringify(ctx.state.ai || null)) { ctx.setState({ ai }, { silent: true }); paintDraft(); }
    } catch { /* next tick */ }
  },
  toMarkdown,
  exports: [
    { id: 'json', label: { en: strings.en.exJson, fr: strings.fr.exJson }, build: (s) => { const g = s.graph && s.graph.nodes ? s.graph : stepsToGraph(s).graph; return { name: fileBase(s.title || s.intent) + '.journey.json', mime: 'application/json', text: toJson(s, g) }; } },
    { id: 'mermaid', label: { en: strings.en.exMermaid, fr: strings.fr.exMermaid }, build: (s) => { const g = s.graph && s.graph.nodes ? s.graph : stepsToGraph(s).graph; return { name: fileBase(s.title || s.intent) + '.mmd', mime: 'text/plain', text: toMermaid(g) + '\n' }; } },
  ],
  aiActions: [
    { id: 'draft', label: { en: strings.en.aiDraft, fr: strings.fr.aiDraft }, expects: 'json', prompt: (s) => promptDraft(s) },
    { id: 'utterances', label: { en: strings.en.aiUtterances, fr: strings.fr.aiUtterances }, expects: 'markdown', prompt: (s) => promptUtterances(s) },
    { id: 'review', label: { en: strings.en.aiReview, fr: strings.fr.aiReview }, expects: 'markdown', prompt: (s) => promptReview(s) },
  ],
};
