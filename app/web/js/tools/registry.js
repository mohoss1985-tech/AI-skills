/* Tool registry: all 20 V2 tools, pre-filled in Wave 0 so no builder edits this file.
   Each tool lives in tools/<id>/ (index.js = the DESIGN_SPEC §8 interface, i18n.js, tool.css) and is
   loaded on demand with import(). `group` is the sidebar group (DESIGN_SPEC §4). `icon` (Lucide) and `title` let the shell list tools without loading them. */

export const TOOLS = [
  { id: 'api-tester', skill: 'testing-apis', group: 'test', owner: 'C', icon: 'send', title: { en: 'API tester', fr: "Testeur d'API" }, desc: { en: 'Send a real request, click values to make checks, export curl, Postman or pytest.', fr: 'Envoyer une vraie requête, cliquer sur une valeur pour créer un contrôle, exporter en curl, Postman ou pytest.' } },
  { id: 'sql-runner', skill: 'generating-sql', group: 'data', owner: 'D', icon: 'database', title: { en: 'SQL runner', fr: "Exécuteur SQL" }, desc: { en: 'Run real SQL on a sample card database and chart the answer.', fr: 'Exécuter du vrai SQL sur une base carte d’exemple et tracer le résultat.' } },
  { id: 'bpmn-editor', skill: 'modeling-processes', group: 'specify', owner: 'E', icon: 'workflow', title: { en: 'BPMN editor', fr: "Éditeur BPMN" }, desc: { en: 'Type the steps, get a swimlane BPMN you can edit and export.', fr: 'Saisir les étapes, obtenir un BPMN en couloirs modifiable et exportable.' } },
  { id: 'journey-builder', skill: 'designing-conversational-journeys', group: 'ai', owner: 'E', icon: 'messages-square', title: { en: 'Journey builder', fr: "Parcours conversationnel" }, desc: { en: 'Draw a chat or voice journey and test it in a simulated conversation.', fr: 'Dessiner un parcours chat ou voix et le tester dans une conversation simulée.' } },
  { id: 'wsjf-planner', skill: 'managing-backlog', group: 'plan', owner: 'F', icon: 'list-ordered', title: { en: 'WSJF & PI planner', fr: "Planificateur WSJF et PI" }, desc: { en: 'Score features, rank by WSJF and see what fits the PI capacity.', fr: 'Noter les features, les classer par WSJF et voir ce qui tient dans le PI.' } },
  { id: 'use-case-scorer', skill: 'prioritizing-ai-use-cases', group: 'ai', owner: 'F', icon: 'target', title: { en: 'Use-case scorer', fr: "Notation des cas d’usage" }, desc: { en: 'Weigh value, feasibility and risk, then sort AI use cases into Now, Next, Later.', fr: 'Pondérer valeur, faisabilité et risque, puis classer les cas d’usage IA en Maintenant, Ensuite, Plus tard.' } },
  { id: 'uat-tracker', skill: 'running-uat', group: 'test', owner: 'G', icon: 'clipboard-check', title: { en: 'UAT tracker', fr: "Suivi de recette" }, desc: { en: 'Track the UAT campaign day by day and get a go / no-go with reasons.', fr: 'Suivre la recette jour par jour et obtenir un go / no-go motivé.' } },
  { id: 'xray-builder', skill: 'managing-xray-tests', group: 'test', owner: 'G', icon: 'scan-line', title: { en: 'Xray builder', fr: "Générateur Xray" }, desc: { en: 'Write test cases and export a validated Xray CSV or JSON.', fr: 'Écrire les cas de test et exporter un CSV ou JSON Xray validé.' } },
  { id: 'rag-eval', skill: 'evaluating-rag-quality', group: 'ai', owner: 'G', icon: 'gauge', title: { en: 'RAG eval scorer', fr: "Évaluation RAG" }, desc: { en: "Score a bot's answers against a golden set and gate the release.", fr: 'Noter les réponses d’un bot sur un jeu de référence et bloquer ou valider la mise en production.' } },
  { id: 'prd-builder', skill: 'writing-prds', group: 'specify', owner: 'H', icon: 'file-text', title: { en: 'PRD builder', fr: "Générateur de PRD" }, desc: { en: 'Build a PRD where every goal traces to a requirement and a metric.', fr: 'Construire un PRD où chaque objectif est relié à une exigence et un indicateur.' } },
  { id: 'story-builder', skill: 'writing-user-stories', group: 'specify', owner: 'H', icon: 'book-open', title: { en: 'Story builder', fr: "Générateur de user stories" }, desc: { en: 'Turn rules into stories, Gherkin and a Jira CSV, with an INVEST check.', fr: 'Transformer des règles en user stories, Gherkin et CSV Jira, avec un contrôle INVEST.' } },
  { id: 'sfd-builder', skill: 'writing-functional-specs', group: 'specify', owner: 'H', icon: 'list-checks', title: { en: 'SFD builder', fr: "Générateur de SFD" }, desc: { en: 'Number the business rules, list the fields and trace every rule to a story.', fr: 'Numéroter les règles de gestion, lister les champs et relier chaque règle à une story.' } },
  { id: 'mapping-grid', skill: 'mapping-data', group: 'data', owner: 'I', icon: 'arrow-left-right', title: { en: 'Mapping grid', fr: "Grille de mapping" }, desc: { en: 'Map source to target fields and test the mapping on a sample record.', fr: 'Mapper les champs source vers cible et tester le mapping sur un enregistrement.' } },
  { id: 'impact-heatmap', skill: 'analysing-gaps-and-impacts', group: 'plan', owner: 'I', icon: 'grid-3x3', title: { en: 'Impact heatmap', fr: "Carte des impacts" }, desc: { en: 'Score the impact of a change on people, process, data and tech.', fr: 'Noter l’impact d’un changement sur les équipes, processus, données et SI.' } },
  { id: 'kb-audit', skill: 'curating-knowledge-bases', group: 'ai', owner: 'I', icon: 'library', title: { en: 'KB audit grid', fr: "Audit de base de connaissances" }, desc: { en: 'Find stale articles, missing owners and unanswered questions.', fr: 'Trouver les articles périmés, sans responsable, et les questions sans réponse.' } },
  { id: 'workshop-kit', skill: 'facilitating-workshops', group: 'facilitate', owner: 'J', icon: 'timer', title: { en: 'Workshop kit', fr: "Kit d’atelier" }, desc: { en: 'Plan the agenda, run the timer, capture notes, get the report.', fr: 'Préparer l’agenda, lancer le minuteur, prendre les notes, obtenir le compte-rendu.' } },
  { id: 'raci-grid', skill: 'aligning-stakeholders', group: 'facilitate', owner: 'J', icon: 'users', title: { en: 'RACI & power grid', fr: "RACI et matrice pouvoir" }, desc: { en: 'Place stakeholders on a power/interest grid and check the RACI.', fr: 'Placer les parties prenantes sur une matrice pouvoir/intérêt et vérifier le RACI.' } },
  { id: 'ai-risk-register', skill: 'governing-ai-risk', group: 'ai', owner: 'J', icon: 'shield-alert', title: { en: 'AI risk register', fr: "Registre des risques IA" }, desc: { en: 'Find the EU AI Act tier and keep a scored risk register.', fr: 'Trouver le niveau AI Act et tenir un registre des risques noté.' } },
  { id: 'tokenization', skill: 'tokenizing-cards', group: 'data', owner: 'K', icon: 'key-round', title: { en: 'Tokenization simulator', fr: "Simulateur de tokenisation" }, desc: { en: 'Provision a test card into a wallet step by step: ID&V, token, cryptogram, lifecycle.', fr: 'Provisionner une carte de test dans un wallet pas à pas : ID&V, token, cryptogramme, cycle de vie.' } },
  { id: 'payment-lifecycle', skill: 'handling-chargebacks', group: 'data', owner: 'K', icon: 'repeat', title: { en: 'Payment lifecycle & chargebacks', fr: "Cycle de paiement et impayés" }, desc: { en: 'Follow a payment from authorisation to refund or chargeback, with deadlines and who pays.', fr: 'Suivre un paiement de l’autorisation au remboursement ou à l’impayé, avec délais et qui paie.' } },
];

export const GROUPS = ['specify', 'test', 'data', 'plan', 'facilitate', 'ai'];
/** Sidebar group names (i18n keys, EN text; FR in i18n/fr.js). DESIGN_SPEC §4. */
export const GROUP_LABEL = { specify: 'Specify', test: 'Test', data: 'Data', plan: 'Plan', facilitate: 'Facilitate', ai: 'AI governance' };
/** The three Home demo cards (DESIGN_SPEC §4): open the tool with its first sample loaded (#/tool/<id>?sample=<lang>). */
export const DEMOS = [
  { tool: 'api-tester', icon: 'send', title: { en: 'Test a card-blocking API in 60 s', fr: 'Tester une API de blocage de carte en 60 s' }, text: { en: 'Send a real request to the Harbor Bank mock, check the status, export it as curl or pytest.', fr: 'Envoyez une vraie requête au mock Banque Lumière, vérifiez le statut, exportez en curl ou pytest.' } },
  { tool: 'story-builder', icon: 'book-open', title: { en: 'Workshop notes → user stories → Jira CSV', fr: 'Notes d’atelier → user stories → CSV Jira' }, text: { en: 'Turn raw notes into INVEST-checked stories with Gherkin, ready to import.', fr: 'Transformez des notes brutes en stories vérifiées INVEST avec Gherkin, prêtes à importer.' } },
  { tool: 'sql-runner', icon: 'database', title: { en: 'Top decline codes with SQL', fr: 'Principaux codes de refus en SQL' }, text: { en: 'Run a query on the sample card database and chart the result.', fr: 'Lancez une requête sur la base de cartes d’exemple et tracez le résultat.' } },
];

// Literal import() per tool, so static hosts and tools can see every module.
const LOADERS = {
  'api-tester': () => import('./api-tester/index.js'),
  'sql-runner': () => import('./sql-runner/index.js'),
  'bpmn-editor': () => import('./bpmn-editor/index.js'),
  'journey-builder': () => import('./journey-builder/index.js'),
  'wsjf-planner': () => import('./wsjf-planner/index.js'),
  'use-case-scorer': () => import('./use-case-scorer/index.js'),
  'uat-tracker': () => import('./uat-tracker/index.js'),
  'xray-builder': () => import('./xray-builder/index.js'),
  'rag-eval': () => import('./rag-eval/index.js'),
  'prd-builder': () => import('./prd-builder/index.js'),
  'story-builder': () => import('./story-builder/index.js'),
  'sfd-builder': () => import('./sfd-builder/index.js'),
  'mapping-grid': () => import('./mapping-grid/index.js'),
  'impact-heatmap': () => import('./impact-heatmap/index.js'),
  'kb-audit': () => import('./kb-audit/index.js'),
  'workshop-kit': () => import('./workshop-kit/index.js'),
  'raci-grid': () => import('./raci-grid/index.js'),
  'ai-risk-register': () => import('./ai-risk-register/index.js'),
  'tokenization': () => import('./tokenization/index.js'),
  'payment-lifecycle': () => import('./payment-lifecycle/index.js'),
};

export const TOOL_IDS = TOOLS.map((t) => t.id);
export const toolMeta = (id) => TOOLS.find((t) => t.id === id) || null;
export const toolForSkill = (skill) => TOOLS.find((t) => t.skill === skill) || null;

/** The tool module's default export (the §8 interface), or null for an unknown id. */
export async function loadTool(id) {
  const load = LOADERS[id];
  if (!load) return null;
  return (await load()).default;
}
