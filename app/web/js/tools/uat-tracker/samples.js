/* UAT tracker samples: day 8 of 10 of the lost / stolen card release. Fictional data, test cards only.
   EN = Harbor Bank (Visa, Exception File), FR = Banque Lumière (CB, liste d'opposition).
   Shared storyline: a stolen card approved in stand-in because its Exception File listing took 160 min (UAT-09 / CARD-301).
   With the default exit criteria: 2 of 5 met → NO-GO (forecast), status red. */

const c = (id, title, feature, req, tester, status, defect, evidence, day, expected) => ({ id, title, feature, req, tester, status, defect, evidence, day, expected });
const d = (key, summary, severity, status, feature, created, workaround) => ({ key, summary, severity, status, feature, created, workaround });

const EN = {
  APP: 'Block card in the app', PHONE: 'Block card by phone', EF: 'Exception File listing', FRAUD: 'Fraud declaration', REPL: 'Replacement card',
};
const FR = {
  APP: "Opposition dans l'appli", PHONE: 'Opposition par téléphone', EF: "Liste d'opposition CB", FRAUD: 'Déclaration de fraude', REPL: 'Carte de remplacement',
};

export const SAMPLES = {
  en: [{
    id: 'harbor-day8',
    title: 'Day 8 of 10 · lost / stolen card release',
    client: 'Harbor Bank (sample)',
    state: {
      title: 'UAT day 8 · lost / stolen card release',
      scope: 'Lost / stolen card release: block in app and by phone, Exception File listing, fraud declaration, replacement card',
      planned: 26, day: 8, days: 10,
      testers: 'Priya, Marc, Lena, Tom',
      decisionMaker: 'Ana (business owner)',
      criteria: { allRun: true, passRate: true, passRateMin: 95, reqCovered: true, noBlocking: true, noMajor: true },
      cases: [
        c('UAT-01', 'Block a card in the app, one active card', EN.APP, 'CARD-110', 'Priya', 'pass', '', 'Status Blocked after 4 s (test card 4111 11** **** 1111)', 1, 'Card status is Blocked and the confirmation names the card'),
        c('UAT-02', 'Block in the app with two cards: choose the card ending 1177', EN.APP, 'CARD-110', 'Priya', 'fail', 'CARD-302', 'Confirmation shows the card ending 4821; the block is on 1177', 2, 'Confirmation shows the card ending 1177'),
        c('UAT-03', 'Block a virtual card', EN.APP, 'CARD-110', 'Priya', 'pass', '', 'Block button shown, status Blocked', 2, 'Virtual card can be blocked'),
        c('UAT-04', 'Unblock a temporarily blocked card', EN.APP, 'CARD-110', 'Priya', 'pass', '', 'Unblocked, payment approved after', 3, 'Temporary block can be lifted'),
        c('UAT-05', 'Phone block (IVR) visible in the app', EN.PHONE, 'CARD-111', 'Marc', 'fail', 'CARD-303', 'Visible in the app after 15 min', 3, 'Block visible in the app within 1 min'),
        c('UAT-06', 'Phone block by an agent with reason "stolen"', EN.PHONE, 'CARD-111', 'Marc', 'pass', '', 'Reason stored, letter queued', 3, 'Reason stolen stored on the card'),
        c('UAT-07', 'Phone block outside office hours', EN.PHONE, 'CARD-111', 'Marc', 'pass', '', '23:10 call, block applied', 4, '24/7 line blocks the card'),
        c('UAT-08', 'Lost card listed on the Exception File within 5 min', EN.EF, 'CARD-112', 'Lena', 'pass', '', 'Listed after 3 min 40 s', 4, 'Listing confirmed in ≤ 5 min'),
        c('UAT-09', 'Stolen card declined in stand-in after the block', EN.EF, 'CARD-112', 'Lena', 'fail', 'CARD-301', 'Stolen card approved in stand-in (Exception File listing took 160 min)', 5, 'Authorisation in stand-in is declined'),
        c('UAT-10', 'Listing retried after a host time-out', EN.EF, 'CARD-112', 'Lena', 'blocked', 'CARD-301', 'Blocked by CARD-301', 6, 'Listing retried until confirmed'),
        c('UAT-11', 'Exception File action code for a stolen card', EN.EF, 'CARD-112', 'Lena', 'blocked', 'CARD-301', 'Blocked by CARD-301', 6, 'Action code matches the block reason (*to confirm* with the Visa rules)'),
        c('UAT-12', 'Delisting after the card is replaced', EN.EF, 'CARD-112', 'Lena', 'notrun', '', '', '', 'Old PAN stays listed, new PAN not listed'),
        c('UAT-13', 'Fraud declaration from the app', EN.FRAUD, 'CARD-113', 'Tom', 'pass', '', 'Case FRD-2207 created', 4, 'Fraud case created with the payments chosen'),
        c('UAT-14', 'Fraud date before the transaction date is refused', EN.FRAUD, 'CARD-113', 'Tom', 'pass', 'CARD-304', 'Fix delivered, re-test passed in the app; batch still to re-test', 8, 'Error message, declaration not sent'),
        c('UAT-15', 'Fraud declaration sent once per transaction', EN.FRAUD, 'CARD-113', 'Tom', 'fail', 'CARD-310', 'Declaration sent twice for payment 88213', 7, 'One declaration per transaction'),
        c('UAT-16', 'Fraud report export', EN.FRAUD, 'CARD-113', 'Tom', 'pass', '', 'Export matches the 12 cases', 5, 'Export lists every declared payment'),
        c('UAT-17', 'Replacement card ordered after a stolen block', EN.REPL, 'CARD-114', 'Marc', 'pass', '', 'Order R-5531 created', 5, 'Replacement ordered automatically'),
        c('UAT-18', 'Replacement card email wording', EN.REPL, 'CARD-114', 'Marc', 'pass', 'CARD-305', 'Typo logged as CARD-305 (minor)', 6, 'Email names the new card and the delivery date'),
        c('UAT-19', 'New card pushed to wallet tokens', EN.REPL, 'CARD-114', 'Marc', 'pass', '', 'Token updated in the test wallet', 7, 'Wallet token moves to the new card'),
        c('UAT-20', 'Old card declined after replacement', EN.REPL, 'CARD-114', 'Lena', 'pass', '', 'Response code 54 on the old card', 7, 'Old card declined'),
        c('UAT-21', 'Block reason shown in the agent console', EN.APP, 'CARD-110', 'Priya', 'pass', '', 'Reason and channel shown', 6, 'Agent sees reason, channel and time'),
        c('UAT-22', 'Push notification after the block', EN.APP, 'CARD-110', 'Priya', 'pass', '', 'Notification within 10 s', 7, 'Customer is notified'),
        c('UAT-23', 'Block in the app in French', EN.APP, 'CARD-110', 'Priya', 'pass', '', 'Wording checked', 8, 'All screens translated'),
        c('UAT-24', 'Change the delivery address of the replacement card', EN.REPL, 'CARD-114', 'Marc', 'notrun', '', '', '', 'New address used for the delivery'),
      ],
      defects: [
        d('CARD-301', 'Stolen card approved in stand-in: Exception File listing took 160 min', 'blocking', 'open', EN.EF, 5, false),
        d('CARD-302', 'Block confirmation shows the wrong card when the customer has 2 cards', 'major', 'open', EN.APP, 2, true),
        d('CARD-303', 'Phone block not visible in the app for 15 minutes', 'major', 'open', EN.PHONE, 3, false),
        d('CARD-304', 'Fraud declaration accepted with a fraud date before the transaction date', 'major', 'retest', EN.FRAUD, 4, false),
        d('CARD-305', 'Typo in the replacement card email', 'minor', 'open', EN.REPL, 6, true),
        d('CARD-308', 'Customer wants to unblock a card declared stolen', 'enhancement', 'open', EN.APP, 6, false),
        d('CARD-310', 'Fraud declaration sent twice for the same transaction', 'major', 'open', EN.FRAUD, 7, false),
      ],
    },
  }],
  fr: [{
    id: 'lumiere-j8',
    title: "J8 sur 10 · release mise en opposition",
    client: 'Banque Lumière (exemple)',
    state: {
      title: 'Recette J8 · release mise en opposition',
      scope: "Release mise en opposition : appli et téléphone, inscription en liste d'opposition CB, déclaration de fraude, carte de remplacement",
      planned: 26, day: 8, days: 10,
      testers: 'Inès, Marc, Léa, Tom',
      decisionMaker: 'Anne (responsable métier)',
      criteria: { allRun: true, passRate: true, passRateMin: 95, reqCovered: true, noBlocking: true, noMajor: true },
      cases: [
        c('REC-01', "Opposition dans l'appli, une seule carte active", FR.APP, 'CARTE-110', 'Inès', 'pass', '', 'Statut En opposition après 4 s (carte de test 4970 10** **** 0001)', 1, "Statut En opposition, la confirmation nomme la carte"),
        c('REC-02', "Opposition dans l'appli avec deux cartes : choisir la carte finissant par 1177", FR.APP, 'CARTE-110', 'Inès', 'fail', 'CARTE-302', "La confirmation affiche la carte 4821 ; l'opposition est bien sur 1177", 2, 'La confirmation affiche la carte 1177'),
        c('REC-03', 'Opposition sur une carte virtuelle', FR.APP, 'CARTE-110', 'Inès', 'pass', '', 'Bouton présent, statut En opposition', 2, 'La carte virtuelle peut être mise en opposition'),
        c('REC-04', 'Lever un blocage temporaire', FR.APP, 'CARTE-110', 'Inès', 'pass', '', 'Débloquée, paiement accepté ensuite', 3, 'Le blocage temporaire se lève'),
        c('REC-05', "Opposition par téléphone (SVI) visible dans l'appli", FR.PHONE, 'CARTE-111', 'Marc', 'fail', 'CARTE-303', "Visible dans l'appli après 15 min", 3, "Opposition visible dans l'appli en 1 min"),
        c('REC-06', 'Opposition par un conseiller, motif « vol »', FR.PHONE, 'CARTE-111', 'Marc', 'pass', '', 'Motif enregistré, courrier en file', 3, 'Motif vol enregistré'),
        c('REC-07', 'Opposition téléphonique hors horaires', FR.PHONE, 'CARTE-111', 'Marc', 'pass', '', 'Appel à 23 h 10, opposition faite', 4, 'Le serveur 24/7 met la carte en opposition'),
        c('REC-08', "Carte perdue inscrite en liste d'opposition en 5 min", FR.EF, 'CARTE-112', 'Léa', 'pass', '', 'Inscrite en 3 min 40 s', 4, 'Inscription confirmée en ≤ 5 min'),
        c('REC-09', 'Carte volée refusée en autorisation de secours (stand-in)', FR.EF, 'CARTE-112', 'Léa', 'fail', 'CARTE-301', "Carte volée acceptée en stand-in (inscription en liste d'opposition en 160 min)", 5, "L'autorisation en stand-in est refusée"),
        c('REC-10', "Nouvel essai d'inscription après un time-out du serveur", FR.EF, 'CARTE-112', 'Léa', 'blocked', 'CARTE-301', 'Bloqué par CARTE-301', 6, "Inscription relancée jusqu'à confirmation"),
        c('REC-11', 'Code motif de la liste pour une carte volée', FR.EF, 'CARTE-112', 'Léa', 'blocked', 'CARTE-301', 'Bloqué par CARTE-301', 6, 'Code motif conforme au motif (*à confirmer* avec les règles CB)'),
        c('REC-12', 'Sortie de liste après remplacement de la carte', FR.EF, 'CARTE-112', 'Léa', 'notrun', '', '', '', "L'ancien PAN reste inscrit, le nouveau non"),
        c('REC-13', "Déclaration de fraude depuis l'appli", FR.FRAUD, 'CARTE-113', 'Tom', 'pass', '', 'Dossier FRD-2207 créé', 4, 'Dossier créé avec les opérations choisies'),
        c('REC-14', "Date de fraude antérieure à l'opération refusée", FR.FRAUD, 'CARTE-113', 'Tom', 'pass', 'CARTE-304', "Correctif livré, retest OK dans l'appli ; batch à retester", 8, 'Message d’erreur, déclaration non envoyée'),
        c('REC-15', 'Déclaration de fraude envoyée une seule fois par opération', FR.FRAUD, 'CARTE-113', 'Tom', 'fail', 'CARTE-310', "Déclaration envoyée deux fois pour l'opération 88213", 7, 'Une déclaration par opération'),
        c('REC-16', 'Export du rapport de fraude', FR.FRAUD, 'CARTE-113', 'Tom', 'pass', '', "L'export contient les 12 dossiers", 5, 'Toutes les opérations déclarées sont listées'),
        c('REC-17', 'Carte de remplacement commandée après opposition pour vol', FR.REPL, 'CARTE-114', 'Marc', 'pass', '', 'Commande R-5531 créée', 5, 'Remplacement commandé automatiquement'),
        c('REC-18', "Texte de l'e-mail de carte de remplacement", FR.REPL, 'CARTE-114', 'Marc', 'pass', 'CARTE-305', 'Faute de frappe saisie en CARTE-305 (mineur)', 6, "L'e-mail nomme la nouvelle carte et la date de livraison"),
        c('REC-19', 'Nouvelle carte poussée aux tokens des wallets', FR.REPL, 'CARTE-114', 'Marc', 'pass', '', 'Token mis à jour dans le wallet de test', 7, 'Le token suit la nouvelle carte'),
        c('REC-20', 'Ancienne carte refusée après remplacement', FR.REPL, 'CARTE-114', 'Léa', 'pass', '', 'Refus sur l’ancienne carte', 7, 'Ancienne carte refusée'),
        c('REC-21', 'Motif affiché dans le poste conseiller', FR.APP, 'CARTE-110', 'Inès', 'pass', '', 'Motif et canal affichés', 6, 'Le conseiller voit motif, canal et heure'),
        c('REC-22', "Notification push après l'opposition", FR.APP, 'CARTE-110', 'Inès', 'pass', '', 'Notification en 10 s', 7, 'Le client est notifié'),
        c('REC-23', "Opposition dans l'appli en anglais", FR.APP, 'CARTE-110', 'Inès', 'pass', '', 'Textes vérifiés', 8, 'Tous les écrans traduits'),
        c('REC-24', "Changer l'adresse de livraison de la carte de remplacement", FR.REPL, 'CARTE-114', 'Marc', 'notrun', '', '', '', 'La nouvelle adresse est utilisée'),
      ],
      defects: [
        d('CARTE-301', "Carte volée acceptée en stand-in : inscription en liste d'opposition en 160 min", 'blocking', 'open', FR.EF, 5, false),
        d('CARTE-302', "L'écran de confirmation affiche la mauvaise carte quand le client en a 2", 'major', 'open', FR.APP, 2, true),
        d('CARTE-303', "Opposition téléphonique invisible dans l'appli pendant 15 minutes", 'major', 'open', FR.PHONE, 3, false),
        d('CARTE-304', "Déclaration de fraude acceptée avec une date antérieure à l'opération", 'major', 'retest', FR.FRAUD, 4, false),
        d('CARTE-305', "Faute de frappe dans l'e-mail de carte de remplacement", 'minor', 'open', FR.REPL, 6, true),
        d('CARTE-308', 'Le client veut lever une opposition pour vol', 'enhancement', 'open', FR.APP, 6, false),
        d('CARTE-310', 'Déclaration de fraude envoyée deux fois pour la même opération', 'major', 'open', FR.FRAUD, 7, false),
      ],
    },
  }],
};
