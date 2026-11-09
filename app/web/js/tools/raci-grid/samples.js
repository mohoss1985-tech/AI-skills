/* RACI & power grid samples: card-blocking project. EN = Visa / Harbor Bank, FR = CB / Banque Lumière (fictional).
   Storyline: a stolen card was approved in stand-in because its Exception File listing took 160 min. Row R4 has two A's on
   purpose (the validation demo); the fraud lead is overloaded. */
const S = (id, name, role, cares, power, interest) => ({ id, name, role, cares, power, interest });
const A = (id, name, raci) => ({ id, name, raci });

export const SAMPLES = {
  en: [{
    id: 'card-blocking', label: 'Card-blocking project · 6 stakeholders', hint: 'Harbor Bank · Visa',
    state: {
      decision: 'How do we list blocked cards on the Visa Exception File in near real time?',
      decider: 'Ana, Head of cards (issuer operations)', decideBy: '2026-11-27',
      context: 'Last month a stolen card was approved in stand-in (STIP) because its Exception File listing took 160 min after the block. The nightly batch leaves the same gap for every block.',
      stakeholders: [
        S('S1', 'Ana', 'Issuer operations (Head of cards)', 'Losses, cardholder trust, budget', 85, 90),
        S('S2', 'Priya', 'Fraud team lead', 'Fraud losses, stand-in exposure', 60, 95),
        S('S3', 'Marc', 'Scheme liaison (Visa relationship)', 'Exception File rules and fees', 70, 35),
        S('S4', 'Jade', 'App team (product owner)', 'In-app block journey, release plan', 40, 75),
        S('S5', 'Omar', 'Compliance', 'PSD2 liability, complaints', 80, 40),
        S('S6', 'Leo', 'Customer service manager', 'Call volumes, agent scripts', 30, 70),
      ],
      activities: [
        A('R1', 'Prioritise real-time listing on the roadmap', { S1: 'A', S2: 'R', S3: 'C', S4: 'C', S5: 'I', S6: 'I' }),
        A('R2', 'Change request to the processor / Visa Exception File', { S1: 'I', S2: 'C', S3: 'A', S4: 'R', S5: 'C' }),
        A('R3', 'Block reasons and agent script ("used without my permission")', { S1: 'A', S2: 'C', S5: 'C', S6: 'R' }),
        A('R4', 'Release go / no-go of the in-app block journey', { S1: 'A', S2: 'R', S4: 'A', S5: 'C', S6: 'I' }),
        A('R5', 'Stand-in (STIP) risk rules while listing is pending', { S1: 'C', S2: 'A', S3: 'R' }),
        A('R6', 'Cardholder liability wording', { S1: 'C', S2: 'R', S5: 'A', S6: 'C' }),
        A('R7', 'Fraud reporting to Visa before dispute', { S1: 'I', S2: 'R', S3: 'C', S5: 'C' }),
      ],
      overload: 4,
      options: [
        { option: 'A · Processor real-time listing API', customer: 'Gap closes to minutes', business: 'Lowest fraud exposure', effort: 'M (processor fee to confirm)', risk: 'Processor dependency', prefers: 'Priya, Ana' },
        { option: 'B · Hourly listing batch', customer: 'Gap up to 60 min', business: 'Partial fix', effort: 'S', risk: 'Stand-in still exposed', prefers: 'Marc' },
        { option: 'C · Keep nightly batch + tighter stand-in rules', customer: 'More declines for good cardholders', business: 'No build cost', effort: 'S', risk: 'Fraud and complaints', prefers: '—' },
      ],
      recommendation: 'Option A: it is the only option that closes the 160-min gap; confirm the processor fee and the Visa listing rules (to confirm with the scheme liaison).',
      ifNot: 'Every block keeps a gap of up to a day in stand-in; the next stolen card can be approved again.',
      strategies: {},
    },
  }],
  fr: [{
    id: 'opposition', label: 'Projet opposition carte · 6 parties prenantes', hint: 'Banque Lumière · CB',
    state: {
      decision: "Comment inscrire les cartes en opposition sur la liste d'opposition CB quasi en temps réel ?",
      decider: 'Anne, responsable monétique (opérations émetteur)', decideBy: '2026-11-27',
      context: "Le mois dernier, une carte volée a été autorisée en stand-in parce que son inscription en liste d'opposition a pris 160 min après l'opposition. Le batch laisse le même délai à chaque opposition.",
      stakeholders: [
        S('S1', 'Anne', 'Opérations émetteur (responsable monétique)', 'Pertes, confiance, budget', 85, 90),
        S('S2', 'Priya', 'Responsable fraude', 'Pertes fraude, exposition stand-in', 60, 95),
        S('S3', 'Marc', 'Relations GIE CB', "Règles et coûts de la liste d'opposition", 70, 35),
        S('S4', 'Jade', "Équipe appli (product owner)", "Parcours d'opposition, planning", 40, 75),
        S('S5', 'Omar', 'Conformité', 'Responsabilité DSP2, réclamations', 80, 40),
        S('S6', 'Léo', 'Responsable service client', "Volumes d'appels, scripts", 30, 70),
      ],
      activities: [
        A('R1', "Prioriser l'inscription temps réel dans la feuille de route", { S1: 'A', S2: 'R', S3: 'C', S4: 'C', S5: 'I', S6: 'I' }),
        A('R2', "Demande d'évolution au processeur / liste d'opposition CB", { S1: 'I', S2: 'C', S3: 'A', S4: 'R', S5: 'C' }),
        A('R3', 'Motifs d’opposition et script conseiller (« utilisation frauduleuse »)', { S1: 'A', S2: 'C', S5: 'C', S6: 'R' }),
        A('R4', "Go / no-go du parcours d'opposition dans l'appli", { S1: 'A', S2: 'R', S4: 'A', S5: 'C', S6: 'I' }),
        A('R5', 'Règles de risque en stand-in pendant l’inscription', { S1: 'C', S2: 'A', S3: 'R' }),
        A('R6', 'Texte de responsabilité porteur (franchise 50 €)', { S1: 'C', S2: 'R', S5: 'A', S6: 'C' }),
        A('R7', 'Déclaration de fraude au GIE CB avant impayé', { S1: 'I', S2: 'R', S3: 'C', S5: 'C' }),
      ],
      overload: 4,
      options: [
        { option: 'A · API temps réel du processeur', customer: 'Délai réduit à quelques minutes', business: 'Exposition fraude minimale', effort: 'M (coût processeur à confirmer)', risk: 'Dépendance processeur', prefers: 'Priya, Anne' },
        { option: 'B · Batch horaire', customer: "Jusqu'à 60 min de délai", business: 'Correctif partiel', effort: 'S', risk: 'Stand-in toujours exposé', prefers: 'Marc' },
        { option: 'C · Batch de nuit + règles stand-in durcies', customer: 'Plus de refus pour les bons porteurs', business: 'Pas de coût de développement', effort: 'S', risk: 'Fraude et réclamations', prefers: '—' },
      ],
      recommendation: "Option A : seule option qui supprime les 160 min ; confirmer le coût processeur et les règles de la liste d'opposition (à confirmer avec les relations GIE CB).",
      ifNot: "Chaque opposition garde jusqu'à une journée d'exposition en stand-in ; la prochaine carte volée peut à nouveau être autorisée.",
      strategies: {},
    },
  }],
};
