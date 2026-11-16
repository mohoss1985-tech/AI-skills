/* Samples of the Tokenization simulator. EN = Visa (VTS) / Harbor Bank, FR = CB co-badged / Banque Lumière.
   V3: a sample is INPUTS ONLY (actions: [], no autorun). The presenter presses Run flow, then Next step; the yellow
   path stops at the code box and the lifecycle steps are taken with the buttons. Test PANs only (mock fixtures). */
const base = { wallet: 'apple_pay', device: 'iphone', trid: '40010030273', deviceRisk: 'low', accountAgeDays: 400, idvMethod: 'sms_otp', channel: 'in_app', amount: 42.5, merchant: 'M-001', pan: '', actions: [] };

export const samples = {
  en: [
    { id: 'green', label: 'Green path: Visa (VTS) card in Apple Pay', hint: 'Run flow, then Next step. Approved with no extra step.',
      state: { ...base, cardId: 'crd_hb_001' } },
    { id: 'yellow', label: 'Yellow path: new device, one-time code', hint: 'Stops at the code box: try a wrong code, then 123456',
      state: { ...base, cardId: 'crd_hb_008', deviceRisk: 'medium', accountAgeDays: 3, channel: 'contactless', amount: 18.9 } },
    { id: 'red', label: 'Red path: the stolen card', hint: 'crd_hb_005 blocked as stolen: declined, no token',
      state: { ...base, cardId: 'crd_hb_005', wallet: 'google_pay', device: 'android', trid: '40010075001', accountAgeDays: 900 } },
    { id: 'story', label: 'Storyline: pay, block the stolen card, card replaced', hint: 'Use the lifecycle buttons after the token is active',
      state: { ...base, cardId: 'crd_hb_008', accountAgeDays: 500, channel: 'contactless', amount: 12 } },
    { id: 'mdes', label: 'Mastercard MDES: card-on-file at a merchant', hint: 'Pay, replay, then try contactless (refused)',
      state: { ...base, cardId: 'crd_hb_009', wallet: 'merchant_card_on_file', device: 'browser', trid: '40010099001', channel: 'card_on_file', amount: 25, merchant: 'M-011' } },
  ],
  fr: [
    { id: 'green', label: 'Parcours vert : carte CB co-badgée dans Apple Pay', hint: 'Lancer, puis Étape suivante. Approuvé sans étape en plus.',
      state: { ...base, cardId: 'crd_bl_001', merchant: 'M-F01' } },
    { id: 'yellow', label: 'Parcours jaune : nouvel appareil, code SMS', hint: "S'arrête à la saisie du code : un code faux, puis 123456",
      state: { ...base, cardId: 'crd_bl_008', wallet: 'google_pay', device: 'android', trid: '40010075001', deviceRisk: 'medium', accountAgeDays: 3, channel: 'contactless', amount: 18.9, merchant: 'M-F01' } },
    { id: 'red', label: 'Parcours rouge : la carte volée', hint: 'crd_bl_005 en opposition pour vol : refusé, pas de jeton',
      state: { ...base, cardId: 'crd_bl_005', accountAgeDays: 900, merchant: 'M-F01' } },
    { id: 'story', label: 'Fil rouge : payer, opposition pour vol, carte remplacée', hint: 'Utilisez les boutons du cycle de vie une fois le jeton actif',
      state: { ...base, cardId: 'crd_bl_008', accountAgeDays: 500, channel: 'contactless', amount: 12.4, merchant: 'M-F01' } },
  ],
};
export default samples;
