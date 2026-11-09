/* SFD builder samples: PAN declaration (V1 seeds 17-sfd.md, 117-sfd.md). Stories S1–S3 are the Story builder sample's.
   Storyline: RG-03 is the rule the 18 Oct incident broke (Exception File listing took 160 min, target 5 min).
   Left on purpose for the demo: RG-06 and RG-07 (fraud ops side) are not traced to a story yet. */
import { emptyState } from './logic.js';

const r = (id, text, example, source, msg = '', stories = '') => ({ id, text, example, source, msg, stories });
const f = (screen, name, type, mandatory, validation, source, rule = '') => ({ screen, name, type, mandatory, validation, source, rule });

const en = {
  ...emptyState('en'),
  id: 'pan-declaration-en', label: 'Visa EN · Harbor Bank',
  feature: 'PAN declaration: block, Exception File and fraud report',
  rulesText: 'Reason is lost, stolen or used without my permission\nAfter the block, authorisations are declined with 41, 43 or 05 within 5 s\nThe PAN is listed on the Visa Exception File within 5 min',
  fieldsText: 'Card: choice, mandatory, cards of the cardholder\nReason: choice, mandatory, lost / stolen / used without my permission',
  level: 'SFD', version: '0.9', status: 'review', author: 'BA, Cards', reviewers: 'Ana (sponsor), Tom (Card IT), Priya (Fraud ops), Kim (Disputes), Legal',
  context: 'A cardholder declares a card lost, stolen or used without permission. The card must be refused everywhere at once (our host, and Visa Stand-In Processing through the Exception File), unknown payments must reach fraud operations, and confirmed fraud must be reported to Visa before any dispute. On 18 Oct a stolen card was approved in stand-in 75 min after the block because the nightly listing took 160 min.',
  scopeIn: 'Declaration in the app and the call-centre tool; block in the CMS and the authorisation host; Exception File listing; wallet token suspension; flagging of unknown payments; fraud confirmation and report to Visa; replacement card; unblock of a lost card.',
  scopeOut: 'The dispute itself (separate SFD), non-fraud disputes, card controls.',
  flow: 'The cardholder or agent picks the card and the reason (RG-01)\nThe block is applied in the CMS and on the authorisation host (RG-02), the PAN is listed on the Exception File (RG-03), wallet tokens are suspended (RG-04)\nThe cardholder flags unknown payments (RG-05); a fraud case is created\nThe fraud analyst confirms each payment within 2 working days and reports it to Visa (RG-06, RG-07)\nA replacement card is ordered (RG-08)',
  errorPath: 'Exception File update fails: retry every minute for 15 minutes, then alert card operations (RG-03).',
  nfr: 'Block effective in 5 s; Exception File listing in 5 min (99th percentile)\nEvery declaration, unblock and fraud confirmation is audited (who, when, channel)\nNo PAN shown in clear: last 4 digits only\nDeclaration screens meet WCAG 2.2 AA',
  rules: [
    r('RG-01', 'The reason must be one of: lost, stolen, used without my permission.', 'Card in pocket but unknown payment → "used without my permission"', 'Workshop 1', '', 'S1'),
    r('RG-02', 'After the block, authorisations must be declined with 41 (lost), 43 (stolen) or 05 (used without permission) within 5 seconds of confirmation.', 'Blocked 10:02:10, authorisation 10:02:20 → 43', 'Workshop 2, Card IT', 'MSG-01', 'S1'),
    r('RG-03', 'The PAN must be listed on the Visa Exception File with the action matching the reason within 5 minutes. If the update fails, retry every minute for 15 minutes, then alert card operations.', 'Processor API down at 10:02 → alert at 10:17; 18 Oct: 160 min = defect', 'Processor, Visa Core Rules (to confirm)', '', 'S1'),
    r('RG-04', 'Wallet tokens linked to the card must be suspended at the block.', 'Apple Pay token on the iPhone stops working', 'Workshop 2', 'MSG-01', 'S1'),
    r('RG-05', 'The cardholder can flag payments of the last 90 days as unknown. Pending authorisations can be flagged; they become fraud reports only once cleared.', '3 e-commerce payments of 2 Nov flagged', 'Fraud ops', 'MSG-03', 'S2'),
    r('RG-06', 'The fraud analyst must confirm or reject each flagged payment within 2 working days.', 'Flagged Mon 2 Nov → decision by Wed 4 Nov', 'Fraud ops', '', ''),
    r('RG-07', 'Each confirmed payment must be reported to Visa with a fraud type before a fraud dispute can be opened.', 'Confirmed 4 Nov → reported 4 Nov → dispute 10.4 possible', 'Visa fraud reporting rules (fraud types to confirm)', '', ''),
    r('RG-08', 'Lost or stolen: a replacement card with a new PAN must be ordered automatically. Used without permission: the cardholder chooses now or later.', 'Stolen → replacement ordered at the block', 'Product', '', 'S1'),
    r('RG-09', 'A card blocked as lost can be unblocked by the cardholder within 24 h, only if no payment was attempted since the block. Stolen and used without permission can never be unblocked.', 'Lost Sat 18:00, found Sun 10:00, no attempt → unblocked', 'Legal', 'MSG-02', 'S3'),
  ],
  screens: [
    { id: 'E-01', name: 'Declare a card (app)', purpose: 'Pick the card and the reason, confirm the block' },
    { id: 'E-02', name: 'Unknown payments (app)', purpose: 'Flag payments of the last 90 days' },
    { id: 'E-03', name: 'Fraud case (back office)', purpose: 'Confirm, reject and report each flagged payment' },
  ],
  fields: [
    f('E-01', 'Card', 'choice', true, 'Cards of the cardholder: image + last 4 digits; none preselected', 'CMS', ''),
    f('E-01', 'Reason', 'choice', true, 'Lost · Stolen · Used without my permission', 'Cardholder', 'RG-01'),
    f('E-01', 'Block this card', 'button', true, '', 'Cardholder', 'RG-02'),
    f('E-02', 'Payment', 'list', false, 'Date, merchant, amount; last 90 days, cleared and pending', 'Authorisation host', 'RG-05'),
    f('E-02', 'Not me', 'boolean', false, 'One per payment; at least one to send', 'Cardholder', 'RG-05'),
    f('E-03', 'Decision', 'choice', true, 'Confirmed fraud · Not fraud; due in 2 working days', 'Fraud analyst', 'RG-06'),
    f('E-03', 'Fraud type', 'choice', true, 'Visa fraud type (values to confirm)', 'Fraud analyst', 'RG-07'),
    f('E-03', 'Exception File listed at', 'datetime', false, 'Processor acknowledgement; alert if > 5 min after the block', 'Processor', 'RG-03'),
  ],
  messages: [
    { id: 'MSG-01', when: 'After the block', text: 'Your card ending {last4} is blocked. It can\'t be used anymore, including in Apple Pay or Google Pay.' },
    { id: 'MSG-02', when: 'Lost card, within 24 h', text: 'Found your card? You can unblock it until {date} {time}.' },
    { id: 'MSG-03', when: 'After flagging', text: 'We\'ve sent {n} payments to our fraud team. We\'ll get back to you within 2 working days.' },
  ],
  stories: [
    { id: 'S1', title: 'Block a lost or stolen card' },
    { id: 'S2', title: 'Flag payments I don\'t recognise' },
    { id: 'S3', title: 'Unblock a card I found' },
  ],
  openPoints: [
    { q: 'Fraud type codes and reporting deadline in the current Visa fraud reporting rules (to confirm)', owner: 'Fraud ops', due: '20 Nov' },
    { q: 'Recurring payments after a block: stop or continue?', owner: 'Card IT', due: '27 Nov' },
  ],
  built: true,
};

const fr = {
  ...emptyState('fr'),
  id: 'pan-declaration-fr', label: 'CB FR · Banque Lumière',
  feature: 'Mise en opposition et déclaration de fraude d\'un PAN',
  rulesText: 'Motif parmi : perte, vol, utilisation frauduleuse\nAprès l\'opposition, refus 41, 43 ou 59 dans les 5 secondes\nLes jetons de paiement mobile sont suspendus à l\'opposition',
  fieldsText: 'Carte : choix, obligatoire, cartes du porteur\nMotif : choix, obligatoire, perte / vol / utilisation frauduleuse',
  level: 'SFD', version: '0.9', status: 'review', author: 'BA monétique', reviewers: 'Anne (sponsor), Thomas (IT monétique), Priya (fraude), Karim (impayés), Juridique',
  context: 'Le porteur déclare sa carte perdue, volée ou utilisée frauduleusement. La carte doit être refusée immédiatement en autorisation, les opérations contestées remboursées dans le délai légal, et la fraude confirmée déclarée au GIE CB avant tout impayé. Le 18 octobre, une carte volée a été autorisée 75 minutes après l\'opposition : la prise en compte avait pris 160 minutes.',
  scopeIn: 'Opposition depuis l\'appli et l\'outil du centre d\'appels ; prise en compte dans le SGC et le serveur d\'autorisation ; suspension des jetons ; contestation des opérations ; remboursement ; déclaration de fraude au GIE CB ; nouvelle carte ; levée d\'opposition pour perte.',
  scopeOut: 'L\'émission de l\'impayé (SFD distincte), les litiges commerciaux.',
  flow: 'Le porteur ou le conseiller choisit la carte et le motif (RG-01)\nL\'opposition est enregistrée dans le SGC et le serveur d\'autorisation (RG-02), les jetons sont suspendus (RG-03)\nLe porteur conteste les opérations qu\'il ne reconnaît pas (RG-04)\nRemboursement automatique ou par l\'analyste dans le délai légal (RG-05, RG-06)\nL\'analyste confirme la fraude et la déclare au GIE CB (RG-07)\nUne nouvelle carte est commandée (RG-08)',
  errorPath: 'Échec de prise en compte par le serveur d\'autorisation : nouvel essai toutes les minutes pendant 15 minutes, puis alerte à l\'exploitation monétique (RG-02).',
  nfr: 'Opposition effective en 5 s\nPiste d\'audit de chaque opposition, levée et confirmation de fraude (qui, quand, canal)\nAucun PAN en clair : 4 derniers chiffres uniquement\nÉcrans conformes au RGAA',
  rules: [
    r('RG-01', 'Le motif doit être parmi : perte, vol, utilisation frauduleuse.', 'Carte en poche mais paiement inconnu → utilisation frauduleuse', 'Atelier 1', '', 'S1'),
    r('RG-02', 'Après l\'opposition, les demandes d\'autorisation doivent être refusées avec 41 (perte), 43 (vol) ou 59 (utilisation frauduleuse), dans les 5 secondes.', 'Opposition à 10:02:10, demande à 10:02:20 → 43 ; 18 oct. : 160 min = anomalie', 'Atelier 2, IT monétique', 'MSG-01', 'S1'),
    r('RG-03', 'Les jetons de paiement mobile de la carte doivent être suspendus à l\'opposition.', 'Apple Pay ne fonctionne plus', 'Atelier 2', 'MSG-01', 'S1'),
    r('RG-04', 'Le porteur peut contester les opérations débitées depuis 13 mois au plus.', 'Opération du 2 novembre de l\'an dernier contestable jusqu\'au 2 décembre', 'Art. L133-24 CMF', 'MSG-03', 'S2'),
    r('RG-05', 'Une opération contestée de 500 € au plus doit être remboursée au plus tard à la fin du premier jour ouvrable suivant la contestation.', 'Contestation lundi 15h → remboursée au plus tard mardi', 'Art. L133-18 CMF', 'MSG-03', 'S2'),
    r('RG-06', 'Au-delà de 500 €, l\'analyste doit décider dans le même délai ; il ne peut différer le remboursement qu\'en cas de soupçon de fraude du porteur, communiqué par écrit à la Banque de France.', 'Contestation de 820 € lundi → décision mardi', 'Art. L133-18 CMF', '', ''),
    r('RG-07', 'Chaque opération confirmée frauduleuse doit être déclarée au GIE CB avec sa typologie avant l\'émission d\'un impayé.', 'Confirmée le 4 → déclarée le 4 → impayé possible', 'Règles CB (typologie à confirmer)', '', ''),
    r('RG-08', 'Perte ou vol : une nouvelle carte (nouveau PAN) doit être commandée automatiquement. Utilisation frauduleuse : le porteur choisit.', 'Vol → nouvelle carte commandée à l\'opposition', 'Produit', '', 'S1'),
    r('RG-09', 'Une opposition pour perte peut être levée par le porteur sous 24 h si aucune demande d\'autorisation n\'a été faite depuis. Vol et utilisation frauduleuse : jamais.', 'Perte samedi 18h, carte retrouvée dimanche 10h, aucune tentative → levée', 'Juridique', 'MSG-02', 'S3'),
  ],
  screens: [
    { id: 'E-01', name: 'Faire opposition (appli)', purpose: 'Choisir la carte et le motif, confirmer' },
    { id: 'E-02', name: 'Opérations contestées (appli)', purpose: 'Contester les opérations des 13 derniers mois' },
    { id: 'E-03', name: 'Dossier fraude (back-office)', purpose: 'Décider, rembourser, déclarer au GIE CB' },
  ],
  fields: [
    f('E-01', 'Carte', 'choice', true, 'Cartes du porteur : visuel + 4 derniers chiffres ; aucune présélection', 'SGC', ''),
    f('E-01', 'Motif', 'choice', true, 'Perte · Vol · Utilisation frauduleuse', 'Porteur', 'RG-01'),
    f('E-01', 'Faire opposition sur cette carte', 'button', true, '', 'Porteur', 'RG-02'),
    f('E-02', 'Opération', 'list', false, 'Date, commerçant, montant ; 13 derniers mois', 'Serveur d\'autorisation', 'RG-04'),
    f('E-02', 'Je ne reconnais pas', 'boolean', false, 'Une par opération ; au moins une pour valider', 'Porteur', 'RG-04'),
    f('E-03', 'Montant contesté', 'amount', true, 'En euros ; ≤ 500 € remboursement automatique', 'Opération', 'RG-05'),
    f('E-03', 'Décision', 'choice', true, 'Fraude confirmée · Non frauduleuse ; avant J+1 ouvré', 'Analyste fraude', 'RG-06'),
    f('E-03', 'Typologie CB', 'choice', true, 'Perte/vol, carte non parvenue, contrefaçon, numéro usurpé, autre (à confirmer)', 'Analyste fraude', 'RG-07'),
  ],
  messages: [
    { id: 'MSG-01', when: 'Après l\'opposition', text: 'Votre carte se terminant par {last4} est en opposition. Elle ne peut plus être utilisée, y compris avec Apple Pay ou Google Pay.' },
    { id: 'MSG-02', when: 'Perte, sous 24 h', text: 'Vous avez retrouvé votre carte ? Vous pouvez lever l\'opposition jusqu\'au {date} à {time}.' },
    { id: 'MSG-03', when: 'Après la contestation', text: 'Nous avons bien reçu votre contestation de {n} opérations. Vous serez remboursé au plus tard le {date}.' },
  ],
  stories: [
    { id: 'S1', title: 'Faire opposition sur une carte perdue ou volée' },
    { id: 'S2', title: 'Contester des opérations et être remboursé' },
    { id: 'S3', title: 'Lever une opposition pour perte' },
  ],
  openPoints: [
    { q: 'Typologie et délai de déclaration de fraude CB (à confirmer, non publics)', owner: 'Fraude', due: '20 nov.' },
    { q: 'Paiements récurrents après opposition : bloqués ou non ?', owner: 'IT monétique', due: '27 nov.' },
  ],
  built: true,
};

// the command-bar lines of a sample are already on the board / in the tables: mark them imported
for (const x of [en, fr]) x.imported = [...String(x.rulesText || '').split('\n'), ...String(x.fieldsText || '').split('\n').map((l) => 'field:' + l)].map((l) => l.trim().toLowerCase()).filter((l) => l && l !== 'field:');
export default { en: [en], fr: [fr] };
