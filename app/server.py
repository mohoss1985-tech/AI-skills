"""Analyst Kit: request a deliverable, Claude (in your chat session) writes it, you hand it to the client.

Stdlib HTTP server + SQLite. No API key: requests and chat messages wait in the
database until Claude picks them up through kit.py and writes back.
"""

import json
import re
import sqlite3
import threading
import time
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from i18n_fr import GROUPS, LABELS_FR, TYPES_FR
from templates import TEMPLATES

ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
DB_PATH = ROOT / "data" / "kit.db"
PORT = 4317

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
        ("Disputes API tests", "Xray tests: disputes API (Server / Data Center)", "Hexa card scheme",
         "Xray Server / Data Center, project HEX. Turn the disputes API test plan into Xray tests: Generic tests for the automated pytest suite (definition = test function name), Manual tests for the 4 end-to-end cases run with pilot members on the certification platform (issuer opens, acquirer represents, issuer escalates, scheme arbitrates). Stories HEX-210 to HEX-214. Test Sets: smoke, regression. Test Plan for the 1 March release."),
        ("Release Test Plan", "Xray Test Plan: assistant release v1.4", "Banque Lumière",
         "Xray Server / Data Center, project LUM. Release v1.4 of the assistant adds the 'card declined' journey (stories LUM-430 to LUM-433) and changes the hand-off screen. Existing tests: LUM-601 to LUM-640 (cards, access blocked, red-team). Build the Test Plan for v1.4: which existing tests to re-run, which new tests to create, Test Sets (smoke, regression, red-team), environments staging then pre-prod, and what must pass to go live."),
    ],
    "generating-sql": [
        ("Interchange check", "Interchange check: billed vs expected per acquirer", "Hexa card scheme", None),
        ("Chatbot KPIs (complex)", "Assistant KPIs: containment with resolution by intent and week", "Banque Lumière", None),
        ("Fraud decline bursts (complex)", "Suspicious card decline bursts: how fast do customers reach us?", "Banque Lumière", None),
    ],
    "modeling-processes": [
        ("Card payment lifecycle", "Card payment lifecycle: authorisation, clearing, settlement", "Hexa card scheme", None),
        ("Dispute (chargeback) cycle", "Process: dispute, representment and arbitration", "Hexa card scheme",
         "Model the dispute cycle. The cardholder contests a payment with the issuer. The issuer checks the reason and, if valid, opens a dispute (chargeback) through the scheme within 120 days of clearing; fraud reasons need a fraud report (LCLF declaration) first. The scheme debits the acquirer and credits the issuer in the next settlement. The acquirer asks the merchant for evidence and, within 30 days, either accepts or represents with evidence. On representment the issuer can accept (dispute closed, amount goes back to the acquirer) or escalate to arbitration by the scheme, whose decision is final; the losing member pays an arbitration fee."),
        ("Issuer onboarding", "Process: onboarding a new issuer member", "Hexa card scheme",
         "Model how a new issuer joins the scheme: application with documents (licence, KYC of the institution), review by Risk and Compliance, membership committee decision, contract signature, BIN range allocation, technical connection (test platform, certification of authorisation and clearing messages, security review), settlement account opening, then go-live with a monitored first month. Refusal at the committee ends the process; failed certification goes back to the member for fixes."),
    ],
    "writing-prds": [
        ("Fraud score (LCLF)", "PRD: real-time fraud score in authorisation", "Hexa card scheme", None),
        ("Member API portal", "PRD: developer portal for member APIs", "Hexa card scheme",
         "Our members (22 issuers, 9 acquirers) integrate our APIs (disputes, fraud reports, BIN ranges, settlement reports) with PDFs and emails. Onboarding a new API takes 3 to 5 months, mostly waiting for test credentials and answers. Idea: a developer portal with OpenAPI docs, a sandbox with test cards and tokens, self-service credentials for the test environment, and a status page. Constraint: production credentials stay under 4-eyes approval with mTLS certificates."),
        ("Instant settlement report", "PRD: intraday settlement position for members", "Hexa card scheme",
         "Members only see their net settlement position after the day closes; treasurers want to see it during the day to manage liquidity. Idea: an intraday position updated every hour from cleared transactions, by API and in the member portal, with the expected final position. Large issuers ask for it; small ones don't have treasurers watching. Must reconcile exactly with the end-of-day position."),
    ],
    "writing-user-stories": [
        ("Issuer fraud settings", "Stories: issuer fraud-score settings in the member portal", "Hexa card scheme", None),
        ("Acquirer disputes inbox", "Stories: acquirer disputes inbox", "Hexa card scheme",
         "Stories for the acquirer side of disputes in the member portal: list of open disputes with the response due date, filter by reason and merchant, open a dispute and see the clearing record, accept a dispute, represent with evidence upload (PDF, max 10 files, 5 MB each), and see disputes close to their deadline (5 days). Users: acquirer dispute analysts. Jira. Same 4-eyes rule as other member changes? Not for disputes."),
        ("BIN range management", "Stories: issuers manage their BIN ranges", "Hexa card scheme",
         "Issuers request new BIN ranges (8 digits) and change attributes (card product, debit/credit, consumer/commercial, country). Changes affect authorisation routing and interchange category, so they need scheme approval and take effect on a weekly release (Sunday 03:00). Users: issuer product managers. Jira."),
    ],
    "testing-apis": [
        ("Disputes API", "Disputes API test plan (chargebacks)", "Hexa card scheme", None),
        ("Fraud report API", "Fraud report API test plan (LCLF declarations)", "Hexa card scheme",
         "POST /v1/fraud-reports (issuer) declares a fraudulent transaction: { clearing_id or auth_id, fraud_type (lost, stolen, counterfeit, card-not-present, account takeover), detection_date, amount }. Rules: only the issuer of the card; within 90 days of the transaction; one report per transaction (updates via PATCH); detection_date not before the transaction date; fraud_type card-not-present only on ECOM transactions. Returns 201. pytest."),
        ("Settlement report API", "Settlement report API test plan", "Hexa card scheme",
         "GET /v1/settlement-positions?date=YYYY-MM-DD returns the member's net position for a settlement date: totals by currency and by category (purchases, refunds, interchange, disputes, fees) and the net amount. Rules: a member only sees its own positions; date must be a settlement day; positions of the current day are 'provisional' until 18:00; amounts in minor units; sum of categories = net. Paginated detail at /v1/settlement-positions/{id}/lines. OAuth2 + mTLS."),
    ],
    "facilitating-workshops": [
        ("Notes → report", "Workshop report: fraud score with pilot issuers", "Hexa card scheme", None),
        ("Prepare a workshop", "Workshop plan: dispute process redesign", "Hexa card scheme",
         "Prepare a 3-hour workshop on the dispute (chargeback) process. Today 40% of disputes go to arbitration, arbitration takes 45 days on average, and acquirers complain about evidence sent by email. Goal: agree the target dispute flow, the evidence required per reason code, and the deadlines. Attendees: 2 issuers' dispute managers, 2 acquirers' dispute managers, scheme dispute operations, scheme rules team, IT disputes, LCLF (fraud). Hybrid: half on site, half remote on Klaxoon."),
        ("Interview guide", "Interview guide: acquirers on the clearing API", "Hexa card scheme",
         "I'll interview the 9 acquirers' clearing teams (45 min each) before they migrate from the legacy clearing file to our clearing API: how they build the file today, their volumes and cut-off times, how they handle rejects, what worries them about the API, and their test capacity. Need the interview guide and a template to compare the answers."),
    ],
    "writing-functional-specs": [
        ("Detailed spec (SFD)", "SFD: fraud score in the authorisation request", "Hexa card scheme", None),
        ("General spec (SFG)", "SFG: disputes in the member portal", "Hexa card scheme",
         "Write the SFG for disputes in the member portal and API: issuers open disputes on cleared transactions with a reason code, acquirers accept or represent with evidence within 30 days, issuers accept or escalate to arbitration, the scheme decides. Financial movements go through settlement. Deadlines: 120 days from clearing to open, 30 days to represent, 10 days to escalate. Fraud reasons need a fraud report. Out of scope: cardholder-facing screens."),
        ("Review a spec", "Review: spec of the issuer stand-in limits", "Hexa card scheme",
         "Review this spec extract and fix it:\n\nWhen the issuer is unavailable, the scheme should approve transactions if they are not too big. Limits are set by the issuer, per card type etc. If the amount is above the limit we decline. Cash is handled as usual. The issuer gets the details later. The system must be fast and reliable."),
    ],
    "running-uat": [
        ("Day 8 dashboard", "UAT day 8: fraud score with pilot issuers", "Hexa card scheme", None),
        ("Plan a campaign", "UAT plan: new interchange grid", "Hexa card scheme",
         "Plan the UAT of the new domestic interchange grid: consumer debit ≤ 20 € at 0.10%, public & charity MCCs at 0.05%, other categories unchanged. Tests on the clearing engine, member clearing records, monthly billing and member reports. 3 weeks in February on the certification platform, testers from Pricing, Finance and 4 volunteer members (2 issuers, 2 acquirers). Shadow run in March, go-live 1 April. Need the strategy, entry/exit criteria, test data (amount boundaries, MCCs, rate change on a date), organisation and planning."),
        ("Go / no-go and sign-off", "UAT closure: disputes API, PV de recette", "Hexa card scheme",
         "End of UAT for the disputes API. 86 tests planned, 86 run, 83 passed, 3 failed. Defects: 1 major open (representment accepted on day 31 when the dispute was opened at 23:30, time zone issue; workaround: none), 2 minor open (error message wording), 11 closed. Exit criteria: 100% run, ≥95% passed, 0 blocking, 0 major without workaround. Go-live with the first 4 members in 6 days. Business owner: head of dispute operations. Need the go / no-go recommendation and the PV de recette."),
    ],
    "analysing-gaps-and-impacts": [
        ("New interchange grid", "Impact analysis: new domestic interchange grid", "Hexa card scheme", None),
        ("DORA incident reporting", "Gap & impact analysis: DORA major incident reporting", "Hexa card scheme",
         "Internal audit says our ICT incident process doesn't meet DORA. Today: incidents in ServiceNow, priority P1-P4 by technical impact; a P1 on authorisation is reported to the supervisor by Risk, by email, usually the next day. No link to the DORA classification criteria (clients and members affected, duration, data loss, critical services, geographical spread, economic and reputational impact). Members affected are estimated by phone. Third-party incidents (data centre, network provider) arrive by email. No 24/7 Risk on-call. Must comply in 6 months."),
        ("Clearing migration to API", "Impact analysis: retiring the legacy clearing file", "Hexa card scheme",
         "We want to stop accepting the legacy fixed-width clearing file in 12 months: all acquirers must send clearing through the new API. Impacts: 9 acquirers and their processors, our intake, validation and reject reports, the matching with authorisations, interchange computation, member billing, the operations team's monitoring and night shifts, contracts and member rules. 2 small acquirers have no IT team and use a processor. Need the gap & impact analysis and a migration approach."),
    ],
    "mapping-data": [
        ("Clearing file → API", "Data mapping: acquirer clearing file to the clearing API", "Hexa card scheme", None),
        ("Fraud reports interface", "Interface spec: issuer fraud reports to the scheme", "Hexa card scheme",
         "Map issuers' fraud reports (today: monthly CSV in different layouts per issuer) to our fraud report API. Issuer fields vary: transaction reference or ARN, card number masked or token, fraud type in free text or codes, detection date, amount. API expects: arn or auth_id, pan_token, fraud_type (LOST, STOLEN, COUNTERFEIT, CNP, ATO, OTHER), detection_date, amount_minor, currency. Need the mapping, code translation from free text, rules for missing data, and how to match reports to transactions."),
        ("Data quality: BIN referential", "Data quality rules: BIN referential", "Hexa card scheme",
         "Wrong BIN attributes cause wrong routing and wrong interchange. Table bin_range (bin_start, bin_end, issuer_id, card_product, card_type debit/credit/prepaid, consumer flag, country, status, valid_from). Known issues: overlapping ranges, ranges with no issuer, commercial cards flagged consumer, country missing. Need data quality rules by dimension with thresholds, the SQL checks, and a remediation plan by priority."),
    ],
    "managing-backlog": [
        ("PI planning (WSJF)", "PI planning: Authorisation & Fraud team, PI 27.1", "Hexa card scheme", None),
        ("Backlog health check", "Backlog review: member portal team", "Hexa card scheme",
         "Our backlog has 140 items. Top 15 by rank:\n1. Improve dispute screens (no description)\n2. As an issuer I want dark mode\n3. Bulk upload of fraud reports — 3 sprints\n4. Fix: settlement report PDF times out for large acquirers (12% of downloads)\n5. Refactor authentication module\n6. Developer portal (epic, 90 pts)\n7. As an acquirer I want to see the cardholder name — needs Legal\n8. Notification preferences\n9. Dark mode (duplicate?)\n10. Accessibility fixes (RGAA, deadline June)\n11. Intraday settlement position\n12. Spike: new charting library\n13. BIN range requests v2\n14. Upgrade the API gateway (end of support in 2 months)\n15. Improve performance\nTeam: 6 devs, 2-week sprints, velocity 35. What's wrong and how would you reorder it?"),
        ("Release plan (MoSCoW)", "Release plan: disputes API by 1 March", "Hexa card scheme",
         "Fixed date 1 March (committed to the 4 pilot members). 5 sprints of 2 weeks left, velocity 30. Stories: open dispute (8), get dispute (3), list disputes with filters (5), accept dispute (3), represent with evidence ids (8), evidence upload (13), escalate to arbitration (8), webhooks on status change (8), sandbox test data (5), rate limiting (3), OpenAPI docs (3), French error messages (2), dispute statistics endpoint (5). Which are must-haves for 1 March and what's the release plan?"),
    ],
}
for _t in TYPES:
    _ex = EXAMPLES.get(_t["id"])
    if _ex:
        _t["examples"] = [{"label": l, "label_fr": LABELS_FR.get(l, l), "title": ti, "client": c,
                           "notes": n or _t.get("example", "")} for l, ti, c, n in _ex]
    _t["template"] = TEMPLATES.get(_t["id"], {})
    _t["fr"] = TYPES_FR.get(_t["id"], {})
    _t["group"] = next(g["id"] for g in GROUPS if _t["id"] in g["types"])
# Sidebar order follows the work: frame, specify, plan / test / deliver, then the AI track.
_ORDER = [i for g in GROUPS for i in g["types"]]
TYPES.sort(key=lambda t: _ORDER.index(t["id"]))
TYPE_IDS = {t["id"] for t in TYPES}
DEFAULT_PROFILE = {"name": "", "title": "Product Owner", "company": "", "tool": "Jira",
                   "language": "English", "tone": "Clear and concise"}

_lock = threading.Lock()


def db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False, timeout=10)
    conn.row_factory = sqlite3.Row
    return conn


def load_seed():
    """Each seed/*.md file: a JSON header line, then ===INPUT===, then ===OUTPUT===."""
    items = []
    for f in sorted((ROOT / "seed").glob("*.md"), key=lambda f: int(f.name.split("-")[0])):
        head, rest = f.read_text().split("===INPUT===", 1)
        inp, out = rest.split("===OUTPUT===", 1)
        items.append({**json.loads(head), "input": inp.strip(), "output": out.strip()})
    return items


def init_db():
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with _lock, db() as conn:
        conn.executescript("""
        CREATE TABLE IF NOT EXISTS requests (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            type        TEXT NOT NULL,
            client      TEXT NOT NULL DEFAULT '',
            title       TEXT NOT NULL,
            notes       TEXT NOT NULL,
            changes     TEXT NOT NULL DEFAULT '',
            output      TEXT NOT NULL DEFAULT '',
            status      TEXT NOT NULL DEFAULT 'waiting',
            is_sample   INTEGER NOT NULL DEFAULT 0,
            created_at  REAL NOT NULL,
            updated_at  REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id  INTEGER,               -- NULL = general chat
            role        TEXT NOT NULL,         -- 'user' or 'claude'
            body        TEXT NOT NULL,
            handled     INTEGER NOT NULL DEFAULT 0,  -- user message answered by Claude
            read        INTEGER NOT NULL DEFAULT 0,  -- Claude message seen by the user
            created_at  REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS versions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id  INTEGER NOT NULL,
            output      TEXT NOT NULL,
            created_at  REAL NOT NULL
        );
        CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);
        """)
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(requests)")}
        if "sent_at" not in cols:
            conn.execute("ALTER TABLE requests ADD COLUMN sent_at REAL")
        if "unseen" not in cols:
            conn.execute("ALTER TABLE requests ADD COLUMN unseen INTEGER NOT NULL DEFAULT 0")
        # Add each sample once, so new samples reach existing workspaces and deleted ones stay deleted.
        seeded = set(get_meta(conn, "seeded", [r[0] for r in conn.execute("SELECT title FROM requests WHERE is_sample=1")]))
        seeds = load_seed()
        # Samples replaced by newer ones (e.g. re-themed) leave the workspace with their history.
        current = {r["title"] for r in seeds}
        for rid, title in conn.execute("SELECT id, title FROM requests WHERE is_sample=1").fetchall():
            if title not in current:
                for tbl in ("messages", "versions"):
                    conn.execute(f"DELETE FROM {tbl} WHERE request_id=?", (rid,))
                conn.execute("DELETE FROM requests WHERE id=?", (rid,))
        now = time.time()
        for i, r in enumerate(seeds):
            if r["title"] in seeded:
                continue
            t = now - (len(seeds) - i) * 3600 * 2
            conn.execute(
                "INSERT INTO requests (type,client,title,notes,output,status,is_sample,created_at,updated_at) "
                "VALUES (?,?,?,?,?, 'ready', 1, ?, ?)",
                (r["skill"], r.get("client", "Sample client"), r["title"], r["input"], r["output"], t, t))
            seeded.add(r["title"])
        set_meta(conn, "seeded", sorted(seeded))


def get_meta(conn, key, default):
    row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return json.loads(row["value"]) if row else default


def set_meta(conn, key, value):
    conn.execute("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                 (key, json.dumps(value)))


def claude_online(conn):
    row = conn.execute("SELECT value FROM meta WHERE key='heartbeat'").fetchone()
    return bool(row) and time.time() - float(row["value"]) < 45


def summary(conn, row):
    d = dict(row)
    d.pop("output"), d.pop("notes"), d.pop("changes")
    d["unread"] = conn.execute("SELECT COUNT(*) FROM messages WHERE request_id=? AND role='claude' AND read=0",
                               (row["id"],)).fetchone()[0]
    d["awaiting_reply"] = conn.execute("SELECT COUNT(*) FROM messages WHERE request_id=? AND role='user' AND handled=0",
                                       (row["id"],)).fetchone()[0] > 0
    return d


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(STATIC_DIR), **kw)

    def log_message(self, fmt, *args):
        pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, data, status=200):
        body = json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        n = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(n) or b"{}")

    def thread(self, conn, request_id):
        where = "request_id IS NULL" if request_id is None else "request_id=?"
        args = () if request_id is None else (request_id,)
        msgs = [dict(m) for m in conn.execute(f"SELECT * FROM messages WHERE {where} ORDER BY created_at", args)]
        conn.execute(f"UPDATE messages SET read=1 WHERE {where} AND role='claude'", args)
        return msgs

    def do_GET(self):
        path = self.path.partition("?")[0]
        if not path.startswith("/api/"):
            if path != "/" and not (STATIC_DIR / path.lstrip("/")).is_file():
                self.path = "/"
            return super().do_GET()
        with _lock, db() as conn:
            if path == "/api/state":
                rows = conn.execute("SELECT * FROM requests ORDER BY updated_at DESC").fetchall()
                seeds = load_seed()
                examples = {r["skill"]: r["input"] for r in reversed(seeds)}
                by_title = {r["title"]: r["input"] for r in seeds}
                chat_unread = conn.execute("SELECT COUNT(*) FROM messages WHERE request_id IS NULL AND role='claude' "
                                           "AND read=0").fetchone()[0]
                clients = [r[0] for r in conn.execute(
                    "SELECT client FROM requests WHERE client!='' AND is_sample=0 GROUP BY client ORDER BY MAX(updated_at) DESC")]
                return self.send_json({
                    "types": [{**t, "example": t.get("example") or examples.get(t["id"], ""),
                               "examples": [{**e, "notes": e["notes"] or by_title.get(e["title"], "")}
                                            for e in t.get("examples", [])] or [{"label": "Sample notes", "title": "", "client": "",
                                                                  "notes": examples.get(t["id"], "")}]} for t in TYPES],
                    "requests": [summary(conn, r) for r in rows],
                    "claude_online": claude_online(conn),
                    "chat_unread": chat_unread,
                    "profile": {**DEFAULT_PROFILE, **get_meta(conn, "profile", {})},
                    "learned": get_meta(conn, "learned", []),
                    "clients": clients,
                    "groups": [{k: g[k] for k in ("id", "en", "fr")} for g in GROUPS],
                })
            if path == "/api/chat":
                return self.send_json({"messages": self.thread(conn, None)})
            m = re.fullmatch(r"/api/requests/(\d+)", path)
            if m:
                rid = int(m.group(1))
                row = conn.execute("SELECT * FROM requests WHERE id=?", (rid,)).fetchone()
                if not row:
                    return self.send_json({"error": "Not found"}, 404)
                conn.execute("UPDATE requests SET unseen=0 WHERE id=?", (rid,))
                versions = [dict(v) for v in conn.execute(
                    "SELECT id, created_at FROM versions WHERE request_id=? ORDER BY created_at", (rid,))]
                return self.send_json({**dict(row), "messages": self.thread(conn, rid), "versions": versions})
            m = re.fullmatch(r"/api/versions/(\d+)", path)
            if m:
                row = conn.execute("SELECT * FROM versions WHERE id=?", (int(m.group(1)),)).fetchone()
                return self.send_json(dict(row)) if row else self.send_json({"error": "Not found"}, 404)
        self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        path = self.path.partition("?")[0]
        body = self.read_json()
        now = time.time()
        with _lock, db() as conn:
            if path == "/api/requests":
                notes = (body.get("notes") or "").strip()
                if body.get("type") not in TYPE_IDS or not notes:
                    return self.send_json({"error": "Add your notes first."}, 400)
                title = (body.get("title") or "").strip() or notes.splitlines()[0][:70]
                cur = conn.execute(
                    "INSERT INTO requests (type,client,title,notes,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                    (body["type"], (body.get("client") or "").strip(), title, notes, now, now))
                return self.send_json({"id": cur.lastrowid}, 201)
            if path == "/api/chat":
                text = (body.get("body") or "").strip()
                if not text:
                    return self.send_json({"error": "Write a message first."}, 400)
                conn.execute("INSERT INTO messages (request_id,role,body,created_at) VALUES (NULL,'user',?,?)", (text, now))
                return self.send_json({"ok": True}, 201)
            if path == "/api/profile":
                profile = {k: str(body.get(k, "")).strip()[:120] for k in DEFAULT_PROFILE}
                set_meta(conn, "profile", profile)
                if isinstance(body.get("learned"), list):
                    set_meta(conn, "learned", [str(x)[:300] for x in body["learned"]][:50])
                return self.send_json({"ok": True})
            m = re.fullmatch(r"/api/requests/(\d+)/messages", path)
            if m:
                text = (body.get("body") or "").strip()
                if not text:
                    return self.send_json({"error": "Write a message first."}, 400)
                conn.execute("INSERT INTO messages (request_id,role,body,created_at) VALUES (?,'user',?,?)",
                             (int(m.group(1)), text, now))
                return self.send_json({"ok": True}, 201)
            m = re.fullmatch(r"/api/requests/(\d+)/sent", path)
            if m:
                conn.execute("UPDATE requests SET sent_at=? WHERE id=?",
                             (now if body.get("sent") else None, int(m.group(1))))
                return self.send_json({"ok": True})
        self.send_json({"error": "Not found"}, 404)

    def do_DELETE(self):
        m = re.fullmatch(r"/api/requests/(\d+)", self.path)
        if not m:
            return self.send_json({"error": "Not found"}, 404)
        rid = int(m.group(1))
        with _lock, db() as conn:
            conn.execute("DELETE FROM requests WHERE id=?", (rid,))
            conn.execute("DELETE FROM messages WHERE request_id=?", (rid,))
            conn.execute("DELETE FROM versions WHERE request_id=?", (rid,))
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()


def main():
    init_db()
    print(f"Analyst Kit → http://localhost:{PORT}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
