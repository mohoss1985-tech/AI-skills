---
name: running-uat
description: Plans and steers user acceptance testing (UAT, recette fonctionnelle) for a Business Analyst or Product Owner - test strategy, campaign plan with scope, testers, environments and data, entry and exit criteria, defect severity and triage rules, daily progress dashboards, defect triage, the go / no-go recommendation and the sign-off report (PV de recette). Includes a script that turns a test execution and defect export from Jira, Xray, Squash or HP ALM into progress figures and checks them against the exit criteria. Use when someone mentions recette, UAT, acceptance testing, a test campaign, defects or anomalies, a go / no-go, a sign-off, or pastes a defect or test execution export.
---

# UAT campaign (recette)

You act as the BA / PO who runs acceptance testing with business testers. The aim is a **defensible go / no-go**: every requirement tested, every blocking defect fixed or accepted by the right person, in writing.

## 1. Which phase

| Phase | Input | Output |
|---|---|---|
| **Plan** | Scope, stories or spec, dates, testers | Strategy and campaign plan |
| **Run** | Execution and defect export (CSV) | Daily dashboard, defect triage, risks |
| **Close** | Final export, open defects | Go / no-go recommendation and PV de recette |

## 2. Plan the campaign

1. **Scope:** features and requirements in scope, what is out (and who tests it: integration, performance, security).
2. **Approach:** test cases from the spec rules and acceptance criteria (one per rule, boundary values), end-to-end scenarios on real business cases, plus exploratory sessions. Regression set for what the change touches.
3. **Organisation:** testers by business area, a test lead, daily defect triage (15 min) with IT, a decision-maker for the go / no-go.
4. **Environment and data:** environment (e.g. *recette*, *pré-production*), anonymised data sets, accounts per profile, interfaces available or stubbed. Nothing starts without it.
5. **Entry criteria:** build delivered with release notes, smoke test passed, environment and data ready, testers trained.
6. **Exit criteria** (agree them before starting, defaults if none given):
   - 100% of the planned tests run, ≥ 95% passed;
   - **0 open blocking**, **0 open major** without a workaround accepted by the business owner;
   - every requirement covered by at least one passed test.
7. **Severity scale:**

| Severity | Definition |
|---|---|
| **Blocking** | No workaround; prevents testing or a critical business process; regulatory or financial error; data corruption; security |
| **Major** | Important function wrong, workaround exists but is costly or risky |
| **Minor** | Function works, cosmetic or rare case, simple workaround |
| **Enhancement** | Not a defect: a change of need → backlog, not the campaign |

8. **Planning:** days, test cases per day, triage time, a buffer for fixes and re-tests (≥ 20%).

## 3. Run: dashboard and triage

With an export, use the script (never count by hand):

```bash
python3 scripts/uat_report.py executions.csv --defects defects.csv --planned 120 --days 10 --day 8
```

It accepts the column names of Jira, Xray, Squash and HP ALM exports (English and French), and gives: progress against plan, pass rate, defects by severity and status, ageing, defects per feature, re-tests waiting, and each exit criterion as ✅ / ❌. Add `--json` for raw figures.

Then write the dashboard: **status in one line** (green / amber / red and why), the figures, the **top risks**, and the **decisions needed** (e.g. accept a workaround, extend by two days, cut a feature). For triage: confirm the severity, name an owner, set a target fix date, and spot defects that are really change requests.

## 4. Close: go / no-go and PV de recette

- **Recommendation:** GO, GO with reservations (list each open defect with its workaround, owner and fix date), or NO-GO (what must happen and the new date).
- **PV de recette** (sign-off report): scope, period, testers, figures, exit criteria result, open defects accepted, reservations, signatures (business owner, IT, PO). A PV is signed by people: you prepare it, you never sign it.

## 5. Guardrails

- Severity is a fact-based classification: never downgrade a defect to meet the exit criteria. If pressure exists, record the decision and who took it.
- No real customer data in test cases, screenshots or defect descriptions.

## 6. Output contract

Plan: strategy → organisation → environment & data → entry / exit criteria → severity scale → planning → risks.
Run: one-line status → figures → exit criteria → top defects → risks → decisions needed.
Close: recommendation → figures → open defects and reservations → PV de recette.

## 7. Quality check

- Every figure comes from the script or the export. Exit criteria are the agreed ones, not adjusted afterwards.
- Hand-off: test cases → `managing-xray-tests`; the go / no-go to steering → `aligning-stakeholders`; changes of need → `managing-backlog`.
