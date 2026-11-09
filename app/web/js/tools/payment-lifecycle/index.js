/* Payment lifecycle & chargeback simulator (skill handling-chargebacks), owner K. Tool interface: research/wave1-A-api.md.
   Inputs: amount · 3-D Secure · event · reason (Visa condition / CB motif). Deterministic replay (logic.js): every step
   button appends one action and re-runs. Works with no AI and no network. Rulebook values are shown *to confirm*. */
import { getLang, register } from '../../core/i18n.js';
import strings from './i18n.js';
import samples from './samples.js';
import * as P from './logic.js';
import { CARDS, MERCHANTS, maskPan } from '../tokenization/fixtures.js';
import { makeTr } from '../tokenization/tr.js';

register('payment-lifecycle', strings);
const loc = () => (getLang() === 'fr' ? 'fr-FR' : 'en-GB');
const money = (minor, cur = 'EUR') => (minor == null ? '—' : new Intl.NumberFormat(loc(), { style: 'currency', currency: cur }).format(minor / 100));
const day = (iso) => (iso ? new Intl.DateTimeFormat(loc(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(iso + 'T00:00:00Z')) : '—');
const { T, tr, val } = makeTr('payment-lifecycle', { amount: money, max: money, released: money, by: day, date: day, today: day });

const h = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
};
const fill = (k, p) => tr({ k, p });
const fresh = (s) => P.simulate(s);
const condLabel = (code) => `${code} · ${T('c.' + code)}`;
const reasonOptions = (s) => {
  if (s.event === 'chargeback') return P.CONDITIONS.map((c) => ({ value: c.code, label: condLabel(c.code) }));
  if (s.event === 'refund') return P.REFUND_REASONS.map((r) => ({ value: r, label: val(r) }));
  if (s.event === 'partial_capture') return [{ value: 'final_amount_lower', label: val('final_amount_lower') }];
  return P.REVERSAL_REASONS.map((r) => ({ value: r, label: val(r) }));
};
const defaultReason = (ev) => (ev === 'chargeback' ? '13.1' : ev === 'refund' ? 'goods_returned' : ev === 'partial_capture' ? 'final_amount_lower' : 'customer_cancelled');
const stTone = { done: 'ok', current: 'accent', refused: 'bad', skipped: 'neutral', upcoming: 'neutral' };
const stIcon = { done: 'circle-check', current: 'circle-dot', refused: 'circle-x', skipped: 'circle', upcoming: 'circle' };
const dsTone = (st) => ({ won: 'ok', chargeback: 'warn', pre_arbitration: 'warn', arbitration: 'warn', lost: 'bad', merchant_accepted: 'bad', blocked: 'info' }[st] || 'neutral');

export default {
  id: 'payment-lifecycle',
  skill: 'handling-chargebacks',
  icon: 'repeat',
  title: { en: 'Payment lifecycle & chargeback simulator', fr: 'Cycle de vie du paiement et impayés' },
  purpose: { en: strings.en.purpose, fr: strings.fr.purpose },
  primary: { label: { en: strings.en.run, fr: strings.fr.run }, icon: 'play' },
  layout: 'split',
  schema: 1,
  defaults: P.defaults,
  samples,

  mount(el, ctx) {
    const { ui, frame } = ctx;
    const s = ctx.state;
    const restart = (patch, remount = false) => { ctx.setState({ ...patch, actions: [] }); if (remount) frame.remount(); else if (ctx.lastRun) frame.runNow(); };
    const push = (a) => { ctx.setState({ actions: [...(ctx.state.actions || []), a] }); frame.runNow(); };

    // ---- command bar
    const amount = frame.bindField('amount', ui.field({ label: T('amount'), required: true, input: ui.input({ value: String(s.amount), type: 'number', mono: true, onChange: (v) => restart({ amount: +v }) }) }));
    amount.control.step = '0.01'; amount.control.min = '0.01';
    const tds = ui.field({ label: T('threeDs'), input: ui.select({ options: ['authenticated', 'attempted', 'none'].map((v) => ({ value: v, label: val(v) })), value: s.threeDs, onChange: (v) => restart({ threeDs: v }) }) });
    const event = ui.field({ label: T('event'), input: ui.select({ options: P.EVENTS.map((v) => ({ value: v, label: val(v) })), value: s.event, onChange: (v) => restart({ event: v, reason: defaultReason(v), ...(v === 'refund' || v === 'chargeback' ? { captureDate: ctx.state.captureDate || P.addDays(ctx.state.authDate, 1) } : {}) }, true) }) });
    const reasonLabel = s.event === 'chargeback' ? (s.scheme === 'cb' ? T('reasonCbFr') : T('reasonCb')) : s.event === 'refund' ? T('reasonRef') : T('reasonRev');
    const reason = frame.bindField('reason', ui.field({ label: reasonLabel, input: ui.select({ options: reasonOptions(s), value: s.reason, onChange: (v) => restart({ reason: v }) }) }));
    frame.command.append(amount, tds, event, reason);

    // ---- next steps
    const btn = {};
    const mk = (id, label, icon, onClick, variant) => (btn[id] = ui.button({ label, icon, size: 'sm', variant, onClick }));
    const evBoxes = P.EVIDENCE.map((e) => {
      const id = `pl-ev-${e}`;
      const cb = h('input', { type: 'checkbox', id, value: e });
      return h('label', { class: 'pl-check', for: id }, cb, h('span', { text: val(e) }));
    });
    const picked = () => evBoxes.map((l) => l.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
    this._today = h('b', { class: 'num' });
    const panel = h('section', { class: 'panel pl-actions', 'aria-label': T('nextSteps') },
      h('div', { class: 'pl-head' }, h('h2', { class: 'pl-h', text: T('nextSteps') }), h('span', { class: 'muted pl-small', text: T('allowedHint') })),
      h('div', { class: 'pl-group' }, h('div', { class: 'section-label', text: T('clock') }),
        h('div', { class: 'row' }, h('span', { class: 'pl-today' }, ui.icon('calendar', { size: 14 }), ' ', T('today'), ' ', this._today),
          mk('d1', T('plusDay'), 'clock', () => push({ op: 'advance', days: 1 }), 'ghost'), mk('d7', T('plusWeek'), 'clock', () => push({ op: 'advance', days: 7 }), 'ghost'), mk('d30', T('plusMonth'), 'clock', () => push({ op: 'advance', days: 30 }), 'ghost'))),
      h('div', { class: 'pl-group' }, h('div', { class: 'section-label', text: T('evidence') }), h('div', { class: 'pl-evidence' }, evBoxes),
        h('div', { class: 'row' }, mk('represent', s.event === 'chargeback' && P.workflowOf(s.reason) === 'allocation' ? T('representAlloc') : T('represent'), 'file-check', () => push({ op: 'represent', evidence: picked() }), 'primary'), mk('accept', T('acceptCb'), 'check', () => push({ op: 'accept' }))),
        h('div', { class: 'row' }, mk('prearb', T('prearbDecline'), 'scale', () => push({ op: 'prearb', accept: false, ...(picked().length ? { new_evidence: picked() } : {}) })), mk('prearbAccept', T('prearbAccept'), 'check', () => push({ op: 'prearb', accept: true }))),
        h('span', { class: 'muted pl-small', text: T('newEvidence') })),
      h('div', { class: 'pl-group' }, h('div', { class: 'section-label', text: T('stage.outcome') }),
        h('div', { class: 'row' }, mk('capture', T('captureNow'), 'arrow-right', () => push({ op: 'capture' })), mk('reversal', T('reverseNow'), 'undo-2', () => push({ op: 'reversal', reason: 'customer_cancelled' })),
          mk('refund', T('refundNow'), 'banknote', () => push({ op: 'refund', reason: 'goods_returned', amount_minor: ctx.state.eventAmount !== '' && ctx.state.eventAmount != null ? Math.round(+ctx.state.eventAmount * 100) : undefined })),
          mk('chargeback', T('chargebackNow'), 'shield-alert', () => push({ op: 'chargeback', code: ctx.state.event === 'chargeback' ? ctx.state.reason : '13.1' })))),
      h('div', { class: 'row' }, mk('undo', T('undo'), 'undo-2', () => { ctx.setState({ actions: (ctx.state.actions || []).slice(0, -1) }); frame.runNow(); }, 'ghost'), mk('restart', T('restart'), 'eraser', () => { ctx.setState({ actions: [] }); frame.runNow(); }, 'ghost')),
    );

    // ---- advanced
    const inp = (key, type = 'text', extra = {}) => ui.input({ value: s[key] == null ? '' : String(s[key]), type, mono: true, onChange: (v) => restart({ [key]: type === 'number' ? (v === '' ? '' : +v) : v }), ...extra });
    const cards = CARDS.filter((c) => (s.scheme === 'cb' ? c.bank === 'bl' : c.bank === 'hb'));
    const advBody = h('div', { class: 'stack' },
      ui.field({ label: T('scheme'), input: ui.segmented({ label: T('scheme'), value: s.scheme, options: [{ value: 'visa', label: val('visa') }, { value: 'cb', label: val('cb') }], onChange: (v) => restart({ scheme: v }, true) }) }),
      ui.field({ label: T('card'), input: ui.select({ mono: true, options: cards.map((c) => ({ value: c.card_id, label: `${maskPan(c.pan)} · ${c.card_id}` })), value: s.cardId, onChange: (v) => restart({ cardId: v }) }) }),
      ui.field({ label: T('merchant'), input: ui.select({ options: MERCHANTS.map((m) => ({ value: m.id, label: `${m.name} · ${m.id}` })), value: s.merchant, onChange: (v) => restart({ merchant: v }) }) }),
      ui.field({ label: T('channel'), input: ui.select({ options: ['ecom', 'pos', 'in_app'].map((v) => ({ value: v, label: val(v) })), value: s.channel, onChange: (v) => restart({ channel: v }) }) }),
      h('label', { class: 'pl-check' }, (() => { const c = h('input', { type: 'checkbox' }); c.checked = !!s.wallet; c.addEventListener('change', () => restart({ wallet: c.checked })); return c; })(), h('span', { text: T('wallet') })),
      ui.field({ label: T('eventAmount'), help: T('eventAmountHelp'), optional: true, input: inp('eventAmount', 'number') }),
      h('div', { class: 'pl-dates' },
        ui.field({ label: T('authDate'), input: inp('authDate', 'date') }), ui.field({ label: T('captureDate'), input: inp('captureDate', 'date') }),
        ui.field({ label: T('eventDate'), input: inp('eventDate', 'date') }), ui.field({ label: T('expectedDelivery'), optional: true, input: inp('expectedDelivery', 'date') })),
      ui.field({ label: T('fraudReport'), help: T('fraudReportHelp'), optional: true, input: inp('fraudReport') }),
    );
    this._adv = ui.advanced({ label: T('advanced'), body: advBody, count: P.advancedSet(s) });
    el.append(panel, this._adv);
    this._btn = btn;
    this.paintActions(null);
    frame.output.append(ui.emptyState({ icon: 'repeat', text: T('empty'), sample: { label: T('loadSample'), onClick: () => ctx.loadSample(getLang() === 'fr' ? 'fr' : 'en', 2) } }));
    queueMicrotask(() => frame.runNow());
  },

  update(state) { if (this._adv) this._adv.setCount(P.advancedSet(state)); },

  paintActions(res) {
    const b = this._btn;
    if (!b) return;
    const al = res ? res.allowed : {};
    const map = { represent: 'represent', accept: 'accept', prearb: 'prearb', prearbAccept: 'prearb', capture: 'capture', reversal: 'reversal', refund: 'refund', chargeback: 'chargeback' };
    for (const [id, key] of Object.entries(map)) {
      const a = al[key];
      b[id].disabled = !(a && a.ok);
      b[id].title = a && !a.ok ? T(a.k) : '';
    }
    if (res && this._today) this._today.textContent = day(res.today);
  },

  validate(s) { return +s.amount > 0 ? [] : [{ field: 'amount', message: T('errAmount') }]; },

  run: (state) => fresh(state),

  status(res) {
    const last = res.log[res.log.length - 1];
    const d = res.dispute;
    const text = d ? `${condLabel(d.condition_code)} · ${T('ds.' + d.status)}` : `${val(res.pay.status)} · ${money(res.pay.captured_minor || res.pay.authorised_minor)}`;
    return { tone: !last.ok ? 'warn' : d && ['lost', 'merchant_accepted'].includes(d.status) ? 'bad' : 'ok', text: `${text} · ${T('today')} ${day(res.today)}` };
  },

  renderResult(res, ctx) {
    const { ui, frame } = ctx;
    this.paintActions(res);
    const s = res.input;
    const blocks = [];

    // who carries the money now
    const who = res.liability;
    blocks.push(h('div', { class: 'panel pl-who' },
      h('div', { class: 'pl-who-main' }, h('span', { class: 'section-label', text: T('whoNow') }), h('b', { class: 'pl-who-party', text: T('party.' + who.party) }), h('span', { class: 'muted', text: T(who.k) }),
        res.hold ? h('span', { class: 'muted pl-small', text: fill('holdNow', { amount: res.hold }) }) : null),
      h('div', { class: 'pl-positions', role: 'list', 'aria-label': T('positions') }, P.PARTIES.map((p) => {
        const v = res.positions[p];
        return h('div', { class: 'pl-pos', role: 'listitem' }, h('span', { class: 'pl-small muted', text: T('party.' + p) }),
          h('b', { class: `num ${v < 0 ? 'is-neg' : v > 0 ? 'is-pos' : ''}`, text: (v > 0 ? '+' : '') + money(v) }));
      }))));

    // FR: two tracks
    if (res.tracks) {
      const c = res.tracks.cardholder, ib = res.tracks.interbank;
      blocks.push(h('div', { class: 'pl-tracks' },
        h('div', { class: 'panel pl-track' }, h('span', { class: 'section-label', text: T('frCardholder') }),
          c.refund_due_by ? h('p', { text: fill('frRefund', { date: c.refund_due_by }) }) : h('p', { class: 'muted', text: T('frNoRefund') }),
          h('p', { text: fill('frContest', { date: c.contest_until }) }), h('p', { class: 'muted pl-small', text: T('frHoliday') })),
        h('div', { class: 'panel pl-track' }, h('span', { class: 'section-label', text: T('frInterbank') }),
          h('p', {}, ib.motif ? fill('frMotif', { motif: ib.motif }) : '', ' ', ib.to_confirm ? ui.badge({ text: T('frMotifTbc'), tone: 'warn' }) : null),
          ib.status ? h('p', { text: fill('frInterbankStatus', { status: T('ds.' + ib.status) }) }) : null)));
    }

    // tabs
    const panels = { timeline: this.timeline(res, ui), ledger: this.ledger(res, ui), rules: this.rules(res, ui), deadlines: this.deadlines(res, ui) };
    const tabs = ui.tabs({ tabs: [{ id: 'timeline', label: T('tabTimeline') }, { id: 'ledger', label: T('tabLedger'), count: res.ledger.length }, { id: 'rules', label: T('tabRules'), count: res.log.length }, { id: 'deadlines', label: T('tabDeadlines') }], active: this._tab || 'timeline', onChange: (id) => { this._tab = id; }, panels });

    // liability shift
    const ls = res.liabilityShift;
    const lsBox = h('div', { class: 'pl-ls' }, ui.icon(ls.shifted ? 'shield-check' : 'shield', { size: 16 }), h('div', {},
      h('b', { text: T('liabilityShift') }), h('p', { text: T(ls.k) }), h('p', { class: 'muted pl-small', text: T('lsFraudOnly') }), ls.conf === 'to_confirm' ? ui.badge({ text: T('conf.to_confirm'), tone: 'warn' }) : null));
    frame.output.replaceChildren(h('div', { class: 'stack' }, ...blocks, tabs, lsBox));
  },

  timeline(res, ui) {
    const items = res.stages.map((st) => {
      const e = st.entry;
      const title = st.id === 'outcome' && st.kind ? T('kind.' + st.kind) : T('stage.' + st.id);
      const meta = [];
      if (st.at) meta.push(h('span', { class: 'num muted', text: day(st.at) }));
      if (st.workflow) meta.push(ui.badge({ text: `${T('workflow')}: ${T(st.workflow)}`, tone: 'info', icon: false }));
      if (st.deadline) {
        const left = st.deadline.left;
        meta.push(ui.badge({ text: `${fill('respondBy', { date: st.deadline.by })} · ${left >= 0 ? fill('daysLeft', { n: left }) : fill('overdue', { n: -left })}`, tone: left < 0 ? 'bad' : left <= 7 ? 'warn' : 'neutral', icon: 'hourglass' }));
        if (st.deadline.conf && st.deadline.conf.confidence === 'to_confirm') meta.push(ui.badge({ text: T('conf.to_confirm'), tone: 'warn' }));
      }
      if (st.id === 'arbitration' && st.status !== 'skipped' && st.fee) meta.push(h('span', { class: 'muted pl-small', text: `${T('fee')}: ${st.fee.amount_minor ? money(st.fee.amount_minor, st.fee.currency) : T('toConfirm')}` }), st.fee.confidence === 'to_confirm' ? ui.badge({ text: T('conf.to_confirm'), tone: 'warn' }) : null);
      if (st.id === 'outcome' && res.dispute && res.dispute.status) meta.push(ui.badge({ text: T('ds.' + res.dispute.status), tone: dsTone(res.dispute.status) }));
      return h('li', { class: `pl-stage is-${st.status}` },
        h('span', { class: 'pl-dot' }, ui.icon(stIcon[st.status], { size: 16 })),
        h('div', { class: 'pl-stage-body' },
          h('div', { class: 'row' }, h('b', { text: title }), ui.badge({ text: T('stat.' + st.status), tone: stTone[st.status], icon: false }), ...meta),
          e ? h('p', { class: 'pl-stage-text' }, h('span', { text: tr(e.title) }), e.detail ? h('span', { class: 'muted', text: ' — ' + tr(e.detail) }) : null, e.rule ? h('span', { class: 'mono muted pl-small', text: ` [${e.rule}]` }) : null) : null));
    });
    return h('ol', { class: 'pl-timeline', 'aria-label': T('tabTimeline') }, items);
  },

  ledger(res, ui) {
    const cur = res.input.currency;
    return ui.table({ caption: T('tabLedger'), columns: [
      { key: 'at', label: T('at'), format: (x) => day(x) },
      { key: 'note', label: T('note'), format: (x) => tr(x) },
      { key: 'debit', label: T('debit'), format: (x) => (x ? T('party.' + x) : '—') },
      { key: 'credit', label: T('credit'), format: (x) => (x ? T('party.' + x) : '—') },
      { key: 'amount_minor', label: T('amount'), num: true, format: (x, r) => (x == null ? T('toConfirm') : money(x, r.currency || cur)) },
    ], rows: res.ledger });
  },

  rules(res, ui) {
    return ui.table({ caption: T('tabRules'), columns: [
      { key: 'n', label: '#', num: true },
      { key: 'at', label: T('at'), format: (x) => day(x) },
      { key: 'title', label: T('result'), format: (x, r) => h('span', { class: 'row' }, ui.badge({ text: String(r.status), tone: r.ok ? 'ok' : 'bad' }), h('span', { text: tr(x) })) },
      { key: 'rule', label: T('rule'), mono: true },
      { key: 'api', label: T('call'), format: (x) => (x ? h('span', { class: 'row' }, ui.methodChip({ method: x.method }), h('span', { class: 'mono pl-small', text: x.path })) : '—') },
    ], rows: res.log.map((l, i) => ({ ...l, n: i + 1 })) });
  },

  deadlines(res, ui) {
    const rows = P.DEADLINES.filter((d) => d.scheme === res.scheme);
    return ui.table({ caption: T('tabDeadlines'), columns: [
      { key: 'step', label: T('dlStep'), format: (x, r) => h('span', {}, T('dl.' + x), r.note ? h('span', { class: 'muted pl-small', text: ` · ${T('dln.' + r.note)}` }) : null) },
      { key: 'value', label: T('dlValue'), format: (x, r) => (r.days != null ? `${r.days} ${T('days')}` : r.months != null ? `${r.months} ${T('months')}` : r.business_days != null ? `${r.business_days} ${T('businessDay')}` : r.amount_minor ? money(r.amount_minor, r.currency) : T('toConfirm')) },
      { key: 'confidence', label: T('dlConfidence'), format: (x) => ui.badge({ text: T('conf.' + x), tone: x === 'public' ? 'ok' : 'warn' }) },
      { key: 'source_url', label: T('source'), format: (x) => h('a', { href: x, target: '_blank', rel: 'noopener', class: 'pl-small', text: new URL(x).hostname }) },
    ], rows });
  },

  toMarkdown(state, run) {
    const res = run && run.log ? run : fresh(state);
    const s = res.input;
    const merchant = MERCHANTS.find((m) => m.id === s.merchant);
    const L = [`# ${T('mdTitle')}: ${val(s.event)}${s.event === 'chargeback' ? ` ${condLabel(s.reason)}` : ''}`, '', `> ${T('mdDisclaimer')}`, '',
      `## ${T('mdPayment')}`, '', '| | |', '|---|---|',
      `| ${T('amount')} | ${money(Math.round(s.amount * 100))} |`, `| ${T('card')} | ${s.cardId} |`, `| ${T('merchant')} | ${merchant ? merchant.name : s.merchant} |`,
      `| ${T('channel')} | ${val(s.channel)} |`, `| ${T('threeDs')} | ${val(s.threeDs)} |`, `| ${T('scheme')} | ${val(s.scheme)} |`, `| ${T('whoNow')} | **${T('party.' + res.liability.party)}**: ${T(res.liability.k)} |`, '',
      `## ${T('mdTimeline')}`, '', `| ${T('dlStep')} | ${T('at')} | ${T('result')} | ${T('rule')} |`, '|---|---|---|---|',
      ...res.stages.map((st) => `| ${st.id === 'outcome' && st.kind ? T('kind.' + st.kind) : T('stage.' + st.id)} | ${st.at ? day(st.at) : '—'} | ${T('stat.' + st.status)}${st.entry ? ': ' + tr(st.entry.title) : ''}${st.deadline ? ` (${fill('respondBy', { date: st.deadline.by })}${st.deadline.conf?.confidence === 'to_confirm' ? ', *to confirm*' : ''})` : ''} | ${st.entry?.rule || ''} |`),
      '', `## ${T('mdLedger')}`, '', `| ${T('at')} | ${T('note')} | ${T('debit')} | ${T('credit')} | ${T('amount')} |`, '|---|---|---|---|---:|',
      ...res.ledger.map((l) => `| ${day(l.at)} | ${tr(l.note)} | ${l.debit ? T('party.' + l.debit) : '—'} | ${l.credit ? T('party.' + l.credit) : '—'} | ${l.amount_minor == null ? '*to confirm*' : money(l.amount_minor, l.currency || s.currency)} |`),
      '', `${T('liabilityShift')}: ${T(res.liabilityShift.k)}`, '',
      ...(res.tracks ? [`## ${T('frTracksTitle')}`, '', `- ${T('frCardholder')}: ${res.tracks.cardholder.refund_due_by ? fill('frRefund', { date: res.tracks.cardholder.refund_due_by }) : T('frNoRefund')} ${fill('frContest', { date: res.tracks.cardholder.contest_until })}`, `- ${T('frInterbank')}: ${res.tracks.interbank.motif ? fill('frMotif', { motif: res.tracks.interbank.motif }) : T('frMotifTbc')}`, ''] : []),
      `## ${T('mdDeadlines')}`, '', `| ${T('dlStep')} | ${T('dlValue')} | ${T('dlConfidence')} | ${T('source')} |`, '|---|---|---|---|',
      ...P.DEADLINES.filter((d) => d.scheme === s.scheme).map((d) => `| ${T('dl.' + d.step)} | ${d.days != null ? d.days + ' ' + T('days') : d.months != null ? d.months + ' ' + T('months') : d.business_days != null ? d.business_days + ' ' + T('businessDay') : d.amount_minor ? money(d.amount_minor, d.currency) : '*to confirm*'} | ${d.confidence === 'public' ? T('conf.public') : '*to confirm*'} | ${d.source_url} |`),
      '', '```bpmn', P.toBpmn((k) => T(k)).trim(), '```', '',
      `## ${T('mdOpen')}`, '', ...[1, 2, 3, 4].map((i) => `- ${T('mdQ.' + i)}`), ''];
    return L.join('\n');
  },

  exports: [
    { id: 'json', label: { en: strings.en.expJson, fr: strings.fr.expJson }, build: (s, r) => { const res = r && r.log ? r : fresh(s); return { name: 'payment-lifecycle.json', mime: 'application/json', text: JSON.stringify({ demo_only: true, inputs: { ...s, actions: undefined }, actions: s.actions, today: res.today, payment: res.pay, dispute: res.dispute, liability: res.liability, ledger: res.ledger.map((l) => ({ ...l, note: tr(l.note) })), stages: res.stages.map((x) => ({ id: x.id, status: x.status, at: x.at, rule: x.entry?.rule, deadline: x.deadline ? { by: x.deadline.by, confidence: x.deadline.conf?.confidence } : null })), fr_tracks: res.tracks, deadlines: P.DEADLINES.filter((d) => d.scheme === res.scheme) }, null, 2) }; } },
    { id: 'csv', label: { en: strings.en.expCsv, fr: strings.fr.expCsv }, build: (s, r) => {
      const res = r && r.log ? r : fresh(s);
      const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
      const rows = [['n', 'date', 'step', 'ok', 'http_status', 'rule', 'result', 'detail', 'method', 'path'].join(','), ...res.log.map((l, i) => [i + 1, l.at, l.op.op, l.ok, l.status, l.rule || '', tr(l.title), tr(l.detail), l.api?.method || '', l.api?.path || ''].map(q).join(','))];
      return { name: 'payment-timeline.csv', mime: 'text/csv', text: rows.join('\n') + '\n' };
    } },
    { id: 'ledger', label: { en: strings.en.expLedger, fr: strings.fr.expLedger }, build: (s, r) => {
      const res = r && r.log ? r : fresh(s);
      const q = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;
      const rows = [['date', 'movement', 'debit', 'credit', 'amount_minor', 'currency'].join(','), ...res.ledger.map((l) => [l.at, tr(l.note), l.debit || '', l.credit || '', l.amount_minor ?? 'to_confirm', l.currency || s.currency].map(q).join(','))];
      return { name: 'payment-ledger.csv', mime: 'text/csv', text: rows.join('\n') + '\n' };
    } },
    { id: 'bpmn', label: { en: strings.en.expBpmn, fr: strings.fr.expBpmn }, build: () => ({ name: 'chargeback-dispute.bpmn', mime: 'application/xml', text: P.toBpmn((k) => T(k)) }) },
    { id: 'tests', label: { en: strings.en.expTests, fr: strings.fr.expTests }, build: (s, r) => {
      const res = r && r.log ? r : fresh(s);
      const cases = res.log.filter((l) => l.api && l.op.op !== 'authorise').map((l, i) => ({ id: `K-PL-${String(i + 1).padStart(2, '0')}`, name: tr(l.title), request: { ...l.api, base: s.scheme === 'cb' ? 'mock://lumiere/v1' : 'mock://harbor/v1' }, assert: [`status == ${l.status}`, ...(l.ok || !l.rule ? [] : [`body.rule == '${l.rule}'`])] }));
      return { name: 'payment-lifecycle-test-cases.json', mime: 'application/json', text: JSON.stringify({ demo_only: true, note: 'Steps assume the mock payment pay_0001 created by POST /payments first.', cases }, null, 2) };
    } },
  ],

  aiActions: [
    { id: 'explain', label: { en: strings.en.aiExplain, fr: strings.fr.aiExplain }, expects: 'markdown', prompt: (s, r) => prompt('explain', s, r) },
    { id: 'letter', label: { en: strings.en.aiLetter, fr: strings.fr.aiLetter }, expects: 'markdown', prompt: (s, r) => prompt('letter', s, r) },
    { id: 'stories', label: { en: strings.en.aiStories, fr: strings.fr.aiStories }, expects: 'markdown', prompt: (s, r) => prompt('stories', s, r) },
  ],
};

function prompt(kind, s, r) {
  const res = r && r.log ? r : fresh(s);
  const fr = getLang() === 'fr';
  const merchant = MERCHANTS.find((m) => m.id === s.merchant);
  const steps = res.log.map((l, i) => `${i + 1}. ${l.at} ${tr(l.title)}${l.detail ? ' — ' + tr(l.detail) : ''}${l.rule ? ` [${l.rule}]` : ''}`).join('\n');
  const ledger = res.ledger.map((l) => `- ${l.at} ${tr(l.note)}: ${l.debit || '—'} → ${l.credit || '—'} ${l.amount_minor == null ? '(to confirm)' : money(l.amount_minor, l.currency || s.currency)}`).join('\n');
  const ctxText = `Simulator: payment lifecycle & chargebacks (Analyst Kit, skill handling-chargebacks). Fictional data.
Payment: ${money(Math.round(s.amount * 100))}, card ${s.cardId}, merchant ${merchant ? merchant.name : s.merchant}, channel ${s.channel}, 3-D Secure ${s.threeDs}${s.wallet ? ', wallet cryptogram' : ''}, scheme ${s.scheme === 'cb' ? 'Cartes Bancaires' : 'Visa'}.
Event: ${s.event}${s.event === 'chargeback' ? ` ${s.reason} (${T('c.' + s.reason)})` : ` (${s.reason})`}. Mock today: ${res.today}.
Dispute: ${res.dispute ? `${res.dispute.condition_code} ${res.dispute.workflow} · status ${res.dispute.status} · respond by ${res.dispute.respond_by || '—'} · evidence ${res.dispute.evidence.join(', ') || 'none'}` : 'none'}.
Who carries the money now: ${res.liability.party} (${T(res.liability.k)}).
Steps:
${steps}
Ledger:
${ledger}${res.tracks ? `\nFrance: L133-18 refund due ${res.tracks.cardholder.refund_due_by || 'n/a'}, contest until ${res.tracks.cardholder.contest_until}; CB motif ${res.tracks.interbank.motif || 'to confirm'}.` : ''}`;
  const lang = fr ? 'Answer in French (CB vocabulary: impayé, représentation, porteur, émetteur, remise).' : 'Answer in English (Visa vocabulary).';
  const ask = {
    explain: 'Explain the current step of this payment to a non-technical stakeholder in at most 180 words: what happened, who decided, who carries the money now and the next deadline. Say what is a public rule and what is *to confirm* in the rulebook.',
    letter: 'Draft the merchant representment letter (dispute response) for this chargeback: reference block (ARN placeholder, condition, amount, dates), a factual timeline, the evidence list mapped to what the condition requires, and a clear request. Keep placeholders in [brackets]; never invent tracking numbers or signatures. If the case cannot be defended (liability shift, fraud motif 45, refund already made), say so instead and explain why.',
    stories: 'Write 4 to 6 user stories for this flow (As a … I want … so that …) for the issuer or acquirer back office, each with Gherkin acceptance criteria citing rule IDs (P3–P7, R1–R3, D1–D16). Include one allowed and one refused case per transition, deadline boundaries (day 30 vs day 31), and no double credit. Mark rulebook values *to confirm*.',
  }[kind];
  return `${ask}\n${lang}\nUse the skill handling-chargebacks.\n\n${ctxText}`;
}
