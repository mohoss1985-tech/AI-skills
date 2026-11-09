/* KB audit samples: card-support knowledge base of a servicing assistant. EN = Harbor Bank (Visa), FR = Banque Lumière (CB).
   Fictional people and volumes (illustrative). As of 2026-11-09 so the result is stable. Scheme deadlines stay *to confirm*. */

const EN = {
  title: 'Harbor Bank card-support knowledge base',
  asOf: '2026-11-09', dueWindow: 30, writers: 2, perWriter: 2,
  cycles: { faq: 180, procedure: 90, tariff: 30, policy: 365, script: 90 },
  articles: `KB-01, I lost my card: how do I block it?, Priya Shah, 2026-09-30, procedure, customer
KB-02, My card was stolen, Priya Shah, 2026-03-02, procedure, customer
KB-03, How do I dispute a payment?, Tom Reed, 2026-08-15, faq, customer
KB-04, Chargeback timelines (Visa), Tom Reed, 2025-11-20, faq, customer
KB-05, Card fees and charges, , 2026-10-01, tariff, customer
KB-06, Why was my card declined?, Ana Costa, 2026-10-20, faq, customer
KB-07, Freeze or unfreeze your card in the app, Ana Costa, 2026-06-10, faq, customer
KB-08, Advisor script: fraud call handling, Mark Byrne, 2026-02-14, script, internal
KB-09, Replacement card delivery times, Ana Costa, , faq, customer
KB-10, Dispute a card payment, Tom Reed, 2024-12-01, faq, customer`,
  owners: `Priya Shah, Card servicing, active
Tom Reed, Disputes, active
Ana Costa, Digital, active
Mark Byrne, Fraud ops, left`,
  questions: `I lost my card, 6500, KB-01, Y
Why was my card declined?, 18000, KB-06, Y
Where is my refund?, 7200, , N
I don't recognise this payment, 4100, KB-03 KB-10, P
How long does a chargeback take?, 2300, KB-04, Y
My card was stolen and used, 1900, KB-02 KB-08, Y
When will my new card arrive?, 3100, KB-09, P
Can I get a card for my child?, 800, , N`,
  notes: 'KB-01 says "your card is blocked everywhere at once": since the 18 Oct incident (Exception File listing took 160 min) the wording needs Card IT review. Chargeback timelines (120 days and exceptions) to confirm against current Visa rules.',
};

const FR = {
  title: 'Base de connaissances carte de Banque Lumière',
  asOf: '2026-11-09', dueWindow: 30, writers: 2, perWriter: 2,
  cycles: { faq: 180, procedure: 90, tariff: 30, policy: 365, script: 90 },
  articles: `KB-01, J'ai perdu ma carte : comment faire opposition ?, Claire Dubois, 2026-09-30, procédure, client
KB-02, On m'a volé ma carte, Claire Dubois, 2026-03-02, procédure, client
KB-03, Comment contester un paiement ?, Hugo Lefèvre, 2026-08-15, faq, client
KB-04, Délais de contestation (13 mois, art. L133-24 CMF), Hugo Lefèvre, 2025-11-20, faq, client
KB-05, Tarifs de la carte, , 2026-10-01, tarif, client
KB-06, Pourquoi mon paiement a-t-il été refusé ?, Inès Moreau, 2026-10-20, faq, client
KB-07, Bloquer ou débloquer ma carte dans l'appli, Inès Moreau, 2026-06-10, faq, client
KB-08, Script conseiller : appel pour fraude, Marc Bernard, 2026-02-14, script, interne
KB-09, Délai de réception d'une nouvelle carte, Inès Moreau, , faq, client
KB-10, Contester une opération carte, Hugo Lefèvre, 2024-12-01, faq, client`,
  owners: `Claire Dubois, Relation client, actif
Hugo Lefèvre, Contestations, actif
Inès Moreau, Digital, actif
Marc Bernard, Fraude, parti`,
  questions: `J'ai perdu ma carte, 6500, KB-01, O
Pourquoi ma carte est refusée ?, 18000, KB-06, O
Quand serai-je remboursé ?, 7200, , N
Je ne reconnais pas ce paiement, 4100, KB-03 KB-10, P
Combien de temps pour contester ?, 2300, KB-04, O
On m'a volé ma carte et elle a été utilisée, 1900, KB-02 KB-08, O
Quand vais-je recevoir ma nouvelle carte ?, 3100, KB-09, P
Puis-je avoir une carte pour mon enfant ?, 800, , N`,
  notes: "« Quand serai-je remboursé ? » : le remboursement d'une opération non autorisée intervient au plus tard le premier jour ouvrable suivant (art. L133-18 CMF) ; aucun article ne le dit. Délais d'impayé côté commerçant à confirmer.",
};

export const SAMPLES = {
  en: [{ id: 'harbor-card-support', label: 'Card-support knowledge base', hint: 'Harbor Bank (sample)', state: EN, autorun: true }],
  fr: [{ id: 'lumiere-support-carte', label: 'Base de connaissances carte', hint: 'Banque Lumière (exemple)', state: FR, autorun: true }],
};
