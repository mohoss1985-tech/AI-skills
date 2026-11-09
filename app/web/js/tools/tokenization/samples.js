/* Samples of the Tokenization simulator. EN = Visa / Harbor Bank, FR = CB / Banque Lumière.
   Each state is the inputs + the action log replayed by logic.simulate(). Storyline: the stolen card. */
const base = { wallet: 'apple_pay', device: 'iphone', trid: '40010030273', deviceRisk: 'low', accountAgeDays: 400, idvMethod: 'sms_otp', channel: 'in_app', amount: 42.5, merchant: 'M-001', pan: '' };

export const samples = {
  en: [
    { id: 'green', label: 'Green path: Apple Pay on iPhone', hint: 'crd_hb_001, pay €42.50 in-app', autorun: true,
      state: { ...base, cardId: 'crd_hb_001', actions: [{ op: 'pay', amount: 42.5, channel: 'in_app' }] } },
    { id: 'yellow', label: 'Yellow path: new device, one-time code', hint: 'Wrong code, then 123456', autorun: true,
      state: { ...base, cardId: 'crd_hb_008', device: 'iphone', deviceRisk: 'medium', accountAgeDays: 3, actions: [{ op: 'idv', method: 'sms_otp', otp: '000000' }, { op: 'idv', method: 'sms_otp', otp: '123456' }, { op: 'pay', amount: 18.9, channel: 'contactless' }] } },
    { id: 'red', label: 'Red path: the stolen card', hint: 'crd_hb_005 blocked as stolen (code 43)', autorun: true,
      state: { ...base, cardId: 'crd_hb_005', wallet: 'google_pay', device: 'android', trid: '40010075001', accountAgeDays: 900, actions: [] } },
    { id: 'story', label: 'Storyline: stolen card, token suspended, PAN update', hint: 'Block, refused cryptogram, replacement card', autorun: true,
      state: { ...base, cardId: 'crd_hb_008', accountAgeDays: 500, channel: 'contactless', amount: 12, actions: [
        { op: 'pay', amount: 12, channel: 'contactless' }, { op: 'block', reason: 'stolen' }, { op: 'pay', amount: 12, channel: 'contactless' },
        { op: 'resume', reason: 'card_blocked_stolen' }, { op: 'replace' }, { op: 'pay', amount: 12, channel: 'contactless' }] } },
    { id: 'mdes', label: 'Mastercard MDES: card-on-file at a merchant', hint: 'Domain restriction refuses contactless', autorun: true,
      state: { ...base, cardId: 'crd_hb_009', wallet: 'merchant_card_on_file', device: 'browser', trid: '40010099001', channel: 'card_on_file', amount: 25, merchant: 'M-011', actions: [
        { op: 'pay', amount: 25, channel: 'card_on_file' }, { op: 'replay' }, { op: 'pay', amount: 25, channel: 'contactless' }] } },
  ],
  fr: [
    { id: 'green', label: 'Parcours vert : carte CB dans Apple Pay', hint: 'crd_bl_001, paiement in-app de 42,50 €', autorun: true,
      state: { ...base, cardId: 'crd_bl_001', actions: [{ op: 'pay', amount: 42.5, channel: 'in_app' }] } },
    { id: 'yellow', label: 'Parcours jaune : nouvel appareil, code SMS', hint: 'Code faux, puis 123456', autorun: true,
      state: { ...base, cardId: 'crd_bl_008', wallet: 'google_pay', device: 'android', trid: '40010075001', deviceRisk: 'medium', accountAgeDays: 3, actions: [{ op: 'idv', method: 'sms_otp', otp: '000000' }, { op: 'idv', method: 'sms_otp', otp: '123456' }, { op: 'pay', amount: 18.9, channel: 'contactless' }] } },
    { id: 'red', label: 'Parcours rouge : la carte volée', hint: 'crd_bl_005 en opposition pour vol (code 43)', autorun: true,
      state: { ...base, cardId: 'crd_bl_005', accountAgeDays: 900, actions: [] } },
    { id: 'story', label: 'Fil rouge : carte volée, jeton suspendu, mise à jour du PAN', hint: 'Opposition, cryptogramme refusé, remplacement', autorun: true,
      state: { ...base, cardId: 'crd_bl_008', accountAgeDays: 500, channel: 'contactless', amount: 12.4, actions: [
        { op: 'pay', amount: 12.4, channel: 'contactless' }, { op: 'block', reason: 'stolen' }, { op: 'pay', amount: 12.4, channel: 'contactless' },
        { op: 'resume', reason: 'card_blocked_stolen' }, { op: 'replace' }, { op: 'pay', amount: 12.4, channel: 'contactless' }] } },
  ],
};
export default samples;
