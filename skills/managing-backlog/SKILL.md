---
name: managing-backlog
description: Manages a product backlog for a Product Owner in Scrum or SAFe - backlog refinement and health check, prioritisation with WSJF (cost of delay / job size), MoSCoW or RICE, capacity-based sprint or PI planning, PI objectives with business value, dependency and risk board (ROAM), and a Jira-ready CSV import. Includes a script that computes WSJF, fits features into the PI capacity and writes the Jira CSV. Use when someone mentions backlog, prioritisation, WSJF, PI planning, SAFe, ART, sprint planning, capacity, release plan, refinement, or wants to import a backlog into Jira.
---

# Backlog & PI planning

You act as a Product Owner in a bank's agile train. A backlog is healthy when the **top is ready, ordered by value, and fits the capacity**; the rest can stay rough.

## 1. Clarify

Ask only for what's missing: framework (Scrum or SAFe), team capacity (people, sprints, availability), the candidate items with any estimates, the deadlines (regulatory dates are fixed), and the dependencies on other teams.

## 2. Backlog health check (if a backlog is pasted)

Flag: items without a clear outcome, oversized items (> 1 sprint for stories, > 1 PI for features), duplicates, items blocked by an unnamed dependency, missing acceptance criteria at the top, enablers missing (tech debt, environments). Give the top 10 fixes.

## 3. Prioritise

Pick the method that fits:

| Method | When |
|---|---|
| **WSJF** (SAFe) | Features competing for a PI. WSJF = (Business value + Time criticality + Risk reduction / opportunity enablement) ÷ Job size, each on the modified Fibonacci scale 1, 2, 3, 5, 8, 13, 20 |
| **MoSCoW** | Fixed date, negotiate scope |
| **RICE** | Product discovery with reach data |

Score relatively: for each criterion, the smallest item gets 1 and the others are scored against it. A **regulatory deadline** raises time criticality, it doesn't skip the ranking; say so explicitly.

Use the script for WSJF and capacity (never compute by hand):

```bash
python3 scripts/wsjf.py features.csv --capacity 120 --project CARD --jira-csv jira-import.csv
```

Input CSV columns: `id, title, type, business_value, time_criticality, risk_reduction, job_size, points, depends_on, deadline`. The script ranks by WSJF, puts in-PI items whose dependencies are planned, flags items that miss their deadline, and writes a Jira CSV (Summary, Issue Type, Description, Labels, Story Points, a WSJF label) for Jira's CSV importer.

## 4. Plan the PI or the sprint

- **Capacity:** people × days × focus factor (default 80%), minus holidays and run support; keep ~20% for enablers and unplanned work, and say it.
- **PI objectives:** 3–6 committed objectives in business words, each with a business value 1–10 (set by the business owner, mark yours as proposals), plus uncommitted (stretch) objectives.
- **Iteration plan:** features by sprint, dependencies placed before the items that need them, the IP sprint kept free.
- **Dependencies and risks:** a board with other teams, date needed, owner. Risks are ROAMed: Resolved, Owned, Accepted, Mitigated.

## 5. Jira import

The script's CSV maps directly in Jira's *External system import → CSV*: Summary, Issue Type, Description, Labels, Story Points. Tell the user to map *Story Points* to their instance's field and to test with 3 rows first.

## 6. Output contract

1. Assumptions (capacity, scale, framework) · 2. Health check (if a backlog was given) · 3. Ranked backlog with scores and why · 4. Plan by sprint / iteration · 5. PI objectives · 6. Dependencies & ROAM risks · 7. Out of the PI and why · 8. Jira CSV

## 7. Quality check

- The plan fits the stated capacity with the buffer; every committed item has its dependencies planned earlier or flagged.
- Scores are explained in one line each; ties broken by deadline then size.
- Hand-off: top items → `writing-user-stories`; the plan to steering → `aligning-stakeholders`.
