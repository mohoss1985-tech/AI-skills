/* Workshop kit samples. EN = Visa / Harbor Bank, FR = CB / Banque Lumière (fictional). Shared storyline: a stolen card was
   approved in stand-in because its Exception File listing took 160 min. Source: V1 seeds 16-workshop.md / 116-workshop.md. */
const b = (id, title, kind, minutes, technique = '', questions = '') => ({ id, title, kind, minutes, technique, questions });
const n = (id, type, text, block, owner = '', due = '') => ({ id, type, text, block, owner, due });

const EN_AGENDA = [
  b('b1', 'Objective, rules of the session, storyline: stolen card approved in stand-in', 'intro', 10, 'Timeline on screen', 'Does everyone agree on the 160-min gap between block and Exception File listing?'),
  b('b2', 'Declare and block: app, phone, reasons', 'topic', 35, 'Process walk-through (BPMN on screen)', 'Which reasons do agents use today? What happens when the host is down? Who is accountable for the block?'),
  b('b3', 'Exception File listing and stand-in', 'topic', 30, 'Example mapping', 'How long from block to listing today? Can the processor list in real time? What does Visa check?'),
  b('b4', 'Break', 'break', 10),
  b('b5', 'Fraud declaration before dispute', 'topic', 25, '5 whys', 'Who confirms fraud? When is it reported to Visa? What happens when it is late?'),
  b('b6', 'Read back decisions and actions', 'readback', 10, 'Read-back', ''),
];
const EN_NOTES = [
  n('D-01', 'D', 'Blocking is real time in the app and by phone (Ana)', 'b2'),
  n('D-02', 'D', 'Three reasons: lost, stolen, used without my permission (Ana, Leo)', 'b2'),
  n('D-03', 'D', 'A card declared stolen is never unblocked: a new PAN is issued', 'b2'),
  n('D-04', 'D', 'Confirmed fraud is declared to Visa before a fraud dispute is opened (Priya, Kim)', 'b5'),
  n('REQ-01', 'REQ', 'Block a card in real time from the app and from the call-centre tool (Ana, Must)', 'b2'),
  n('REQ-02', 'REQ', 'List a blocked PAN on the Visa Exception File as soon as it is blocked, not in the nightly batch: last incident took 160 min (Tom, Must, feasibility open)', 'b3'),
  n('REQ-03', 'REQ', 'Suspend the wallet tokens of a blocked card (Tom, Must)', 'b3'),
  n('REQ-04', 'REQ', 'Reason "used without my permission" when the card is still with the cardholder (Leo, Must)', 'b2'),
  n('REQ-05', 'REQ', 'Fraud operations confirm flagged transactions and declare each confirmed fraud to Visa (Priya, Must)', 'b5'),
  n('REQ-06', 'REQ', 'Dashboard of fraud cases close to the dispute deadline (Kim, Should)', 'b5'),
  n('Q-01', 'Q', 'Can our processor update the Visa Exception File in real time? At what cost?', 'b3', 'Tom', '2026-11-20'),
  n('Q-02', 'Q', 'Can a card blocked as lost be unblocked within 24 h? Leo for, Priya against', 'b2', 'Ana', '2026-11-20'),
  n('Q-03', 'Q', 'What do we tell the cardholder about liability before the declaration? (to confirm with Legal)', 'b5', 'Legal', '2026-11-20'),
  n('A-01', 'A', 'Ask the processor about real-time Exception File updates', 'b3', 'Tom', '2026-11-20'),
  n('A-02', 'A', 'Fix token suspension on block (bug, not a project)', 'b3', 'Tom', '2026-11-27'),
  n('A-03', 'A', 'Volumes and lead times of fraud declarations today', 'b5', 'Priya', '2026-11-20'),
  n('A-04', 'A', 'Bring Legal to workshop 2', 'b6', 'Ana', ''),
  n('A-05', 'A', 'Draft the SFD from this report', 'b6', 'BA', '2026-11-20'),
];
const FR_AGENDA = [
  b('b1', "Objectif, règles de séance, cas réel : carte volée autorisée en stand-in", 'intro', 10, 'Chronologie à l’écran', "Tous d'accord sur les 160 min entre l'opposition et l'inscription en liste d'opposition ?"),
  b('b2', 'Opposition : appli, téléphone, motifs', 'topic', 35, 'Parcours du processus (BPMN à l’écran)', "Quels motifs les conseillers utilisent-ils ? Que se passe-t-il si le serveur d'autorisation est indisponible ? Qui est responsable ?"),
  b('b3', "Liste d'opposition CB et stand-in", 'topic', 30, 'Example mapping', "Quel délai entre opposition et inscription aujourd'hui ? Temps réel possible ? Que contrôle le GIE CB ?"),
  b('b4', 'Pause', 'break', 10),
  b('b5', 'Déclaration de fraude avant impayé', 'topic', 25, '5 pourquoi', 'Qui confirme la fraude ? Quand est-elle déclarée au GIE CB ? Que se passe-t-il en cas de retard ?'),
  b('b6', 'Relecture des décisions et actions', 'readback', 10, 'Relecture', ''),
];
const FR_NOTES = [
  n('D-01', 'D', "Opposition temps réel dans l'appli et au téléphone (Anne)", 'b2'),
  n('D-02', 'D', 'Trois motifs : perte, vol, utilisation frauduleuse (Anne, Léo)', 'b2'),
  n('D-03', 'D', "Carte volée : jamais de levée d'opposition, nouvelle carte", 'b2'),
  n('D-04', 'D', 'La fraude est déclarée au GIE CB avant tout impayé (Priya, Karim)', 'b5'),
  n('REQ-01', 'REQ', "Mettre une carte en opposition en temps réel depuis l'appli et l'outil du centre d'appels (Anne, Must)", 'b2'),
  n('REQ-02', 'REQ', "Inscrire la carte en liste d'opposition dès l'opposition : dernier incident 160 min (Thomas, Must, faisabilité ouverte)", 'b3'),
  n('REQ-03', 'REQ', "Suspendre les jetons de paiement mobile d'une carte en opposition (Thomas, Must)", 'b3'),
  n('REQ-04', 'REQ', 'Rembourser automatiquement les contestations à J+1 ouvré sauf soupçon de fraude du porteur (Priya, Must, seuil à définir)', 'b5'),
  n('Q-01', 'Q', "Le serveur d'autorisation peut-il recevoir les oppositions en temps réel ? Coût ?", 'b3', 'Thomas', '2026-11-20'),
  n('Q-02', 'Q', 'Levée possible sous 24 h pour une carte perdue ? Léo pour, Priya contre', 'b2', 'Anne', '2026-11-20'),
  n('Q-03', 'Q', 'Franchise de 50 € et texte au porteur (à confirmer avec le Juridique)', 'b5', 'Juridique', '2026-11-20'),
  n('A-01', 'A', "Chiffrer l'inscription temps réel en liste d'opposition", 'b3', 'Thomas', '2026-11-20'),
  n('A-02', 'A', 'Corriger la suspension des jetons à l’opposition', 'b3', 'Thomas', '2026-11-27'),
  n('A-03', 'A', 'Volumes et délais de déclaration de fraude actuels', 'b5', 'Priya', '2026-11-20'),
  n('A-04', 'A', 'Inviter le Juridique à l’atelier 2', 'b6', 'Anne', ''),
];
const PLAN_EN = [
  b('p1', 'Objective and recap of workshop 1', 'intro', 10),
  b('p2', 'Cardholder liability wording', 'topic', 30, 'Example mapping', 'What do we promise before and after the declaration? (to confirm with Legal)'),
  b('p3', 'Unblock rule for lost cards', 'topic', 30, 'Dot voting', 'What is the fraud risk if the card is found by someone else?'),
  b('p4', 'Dispute deadline dashboard', 'topic', 20, 'Sketch on screen', 'Which cases are close to the deadline today?'),
];
const PLAN_FR = [
  b('p1', "Objectif et rappel de l'atelier 1", 'intro', 10),
  b('p2', 'Franchise et texte au porteur', 'topic', 30, 'Example mapping', 'Que promet-on avant et après la déclaration ? (à confirmer avec le Juridique)'),
  b('p3', "Levée d'opposition pour une carte perdue", 'topic', 30, 'Vote par points', 'Quel risque si la carte est retrouvée par un tiers ?'),
  b('p4', 'Seuil de remboursement automatique', 'topic', 20, 'Esquisse à l’écran', 'Quel montant, quels cas exclus ?'),
];

export const SAMPLES = {
  en: [
    { id: 'declare-w1', label: 'Lost / stolen card declaration · notes captured', hint: 'Harbor Bank · Visa', state: {
      goal: 'Agree how a lost, stolen or misused card is declared, blocked, listed on the Visa Exception File and disputed',
      attendees: 'Ana (Head of cards, sponsor), Tom (Card IT, authorisation host), Priya (Fraud operations), Leo (Call centre manager), Kim (Disputes), BA (facilitator), Legal (absent)',
      duration: 120, date: '2026-11-13', start: '09:30', location: 'Room 4B + Teams', preReads: 'Incident timeline: stolen card approved in stand-in (block → Exception File listing 160 min)',
      nextWorkshop: 'Liability wording, unblock rule, real-time Exception File, dispute deadline dashboard. Same attendees plus Legal (mandatory).',
      agenda: EN_AGENDA, notes: EN_NOTES, timer: { i: 0, startedAt: null, acc: 0, spent: {} } } },
    { id: 'declare-w2', label: 'Workshop 2 with Legal · plan to fix', hint: 'Over-booked, no read-back', state: {
      goal: 'Decide the liability wording and the unblock rule for lost cards',
      attendees: 'Ana (Head of cards, sponsor), Legal counsel, Priya (Fraud operations), Leo (Call centre manager)',
      duration: 60, date: '2026-11-20', start: '14:00', location: 'Teams', preReads: 'Workshop 1 report', nextWorkshop: '',
      agenda: PLAN_EN, notes: [], timer: { i: 0, startedAt: null, acc: 0, spent: {} } } },
  ],
  fr: [
    { id: 'opposition-a1', label: 'Opposition et déclaration de fraude · notes prises', hint: 'Banque Lumière · CB', state: {
      goal: "Définir comment une carte perdue, volée ou utilisée frauduleusement est mise en opposition, inscrite en liste d'opposition CB, remboursée et traitée en impayé",
      attendees: "Anne (responsable monétique, sponsor), Thomas (IT monétique, serveur d'autorisation), Priya (fraude), Léo (centre d'appels), Karim (impayés), BA (animateur), Juridique (absent)",
      duration: 120, date: '2026-11-13', start: '09:30', location: 'Salle 4B + Teams', preReads: "Chronologie de l'incident : carte volée autorisée en stand-in (opposition → liste d'opposition 160 min)",
      nextWorkshop: "Franchise et texte au porteur, levée d'opposition, seuil de remboursement automatique. Mêmes participants plus le Juridique (obligatoire).",
      agenda: FR_AGENDA, notes: FR_NOTES, timer: { i: 0, startedAt: null, acc: 0, spent: {} } } },
    { id: 'opposition-a2', label: 'Atelier 2 avec le Juridique · plan à corriger', hint: 'Trop chargé, sans relecture', state: {
      goal: "Décider du texte de franchise et de la règle de levée d'opposition",
      attendees: 'Anne (responsable monétique, sponsor), Juriste, Priya (fraude), Léo (centre d’appels)',
      duration: 60, date: '2026-11-20', start: '14:00', location: 'Teams', preReads: "Compte-rendu de l'atelier 1", nextWorkshop: '',
      agenda: PLAN_FR, notes: [], timer: { i: 0, startedAt: null, acc: 0, spent: {} } } },
  ],
};
