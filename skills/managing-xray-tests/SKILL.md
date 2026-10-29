---
name: managing-xray-tests
description: Designs test cases for Xray, the Jira test management app, and produces import-ready files for both Xray Cloud and Xray Server / Data Center. Turns user stories, acceptance criteria, a PRD, a conversation design or a RAG golden set into Manual tests (steps), Cucumber tests (.feature) or Generic tests, organises them into folders, Test Sets and Test Plans with requirement coverage, and converts test or evaluation results into Xray JSON executions. Use when someone mentions Xray, test cases in Jira, test coverage of stories, a Test Plan or Test Execution, importing tests or results into Jira, or wants their evaluation runs tracked in Jira.
---

# Xray test design and import

You act as a QA lead who works with Product Owners. The goal is a test repository that proves each story is covered, imports into Xray on the first try, and shows release readiness in Jira, without the PO touching a line of JSON.

## 1. Clarify (ask only what's missing)

- **Xray flavor:** Cloud or Server / Data Center. If unknown, produce **both**: the formats differ (see §5).
- **Jira project key** (e.g. `LUM`) and the **requirement keys** (stories) the tests cover. If keys are unknown, use placeholders like `LUM-101` and list them in *To confirm*.
- **What exists already:** existing test keys to update rather than duplicate, the repository folder structure, the Test Plan key.
- **Who runs the tests:** manual testers (→ Manual tests), automation with Cucumber (→ Cucumber tests), or a script / evaluation pipeline (→ Generic tests).

## 2. Choose the test type

| Situation | Xray test type | Why |
|---|---|---|
| A person checks screens, wording, a conversation | **Manual**: steps with *Action · Data · Expected result* | Testers follow and record step by step |
| Acceptance criteria already in Gherkin, team automates with Cucumber | **Cucumber**: one Scenario per test, `.feature` file per story | Same text for business, QA and automation |
| An automated suite or evaluation pipeline produces the result (RAG eval, red-team, API tests) | **Generic**: identified by `definition` | Results import creates and updates the test automatically |

Rule of thumb for a conversational assistant: **journeys** → Manual (tone, quick replies, hand-off screen), **behaviour rules** → Cucumber (many phrasings, Scenario Outline), **golden set and red-team** → Generic from the evaluation run.

## 3. Write good tests

- **One behaviour per test.** The summary says the behaviour and the expected outcome: *"Several active cards: assistant asks which card before giving steps"*.
- **Every Manual step has an expected result** you can check with a yes / no. No "works correctly".
- **Test data is explicit** (test customer, card ending, environment). Never real customer data.
- **Precondition** written once: for Manual tests it goes in the description; for Cucumber it's the `Background`, which Xray turns into a Precondition issue.
- **Cover every branch** of the story: happy path, each unhappy path, and the edge cases from the acceptance criteria. For an assistant add: other language, frustration, no approved source, injection attempt.
- **Labels** without spaces, for slicing: `happy-path`, `high-risk`, `fraud`, `regression`.
- **Folder** by product area, not by sprint: `/Assistant/Cards/Lost or stolen`.

## 4. Organise for coverage and release

- **Requirement links:** every test links to at least one story (`requirements`). Coverage in Jira then shows each story as OK / NOK / NOT RUN.
- **Test Set:** reusable groups (e.g. *Cards regression*, *Red-team*).
- **Test Plan:** what must pass for a release, with the environments (`staging`, `production`).
- **Test Execution:** one run of a set of tests on one version and environment. Import results into the plan's execution.

## 5. Build the files with the script (never hand-write the JSON)

Write a short spec (`templates/xray_spec.json` shows every field), then:

```bash
python3 scripts/build_xray.py spec.json --flavor both --out xray-import
```

You get, per flavor: `tests.csv` (Manual tests for the Test Case Importer, one row per step), `features/*.feature` (Cucumber, tagged with the requirement key), `results.json` (Xray JSON, if the spec has an `execution`), and `IMPORT.md` (click path, column mapping, API calls). The script validates first (keys, labels, steps, Gherkin, statuses) and writes nothing if the spec is wrong.

From an evaluation run scored with `evaluating-rag-quality`:

```bash
python3 scripts/build_xray.py --from-eval eval_results.csv --project LUM --plan LUM-500 --summary "RAG eval run 2"
```

Each golden-set question becomes a Generic test (`definition: rag-eval.<id>`, labels for category and risk), **passed only if every scored metric passed**, with the failed metrics and root cause in the comment.

**Cloud vs Server / Data Center: what the script handles for you**

| | Xray Cloud | Xray Server / Data Center |
|---|---|---|
| Result statuses | `PASSED` `FAILED` `TODO` `EXECUTING` | `PASS` `FAIL` `TODO` `EXECUTING` |
| Test type field when creating tests from results | `testInfo.type` | `testInfo.testType` (the schema rejects unknown fields) |
| API base | `https://xray.cloud.getxray.app/api/v2` | `https://<jira>/rest/raven/2.0` (feature import: `/rest/raven/1.0`) |
| Authentication | `client_id` + `client_secret` → token, valid 24 h | Jira personal access token (or Basic auth) |
| CSV import | Test Case Importer; steps map to *Action · Data · Expected Result* | Test Case Importer; older versions call *Action* "Step" |

Custom statuses defined by the Xray admin can be used as-is in both.

## 6. Safety

- The skill **produces files**. It never calls the Jira or Xray API itself. The import guide shows the calls with environment variables (`$XRAY_CLIENT_ID`, `$JIRA_PAT`); never write a secret into a file or a chat.
- Recommend a **trial import of 2–3 tests** before the full set.
- Updating existing tests (by key) overwrites their steps: say so when the spec contains keys.

## 7. Output contract

1. **Restated scope:** flavor(s), project, stories covered, test types chosen and why
2. **Coverage matrix:** story × tests, with the branches each test covers and any gap
3. **Test list:** ID, type, summary, labels, folder, priority
4. **The test content:** Manual steps as a table, Cucumber as `.feature` text
5. **Import files**, each in its own code block preceded by its file name (`tests.csv`, `<story>.feature`, `results-cloud.json`, `results-server.json`)
6. **How to import:** short click path per flavor, the API call, and what to check in Jira afterwards
7. **To confirm:** placeholder keys, test data, environment names

## 8. Quality check

- Every story has at least one test per acceptance criterion, and every unhappy path is covered.
- Every Manual step has a checkable expected result; every Cucumber line starts with a Gherkin keyword.
- Statuses and field names match the flavor. When the flavor is unknown, both versions are given.
- No real customer data, no secrets.
- Hand-off: failures go back to `writing-user-stories` (unclear criteria) or to the evaluation's root-cause owners; the release decision goes to `aligning-stakeholders`.
