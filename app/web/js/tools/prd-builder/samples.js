/* PRD builder samples: lost / stolen card declaration (V1 seeds 3-prd.md and 103-prd.md), shared storyline:
   a stolen card approved in stand-in because its Exception File listing took 160 min. Figures are illustrative.
   Two gaps are left on purpose so the demo shows the meter turning green: G3 has no metric, FR-6 has no goal. */
import { emptyState } from './logic.js';

const en = {
  ...emptyState('en'),
  id: 'lost-stolen-en', label: 'Visa EN · Harbor Bank',
  title: 'Declare a lost or stolen card in the app', owner: 'PO Cards', status: 'review', deadline: 'June 2027', format: 'one-pager',
  problem: 'Cardholders must call to block a lost or stolen card: 62% of declarations are by phone, 6 min average wait, 20 min on Saturdays. Lost / stolen card fraud was €1.4M last year and 18% of it happened between the loss and the declaration. The Exception File is updated by a nightly batch: on 18 Oct a stolen card (crd_hb_009) was approved in stand-in 75 min after the block, because its listing took 160 min.',
  users: 'Cardholder, call-centre agent, fraud analyst',
  goalMetric: 'Declarations made in the app: 38% → 70%',
  scope: 'Block a card in the app with a reason\nList the PAN on the Exception File in under 5 min',
  tldr: 'Let cardholders block a lost or stolen card in the app in under a minute, list the PAN on the Visa Exception File at once, and flag unknown payments so fraud operations can declare the fraud and dispute it.',
  goals: [
    { id: 'G1', text: 'A cardholder blocks a card in the app in under 60 seconds' },
    { id: 'G2', text: 'A blocked PAN is declined everywhere at once, including in Visa stand-in' },
    { id: 'G3', text: 'Unknown payments reach fraud operations the same day' },
  ],
  nonGoals: ['Unblocking a card declared stolen (a new card is always issued)', 'Disputes for non-fraud reasons (goods not received): separate project'],
  metrics: [
    { id: 'M1', name: 'Declarations made in the app', type: 'primary', baseline: '38%', target: '70% three months after launch', how: 'App events / all declarations', goal: 'G1' },
    { id: 'M2', name: 'Fraud value between loss and declaration', type: 'primary', baseline: '18% of €1.4M', target: '−40%', how: 'Fraud ops monthly report', goal: 'G2' },
    { id: 'M3', name: 'Time from block to Exception File listing', type: 'guardrail', baseline: 'up to 24 h (160 min on 18 Oct)', target: '< 5 min, 99th percentile', how: 'Processor acknowledgement timestamp', goal: 'G2' },
    { id: 'M4', name: 'Cards blocked by mistake (lost, unblocked within 24 h)', type: 'guardrail', baseline: '', target: 'tracked, alert above 3%', how: 'Unblock events', goal: 'G1' },
  ],
  personas: [
    { name: 'Cardholder', job: 'When I cannot find my card, I want to block it at once, so I am not liable for payments I did not make.' },
    { name: 'Call-centre agent', job: 'When a cardholder calls, I want to block the card on their behalf in the same tool, so the call stays short.' },
    { name: 'Fraud analyst', job: 'When payments are flagged, I want them in one case, so I can declare the fraud to Visa within 2 working days.' },
  ],
  reqs: [
    { id: 'FR-1', text: 'The cardholder blocks a card in the app with a reason: lost, stolen or used without my permission', priority: 'Must', goal: 'G1', notes: '' },
    { id: 'FR-2', text: 'The next authorisation is declined with 41 (lost) or 43 (stolen) within 5 seconds of confirmation', priority: 'Must', goal: 'G2', notes: '' },
    { id: 'FR-3', text: 'The PAN is listed on the Visa Exception File with the matching action in under 5 minutes; retry every minute for 15 min, then alert card operations', priority: 'Must', goal: 'G2', notes: 'Fixes the 160 min listing of 18 Oct' },
    { id: 'FR-4', text: 'The cardholder sees the last 90 days of payments and flags the ones they do not recognise', priority: 'Must', goal: 'G3', notes: '' },
    { id: 'FR-5', text: 'Flagged payments create a case; fraud ops confirm and declare the fraud to Visa before any dispute', priority: 'Must', goal: 'G3', notes: 'Fraud types to confirm' },
    { id: 'FR-6', text: 'A replacement card with a new PAN is ordered in the same flow', priority: 'Should', goal: '', notes: '' },
    { id: 'FR-7', text: 'Wallet tokens (Apple Pay, Google Pay) linked to the card are suspended', priority: 'Should', goal: 'G2', notes: '' },
    { id: 'FR-8', text: 'A card blocked as lost can be unblocked by the cardholder within 24 h if no payment was attempted; stolen never', priority: 'Could', goal: 'G1', notes: '' },
  ],
  risks: [
    { type: 'risk', item: 'Cardholder blocks the wrong card', mitigation: 'Card image + last 4 digits, confirmation step (UX)' },
    { type: 'risk', item: 'Real-time Exception File update not available with our processor', mitigation: 'Check in week 1; fallback hourly batch (Card IT)' },
    { type: 'assumption', item: 'Fraud operations can absorb more cases', mitigation: 'Size from the pilot (Fraud ops)' },
    { type: 'dependency', item: 'Visa fraud reporting and dispute rules (deadlines, condition codes)', mitigation: 'To confirm against the current Visa Core Rules (Disputes)' },
  ],
  questions: [
    { q: 'Does the block also stop recurring payments, or only new authorisations?', owner: 'Card IT', due: '20 Nov' },
    { q: 'Who pays for the replacement card when the reason is lost?', owner: 'Product', due: '27 Nov' },
    { q: 'What do we tell the cardholder about liability before the declaration?', owner: '', due: '' },
  ],
  built: true,
};

const fr = {
  ...emptyState('fr'),
  id: 'lost-stolen-fr', label: 'CB FR · Banque Lumière',
  title: 'Mise en opposition d\'une carte dans l\'application', owner: 'PO Monétique', status: 'review', deadline: 'juin 2027', format: 'one-pager',
  problem: '62 % des oppositions passent par le téléphone, 6 minutes d\'attente en moyenne et jusqu\'à 20 minutes le samedi. Fraude sur cartes perdues ou volées : 1,4 M€ l\'an dernier, dont 18 % entre la perte et l\'opposition. Le 18 octobre, une carte volée a encore été autorisée 75 minutes après l\'opposition : la mise à jour de la liste d\'opposition a pris 160 minutes. Les contestations arrivent par courrier et le remboursement prend plusieurs jours, alors que l\'art. L133-18 CMF impose J+1 ouvré.',
  users: 'Porteur, conseiller, analyste fraude',
  goalMetric: 'Oppositions faites dans l\'appli : 38 % → 70 %',
  scope: 'Faire opposition dans l\'appli avec un motif\nRefus immédiat en autorisation',
  tldr: 'Permettre au porteur de faire opposition dans l\'application en moins d\'une minute, avec prise en compte immédiate en autorisation, puis de contester dans le même parcours les opérations qu\'il ne reconnaît pas. La banque rembourse dans le délai légal et déclare la fraude au GIE CB.',
  goals: [
    { id: 'O1', text: 'Opposition dans l\'application en moins de 60 secondes' },
    { id: 'O2', text: 'Une carte en opposition est refusée immédiatement en autorisation, y compris en paiement mobile' },
    { id: 'O3', text: 'Opérations contestées remboursées sous J+1 et fraude déclarée au GIE CB' },
  ],
  nonGoals: ['Lever une opposition pour vol ou utilisation frauduleuse (une nouvelle carte est toujours émise)', 'Litiges commerciaux (marchandise non reçue) : projet distinct'],
  metrics: [
    { id: 'I1', name: 'Part des oppositions faites dans l\'appli', type: 'primary', baseline: '38 %', target: '70 % à 3 mois', how: 'Événements appli / total des oppositions', goal: 'O1' },
    { id: 'I2', name: 'Fraude entre perte et opposition', type: 'primary', baseline: '18 % de 1,4 M€', target: '−40 %', how: 'Reporting fraude mensuel', goal: 'O2' },
    { id: 'I3', name: 'Délai entre opposition et refus en autorisation', type: 'guardrail', baseline: 'jusqu\'à 160 min (18 oct.)', target: '< 5 s', how: 'Journal du serveur d\'autorisation', goal: 'O2' },
    { id: 'I4', name: 'Oppositions faites par erreur (perte, levée sous 24 h)', type: 'guardrail', baseline: '', target: 'suivi, alerte au-delà de 3 %', how: 'Événements de levée', goal: 'O1' },
  ],
  personas: [
    { name: 'Porteur', job: 'Quand je ne trouve plus ma carte, je veux faire opposition tout de suite, afin de ne pas payer des opérations que je n\'ai pas faites.' },
    { name: 'Conseiller', job: 'Quand un porteur appelle, je veux faire opposition pour lui dans le même outil, afin que l\'appel reste court.' },
    { name: 'Analyste fraude', job: 'Quand des opérations sont contestées, je veux un seul dossier, afin de déclarer la fraude au GIE CB dans les délais.' },
  ],
  reqs: [
    { id: 'EX-1', text: 'Le porteur fait opposition dans l\'appli avec un motif : perte, vol, utilisation frauduleuse', priority: 'Must', goal: 'O1', notes: '' },
    { id: 'EX-2', text: 'L\'opposition est prise en compte par le serveur d\'autorisation en moins de 5 secondes : refus 41 (perte), 43 (vol)', priority: 'Must', goal: 'O2', notes: 'Corrige les 160 min du 18 octobre' },
    { id: 'EX-3', text: 'Le porteur voit les opérations des 13 derniers mois et conteste celles qu\'il ne reconnaît pas', priority: 'Must', goal: 'O3', notes: 'Art. L133-24 CMF' },
    { id: 'EX-4', text: 'Les opérations contestées sont remboursées au plus tard à J+1 ouvré, sauf soupçon de fraude du porteur documenté', priority: 'Must', goal: 'O3', notes: 'Art. L133-18 CMF' },
    { id: 'EX-5', text: 'La fraude confirmée est déclarée au GIE CB selon le format CB', priority: 'Must', goal: 'O3', notes: 'Format à confirmer' },
    { id: 'EX-6', text: 'Une nouvelle carte (nouveau PAN) est commandée dans le même parcours', priority: 'Should', goal: '', notes: '' },
    { id: 'EX-7', text: 'Les jetons de paiement mobile (Apple Pay, Google Pay) sont suspendus', priority: 'Should', goal: 'O2', notes: '' },
  ],
  risks: [
    { type: 'risk', item: 'Opposition sur la mauvaise carte', mitigation: 'Visuel, 4 derniers chiffres, confirmation (UX)' },
    { type: 'risk', item: 'Charge du remboursement J+1 pour le back-office', mitigation: 'Remboursement automatique sous un seuil, contrôle a posteriori (Opérations)' },
    { type: 'assumption', item: 'Le format et les délais de déclaration de fraude CB sont connus', mitigation: 'À confirmer (Fraude)' },
    { type: 'dependency', item: 'Règles CB (impayés, déclarations) et texte juridique au porteur', mitigation: 'Juridique, conformité' },
  ],
  questions: [
    { q: 'Les paiements récurrents (abonnements) sont-ils bloqués par l\'opposition ?', owner: 'IT monétique', due: '20 nov.' },
    { q: 'La nouvelle carte est-elle facturée en cas de perte ?', owner: 'Produit', due: '27 nov.' },
    { q: 'Quel texte sur la franchise de 50 € avant opposition (art. L133-19) ?', owner: '', due: '' },
  ],
  built: true,
};

export default { en: [en], fr: [fr] };
