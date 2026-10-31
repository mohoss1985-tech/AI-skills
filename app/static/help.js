/* Guide: an instant help chatbot that knows the app, every skill and the jargon.
   Runs in the browser, no API key. Anything it can't answer goes to Claude in the chat. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const K = () => window.Kit;
  const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9%?+ ]+/g, ' ');

  // ---------- what the guide knows about each skill ----------
  const SKILLS = {
    'prioritizing-ai-use-cases': {
      keys: ['roadmap', 'prioritis', 'prioritiz', 'use case', 'which first', 'backlog of ideas', 'value', 'feasibility', 'quarter', 'now next later', 'business case', 'roi'],
      paste: '- The **candidate use cases** (what customers ask for)\n- **Monthly volumes** per use case, even rough ones\n- **Where the answer lives** today (article, PDF, system, API)\n- **Constraints**: regulated topics, budget ("2 use cases per quarter"), cost per call',
      tips: '- Volumes matter most: without them the scoring is a guess.\n- Say which topics are **regulated** (complaints, advice, disputes). The skill gates them out instead of scoring them.\n- Mention the **cost per contact** to get a business impact estimate.',
      when: 'deciding **what the assistant should handle first** and building a Now / Next / Later roadmap',
    },
    'designing-conversational-journeys': {
      keys: ['journey', 'conversation', 'dialog', 'utterance', 'intent', 'hand off', 'handoff', 'escalat', 'fallback', 'chatbot flow', 'bot flow', 'branches', 'happy path'],
      paste: '- The **customer need** in one sentence\n- What **"solved"** means\n- The **approved articles** or data the assistant can use\n- What it **must not do** (act on the account, give advice…)\n- When to **hand off** to a person, and to which team',
      tips: '- Describe the **unhappy paths**: fraud, failure, frustration, no source. That is where journeys break.\n- Name the hand-off team and its hours.\n- Paste a few **real customer messages**: typos and panic included.',
      when: 'designing **how one conversation behaves**, with every branch and the hand-off to an advisor',
    },
    'evaluating-rag-quality': {
      keys: ['evaluat', 'test set', 'golden', 'quality', 'good enough', 'go live', 'go no go', 'go/no-go', 'release gate', 'metric', 'faithful', 'hallucinat', 'rag', 'retrieval', 'monitor', 'csv', 'score', 'judge'],
      paste: '- **Before testing:** the use cases, the knowledge sources and the risks. You get a plan, a golden set and release gates.\n- **After testing:** paste the **scored CSV** (one row per question, 1 = pass, 0 = fail). You get go / no-go and the failure analysis.\n- **After launch:** what changed in the numbers. You get a monitoring dashboard and an investigation plan.',
      tips: '- Agree the **release gates before** you look at results.\n- Mix the golden set: answerable, escalation, unanswerable, adversarial. Take 30% from **real conversations**.\n- Add a `failure_cause` column so each failure goes to the right owner.',
      when: 'deciding **if the answers are good enough to release**, and monitoring them after',
    },
    'governing-ai-risk': {
      keys: ['risk', 'guardrail', 'security', 'complian', 'legal', 'gdpr', 'rgpd', 'dpo', 'ai act', 'dora', 'owasp', 'injection', 'red team', 'jailbreak', 'privacy', 'personal data'],
      paste: '- What the assistant **sees** (customer data, notes, documents)\n- What it **does** (answers only, drafts, actions on the account)\n- **Who** uses it (customers, advisors) and how they log in\n- The **model provider** and where it is hosted',
      tips: '- Be precise about **actions**: "can block a card" changes the risk level a lot.\n- Mention any **sensitive data** (health, free-text notes).\n- Legal points come back as questions to confirm with Legal, the DPO and Compliance, never as legal advice.',
      when: 'listing **what could go wrong**, the guardrails, red-team tests and the compliance questions',
    },
    'curating-knowledge-bases': {
      keys: ['knowledge', 'content', 'article', 'help centre', 'help center', 'faq', 'source', 'outdated', 'contradict', 'writer', 'documentation base', 'metadata', 'cant answer', 'missing'],
      paste: '- Your **content sources**, owners and last review dates\n- The **top customer questions** with volumes\n- Known problems: outdated pages, PDFs, pages that **contradict** each other\n- Or the **assistant logs**: questions it couldn\'t answer or got 👎 on',
      tips: '- Logs of "I can\'t answer" and 👎 are the best input: they rank gaps by real demand.\n- Say how many **writers** you have, to get a backlog that fits capacity.',
      when: 'fixing the **content the assistant answers from**: gaps, contradictions, writing standards',
    },
    'aligning-stakeholders': {
      keys: ['steerco', 'steering', 'committee', 'decision', 'memo', 'raci', 'release note', 'stakeholder', 'brief', 'change management', 'adoption', 'communicat', 'sponsor', 'arbitrage', 'go live pack'],
      paste: '- **What** needs deciding or communicating, **to whom**, and **by when**\n- The **options** and the key numbers\n- **Who thinks what** (support in favour, marketing against…)',
      tips: '- Name the **decision** in one sentence: the memo is built around it.\n- Give the cost of **not deciding** (a lost slot, a delay).\n- Ask for several artefacts at once: release notes + briefing + RACI.',
      when: 'getting a **decision or alignment**: decision memo, steerco update, RACI, release notes, change plan',
    },
    'managing-xray-tests': {
      keys: ['xray', 'test case', 'test cases', 'test plan', 'test execution', 'test set', ' qa ', 'test coverage', 'regression', 'import tests', 'testing in jira'],
      paste: '- The **stories and acceptance criteria** (or the PRD section)\n- The **Jira project key** and the **story keys**\n- **Xray Cloud or Server / Data Center** (if unknown, you get both)\n- Who runs the tests: testers by hand, Cucumber automation, or a script\n- Or **test results** to import (a CSV, a JUnit report, an evaluation run)',
      tips: '- Give the story keys: the tests get linked and Jira shows coverage per story.\n- Give existing test keys to **update** tests instead of duplicating them.\n- For a chatbot, ask for the golden set as Generic tests: each evaluation run then lands in the Test Plan.',
      when: 'turning stories or test results into **Xray tests and import files**, for Xray Cloud and Server / Data Center',
    },
    'modeling-processes': {
      keys: ['process', 'bpmn', 'diagram', 'flowchart', 'swimlane', 'sop', 'procedure', 'workflow', 'uml', 'map'],
      paste: '- **Who** does each step (roles or teams)\n- The steps **in order**\n- **Decisions** and what happens in each case\n- What happens **when something goes wrong**',
      tips: '- Meeting notes are fine: the skill lists the open questions to ask the client.\n- Download the `.bpmn` file to edit it in Camunda Modeler or bpmn.io.',
      when: 'turning a process description into a **BPMN diagram** with swimlanes',
    },
    'writing-prds': {
      keys: ['prd', 'requirement', 'spec', 'product requirement', 'one pager', 'brief', 'feature'],
      paste: '- The **problem** and who has it\n- Any **numbers** (volumes, costs, complaints)\n- **Deadlines** and what is **out of scope**',
      tips: '- Evidence makes the PRD credible: paste a metric or a quote.\n- Say if you want a one-pager or the full PRD.',
      when: 'writing a **PRD** with goals, metrics and traceable requirements',
    },
    'writing-user-stories': {
      keys: ['user stor', 'stories', 'acceptance criteria', 'gherkin', 'jira', 'linear', 'invest', 'sprint', 'definition of ready'],
      paste: '- The **requirements** or the PRD section\n- Your backlog **tool** (Jira, Linear…)\n- Any **business rules** and edge cases you know',
      tips: '- Set your tool in your profile once: every story comes in that format.\n- Paste a PRD with requirement IDs to keep traceability.',
      when: 'turning requirements into **sprint-ready stories** with acceptance criteria',
    },
    'testing-apis': {
      keys: ['api', 'endpoint', 'openapi', 'swagger', 'rest', 'curl', 'postman', 'test plan'],
      paste: '- The **endpoint(s)**, an example **request and response**\n- The **business rules** the API must respect',
      tips: '- Business rules give the best test cases (limits, statuses, permissions).',
      when: 'building an **API test plan** and documentation',
    },
    'generating-sql': {
      keys: ['sql', 'query', 'database', 'table', 'kpi', 'report', 'how many', 'count'],
      paste: '- The **question** in plain words\n- The **database** type and the **tables / columns** if you have them',
      tips: '- Say the period and the grain ("per month, per client") to avoid ambiguity.',
      when: 'getting a **SQL query** explained in plain language',
    },
    'facilitating-workshops': {
      keys: ['workshop', 'atelier', 'meeting notes', 'minutes', 'compte rendu', 'cr ', 'interview', 'kick off', 'kickoff', 'recueil', 'discovery session', 'transcript', 'agenda'],
      paste: '- **To prepare:** the topic, the objective, the attendees and their roles, the duration\n- **To follow up:** your **raw notes** as they are: who was there, what was said, what was decided',
      tips: '- Don\'t clean your notes: the skill separates decisions, requirements and open questions, and never turns a "we\'ll see" into a decision.\n- Name who was **missing**: the report flags the decisions that need them.\n- Ask for the report in French if your client works in French (*compte-rendu, décisions, exigences, actions*).',
      when: 'preparing a **workshop** or turning **meeting notes** into a report with decisions, requirements and actions',
    },
    'writing-functional-specs': {
      keys: ['sfd', 'sfg', 'functional spec', 'specification', 'specs', 'cahier des charges', 'business rule', 'regle de gestion', 'rg ', 'frs', 'brs'],
      paste: '- The **feature** and the **decisions** already taken (a workshop report is ideal)\n- The **actors** and what each can do\n- The **systems and APIs** involved\n- Constraints: regulation, volumes, deadlines',
      tips: '- Say **SFG** (general, for framing) or **SFD** (detailed, ready to build). The default is SFD.\n- Paste an existing spec and ask for a **review**: you get the defects and the corrected text.\n- Every business rule comes with an example and a test idea, ready for the UAT.',
      when: 'writing a **functional spec (SFG / SFD)** that developers build from and testers test from',
    },
    'running-uat': {
      keys: ['uat', 'recette', 'acceptance test', 'defect', 'anomal', 'bug', 'sign off', 'signoff', 'pv de recette', 'test campaign', 'exit criteria', 'go no go', 'squash', 'hp alm', 'triage'],
      paste: '- **To plan:** scope, dates, testers, environment\n- **During the campaign:** the **test execution export** and the **defect export** (Jira, Xray, Squash or HP ALM, English or French columns) and your exit criteria\n- **To close:** final figures and open defects',
      tips: '- Agree the **exit criteria before** the campaign starts. The script checks them for you.\n- Give the planned number of tests: tests not yet written count as not run.\n- Severity is never lowered to meet the criteria: decisions to accept a defect are recorded with who took them.',
      when: 'running **UAT (recette)**: plan, daily dashboard, defect triage, go / no-go and PV de recette',
    },
    'analysing-gaps-and-impacts': {
      keys: ['gap', 'impact', 'existing vs target', 'as is', 'to be', 'existant', 'cible', 'regulation', 'regulatory', 'reglementaire', 'dora', 'psd', 'instant payment', 'kyc', 'aml', 'compliance plan', 'audit finding'],
      paste: '- The **change**: a regulation, a migration, a new product\n- **How it works today**: process, tools, teams\n- The **deadline** and where it comes from\n- Who owns what',
      tips: '- Volumes and past incidents make the sizing credible.\n- Regulatory points come back paraphrased, with what to confirm with Compliance, never as legal advice.\n- Ask for **options** (tactical vs strategic) when the deadline is tight.',
      when: 'framing a change: **existing vs target**, regulatory traceability, impacts with sizes and owners, and a plan',
    },
    'mapping-data': {
      keys: ['mapping', 'data dictionary', 'migration', 'reprise', 'reconcil', 'data quality', 'interface', 'flux', 'lineage', 'source to target', 'source target', 'etl', 'transformation'],
      paste: '- **Source** tables and fields, **target** object and what it needs\n- **Volumes** and the type of flow (one-off migration, batch, API)\n- The **key** that identifies a record on both sides\n- Code values you know (e.g. segment codes)',
      tips: '- The mapping comes as a **CSV**: the script checks it and writes the reconciliation and data quality SQL.\n- List every source code value, even the odd ones: each needs a translation.\n- Say which fields are personal data, to keep only what is needed.',
      when: 'building a **data mapping**, data quality rules and reconciliation checks for an interface or a migration',
    },
    'managing-backlog': {
      keys: ['backlog', 'wsjf', 'pi planning', 'pi objective', 'safe ', 'agile release train', 'capacity', 'velocity', 'sprint planning', 'release plan', 'refinement', 'grooming', 'jira import', 'cost of delay', 'rice '],
      paste: '- The **candidate features** with value, urgency, risk reduction, size and points, plus dependencies\n- The **team velocity**, the number of sprints, run support\n- **Deadlines** (regulatory or committed)',
      tips: '- Scores are relative: the smallest item gets 1 on each criterion.\n- A regulatory deadline raises time criticality, it doesn\'t skip the ranking.\n- You get a **Jira CSV** at the end: test the import with 3 rows first.',
      when: 'ranking a **backlog with WSJF** and planning a **PI or a release** that fits the capacity',
    },
  };

  // ---------- glossary ----------
  const TERMS = [
    [['interchange', 'interchange fee'], 'Interchange fee', 'Paid by the **acquirer** to the **issuer** on each transaction, set by the card scheme. In the EU, the IFR caps it for consumer cards at **0.2%** (debit) and **0.3%** (credit); commercial cards are not capped.'],
    [['issuer', 'emetteur'], 'Issuer', 'The bank that issued the cardholder\'s card. It **approves or declines** each payment, debits the cardholder and receives the interchange fee.'],
    [['acquirer', 'acquereur'], 'Acquirer', 'The **merchant\'s** bank or payment institution. It routes authorisations, sends transactions to clearing, credits the merchant and pays the interchange.'],
    [['authorisation', 'authorization', 'autorisation'], 'Authorisation', 'The real-time request at checkout: merchant → acquirer → scheme → issuer, who approves or declines. If the issuer doesn\'t answer, the scheme decides in **stand-in (STIP)** within the issuer\'s limits.'],
    [['clearing', 'compensation'], 'Clearing (compensation)', 'The batch exchange of transaction records between acquirers and issuers through the scheme: matching to authorisations, interchange computation, records sent to issuers.'],
    [['settlement', 'reglement'], 'Settlement (règlement)', 'The actual movement of funds between members, from the **net positions** computed after clearing.'],
    [['lclf', 'fraud prevention'], 'LCLF (lutte contre la fraude)', 'French for fraud prevention and detection: authorisation scores, decline rules, 3-D Secure, issuers\' fraud reports, fraud-rate monitoring.'],
    [['stand in', 'stip'], 'Stand-in (STIP)', 'An authorisation decision taken by the scheme **on behalf of the issuer** when the issuer doesn\'t answer, within limits the issuer set. The issuer then receives an advice of each decision.'],
    [['chargeback', 'dispute', 'impaye', 'representment'], 'Chargeback (dispute)', 'The issuer contests a transaction (fraud, not received, duplicate…) within the scheme\'s deadline. The acquirer accepts or **represents** with evidence; arbitration decides as a last resort.'],
    [['arn'], 'ARN', 'Acquirer Reference Number: the unique id of a transaction, given by the acquirer, used in clearing and disputes.'],
    [['mcc'], 'MCC', 'Merchant Category Code: 4 digits for the merchant\'s business (e.g. 5812 restaurants). Used for routing, interchange and fraud rules.'],
    [['bin'], 'BIN', 'Bank Identification Number: the first digits of the card number, identifying the issuer and the product. BIN ranges (often 8 digits) carry the card\'s attributes.'],
    [['ifr'], 'IFR', 'EU Interchange Fee Regulation (EU) 2015/751: caps for consumer cards and transparency duties towards merchants. Confirm details with Compliance.'],
    [['template'], 'Template', 'Each deliverable has a **template**: the information its skill needs, in order. Click **Use the template** in the form, fill what you know, and Claude asks for the rest.'],
    [['rag', 'retrieval augmented'], 'RAG (retrieval-augmented generation)', 'The assistant first **retrieves** passages from approved content (help centre, tariffs…), then **writes** its answer from them. Good RAG answers only from what it retrieved, and cites it.'],
    [['faithful', 'hallucinat', 'groundedness'], 'Faithfulness', 'Is every claim in the answer **supported by the retrieved passages**? A hallucination is an unfaithful answer. In banking the release gate is usually **100% on high-risk questions**.'],
    [['context recall', 'recall'], 'Context recall', 'Did retrieval **find the passages needed** to answer? Low recall means a retrieval or content problem, not a model problem.'],
    [['context precision', 'precision'], 'Context precision', 'Of the passages retrieved, **how many were relevant**? Low precision means noise (outdated or off-topic pages) reaches the model.'],
    [['answer relevance', 'relevance'], 'Answer relevance', 'Does the answer **address the question asked**, without padding or drifting to another topic?'],
    [['golden set', 'golden dataset', 'test set'], 'Golden set', 'The reference list of test questions, each with the **expected answer and source**. Mix answerable, escalation, unanswerable and adversarial questions, and include real customer wording.'],
    [['judge', 'llm as judge'], 'LLM-as-judge', 'A model scores the answers against the expected ones. Calibrate it: have people re-check a sample (e.g. 25%) and track **judge–human agreement** (target ≥ 90%).'],
    [['containment', 'deflection', 'automation rate'], 'Containment with resolution', 'Conversations closed **without an advisor and without a repeat contact** within 72h. Plain containment rewards bots that trap customers; this version doesn\'t.'],
    [['prompt injection', 'injection', 'jailbreak'], 'Prompt injection (OWASP LLM01)', 'Text that tries to **override the assistant\'s instructions**: typed by a user ("ignore your rules…") or hidden in a document or email it reads. Controls: treat user and retrieved text as data, filter every turn, red-team it.'],
    [['owasp'], 'OWASP Top 10 for LLM Applications', 'The reference list of LLM security risks: prompt injection, sensitive information disclosure, supply chain, data poisoning, improper output handling, excessive agency, system prompt leakage, vector & embedding weaknesses, misinformation, unbounded consumption.'],
    [['excessive agency', 'agency'], 'Excessive agency (OWASP LLM06)', 'The assistant can **do more than it should** (move money, change limits) or acts without confirmation. Control: least privilege, and an in-app confirmation before any action.'],
    [['ai act', 'article 50', 'art 50', 'transparency'], 'EU AI Act, Art. 50', 'Transparency duty: people must be told they are **interacting with an AI** unless it\'s obvious. Applies from 2 August 2026. Confirm the wording and placement with Legal.'],
    [['gdpr', 'rgpd', 'dpia', 'aipd'], 'GDPR & DPIA', 'Personal data in prompts, logs and retrieval must have a legal basis, minimisation and retention rules. A **DPIA** is likely for a new AI system processing customer data at scale. Owner: the DPO.'],
    [['dora'], 'DORA', 'EU Digital Operational Resilience Act for financial entities: ICT risk management, incident reporting, and a **register of ICT third-party providers** (your LLM provider goes in it).'],
    [['red team', 'red teaming', 'adversarial'], 'Red teaming', 'Trying to **break the assistant on purpose**: injections, data leaks, forbidden advice, unwanted actions. Each attack becomes a test case in the golden set.'],
    [['guardrail'], 'Guardrail', 'A **testable rule** that limits what the assistant can say or do, e.g. "answer only from approved, in-date sources, with a citation". Each guardrail links to a risk and a test.'],
    [['hand off', 'handoff', 'escalation', 'escalat'], 'Hand-off', 'Passing the conversation to a person **with its context**, so the customer doesn\'t repeat themselves. Always available on request, automatic on fraud, failure or frustration.'],
    [['fallback'], 'Fallback', 'What the assistant does when it doesn\'t understand or has no source. Good fallbacks rephrase once, offer options, then hand off. Never a dead end.'],
    [['utterance'], 'Utterance', 'A real way a customer phrases a need: "cant get in my acount", "carte bloquée". Collect many per intent, typos included.'],
    [['intent'], 'Intent', 'What the customer wants to achieve ("unlock my access"). One journey usually covers one intent.'],
    [['gherkin', 'given when then'], 'Gherkin', 'Acceptance criteria written as **Given / When / Then** scenarios, readable by business and testable by QA.'],
    [['raci'], 'RACI', '**R**esponsible (does it), **A**ccountable (decides, one per row), **C**onsulted, **I**nformed.'],
    [['bpmn'], 'BPMN 2.0', 'The standard notation for process diagrams. Lanes show who does what; the `.bpmn` file opens in Camunda, bpmn.io or Signavio.'],
    [['invest'], 'INVEST', 'A good story is Independent, Negotiable, Valuable, Estimable, Small, Testable.'],
    [['wsjf', 'cost of delay'], 'WSJF (Weighted Shortest Job First)', 'SAFe prioritisation: **(business value + time criticality + risk reduction) ÷ job size**, each scored relatively on 1, 2, 3, 5, 8, 13, 20. Small, urgent, valuable items go first.'],
    [['pi planning', 'program increment', 'pi objective'], 'PI planning (SAFe)', 'A 2-day event where every team of the train plans the next **Program Increment** (usually 4 sprints + 1 innovation & planning sprint): features by sprint, dependencies, **PI objectives** with business value, and risks.'],
    [['roam'], 'ROAM', 'How SAFe handles risks at PI planning: **R**esolved, **O**wned, **A**ccepted, **M**itigated.'],
    [['sfd', 'sfg'], 'SFG / SFD', 'French functional specs. **SFG** (*spécifications fonctionnelles générales*): the overall solution for a scope. **SFD** (*détaillées*): one function in full detail, meaning business rules, screens, fields, messages and interfaces.'],
    [['regle de gestion', 'business rule'], 'Business rule (RG)', 'One testable rule, numbered (RG-01…), written as *if… then…* with an example. The heart of a spec: each rule gives at least one test case.'],
    [['recette', 'uat', 'user acceptance'], 'Recette / UAT', 'Acceptance testing by the business before go-live: test cases from the rules, defects triaged daily, then a go / no-go against agreed **exit criteria**.'],
    [['pv de recette', 'sign off', 'signoff'], 'PV de recette (sign-off)', 'The signed report that closes acceptance testing: scope, figures, exit criteria, open defects accepted with workarounds, and the signatures of the business owner, IT and the PO.'],
    [['severity', 'blocking', 'bloquant'], 'Defect severity', '**Blocking**: no workaround, critical process, regulatory or data error. **Major**: important, costly workaround. **Minor**: cosmetic or rare. **Enhancement**: a change of need, goes to the backlog.'],
    [['gap analysis', 'impact analysis', 'existant', 'as is'], 'Gap & impact analysis', '**Gap analysis** compares today with the target, area by area. **Impact analysis** says what that changes, for whom, how big, and who owns it.'],
    [['data mapping', 'source to target'], 'Data mapping', 'For each target field: where the value comes from, how it is transformed, the default when it\'s missing, and the data quality rule. Code values get translation tables.'],
    [['reconciliation', 'reconcil'], 'Reconciliation', 'Proving a migration or interface lost nothing: row counts, keys missing or extra on each side, and totals (amounts, balances) compared between source and target.'],
    [['moscow'], 'MoSCoW','Must, Should, Could, Won\'t (this time). A simple way to prioritise requirements.'],
    [['csat'], 'CSAT', 'Customer satisfaction score from a short survey after the conversation, usually on a 1 to 5 scale.'],
    [['chunk', 'embedding', 'vector'], 'Chunks & embeddings', 'Content is split into **chunks** that are retrieved alone, so each section must make sense on its own. Embeddings are how the system finds chunks similar to the question.'],
  ];

  // ---------- how the app works ----------
  const APP = [
    [['how does', 'how it works', 'how do i start', 'get started', 'what is this', 'what can you do', 'help', 'start'], 'How Analyst Kit works',
      '1. **Pick a deliverable** in the sidebar or press **N**.\n2. **Paste your notes** (or drop a .txt, .md or .csv file), or click a **scenario** to try one.\n3. **Create**: Claude writes the document and you get a notification.\n4. **Ask for changes** in the conversation next to it. Every version is kept.\n5. **Hand it over**: Word, PDF or copy, then *Mark as sent*.',
      [{ label: 'New deliverable', href: '#/new' }]],
    [['template', 'fill in', 'structure'], 'Templates',
      'Every deliverable has a **template**: the list of what its skill needs, in order. In the form, click **Use the template**, fill what you know and delete the rest. The app becomes your template: you never start from a blank page, and Claude does the work from the filled template.'],
    [['french', 'francais', 'language of the app', 'interface language'], 'Interface language',
      'The **FR / EN** button at the bottom of the sidebar switches the interface language. The language of the documents is set in your **profile**.'],
    [['change', 'edit', 'modify', 'feedback', 'comment', 'reply', 'shorter', 'translate', 'french'], 'Asking for changes',
      'Open the deliverable and write in the **Conversation** panel on the right, e.g. *"make it shorter for the steerco"* or *"translate to French"*. Claude updates the document and keeps the old version (see *Versions* at the top).'],
    [['word', 'pdf', 'export', 'download', 'copy', 'docx', 'email', 'confluence', 'send to client'], 'Exporting',
      'On any finished deliverable: **Download Word** (diagrams included), **Save as PDF**, or **Copy** to paste formatted into an email, Notion or Confluence. Then click **Mark as sent** to track what each client received.'],
    [['version', 'history', 'previous', 'undo'], 'Versions',
      'Every time Claude updates a document, the previous version is kept. Use the version bar at the top of the deliverable to look at or export an older one.'],
    [['offline', 'online', 'not answering', 'waiting', 'nothing happens', 'stuck', 'slow'], 'When Claude is offline',
      'The dot at the bottom of the sidebar shows if Claude is picking up requests. If it says **offline**, go to your Claude Code chat and type **"check my requests"**. Your requests wait safely until then. *I* (the guide) always answer instantly.'],
    [['profile', 'my name', 'prepared by', 'tone', 'language', 'logo'], 'Your profile',
      'In **Profile** set your name, title and company (printed as *Prepared by* on every document), your language, tone and backlog tool. Claude also remembers preferences you give in the chat.',
      [{ label: 'Open profile', href: '#/profile' }]],
    [['next step', 'what next', 'continue', 'after this', 'chain'], 'Continuing from a document',
      'Under each finished deliverable, **Continue from this document** offers the logical next one, e.g. roadmap → conversation design → evaluation plan. It starts the new request with the current document as notes.'],
    [['shortcut', 'keyboard', 'hotkey'], 'Shortcuts', '**N** new deliverable · **/** search · **⌘↵** send or create · **?** open this guide · **Esc** close full screen.'],
    [['diagram', 'zoom', 'full screen', 'fullscreen', 'camunda', 'signavio', 'bpmn file'], 'Diagrams',
      'Process diagrams are real BPMN 2.0: drag to move, use the zoom buttons or **Full screen**, and download **.bpmn**, PNG or SVG. The `.bpmn` file opens in Camunda Modeler, bpmn.io or Signavio.'],
    [['delete', 'remove'], 'Deleting', 'Open the deliverable and use the delete action at the bottom of the document. Deleted samples don\'t come back.'],
    [['which', 'what deliverable', 'which skill', 'recommend', 'i need', 'i want', 'should i use'], null, null],
  ];

  // ---------- Xray knowledge ----------
  const XR = '#/new/managing-xray-tests';
  const XRAY = [
    [['cloud', 'server', 'data center', 'datacenter', ' dc ', 'difference', 'version', 'flavor', 'flavour'], 'Xray Cloud vs Server / Data Center',
      '| | Cloud | Server / Data Center |\n|---|---|---|\n| Result statuses | `PASSED` `FAILED` `TODO` `EXECUTING` | `PASS` `FAIL` `TODO` `EXECUTING` |\n| Creating a test from results | `testInfo.type` | `testInfo.testType` |\n| API | `xray.cloud.getxray.app/api/v2` | `<your-jira>/rest/raven/2.0` |\n| Login for the API | Client ID + secret → token (24 h) | Jira personal access token |\n\nThe skill generates **both versions** from the same tests, so you don\'t need to know which one you have to start.',
      [{ label: 'Which one do I have?', say: 'How do I know if we use Xray Cloud or Server?' }]],
    [['which one do i have', 'how do i know', 'do we use', 'know if'], 'Cloud or Server: how to tell',
      '- Your Jira address ends with **atlassian.net** → **Xray Cloud**.\n- Your Jira is on your company\'s own domain (e.g. `jira.mybank.com`) → **Server / Data Center**.\n- Still unsure: ask the Jira admin, or look at *Apps › Manage apps*: the Xray app name says Cloud or Data Center.'],
    [['test type', 'manual', 'cucumber', 'generic', 'automated', 'which type', 'gherkin'], 'Which test type?',
      '- **Manual**: a person follows steps (*Action · Data · Expected result*). Best for journeys you check on screen: wording, quick replies, the hand-off screen.\n- **Cucumber**: a Gherkin scenario. Best when acceptance criteria are already *Given / When / Then* and the team automates them. One `.feature` file per story.\n- **Generic**: an automated test known only by its name. Best for RAG evaluation questions, red-team cases, API checks: the results import creates them.'],
    [['test set', 'test plan', 'test execution', 'execution', 'plan vs', 'set vs', 'organis', 'organiz'], 'Test Set, Test Plan, Test Execution',
      '- **Test Set**: a reusable group of tests (*Cards regression*, *Red-team*).\n- **Test Plan**: what must pass for a **release**, across environments. It shows the overall status.\n- **Test Execution**: **one run** of some tests, on one version and one environment, with each result.\n\nTypical flow: tests → grouped in Sets → added to the release Plan → each run is an Execution inside the Plan.'],
    [['precondition', 'background', 'pre condition'], 'Preconditions',
      'A **Precondition** is a Jira issue describing the starting state ("customer logged in with one active card"). Reuse it across tests. In Cucumber, the `Background` of a feature file becomes a Precondition on import. For manual tests imported by CSV, the skill puts the precondition in the description.'],
    [['coverage', 'requirement status', 'nok', 'uncovered', 'link to story', 'linked', 'traceab'], 'Requirement coverage',
      'Each test is linked to its story with a **"Tests"** link. The story then shows a coverage status: **OK** (all its tests passed), **NOK** (one failed), **NOT RUN**, or **UNCOVERED** (no test). In the CSV the *Requirement* column creates the link; in a `.feature` file the story key tag above `Feature:` does it.'],
    [['csv', 'test case importer', 'import test', 'import manual', 'mapping', 'excel', 'spreadsheet'], 'Importing manual tests (CSV)',
      '1. Jira › Xray › **Test Case Importer** › CSV, delimiter `,`, UTF-8.\n2. Map **Test ID** → *Test Case Identifier* (it groups the step rows), Summary, Description, Test Type, Priority, *Test Repository Path*, each **Requirement** column → link "Tests", each **Labels** column → Labels, **Action · Data · Expected Result** → step fields.\n3. Tick **Create folders** if needed.\n4. **Save the configuration file** at the end: next imports take one click.\n\nStart with 2–3 tests to check the mapping.',
      [{ label: 'See a ready CSV', href: XR }]],
    [['feature file', 'import cucumber', 'feature', '.feature'], 'Importing Cucumber tests',
      'Without API: Xray › **Import Cucumber Tests**, upload the `.feature` files (or a zip).\nWith API: `POST …/import/feature?projectKey=LUM` (Cloud: `/api/v2`, Server/DC: `/rest/raven/1.0`).\n\nTag the story key **above `Feature:`** (e.g. `@LUM-412`) to link the tests. Tag a scenario with an existing test key to **update** it instead of creating a new one.'],
    [['import result', 'results', 'execution result', 'json', 'xray json', 'upload result', 'junit'], 'Importing results',
      'Open the Test Execution › **Import Execution Results** › Xray JSON, or call `POST …/import/execution`. The skill writes `results.json` in the right vocabulary for your flavor. Xray also accepts JUnit, TestNG, NUnit, Robot and Cucumber JSON reports directly from automation.'],
    [['not valid', 'not a valid', 'valid xray format', 'invalid', 'error', 'de serializ', 'deserializ', 'fail to import', 'rejected', 'does not work', 'doesnt work'], 'Import errors: the usual causes',
      '- **"Not a valid Xray format"**: Cloud wants `PASSED`/`FAILED`, Server/DC wants `PASS`/`FAIL`. Use the file built for your flavor.\n- **Server/DC refuses a field**: its schema rejects unknown fields; for new tests it\'s `testType`, not `type`.\n- **CSV: missing fields** after Excel export: empty cells with spaces, wrong delimiter or encoding. Save as CSV UTF-8.\n- **Requirement not linked**: the story key doesn\'t exist or isn\'t a story/requirement type in your Xray settings.\n- **Labels split oddly**: Jira labels can\'t contain spaces.\n\nPaste the exact error into the chat with Claude if it\'s something else.'],
    [['duplicate', 'twice', 'created again', 'double'], 'Avoiding duplicate tests',
      'Importing results for a test **without a key** creates a new test. So either import the tests first and reuse their keys in the results, or skip the test import and let the results file create the tests in one go. The import guide flags any test at risk.'],
    [['api key', 'client id', 'client secret', 'token', ' pat ', 'authenticat', 'credentials', 'login'], 'API access',
      '**Cloud:** an Xray admin creates an API key (*Xray settings › API Keys*) → Client ID + Client Secret → exchanged for a token valid 24 h.\n**Server/DC:** a Jira **personal access token** (*Profile › Personal Access Tokens*).\n\nKeep them in environment variables (`$XRAY_CLIENT_ID`, `$JIRA_PAT`), never in a file or a chat. No API access? Every import also works from the Xray screens.'],
    [['folder', 'repository', 'test repository', 'organise tests'], 'Test Repository folders',
      'Organise tests **by product area**, not by sprint: `/Assistant/Cards/Lost or stolen`. Folders are separated by `/`; the CSV *Test Repository Path* column creates them when *Create folders* is ticked.'],
    [['rag', 'evaluation', 'golden', 'eval run', 'eval results', 'evaluation results', 'chatbot quality', 'llm'], 'Chatbot evaluation in Xray',
      'Each golden-set question becomes a **Generic test** (`rag-eval.<id>`), and each evaluation run becomes a **Test Execution** in the release Test Plan. A question passes only if every scored metric passed; failed metrics and root cause go in the comment. One command converts the scored CSV.',
      [{ label: 'Try: Eval run → Xray', example: ['managing-xray-tests', 1] }]],
    [['defect', 'bug', 'link bug'], 'Defects',
      'Link the Jira bug to the failed test run (the `defects` field in `results.json`, or the *Defects* section of the run). The story coverage then shows NOK with the bug, until the test passes again.'],
    [['environment', 'staging', 'preprod', 'production'], 'Test environments',
      'Set `testEnvironments` (e.g. `staging`) on the execution. In a Test Plan, Xray then shows the status **per environment**, so "passed on staging, not run on pre-prod" is visible.'],
    [['generate', 'create tests', 'write tests', 'from stories', 'from my stories', 'start'], 'Create Xray tests from your stories',
      'Paste your stories and acceptance criteria with the Jira keys. You get the tests, the coverage matrix, and import files for Cloud and Server/DC.',
      [{ label: 'Try: Stories → Xray tests', example: ['managing-xray-tests', 0] }, { label: 'Start from my notes', href: XR }]],
  ];
  const XRAY_SUGG = ['Cloud or Server: what changes?', 'Which test type should I use?', 'Test Set vs Test Plan vs Execution?', 'How do I import the CSV?', "Import says 'not a valid Xray format'", 'Send my eval results to Xray'];
  function xrayAnswer(t) {
    let best = null, score = 0;
    for (const e of xrayEntries()) { const s = hits(t, e[0]); if (s > score) { score = s; best = e; } }
    return score >= 3 ? { a: `**${best[1]}**\n\n${best[2]}`, acts: best[3] } : null;
  }

  // ---------- language ----------
  const FRG = () => K() && K().state.lang === 'fr' && window.KIT_GUIDE_FR;
  // G('English', key, ...args): the French text when the interface is French (functions take args).
  const G = (en, key, ...a) => { const f = FRG() && FRG().ui[key || en]; return f ? (typeof f === 'function' ? f(...a) : f) : en; };
  const skillData = (id) => ({ ...(SKILLS[id] || {}), ...((FRG() && FRG().skills[id]) || {}) });
  const skillKeys = (id) => [...((SKILLS[id] || {}).keys || []), ...((window.KIT_GUIDE_FR && window.KIT_GUIDE_FR.keys[id]) || [])];
  const terms = () => (FRG() ? FRG().terms.concat(TERMS) : TERMS);
  const appEntries = () => (FRG() ? FRG().app.concat(APP) : APP);
  const xrayEntries = () => (FRG() ? FRG().xray.concat(XRAY) : XRAY);

  // ---------- state ----------

  function context() {
    const r = location.hash.replace(/^#/, '') || '/';
    let m, type = null, page = 'home', req = null;
    if ((m = r.match(/^\/new(?:\/([a-z-]+))?/))) { page = 'new'; type = m[1] || null; if (!type) { const on = $('#seg .on'); type = on && on.dataset.t; } }
    else if ((m = r.match(/^\/type\/([a-z-]+)/))) { page = 'type'; type = m[1]; }
    else if ((m = r.match(/^\/d\/(\d+)/))) { page = 'doc'; req = K().state.requests.find((x) => x.id === +m[1]); type = req && req.type; }
    else if (r.startsWith('/chat')) page = 'chat';
    else if (r.startsWith('/profile')) page = 'profile';
    return { page, type, req };
  }
  const tName = (id) => K().tx(K().typeOf(id), 'name');
  const sampleOf = (id) => K().state.requests.find((r) => r.is_sample && r.type === id);

  function suggestions() {
    const c = context();
    const n = c.type && tName(c.type);
    if (c.page === 'new' && c.type) return [G(`What should I paste for ${n}?`, 's.paste', n), G('Fill a scenario for me', 's.fill'), G(`Tips for a great ${n}`, 's.tips', n), G('Explain a term', 's.term')];
    if (c.page === 'type' && c.type) return [G(`When do I use ${n}?`, 's.when', n), G(`Show me a finished ${n}`, 's.show', n), G(`What should I paste for ${n}?`, 's.paste', n)];
    if (c.page === 'doc') return [G('How do I ask for changes?', 's.changes'), G('Export to Word or PDF', 's.export'), G('What comes next after this?', 's.next'), G('Explain a term', 's.term')];
    return [G('How does this work?', 's.how'), G('Which deliverable do I need?', 's.which'), G('What is the template for?', 's.template'), G('What is interchange?', 's.term2')];
  }

  // ---------- answering ----------
  // Keys match at the start of a word ("api" must not match "capital").
  const hits = (t, keys) => keys.reduce((n, k) => n + (t.includes(k[0] === ' ' ? k : ' ' + k) ? k.trim().length : 0), 0);
  function skillIn(t) {
    let best = null, score = 0;
    for (const ty of K().state.types) {
      const names = [norm(ty.name), norm((ty.fr || {}).name || ty.name)];
      const s = (names.some((nm) => t.includes(nm)) ? 50 : 0) + hits(t, skillKeys(ty.id));
      if (s > score) { best = ty.id; score = s; }
    }
    return score ? { id: best, score } : null;
  }

  function skillCard(id, lead) {
    const t = K().typeOf(id), h = skillData(id), nm = tName(id);
    const acts = [{ label: `${G('Start')} ${nm}`, href: '#/new/' + id }];
    const s = sampleOf(id);
    if (s) acts.push({ label: G('Open the finished sample'), href: '#/d/' + s.id });
    const low = (x) => x[0].toLowerCase() + x.slice(1);
    const what = h.when || low(K().tx(t, 'gets'));
    const head = lead ? `${lead}**${nm}**.${G(` It's for ${what}.`, 'its for', what)}` : G(`**${nm}** is for ${what}.`, 'is for', nm, what);
    return { a: `${head}\n\n**${G('You give')} :** ${low(K().tx(t, 'gives'))}.\n**${G('You get')} :** ${low(K().tx(t, 'gets'))}.`.replace(/ :\*\*/g, FRG() ? ' :**' : ':**'), acts };
  }

  function answer(raw) {
    const t = ' ' + norm(raw) + ' ';
    const c = context();
    const sk = skillIn(t);
    const target = (sk && sk.score >= 3 ? sk.id : null) || c.type;

    if (c.type === 'managing-xray-tests' || / xray /.test(t)) {
      const x = xrayAnswer(t);
      if (x && !/\b(paste|fill|scenario|sample|tips?)\b/.test(t)) return x;
    }

    const pick = { a: G('Tell me what you need in a few words, for example *"workshop report"*, *"spec of the authorisation change"* or *"prepare the UAT"*. Or pick one:', 'pick'), acts: K().state.types.map((ty) => ({ label: K().tx(ty, 'name'), href: '#/type/' + ty.id })) };
    if (/\b(which (deliverable|skill|one)|what should i use|recommend|quel livrable|quelle competence|que choisir|recommande)\b/.test(t) && !(sk && sk.score >= 3)) return pick;

    // intents about a skill
    const exl = (e) => (FRG() && e.label_fr) || e.label;
    if (/\b(fill|scenario|try one|demo|remplis|remplir)\b/.test(t) && c.page === 'new' && c.type) {
      const ex = K().typeOf(c.type).examples || [];
      return { a: G(`Pick a scenario. I'll fill the form, you just press **Create deliverable**.`, 'fill'), acts: ex.filter((e) => e.notes).map((e, i) => ({ label: exl(e), fill: i })) };
    }
    if (/\b(sample|examples?|finished|show me|demo|see one|try|exemples?|montre|voir un)\b/.test(t) && target) {
      const s = sampleOf(target), ex = (K().typeOf(target).examples || []).filter((e) => e.notes);
      const acts = [];
      if (s) acts.push({ label: G('Open the finished sample'), href: '#/d/' + s.id });
      ex.forEach((e, i) => acts.push({ label: G('Try') + (FRG() ? ' : ' : ': ') + exl(e), example: [target, i] }));
      const n = tName(target);
      return { a: s ? G(`Here is a finished **${n}**: *${K().esc(s.title)}*. Or start one from a realistic scenario:`, 'sample', n, K().esc(s.title)) : G(`Start a **${n}** from a realistic scenario:`, 'sample none', n), acts };
    }
    if (/\b(paste|give|input|what do i (put|write|need)|notes|provide|coller|colle|quoi mettre|que mettre|fournir)\b/.test(t) && target && SKILLS[target]) {
      const n = tName(target), p = skillData(target).paste;
      return { a: G(`For **${n}**, paste:\n\n${p}\n\nRough notes are fine. Claude asks in the conversation if something is missing. Or click **Use the template** in the form.`, 'paste', n, p), acts: [{ label: `${G('Start')} ${n}`, href: '#/new/' + target }] };
    }
    if (/\b(tips?|better|great|good result|best|improve|conseils?|astuces?|ameliorer|mieux)\b/.test(t) && target && SKILLS[target]) {
      const n = tName(target), p = skillData(target).tips;
      return { a: G(`**Tips for ${n}:**\n\n${p}`, 'tips', n, p) };
    }
    if (/\b(what will i get|output|what do i get|deliverable|results?|when do i use|what is it for|quand utiliser|a quoi sert|j obtiens|livrable)\b/.test(t) && target) {
      return skillCard(target);
    }
    if (/\b(next|after this|continue|then what|suite|ensuite|apres)\b/.test(t) && c.page === 'doc' && c.type) {
      const nx = (K().typeOf(c.type).next || []).map(K().typeOf);
      const list = nx.map((n) => `**${K().tx(n, 'name')}**`).join(G(' or ', 'or'));
      if (nx.length) return { a: G(`After **${tName(c.type)}**, the usual next step is ${list}. Use *Continue from this document* below the document: it starts the next one with this document as notes.`, 'next', tName(c.type), list) };
    }

    // glossary
    let term = null, ts = 0;
    for (const [keys, name, def] of terms()) { const s = hits(t, keys); if (s > ts) { ts = s; term = [name, def]; } }
    const asksDef = /what is|what s|whats|what are|define|meaning|mean|explain|c est quoi|qu est ce|definition|signifie|veut dire|difference/.test(t);
    if (term && (asksDef || t.trim().split(' ').length <= 3)) return { a: `**${term[0]}**\n\n${term[1]}` };
    if (/explain a term|glossary|jargon|expliquer un terme|lexique|vocabulaire/.test(t)) return { a: G('Ask me any term, for example:'), acts: (FRG() ? ['interchange', 'émetteur', 'compensation', 'stand-in', 'LCLF', 'WSJF', 'PV de recette', 'SFD'] : ['interchange', 'issuer', 'clearing', 'stand-in', 'LCLF', 'WSJF', 'golden set', 'prompt injection']).map((x) => ({ label: x, say: G('What is') + ' ' + x + ' ?' })) };

    // app how-to
    let app = null, as = 0;
    for (const e of appEntries()) { const s = hits(t, e[0]); if (s > as) { as = s; app = e; } }
    // "help" and "start" alone don't beat a named skill ("help me write an SFD")
    const asSpecific = app ? hits(t, app[0].filter((k) => !['help', 'start', 'aide', 'commencer'].includes(k))) : 0;
    if (app && app[1] && as >= 4 && !(sk && sk.score > asSpecific)) return { a: `**${app[1]}**\n\n${app[2]}`, acts: app[3] };

    // recommend a skill from a described need
    if (sk) return skillCard(sk.id, G('Sounds like a job for ', 'job'));
    if (term) return { a: `**${term[0]}**\n\n${term[1]}` };
    if (app && app[1]) return { a: `**${app[1]}**\n\n${app[2]}`, acts: app[3] };
    if (/\b(which|i need|should i|j ai besoin|je dois|il me faut|quel|quelle)\b/.test(t)) return pick;
    return null;
  }

  // ---------- UI: one chat component, used by the floating Guide and by skill pages ----------
  const md = (s) => (window.DOMPurify ? DOMPurify.sanitize(marked.parse(s)) : s);
  function makeChat(root, { intro, suggestions, answer: ans, placeholder }) {
    const C = { msgs: [] };
    root.insertAdjacentHTML('beforeend', `<div class="g-feed"></div><div class="g-sugg chips"></div>
      <form class="g-form" autocomplete="off"><input><button class="btn primary" type="submit"></button></form>`);
    const feed = $('.g-feed', root), sugg = $('.g-sugg', root), form = $('.g-form', root), input = $('input', form);
    C.paint = () => {
      input.placeholder = G(placeholder); $('button', form).textContent = G('Ask');
      feed.innerHTML = [{ role: 'bot', a: intro() }, ...C.msgs].map((m, i) => m.role === 'user'
        ? `<div class="g-msg user">${K().esc(m.text)}</div>`
        : `<div class="g-msg bot"><div class="md">${md(m.a)}</div>${(m.acts || []).length ? `<div class="g-acts">${m.acts.map((x, j) => `<button type="button" class="chip" data-act="${i}:${j}">${K().esc(x.label)}</button>`).join('')}</div>` : ''}</div>`).join('');
      sugg.innerHTML = suggestions().map((q) => `<button type="button" class="chip" data-q="${K().esc(q)}">${K().esc(q)}</button>`).join('');
      feed.scrollTop = feed.scrollHeight;
    };
    C.say = (text) => {
      text = text.trim();
      if (!text) return;
      C.msgs.push({ role: 'user', text });
      const r = ans(text);
      C.msgs.push(r ? { role: 'bot', ...r } : {
        role: 'bot', a: G("I don't have a quick answer for that one. Claude can answer it properly in your chat.", 'no answer'),
        acts: [{ label: G('Ask Claude'), ask: text }],
      });
      C.msgs = C.msgs.slice(-30);
      C.paint();
    };
    const act = async (x) => {
      if (x.href) location.hash = x.href;
      else if (x.fill !== undefined) { if (!K().fill(x.fill)) K().startExample(context().type, x.fill); K().toast(G('Scenario filled in. Press Create deliverable')); }
      else if (x.example) K().startExample(x.example[0], x.example[1]);
      else if (x.say) return C.say(x.say);
      else if (x.ask) { await K().ask(x.ask); location.hash = '#/chat'; C.msgs.push({ role: 'bot', a: G('Sent to Claude. The answer will appear in **Chat with Claude**.') }); }
      C.paint();
    };
    form.onsubmit = (e) => { e.preventDefault(); C.say(input.value); input.value = ''; };
    root.addEventListener('click', (e) => {
      const q = e.target.closest('[data-q]'); if (q) return C.say(q.dataset.q);
      const a = e.target.closest('[data-act]');
      if (a) { const [i, j] = a.dataset.act.split(':').map(Number); act([null, ...C.msgs][i].acts[j]); }
    });
    C.focus = () => input.focus();
    return C;
  }

  // Floating Guide
  let guide = null, open = false;
  try { open = sessionStorage.getItem('guide-open') === '1'; } catch {}
  function paint() {
    $('#guide header b').textContent = G('Guide'); $('#guide header span').textContent = G('Instant answers · no API key');
    $('#guide').hidden = !open;
    $('#guide-btn').classList.toggle('on', open);
    if (open && guide) guide.paint();
  }
  function toggle(on = !open) {
    open = on;
    try { sessionStorage.setItem('guide-open', on ? '1' : '0'); } catch {}
    paint();
    if (on && guide) setTimeout(guide.focus, 0);
  }
  function mount() {
    document.body.insertAdjacentHTML('beforeend', `
      <button class="guide-btn" id="guide-btn" aria-label="Open the guide" title="Guide · instant help (?)"><svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6.2" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M6.3 6.2a1.8 1.8 0 1 1 2.5 1.7c-.5.2-.8.6-.8 1.1v.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><circle cx="8" cy="11.4" r=".8" fill="currentColor"/></svg><span>Guide</span></button>
      <section class="guide" id="guide" role="dialog" aria-label="Guide" hidden>
        <header><b>Guide</b><span>Instant answers · no API key</span><button class="icon-btn" id="guide-close" aria-label="Close guide"><svg viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg></button></header>
      </section>`);
    $('#guide-btn').onclick = () => toggle();
    $('#guide-close').onclick = () => toggle(false);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && open) toggle(false);
      if (e.key !== '?' || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
      e.preventDefault(); toggle();
    });
    addEventListener('hashchange', () => setTimeout(paint, 50));
    const wait = setInterval(() => {
      if (!(K() && K().state.loaded)) return;
      clearInterval(wait);
      guide = makeChat($('#guide'), {
        intro: () => `${G('Hi', 'hi')}${K().state.profile.name ? ' ' + K().esc(K().state.profile.name.split(' ')[0]) : ''} ! ${G("I'm the guide. I answer instantly about the deliverables, the jargon and the app. For real work, Claude takes over in the chat.", 'intro')}`.replace(/^Hi(.*?) ! /, 'Hi$1! '),
        suggestions, answer, placeholder: 'Ask about a deliverable, a term, the app…',
      });
      paint();
    }, 100);
  }
  mount();

  // Xray assistant, embedded on the Xray tests page
  window.KitChat = {
    mountXray(el) {
      el.className = 'skill-chat';
      makeChat(el, {
        intro: () => G("I'm the **Xray assistant**. Ask me about Xray Cloud vs Server / Data Center, test types, Test Plans, importing tests or results, and import errors. When you're ready, a scenario above turns your stories or results into import files.", 'xray intro'),
        suggestions: () => (FRG() ? FRG().xraySugg : XRAY_SUGG),
        answer: (raw) => xrayAnswer(' ' + norm(raw) + ' ') || answer(raw),
        placeholder: 'Ask anything about Xray…',
      }).paint();
    },
    relang() { if (guide) guide.paint(); paint(); },
  };
})();
