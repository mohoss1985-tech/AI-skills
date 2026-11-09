/* Samples of the Payment lifecycle & chargeback simulator: the 4 EN (Visa / Harbor Bank) and 4 FR (CB / Banque
   Lumière) worked examples of research/09. #4 in each set is the stolen-card storyline. */
const visa = { scheme: 'visa', currency: 'EUR', wallet: false, eventAmount: '', fraudReport: '', expectedDelivery: '', actions: [] };
const cb = { ...visa, scheme: 'cb' };

export const samples = {
  en: [
    { id: 'reversal', label: 'Hotel cancels before clearing: reversal', hint: 'Harbour Hotel, €65.00, same evening', autorun: true,
      state: { ...visa, amount: 65, cardId: 'crd_hb_008', merchant: 'M-002', channel: 'pos', threeDs: 'none', event: 'reversal', reason: 'customer_cancelled', authDate: '2026-11-07', captureDate: '', eventDate: '2026-11-07' } },
    { id: 'refund', label: 'Customer returns one pair: partial refund', hint: 'Northwind Shoes, €120.00 cleared, €40 back', autorun: true,
      state: { ...visa, amount: 120, cardId: 'crd_hb_001', merchant: 'M-004', channel: 'ecom', threeDs: 'authenticated', event: 'refund', reason: 'goods_returned', eventAmount: 40, authDate: '2026-11-01', captureDate: '2026-11-02', eventDate: '2026-11-08' } },
    { id: 'not-received', label: '"Not received" (13.1): merchant wins on representment', hint: 'Atlas Home, €89.00, signed proof of delivery', autorun: true,
      state: { ...visa, amount: 89, cardId: 'crd_hb_001', merchant: 'M-007', channel: 'ecom', threeDs: 'none', event: 'chargeback', reason: '13.1', expectedDelivery: '2026-10-20', authDate: '2026-10-11', captureDate: '2026-10-12', eventDate: '2026-11-08',
        actions: [{ op: 'represent', evidence: ['proof_of_delivery', 'signed_delivery'] }] } },
    { id: 'fraud-3ds', label: 'Stolen card, 10.4 fraud: blocked by 3-D Secure, issuer pays', hint: 'QuickGift Codes, €219.00, ECI 05 (switch 3-D Secure to None to see €349 charged back)', autorun: true,
      state: { ...visa, amount: 219, cardId: 'crd_hb_005', merchant: 'M-011', channel: 'ecom', threeDs: 'authenticated', event: 'chargeback', reason: '10.4', fraudReport: 'FR-2026-1301', authDate: '2026-10-30', captureDate: '2026-10-30', eventDate: '2026-11-08' } },
  ],
  fr: [
    { id: 'reversal', label: 'Annulation avant remise : double autorisation', hint: 'Boulangerie, 12,40 € autorisés deux fois', autorun: true,
      state: { ...cb, amount: 12.4, cardId: 'crd_bl_008', merchant: 'M-F01', channel: 'pos', threeDs: 'none', event: 'void', reason: 'duplicate', authDate: '2026-11-08', captureDate: '', eventDate: '2026-11-08' } },
    { id: 'refund', label: 'Remboursement après retour', hint: 'Boutique, 79 € compensés, article renvoyé', autorun: true,
      state: { ...cb, amount: 79, cardId: 'crd_bl_001', merchant: 'M-F02', channel: 'ecom', threeDs: 'authenticated', event: 'refund', reason: 'goods_returned', authDate: '2026-11-01', captureDate: '2026-11-02', eventDate: '2026-11-08' } },
    { id: 'not-received', label: 'Marchandise non reçue : représentation gagnée', hint: 'Marchand en ligne, 89 €, preuve de livraison signée', autorun: true,
      state: { ...cb, amount: 89, cardId: 'crd_bl_001', merchant: 'M-F03', channel: 'ecom', threeDs: 'none', event: 'chargeback', reason: '13.1', expectedDelivery: '2026-10-20', authDate: '2026-10-11', captureDate: '2026-10-12', eventDate: '2026-11-08',
        actions: [{ op: 'represent', evidence: ['proof_of_delivery', 'signed_delivery'] }] } },
    { id: 'fraud-3ds', label: 'Carte volée : 140 € authentifiés 3-D Secure, la banque supporte', hint: 'Remboursement L133-18 J+1 ; passez 3-D Secure à Aucun pour voir l’impayé sur 60 €', autorun: true,
      state: { ...cb, amount: 140, cardId: 'crd_bl_005', merchant: 'M-F03', channel: 'ecom', threeDs: 'authenticated', event: 'chargeback', reason: '10.4', fraudReport: 'FR-2026-2301', authDate: '2026-11-01', captureDate: '2026-11-01', eventDate: '2026-11-03' } },
  ],
};
export default samples;
