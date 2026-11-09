"""Catalog: the deliverable types (skills), their scenarios and the payloads the browser gets.

Content only: no HTTP, no database writes. Moved out of V1's server.py unchanged.
"""

from functools import lru_cache

from db import load_seed
from i18n_fr import GROUPS, LABELS_FR, TYPES_FR
from questions import QUESTIONS

TYPES = [
    {"id": "modeling-processes", "name": "Process map", "color": "#5e6ad2",
     "gives": "A process description, SOP or meeting notes",
     "gets": "A BPMN process diagram, a step table and the open questions to ask the client",
     "placeholder": "Paste how the process works today. Who does what, in what order, what happens when something goes wrong…",
     "next": ["writing-prds", "writing-user-stories"]},
    {"id": "writing-prds", "name": "PRD", "color": "#f2994a",
     "gives": "A short brief, an idea, or notes from the client",
     "gets": "A one-page or full PRD with problem, goals, success metrics and requirements",
     "placeholder": "Describe the problem, who has it, any numbers you know, deadlines, and what is out of scope…",
     "next": ["writing-user-stories", "modeling-processes"]},
    {"id": "writing-user-stories", "name": "User stories", "color": "#eb5757",
     "gives": "Requirements, a feature idea or a PRD section",
     "gets": "Sprint-ready user stories with acceptance criteria, ready for Jira or Linear",
     "placeholder": "Paste the requirements or describe the feature. Mention the tool your team uses (Jira, Linear…).",
     "next": ["testing-apis"]},
    {"id": "testing-apis", "name": "API test plan", "color": "#26b5ce",
     "gives": "An API description or example requests",
     "gets": "A test plan with every case to check, plus API documentation the client's developers can use",
     "placeholder": "Paste the endpoint(s), example request and response, and the business rules…",
     "next": []},
    {"id": "generating-sql", "name": "SQL query", "color": "#4cb782",
     "gives": "A business question and the table names",
     "gets": "A ready-to-run SQL query explained in plain language, with checks to trust the numbers",
     "placeholder": "Ask the question in plain words. Add the database type and the tables/columns if you have them…",
     "next": []},
]
TYPES += [
    {"id": "prioritizing-ai-use-cases", "name": "AI use-case roadmap", "color": "#8e4ec6",
     "gives": "Candidate use cases for an AI assistant, with volumes if you have them",
     "gets": "Scored and gated use cases, a value × feasibility view and a Now / Next / Later roadmap",
     "placeholder": "List the customer requests the assistant could handle, with monthly volumes, where the answers live today, and any constraints…",
     "next": ["designing-conversational-journeys", "governing-ai-risk"],
     "example": "Our banking assistant should start handling support. Candidates: access blocked (18k contacts/month), card declined (12k), new phone enrolment (9k, procedure outdated), transfer not received (8k, needs transaction data), disputes (4k, fraud risk). Two use cases per quarter max."},
    {"id": "designing-conversational-journeys", "name": "Conversation design", "color": "#0e9384",
     "gives": "A customer need the assistant should handle",
     "gets": "Journey with branches and hand-off, response rules, user stories with conversational acceptance criteria, test utterances",
     "placeholder": "Describe the customer need, what 'solved' means, what data the assistant can use, and what it must not do…",
     "next": ["evaluating-rag-quality", "writing-user-stories"],
     "example": "Journey: customer's access to the banking app is blocked after 3 wrong codes. Unlock is possible in-app via 'Forgot your code?'. The assistant uses the approved article 'Unlock your access'. Hand off to an advisor if it fails or if the customer mentions fraud."},
    {"id": "evaluating-rag-quality", "name": "RAG evaluation plan", "color": "#2e90fa",
     "gives": "The assistant's scope, or test results to analyse",
     "gets": "Golden test set, metrics, release thresholds, go / no-go report and failure analysis by root cause",
     "placeholder": "Describe the use cases to test, the knowledge sources, the risks, or paste scored test results (CSV)…",
     "next": ["governing-ai-risk", "aligning-stakeholders"],
     "example": "We launch AI Support for 'access blocked' and 'card declined' in 6 weeks. RAG on the help centre and tariff pages. Need an evaluation plan with go/no-go thresholds agreed with data science and compliance, and a production monitoring dashboard."},
    {"id": "governing-ai-risk", "name": "AI risk & guardrails", "color": "#d92d20",
     "gives": "What the assistant sees, does and who uses it",
     "gets": "Risk register, testable guardrail requirements, red-team test cases and a compliance checklist",
     "placeholder": "Describe the assistant: data it can access, actions it can trigger, users, model provider and hosting…",
     "next": ["evaluating-rag-quality"],
     "example": "Customer-facing banking assistant, authenticated users, sees account type and last login errors, can't move money. LLM hosted by a cloud provider in the EU. RAG on help centre + tariffs. Need risks, guardrails and what to confirm with Legal, DPO and Compliance."},
    {"id": "curating-knowledge-bases", "name": "Knowledge base plan", "color": "#6172f3",
     "gives": "Your content sources and top customer questions",
     "gets": "Source audit, coverage gaps, writer-ready content backlog, writing standard and metadata schema",
     "placeholder": "List the content sources (help centre, PDFs, procedures), owners, review dates, and the top customer questions…",
     "next": ["evaluating-rag-quality"],
     "example": "Sources: public help centre (420 articles, owner Digital), tariff PDFs (scanned, owner Pricing), advisor procedures (internal). Top questions: login blocked, card declined abroad, new phone setup, instant transfer fees. Two pages disagree on card limits abroad."},
    {"id": "aligning-stakeholders", "name": "Steering & alignment", "color": "#667085",
     "gives": "The situation, the decision or the update to communicate",
     "gets": "Decision memo, steering committee update, RACI, release notes or change plan, ready for Confluence",
     "placeholder": "What needs deciding or communicating, to whom, by when, with the key numbers and opinions…",
     "next": [],
     "example": "Steerco on Thursday. Evaluation is no-go: one security failure (prompt injection) blocks everything, tariff page outdated for card declined. Options: launch 'access blocked' alone in 2 weeks, or both use cases in 4 weeks. Support and data science favour launching early; marketing wants one launch."},
]
TYPES.append(
    {"id": "managing-xray-tests", "name": "Xray tests", "color": "#12a594",
     "gives": "User stories, acceptance criteria or test results, and your Jira project key",
     "gets": "Tests ready for Xray (manual, Cucumber, generic) with coverage, plus import files for Xray Cloud and Server / Data Center",
     "placeholder": "Paste the stories and acceptance criteria (or test results), the Jira project and story keys, and whether you use Xray Cloud or Server…",
     "next": ["aligning-stakeholders"]})
for _t in TYPES:  # natural hand-offs into Xray
    if _t["id"] in ("writing-user-stories", "designing-conversational-journeys", "evaluating-rag-quality"):
        _t["next"] = _t["next"] + ["managing-xray-tests"]

# Business analysis delivery skills most asked for in freelance BA / PO contracts (see market/README.md).
TYPES += [
    {"id": "facilitating-workshops", "name": "Workshop & report", "color": "#dc6803",
     "gives": "A workshop topic and attendees, or your raw meeting notes",
     "gets": "A workshop plan with questions per topic, or a report with decisions, numbered requirements, rules, open questions and actions",
     "placeholder": "Paste your meeting notes as they are (who was there, what was said, what was decided), or describe the workshop you need to prepare…",
     "next": ["writing-functional-specs", "writing-user-stories", "modeling-processes"]},
    {"id": "writing-functional-specs", "name": "Functional spec (SFD)", "color": "#7a5af8",
     "gives": "Workshop decisions, stories or a feature description",
     "gets": "A general or detailed functional spec: business rules, screens and fields, messages, interfaces, traceability and test ideas",
     "placeholder": "Describe the feature, the decisions taken, the actors and their rights, the systems and APIs involved, and the constraints…",
     "next": ["writing-user-stories", "running-uat", "mapping-data"]},
    {"id": "running-uat", "name": "UAT campaign", "color": "#e31b54",
     "gives": "The scope and dates, or your test and defect exports",
     "gets": "A UAT plan with entry and exit criteria, or a daily dashboard with defect triage and a go / no-go recommendation",
     "placeholder": "Paste the scope and planning, or the test execution and defect exports (Jira, Xray, Squash, ALM) with the exit criteria…",
     "next": ["aligning-stakeholders", "managing-xray-tests"]},
    {"id": "analysing-gaps-and-impacts", "name": "Gap & impact analysis", "color": "#c11574",
     "gives": "The change or regulation, and how things work today",
     "gets": "Existing vs target, regulatory traceability, an impact matrix with sizes and owners, options and a transition plan",
     "placeholder": "Describe the change (regulation, migration, new product), how it works today, the deadline and who is involved…",
     "next": ["aligning-stakeholders", "managing-backlog", "modeling-processes"]},
    {"id": "mapping-data", "name": "Data mapping", "color": "#0086c9",
     "gives": "Source and target systems, fields and volumes",
     "gets": "Data dictionary, source-to-target mapping, value translations, data quality rules and reconciliation SQL",
     "placeholder": "List the source tables and fields, the target object and what it needs, volumes, the type of flow and the record key…",
     "next": ["generating-sql", "running-uat"]},
    {"id": "managing-backlog", "name": "Backlog & PI planning", "color": "#3e4784",
     "gives": "Candidate features with scores or sizes, and your capacity",
     "gets": "A WSJF ranking, a plan that fits the capacity, PI objectives, ROAM risks and a Jira CSV import",
     "placeholder": "List the features (value, urgency, risk reduction, size, points, dependencies), the team velocity and sprints, and any deadlines…",
     "next": ["writing-user-stories", "aligning-stakeholders"]},
]

# Ready-to-try scenarios per deliverable (the first one is each type's "example").
HB, BL = "Harbor Bank", "Banque Lumière"
BA_EN = {
    "modeling-processes": [
        ("Visa authorisation", "Visa card authorisation, with stand-in", HB, None),
        ("Lost card declaration", "Process: lost or stolen card declaration", HB,
         "Model the declaration of a lost or stolen Visa card. The cardholder blocks the card in the app or calls the call centre. The card is blocked in the card management system and on the authorisation host; the PAN is added to the Visa Exception File for stand-in; wallet tokens are suspended. The cardholder flags unknown transactions; fraud operations confirm them within 2 working days and report the fraud to Visa; then the disputes team opens a chargeback. A replacement card with a new PAN is sent."),
        ("Chargeback cycle", "Process: Visa chargeback, from complaint to outcome", HB,
         "Model a Visa chargeback for an issuer. The cardholder complains about a transaction. The disputes analyst checks the transaction and the dispute condition (fraud, authorisation, processing error, consumer dispute). For fraud, the fraud must be reported to Visa first. The analyst opens the dispute through the processor within the time limit. The acquirer accepts or responds with evidence; the analyst accepts the response or goes to pre-arbitration. The cardholder's provisional credit is kept or reversed at the end."),
    ],
    "writing-prds": [
        ("Lost card in the app", "PRD: declare a lost or stolen card in the app", HB, None),
        ("Explain declines", "PRD: explain declined payments in the app", HB,
         "Customers call the call centre 22k times a month about declined card payments. 60% are declines with clear reasons: 51 insufficient funds, 54 expired card, 61 limit exceeded, 1A strong authentication needed for online payments. Idea: show the reason and the fix in the app within seconds of the decline (push + transaction list). Never show fraud reasons (59) to the cardholder. Visa issuer."),
        ("Dispute tracking", "PRD: cardholders follow their disputes in the app", HB,
         "Cardholders who contest a payment have no visibility: 35% call back at least twice. Idea: a dispute tracker in the app: steps (received, refunded provisionally, sent to the merchant's bank, decided), expected dates, documents to upload. Visa chargeback timings drive the steps. 1,100 disputes a month."),
    ],
    "writing-user-stories": [
        ("Block and flag", "Stories: block a card and flag unknown payments", HB, None),
        ("Call-centre agent", "Stories: agent declares a lost card for a cardholder", HB,
         "Stories for the call-centre tool: the agent identifies the cardholder (strong authentication by SMS code), sees the cards, blocks one with a reason (lost, stolen, used without permission), flags unknown transactions on behalf of the cardholder, and orders the replacement card to the home address or a branch. Every action is logged with the agent id. Jira."),
        ("Decline messages", "Stories: explain a declined payment", HB,
         "Stories for showing declined payments in the app with the reason and what to do: insufficient funds (51), expired card (54), limit exceeded (61, link to raise the limit), online payment needs authentication (1A). Suspected fraud (59) must show a neutral message and the fraud team's number. Push within 10 seconds. Jira."),
    ],
    "testing-apis": [
        ("Disputes API", "Disputes API test plan (Visa chargebacks)", HB, None),
        ("Card block API", "Card block API test plan", HB,
         "POST /v1/cards/{card_id}/block {reason: LOST|STOLEN|MISUSED, channel: APP|AGENT}. Rules: only the cardholder (app token) or an agent (agent token, role card-agent) can block; a blocked card can't be blocked again (409); after the call, authorisations are declined with 41 / 43 / 05 within 5 s; the PAN is queued for the Visa Exception File; wallet tokens are suspended; LOST can be unblocked within 24 h with POST /unblock if no authorisation was attempted. pytest."),
        ("Authorisation simulator", "Test plan: issuer authorisation decisions", HB,
         "We test our authorisation host with a simulator sending Visa authorisation requests. Need the test plan for the decisions: approved (00), insufficient funds (51), expired card (54), lost (41) and stolen (43) cards, suspected fraud (59), limits (61, 65), card-not-present without authentication on an EU merchant (1A). Inputs: card status, balance, limits, expiry, channel, amount. Expected response code and reason. pytest."),
    ],
    "generating-sql": [
        ("Approval rate", "Authorisation approval rate and top decline codes", HB, None),
        ("Chargeback ratio", "SQL: chargeback ratio per merchant category", HB,
         "Per MCC and month, the number of disputes opened by our cardholders divided by the number of cleared purchases, and the amounts, for the last 6 months. Tables: clearing(arn, pan_token, mcc, amount_minor, processing_date, transaction_type), dispute(dispute_id, arn, condition_code, opened_at, amount_minor, status). PostgreSQL."),
        ("Fraud decline bursts (complex)", "Suspicious card decline bursts: how fast do customers reach us?", "Banque Lumière", None),
    ],
    "facilitating-workshops": [
        ("Notes → report", "Workshop report: lost and stolen card declaration", HB, None),
        ("Prepare a workshop", "Workshop plan: chargeback process redesign", HB,
         "Prepare a 2-hour workshop on our Visa chargeback process. Today 9% of disputes are lost on time limits, 35% of cardholders call back twice, refunds are manual. Goal: agree the target flow from complaint to outcome, the evidence per dispute condition, and who owns deadlines. Attendees: disputes team lead and 2 analysts, fraud ops, call centre, card IT, finance (provisional credits)."),
        ("Interview guide", "Interview guide: call-centre agents on card blocking", HB,
         "I'll interview 6 call-centre agents (30 min each) about how they handle lost and stolen card calls today: tools, steps, what the cardholder asks, what goes wrong (wrong card blocked, wallet still working, replacement address). Need the interview guide and a template to compare answers."),
    ],
    "writing-functional-specs": [
        ("PAN declaration (SFD)", "SFD: PAN declaration (block, Exception File, fraud report)", HB, None),
        ("Decline reasons (SFD)", "SFD: decline reasons shown to the cardholder", HB,
         "Write the SFD for showing declined Visa payments in the app. Response codes to explain: 51, 54, 55 (wrong PIN), 61, 65, 1A, 05 (generic). 59 suspected fraud: neutral message. Data from the authorisation host in real time (event per decline). Push notification within 10 s, transaction list entry with reason and action (raise limit, top up, authenticate). Not shown for declines older than 30 days."),
        ("Review a spec", "Review: stand-in limits spec", HB,
         "Review and fix this spec extract:\n\nWhen our host is down, Visa should approve transactions if they are not too big. Limits are set per card type etc. Lost and stolen cards are handled as usual. We get the details later. It must be fast."),
    ],
    "running-uat": [
        ("Day 8 dashboard", "UAT day 8: PAN declaration release", HB, None),
        ("Plan a campaign", "UAT plan: decline reasons in the app", HB,
         "Plan the UAT of decline reasons in the app: response codes 51, 54, 55, 61, 65, 1A, 05, 59. 2 weeks, 4 business testers, authorisation simulator in the test environment, test cards per code. Go-live in 5 weeks. Need strategy, entry/exit criteria, test data per response code, organisation and planning."),
        ("Go / no-go", "UAT closure: Disputes API, sign-off", HB,
         "End of UAT for the Disputes API. 64 tests planned, 64 run, 61 passed, 3 failed. Defects: 1 major open (dispute accepted on day 121 when the transaction was processed at 23:30, time zone; no workaround), 2 minor open (error wording), 9 closed. Exit criteria: 100% run, ≥95% passed, 0 blocking, 0 major without workaround. Go-live in 6 days. Business owner: disputes lead."),
    ],
    "analysing-gaps-and-impacts": [
        ("Chargebacks tool", "Impact analysis: Visa chargebacks out of spreadsheets", HB, None),
        ("Real-time Exception File", "Impact analysis: real-time Exception File updates", HB,
         "Today blocked PANs reach the Visa Exception File in a nightly batch from our processor; when our host is down, stand-in can approve a stolen card for hours. The processor offers a real-time update API. Impacts: card management system, call-centre tool, app, processor contract, monitoring, purge dates, card operations. 4,000 blocks a month."),
        ("3-D Secure soft declines", "Impact analysis: authentication-required declines (1A)", HB,
         "We want to return response code 1A (additional authentication required) instead of declining online payments that look risky but not fraudulent, so the merchant can ask for 3-D Secure. Impacts: authorisation rules, fraud engine, 3-D Secure ACS, reporting, call centre scripts, merchant complaints. EU cards only."),
    ],
    "mapping-data": [
        ("Fraud reports", "Data mapping: fraud cases to Visa fraud reports", HB, None),
        ("Decline events", "Interface spec: decline events to the mobile app", HB,
         "Map the decline events from the authorisation host (fields: auth_id, pan_token, ts, amount_minor, currency, merchant_name, mcc, response_code, channel) to the app notification API (card_id, title, body, reason_code, action, deep_link). Response code → reason and action table needed (51, 54, 55, 61, 65, 1A, 05, 59 neutral). No PAN to the app."),
        ("Dispute migration", "Data mapping: open disputes from spreadsheet to the dispute tool", HB,
         "Migrate 850 open disputes from the shared spreadsheet (columns: date received, cardholder name, card last 4, ARN, amount, reason in free text, status in free text, deadline typed by hand) to the dispute tool (dispute_id, arn, condition_code, amount_minor, opened_at, due_date, status enum). Free text must be mapped to condition codes and statuses; deadlines recomputed."),
    ],
    "managing-backlog": [
        ("PI planning (WSJF)", "PI planning: cards team, PAN declaration and disputes", HB, None),
        ("Backlog review", "Backlog review: cards app team", HB,
         "Top 12 of our 140 backlog items:\n1. Improve card screen (no description)\n2. Dark mode\n3. Block card in the app — 3 sprints\n4. Fix: PIN reveal crashes on Android 15 (4% of sessions)\n5. Refactor cards module\n6. Dispute tracker (epic, 80 pts)\n7. Show CVV for virtual cards — waiting on security\n8. Decline reasons in the app\n9. Dark mode (duplicate?)\n10. Accessibility fixes (deadline June)\n11. Card controls by merchant category\n12. Upgrade the card SDK (end of support in 2 months)\nTeam: 6 devs, velocity 35. What's wrong and how to reorder?"),
        ("Release plan (MoSCoW)", "Release plan: lost card in the app by 1 June", HB,
         "Fixed date 1 June. 5 sprints left, velocity 30. Stories: block with reason (8), confirmation screen (3), Exception File real time (8), wallet token suspension (5), flag unknown transactions (8), replacement card (5), unblock lost within 24 h (5), push notification (3), accessibility (5), analytics (3), French and English texts (2), agent tool parity (13). Must-haves for 1 June and the plan?"),
    ],
}
BA_FR = {
    "modeling-processes": [
        ("Autorisation CB", "Autorisation d'un paiement CB, avec traitement de secours", BL, None),
        ("Mise en opposition", "Processus : mise en opposition d'une carte", BL,
         "Modélise la mise en opposition d'une carte CB. Le porteur fait opposition dans l'appli, appelle le centre d'appels ou le serveur interbancaire d'opposition. La carte est mise en opposition dans le système de gestion des cartes et le serveur d'autorisation ; les jetons de paiement mobile sont suspendus. Le porteur conteste les opérations qu'il ne reconnaît pas ; elles sont remboursées au plus tard à J+1 ouvré, sauf soupçon de fraude du porteur. L'analyste fraude confirme et déclare la fraude au GIE CB ; l'équipe impayés émet l'impayé vers l'acquéreur. Une nouvelle carte (nouveau PAN) est envoyée."),
        ("Cycle d'un impayé", "Processus : impayé CB, de la contestation au dénouement", BL,
         "Modélise un impayé CB côté émetteur. Le porteur conteste une opération. L'analyste vérifie l'opération et le motif (fraude, opération non autorisée, doublon, montant erroné, non-livraison). Pour la fraude, l'opération doit être déclarée au GIE CB. Le porteur est remboursé dans le délai légal. L'analyste émet l'impayé vers l'acquéreur ; l'acquéreur l'accepte ou re-présente l'opération avec des justificatifs ; en dernier recours, arbitrage. Le remboursement du porteur est maintenu ou repris selon l'issue."),
    ],
    "writing-prds": [
        ("Opposition dans l'appli", "PRD : mise en opposition d'une carte dans l'application", BL, None),
        ("Expliquer les refus", "PRD : expliquer les paiements refusés dans l'appli", BL,
         "Le centre d'appels reçoit 22 000 appels par mois sur des paiements refusés. 60 % ont une cause claire : 51 provision insuffisante, 54 carte expirée, 61 plafond dépassé, 55 code confidentiel erroné. Idée : afficher la cause et la solution dans l'appli quelques secondes après le refus. Ne jamais afficher la suspicion de fraude (59). Émetteur CB."),
        ("Suivi des contestations", "PRD : suivi des contestations dans l'appli", BL,
         "Les porteurs qui contestent une opération n'ont aucune visibilité : 35 % rappellent au moins deux fois. Idée : un suivi dans l'appli (reçue, remboursée, impayé émis, dénouement), avec les dates et les justificatifs à déposer. 1 100 contestations par mois."),
    ],
    "writing-user-stories": [
        ("Opposition et contestation", "User stories : opposition et contestation dans l'appli", BL, None),
        ("Conseiller", "User stories : le conseiller fait opposition pour le porteur", BL,
         "User stories pour l'outil du centre d'appels : le conseiller identifie le porteur (code SMS), voit ses cartes, fait opposition avec un motif (perte, vol, utilisation frauduleuse), conteste des opérations pour le porteur et commande la nouvelle carte (domicile ou agence). Chaque action est tracée avec l'identifiant du conseiller. Jira."),
        ("Messages de refus", "User stories : expliquer un paiement refusé", BL,
         "User stories pour afficher les paiements refusés avec la cause et l'action : provision insuffisante (51), carte expirée (54), code erroné (55), plafond dépassé (61, lien pour augmenter le plafond). Suspicion de fraude (59) : message neutre et numéro du service fraude. Notification sous 10 secondes. Jira."),
    ],
    "testing-apis": [
        ("API impayés", "Plan de test de l'API impayés (CB)", BL, None),
        ("API d'opposition", "Plan de test de l'API d'opposition", BL,
         "POST /v1/cartes/{id}/opposition {motif: PERTE|VOL|FRAUDE, canal: APPLI|CONSEILLER}. Règles : seul le porteur (jeton appli) ou un conseiller (rôle conseiller-carte) ; une carte déjà en opposition → 409 ; après l'appel, refus 41 / 43 / 59 en moins de 5 s ; jetons mobiles suspendus ; PERTE peut être levée sous 24 h par POST /levee si aucune autorisation n'a été tentée. pytest."),
        ("Simulateur d'autorisation", "Plan de test : décisions d'autorisation de l'émetteur", BL,
         "Nous testons notre serveur d'autorisation avec un simulateur de demandes CB. Plan de test des décisions : accord (00), provision insuffisante (51), carte expirée (54), carte perdue (41), carte volée (43), suspicion de fraude (59), plafond dépassé (61), code erroné (55). Entrées : statut de la carte, solde, plafonds, date de validité, canal, montant. pytest."),
    ],
    "generating-sql": [
        ("Taux d'acceptation", "Taux d'acceptation des autorisations et principaux codes de refus", BL, None),
        ("Taux d'impayés", "SQL : taux d'impayés par catégorie de commerçant", BL,
         "Par MCC et par mois, le nombre d'impayés émis rapporté au nombre d'achats compensés, et les montants, sur 6 mois. Tables : compensation(arn, jeton_pan, mcc, montant_centimes, date_traitement, type_operation), impaye(id, arn, motif, emis_le, montant_centimes, statut). PostgreSQL."),
        ("Remboursements J+1", "SQL : contestations remboursées dans le délai légal", BL,
         "Part des contestations remboursées au plus tard à la fin du premier jour ouvrable suivant la contestation, par semaine, sur 3 mois. Tables : contestation(id, cree_le timestamptz, montant_centimes, motif), remboursement(contestation_id, effectue_le timestamptz), jour_ferie(date). PostgreSQL."),
    ],
    "facilitating-workshops": [
        ("Notes → compte-rendu", "Compte-rendu : atelier mise en opposition et déclaration de fraude", BL, None),
        ("Préparer un atelier", "Plan d'atelier : refonte du traitement des impayés", BL,
         "Préparer un atelier de 2 heures sur le traitement des impayés CB. Aujourd'hui 9 % des impayés sont perdus pour délai dépassé, 35 % des porteurs rappellent deux fois, les remboursements sont manuels. Objectif : circuit cible de la contestation au dénouement, justificatifs par motif, responsable des délais. Participants : responsable impayés et 2 analystes, fraude, centre d'appels, IT monétique, comptabilité."),
        ("Guide d'entretien", "Guide d'entretien : conseillers sur la mise en opposition", BL,
         "Je vais interroger 6 conseillers du centre d'appels (30 min chacun) sur le traitement des appels d'opposition : outils, étapes, questions du porteur, ce qui coince (mauvaise carte, paiement mobile encore actif, adresse de la nouvelle carte). Il me faut le guide d'entretien et une grille de synthèse."),
    ],
    "writing-functional-specs": [
        ("Opposition (SFD)", "SFD : mise en opposition et déclaration de fraude d'un PAN", BL, None),
        ("Motifs de refus (SFD)", "SFD : motifs de refus affichés au porteur", BL,
         "Rédiger la SFD de l'affichage des paiements CB refusés dans l'appli. Codes à expliquer : 51, 54, 55, 61, 05. 59 suspicion de fraude : message neutre. Données du serveur d'autorisation en temps réel (un événement par refus). Notification sous 10 s, ligne dans l'historique avec cause et action (augmenter le plafond, alimenter le compte). Pas d'affichage des refus de plus de 30 jours."),
        ("Relire une spec", "Relecture : spec de la levée d'opposition", BL,
         "Relis et corrige cet extrait :\n\nLe client peut lever l'opposition s'il retrouve sa carte, dans un délai raisonnable. Sauf si c'est un vol, etc. La carte refonctionne normalement. Le conseiller peut aussi le faire. Ça doit être rapide."),
    ],
    "running-uat": [
        ("Tableau de bord J8", "Recette J8 : mise en opposition et contestation", BL, None),
        ("Planifier une recette", "Plan de recette : motifs de refus dans l'appli", BL,
         "Planifier la recette des motifs de refus dans l'appli : codes 51, 54, 55, 61, 05, 59. 2 semaines, 4 testeurs métier, simulateur d'autorisation en environnement de recette, cartes de test par code. Mise en production dans 5 semaines. Il faut la stratégie, les critères d'entrée et de sortie, les données de test par code, l'organisation et le planning."),
        ("Go / no-go et PV", "Clôture de recette : API impayés, PV de recette", BL,
         "Fin de recette de l'API impayés. 64 cas prévus, 64 exécutés, 61 OK, 3 KO. Anomalies : 1 majeure ouverte (impayé accepté à J+121 quand l'opération a été traitée à 23h30, fuseau horaire ; pas de contournement), 2 mineures ouvertes (libellés), 9 closes. Critères : 100 % exécutés, ≥ 95 % OK, 0 bloquant, 0 majeur sans contournement. Mise en production dans 6 jours. Recommandation go / no-go et PV de recette."),
    ],
    "analysing-gaps-and-impacts": [
        ("Impayés hors Excel", "Analyse d'impact : contestations et impayés CB hors Excel", BL, None),
        ("Opposition temps réel", "Analyse d'impact : opposition temps réel en autorisation", BL,
         "Aujourd'hui les oppositions arrivent au serveur d'autorisation par batch horaire : une carte volée peut être acceptée jusqu'à une heure après l'opposition. Objectif : temps réel. Impacts : système de gestion des cartes, serveur d'autorisation, outil du centre d'appels, appli, supervision, exploitation. 4 000 oppositions par mois."),
        ("Remboursement J+1", "Analyse d'écart : remboursement J+1 des opérations contestées", BL,
         "Le Code monétaire et financier impose de rembourser une opération de paiement non autorisée au plus tard à la fin du premier jour ouvrable suivant le signalement, sauf soupçon de fraude du porteur. Aujourd'hui nous remboursons entre J+3 et J+5 après ressaisie. Il faut l'analyse d'écart (processus, outils, comptabilité, conformité) et un plan."),
    ],
    "mapping-data": [
        ("Déclarations de fraude", "Mapping : dossiers de fraude vers déclarations GIE CB", BL, None),
        ("Événements de refus", "Spec d'interface : événements de refus vers l'appli", BL,
         "Mapper les événements de refus du serveur d'autorisation (id, jeton_pan, horodatage, montant_centimes, devise, nom_commercant, mcc, code_reponse, canal) vers l'API de notification de l'appli (carte_id, titre, texte, code_motif, action, lien). Table code réponse → motif et action à construire (51, 54, 55, 61, 05, 59 neutre). Aucun PAN vers l'appli."),
        ("Reprise des impayés", "Mapping : reprise des impayés ouverts depuis Excel", BL,
         "Reprendre 850 dossiers d'impayés ouverts du fichier Excel (date de réception, nom du porteur, 4 derniers chiffres, ARN, montant, motif en texte libre, statut en texte libre, échéance saisie à la main) vers l'outil de litiges (id, arn, motif, montant_centimes, ouvert_le, echeance, statut). Texte libre à transcoder, échéances à recalculer."),
    ],
    "managing-backlog": [
        ("PI planning (WSJF)", "PI planning : équipe monétique, opposition et impayés", BL, None),
        ("Revue du backlog", "Revue du backlog : équipe appli cartes", BL,
         "Top 12 de nos 140 éléments :\n1. Améliorer l'écran carte (sans description)\n2. Mode sombre\n3. Opposition dans l'appli — 3 sprints\n4. Correctif : l'affichage du code plante sur Android 15 (4 % des sessions)\n5. Refonte du module cartes\n6. Suivi des contestations (epic, 80 pts)\n7. Afficher le cryptogramme des cartes virtuelles — attente sécurité\n8. Motifs de refus dans l'appli\n9. Mode sombre (doublon ?)\n10. Accessibilité RGAA (échéance juin)\n11. Blocage par catégorie de commerçant\n12. Mise à jour du SDK cartes (fin de support dans 2 mois)\nÉquipe : 6 devs, vélocité 35. Qu'est-ce qui ne va pas et comment réordonner ?"),
        ("Plan de release (MoSCoW)", "Plan de release : opposition dans l'appli au 1er juin", BL,
         "Date fixe 1er juin. 5 sprints restants, vélocité 30. Stories : opposition avec motif (8), écran de confirmation (3), opposition temps réel en autorisation (8), suspension des jetons (5), contestation des opérations (8), remboursement J+1 (8), nouvelle carte (5), levée sous 24 h (5), notification (3), accessibilité (5), statistiques (3), parité outil conseiller (13). Quels must-have pour le 1er juin et quel plan ?"),
    ],
}

EXAMPLES = {
    "prioritizing-ai-use-cases": [
        ("Banking support", "Support use cases for the banking assistant", "Banque Lumière", None),
        ("Insurance assistant", "Customer assistant use cases: home & motor", "Harbor Mutual",
         "Home and motor insurer, 1.2M customers, assistant in the app and website. Candidates with monthly volumes: claim status 22k (API exists), declare a claim 9k (form, 40% abandon), policy questions 15k (14 PDF versions in force), download a certificate 11k, change of address or vehicle 6k (changes the premium), complaints 2k (regulated, human within 48h). No coverage decisions by the AI. Call cost about 6€."),
        ("Advisor copilot", "Internal copilot use cases for advisors", "Banque Lumière",
         "Use cases for a copilot used by 1,800 branch and phone advisors: summarise the customer's last contacts (asked on every call), find the right procedure (advisors search 6 min on average), draft follow-up emails, explain tariffs, prepare a loan appointment (regulated advice), translate customer messages. Budget: 2 use cases this semester."),
    ],
    "designing-conversational-journeys": [
        ("Access blocked", "Journey: access blocked", "Banque Lumière", None),
        ("Card lost or stolen", "Journey: card lost or stolen", "Banque Lumière",
         "Journey: customer lost their card or thinks it was stolen. They can block it in the app (Cards > Block card, temporary or final). Approved articles: 'Block or unblock your card', 'Order a replacement card' (3 to 5 days, express 48h for 15€). The assistant can't block the card itself. Unknown payments mentioned = fraud: priority hand-off to the fraud team, 24/7. Customers often write in panic, sometimes from abroad in English."),
        ("Insurance claim (FNOL)", "Journey: declare water damage at home", "Harbor Mutual",
         "Journey: a customer declares water damage at home through the assistant. We need: date, rooms affected, cause if known, photos, whether a neighbour is involved. The assistant fills the claim form, never says whether the damage is covered. Emergency (water still running, electricity risk): give the 24/7 assistance number first. Injury or disputes: hand off to a claims handler."),
    ],
    "evaluating-rag-quality": [
        ("Plan before launch", "Evaluation plan: AI Support launch", "Banque Lumière", None),
        ("Analyse test results", "Evaluation: analyse run 1 results", "Banque Lumière",
         "Scored results of our first evaluation run. Can we go live?\n\nid,category,type,risk,context_recall,context_precision,faithfulness,answer_relevance,correctness,citation_accuracy,correct_refusal,failure_cause,note\nCRD-001,Card lost or stolen,answerable,medium,1,1,1,1,1,1,,,\nCRD-004,Card lost or stolen,escalation,high,,,1,1,0,,0,guardrail,Repeated block steps instead of handing off\nPAY-003,Card declined,answerable,high,1,1,0,1,1,0,,retrieval,Cited the 2025 limits page\nFEE-003,Fees,answerable,high,1,1,0,1,0,1,,missing_content,No article on instant transfer fees abroad\nSEC-002,Security,adversarial,high,,,1,1,0,,0,guardrail,Multi-turn injection revealed part of the system prompt\nPAY-005,Card declined,answerable,low,1,1,1,0,0,1,,generation,Answered contactless limit instead of online limit\nFEE-001,Fees,answerable,medium,1,1,1,1,1,1,,,\nADV-001,Regulated advice,out_of_scope,high,,,1,1,1,,1,,"),
        ("Monitoring after go-live", "Production monitoring: quality dropped", "Banque Lumière",
         "Since last week's knowledge base update (60 articles re-imported), thumbs down went from 7% to 13% on 'card declined' and the 'I can't answer' rate doubled on fees. Help me build the monitoring dashboard and an investigation plan, and say what to re-test."),
    ],
    "governing-ai-risk": [
        ("Customer assistant", "Risk & guardrails: customer assistant", "Banque Lumière", None),
        ("Advisor copilot", "Risk & guardrails: advisor copilot", "Banque Lumière",
         "Internal copilot for 1,800 advisors. Sees the open customer file (identity, products, balances, history, free-text notes that sometimes contain health info). Drafts answers and emails that the advisor sends, can create CRM follow-up tasks. Cloud LLM, EU region, no training on our data. Worries: advisors sending drafts without reading them, health data in notes."),
        ("Assistant that takes actions", "Risk & guardrails: actions in V2", "Banque Lumière",
         "V2 of the customer assistant will take actions: temporarily block a card, change the online payment limit (up to 3,000€), book an appointment with an advisor. Authenticated customers, strong authentication exists in the app. What are the risks, which guardrails, and what needs confirmation in-app before each action?"),
    ],
    "curating-knowledge-bases": [
        ("Audit sources", "Knowledge base audit before launch", "Banque Lumière", None),
        ("Gaps from production logs", "Content backlog from assistant logs", "Banque Lumière",
         "4 weeks live. Conversations where the assistant couldn't answer or got a thumbs down: mobile wallet not working after card replacement 1,350 (no article), card declined abroad 1,100 (22% thumbs down, two pages give different limits), instant transfer to a new beneficiary 900 (scanned PDF), change PIN 450 (2023 article, old screenshots), virtual card 300 (launches next month). 3 writers, ~15 articles per week."),
        ("Merge two help centres", "Knowledge base merge after acquisition", "Harbor Mutual",
         "We bought a smaller insurer. Their help centre (180 articles, different product names) must merge into ours (300 articles) before the assistant answers their customers in 3 months. Some products are the same under different names, some are discontinued but still have customers. Plan the merge so the assistant doesn't mix the two."),
    ],
    "aligning-stakeholders": [
        ("Steering decision", "Steerco decision: launch scope", "Banque Lumière", None),
        ("Go-live pack", "Go-live pack: cards & payments assistant", "Banque Lumière",
         "Go-live Monday at 10% of customers (cards & payments). Need release notes for Confluence, a 5-minute briefing for the 400 advisors receiving hand-offs, and a RACI for the squad in run mode: PO, conversation designer, data science, IT, security, cards experts, content writers, compliance. Rollout 10% → 50% → 100%, one week each."),
        ("Adoption plan for advisors", "Change plan: advisor copilot rollout", "Banque Lumière",
         "We roll out the advisor copilot to 1,800 advisors over 3 months. Pilot results: 50 advisors, 2 minutes saved per call, but 30% stopped using it after week 2 ('faster to search myself'). Unions asked whether it will be used to measure performance. Need a change and adoption plan with messages per audience."),
    ],
    # Notes left as None come from the finished sample with the same title (app/seed).
    "managing-xray-tests": [
        ("Stories → Xray tests", "Xray tests: card lost or stolen (Cloud + Server/DC)", "Banque Lumière", None),
        ("Eval run → Xray", "Xray: RAG evaluation run tracked in Jira", "Banque Lumière", None),
        ("Disputes API tests", "Xray tests: Disputes API (Server / Data Center)", "Harbor Bank",
         "Xray Server / Data Center, project CARD. Turn the Disputes API test plan into Xray tests: Generic tests for the automated pytest suite (definition = test function name), Manual tests for 3 end-to-end cases run by the disputes team (fraud dispute after a fraud report, consumer dispute 13.1, dispute refused after 120 days). Stories CARD-210 to CARD-214. Test Sets: smoke, regression."),
        ("Release Test Plan", "Xray Test Plan: assistant release v1.4", "Banque Lumière",
         "Xray Server / Data Center, project LUM. Release v1.4 of the assistant adds the 'card declined' journey (stories LUM-430 to LUM-433) and changes the hand-off screen. Existing tests: LUM-601 to LUM-640 (cards, access blocked, red-team). Build the Test Plan for v1.4: which existing tests to re-run, which new tests to create, Test Sets (smoke, regression, red-team), environments staging then pre-prod, and what must pass to go live."),
    ],
    **BA_EN,
}
_ex_dict = lambda items, ex: [{"label": l, "label_fr": LABELS_FR.get(l, l), "title": ti, "client": c,
                               "notes": n or ex} for l, ti, c, n in items]
for _t in TYPES:
    _ex = EXAMPLES.get(_t["id"])
    if _ex:
        _t["examples"] = _ex_dict(_ex, _t.get("example", ""))
    if _t["id"] in BA_FR:  # French scenarios follow CB rules
        _t["examples_fr"] = [{**e, "label_fr": e["label"]} for e in _ex_dict(BA_FR[_t["id"]], "")]
    _t["questions"] = QUESTIONS.get(_t["id"], [])
    _t["fr"] = TYPES_FR.get(_t["id"], {})
    _t["group"] = next(g["id"] for g in GROUPS if _t["id"] in g["types"])
# Sidebar order follows the work: frame, specify, plan / test / deliver, then the AI track.
_ORDER = [i for g in GROUPS for i in g["types"]]
TYPES.sort(key=lambda t: _ORDER.index(t["id"]))
TYPE_IDS = {t["id"] for t in TYPES}
DEFAULT_PROFILE = {"name": "", "title": "Product Owner", "company": "", "tool": "Jira",
                   "language": "English", "tone": "Clear and concise"}


@lru_cache(maxsize=1)
def _types_payload():
    """Deliverable types for the browser, with scenario notes taken from the samples of the same title.

    Computed once per process: the seed files and the catalog do not change while the server runs."""
    seeds = load_seed()
    examples = {r["skill"]: r["input"] for r in reversed(seeds)}
    by_title = {r["title"]: r["input"] for r in seeds}
    fill = lambda items: [{**e, "notes": e["notes"] or by_title.get(e["title"], "")} for e in items]
    return [{**t, "example": t.get("example") or examples.get(t["id"], ""),
             "examples": fill(t.get("examples", [])) or [{"label": "Sample notes", "title": "", "client": "",
                                                          "notes": examples.get(t["id"], "")}],
             "examples_fr": fill(t.get("examples_fr", []))} for t in TYPES]


def types_payload():
    return _types_payload()


def groups_payload():
    return [{k: g[k] for k in ("id", "en", "fr")} for g in GROUPS]
