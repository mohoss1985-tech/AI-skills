/* Impact heatmap samples: moving the Exception File listing to real time (shared storyline: crd_hb_009 blocked at
   09:00 on 18 Oct, listed only at 11:40, approved in stand-in at 10:15; SFD target 5 min). EN = Harbor Bank (Visa),
   FR = Banque Lumière (CB, liste d'opposition). Fictional data; the 4-hourly batch and day ranges are illustrative. */

const sc = (people, process, data, tech, compliance) => ({ people, process, data, tech, compliance });
const g = (area, dim, asIs, toBe, type, owner, size) => ({ area, dim, asIs, toBe, type, owner, size });

const EN = {
  title: 'Exception File listing in real time: impact',
  change: 'Move Exception File listing from a 4-hourly batch to real time: every blocked PAN listed within 5 minutes',
  deadline: 'PI 2027.1 (F-02 in the WSJF plan)',
  scale: 'effort',
  areas: `Card management system, system, Card IT
Authorisation host and stand-in, system, Card IT
Visa Exception File interface, system, Card IT
Block card process, process, Card servicing
Fraud operations, team, Fraud ops
Call centre, team, Contact centre
Card IT run and on-call, team, Card IT
Compliance and audit, team, Compliance`,
  scores: {
    'Card management system': sc(0, 1, 2, 3, 1),
    'Authorisation host and stand-in': sc(0, 1, 1, 3, 2),
    'Visa Exception File interface': sc(0, 1, 2, 3, 2),
    'Block card process': sc(1, 3, 1, 1, 2),
    'Fraud operations': sc(2, 2, 1, 1, 2),
    'Call centre': sc(2, 1, 0, 0, 0),
    'Card IT run and on-call': sc(3, 2, 0, 1, 0),
    'Compliance and audit': sc(0, 1, 1, 0, 3),
  },
  gaps: [
    g('Visa Exception File interface', 'tech', 'Blocked PANs sent in a batch every 4 hours (illustrative). 18 Oct: crd_hb_009 listed after 160 min and approved in stand-in at 10:15.',
      'Online Exception File update on each block, listed within 5 min; retry 3 times, then alert ops. Visa update method and timings to confirm.', 'change', 'Card IT', 'L'),
    g('Authorisation host and stand-in', 'tech', 'Stand-in checks only the last Exception File copy it received.',
      'Blocked status reaches stand-in in real time (option to confirm with the processor).', 'change', 'Card IT', 'L'),
    g('Card management system', 'data', 'Block status written to the listing table at the next batch.',
      'Block event published at once with reason, time and channel.', 'change', 'Card IT', 'M'),
    g('Block card process', 'process', 'Agents tell the cardholder "your card is blocked everywhere" while listing is pending.',
      'Confirm the listing status to the cardholder; escalate if not listed within 5 min.', 'change', 'Card servicing', 'M'),
    g('Card IT run and on-call', 'people', 'No alert when a listing fails; found the next day.',
      'On-call alerted 24/7 after 3 failed retries, with a runbook.', 'missing', 'Card IT', 'M'),
    g('Compliance and audit', 'compliance', 'Approvals after a block are not tracked; liability not measured.',
      'Monthly report of approvals after a block; listing timeliness against scheme rules (to confirm).', 'missing', 'Compliance', 'S'),
    g('Fraud operations', 'process', 'Approvals after a block are found by chance during disputes.',
      'Daily exception report of approvals after a block, reviewed by fraud ops.', 'missing', '', 'S'),
  ],
  notes: 'Storyline: SQL Q5, UAT-05 (failed), BPMN retry path and WSJF F-02 describe the same incident.',
};

const FR = {
  title: "Inscription en temps réel sur la liste d'opposition : impacts",
  change: "Inscrire chaque carte mise en opposition sur la liste d'opposition en temps réel (cible : moins de 5 minutes) au lieu d'un lot toutes les 4 heures",
  deadline: 'PI 2027.1 (F-02 du plan WSJF)',
  scale: 'effort',
  areas: `Système de gestion des cartes, système, Informatique carte
Serveur d'autorisation, système, Informatique carte
Interface liste d'opposition CB, système, Informatique carte
Processus de mise en opposition, processus, Relation client
Équipe fraude, équipe, Fraude
Centre de relation client, équipe, Relation client
Exploitation et astreinte, équipe, Informatique carte
Conformité et contrôle interne, équipe, Conformité`,
  scores: {
    'Système de gestion des cartes': sc(0, 1, 2, 3, 1),
    "Serveur d'autorisation": sc(0, 1, 1, 2, 2),
    "Interface liste d'opposition CB": sc(0, 1, 2, 3, 2),
    'Processus de mise en opposition': sc(1, 3, 1, 1, 2),
    'Équipe fraude': sc(2, 2, 1, 1, 2),
    'Centre de relation client': sc(2, 1, 0, 0, 0),
    'Exploitation et astreinte': sc(3, 2, 0, 1, 0),
    'Conformité et contrôle interne': sc(0, 1, 1, 0, 3),
  },
  gaps: [
    g("Interface liste d'opposition CB", 'tech', "Oppositions envoyées par lot toutes les 4 heures (illustratif).",
      "Inscription unitaire à chaque opposition, en moins de 5 min ; 3 relances puis alerte. Modalités GIE CB à confirmer.", 'change', 'Informatique carte', 'L'),
    g("Serveur d'autorisation", 'compliance', "Un refus 91 quand l'émetteur est indisponible (pas de stand-in CB), mais la carte n'est pas toujours connue comme opposée.",
      "Le statut d'opposition est connu du serveur d'autorisation en temps réel.", 'change', 'Informatique carte', 'M'),
    g('Système de gestion des cartes', 'data', "Statut d'opposition écrit dans la table d'inscription au lot suivant.",
      "Événement d'opposition publié immédiatement (motif, heure, canal).", 'change', 'Informatique carte', 'M'),
    g('Processus de mise en opposition', 'process', "Le conseiller annonce « carte bloquée partout » alors que l'inscription est en attente.",
      "Confirmer au client le statut d'inscription ; escalade au-delà de 5 min.", 'change', 'Relation client', 'M'),
    g('Exploitation et astreinte', 'people', "Aucune alerte en cas d'échec d'inscription ; détecté le lendemain.",
      "Astreinte alertée 24 h/24 après 3 échecs, avec procédure.", 'missing', 'Informatique carte', 'M'),
    g('Conformité et contrôle interne', 'compliance', "Paiements acceptés après opposition non suivis ; responsabilité (remboursement J+1, art. L133-18 CMF) non mesurée.",
      "Rapport mensuel des paiements acceptés après opposition ; délais d'inscription au regard des règles CB (à confirmer).", 'missing', 'Conformité', 'S'),
    g('Équipe fraude', 'process', "Paiements après opposition découverts lors des contestations.",
      "Rapport quotidien des paiements acceptés après opposition, revu par l'équipe fraude.", 'missing', '', 'S'),
  ],
  notes: 'Fil rouge : requête SQL Q5, recette UAT-05 (échec), chemin de relance BPMN et F-02 du WSJF décrivent le même incident.',
};

export const SAMPLES = {
  en: [{ id: 'exception-file-realtime', label: 'Exception File listing in real time', hint: 'Harbor Bank (sample)', state: EN, autorun: true }],
  fr: [{ id: 'liste-opposition-temps-reel', label: "Liste d'opposition en temps réel", hint: 'Banque Lumière (exemple)', state: FR, autorun: true }],
};
