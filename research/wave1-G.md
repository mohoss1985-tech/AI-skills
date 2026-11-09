# Wave 1 · G · UAT tracker, Xray builder, RAG eval scorer

Files (owner G only): `app/web/js/tools/uat-tracker/*`, `app/web/js/tools/xray-builder/*`, `app/web/js/tools/rag-eval/*`. No server file.
Assigned port: 4307. **No screenshots this time** (`screenshots/v2/G-*` are missing): the sandbox refused to bind a local port
and refused to start Edge (Crashpad / ProcessSingleton "Operation not permitted"), and running them outside the sandbox was
denied. The screens were checked in jsdom through the real `shell/tool-frame.js` instead (see Checks).

## UAT tracker (`uat-tracker`, skill running-uat) · layout `single`

| File | What |
|---|---|
| `csv.js` | CSV helpers shared by the three G tools: `parseCsv` (auto `,` `;` tab, quotes, BOM), `pickCol` (aliases, accent-insensitive), `toCsv` (Python `csv.writer` quoting, CRLF), `mdCell`, `fmtVars`. |
| `logic.js` | `compute(state)` = the `uat_report.py` rules: run % / passed % of **planned**, not run = not-run cases + (planned − cases), blocked apart, live defect = open or waiting re-test, the 5 exit criteria (each can be switched off; pass-rate minimum editable), burn-up per day, features, requirements, flags (fail without defect, defect not in the list, no evidence), verdict `go` / `goRes` (met + open majors with workaround or minors) / `nogo`, RAG status (red if a blocking defect is live or plan slips > 10 pts). `casesFromCsv` / `defectsFromCsv` use the script's column and status aliases (Jira, Xray, Squash, HP ALM, EN/FR). `runsCsv`, `defectsCsv`. |
| `samples.js/.json` | Day 8 of 10 of the lost / stolen card release, 24 cases of 26 planned, 7 defects. UAT-09 (FR REC-09) fails: "Stolen card approved in stand-in (Exception File listing took 160 min)" → CARD-301 blocking (blocks UAT-10/11). EN Harbor Bank / Visa, FR Banque Lumière / CB (liste d'opposition). Result: 1/5 criteria, NO-GO, red. |
| `logic.test.mjs` | `node app/web/js/tools/uat-tracker/logic.test.mjs [--write-json]`: parity with `uat_report.py --json` on the skill's example exports at 3 plan/day settings (all figures + criteria) and the sample verdicts. **5/5 PASS.** |
| `index.js`, `i18n.js`, `tool.css` | The screen. |

Screen: command bar = Scope · Cases planned · Campaign day · of days, primary "Evaluate go / no-go ⌘↵". Advanced = testers,
decision maker, paste an execution export, paste a defect export. Dashboard row: **go / no-go gauge** (arc = criteria met,
verdict text + icon, RAG badge, criteria ✓/✗ with values, "Why" = one plain sentence per unmet criterion, reservations) ·
Progress (Run / Passed / Blocked / Not run tiles, schedule gap sentence, SVG **burn-up** plan / run / passed per day with a
today line) · **Defects by severity** (bars live vs closed, keys listed). Tabs: Test runs (A's grid: id, case, feature,
requirement, tester, status select, defect link, evidence, day, checks badges; changing a status fills the day with the
campaign day) · Defects (grid: key, summary, severity, status, feature, raised day, workaround accepted, linked cases) ·
Exit criteria (toggles + live state). Everything recomputes on each edit. Exports: test runs CSV, defects CSV, Markdown
**daily report** (skill "Run" contract: one-line status → figures → features → defects → exit criteria → top defects →
risks → decisions needed → recommendation). AI: "Triage the defects", "Draft the PV de recette".

## Xray builder (`xray-builder`, skill managing-xray-tests) · layout `single`

| File | What |
|---|---|
| `logic.js` | Port of `build_xray.py`: `validate(spec, target)` (all script errors + tool warnings: non-default Jira priority, no requirement, other-project requirement, duplicate summary, vague expected result, key overwrite, FR Gherkin, Cucumber/Generic not in CSV, Server/DC step column and repository path, bulk JSON, status vocabulary; `confirm: true` = *to confirm*), `testsCsv` (byte-identical), `featureFiles` (byte-identical; adds `# language: fr` + French keywords when the scenario is French), `executionJson` (byte-identical, `testInfo.type` vs `testType`, PASSED vs PASS), `testsBulkJson` (Cloud bulk shape from research/05, *to confirm*), `importGuide` (port of IMPORT.md), `checkColumns` (pasted CSV header vs target: known / *to confirm* / rename / unknown / Jira-only columns, Test Type values), `toSpec` (tool state → script spec), sources `testsFromList`, `testsFromUat`, `testsFromApi`. |
| `samples.js/.json` | 2 stories × 6 tests (3 Manual, 2 Cucumber incl. a Scenario Outline, 1 Generic), results for 4 tests incl. CARD-T03 failed with the 160-min Exception File comment + CARD-301. EN project CARD / Xray Cloud; FR project CARTE / Server-DC with French Gherkin. Each has one deliberate error (label "high risk") and one *to confirm* warning (priority "Critical"). |
| `logic.test.mjs` | Runs `build_xray.py` on the skill's template spec (both flavors) and compares: **15/15 PASS** (tests.csv, 4 .feature files, results.json per flavor; samples valid once the label is fixed). |

Screen: command bar = Jira project key · Target (segmented Xray Cloud / Server / DC) · "Add tests from ▾" (a pasted list
dialog · the UAT tracker = latest saved workspace in the same store, falls back to the UAT sample with a toast · the API
tester = latest saved workspace with `cases` / `req`), primary "Validate · <target> ⌘↵". Advanced = default folder,
Server/DC step column (Action / Step), Test Execution fields, **Check a CSV you already have**. Body: tests table (type
badge, result, error/warning count) | editor (ID, type segmented with hint, priority, summary, requirements, labels,
folder, precondition, **steps grid** action / data / expected result, or Gherkin code editor, or definition; result,
comment, defects); errors show under the bound field. Below: validation panel grouped by test (click jumps to it; "to
confirm" tags) | file previews (tests.csv, .feature, results JSON, tests JSON, IMPORT.md) with copy. Exports: Xray CSV,
tests bulk JSON, results JSON, IMPORT.md, Markdown (skill §7 output contract); action bar "Download .feature files".
AI: "Draft tests from the stories" (answer pasteable into the list dialog), "Review my tests".

## RAG eval scorer (`rag-eval`, skill evaluating-rag-quality) · layout `split`

| File | What |
|---|---|
| `logic.js` | `scoreItem` (offline, deterministic) fills the 7 `score_eval.py` metrics: context recall / precision (retrieved vs expected sources), **faithfulness** (each claim's numbers in the retrieved context and ≥ 40 % of its words; 1 only if all claims supported), answer relevance, **correctness** (number+unit facts of the reference present, no conflicting value of the same dimension, ≥ 50 % reference words), **citation present and accurate** (`[ID]` cited, retrieved, one expected), correct refusal / escalation (EN + FR wording). Overrides by hand or AI judge, root cause suggested (guardrail / retrieval / generation). `rate`, `gates`, `report` = line-for-line port of `score_eval.py` (Python half-even rounding). `evaluate` → overall score (mean of per-question scores) vs threshold + the 5 gates → pass / block. `resultsCsv` = score_eval / `build_xray.py --from-eval` input (checked: both scripts accept it). |
| `samples.js/.json` | Card-dispute bot, 10 questions (6 high risk, 1 must_escalate, 1 must_refuse), knowledge passages as context. EN Harbor Bank: DSP-02 answers "180 days" while the source says 120 → faithfulness 0 + correctness 0 → overall **96.7 % ≥ 90 % but BLOCKED** (high-risk faithfulness 80 %, weakest category 50 %). FR Banque Lumière: CTS-02 says "180 jours", source "13 mois (art. L133-24 CMF)". |
| `logic.test.mjs` | Runs `score_eval.py` on both samples + 40 random result sets (with baselines): **42/42 reports identical**, plus the EN block story. |

Screen: command bar = Release threshold (%) · Run label, primary "Score answers ⌘↵". Config pane: tabs Golden Q&A set |
Model answers (CSV, parse summary, missing answers listed), Advanced = the 5 gate thresholds, "Apply judge scores (JSON)",
clear manual scores. Results: verdict card (PASS / BLOCKED, overall %, threshold bar with marker, reasons incl. the exact
unsupported claim "… 180 days …: 180 days is not in the retrieved sources") → gates table → question table (7 metric cells
✓ ✗ —, dashed outline = set by hand, score) → detail of the selected question (question, expected, answer, sources,
claims supported / not supported with why, correctness / citation notes, per-metric override selects, root cause select).
Exports: results CSV, Markdown (localized verdict + per-question table + the verbatim `score_eval.py` report). AI: "Judge
faithfulness and correctness with Claude" (expects JSON overrides → paste into Advanced), "Explain failures and owners".

## Demo script (60 s each)
1. **UAT**: Load sample Visa EN → gauge NO-GO 1/5, red, reasons name CARD-301 and CARD-303/304/310. In Test runs set UAT-09
   to Pass and UAT-12 to Fail → the day fills with 8, UAT-12 gets "Fail without defect" + "No evidence", gauge updates.
   Defects tab: tick "Workaround accepted" on CARD-303/304/310 and close CARD-301 → criteria move. Export ▾ Markdown = daily report.
2. **Xray**: Load sample → "1 errors · 1 warnings". Click CARD-T02, change labels to `cards high-risk` → "Ready to import".
   Switch to Server / DC → results JSON shows `PASS` / `testType`, step-column warning *to confirm*. Add tests from › The UAT
   tracker → 24 manual tests with their results. Export ▾ Xray CSV.
3. **RAG**: Load sample → BLOCKED although 96.7 % ≥ 90 %: DSP-02 invents a 180-day window. In the detail set Faithfulness
   and Correctness to Pass → PASS (shows why overrides need a human). Export ▾ results CSV → runs in score_eval.py / build_xray.py --from-eval.

## Checks done
- Parity tests above (node; need python3).
- jsdom harness mounting each tool through the real tool-frame (demo mode, EN + FR samples, autorun): zero JS errors;
  interactions scripted (status change + day fill + flags; label fix + target switch + import from UAT; overrides → PASS).
- Static export (`export_static.py`): `data/samples/{uat-tracker,xray-builder,rag-eval}.json` exported; the three tools mount
  from the exported tree with zero errors in jsdom. All exports and AI prompts build in EN and FR.
- CSS: tokens only, no hex. Icons limited to ids present in `icons/lucide.svg`.

## Open issues
- **Screenshots and a real-browser pass are still to do** (sandbox, see top): someone with port binding / Edge should run
  `PORT=4307 python3 app/server/server.py` and shoot `screenshots/v2/G-{uat-tracker,xray-builder,rag-eval}-{light,dark}-{en,fr}.png`.
  Light/dark contrast and the 1 280 / 390 px FR checks are unverified.
- In `single` layout the frame shows no status strip, so the UAT / Xray status pills set via `setStatus` are not visible.
- Xray *to confirm*: bulk test JSON field names (`testtype`, `gherkin_def`, `unstructured_def`, `xray_requirements`,
  `xray_test_repository_folder`), Server/DC bulk endpoint, the Server/DC "Step" column name and repository path column.
  Visa / CB response and listing action codes in the samples are marked *to confirm*.
- "From the API tester" reads `state.cases` / `state.req` as documented in C's `logic.js` header; not tested against a saved
  C workspace (C's index.js was still a stub when checked).
- RAG offline checks are lexical heuristics (numbers + words); paraphrased answers may need an override or the AI judge.
- No `app/server/tools/schemas/*.json` for `kit.py patch` (not my file).
