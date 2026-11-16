/* Talking points (SPEC-V3 §2): for each tool, what it replaces, what it does, how it works. EN + FR. Bullets ≤ 12 words. */
const tp = (replaces, what, how) => ({ replaces, what, how });
export const TALKING_POINTS = {
  'api-tester': tp(
    { en: 'Postman / Hoppscotch + the Excel UAT evidence sheet', fr: 'Postman / Hoppscotch + le tableur de preuves de recette' },
    { en: 'Sends real calls to a mock card issuer and turns answers into repeatable tests.', fr: 'Envoie de vrais appels à un émetteur fictif et transforme les réponses en tests rejouables.' },
    [{ en: 'Load the card-blocking demo, Send, read the answer.', fr: 'Chargez la démo de blocage de carte, Envoyez, lisez la réponse.' },
     { en: 'Click any value to make it a pass/fail check.', fr: 'Cliquez une valeur pour en faire un contrôle réussi/échoué.' },
     { en: 'Run all, then export curl, Postman, pytest or evidence.', fr: 'Tout exécuter, puis exporter curl, Postman, pytest ou les preuves.' }]),
  'sql-runner': tp(
    { en: 'Metabase / DBeaver on a read-only card database copy', fr: 'Metabase / DBeaver sur une copie en lecture seule de la base cartes' },
    { en: 'Answers a business question with real SQL on sample card data, and charts it.', fr: 'Répond à une question métier par du vrai SQL sur des données cartes fictives, avec graphique.' },
    [{ en: 'Pick a question, the SQL appears, press Run.', fr: 'Choisissez une question, le SQL apparaît, lancez.' },
     { en: 'Read the table, switch to the chart.', fr: 'Lisez le tableau, passez au graphique.' },
     { en: 'Export the SQL for Oracle/PostgreSQL, or the result as CSV.', fr: 'Exportez le SQL Oracle/PostgreSQL, ou le résultat en CSV.' }]),
  'tokenization': tp(
    { en: 'Visa VTS / Mastercard MDES slides + whiteboard sequence diagram', fr: 'Slides Visa VTS / Mastercard MDES + schéma de séquence au tableau' },
    { en: 'Shows how a card becomes a wallet token, pays, and survives a card block.', fr: 'Montre comment une carte devient un jeton de wallet, paie, et survit à un blocage.' },
    [{ en: 'Pick a test card and wallet; press Next ▸ step by step.', fr: 'Choisissez une carte de test et un wallet ; avancez avec Suivant ▸.' },
     { en: 'Pay: see token and one-time cryptogram, never the PAN.', fr: 'Payez : jeton et cryptogramme à usage unique, jamais le PAN.' },
     { en: 'Block the card: token suspended; replacement restores it.', fr: 'Bloquez la carte : jeton suspendu ; le remplacement le rétablit.' }]),
  'payment-lifecycle': tp(
    { en: 'Visa dispute-flow slide + Stripe/Adyen disputes screen', fr: 'Slide du flux de litiges Visa + écran litiges Stripe/Adyen' },
    { en: 'Follows one payment through cancel, refund or chargeback, with deadlines and who pays.', fr: 'Suit un paiement jusqu’à l’annulation, le remboursement ou l’impayé, avec délais et qui paie.' },
    [{ en: 'Enter a payment, pick the event and reason.', fr: 'Saisissez un paiement, choisissez l’événement et le motif.' },
     { en: 'Step through representment, pre-arbitration, arbitration; move the clock.', fr: 'Parcourez représentation, pré-arbitrage, arbitrage ; avancez l’horloge.' },
     { en: 'Flip 3-D Secure or evidence: see who pays change.', fr: 'Basculez 3-D Secure ou les preuves : voyez qui paie changer.' }]),
  'kb-audit': tp(
    { en: 'Zendesk Guide / Guru verification reports + the KB audit sheet', fr: 'Rapports de vérification Zendesk Guide / Guru + tableur d’audit de la base' },
    { en: 'Finds stale, ownerless and missing articles behind the top customer questions.', fr: 'Repère les articles périmés, sans propriétaire ou manquants derrière les questions clients.' },
    [{ en: 'Paste articles, owners and top questions, Run audit.', fr: 'Collez articles, propriétaires et questions, lancez l’audit.' },
     { en: 'Read freshness, owner and coverage scores.', fr: 'Lisez les scores de fraîcheur, propriété et couverture.' },
     { en: 'Export the prioritised content backlog as CSV.', fr: 'Exportez le backlog de contenu priorisé en CSV.' }]),
  'prd-builder': tp(
    { en: 'Confluence PRD template + Productboard / Aha! goal tracking', fr: 'Modèle PRD Confluence + suivi d’objectifs Productboard / Aha!' },
    { en: 'Builds a PRD where every goal has a requirement and a metric.', fr: 'Construit un PRD où chaque objectif a une exigence et une métrique.' },
    [{ en: 'Type problem, users, goal metric, scope, Build draft.', fr: 'Saisissez problème, utilisateurs, métrique, périmètre, puis générez.' },
     { en: 'Fix the red checks until the trace meter hits 100 %.', fr: 'Corrigez les contrôles rouges jusqu’à 100 % de traçabilité.' },
     { en: 'Export Word, Markdown or a Jira CSV.', fr: 'Exportez en Word, Markdown ou CSV Jira.' }]),
  'story-builder': tp(
    { en: 'Jira story writing + Cucumber example mapping (Miro board)', fr: 'Rédaction de stories Jira + example mapping Cucumber (board Miro)' },
    { en: 'Turns business rules into user stories with Gherkin scenarios, checked against INVEST.', fr: 'Transforme les règles métier en user stories avec scénarios Gherkin, contrôlées INVEST.' },
    [{ en: 'Type feature, persona and rules, Build map.', fr: 'Saisissez fonctionnalité, persona et règles, puis générez.' },
     { en: 'Add examples per rule; INVEST shows what blocks "ready".', fr: 'Ajoutez des exemples par règle ; INVEST montre ce qui bloque « prêt ».' },
     { en: 'Export a Jira CSV or a .feature file.', fr: 'Exportez un CSV Jira ou un fichier .feature.' }]),
  'sfd-builder': tp(
    { en: 'Word functional-spec template (SFD) + Excel traceability matrix', fr: 'Modèle Word de SFD + matrice de traçabilité Excel' },
    { en: 'Numbers the business rules, lists fields, shows which story each rule serves.', fr: 'Numérote les règles métier, liste les champs, montre la story servie par chaque règle.' },
    [{ en: 'Type feature, rules and fields, Build tables.', fr: 'Saisissez fonctionnalité, règles et champs, puis générez.' },
     { en: 'Give each rule an example and a story.', fr: 'Donnez à chaque règle un exemple et une story.' },
     { en: 'Export Word or the rules CSV.', fr: 'Exportez en Word ou en CSV des règles.' }]),
  'uat-tracker': tp(
    { en: 'Excel UAT tracker + Xray / TestRail execution dashboard', fr: 'Suivi de recette Excel + tableau de bord d’exécution Xray / TestRail' },
    { en: 'Follows a UAT campaign day by day and says go or no-go, with reasons.', fr: 'Suit la recette jour par jour et dit go ou no-go, avec les raisons.' },
    [{ en: 'Load or paste the test runs and the defects.', fr: 'Chargez ou collez les exécutions de tests et les anomalies.' },
     { en: 'Set each case to passed, failed or blocked.', fr: 'Passez chaque cas à réussi, échoué ou bloqué.' },
     { en: 'Read the go / no-go and export the report.', fr: 'Lisez le go / no-go et exportez le rapport.' }]),
  'xray-builder': tp(
    { en: 'Jira + Xray Test Case Importer, and the Excel sheet behind it', fr: 'Jira + Xray Test Case Importer, et le tableur qui le précède' },
    { en: 'Writes test cases and checks them so the Xray import works first time.', fr: 'Rédige les cas de test et les contrôle pour que l’import Xray passe du premier coup.' },
    [{ en: 'Add or paste tests; link each to a story key.', fr: 'Ajoutez ou collez des tests ; liez chacun à une clé de story.' },
     { en: 'Validate for Xray Cloud or Server / DC.', fr: 'Validez pour Xray Cloud ou Server / DC.' },
     { en: 'Export the CSV, results JSON and import guide.', fr: 'Exportez le CSV, le JSON de résultats et le guide d’import.' }]),
  'bpmn-editor': tp(
    { en: 'Camunda Modeler / bpmn.io, Visio, Signavio for a first draft', fr: 'Camunda Modeler / bpmn.io, Visio, Signavio pour un premier jet' },
    { en: 'Turns a typed list of steps into an editable BPMN swimlane diagram.', fr: 'Transforme une liste d’étapes en diagramme BPMN à couloirs modifiable.' },
    [{ en: 'Name the actors, type one step per line.', fr: 'Nommez les acteurs, saisissez une étape par ligne.' },
     { en: 'Press Generate: lanes, tasks and decisions are laid out.', fr: 'Lancez Générer : couloirs, tâches et décisions sont placés.' },
     { en: 'Edit on the canvas, export .bpmn for Camunda.', fr: 'Modifiez sur le canevas, exportez le .bpmn pour Camunda.' }]),
  'journey-builder': tp(
    { en: 'Voiceflow / Botpress prototype, or a Visio flow nobody can test', fr: 'Prototype Voiceflow / Botpress, ou flux Visio impossible à tester' },
    { en: 'Design a chatbot conversation and talk to it before any developer builds it.', fr: 'Concevez une conversation de chatbot et dialoguez avec avant tout développement.' },
    [{ en: 'Write the bot steps and the customer’s possible answers.', fr: 'Écrivez les étapes du bot et les réponses possibles du client.' },
     { en: 'Type as a customer in the test chat.', fr: 'Écrivez comme un client dans le chat de test.' },
     { en: 'Watch the path light up; fix flagged dead ends.', fr: 'Suivez le chemin qui s’allume ; corrigez les impasses signalées.' }]),
  'mapping-grid': tp(
    { en: 'Excel mapping sheet + first pass of Talend / MapForce / dbt tests', fr: 'Tableur de mapping + premiers tests Talend / MapForce / dbt' },
    { en: 'Maps source fields to a target format and proves it on sample records.', fr: 'Associe les champs source à un format cible et le prouve sur des enregistrements.' },
    [{ en: 'List source and target fields; auto-map by name.', fr: 'Listez champs source et cible ; mappez automatiquement par nom.' },
     { en: 'Add a transformation per field (ROUND, CAST, lookup).', fr: 'Ajoutez une transformation par champ (ROUND, CAST, table de correspondance).' },
     { en: 'Edit a sample record; see loaded, held or rejected.', fr: 'Modifiez un enregistrement ; voyez chargé, retenu ou rejeté.' }]),
  'impact-heatmap': tp(
    { en: 'Excel change-impact matrix + the gap-analysis tab behind it', fr: 'Matrice d’impact Excel + onglet d’analyse des écarts' },
    { en: 'Shows where a change hits hardest across people, process, data, tech, compliance.', fr: 'Montre où un changement frappe le plus : personnes, processus, données, tech, conformité.' },
    [{ en: 'List the systems, teams and processes touched.', fr: 'Listez les systèmes, équipes et processus touchés.' },
     { en: 'Click cells to score impact from 0 to 3.', fr: 'Cliquez les cellules pour noter l’impact de 0 à 3.' },
     { en: 'Describe each hot spot’s gap, owner and size.', fr: 'Décrivez l’écart, le responsable et la taille de chaque point chaud.' }]),
  'rag-eval': tp(
    { en: 'Ragas / DeepEval notebooks + Excel answer-review sheet', fr: 'Notebooks Ragas / DeepEval + tableur de revue des réponses' },
    { en: 'Checks chatbot answers against approved ones and says if release can go live.', fr: 'Compare les réponses du chatbot aux réponses validées et dit si la mise en production est possible.' },
    [{ en: 'Load the approved Q&A set and the bot’s answers.', fr: 'Chargez le jeu de Q&R validé et les réponses du bot.' },
     { en: 'Press Score: each claim turns green, amber or red, with why.', fr: 'Lancez Noter : chaque affirmation passe au vert, orange ou rouge, avec la raison.' },
     { en: 'Read the gate; copy the LLM-judge prompt for production.', fr: 'Lisez la barrière ; copiez le prompt de juge LLM pour la production.' }]),
  'wsjf-planner': tp(
    { en: 'Jira Align / a WSJF spreadsheet in PI planning', fr: 'Jira Align / un tableur WSJF pour le PI planning' },
    { en: 'Ranks features by cost of delay ÷ size and shows what fits the PI.', fr: 'Classe les fonctionnalités par coût du retard ÷ taille et montre ce qui tient dans le PI.' },
    [{ en: 'Score each feature on the Fibonacci scale.', fr: 'Notez chaque fonctionnalité sur l’échelle de Fibonacci.' },
     { en: 'Ranking updates live; move capacity to see what drops.', fr: 'Le classement bouge en direct ; changez la capacité pour voir ce qui sort.' },
     { en: 'Export to Jira.', fr: 'Exportez vers Jira.' }]),
  'use-case-scorer': tp(
    { en: 'airfocus / Productboard scoring, or the prioritisation sheet', fr: 'Scoring airfocus / Productboard, ou tableur de priorisation' },
    { en: 'Scores AI use cases on value, feasibility, risk; builds a Now / Next / Later roadmap.', fr: 'Note les cas d’usage IA (valeur, faisabilité, risque) et bâtit une feuille de route Maintenant / Ensuite / Plus tard.' },
    [{ en: 'List the use cases, score each from 1 to 5.', fr: 'Listez les cas d’usage, notez chacun de 1 à 5.' },
     { en: 'Move the weights and watch the ranking change.', fr: 'Changez les pondérations et voyez le classement évoluer.' },
     { en: 'Gates hold back risky or unready cases.', fr: 'Des barrières retiennent les cas risqués ou pas prêts.' }]),
  'workshop-kit': tp(
    { en: 'SessionLab agenda + phone timer + Word minutes template', fr: 'Agenda SessionLab + minuteur du téléphone + modèle Word de compte rendu' },
    { en: 'Plans a workshop, times it live and turns the notes into the report.', fr: 'Planifie un atelier, le chronomètre en direct et transforme les notes en compte rendu.' },
    [{ en: 'Set goal, people and duration; fix the agenda checks.', fr: 'Fixez objectif, participants et durée ; corrigez les contrôles de l’agenda.' },
     { en: 'Run the timer and type notes.', fr: 'Lancez le minuteur et prenez des notes.' },
     { en: 'The report writes itself.', fr: 'Le compte rendu se rédige tout seul.' }]),
  'raci-grid': tp(
    { en: 'Miro stakeholder map + the RACI spreadsheet', fr: 'Carte des parties prenantes Miro + tableur RACI' },
    { en: 'Maps power and interest, and checks every decision has one owner.', fr: 'Cartographie pouvoir et intérêt, et vérifie que chaque décision a un seul responsable.' },
    [{ en: 'Drag people onto the grid.', fr: 'Glissez les personnes sur la grille.' },
     { en: 'Click cells to set R, A, C, I; fix the red rows.', fr: 'Cliquez les cellules pour R, A, C, I ; corrigez les lignes rouges.' },
     { en: 'Export the decision memo.', fr: 'Exportez la note de décision.' }]),
  'ai-risk-register': tp(
    { en: 'EU AI Act checker + risk register sheet (or OneTrust / Credo AI intake)', fr: 'Vérificateur AI Act + registre des risques (ou intake OneTrust / Credo AI)' },
    { en: 'Screens an AI system against the EU AI Act and keeps risks, controls, owners.', fr: 'Évalue un système IA face à l’AI Act et tient risques, contrôles et responsables.' },
    [{ en: 'Describe the system; answer yes / no / unsure.', fr: 'Décrivez le système ; répondez oui / non / incertain.' },
     { en: 'Get the tier and what to confirm with Legal.', fr: 'Obtenez le niveau et ce à confirmer avec le Juridique.' },
     { en: 'Score the risks on the heat grid.', fr: 'Notez les risques sur la grille de chaleur.' }]),
};
