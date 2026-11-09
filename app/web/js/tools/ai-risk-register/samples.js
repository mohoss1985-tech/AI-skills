/* AI risk register samples + starter risks. EN = Visa / Harbor Bank, FR = CB / Banque Lumière (fictional).
   Storyline: a stolen card was approved in stand-in because its Exception File listing took 160 min.
   Card numbers only ever appear masked (test PAN ending 1018, research/wave1-D.md). Legal points stay *to confirm*. */
const R = (id, risk, category, likelihood, impact, owner, control, test, nist, status) => ({ id, risk, category, likelihood, impact, owner, control, test, nist, status });
const no = (ids) => Object.fromEntries(ids.map((i) => [i, 'no']));

/** Starter list (skill §2: OWASP Top 10 for LLM Applications 2025 + banking risks). */
export const STARTER = {
  en: [
    R('', 'Misinformation: invents a fee, a deadline or a scheme rule', 'Misinformation', 3, 4, '', 'Answer only from approved sources; otherwise route to a human', '', 'Measure', 'open'),
    R('', 'Prompt injection, direct or through retrieved documents', 'Prompt injection', 3, 4, '', 'Treat retrieved content as data; adversarial tests every release', '', 'Manage', 'open'),
    R('', 'Sensitive information disclosure (PAN, another customer, system prompt)', 'Sensitive information', 2, 5, '', 'Mask identifiers before the model and in logs', '', 'Manage', 'open'),
    R('', 'Excessive agency: acts on funds or cards without explicit confirmation', 'Excessive agency', 2, 5, '', 'Any action on funds goes through the bank’s confirmation flow', '', 'Govern', 'open'),
    R('', 'Retrieval returns documents the user is not entitled to', 'Vector / embedding', 2, 4, '', 'Entitlement filter before retrieval', '', 'Map', 'open'),
    R('', 'Unbounded consumption: loops or abuse drive cost and latency', 'Unbounded consumption', 2, 3, '', 'Rate limits and token budgets per session', '', 'Manage', 'open'),
    R('', 'Regulated advice (credit, investment, insurance)', 'Regulated advice', 2, 4, '', 'Scope filter with approved refusal message', '', 'Govern', 'open'),
    R('', 'Misses signs of a vulnerable customer or fraud victim', 'Vulnerable customers', 3, 4, '', 'Detect and hand off to a human with priority', '', 'Measure', 'open'),
    R('', 'Out-of-date knowledge (superseded tariff or rule)', 'Out-of-date knowledge', 3, 3, '', 'Content owner and review date on every source', '', 'Govern', 'open'),
  ],
  fr: [
    R('', 'Désinformation : invente des frais, un délai ou une règle du schéma', 'Désinformation', 3, 4, '', 'Répondre uniquement depuis les sources validées ; sinon orienter vers un conseiller', '', 'Measure', 'open'),
    R('', 'Injection de prompt, directe ou via les documents récupérés', 'Injection de prompt', 3, 4, '', 'Traiter les contenus récupérés comme des données ; tests adverses à chaque version', '', 'Manage', 'open'),
    R('', 'Divulgation d’informations sensibles (PAN, autre client, prompt système)', 'Informations sensibles', 2, 5, '', 'Masquer les identifiants avant le modèle et dans les journaux', '', 'Manage', 'open'),
    R('', 'Autonomie excessive : agit sur les fonds ou la carte sans confirmation explicite', 'Autonomie excessive', 2, 5, '', 'Toute action sur les fonds passe par le parcours de confirmation de la banque', '', 'Govern', 'open'),
    R('', "La recherche renvoie des documents auxquels l'utilisateur n'a pas droit", 'Vecteurs / embeddings', 2, 4, '', 'Filtre des habilitations avant la recherche', '', 'Map', 'open'),
    R('', 'Consommation non bornée : boucles ou abus, coût et latence', 'Consommation non bornée', 2, 3, '', 'Limites de débit et budget de jetons par session', '', 'Manage', 'open'),
    R('', 'Conseil réglementé (crédit, placement, assurance)', 'Conseil réglementé', 2, 4, '', 'Filtre de périmètre avec message de refus validé', '', 'Govern', 'open'),
    R('', "Ne repère pas un client vulnérable ou victime d'escroquerie", 'Clients vulnérables', 3, 4, '', 'Détecter et transférer en priorité à un conseiller', '', 'Measure', 'open'),
    R('', 'Connaissances obsolètes (tarif ou règle remplacés)', 'Connaissances obsolètes', 3, 3, '', 'Propriétaire et date de revue sur chaque source', '', 'Govern', 'open'),
  ],
};

export const SAMPLES = {
  en: [
    { id: 'chargeback-triage', label: 'AI-assisted chargeback triage', hint: 'Harbor Bank · Visa disputes', state: {
      system: 'Chargeback triage assistant (LLM, internal)',
      use: 'Reads a cardholder dispute claim and the transaction, suggests the Visa dispute condition and the evidence to request, drafts the letter. A disputes analyst validates every case.',
      data: 'Dispute claim text, transaction data with masked PAN (•••• 1018), merchant name, previous disputes of the card',
      does: 'Suggests and drafts only; no submission to Visa without the analyst', users: 'Disputes analysts (staff)', hosting: 'EU region of the model provider (to confirm with Compliance)',
      answers: { ...no(['p1', 'p2', 'p3', 'p4', 'p5', 'h1', 'h3', 'h4', 'h5', 't3', 't4']), h2: 'no', t1: 'unsure', t2: 'unsure' },
      risks: [
        R('R-01', 'Suggests the wrong dispute condition, the dispute is lost', 'Misinformation', 3, 4, 'Kim (Disputes)', 'Analyst validates the condition; suggestion shows its source rule', 'Golden set of 40 past disputes', 'Measure', 'mitigating'),
        R('R-02', 'Prompt injection through merchant documents attached as evidence', 'Prompt injection', 3, 4, 'CISO team', 'Attachments passed as data, never as instructions', 'Red-team set RT-01..05', 'Manage', 'open'),
        R('R-03', 'Full PAN or cardholder data reaches the prompt or the logs', 'Sensitive information', 3, 5, 'DPO', 'Mask PAN before the model (last 4 only); log retention agreed with the DPO', 'Unit test on masking with test PAN •••• 1018', 'Manage', 'mitigating'),
        R('R-04', 'Dispute submitted to Visa without analyst confirmation', 'Excessive agency', 1, 5, 'Kim (Disputes)', 'No write access to the dispute system', 'Permission review', 'Govern', 'closed'),
        R('R-05', 'Answers from a superseded version of the dispute rules (to confirm with the scheme liaison)', 'Out-of-date knowledge', 4, 3, 'Marc (Scheme liaison)', 'Rule source with version and review date', '', 'Govern', 'open'),
        R('R-06', 'Fraud dispute drafted before the fraud is reported to Visa', 'Process', 3, 4, 'Priya (Fraud)', 'Block drafting until the fraud report reference is present', 'Test case: no fraud report → refuse', 'Map', 'open'),
      ] } },
    { id: 'fraud-scoring', label: 'Fraud-scoring assistant', hint: 'Annex III 5(b) fraud carve-out', state: {
      system: 'Fraud-scoring assistant for card authorisations',
      use: 'Scores each card authorisation for fraud in real time and explains the top signals to fraud analysts; analysts decide on blocks.',
      data: 'Authorisation messages (masked PAN), device and merchant data, cardholder spending history',
      does: 'Returns a score and reasons; can put a card in "review" but cannot block it', users: 'Fraud analysts; indirectly all cardholders', hosting: 'On premises',
      answers: { ...no(['p1', 'p2', 'p3', 'p4', 'p5', 'h3', 'h4', 'h5', 't1', 't2', 't3', 't4']), h1: 'unsure', h2: 'yes', h7: 'yes' },
      risks: [
        R('R-01', 'Stand-in approves a stolen card while its Exception File listing is pending (160 min last incident); the score is not used in stand-in', 'Process', 4, 5, 'Priya (Fraud)', 'Real-time listing (REQ-02) + stand-in rule for cards blocked < 24 h', '', 'Manage', 'open'),
        R('R-02', 'Fraud rings probe the score thresholds with small test payments', 'Adversarial', 4, 4, 'Priya (Fraud)', '', '', 'Manage', 'open'),
        R('R-03', 'False positives concentrated on some customer groups', 'Bias', 3, 4, 'Model risk', 'Monthly false-positive review by segment', 'Bias test on holdout', 'Measure', 'mitigating'),
        R('R-04', 'Model drift after a merchant or fraud pattern change', 'Drift', 3, 4, 'Data science', 'Drift monitoring with alert threshold', 'Weekly backtest', 'Measure', 'mitigating'),
        R('R-05', 'Declines not explainable to the cardholder (GDPR Art. 22, to confirm with the DPO)', 'Transparency', 3, 3, 'DPO', 'Reason codes kept per decision', '', 'Govern', 'open'),
        R('R-06', 'Score reused for credit decisions, which would leave the fraud carve-out', 'Scope', 2, 5, 'AI governance', 'Purpose limitation in the model card; access review', '', 'Map', 'open'),
      ] } },
  ],
  fr: [
    { id: 'tri-impayes', label: 'Tri des impayés assisté par IA', hint: 'Banque Lumière · CB', state: {
      system: 'Assistant de tri des contestations (LLM, interne)',
      use: "Lit la contestation du porteur et l'opération, propose le motif d'impayé CB et les justificatifs à demander, rédige le courrier. Un analyste valide chaque dossier.",
      data: "Texte de la contestation, données de l'opération avec PAN masqué (•••• 2016), commerçant, contestations précédentes",
      does: "Propose et rédige uniquement ; aucun envoi sans l'analyste", users: 'Analystes impayés (salariés)', hosting: 'Région UE du fournisseur (à confirmer avec la Conformité)',
      answers: { ...no(['p1', 'p2', 'p3', 'p4', 'p5', 'h1', 'h3', 'h4', 'h5', 't3', 't4']), h2: 'no', t1: 'unsure', t2: 'unsure' },
      risks: [
        R('R-01', "Propose un mauvais motif d'impayé, le dossier est perdu", 'Désinformation', 3, 4, 'Karim (Impayés)', "L'analyste valide le motif ; la proposition cite sa règle", 'Jeu de référence de 40 dossiers', 'Measure', 'mitigating'),
        R('R-02', 'Injection de prompt via les justificatifs du commerçant', 'Injection de prompt', 3, 4, 'Équipe RSSI', 'Pièces jointes traitées comme données', 'Jeu red team RT-01..05', 'Manage', 'open'),
        R('R-03', 'PAN complet ou données porteur dans le prompt ou les journaux', 'Informations sensibles', 3, 5, 'DPO', 'PAN masqué avant le modèle ; durée de conservation validée par le DPO', 'Test de masquage avec le PAN de test •••• 2016', 'Manage', 'mitigating'),
        R('R-04', "Impayé émis sans confirmation de l'analyste", 'Autonomie excessive', 1, 5, 'Karim (Impayés)', "Pas d'accès en écriture", 'Revue des habilitations', 'Govern', 'closed'),
        R('R-05', 'Règles CB obsolètes (à confirmer avec les relations GIE CB)', 'Connaissances obsolètes', 4, 3, 'Marc (Relations GIE CB)', 'Source versionnée avec date de revue', '', 'Govern', 'open'),
        R('R-06', 'Impayé pour fraude rédigé avant la déclaration de fraude au GIE CB', 'Processus', 3, 4, 'Priya (Fraude)', 'Rédaction bloquée sans référence de déclaration', 'Cas de test : pas de déclaration → refus', 'Map', 'open'),
      ] } },
    { id: 'scoring-fraude', label: 'Assistant de scoring de fraude', hint: 'Exclusion fraude, annexe III 5(b)', state: {
      system: 'Assistant de scoring de fraude des autorisations carte',
      use: 'Note chaque autorisation CB en temps réel et explique les signaux aux analystes fraude ; les analystes décident des oppositions.',
      data: "Messages d'autorisation (PAN masqué), données terminal et commerçant, historique de dépenses",
      does: 'Renvoie un score et des motifs ; peut placer une carte « en revue » mais pas en opposition', users: 'Analystes fraude ; indirectement tous les porteurs', hosting: 'Sur site',
      answers: { ...no(['p1', 'p2', 'p3', 'p4', 'p5', 'h3', 'h4', 'h5', 't1', 't2', 't3', 't4']), h1: 'unsure', h2: 'yes', h7: 'yes' },
      risks: [
        R('R-01', "Le stand-in autorise une carte volée pendant son inscription en liste d'opposition (160 min au dernier incident) ; le score n'est pas utilisé en stand-in", 'Processus', 4, 5, 'Priya (Fraude)', 'Inscription temps réel (REQ-02) + règle stand-in pour les cartes en opposition < 24 h', '', 'Manage', 'open'),
        R('R-02', 'Des réseaux testent les seuils par de petits paiements', 'Adversarial', 4, 4, 'Priya (Fraude)', '', '', 'Manage', 'open'),
        R('R-03', 'Faux positifs concentrés sur certains groupes de clients', 'Biais', 3, 4, 'Risque de modèle', 'Revue mensuelle des faux positifs par segment', 'Test de biais', 'Measure', 'mitigating'),
        R('R-04', "Dérive du modèle après un changement de fraude", 'Dérive', 3, 4, 'Data science', 'Suivi de dérive avec seuil d’alerte', 'Backtest hebdo', 'Measure', 'mitigating'),
        R('R-05', 'Refus non explicables au porteur (RGPD art. 22, à confirmer avec le DPO)', 'Transparence', 3, 3, 'DPO', 'Motifs conservés par décision', '', 'Govern', 'open'),
        R('R-06', "Score réutilisé pour l'octroi de crédit, hors exclusion fraude", 'Périmètre', 2, 5, 'Gouvernance IA', 'Limitation de finalité dans la fiche modèle', '', 'Map', 'open'),
      ] } },
  ],
};
