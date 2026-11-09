/* Journey builder samples (owner E). EN = Harbor Bank (Visa), FR = Banque Lumière (CB). Fictional data, no card data:
   the card is only ever "ending 0004". Blocking lists the card on the Exception File and suspends wallet tokens
   (research/06 · POST /cards/{id}/block); the storyline is why that listing must be fast. */

const LOST_EN = `Say: Hi, I'm Harbor Bank's virtual assistant, an AI. I can block your card in under a minute.
Check: Is the customer signed in?
  Yes →
  No → Say: To protect your account, please sign in to the app first. I'll pick up right here.
Ask: What happened to your card? [Lost | Stolen | A payment I don't recognise | Talk to an advisor]
  Lost / lost it / can't find / missing → [lost] Do: Block card ending 0004 (reason: lost). Lists it on the Exception File and suspends wallet tokens.
  Stolen / stole / theft / pickpocket → [stolen] Do: Block card ending 0004 (reason: stolen). Lists it on the Exception File and suspends wallet tokens.
  A payment I don't recognise / payment / fraud / don't recognise / unknown → [fraud] Handoff: Fraud advisor, with the card and the last 90 days of payments attached.
  Talk to an advisor / advisor / human / agent / person → [advisor] Handoff: Card services advisor, with this conversation attached.
  * → Ask: Sorry, I didn't catch that. Is your card lost, stolen, or is it about a payment? [Lost | Stolen | Payment | Advisor]
      Lost → @lost
      Stolen → @stolen
      Payment / fraud → @fraud
      Advisor / human → @advisor
      * → @advisor
Say: Done. Your card ending 0004 is blocked: new payments are refused from now on.
Ask: Shall I order a replacement card to your home address? [Yes | No]
  Yes / please / sure / ok → Do: Order replacement card. It arrives in 3 to 5 working days.
  No / not now / later → Say: OK. You can order one later in the app, under Cards.
  * → Say: I'll leave it for now. You can order a replacement later in the app, under Cards.
Ask: Do you see any payment you don't recognise? [Yes | No]
  Yes / yes I do / fraud → @fraud
  No / no thanks / all good → End: Card blocked and replacement handled. Anything else, just ask.
  * → @advisor`;

const LOST_VOICE_EN = `Say: Welcome to Harbor Bank. You're speaking with our automated assistant. I can block your card now.
Ask: Is your card lost or stolen? You can also say advisor. [Lost | Stolen | Advisor]
  Lost / lost it / missing → [lost] Do: Block card ending 0004 (reason: lost), list it on the Exception File.
  Stolen / theft → [stolen] Do: Block card ending 0004 (reason: stolen), list it on the Exception File.
  Advisor / agent / human / operator → [advisor] Handoff: Card services advisor, call transferred with the reason.
  * → Ask: Sorry. Please say lost, stolen, or advisor. [Lost | Stolen | Advisor]
      Lost → @lost
      Stolen → @stolen
      Advisor → @advisor
      * → @advisor
Say: Your card ending 0004 is blocked.
Ask: Shall I send a replacement card? Say yes or no. [Yes | No]
  Yes / yeah / please → Do: Order replacement card, 3 to 5 working days.
  No / not now → Say: OK. You can order one in the app later.
  * → @advisor
End: Card blocked. Goodbye.`;

const LOST_FR = `Dire : Bonjour, je suis l'assistant virtuel de Banque Lumière, une IA. Je peux faire opposition sur votre carte en moins d'une minute.
Vérifier : Le client est-il connecté ?
  Oui →
  Non → Dire : Pour protéger votre compte, connectez-vous d'abord à l'appli. Je reprends ici ensuite.
Demander : Que s'est-il passé avec votre carte ? [Perdue | Volée | Une opération que je ne reconnais pas | Parler à un conseiller]
  Perdue / perdu / égarée / introuvable → [perte] Faire : Opposition sur la carte se terminant par 0004 (motif : perte). Suspend les tokens des wallets.
  Volée / vol / volé / on me l'a volée → [vol] Faire : Opposition sur la carte se terminant par 0004 (motif : vol). Suspend les tokens des wallets.
  Une opération que je ne reconnais pas / opération / fraude / paiement inconnu → [fraude] Transfert : Conseiller fraude, avec la carte et les opérations des 90 derniers jours.
  Parler à un conseiller / conseiller / humain / quelqu'un → [conseiller] Transfert : Conseiller cartes, avec cette conversation jointe.
  * → Demander : Désolé, je n'ai pas compris. Votre carte est-elle perdue, volée, ou s'agit-il d'une opération ? [Perdue | Volée | Opération | Conseiller]
      Perdue → @perte
      Volée → @vol
      Opération / fraude → @fraude
      Conseiller / humain → @conseiller
      * → @conseiller
Dire : C'est fait. Votre carte se terminant par 0004 est en opposition : les nouveaux paiements sont refusés dès maintenant.
Demander : Voulez-vous que je commande une nouvelle carte à votre domicile ? [Oui | Non]
  Oui / d'accord / volontiers → Faire : Commander une nouvelle carte. Elle arrive sous 3 à 5 jours ouvrés.
  Non / pas maintenant / plus tard → Dire : D'accord. Vous pourrez la commander plus tard dans l'appli, rubrique Cartes.
  * → Dire : Je laisse de côté pour l'instant. Vous pourrez commander une carte plus tard dans l'appli.
Demander : Voyez-vous une opération que vous ne reconnaissez pas ? [Oui | Non]
  Oui / fraude → @fraude
  Non / non merci / tout va bien → Fin : Carte en opposition, nouvelle carte traitée. Pour autre chose, demandez-moi.
  * → @conseiller`;

const UTT_EN = `I lost my card
cant find my card anywhere
my wallet got stolen on the metro
someone stole my visa
block my card NOW
I think I left my card at the restaurant
there's a payment I didn't make
card gone, help
lost card + need new one
i want to speak to a human`;

const UTT_FR = `j'ai perdu ma carte
je trouve plus ma carte bleue
on m'a volé mon portefeuille
faire opposition
bloquez ma carte vite
il y a un paiement que je n'ai pas fait
carte perdue besoin d'une nouvelle
je veux parler à un conseiller`;

export const SAMPLES = {
  en: [
    {
      id: 'lost-chat', autorun: true,
      label: { en: '"I lost my card" support chat', fr: 'Chat « I lost my card »' },
      hint: { en: 'Harbor Bank · block, replace, report fraud', fr: 'Harbor Bank · bloquer, remplacer, fraude' },
      state: {
        title: 'I lost my card · Harbor Bank chat', intent: 'I lost my card', channel: 'chat', steps: LOST_EN,
        solved: 'Card blocked and listed on the Exception File, replacement ordered or declined, unknown payments sent to a fraud advisor',
        handoff: 'Unknown payments or "advisor" → advisor with the card and conversation attached; two misses in a row → advisor',
        utterances: UTT_EN,
      },
    },
    {
      id: 'lost-voice', autorun: true,
      label: { en: '"I lost my card" voice line', fr: 'Serveur vocal « I lost my card »' },
      hint: { en: 'Same need on a phone line: 3 options at most', fr: 'Même besoin au téléphone : 3 options au plus' },
      state: {
        title: 'I lost my card · Harbor Bank voice', intent: 'I lost my card', channel: 'voice', steps: LOST_VOICE_EN,
        solved: 'Card blocked, replacement handled', handoff: 'Advisor on request or after two misses', utterances: UTT_EN,
      },
    },
  ],
  fr: [
    {
      id: 'perte-chat', autorun: true,
      label: { en: '"J\'ai perdu ma carte" support chat', fr: 'Chat « J\'ai perdu ma carte »' },
      hint: { en: 'Banque Lumière · opposition, new card, fraud', fr: 'Banque Lumière · opposition, nouvelle carte, fraude' },
      state: {
        title: "J'ai perdu ma carte · chat Banque Lumière", intent: "J'ai perdu ma carte", channel: 'chat', steps: LOST_FR,
        solved: 'Carte en opposition, nouvelle carte commandée ou refusée, opérations inconnues transmises à un conseiller fraude',
        handoff: 'Opération non reconnue ou « conseiller » → conseiller avec la carte et la conversation ; deux incompréhensions de suite → conseiller',
        utterances: UTT_FR,
      },
    },
  ],
};
