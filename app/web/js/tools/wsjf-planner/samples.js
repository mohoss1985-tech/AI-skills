/* WSJF & PI planner samples. EN = Harbor Bank (Visa), FR = Banque Lumière (CB). Fictional data.
   Same 8 features as the V1 sample (skills/managing-backlog/examples/pi-features.csv, research/06), so V1 and V2 match.
   Storyline: F-02 is the Exception File latency item (stolen card approved in stand-in because its listing took 160 min).
   samples.json holds the same content (regenerate with `node app/web/js/tools/wsjf-planner/logic.test.mjs --write-json`). */

const item = (id, title, type, bv, tc, rr, size, points, deps = '', deadline = '', note = '') => ({
  id, title, type, business_value: bv, time_criticality: tc, risk_reduction: rr, job_size: size, points, depends_on: deps, deadline, note,
});

export const SAMPLES = {
  en: [{
    id: 'harbor-pi',
    title: 'PI planning: cards team, PAN declaration and disputes',
    client: 'Harbor Bank (sample)',
    state: {
      title: 'PI planning: cards team, PAN declaration and disputes',
      capacity: 120,
      project: 'CARD',
      calc: { sprints: 4, velocity: 40, runPct: 10, bufferPct: 15 },
      items: [
        item('F-01', 'Block a lost or stolen card in the app', 'Epic', 20, 13, 13, 8, 34, 'F-06', 'in-pi', 'Promised before June.'),
        item('F-02', 'Add blocked PANs to the Visa Exception File automatically', 'Epic', 8, 13, 20, 5, 21, 'F-06', 'in-pi',
          'Storyline: on 18 Oct a stolen card was approved in stand-in because its Exception File listing took 160 min (target 5 min). Audit point.'),
        item('F-03', 'Fraud declaration workflow for unrecognised transactions', 'Epic', 13, 8, 13, 8, 30),
        item('F-04', 'Open disputes from the fraud declaration', 'Epic', 8, 3, 5, 13, 40, 'F-03'),
        item('F-05', 'Explain declined payments in the app (response codes)', 'Story', 5, 2, 2, 3, 13),
        item('F-06', 'Real-time block API on the authorisation host', 'Enabler', 3, 13, 20, 5, 21, '', 'in-pi'),
        item('F-07', 'Suspend wallet tokens when the card is blocked', 'Story', 8, 8, 13, 3, 13, 'F-06'),
        item('F-08', 'Merchant category controls set by the cardholder', 'Epic', 5, 2, 3, 8, 26),
      ],
      objectives: [
        { text: 'A blocked card is refused everywhere at once, including wallet payments and stand-in', bv: 10, committed: true },
        { text: 'Cardholders block a lost or stolen card in the app in under a minute', bv: 9, committed: true },
        { text: 'Fraud ops declare confirmed fraud to Visa from the case, the same day', bv: 7, committed: true },
        { text: 'Declined payments explained in the app', bv: 3, committed: false },
      ],
    },
  }],
  fr: [{
    id: 'lumiere-pi',
    title: 'PI planning : équipe monétique, opposition et impayés',
    client: 'Banque Lumière (exemple)',
    state: {
      title: 'PI planning : équipe monétique, opposition et impayés',
      capacity: 120,
      project: 'CARTE',
      calc: { sprints: 4, velocity: 40, runPct: 10, bufferPct: 15 },
      items: [
        item('F-01', "Mise en opposition dans l'application", 'Epic', 20, 13, 13, 8, 34, 'F-06', 'in-pi', 'Promis avant juin.'),
        item('F-02', "Inscription automatique des cartes en opposition sur la liste d'opposition CB", 'Epic', 8, 13, 20, 5, 21, 'F-06', 'in-pi',
          "Fil rouge : le 18 oct., une carte volée a été acceptée en autorisation de secours car son inscription en liste d'opposition a pris 160 min (cible 5 min). Point d'audit."),
        item('F-03', 'Déclaration de fraude au GIE CB depuis le dossier', 'Epic', 13, 8, 13, 8, 30),
        item('F-04', 'Émission des impayés depuis le dossier de fraude', 'Epic', 8, 3, 5, 13, 40, 'F-03'),
        item('F-05', "Explication des refus de paiement dans l'appli", 'Story', 5, 2, 2, 3, 13),
        item('F-06', "API d'opposition temps réel sur le serveur d'autorisation", 'Enabler', 3, 13, 20, 5, 21, '', 'in-pi'),
        item('F-07', "Suspension des jetons de paiement mobile à l'opposition", 'Story', 8, 8, 13, 3, 13, 'F-06'),
        item('F-08', 'Blocage par catégorie de commerçant', 'Epic', 5, 2, 3, 8, 26),
      ],
      objectives: [
        { text: 'Une carte en opposition est refusée partout immédiatement, y compris en paiement mobile et en autorisation de secours', bv: 10, committed: true },
        { text: "Les porteurs font opposition dans l'appli en moins d'une minute", bv: 9, committed: true },
        { text: 'La fraude confirmée est déclarée au GIE CB le jour même', bv: 7, committed: true },
        { text: "Refus de paiement expliqués dans l'appli", bv: 3, committed: false },
      ],
    },
  }],
};

export default SAMPLES;
