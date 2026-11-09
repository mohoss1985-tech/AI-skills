/* Reference tool for builders C–K (research/wave1-A-api.md §5), runnable but not in the registry.
   Try it in the console of the running app:
     const [{ default: tool }, { mountTool }] = await Promise.all([import('./js/shell/example-tool.js'), import('./js/shell/tool-frame.js')]);
     mountTool(document.getElementById('main'), tool);
   It exercises every frame slot: command bar, config pane with tabs + Advanced, validation, run, status strip,
   results (table + JSON view), exports, AI actions, samples. */
import { register } from '../core/i18n.js';

const T = register('example', {
  en: { amount: 'Amount (EUR)', rate: 'Interchange rate (%)', card: 'Card type', note: 'Internal note', empty: 'Enter an amount and press Compute to see the fee.', load: 'Load sample', errAmount: 'Enter an amount greater than 0, for example 125.40', item: 'Item', value: 'Value', fee: 'Interchange fee', title: 'Interchange fee', setup: 'Set-up', json: 'JSON', rows: 'Breakdown' },
  fr: { amount: 'Montant (EUR)', rate: "Taux d'interchange (%)", card: 'Type de carte', note: 'Note interne', empty: 'Saisissez un montant puis Calculer pour voir les frais.', load: 'Charger un exemple', errAmount: 'Saisissez un montant supérieur à 0, par exemple 125,40', item: 'Élément', value: 'Valeur', fee: "Commission d'interchange", title: "Commission d'interchange", setup: 'Paramètres', json: 'JSON', rows: 'Détail' },
});

export default {
  id: 'example', skill: '', icon: 'sigma', schema: 1,
  title: { en: 'Fee calculator (example)', fr: 'Calcul de frais (exemple)' },
  purpose: { en: 'Interchange on one payment: the reference screen for tool builders.', fr: "L'interchange d'un paiement : l'écran de référence pour les auteurs d'outils." },
  primary: { label: { en: 'Compute', fr: 'Calculer' }, icon: 'sigma' },
  defaults: () => ({ amount: '', rate: '0.2', card: 'debit', note: '' }),
  samples: {
    en: [{ id: 'visa', label: 'Visa debit, €125.40', hint: 'Harbor Bank', state: { amount: '125.40', rate: '0.2', card: 'debit' }, autorun: true }],
    fr: [{ id: 'cb', label: 'CB débit, 125,40 €', hint: 'Banque Lumière', state: { amount: '125.40', rate: '0.2', card: 'debit' }, autorun: true }],
  },
  mount(el, ctx) {
    const { ui, frame } = ctx;
    const amount = frame.bindField('amount', ui.field({ label: T('amount'), required: true, input: ui.input({ value: ctx.state.amount, mono: true, placeholder: '125.40', onInput: (v) => ctx.setState({ amount: v }) }) }));
    const rate = ui.field({ label: T('rate'), input: ui.select({ options: ['0.2', '0.3'], value: ctx.state.rate, onChange: (v) => ctx.setState({ rate: v }) }) });
    frame.command.append(amount, rate);
    const setup = ui.field({ label: T('card'), input: ui.segmented({ options: [{ value: 'debit', label: 'Debit' }, { value: 'credit', label: 'Credit' }], value: ctx.state.card, onChange: (v) => ctx.setState({ card: v }) }) });
    const adv = ui.advanced({ body: ui.field({ label: T('note'), input: ui.textarea({ value: ctx.state.note, onInput: (v) => { ctx.setState({ note: v }); adv.setCount(v ? 1 : 0); } }) }), count: ctx.state.note ? 1 : 0 });
    el.append(ui.tabs({ tabs: [{ id: 'setup', label: T('setup') }], panels: { setup: setup } }), adv);
    frame.output.append(ui.emptyState({ icon: 'sigma', text: T('empty'), sample: { label: T('load'), onClick: () => ctx.loadSample(ctx.lang, 0) } }));
  },
  validate: (s) => (+s.amount > 0 ? [] : [{ field: 'amount', message: T('errAmount') }]),
  run: (s) => ({ amount: +s.amount, rate: +s.rate, fee: +((s.amount * s.rate) / 100).toFixed(2) }),
  renderResult(r, ctx) {
    const { ui } = ctx;
    ctx.frame.output.replaceChildren(
      ui.table({ columns: [{ key: 'k', label: T('item') }, { key: 'v', label: T('value'), num: true }], rows: [{ k: T('amount'), v: r.amount.toFixed(2) }, { k: T('rate'), v: r.rate }, { k: T('fee'), v: r.fee.toFixed(2) }] }),
      ui.jsonView({ value: r, onPick: (path, v) => ui.toast(`${path} = ${v}`) }),
    );
  },
  status: (r, ms) => ({ tone: 'ok', text: '1/1 ✓', ms }),
  toMarkdown: (s, r) => `# ${T('title')}\n\n| ${T('item')} | ${T('value')} |\n|---|---:|\n| ${T('amount')} | ${s.amount} |\n| ${T('fee')} | ${r ? r.fee : '—'} |\n`,
  exports: [{ id: 'csv', label: { en: 'CSV', fr: 'CSV' }, build: (s, r) => ({ name: 'fee.csv', mime: 'text/csv', text: `amount,fee\n${s.amount},${r ? r.fee : ''}\n` }) }],
  aiActions: [{ id: 'explain', label: { en: 'Explain this fee', fr: 'Expliquer ces frais' }, expects: 'markdown', prompt: (s, r) => `Explain an interchange fee of ${r && r.fee} EUR on ${s.amount} EUR.` }],
};
