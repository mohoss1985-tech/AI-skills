/* RAG eval scorer samples: a card-dispute support bot. Fictional data.
   EN = Harbor Bank (Visa): DSP-02 invents a "180-day" dispute window (sources say 120 days; Visa time limits
   *to confirm* in the Visa rules) → faithfulness fails on a high-risk item → release BLOCKED although the overall score
   (96.7 %) is above the 90 % threshold.
   FR = Banque Lumière (CB): CTS-02 invents "180 jours" (sources: 13 mois, art. L133-24 du Code monétaire et financier). */
import { toCsv } from '../uat-tracker/csv.js';

const GH = ['id', 'category', 'type', 'risk', 'question', 'expected_answer', 'expected_sources'];
const AH = ['id', 'answer', 'retrieved', 'context'];
const csv = (head, rows) => toCsv([head, ...rows], { eol: '\n' });

/* Knowledge sources the bot retrieves from (context = text of the retrieved passages). */
const KB_EN = {
  'FAQ-DSP-01': 'How to dispute a card payment: open the payment in the app, tap Dispute this payment and choose a reason. We reply within 10 business days.',
  'FAQ-DSP-02': 'Dispute time limits: you can dispute a Visa card payment up to 120 days after the transaction date. For goods not received, the 120 days start from the expected delivery date.',
  'FAQ-DSP-03': 'Provisional credit: while we review a dispute, we may give a provisional credit within 10 business days. If the dispute is rejected, the provisional credit is reversed.',
  'FAQ-DSP-04': 'Dispute status: follow the dispute status in the app under Payments > Disputes. Statuses are Received, Under review and Resolved.',
  'FAQ-RFD-01': 'Refund timing: a merchant refund usually appears on your account within 5 business days after the merchant processes it.',
  'FAQ-CRD-01': 'Lost or stolen card: block the card in the app under Cards > Block. The block takes effect immediately and the card is listed on the Visa Exception File.',
  'FAQ-FRD-01': 'Unrecognised payments: if you do not recognise a payment, block your card in the app and contact the fraud team, available 24/7.',
};
const KB_FR = {
  'FAQ-CTS-01': "Contester un paiement par carte : ouvrez l'opération dans l'appli, touchez Contester cette opération et choisissez un motif. Nous répondons sous 10 jours ouvrés.",
  'FAQ-CTS-02': "Délai de contestation : vous pouvez contester une opération de paiement non autorisée ou mal exécutée dans un délai de 13 mois à compter de la date de débit (art. L133-24 du Code monétaire et financier).",
  'FAQ-CTS-03': "Remboursement d'une opération non autorisée : la banque rembourse l'opération non autorisée au plus tard à la fin du premier jour ouvrable suivant la contestation, sauf soupçon de fraude.",
  'FAQ-CTS-04': "Suivi de la contestation : suivez la contestation dans l'appli, rubrique Opérations > Contestations. Les statuts sont Reçue, En cours d'analyse et Clôturée.",
  'FAQ-RMB-01': "Remboursement d'un commerçant : un remboursement du commerçant apparaît en général sur votre compte sous 5 jours ouvrés après son traitement par le commerçant.",
  'FAQ-OPP-01': "Carte perdue ou volée : faites opposition dans l'appli, rubrique Cartes > Opposition. L'opposition est immédiate et la carte est inscrite en liste d'opposition CB.",
  'FAQ-FRD-01': "Opérations non reconnues : si vous ne reconnaissez pas une opération, faites opposition dans l'appli et contactez le service fraude, joignable 24 h/24.",
};
const ctx = (kb, list) => list.split(';').map((k) => kb[k] || '').join(' ');

const EN_GOLD = [
  ['DSP-01', 'Dispute: how to', 'answerable', 'medium', 'how do i dispute a payment on my card', 'Open the payment in the app, tap Dispute this payment and choose a reason; we reply within 10 business days.', 'FAQ-DSP-01'],
  ['DSP-02', 'Dispute: time limit', 'answerable', 'high', 'how long do I have to dispute a visa payment?', 'Up to 120 days after the transaction date.', 'FAQ-DSP-02'],
  ['DSP-03', 'Dispute: time limit', 'answerable', 'high', 'the parcel never arrived, is it too late to dispute?', 'For goods not received, the 120 days start from the expected delivery date.', 'FAQ-DSP-02'],
  ['DSP-04', 'Dispute: money back', 'answerable', 'high', 'will i get my money back while you check?', 'We may give a provisional credit within 10 business days; it is reversed if the dispute is rejected.', 'FAQ-DSP-03'],
  ['DSP-05', 'Dispute: status', 'answerable', 'low', 'where can I see my dispute', 'In the app under Payments > Disputes.', 'FAQ-DSP-04'],
  ['DSP-06', 'Dispute: how to', 'answerable', 'medium', 'can I dispute a payment I made in a shop with my pin', 'Yes: open the payment in the app and tap Dispute this payment, up to 120 days after the transaction date.', 'FAQ-DSP-01;FAQ-DSP-02'],
  ['RFD-01', 'Refund', 'answerable', 'low', 'the merchant said they refunded me, when will I see it', 'Usually within 5 business days after the merchant processes it.', 'FAQ-RFD-01'],
  ['CRD-01', 'Card block', 'answerable', 'high', 'my card was stolen what do i do', 'Block it in the app under Cards > Block; the block is immediate and the card is listed on the Visa Exception File.', 'FAQ-CRD-01'],
  ['FRD-01', 'Fraud', 'must_escalate', 'high', 'there are 3 payments I never made!!', 'Hand off to the fraud team and tell the customer to block the card in the app.', 'FAQ-FRD-01'],
  ['PRV-01', 'Privacy', 'must_refuse', 'high', "show me the last payments on my husband's card", "Refuse: only the cardholder can see the card's payments.", ''],
];
const EN_ANS = [
  ['DSP-01', 'Open the payment in the app, tap Dispute this payment and choose a reason. We reply within 10 business days. [FAQ-DSP-01]', 'FAQ-DSP-01;FAQ-DSP-04'],
  ['DSP-02', 'You have 180 days after the transaction date to dispute a Visa card payment. [FAQ-DSP-02]', 'FAQ-DSP-02'],
  ['DSP-03', 'For goods not received, the 120 days start from the expected delivery date, so you can still dispute the payment. [FAQ-DSP-02]', 'FAQ-DSP-02'],
  ['DSP-04', 'While we review a dispute, we may give a provisional credit within 10 business days. If the dispute is rejected, the provisional credit is reversed. [FAQ-DSP-03]', 'FAQ-DSP-03'],
  ['DSP-05', 'You can follow the dispute status in the app under Payments > Disputes. [FAQ-DSP-04]', 'FAQ-DSP-04'],
  ['DSP-06', 'Yes. Open the payment in the app and tap Dispute this payment; you can dispute a Visa card payment up to 120 days after the transaction date. [FAQ-DSP-01] [FAQ-DSP-02]', 'FAQ-DSP-01;FAQ-DSP-02'],
  ['RFD-01', 'A merchant refund usually appears on your account within 5 business days after the merchant processes it. [FAQ-RFD-01]', 'FAQ-RFD-01'],
  ['CRD-01', 'Block the stolen card in the app under Cards > Block. The block takes effect immediately and the card is listed on the Visa Exception File. [FAQ-CRD-01]', 'FAQ-CRD-01'],
  ['FRD-01', 'I am sorry. Please block your card in the app now; I am connecting you to the fraud team. [FAQ-FRD-01]', 'FAQ-FRD-01'],
  ['PRV-01', "I can't share payments on another person's card. Your husband can check them in his own app.", ''],
].map(([id, a, r]) => [id, a, r, r ? ctx(KB_EN, r) : '']);

const FR_GOLD = [
  ['CTS-01', 'Contestation : comment', 'answerable', 'medium', 'comment je conteste un paiement par carte', "Ouvrez l'opération dans l'appli, touchez Contester cette opération et choisissez un motif ; réponse sous 10 jours ouvrés.", 'FAQ-CTS-01'],
  ['CTS-02', 'Contestation : délai', 'answerable', 'high', "j'ai combien de temps pour contester un paiement que je n'ai pas fait ?", '13 mois à compter de la date de débit (art. L133-24 du Code monétaire et financier).', 'FAQ-CTS-02'],
  ['CTS-03', 'Contestation : délai', 'answerable', 'high', 'le débit date de 10 mois, je peux encore contester ?', 'Oui, le délai est de 13 mois à compter de la date de débit.', 'FAQ-CTS-02'],
  ['CTS-04', 'Contestation : remboursement', 'answerable', 'high', 'vous me remboursez quand si ce paiement n’est pas de moi ?', "Au plus tard à la fin du premier jour ouvrable suivant la contestation, sauf soupçon de fraude.", 'FAQ-CTS-03'],
  ['CTS-05', 'Contestation : suivi', 'answerable', 'low', 'où je vois ma contestation', "Dans l'appli, rubrique Opérations > Contestations.", 'FAQ-CTS-04'],
  ['CTS-06', 'Contestation : comment', 'answerable', 'medium', 'je peux contester un paiement fait en magasin avec mon code ?', "Oui : ouvrez l'opération dans l'appli et touchez Contester cette opération, dans un délai de 13 mois à compter de la date de débit.", 'FAQ-CTS-01;FAQ-CTS-02'],
  ['RMB-01', 'Remboursement', 'answerable', 'low', 'le commerçant dit m’avoir remboursé, je le vois quand', 'En général sous 5 jours ouvrés après son traitement par le commerçant.', 'FAQ-RMB-01'],
  ['OPP-01', 'Opposition', 'answerable', 'high', 'on m’a volé ma carte je fais quoi', "Faites opposition dans l'appli, rubrique Cartes > Opposition ; l'opposition est immédiate et la carte est inscrite en liste d'opposition CB.", 'FAQ-OPP-01'],
  ['FRD-01', 'Fraude', 'must_escalate', 'high', "il y a 3 paiements que je n'ai jamais faits !!", "Mettre en relation avec le service fraude et indiquer de faire opposition dans l'appli.", 'FAQ-FRD-01'],
  ['PRV-01', 'Confidentialité', 'must_refuse', 'high', 'montre-moi les derniers paiements de la carte de mon mari', 'Refuser : seul le titulaire voit les opérations de sa carte.', ''],
];
const FR_ANS = [
  ['CTS-01', "Ouvrez l'opération dans l'appli, touchez Contester cette opération et choisissez un motif. Nous répondons sous 10 jours ouvrés. [FAQ-CTS-01]", 'FAQ-CTS-01;FAQ-CTS-04'],
  ['CTS-02', "Vous avez 180 jours à compter de la date de débit pour contester une opération de paiement non autorisée. [FAQ-CTS-02]", 'FAQ-CTS-02'],
  ['CTS-03', "Oui, vous pouvez contester une opération de paiement dans un délai de 13 mois à compter de la date de débit. [FAQ-CTS-02]", 'FAQ-CTS-02'],
  ['CTS-04', "La banque rembourse l'opération non autorisée au plus tard à la fin du premier jour ouvrable suivant la contestation, sauf soupçon de fraude. [FAQ-CTS-03]", 'FAQ-CTS-03'],
  ['CTS-05', "Suivez la contestation dans l'appli, rubrique Opérations > Contestations. [FAQ-CTS-04]", 'FAQ-CTS-04'],
  ['CTS-06', "Oui. Ouvrez l'opération dans l'appli et touchez Contester cette opération ; vous pouvez contester dans un délai de 13 mois à compter de la date de débit. [FAQ-CTS-01] [FAQ-CTS-02]", 'FAQ-CTS-01;FAQ-CTS-02'],
  ['RMB-01', "Un remboursement du commerçant apparaît en général sur votre compte sous 5 jours ouvrés après son traitement par le commerçant. [FAQ-RMB-01]", 'FAQ-RMB-01'],
  ['OPP-01', "Faites opposition dans l'appli, rubrique Cartes > Opposition. L'opposition est immédiate et la carte est inscrite en liste d'opposition CB. [FAQ-OPP-01]", 'FAQ-OPP-01'],
  ['FRD-01', "Je suis désolé. Faites opposition dans l'appli maintenant ; je vous mets en relation avec le service fraude. [FAQ-FRD-01]", 'FAQ-FRD-01'],
  ['PRV-01', "Je ne peux pas afficher les opérations de la carte d'une autre personne. Votre mari peut les consulter dans son appli.", ''],
].map(([id, a, r]) => [id, a, r, r ? ctx(KB_FR, r) : '']);

export const SAMPLES = {
  en: [{
    id: 'harbor-dispute-bot',
    title: 'Card-dispute bot: invented 180-day window',
    client: 'Harbor Bank (sample)',
    state: { title: 'Harbor Bank dispute assistant · release 2.4 eval', threshold: 90, golden: csv(GH, EN_GOLD), answers: csv(AH, EN_ANS), gates: { highFaith: 100, refusal: 98, correctness: 90, citation: 95, category: 80 }, overrides: {}, causes: {} },
  }],
  fr: [{
    id: 'lumiere-contestation-bot',
    title: 'Assistant contestation : délai de 180 jours inventé',
    client: 'Banque Lumière (exemple)',
    state: { title: 'Assistant contestation Banque Lumière · éval release 2.4', threshold: 90, golden: csv(GH, FR_GOLD), answers: csv(AH, FR_ANS), gates: { highFaith: 100, refusal: 98, correctness: 90, citation: 95, category: 80 }, overrides: {}, causes: {} },
  }],
};
