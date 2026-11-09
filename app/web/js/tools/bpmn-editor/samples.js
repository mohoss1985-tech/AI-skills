/* BPMN editor samples (owner E). EN = Visa / Harbor Bank, FR = CB / Banque Lumière. Fictional data.
   Storyline: a stolen card approved in stand-in because its Exception File listing took 160 min (research/06).
   Scheme facts not in public sources stay "to confirm". Sources: V1 seeds 1-process.md / 101-process.md, research/09 §3–4. */

const AUTH_EN = `Merchant terminal: Send authorisation request
Acquirer: Check merchant, route to VisaNet
VisaNet: Issuer available?
  Yes → Issuer (Harbor Bank): Check card status, funds, limits, fraud
  No → VisaNet: Stand-In Processing with Exception File and issuer limits
  No → VisaNet: Send STIP advice to issuer
VisaNet: Approved?
  Yes → Merchant terminal: Complete the sale
  Yes → Merchant terminal: (end) Sale completed
  No → Merchant terminal: (end) Declined with response code`;

const AUTH_FR = `Commerçant (TPE) : Envoyer la demande d'autorisation
Acquéreur : Contrôler le contrat, router sur le réseau CB
Réseau CB : Émetteur joignable ?
  Oui → Émetteur (Banque Lumière) : Contrôler opposition, plafonds, solde, fraude
  Non → Réseau CB : Traitement de secours selon les paramètres émetteur
  Non → Réseau CB : Informer l'émetteur de la décision
Réseau CB : Accord ?
  Oui → Commerçant (TPE) : Finaliser la vente
  Oui → Commerçant (TPE) : (fin) Vente réalisée
  Non → Commerçant (TPE) : (fin) Refus avec code réponse`;

const CB_EN = `Issuer (Harbor Bank): Dispute within 120 days of processing?
  No → Issuer (Harbor Bank): (end) Dispute refused, out of time
  Yes →
Issuer (Harbor Bank): Credit cardholder provisionally
Issuer (Harbor Bank): Raise dispute 13.1 in Visa Resolve Online
Visa: Route dispute (Collaboration workflow)
Acquirer: Debit merchant €89.00 plus fee
Merchant (Atlas Home, demo): Accept or represent?
  Accept → Merchant (Atlas Home, demo): (end) Merchant carries the €89.00
  Represent →
Merchant (Atlas Home, demo): Send proof of delivery within 30 days
Issuer (Harbor Bank): Evidence accepted?
  Yes → Acquirer: Credit merchant €89.00
  Yes → Merchant (Atlas Home, demo): (end) Representment won
  No →
Issuer (Harbor Bank): File pre-arbitration
Merchant (Atlas Home, demo): Accept pre-arbitration within 30 days?
  Yes → Merchant (Atlas Home, demo): (end) Merchant carries the €89.00
  No →
Visa: Arbitrate on the existing evidence
Visa: (end) Loser pays amount plus filing fee (to confirm)`;

const CB_FR = `Émetteur (Banque Lumière) : Contestation dans les délais ?
  Non → Émetteur (Banque Lumière) : (fin) Contestation refusée, hors délai
  Oui →
Émetteur (Banque Lumière) : Rembourser le porteur (L133-18 si opération non autorisée)
Émetteur (Banque Lumière) : Émettre l'impayé, motif marchandise non reçue (code à confirmer)
Réseau CB : Transmettre l'impayé à l'acquéreur
Acquéreur : Débiter le commerçant de 89,00 €
Commerçant (démo) : Accepter ou représenter ?
  Accepter → Commerçant (démo) : (fin) Le commerçant supporte les 89,00 €
  Représenter →
Commerçant (démo) : Représenter avec la preuve de livraison signée (délai à confirmer)
Émetteur (Banque Lumière) : Preuve acceptée ?
  Oui → Acquéreur : Recréditer le commerçant de 89,00 €
  Oui → Commerçant (démo) : (fin) Représentation gagnée
  Non → Émetteur (Banque Lumière) : Pré-arbitrage (terme et délai à confirmer)
  Non → Réseau CB : (fin) Décision selon le règlement CB (à confirmer)`;

const BLOCK_EN = `Cardholder: Report card stolen in the app
Issuer (Harbor Bank): Block card, response code 43
Issuer (Harbor Bank): Suspend wallet tokens
[list] Issuer (Harbor Bank): Send PAN to the Visa Exception File
VisaNet: Listing confirmed within 5 min?
  Yes →
  No → Issuer (Harbor Bank): (wait) Retry after 5 min
  No → Issuer (Harbor Bank): Alert card operations
  No → @list
Issuer (Harbor Bank): Order replacement card
Cardholder: (end) Card blocked, replacement ordered`;

const BLOCK_FR = `Porteur : Déclarer le vol de la carte dans l'appli
Émetteur (Banque Lumière) : Mettre la carte en opposition, code 43
Émetteur (Banque Lumière) : Suspendre les tokens des wallets
[liste] Émetteur (Banque Lumière) : Transmettre l'opposition au traitement de secours
Réseau CB : Opposition prise en compte en 5 min ?
  Oui →
  Non → Émetteur (Banque Lumière) : (attente) Relancer après 5 min
  Non → Émetteur (Banque Lumière) : Alerter l'exploitation monétique
  Non → @liste
Émetteur (Banque Lumière) : Commander une nouvelle carte
Porteur : (fin) Carte en opposition, nouvelle carte commandée`;

export const SAMPLES = {
  en: [
    {
      id: 'visa-auth', autorun: true,
      label: { en: 'Visa authorisation with Stand-In Processing', fr: 'Autorisation Visa avec Stand-In Processing' },
      hint: { en: 'Harbor Bank · 4 lanes · 2 decisions', fr: 'Harbor Bank · 4 couloirs · 2 décisions' },
      state: {
        title: 'Visa card authorisation, with stand-in', pool: 'Harbor Bank',
        actors: 'Merchant terminal, Acquirer, VisaNet, Issuer (Harbor Bank)', steps: AUTH_EN,
        trigger: 'Card presented at checkout', happyEnd: '',
        notes: 'If we do not answer in time, VisaNet decides in Stand-In Processing (STIP) with our limits and the PANs we listed on the Exception File, then sends us an advice. On 18 Oct a stolen card was approved in stand-in because its Exception File listing took 160 min (target 5 min).',
      },
    },
    {
      id: 'visa-chargeback', autorun: true,
      label: { en: 'Visa chargeback 13.1, goods not received', fr: 'Chargeback Visa 13.1, marchandise non reçue' },
      hint: { en: 'Dispute → representment → pre-arbitration → arbitration', fr: 'Litige → représentation → pré-arbitrage → arbitrage' },
      state: {
        title: 'Visa chargeback lifecycle, 13.1 not received', pool: 'Harbor Bank',
        actors: 'Cardholder, Issuer (Harbor Bank), Visa, Acquirer, Merchant (Atlas Home, demo)', steps: CB_EN,
        trigger: 'Cardholder says €89.00 order never came', happyEnd: '',
        notes: 'Atlas Home (demo), €89.00, cleared 12 Oct, delivery expected 20 Oct. Harbor Bank raises 13.1 on 8 Nov (Collaboration; respond by 8 Dec). Merchant represents with signed proof of delivery dated 18 Oct. Pre-arbitration: 30 days to accept or decline. Arbitration: no new evidence, loser pays a filing fee (USD 600 cited by Adyen, to confirm).',
      },
    },
    {
      id: 'visa-block', autorun: true,
      label: { en: 'Block a stolen card, Exception File retry', fr: 'Bloquer une carte volée, relance Exception File' },
      hint: { en: 'The 160-minute listing delay, with a retry loop', fr: 'Le délai de 160 min, avec une boucle de relance' },
      state: {
        title: 'Block a stolen card and list it on the Exception File', pool: 'Harbor Bank',
        actors: 'Cardholder, Issuer (Harbor Bank), VisaNet', steps: BLOCK_EN,
        trigger: 'Card stolen', happyEnd: '',
        notes: 'UAT-05 failed: listing took 160 min, and crd_hb_009 was approved in stand-in 75 min after the block. SFD target: listed within 5 min.',
      },
    },
  ],
  fr: [
    {
      id: 'cb-auth', autorun: true,
      label: { en: 'CB authorisation with fallback processing', fr: 'Autorisation CB avec traitement de secours' },
      hint: { en: 'Banque Lumière · 4 lanes · 2 decisions', fr: 'Banque Lumière · 4 couloirs · 2 décisions' },
      state: {
        title: "Autorisation d'un paiement CB, avec secours", pool: 'Banque Lumière',
        actors: 'Commerçant (TPE), Acquéreur, Réseau CB, Émetteur (Banque Lumière)', steps: AUTH_FR,
        trigger: 'Carte présentée en caisse', happyEnd: '',
        notes: "Si nous ne répondons pas à temps, un traitement de secours décide selon nos paramètres et nous informe ensuite (fonctionnement exact du secours sur le réseau CB à confirmer). Le 18 oct., une carte volée a été acceptée en secours car l'opposition a mis 160 min à être prise en compte.",
      },
    },
    {
      id: 'cb-impaye', autorun: true,
      label: { en: 'CB chargeback (impayé), goods not received', fr: 'Impayé CB, marchandise non reçue' },
      hint: { en: 'Codes and deadlines to confirm (CB rulebook)', fr: 'Codes et délais à confirmer (règlement CB)' },
      state: {
        title: "Cycle de vie d'un impayé CB", pool: 'Banque Lumière',
        actors: 'Porteur, Émetteur (Banque Lumière), Réseau CB, Acquéreur, Commerçant (démo)', steps: CB_FR,
        trigger: 'Le porteur conteste 89,00 €', happyEnd: '',
        notes: "89 € chez un marchand en ligne (démo). Le porteur conteste, Banque Lumière émet un impayé (motif marchandise non reçue, code CB à confirmer). Le commerçant représente avec la preuve de livraison signée. Délais de représentation : à confirmer (règlement CB non public). Fenêtre client de 13 mois (L133-24) distincte de la fenêtre interbancaire.",
      },
    },
    {
      id: 'cb-opposition', autorun: true,
      label: { en: 'Stolen card opposition, with retry', fr: "Opposition d'une carte volée, avec relance" },
      hint: { en: 'The 160-minute delay, with a retry loop', fr: 'Le délai de 160 min, avec une boucle de relance' },
      state: {
        title: "Opposition d'une carte volée", pool: 'Banque Lumière',
        actors: 'Porteur, Émetteur (Banque Lumière), Réseau CB', steps: BLOCK_FR,
        trigger: 'Carte volée', happyEnd: '',
        notes: "Recette : l'opposition a mis 160 min à être prise en compte par le secours (cible 5 min).",
      },
    },
  ],
};
