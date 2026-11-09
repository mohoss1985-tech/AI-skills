/* Story builder samples: block a lost / stolen card and flag unknown payments (V1 seeds 5-stories.md, 105-stories.md).
   Storyline: the stand-in example of R2 is the 18 Oct case (Exception File listing took 160 min, target 5 min).
   Test card ending 1087 = the Harbor Bank mock's spare card for block tests. S3 keeps one open question on purpose. */
import { emptyState } from './logic.js';

const ex = (id, kind, name, given, when, then) => ({ id, kind, name, given, when, then });

const en = {
  ...emptyState('en'),
  id: 'block-card-en', label: 'Visa EN · Harbor Bank',
  feature: 'Block a lost or stolen card and flag unknown payments',
  persona: 'cardholder in the Harbor Bank app',
  rulesText: 'Reason is lost, stolen or used without my permission\nThe next authorisation is declined with the code of the reason, also in stand-in\nWallet tokens are suspended at the block\nOnly payments of the last 90 days can be flagged\nA lost card can be unblocked within 24 h if no payment was attempted',
  epic: 'PAN declaration', labels: 'cards, fraud', project: 'HB',
  active: 'S1', built: true,
  stories: [
    {
      id: 'S1', title: 'Block a lost or stolen card', want: 'to block my card in the app with the reason', soThat: 'nobody can pay with it',
      points: 5, priority: 'High', dependsOn: '', source: 'PRD FR-1, FR-2, FR-3, FR-7 · SFD RG-01 to RG-04',
      checklist: 'Card shown with image and last 4 digits only\nScreen reader reads the reason choices (WCAG 2.2 AA)\nEvent card_blocked tracked with reason and channel',
      rules: [
        { id: 'R1', text: 'Reason is lost, stolen or used without my permission', examples: [
          ex('E1', 'happy', 'Cardholder blocks a stolen card', 'Sam has a Visa debit card ending 1087 that is active', 'Sam declares the card ending 1087 as "Stolen" and confirms', 'the app shows "Your card ending 1087 is blocked"\na replacement card with a new number is ordered'),
          ex('E2', 'edge', 'Card in pocket but unknown payment', 'Sam still has the card ending 1087\nSam sees a payment of €240.00 he did not make', 'Sam declares the card as "Used without my permission"', 'the card is blocked\nSam can choose to order the replacement now or later'),
        ] },
        { id: 'R2', text: 'The next authorisation is declined with the code of the reason, also in stand-in', examples: [
          ex('E3', 'happy', 'Payment 10 seconds after the block', 'Sam blocked the card ending 1087 as "Stolen" at 10:02:10', 'a contactless payment of €42.50 arrives at 10:02:20', 'the payment is declined with response code 43'),
          ex('E4', 'fail', 'Issuer host down: stand-in still declines', 'Sam blocked the card ending 1087 as "Stolen" at 18:00\nthe Harbor Bank host is unavailable from 18:10', 'Visa stand-in receives a payment of €45.00 at 18:15', 'the payment is declined because the PAN was listed on the Exception File by 18:05\nthe listing took less than 5 minutes'),
        ] },
        { id: 'R3', text: 'Wallet tokens are suspended at the block', examples: [
          ex('E5', 'happy', 'Apple Pay stops working', 'Sam has the card ending 1087 in Apple Pay on his iPhone', 'Sam blocks the card as "Lost"', 'the Apple Pay token of the card is suspended\na payment of €12.00 with Apple Pay is declined'),
        ] },
      ],
      questions: [{ id: 'Q1', text: 'Can a virtual card be blocked?', answer: 'Yes, same flow' }],
    },
    {
      id: 'S2', title: 'Flag payments I don\'t recognise', want: 'to flag the payments I don\'t recognise after blocking my card', soThat: 'the bank can investigate and get my money back',
      points: 3, priority: 'High', dependsOn: '', source: 'PRD FR-4, FR-5 · SFD RG-05',
      checklist: 'Each flagged payment shows date, merchant and amount\nConfirmation message within 2 s',
      rules: [
        { id: 'R4', text: 'Only payments of the last 90 days can be flagged', examples: [
          ex('E6', 'happy', 'Flag two unknown payments', 'Sam blocked the card ending 1087 as "Used without my permission"\nthe card has 12 payments in the last 90 days', 'Sam flags the payments of €89.90 and €240.00 of 2 November', 'the app shows "We\'ve sent 2 payments to our fraud team"\na fraud case with these 2 payments is created'),
          ex('E7', 'fail', 'Payments older than 90 days are not listed', 'the card has a payment on 1 July', 'Sam opens "Payments I don\'t recognise" on 2 November', 'the payment of 1 July is not listed'),
        ] },
      ],
      questions: [],
    },
    {
      id: 'S3', title: 'Unblock a card I found', want: 'to unblock a card I declared lost and then found', soThat: 'I keep using it without waiting for a new card',
      points: 3, priority: 'Medium', dependsOn: 'S1', source: 'PRD FR-8 · SFD RG-09',
      checklist: '',
      rules: [
        { id: 'R5', text: 'A lost card can be unblocked within 24 h if no payment was attempted', examples: [
          ex('E8', 'happy', 'Found the next morning', 'Sam blocked the card ending 1087 as "Lost" at 18:00 on Saturday\nno payment was attempted since', 'Sam unblocks it at 10:00 on Sunday', 'the app shows "Card unblocked"'),
          ex('E9', 'fail', 'After 24 hours', 'Sam blocked the card ending 1087 as "Lost" at 18:00 on Saturday', 'Sam tries to unblock it at 18:01 on Sunday', 'the app shows "Unblock no longer possible"'),
          ex('E10', 'edge', 'A payment was attempted since the block', 'Sam blocked the card ending 1087 as "Lost" at 18:00 on Saturday\na payment of €45.00 was declined at 21:00', 'Sam tries to unblock it at 10:00 on Sunday', 'the app shows "Unblock no longer possible"'),
          ex('E11', 'fail', 'A stolen card can never be unblocked', 'Sam blocked the card ending 1087 as "Stolen" at 18:00 on Saturday', 'Sam tries to unblock it at 10:00 on Sunday', 'the app shows "Unblock not possible for a stolen card"'),
        ] },
      ],
      questions: [{ id: 'Q2', text: 'Legal to review the wording of "Unblock no longer possible"', answer: '' }],
    },
  ],
};

const fr = {
  ...emptyState('fr'),
  id: 'block-card-fr', label: 'CB FR · Banque Lumière',
  feature: 'Faire opposition sur une carte et contester des opérations',
  persona: 'porteur dans l\'appli Banque Lumière',
  rulesText: 'Motif : perte, vol ou utilisation frauduleuse\nLa demande d\'autorisation suivante est refusée avec le code du motif\nLes jetons de paiement mobile sont suspendus\nLes opérations des 13 derniers mois peuvent être contestées\nUne opposition pour perte peut être levée sous 24 h sans tentative',
  epic: 'Opposition', labels: 'monetique, fraude', project: 'BL',
  active: 'S1', built: true,
  stories: [
    {
      id: 'S1', title: 'Faire opposition sur une carte perdue ou volée', want: 'faire opposition sur ma carte dans l\'appli en indiquant le motif', soThat: 'que personne ne puisse payer avec',
      points: 5, priority: 'High', dependsOn: '', source: 'PRD EX-1, EX-2, EX-7 · SFD RG-01 à RG-03',
      checklist: 'Carte affichée avec son visuel et ses 4 derniers chiffres uniquement\nChoix du motif lisible au lecteur d\'écran (RGAA)\nÉvénement opposition tracé avec motif et canal',
      rules: [
        { id: 'R1', text: 'Motif : perte, vol ou utilisation frauduleuse', examples: [
          ex('E1', 'happy', 'Le porteur fait opposition sur une carte volée', 'Sam a une carte CB se terminant par 2013 active', 'Sam fait opposition sur la carte 2013 avec le motif "Vol" et confirme', 'l\'appli affiche "Votre carte se terminant par 2013 est en opposition"\nune nouvelle carte avec un nouveau numéro est commandée'),
          ex('E2', 'edge', 'Carte en poche mais opération inconnue', 'Sam a toujours la carte 2013\nSam voit une opération de 240,00 € qu\'il n\'a pas faite', 'Sam fait opposition avec le motif "Utilisation frauduleuse"', 'la carte est en opposition\nSam choisit de commander la nouvelle carte maintenant ou plus tard'),
        ] },
        { id: 'R2', text: 'La demande d\'autorisation suivante est refusée avec le code du motif', examples: [
          ex('E3', 'happy', 'Paiement 10 secondes après l\'opposition', 'Sam a fait opposition sur la carte 2013 pour "Vol" à 10:02:10', 'une demande d\'autorisation sans contact de 42,50 € arrive à 10:02:20', 'la demande est refusée avec le code 43'),
          ex('E4', 'fail', 'Opposition non encore propagée', 'Sam a fait opposition sur la carte 2013 pour "Vol" à 18:00', 'une demande d\'autorisation de 45,00 € arrive à 18:15', 'la demande est refusée\nl\'opposition a été prise en compte en moins de 5 secondes, pas en 160 minutes comme le 18 octobre'),
        ] },
        { id: 'R3', text: 'Les jetons de paiement mobile sont suspendus', examples: [
          ex('E5', 'happy', 'Apple Pay ne fonctionne plus', 'Sam a la carte 2013 dans Apple Pay', 'Sam fait opposition pour "Perte"', 'le jeton Apple Pay de la carte est suspendu\nun paiement Apple Pay de 12,00 € est refusé'),
        ] },
      ],
      questions: [{ id: 'Q1', text: 'Peut-on faire opposition sur une carte virtuelle ?', answer: 'Oui, même parcours' }],
    },
    {
      id: 'S2', title: 'Contester des opérations et être remboursé', want: 'contester les opérations que je ne reconnais pas', soThat: 'être remboursé au plus tard le jour ouvré suivant',
      points: 5, priority: 'High', dependsOn: '', source: 'PRD EX-3, EX-4 · SFD RG-04, RG-05',
      checklist: 'Chaque opération affiche date, commerçant et montant\nMessage de confirmation en moins de 2 s',
      rules: [
        { id: 'R4', text: 'Les opérations des 13 derniers mois peuvent être contestées', examples: [
          ex('E6', 'happy', 'Contester deux opérations', 'Sam a fait opposition sur la carte 2013 pour "Utilisation frauduleuse"', 'Sam conteste les opérations de 89,90 € et 240,00 € du 2 novembre', 'l\'appli affiche "Nous avons transmis 2 opérations, vous serez remboursé au plus tard demain"'),
          ex('E7', 'fail', 'Opération de plus de 13 mois', 'la carte a une opération du 1er septembre de l\'an dernier', 'Sam ouvre "Contester des opérations" le 2 novembre', 'l\'opération du 1er septembre de l\'an dernier n\'est pas proposée'),
        ] },
      ],
      questions: [{ id: 'Q2', text: 'Remboursement automatique jusqu\'à 500 € : seuil validé par la conformité ?', answer: 'Oui (atelier 2)' }],
    },
    {
      id: 'S3', title: 'Lever une opposition pour perte', want: 'lever l\'opposition sur une carte perdue puis retrouvée', soThat: 'continuer à l\'utiliser sans attendre une nouvelle carte',
      points: 3, priority: 'Medium', dependsOn: 'S1', source: 'SFD RG-09',
      checklist: '',
      rules: [
        { id: 'R5', text: 'Une opposition pour perte peut être levée sous 24 h sans tentative', examples: [
          ex('E8', 'happy', 'Carte retrouvée le lendemain matin', 'Sam a fait opposition sur la carte 2013 pour "Perte" samedi à 18:00\naucune demande d\'autorisation depuis', 'Sam lève l\'opposition dimanche à 10:00', 'l\'appli affiche "Opposition levée"'),
          ex('E9', 'fail', 'Après 24 heures', 'Sam a fait opposition sur la carte 2013 pour "Perte" samedi à 18:00', 'Sam essaie de lever l\'opposition dimanche à 18:01', 'l\'appli affiche "Levée d\'opposition impossible"'),
          ex('E10', 'fail', 'Opposition pour vol', 'Sam a fait opposition sur la carte 2013 pour "Vol" samedi à 18:00', 'Sam essaie de lever l\'opposition dimanche à 10:00', 'l\'appli affiche "Une opposition pour vol ne peut pas être levée"'),
        ] },
      ],
      questions: [{ id: 'Q3', text: 'Le juridique doit relire le texte "Levée d\'opposition impossible"', answer: '' }],
    },
  ],
};

// the command-bar lines of a sample are already on the board / in the tables: mark them imported
for (const x of [en, fr]) x.imported = [...String(x.rulesText || '').split('\n'), ...String(x.fieldsText || '').split('\n').map((l) => 'field:' + l)].map((l) => l.trim().toLowerCase()).filter((l) => l && l !== 'field:');
export default { en: [en], fr: [fr] };
