# What the freelance market asks of a BA / Product Owner · Île-de-France, Sept–Oct 2026

Source: [Free-Work](https://www.free-work.com/fr/tech-it/jobs?locations=fr~ile-de-france~~&locations=fr~ile-de-france~paris~paris&contracts=contractor), freelance contracts in Île-de-France, published between 1 September and 31 October 2026. I searched for *product owner*, *business analyst*, *proxy product owner*, *AMOA*, *PO data* and *PO IA*, which gave **964 listings**. **740** had a BA / PO / AMOA job title and were kept for the counts. The percentages are the share of those 740 listings that mention the skill or tool. Listings are short and often incomplete, so tools that every client takes for granted (Excel, Office 365) are mentioned less often than they are used.

## Day rate

| Profile (listings with a rate) | Median day rate |
|---|---|
| All BA / PO (451) | **475 €** (p25 440 €, p75 535 €) |
| Banking (124) | 500 € |
| Regulatory topics (72) | 500 € |
| Data (122) | 500 € |
| AI / GenAI (58) | **505 €** |

53% of the listings ask for a *senior* profile and 12% for an *expert*.

## What the work is

| Activity | Share of listings | Covered by a skill |
|---|---|---|
| Workshops, requirements gathering (*ateliers, recueil des besoins*) | 68% | **Workshops & requirements** (new) |
| Acceptance testing (*recette, UAT*), defects, sign-off | 57% | **UAT campaign** (new) + Xray tests |
| Functional specifications (*SFG / SFD, cahier des charges*) | 52% | **Functional specs** (new) |
| Banking, finance or insurance context | 49% | all, with banking samples |
| User stories & acceptance criteria | 34% | User stories |
| Prioritisation (MoSCoW, WSJF), backlog | 32% | **Backlog & PI planning** (new) |
| APIs, interfaces, data flows between systems | 32% | **Data mapping** (new) + API test plan |
| Reporting, steering committees (*COPIL*), dashboards | 32% | Steering & alignment, SQL |
| Existing vs target, gap analysis (*existant / cible*) | 25% | **Gap & impact analysis** (new) |
| Run, support, incidents (*MCO, TMA*) | 25% | UAT campaign (defect triage) |
| Data quality & governance | 19% | **Data mapping** (new) |
| Roadmap, product vision | 17% | AI use-case roadmap, Backlog & PI planning |
| Change management (*conduite du changement*) | 16% | Steering & alignment |
| Regulation (DORA, Basel, KYC, AML, PSD2…) · in banking listings | 16% · **25%** | **Gap & impact analysis** (new), AI risk |
| Migration | 12% | Data mapping, Gap & impact analysis |
| AI / GenAI / chatbots / agents | 12% | the conversational AI & RAG track |
| Process mapping (BPMN, *cartographie*) | 11% | Process map |
| SAFe / PI Planning | 10% | **Backlog & PI planning** (new) |

## Tools to master

Ranked by how often listings name them. **Must have** = expected in most banking BA / PO contracts.

| Tool | Share | Level | Why |
|---|---|---|---|
| **Jira** | 30% (top tag) | Must have | Backlog, sprints, defects. Know JQL, boards, filters, dashboards and CSV import |
| **SQL** | 25% | Must have | Checking data during specs and acceptance testing, reconciliations, KPIs |
| **Confluence** | 16% | Must have | Specs, meeting notes, release notes, decision logs |
| **Excel** | 6% named, used everywhere | Must have | Mapping files, test campaigns, defect follow-up, pivot tables, lookups |
| **Office 365 / Teams / PowerPoint** | 6% named | Must have | Steering committee decks, workshops |
| **Power BI** (or Tableau, Qlik) | 8% | Strong plus | Steering dashboards, data PO roles |
| **Xray / Squash / HP ALM** | 4% | Strong plus | Test repository and acceptance campaigns (Xray in Jira shops, Squash and ALM in banks) |
| **BPMN tool** (Bizagi, Visio, draw.io, Camunda Modeler) | 4% | Plus | Process maps for workshops and specs |
| **Postman / Swagger** | 3% | Plus | Reading and testing APIs with developers |
| **Azure DevOps** | 3% | Plus | Replaces Jira in Microsoft shops |
| **Snowflake / BigQuery / Databricks / Dataiku** | 6% | For data PO roles | Data products, data quality |
| **Figma / Miro / Klaxoon** | 2% | Plus | Wireframes, remote workshops (Klaxoon is common in French banks) |
| **SAP / Salesforce / ServiceNow / Murex** | 9% / 4% / 3% / 2% | Domain-specific | Worth it only to target that domain |

**Methods:** Scrum (23%), SAFe (9%, mostly in banks), Kanban, ITIL (run and support). **English:** 35% of listings ask for it.

## Recommended stack to land a contract

1. **Core, non-negotiable:** Jira (with Xray), Confluence, Excel, SQL, PowerPoint.
2. **To stand out in banking:** Power BI, a BPMN tool, Postman, and one regulatory topic you can talk about (DORA, PSD2 / Instant Payments, KYC / AML).
3. **Your differentiator:** AI / GenAI product ownership pays about 30 € more per day than the median, and only 12% of listings ask for it. The conversational AI & RAG track of this repository covers it.
4. **Certifications that listings mention:** PSPO I or CSPO (Scrum), SAFe POPM (SAFe banks), ITIL 4 Foundation (run and ServiceNow roles).

## The six skills added from this analysis

| Skill | Market need | Sample (English: Visa · French: CB) |
|---|---|---|
| [Workshops & requirements](../skills/facilitating-workshops/SKILL.md) | 68% workshops | Lost and stolen card declaration: notes → report |
| [Functional specs (SFG / SFD)](../skills/writing-functional-specs/SKILL.md) | 52% specs | PAN declaration: block, Exception File / opposition, fraud report |
| [UAT campaign](../skills/running-uat/SKILL.md) | 57% acceptance testing | Day 8 of the PAN declaration UAT · [`uat_report.py`](../skills/running-uat/scripts/uat_report.py) |
| [Gap & impact analysis](../skills/analysing-gaps-and-impacts/SKILL.md) | 25% existing vs target, 25% regulation in banking | Chargebacks out of spreadsheets (French version: CMF refund and contestation timelines) |
| [Data mapping & quality](../skills/mapping-data/SKILL.md) | 32% interfaces, 19% data quality | Fraud cases → Visa fraud reports / déclarations GIE CB · [`check_mapping.py`](../skills/mapping-data/scripts/check_mapping.py) |
| [Backlog & PI planning](../skills/managing-backlog/SKILL.md) | 32% prioritisation, 30% Jira, 10% SAFe | Cards team PI: WSJF, capacity, Jira import · [`wsjf.py`](../skills/managing-backlog/scripts/wsjf.py) |

The method to reproduce the counts (Free-Work's public listing API, keyword matching on title, tags and description) is in [`method.md`](method.md).
