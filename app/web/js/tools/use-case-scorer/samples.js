/* AI use-case scorer samples: 6 card-payment use cases for a servicing assistant.
   EN = Harbor Bank (Visa), FR = Banque Lumière (CB). Fictional data; volumes are illustrative.
   With the default weights: Now = declines + block card, Next = refund (knowledge gate) + unrecognised payment
   (risk gate), Later = merchant chargeback status, Excluded = credit-limit advice (regulated). */

const uc = (id, name, value, feasibility, risk, knowledge, volume, guardrail, regulated, note) => ({
  id, name, value, feasibility, risk, knowledge, volume, guardrail, regulated, note,
});

export const SAMPLES = {
  en: [{
    id: 'harbor-assistant',
    title: 'Harbor Bank card assistant: what to automate first',
    client: 'Harbor Bank (sample)',
    state: {
      title: 'Harbor Bank card assistant: what to automate first',
      weights: { value: 50, feasibility: 30, risk: 20 },
      rules: { nowMin: 3.5, nextMin: 2.5, nowSlots: 3, riskGate: 4, knowledgeGate: 2 },
      useCases: [
        uc('UC-01', 'Why was my card declined?', 5, 4, 2, 4, 18000, false, false,
          'Explain the Visa response code (51, 54, 43…) in plain words from the authorisation record.'),
        uc('UC-02', 'Block my lost or stolen card', 5, 3, 4, 4, 6500, true, false,
          'Calls the block API; hand-off to an agent if the block fails. Must list the PAN on the Exception File in 5 min (18 Oct: 160 min, card approved in stand-in).'),
        uc('UC-03', 'Where is my refund?', 4, 4, 2, 2, 7200, false, false,
          'Refund timelines are spread over 3 outdated FAQ pages: content work first.'),
        uc('UC-04', "I don't recognise this payment", 4, 3, 4, 3, 4100, false, false,
          'Starts a fraud declaration / dispute 10.4. Needs a guardrail and a hand-off to fraud ops.'),
        uc('UC-05', 'Chargeback status for merchants (acquiring)', 2, 2, 3, 3, 900, false, false,
          'Low volume, needs the acquiring case system.'),
        uc('UC-06', 'Can you raise my credit limit?', 3, 2, 5, 3, 1500, false, true,
          'Credit advice is a regulated topic: out of scope for the assistant.'),
      ],
    },
  }],
  fr: [{
    id: 'lumiere-assistant',
    title: 'Assistant carte Banque Lumière : quoi automatiser en premier',
    client: 'Banque Lumière (exemple)',
    state: {
      title: 'Assistant carte Banque Lumière : quoi automatiser en premier',
      weights: { value: 50, feasibility: 30, risk: 20 },
      rules: { nowMin: 3.5, nextMin: 2.5, nowSlots: 3, riskGate: 4, knowledgeGate: 2 },
      useCases: [
        uc('UC-01', 'Pourquoi mon paiement a-t-il été refusé ?', 5, 4, 2, 4, 18000, false, false,
          "Expliquer le motif de refus CB (codes *à confirmer*) en mots simples depuis l'autorisation."),
        uc('UC-02', 'Faire opposition sur ma carte perdue ou volée', 5, 3, 4, 4, 6500, true, false,
          "Appelle l'API d'opposition ; transfert à un conseiller en cas d'échec. Inscription en liste d'opposition en 5 min (18 oct. : 160 min, carte acceptée en autorisation de secours)."),
        uc('UC-03', 'Où en est mon remboursement ?', 4, 4, 2, 2, 7200, false, false,
          "Délais de remboursement répartis sur 3 pages FAQ obsolètes : d'abord le contenu."),
        uc('UC-04', 'Je ne reconnais pas cette opération', 4, 3, 4, 3, 4100, false, false,
          'Ouvre une contestation (remboursement J+1, art. L133-18 CMF). Garde-fou et transfert à la fraude requis.'),
        uc('UC-05', "Suivi d'un impayé pour un commerçant (acquisition)", 2, 2, 3, 3, 900, false, false,
          "Faible volume, nécessite l'outil de gestion des impayés acquéreur."),
        uc('UC-06', 'Pouvez-vous augmenter mon plafond de crédit ?', 3, 2, 5, 3, 1500, false, true,
          "Le conseil en crédit est un sujet réglementé : hors périmètre de l'assistant."),
      ],
    },
  }],
};

export default SAMPLES;
