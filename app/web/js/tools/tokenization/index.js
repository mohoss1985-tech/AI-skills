/* Tokenization simulator (skill tokenizing-cards), owner K. Tool interface: research/wave1-A-api.md.
   Inputs: test card · wallet · device · token requestor. The flow is a deterministic replay of state.actions
   (logic.js), so every button appends one action and re-runs; samples, saves and exports give the same result.
   Works with no AI and no network (static demo included). Every token, PAR and cryptogram is a labelled demo value. */
import { getLang, register } from '../../core/i18n.js';
import base from './i18n.js';
import guide from './guide-i18n.js';
import samples from './samples.js';
import * as K from './logic.js';
import { CARDS, MERCHANTS, TOKEN_REQUESTORS, maskPan } from './fixtures.js';
import { makeTr } from './tr.js';

/* V3 strings (guide-i18n.js) sit on top of the V2 ones. */
const strings = { en: { ...base.en, ...guide.en }, fr: { ...base.fr, ...guide.fr } };
register('tokenization', strings);
const { T, tr, val, has, fill } = makeTr('tokenization', { amount: (v) => new Intl.NumberFormat(getLang() === 'fr' ? 'fr-FR' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(+v || 0) });

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const money = (n) => new Intl.NumberFormat(getLang() === 'fr' ? 'fr-FR' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(+n || 0);
const cardLabel = (c) => `${T('bank.' + c.bank)} · ${maskPan(c.pan)} · ${c.card_id}${c.local ? ` · ${T('card.local')}` : ''} (${T('card.' + K.expectedPath(c))})`;
const toneOf = (st) => ({ active: 'ok', pending_idv: 'warn', suspended: 'warn', deleted: 'bad', declined: 'bad' }[st] || 'neutral');
const fresh = (s) => K.simulate(s);
const opLabel = (op) => (has('op.' + op) ? T('op.' + op) : op);
const amountText = (v) => (Number.isFinite(+v) ? (+v).toFixed(2) : '0.00');

/* ← / → move the guided steps while the tool is on screen and the focus is not in a field or a widget that uses arrows. */
let live = null;
if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (!live || !live._root || !live._root.isConnected || !live._chs || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const t = e.target;
    if (t && t.closest && t.closest('input, textarea, select, [contenteditable], [role="tablist"], [role="radiogroup"], [role="separator"], [role="slider"], [role="menu"], [role="listbox"], dialog')) return;
    e.preventDefault();
    live.move(e.key === 'ArrowRight' ? 'next' : 'back');
  });
}

function cardsFor(lang) {
  // EN set shows Harbor Bank cards first, FR set Banque Lumière first; all stay selectable.
  const hb = CARDS.filter((c) => c.bank === 'hb'), bl = CARDS.filter((c) => c.bank === 'bl');
  return lang === 'fr' ? [...bl, ...hb] : [...hb, ...bl];
}

export default {
  id: 'tokenization',
  skill: 'tokenizing-cards',
  icon: 'key-round',
  title: { en: 'Tokenization simulator', fr: 'Simulateur de tokenisation' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'play' },
  layout: 'split',
  schema: 1,
  defaults: K.defaults,
  samples,

  mount(el, ctx) {
    const { ui, frame } = ctx;
    const s = ctx.state;
    const restart = (patch) => { ctx.setState({ ...patch, actions: [] }); if (ctx.lastRun && !ctx.guided) frame.runNow(); };
    const push = (a) => { ctx.setState({ actions: [...(ctx.state.actions || []), a] }); frame.runNow(); };

    // ---- command bar: the 4 required inputs
    const card = frame.bindField('cardId', ui.field({ label: T('card'), required: true, input: ui.select({ options: cardsFor(getLang()).map((c) => ({ value: c.card_id, label: cardLabel(c) })), value: s.cardId, mono: true, onChange: (v) => restart({ cardId: v }) }) }));
    const wallet = ui.field({ label: T('wallet'), input: ui.select({ options: K.WALLETS.map((w) => ({ value: w, label: val(w) })), value: s.wallet, onChange: (v) => {
      const tr0 = TOKEN_REQUESTORS.find((x) => x.wallet === v);
      restart({ wallet: v, ...(tr0 ? { trid: tr0.trid } : {}), ...(v === 'merchant_card_on_file' ? { device: 'browser', channel: 'card_on_file' } : {}) });
      ctx.frame.remount();
    } }) });
    const device = ui.field({ label: T('device'), input: ui.select({ options: K.DEVICES.map((d) => ({ value: d, label: val(d) })), value: s.device, onChange: (v) => restart({ device: v }) }) });
    const trid = frame.bindField('trid', ui.field({ label: T('trid'), input: ui.select({ options: TOKEN_REQUESTORS.map((x) => ({ value: x.trid, label: `${x.name} · ${x.trid}` })), value: s.trid, mono: false, onChange: (v) => restart({ trid: v }) }) }));
    frame.command.append(card, wallet, device, trid);

    // ---- config pane: steps you can take now
    const btn = {};
    const mk = (id, label, icon, onClick, variant) => (btn[id] = ui.button({ label, icon, size: 'sm', variant, onClick }));
    const otp = ui.input({ value: '', placeholder: '123456', mono: true, ariaLabel: T('otp') });
    otp.setAttribute('inputmode', 'numeric'); otp.maxLength = 6;
    const otpField = ui.field({ label: T('otp'), help: T('otpHelp'), input: otp });
    // Text field with a fixed 0.00 format (a number field shows 42,5 in a French browser next to €42.50 in the result).
    const amount = ui.input({ value: amountText(s.amount), mono: true, onChange: (v) => { const n = Math.max(0, parseFloat(String(v).replace(',', '.')) || 0); ctx.setState({ amount: n }); amount.value = amountText(n); } });
    amount.setAttribute('inputmode', 'decimal');
    const channel = ui.select({ options: K.CHANNELS.map((c) => ({ value: c, label: val(c) })), value: s.channel, onChange: (v) => ctx.setState({ channel: v }) });

    const group = (title, ...kids) => h('div', { class: 'tk-group' }, h('div', { class: 'section-label', text: title }), h('div', { class: 'row' }, ...kids));
    const actionsBox = h('section', { class: 'panel tk-actions', 'aria-label': T('nextSteps') },
      h('div', { class: 'tk-actions-head' }, h('h2', { class: 'tk-h', text: T('nextSteps') }), h('span', { class: 'muted tk-small', text: T('restartHint') })),
      h('div', { class: 'tk-group' }, otpField, h('div', { class: 'row' }, mk('idv', T('verify'), 'shield-check', () => push({ op: 'idv', method: ctx.state.idvMethod, otp: otp.value.trim() })))),
      h('div', { class: 'tk-group' },
        h('div', { class: 'tk-pay' }, ui.field({ label: T('amount'), input: amount }), ui.field({ label: T('channel'), input: channel })),
        h('div', { class: 'row' }, mk('pay', T('pay'), 'credit-card', () => push({ op: 'pay', amount: ctx.state.amount, channel: ctx.state.channel, merchant: ctx.state.merchant }), 'primary'), mk('replay', T('replay'), 'repeat', () => push({ op: 'replay' }))),
        h('span', { class: 'muted tk-small', text: T('payHelp') })),
      group(T('st.lifecycle'), mk('suspend', T('lostPhone'), 'smartphone', () => push({ op: 'suspend', reason: 'device_lost' })), mk('resume', T('resume'), 'rotate-ccw', () => push({ op: 'resume', reason: 'device_found' })), mk('delete', T('del'), 'trash-2', () => push({ op: 'delete', reason: 'cardholder_request' }), 'danger')),
      group(T('card'), mk('block', T('blockStolen'), 'ban', () => push({ op: 'block', reason: 'stolen' })), mk('blockLost', T('blockLost'), 'ban', () => push({ op: 'block', reason: 'lost' })), mk('replace', T('replace'), 'credit-card', () => push({ op: 'replace' }))),
      h('p', { class: 'tk-small muted', text: T('storyline') }),
      h('div', { class: 'row' }, mk('undo', T('undo'), 'undo-2', () => { ctx.setState({ actions: (ctx.state.actions || []).slice(0, -1) }); frame.runNow(); }, 'ghost'), mk('restart', T('restart'), 'eraser', () => { ctx.setState({ actions: [] }); frame.runNow(); }, 'ghost')),
    );
    btn.blockLost.dataset.op = 'block';

    // ---- advanced
    const advBody = h('div', { class: 'stack' },
      ui.field({ label: T('pan'), help: T('panHelp'), optional: true, input: ui.input({ value: s.pan || '', mono: true, placeholder: '4000 0000 0000 1018', onChange: (v) => restart({ pan: v.replace(/\s/g, '') }) }) }),
      ui.field({ label: T('deviceRisk'), input: ui.segmented({ label: T('deviceRisk'), value: s.deviceRisk, options: K.RISKS.map((r) => ({ value: r, label: val(r) })), onChange: (v) => restart({ deviceRisk: v }) }) }),
      ui.field({ label: T('accountAge'), help: T('accountAgeHelp'), input: ui.input({ value: String(s.accountAgeDays), type: 'number', mono: true, onChange: (v) => restart({ accountAgeDays: Math.max(0, +v || 0) }) }) }),
      ui.field({ label: T('idvMethod'), input: ui.select({ options: K.IDV_METHODS.map((m) => ({ value: m, label: val(m) })), value: s.idvMethod, onChange: (v) => ctx.setState({ idvMethod: v }) }) }),
      ui.field({ label: T('merchant'), input: ui.select({ options: MERCHANTS.map((m) => ({ value: m.id, label: `${m.name} · ${m.id}` })), value: s.merchant, onChange: (v) => ctx.setState({ merchant: v }) }) }),
    );
    this._adv = ui.advanced({ label: T('advanced'), body: advBody, count: K.advancedSet(s) });
    el.append(actionsBox, this._adv);
    this._btn = btn;
    this._otp = otp;
    this.paintActions(null);

    this._root = el; this._ctx = ctx; this._push = push; this._count = 0; this._dom = null;
    live = this;

    // V3 guided demo: mount paints the inputs and a one-line invitation only. Nothing runs until Run flow is pressed.
    frame.output.append(ui.emptyState({ icon: 'key-round', text: T('invite'), sample: { label: T('loadSample'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } }));
    // A remount after a run (language switch, wallet change) repaints the last result at the same step. The frame sets
    // ctx.guided right AFTER mount, so this waits one macrotask (rule 8) and never paints while a sample is guided.
    setTimeout(() => {
      const r = ctx.lastRun;
      if (!r || !r.log || !r.snaps || ctx.guided || !el.isConnected || (this._dom && this._dom.card.isConnected)) return;
      this.renderResult(r, ctx, { keep: true });
      frame.setStatus(this.pill());
    }, 0);
  },

  update(state) { if (this._adv) this._adv.setCount(K.advancedSet(state)); },

  paintActions(res) {
    const b = this._btn;
    if (!b) return;
    const al = res ? res.allowed : null;
    const map = { idv: 'idv', pay: 'pay', replay: 'replay', suspend: 'suspend', resume: 'resume', delete: 'delete', block: 'block', blockLost: 'block', replace: 'replace' };
    for (const [id, key] of Object.entries(map)) {
      const a = al && al[key];
      const ok = !!(a && a.ok);
      b[id].disabled = !ok;
      b[id].title = ok ? '' : a ? `${T(a.k)}` : T('why.noToken');
    }
    if (res && res.token && res.token.status !== 'pending_idv' && this._otp) this._otp.value = '';
  },

  validate(s) {
    const errs = [];
    if (!s.cardId && !s.pan) errs.push({ field: 'cardId', message: T('card') });
    return errs;
  },

  run: (state) => fresh(state),

  status() { return this.pill(); },

  /** Status pill = where the presenter is (audit bug 3): overall step, chapter, then path and token status once shown. */
  pill() {
    const info = this._pos;
    const ch = this._chs && info && this._chs[info.c];
    if (!ch || !info.frame) return { tone: 'neutral', text: T('pillNone') };
    const bits = [fill('stepOf', { n: info.index, total: info.total }), opLabel(ch.op)];
    if (info.pathShown) bits.push(T('path.' + info.pathShown));
    if (info.chapterEnd && info.status) bits.push(val(info.status));
    const k = info.frame.kind;
    return { tone: k === 'bad' ? 'bad' : k === 'warn' ? 'warn' : info.chapterEnd ? toneOf(info.status) : 'neutral', text: bits.join(' · '), label: T('status') };
  },

  /** Next / Back / Play all / jump: no re-run, only the view moves (logic.stepMove). */
  move(cmd) {
    if (!this._chs || !this._dom) return;
    const was = this._pos;
    this._pos = K.stepMove(this._chs, was, cmd);
    const forward = this._pos.c !== was.c || this._pos.n > was.n;
    this.paintStep(forward);
    this._ctx.frame.setStatus(this.pill());
    if (forward) { const cur = this._dom.diagram.querySelector('.tk-msg.is-cur'); if (cur && cur.scrollIntoView) cur.scrollIntoView({ block: 'nearest' }); }
  },

  renderResult(res, ctx, { keep = false } = {}) {
    const { ui } = ctx;
    this._ctx = ctx; this._res = res;
    this.paintActions(res);
    const chs = (this._chs = K.chapters(res));
    const prev = this._count || 0;
    // New action → its first message. Undo → end of the last step. Run flow again → replay from the first message.
    this._pos = K.stepMove(chs, keep ? this._pos : null, keep ? undefined : chs.length > prev ? 'last' : chs.length < prev ? 'end' : 'first');
    this._count = chs.length;
    const d = (this._dom = {});
    d.chapters = h('ol', { class: 'tk-chapters', 'aria-label': T('storySoFar') });
    d.back = ui.button({ label: T('back'), icon: 'chevron-left', onClick: () => this.move('back') });
    d.next = ui.button({ label: T('next'), iconRight: 'arrow-right', variant: 'primary', onClick: () => this.move('next') });
    d.all = ui.button({ label: T('playAll'), icon: 'play', variant: 'ghost', onClick: () => this.move('all') });
    d.next.classList.add('tk-next');
    d.pos = h('span', { class: 'tk-pos num' });
    d.path = h('span', { class: 'tk-pathslot' });
    d.card = h('div', { class: 'panel tk-stepcard', 'aria-live': 'polite' });
    d.diagram = h('div', { class: 'tk-dg', role: 'group', 'aria-label': T('diagram') });
    d.life = h('section', { class: 'panel tk-life', 'aria-label': T('lifeTitle') });
    const ctrl = h('div', { class: 'tk-ctrl' }, d.back, d.next, d.all, d.pos, d.path, h('span', { class: 'muted tk-small tk-keys', text: T('keysHint') }));
    const panels = { views: this.viewsTable(res, ui), vault: this.vaultTable(res, ui), log: this.logTable(res, ui) };
    const tabs = ui.tabs({ tabs: [{ id: 'views', label: T('tabViews') }, { id: 'vault', label: T('tabVault'), count: res.world.tokens.length }, { id: 'log', label: T('tabLog'), count: res.log.length }], active: panels[this._tab] ? this._tab : 'views', onChange: (id) => { this._tab = id; }, panels });
    const note = h('p', { class: 'tk-note muted tk-small' }, ui.icon('info', { size: 14 }), ' ', T('demoNote'));
    ctx.frame.output.replaceChildren(h('div', { class: 'stack tk-guide' }, d.chapters, ctrl, d.card, d.diagram, d.life, tabs, note));
    this.paintStep(true);
  },

  /** Paints everything that depends on the cursor: story strip, buttons, caption + payload, diagram, lifecycle. */
  paintStep(animate) {
    const d = this._dom, chs = this._chs, info = this._pos, res = this._res, ui = this._ctx.ui;
    if (!d || !info || !info.frame) return;
    const ch = chs[info.c], f = info.frame, tsp = res.tsp;

    d.chapters.replaceChildren(...chs.map((c, i) => {
      const shown = i < info.c || (i === info.c && info.chapterEnd);
      const cls = `tk-chap ${i < info.c ? 'is-done' : i === info.c ? 'is-current' : 'is-upcoming'}${shown && !c.ok ? ' is-refused' : ''}`;
      return h('li', {}, h('button', { type: 'button', class: cls, 'aria-current': i === info.c ? 'step' : null, onclick: () => this.move({ c: i, n: 1 }) },
        h('span', { class: 'tk-step-n num', text: String(i + 1) }), h('span', { text: opLabel(c.op) })));
    }));

    d.back.disabled = info.atStart; d.next.disabled = info.atEnd; d.all.disabled = info.chapterEnd;
    d.pos.textContent = fill('stepOf', { n: info.index, total: info.total });
    d.path.replaceChildren(...(ch.path ? [ui.badge({ text: info.pathShown ? T('path.' + info.pathShown) : T('pathPending'), tone: info.pathShown ? { green: 'ok', yellow: 'warn', red: 'bad' }[info.pathShown] : 'neutral' })] : []));

    const lane = (id) => T('ln.' + id);
    const fields = f.fields.map((x) => {
      const nm = K.fieldName(x.id, tsp);
      return h('div', { class: 'tk-f' }, h('dt', {}, h('span', { text: has('pf.' + x.id) ? T('pf.' + x.id) : x.id }), nm ? h('code', { class: 'mono', text: nm }) : null), h('dd', { class: 'mono', text: String(val(x.value)) }));
    });
    d.card.replaceChildren(...[
      h('div', { class: 'tk-cap-head' }, h('span', { class: `tk-msg-n num k-${f.kind}`, text: String(info.n) }),
        h('span', { class: 'tk-route', text: f.from === f.to ? lane(f.from) : `${lane(f.from)} → ${lane(f.to)}` }), h('b', { text: tr(f.text) })),
      h('p', { class: 'tk-cap', text: tr(f.cap) }),
      fields.length ? h('dl', { class: 'tk-fields', 'aria-label': T('payload') }, fields) : null,
      fields.length ? h('p', { class: 'muted tk-small tk-names', text: fill('namesNote', { tsp }) }) : null,
      info.gate === 'otp' ? this.gateBox(ui) : null,
    ].filter(Boolean));

    const lanes = ch.lanes;
    const sub = { device: fill('ln.deviceSub', { device: res.input.device }), requestor: val(res.input.wallet), tsp, issuer: T('bank.' + (String(res.input.cardId).startsWith('crd_bl') ? 'bl' : 'hb')), merchant: T('ln.merchantSub') };
    const head = h('div', { class: 'tk-dg-head' }, lanes.map((l) => h('div', { class: 'tk-lane' }, h('b', { text: lane(l) }), h('span', { class: 'muted tk-small', text: sub[l] }))));
    const rows = ch.frames.slice(0, info.n).map((m, i) => {
      const a = lanes.indexOf(m.from), b = lanes.indexOf(m.to), lo = Math.min(a, b), hi = Math.max(a, b), cur = i === info.n - 1;
      // The row spans one lane more on each side than the arrow, so the label has room in a narrow pane; the arrow
      // itself (or the note of a self-message) is brought back between its two lifelines with percentage margins.
      const elo = Math.max(0, lo - 1), ehi = Math.min(lanes.length - 1, hi + 1), kE = ehi - elo + 1, half = a === b ? -0.5 : 0.5;
      const ml = (Math.max(0, lo - elo + half) / kE) * 100, mr = (Math.max(0, ehi - hi + half) / kE) * 100;
      const cls = ['tk-msg', `k-${m.kind}`, a === b ? 'is-self' : a < b ? 'dir-r' : 'dir-l', cur ? 'is-cur' : '', cur && animate ? 'is-new' : ''].filter(Boolean).join(' ');
      return h('button', { type: 'button', class: cls, style: `grid-row:${i + 1};grid-column:${elo + 1}/${ehi + 2};--ml:${ml.toFixed(3)}%;--mr:${mr.toFixed(3)}%`, 'aria-current': cur ? 'true' : null, onclick: () => this.move({ c: info.c, n: i + 1 }) },
        h('span', { class: 'tk-msg-label' }, h('span', { class: 'tk-msg-n num', text: String(i + 1) }), h('span', { text: tr(m.text) })),
        a === b ? null : h('span', { class: 'tk-msg-line', 'aria-hidden': 'true' }));
    });
    d.diagram.style.setProperty('--n', String(lanes.length));
    d.diagram.replaceChildren(head, h('div', { class: 'tk-dg-body' }, h('div', { class: 'tk-lifelines', 'aria-hidden': 'true' }, lanes.map(() => h('span', {}))), rows));

    this.paintLife(ui);
  },

  /** Yellow path: the flow waits here until the presenter types the code (wrong codes are allowed and shown). */
  gateBox(ui) {
    const input = ui.input({ value: '', placeholder: '123456', mono: true, ariaLabel: T('otp') });
    input.setAttribute('inputmode', 'numeric'); input.maxLength = 6;
    const go = () => this._push({ op: 'idv', method: this._ctx.state.idvMethod, otp: input.value.trim() });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); go(); } });
    const b = ui.button({ label: T('verify'), icon: 'shield-check', variant: 'primary', size: 'sm', onClick: go });
    b.dataset.gate = 'verify';
    return h('div', { class: 'tk-gate' }, h('b', { text: T('gateTitle') }), h('div', { class: 'row' }, input, b), h('span', { class: 'muted tk-small', text: T('gateHelp') }));
  },

  /** After provisioning: state strip (status at the cursor), the token card and one button per lifecycle step. */
  paintLife(ui) {
    const d = this._dom, res = this._res, info = this._pos, tok = res.token;
    const headEl = h('div', { class: 'tk-life-head' }, h('h2', { class: 'tk-h', text: T('lifeTitle') }), h('span', { class: 'muted tk-small', text: T('lifeHint') }));
    if (!tok || !tok.token_ref) { d.life.replaceChildren(headEl, h('p', { class: 'muted', text: info.chapterEnd ? T('lifeNone') : T('lifeWait') })); return; }
    const st = info.status;
    const states = h('ol', { class: 'tk-states' }, ['pending_idv', 'active', 'suspended', 'deleted'].map((x) => h('li', { class: `tk-state s-${x}${x === st ? ' is-on' : ''}`, 'aria-current': x === st ? 'true' : null, text: val(x) })));
    if (!st) { d.life.replaceChildren(headEl, states, h('p', { class: 'muted', text: T('lifeWait') })); return; }
    const item = (label, value, extra) => h('div', { class: 'tk-f' }, h('dt', { text: label }), h('dd', { class: 'mono' }, value, extra ? ' ' : null, extra));
    const card = h('dl', { class: 'tk-fields tk-tokencard' }, item(T('tkToken'), tok.token_masked), item(T('par'), tok.par),
      item(T('tkPan'), tok.pan_masked, tok.previous_card_id ? ui.badge({ text: T('panChanged'), tone: 'ok' }) : null), item(T('tkPayments'), String(res.payments.length)));
    const al = res.allowed;
    const sug = info.atEnd ? K.suggestNext(res) : null;
    const replOp = al.replace.ok ? 'replace' : 'renew';
    const S = () => this._ctx.state;
    const defs = [
      { id: 'pay', key: 'pay', label: T('lcPay'), icon: 'credit-card', act: () => ({ op: 'pay', amount: S().amount, channel: S().channel, merchant: S().merchant }) },
      { id: 'suspend', key: 'suspend', label: T('lcSuspend'), icon: 'smartphone', act: () => ({ op: 'suspend', reason: 'device_lost' }) },
      { id: 'resume', key: 'resume', label: T('lcResume'), icon: 'rotate-ccw', act: () => ({ op: 'resume', reason: 'device_found' }) },
      { id: 'replace', key: replOp, label: T('lcReplace'), icon: 'credit-card', act: () => ({ op: replOp }) },
      { id: 'delete', key: 'delete', label: T('lcDelete'), icon: 'trash-2', act: () => ({ op: 'delete', reason: 'cardholder_request' }) },
    ];
    const steps = h('ol', { class: 'tk-life-steps' }, defs.map((x) => {
      const a = al[x.key], on = !!sug && x.key === sug;
      const b = ui.button({ label: x.label, icon: x.icon, size: 'sm', variant: on ? 'primary' : x.id === 'delete' ? 'danger' : '', disabled: !a.ok, onClick: () => this._push(x.act()) });
      b.dataset.life = x.id;
      return h('li', { class: `tk-life-step${on ? ' is-suggested' : ''}` }, b, h('span', { class: 'tk-small', text: T('lc.' + x.id) }),
        !a.ok ? h('span', { class: 'tk-small muted', text: T(a.k) }) : on ? h('span', { class: 'tk-small tk-sug', text: T('suggested') }) : null);
    }));
    d.life.replaceChildren(headEl, states, card, steps);
  },

  viewsTable(res, ui) {
    const v = res.views;
    const cell = (x) => {
      if (!x || x.level === 'none') return h('span', { class: 'tk-none', title: T('none') }, ui.icon('ban', { size: 14 }), h('span', { class: 'sr-only', text: T('none') }));
      return h('span', { class: 'tk-cell' }, h('span', { class: 'mono', text: x.value }), h('span', { class: 'tk-level', text: T(x.level) }));
    };
    const columns = [{ key: 'actor', label: T('actor'), format: (x) => h('b', { text: T('ac.' + x) }) }, ...v.fields.map((f) => ({ key: f, label: T('f.' + f), format: (x) => cell(x) }))];
    const rows = K.ACTORS.map((a) => ({ actor: a, ...v.actors[a] }));
    return h('div', { class: 'stack' }, ui.table({ columns, rows, caption: T('tabViews') }), ui.badge({ text: T('demoBadge'), tone: 'warn' }));
  },

  vaultTable(res, ui) {
    const toks = res.world.tokens;
    if (!toks.length) return h('p', { class: 'muted', text: res.token && res.token.decision === 'red' ? T('declinedNoToken') : T('noTokenYet') });
    const columns = [
      { key: 'token_ref', label: T('tokenRef'), mono: true },
      { key: 'token_masked', label: T('token'), mono: true },
      { key: 'pan_masked', label: T('panMasked'), mono: true },
      { key: 'par', label: T('par'), mono: true },
      { key: 'token_requestor_id', label: 'TRID', mono: true },
      { key: 'device', label: T('device'), format: (x) => val(x) },
      { key: 'domain', label: T('domain'), format: (x, r) => r.domain_restrictions.channels.map(val).join(', ') },
      { key: 'status', label: T('status'), format: (x) => ui.badge({ text: val(x), tone: toneOf(x) }) },
      { key: 'history', label: T('history'), format: (x) => x.map((e) => `${val(e.event)}${e.reason ? ` (${val(e.reason)})` : ''}`).join(' → ') },
    ];
    return h('div', { class: 'stack' }, ui.table({ columns, rows: toks, caption: T('tabVault') }), ui.badge({ text: T('demoBadge'), tone: 'warn' }));
  },

  logTable(res, ui) {
    const columns = [
      { key: 'n', label: '#', num: true },
      { key: 'step', label: T('step'), format: (x, r) => opLabel(r.op.op) },
      { key: 'title', label: T('result'), format: (x, r) => h('span', { class: 'row' }, ui.badge({ text: String(r.status), tone: r.ok ? 'ok' : 'bad' }), h('span', { text: tr(x) })) },
      { key: 'rule', label: T('rule'), mono: true },
      { key: 'api', label: T('call'), format: (x) => (x ? h('details', { class: 'tk-call' }, h('summary', {}, h('span', { class: 'row' }, ui.methodChip({ method: x.method }), h('span', { class: 'mono tk-small', text: x.path }))), h('pre', { class: 'tk-pre mono', 'aria-label': T('reqBody'), text: JSON.stringify(x.body && x.body.pan ? { ...x.body, pan: maskPan(x.body.pan) } : x.body, null, 2) })) : h('span', { class: 'muted tk-small', text: T('noCall') })) },
    ];
    return ui.table({ columns, rows: res.log.map((l, i) => ({ ...l, n: i + 1 })), caption: T('tabLog') });
  },

  toMarkdown(state, run) {
    const res = run && run.log ? run : fresh(state);
    const tok = res.token || {};
    const card = CARDS.find((c) => c.card_id === state.cardId);
    const lines = [`# ${T('mdTitle')}`, '', `> ${T('mdDisclaimer')}`, '', `## ${T('mdInputs')}`, '',
      `| | |`, `|---|---|`,
      `| ${T('card')} | \`${card ? maskPan(card.pan) : maskPan(state.pan)}\` (${state.cardId}) |`,
      `| ${T('wallet')} | ${val(state.wallet)} |`, `| ${T('device')} | ${val(state.device)} |`,
      `| ${T('trid')} | ${state.trid} |`, `| ${T('deviceRisk')} | ${val(state.deviceRisk)} |`, `| ${T('accountAge')} | ${state.accountAgeDays} |`, '',
      `## ${T('mdSteps')}`, '', `| # | ${T('step')} | ${T('result')} | ${T('rule')} | ${T('call')} |`, '|---:|---|---|---|---|',
      ...res.log.map((l, i) => `| ${i + 1} | ${opLabel(l.op.op)} | ${l.ok ? '✓' : '✗'} ${tr(l.title)}${l.detail ? ' — ' + tr(l.detail) : ''} | ${l.rule || ''} | ${l.api ? `\`${l.api.method} ${l.api.path}\`` : ''} |`),
      '', '```mermaid', K.toMermaid(res, tr, (a) => T('ac.' + a)), '```', '',
      `## ${T('mdVault')}`, '',
      ...(res.world.tokens.length ? [`| ${T('tokenRef')} | ${T('token')} | ${T('panMasked')} | ${T('par')} | ${T('status')} |`, '|---|---|---|---|---|',
        ...res.world.tokens.map((t) => `| ${t.token_ref} | \`${t.token_masked}\` | \`${t.pan_masked}\` | \`${t.par}\` | ${val(t.status)} |`)] : [tok.decision === 'red' ? T('declinedNoToken') : T('noTokenYet')]),
      '', `## ${T('mdViews')}`, '', `| ${T('actor')} | ${res.views.fields.map((f) => T('f.' + f)).join(' | ')} |`, `|---|${res.views.fields.map(() => '---').join('|')}|`,
      ...K.ACTORS.map((a) => `| ${T('ac.' + a)} | ${res.views.fields.map((f) => { const x = res.views.actors[a][f]; return x.level === 'none' ? '—' : `\`${x.value}\` (${T(x.level)})`; }).join(' | ')} |`),
      '', `## ${T('mdOpen')}`, '', ...[1, 2, 3, 4].map((i) => `- ${T('mdQ.' + i)}`), '',
    ];
    return lines.join('\n');
  },

  exports: [
    { id: 'json', label: { en: strings.en.expJson, fr: strings.fr.expJson }, build: (s, r) => { const res = r && r.log ? r : fresh(s); return { name: 'tokenization-run.json', mime: 'application/json', text: JSON.stringify({ demo_only: true, inputs: { ...s, actions: undefined }, actions: s.actions, token: res.token, vault: res.world.tokens, payments: res.payments, steps: res.log.map((l) => ({ step: l.i, op: l.op.op, ok: l.ok, status: l.status, rule: l.rule, result: tr(l.title), detail: tr(l.detail), api: l.api })), views: res.views }, null, 2) }; } },
    { id: 'csv', label: { en: strings.en.expCsv, fr: strings.fr.expCsv }, build: (s, r) => {
      const res = r && r.log ? r : fresh(s);
      const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
      const rows = [['n', 'time', 'from', 'to', 'step', 'message', 'kind'].join(','), ...res.messages.map((m, i) => [i + 1, res.log.find((l) => l.i === m.op)?.at || '', m.from, m.to, m.step, tr(m.text), m.kind].map(q).join(','))];
      return { name: 'tokenization-timeline.csv', mime: 'text/csv', text: rows.join('\n') + '\n' };
    } },
    { id: 'mermaid', label: { en: strings.en.expMermaid, fr: strings.fr.expMermaid }, build: (s, r) => { const res = r && r.log ? r : fresh(s); return { name: 'tokenization-sequence.mmd', mime: 'text/plain', text: K.toMermaid(res, tr, (a) => T('ac.' + a)) + '\n' }; } },
    { id: 'tests', label: { en: strings.en.expTests, fr: strings.fr.expTests }, build: (s, r) => {
      const res = r && r.log ? r : fresh(s);
      const cases = res.log.filter((l) => l.api).map((l, i) => ({ id: `K-TK-${String(i + 1).padStart(2, '0')}`, name: tr(l.title), request: { ...l.api, base: s.cardId.startsWith('crd_bl') ? 'mock://lumiere/v1' : 'mock://harbor/v1' }, assert: [`status == ${l.status}`, ...(l.ok ? [] : [`body.rule == '${l.rule}'`])] }));
      return { name: 'tokenization-test-cases.json', mime: 'application/json', text: JSON.stringify({ demo_only: true, cases }, null, 2) };
    } },
  ],

  aiActions: [
    { id: 'explain', label: { en: strings.en.aiExplain, fr: strings.fr.aiExplain }, expects: 'markdown', prompt: (s, r) => prompt('explain', s, r) },
    { id: 'stories', label: { en: strings.en.aiStories, fr: strings.fr.aiStories }, expects: 'markdown', prompt: (s, r) => prompt('stories', s, r) },
    { id: 'rules', label: { en: strings.en.aiRules, fr: strings.fr.aiRules }, expects: 'markdown', prompt: (s, r) => prompt('rules', s, r) },
  ],
};

function prompt(kind, s, r) {
  const res = r && r.log ? r : fresh(s);
  const fr = getLang() === 'fr';
  const last = res.log[res.log.length - 1];
  const steps = res.log.map((l, i) => `${i + 1}. ${tr(l.title)}${l.detail ? ' — ' + tr(l.detail) : ''}${l.rule ? ` [${l.rule}]` : ''}${l.api ? ` (${l.api.method} ${l.api.path} → ${l.status})` : ''}`).join('\n');
  const ctxText = `Simulator: tokenization (Analyst Kit, skill tokenizing-cards). Fictional data; all tokens, PAR and cryptograms are DEMO values.
Card: ${s.cardId} (${val(s.wallet)}, ${val(s.device)}, TRID ${s.trid}, device risk ${s.deviceRisk}, wallet account ${s.accountAgeDays} days).
Token: ${res.token?.token_ref || 'none'} · decision ${res.token?.decision || '—'} · status ${res.token?.status || '—'}.
Steps so far:
${steps}
Current step: ${opLabel(last.op.op)} — ${tr(last.title)}.`;
  const lang = fr ? 'Answer in French (CB vocabulary: opposition, jeton, porteur, émetteur).' : 'Answer in English (Visa vocabulary).';
  const ask = {
    explain: 'Explain the current step to a non-technical stakeholder (product owner, compliance) in at most 180 words: what happens, who decides, what each actor sees (the merchant never sees the PAN), and why it matters for fraud or the customer. End with one question the team must answer.',
    stories: 'Write 4 to 6 user stories for this flow (As a … I want … so that …), each with 2–4 Gherkin acceptance criteria that cite the rule IDs (T1–T18, B3). Cover the happy path, one refusal and the card-block effect on tokens. Mark scheme facts that need the rulebook as *to confirm*.',
    rules: 'Draft the issuer provisioning decision rules as a table (rule ID · condition · decision green/yellow/red · ID&V method · rationale), based on the steps above, plus the lifecycle rules after a card block, lost phone and fraud on token. Mark anything scheme-specific *to confirm*.',
  }[kind];
  return `${ask}\n${lang}\nUse the skill tokenizing-cards.\n\n${ctxText}`;
}
