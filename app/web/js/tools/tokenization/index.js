/* Tokenization simulator (skill tokenizing-cards), owner K. Tool interface: research/wave1-A-api.md.
   Inputs: test card · wallet · device · token requestor. The flow is a deterministic replay of state.actions
   (logic.js), so every button appends one action and re-runs; samples, saves and exports give the same result.
   Works with no AI and no network (static demo included). Every token, PAR and cryptogram is a labelled demo value. */
import { getLang, register } from '../../core/i18n.js';
import { isDark } from '../../core/dom.js';
import { loadMermaid } from '../../core/lazy.js';
import strings from './i18n.js';
import samples from './samples.js';
import * as K from './logic.js';
import { CARDS, MERCHANTS, TOKEN_REQUESTORS, maskPan } from './fixtures.js';
import { makeTr } from './tr.js';

register('tokenization', strings);
const { T, tr, val } = makeTr('tokenization', { amount: (v) => new Intl.NumberFormat(getLang() === 'fr' ? 'fr-FR' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(+v || 0) });

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
const cardLabel = (c) => `${maskPan(c.pan)} · ${c.card_id}${c.local ? ` · ${T('card.local')}` : ''} (${T('card.' + K.expectedPath(c))})`;
const toneOf = (st) => ({ active: 'ok', pending_idv: 'warn', suspended: 'warn', deleted: 'bad', declined: 'bad' }[st] || 'neutral');
const fresh = (s) => K.simulate(s);

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
    const restart = (patch) => { ctx.setState({ ...patch, actions: [] }); if (ctx.lastRun) frame.runNow(); };
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
    const amount = ui.input({ value: String(s.amount), mono: true, type: 'number', onChange: (v) => ctx.setState({ amount: +v || 0 }) });
    amount.step = '0.01'; amount.min = '0.01';
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

    frame.output.append(ui.emptyState({ icon: 'key-round', text: T('empty'), sample: { label: T('loadSample'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 0) } }));
    // Show the flow at once: the simulator is instant and offline.
    queueMicrotask(() => frame.runNow());
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

  status(res) {
    const tok = res.token;
    const last = res.log[res.log.length - 1];
    if (!tok || !tok.status) return { tone: 'bad', text: `${tr(last.title)} · ${last.rule || ''}`.trim() };
    const text = `${val(tok.decision)} · ${val(tok.status)}${tok.token_ref ? ' · ' + tok.token_ref : ''}`;
    return { tone: last && !last.ok ? 'warn' : toneOf(tok.status), text: `${text} · ${T('step')} ${res.log.length}`, label: T('status') };
  },

  renderResult(res, ctx) {
    const { ui, frame } = ctx;
    this.paintActions(res);
    const last = res.log[res.log.length - 1];
    const curIdx = K.STEPS.indexOf(res.step);
    const reached = new Set(res.messages.map((m) => m.step));
    const badSteps = new Set(res.messages.filter((m) => m.kind === 'bad' && m.op === last.i).map((m) => m.step));

    // step rail
    const rail = h('ol', { class: 'tk-rail', 'aria-label': T('currentStep') }, K.STEPS.map((st, i) => {
      const cls = st === res.step ? (badSteps.has(st) ? 'is-refused is-current' : 'is-current') : reached.has(st) && i <= curIdx ? 'is-done' : reached.has(st) ? 'is-done' : 'is-upcoming';
      return h('li', { class: `tk-step ${cls}`, 'aria-current': st === res.step ? 'step' : null },
        h('span', { class: 'tk-step-n num', text: String(i + 1) }), h('span', { class: 'tk-step-l', text: T('st.' + st) }));
    }));

    // current step card
    const cur = h('div', { class: 'panel tk-current' },
      h('div', { class: 'row' }, ui.badge({ text: last.ok ? T('result') : `${T('rule')} ${last.rule || ''}`, tone: last.ok ? 'ok' : 'bad' }), h('b', { text: tr(last.title) }), last.rule ? h('span', { class: 'mono muted tk-small', text: last.rule }) : null),
      last.detail ? h('p', { class: 'tk-detail', text: tr(last.detail) }) : null,
      res.lastCryptogram ? h('div', { class: 'tk-crypto' },
        h('span', { class: 'section-label', text: T('cryptogramNow') }), h('code', { class: 'mono', text: res.lastCryptogram.cryptogram }),
        h('span', { class: 'muted tk-small mono', text: `${T('atc')} ${res.lastCryptogram.atc} · ${T('eci')} ${res.lastCryptogram.eci || '—'}` }),
        ui.badge({ text: T('demoBadge'), tone: 'warn' })) : null);

    // tabs
    const seq = h('div', { class: 'tk-seq' }, h('p', { class: 'muted', text: T('rendering') }));
    const panels = { seq, views: this.viewsTable(res, ui), vault: this.vaultTable(res, ui), log: this.logTable(res, ui) };
    const tabs = ui.tabs({ tabs: [{ id: 'seq', label: T('tabSequence') }, { id: 'views', label: T('tabViews') }, { id: 'vault', label: T('tabVault'), count: res.world.tokens.length }, { id: 'log', label: T('tabLog'), count: res.log.length }], active: this._tab || 'seq', onChange: (id) => { this._tab = id; }, panels });
    const note = h('p', { class: 'tk-note muted tk-small' }, ui.icon('info', { size: 14 }), ' ', T('demoNote'));
    frame.output.replaceChildren(h('div', { class: 'stack' }, rail, cur, tabs, note));
    this.drawSequence(seq, res);
  },

  async drawSequence(box, res) {
    const code = K.toMermaid(res, tr, (a) => T('ac.' + a)).replace('rgba(37, 99, 235, 0.10)', isDark() ? 'rgba(79, 140, 255, 0.18)' : 'rgba(37, 99, 235, 0.10)');
    try {
      const mermaid = await loadMermaid();
      const v = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
      mermaid.initialize({
        startOnLoad: false, securityLevel: 'strict', theme: 'base', fontFamily: 'Inter, sans-serif',
        sequence: { useMaxWidth: false, wrap: true, width: 170, messageFontSize: 12, actorFontSize: 12, mirrorActors: false, showSequenceNumbers: true },
        themeVariables: {
          darkMode: isDark(), fontSize: '12px', background: v('--surface'),
          actorBkg: v('--surface'), actorBorder: v('--line-strong'), actorTextColor: v('--fg'), actorLineColor: v('--line-strong'),
          signalColor: v('--fg-2'), signalTextColor: v('--fg'), labelBoxBkgColor: v('--surface'), labelTextColor: v('--fg'),
          noteBkgColor: v('--hover'), noteTextColor: v('--fg'), sequenceNumberColor: v('--accent-fg'), primaryColor: v('--surface'), primaryTextColor: v('--fg'), lineColor: v('--fg-2'), textColor: v('--fg'),
        },
      });
      const init = '%%{init: {"fontSize": 12, "themeVariables": {"fontSize": "12px"}, "sequence": {"useMaxWidth": false, "wrap": true, "width": 170, "actorMargin": 48, "messageMargin": 28, "boxMargin": 6, "actorFontSize": 12, "messageFontSize": 12, "noteFontSize": 12, "mirrorActors": false, "diagramMarginX": 8, "diagramMarginY": 8}}}%%\n';
      const { svg } = await mermaid.render('tk-seq-' + Date.now(), init + code);
      box.innerHTML = svg;
      const el = box.querySelector('svg');
      if (el) { el.setAttribute('role', 'img'); el.setAttribute('aria-label', T('tabSequence')); }
    } catch (e) {
      box.replaceChildren(h('p', { class: 'muted', text: T('mermaidFallback') }), h('pre', { class: 'tk-pre mono', text: code }));
    }
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
      { key: 'step', label: T('step'), format: (x, r) => T('st.' + (res.messages.filter((m) => m.op === r.i).pop()?.step || 'request')) },
      { key: 'title', label: T('result'), format: (x, r) => h('span', { class: 'row' }, ui.badge({ text: String(r.status), tone: r.ok ? 'ok' : 'bad' }), h('span', { text: tr(x) })) },
      { key: 'rule', label: T('rule'), mono: true },
      { key: 'api', label: T('call'), format: (x) => (x ? h('span', { class: 'row' }, ui.methodChip({ method: x.method }), h('span', { class: 'mono tk-small', text: x.path })) : '—') },
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
      ...res.log.map((l, i) => `| ${i + 1} | ${T('st.' + (res.messages.filter((m) => m.op === l.i).pop()?.step || 'request'))} | ${l.ok ? '✓' : '✗'} ${tr(l.title)}${l.detail ? ' — ' + tr(l.detail) : ''} | ${l.rule || ''} | ${l.api ? `\`${l.api.method} ${l.api.path}\`` : ''} |`),
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
Current step: ${T('st.' + res.step)} — ${tr(last.title)}.`;
  const lang = fr ? 'Answer in French (CB vocabulary: opposition, jeton, porteur, émetteur).' : 'Answer in English (Visa vocabulary).';
  const ask = {
    explain: 'Explain the current step to a non-technical stakeholder (product owner, compliance) in at most 180 words: what happens, who decides, what each actor sees (the merchant never sees the PAN), and why it matters for fraud or the customer. End with one question the team must answer.',
    stories: 'Write 4 to 6 user stories for this flow (As a … I want … so that …), each with 2–4 Gherkin acceptance criteria that cite the rule IDs (T1–T18, B3). Cover the happy path, one refusal and the card-block effect on tokens. Mark scheme facts that need the rulebook as *to confirm*.',
    rules: 'Draft the issuer provisioning decision rules as a table (rule ID · condition · decision green/yellow/red · ID&V method · rationale), based on the steps above, plus the lifecycle rules after a card block, lost phone and fraud on token. Mark anything scheme-specific *to confirm*.',
  }[kind];
  return `${ask}\n${lang}\nUse the skill tokenizing-cards.\n\n${ctxText}`;
}
