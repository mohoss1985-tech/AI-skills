/* Xray builder samples: lost / stolen card tests for two stories. Fictional data, test cards only.
   EN = Harbor Bank (Visa, project CARD, Xray Cloud), FR = Banque Lumière (CB, project CARTE, Xray Server / DC, Gherkin in French).
   Each sample carries one validation error on purpose (a label with a space) and one warning (priority "Critical"):
   fix the label and "Validate" passes. */

const m = (id, summary, priority, requirements, labels, precondition, steps, extra = {}) => ({ id, type: 'manual', summary, priority, requirements, labels, folder: '', precondition, steps: steps.map(([action, data, result]) => ({ action, data, result })), scenario: '', definition: '', ...extra });
const cu = (id, summary, requirements, labels, scenario, extra = {}) => ({ id, type: 'cucumber', summary, priority: 'High', requirements, labels, folder: '', precondition: '', steps: [], scenario, definition: '', ...extra });
const ge = (id, summary, requirements, labels, definition, extra = {}) => ({ id, type: 'generic', summary, priority: 'High', requirements, labels, folder: '', precondition: '', steps: [], scenario: '', definition, ...extra });

export const SAMPLES = {
  en: [{
    id: 'harbor-lost-stolen',
    title: 'Lost / stolen card: 2 stories → 6 tests (Xray Cloud)',
    client: 'Harbor Bank (sample)',
    state: {
      title: 'Lost / stolen card tests',
      project: 'CARD', target: 'cloud', folder: '/Cards/Lost or stolen',
      features: { 'CARD-110': 'Block a lost or stolen card in the app', 'CARD-112': 'List a blocked card on the Visa Exception File' },
      background: { 'CARD-112': 'Given the test card 4111 1111 1111 1111 is active\nAnd the issuer host is reachable' },
      execution: { summary: 'Lost / stolen release · UAT day 8 · staging', version: 'R26.11', testPlanKey: 'CARD-500', environments: 'staging' },
      tests: [
        m('CARD-T01', 'Lost card, one active card: block in the app in under a minute', 'High', 'CARD-110', 'cards happy-path',
          'Test customer TST-0042 with one active Visa debit card ending 1111, logged in to the app (staging).', [
            ['Open Cards and tap Block on the card ending 1111', 'Reason: lost', 'A confirmation names the card ending 1111'],
            ['Confirm the block', '', 'Card status is Blocked within 5 s'],
            ['Try a payment with the card on the test terminal', 'Amount 12.00 EUR', 'Declined with response code 41 (lost card) *to confirm*'],
          ], { status: 'passed' }),
        m('CARD-T02', 'Two active cards: the confirmation names the card chosen', 'Critical', 'CARD-110', 'cards, high risk',
          'Test customer TST-0057 with active cards ending 1111 and 1177.', [
            ['Tap Block on the card ending 1177', 'Reason: stolen', 'The confirmation names the card ending 1177'],
            ['Confirm the block', '', 'Only the card ending 1177 is Blocked; 1111 stays Active'],
          ], { status: 'failed', comment: 'Confirmation shows the card ending 4821', defects: 'CARD-302' }),
        m('CARD-T03', 'Stolen card declined in stand-in after the block', 'Highest', 'CARD-112', 'exception-file stand-in',
          'Card 4111 1111 1111 1111 blocked as stolen at T0; issuer host switched to stand-in on the scheme simulator.', [
            ['Wait 5 minutes after the block', '', 'The card is listed on the Exception File (listing confirmation received)'],
            ['Send an authorisation in stand-in', 'Amount 49.90 EUR, MCC 5411', 'Declined in stand-in'],
          ], { status: 'failed', comment: 'Stolen card approved in stand-in (Exception File listing took 160 min)', defects: 'CARD-301' }),
        cu('CARD-T04', 'Listing is retried after a host time-out', 'CARD-112', 'exception-file',
          'When the card is blocked as stolen\nAnd the first listing call times out\nThen the listing is retried until the scheme confirms it\nAnd the card is listed within 5 minutes of the block'),
        cu('CARD-T05', 'Block reasons map to the listing action code', 'CARD-112', 'exception-file',
          'When the card is blocked with reason "<reason>"\nThen the Exception File listing uses action code "<code>"\nExamples:\n| reason | code |\n| lost | 41 |\n| stolen | 43 |'),
        ge('CARD-T06', 'Block API returns 200 and status blocked (API tester run)', 'CARD-110', 'api regression', 'api.block-card.happy-path', { status: 'passed' }),
      ],
    },
  }],
  fr: [{
    id: 'lumiere-opposition',
    title: 'Mise en opposition : 2 stories → 6 tests (Xray Server / DC)',
    client: 'Banque Lumière (exemple)',
    state: {
      title: 'Tests de mise en opposition',
      project: 'CARTE', target: 'server', folder: '/Cartes/Opposition',
      features: { 'CARTE-110': "Mettre une carte en opposition dans l'appli", 'CARTE-112': "Inscrire la carte en liste d'opposition CB" },
      background: { 'CARTE-112': 'Soit la carte de test 4970 1000 0000 0001 active\nEt le serveur d\'autorisation joignable' },
      execution: { summary: 'Release opposition · recette J8 · recette', version: 'R26.11', testPlanKey: 'CARTE-500', environments: 'recette' },
      tests: [
        m('CARTE-T01', "Carte perdue, une seule carte : opposition dans l'appli en moins d'une minute", 'High', 'CARTE-110', 'cartes parcours-nominal',
          "Client de test TST-0042 avec une carte CB active finissant par 0001, connecté à l'appli (recette).", [
            ["Ouvrir Cartes et toucher Faire opposition sur la carte 0001", 'Motif : perte', 'La confirmation nomme la carte 0001'],
            ["Confirmer l'opposition", '', 'Statut En opposition en moins de 5 s'],
            ['Tenter un paiement sur le terminal de test', 'Montant 12,00 EUR', 'Refusé (carte en opposition) *code à confirmer*'],
          ], { status: 'passed' }),
        m('CARTE-T02', 'Deux cartes actives : la confirmation nomme la carte choisie', 'Critical', 'CARTE-110', 'cartes, risque eleve',
          'Client de test TST-0057 avec deux cartes actives finissant par 0001 et 1177.', [
            ['Toucher Faire opposition sur la carte 1177', 'Motif : vol', 'La confirmation nomme la carte 1177'],
            ["Confirmer l'opposition", '', 'Seule la carte 1177 est En opposition ; 0001 reste Active'],
          ], { status: 'failed', comment: 'La confirmation affiche la carte 4821', defects: 'CARTE-302' }),
        m('CARTE-T03', 'Carte volée refusée en autorisation de secours (stand-in)', 'Highest', 'CARTE-112', 'liste-opposition stand-in',
          "Carte 4970 1000 0000 0001 en opposition pour vol à T0 ; serveur d'autorisation en mode secours sur le simulateur.", [
            ["Attendre 5 minutes après l'opposition", '', "La carte est inscrite en liste d'opposition (confirmation reçue)"],
            ['Envoyer une autorisation en stand-in', 'Montant 49,90 EUR, MCC 5411', 'Refusée en stand-in'],
          ], { status: 'failed', comment: "Carte volée acceptée en stand-in (inscription en liste d'opposition en 160 min)", defects: 'CARTE-301' }),
        cu('CARTE-T04', "L'inscription est relancée après un time-out du serveur", 'CARTE-112', 'liste-opposition',
          "Quand la carte est mise en opposition pour vol\nEt le premier appel d'inscription tombe en time-out\nAlors l'inscription est relancée jusqu'à confirmation\nEt la carte est inscrite moins de 5 minutes après l'opposition"),
        cu('CARTE-T05', 'Le motif d\'opposition donne le bon code de la liste', 'CARTE-112', 'liste-opposition',
          "Quand la carte est mise en opposition avec le motif \"<motif>\"\nAlors l'inscription utilise le code \"<code>\"\nExemples:\n| motif | code |\n| perte | *à confirmer* |\n| vol | *à confirmer* |"),
        ge('CARTE-T06', "L'API d'opposition répond 200 et statut opposee (testeur d'API)", 'CARTE-110', 'api regression', 'api.opposition-carte.nominal', { status: 'passed' }),
      ],
    },
  }],
};
