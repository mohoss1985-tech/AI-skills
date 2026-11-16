# Audit 2 · PRD builder, Story builder, SFD builder, UAT tracker, Xray builder

Auditor 2 of 4 · 2026-11-16 · paths are relative to `app/web/js/tools/`.

**How each finding was checked** (quota was tight, so not everything went through the browser):
- **[live]** = seen on the live site in headless Edge. **[node]** = reproduced by calling the tool's own `logic.js` in Node 22 with my own input (disputes / chargeback scenario, not the sample). **[code]** = read in the code only.
- No console errors or exceptions on the live pages I loaded (prd-builder empty + sample EN, sfd-builder).

**The one finding that covers all five tools: the traceability is cosmetic across tools, real only inside each tool.**
Inside a tool the links are real and checked (PRD goal → requirement → metric; SFD rule → story → field; Xray test → requirement key). Between tools nothing is linked:
- Each sample uses a different id scheme for the same storyline: PRD `FR-1…FR-8`, Story builder `S1…S3` / `R1…R5`, SFD `RG-01…RG-09`, UAT and Xray `CARD-110…CARD-114`. Nothing maps `FR-3` to `RG-03` to `CARD-112`.
- The Story builder "source" (`PRD FR-1, FR-2 · SFD RG-01 to RG-04`) is free text, never checked. The SFD story list is typed by hand.
- `sfd-builder/logic.js:174` says the rules CSV "feeds the Xray builder and the UAT tracker". It does not: pasting it in the UAT tracker returns the `noStatus` error [node], and the Xray builder only imports from the UAT tracker and the API tester (`xray-builder/index.js:105-106`).

---

## 1. prd-builder

**Score: Wk (works but weak).** The trace meter and checks are real and good; the "Build draft" step mangles ordinary input and the Jira export is not import-ready.

### Bugs
1. **Leading digits are eaten.** Scope line `3DS data is attached to the dispute` → requirement `DS data is attached…`; `24/7 intake of dispute requests` → `/7 intake…`; goal `3DS challenge rate: 12% → 8%` → `DS challenge rate`. Expected: text kept. Cause: `prd-builder/logic.js:49`, the list-marker strip `^\s*[-*•\d.)]+\s*` removes any leading digits, not only `1.` / `2)`. [node]
2. **Metric parser splits on "de" / "from" inside the name.** `Taux de blocage dans l'appli: 38 % → 70 %` → name `Taux`, baseline `blocage dans l'appli: 38 %`. `Share of calls from customers: 38% → 70%` → name `Share of calls`, baseline `customers: 38%`. Expected: split at the colon. Cause: `logic.js:54`, lazy `(.*?)` takes the first of `:`, ` from `, ` de `. This hits most French metric names. [node]
3. **Every scope line is traced to G1.** With 3 goals, Build draft gives G2 and G3 "has no requirement" (2 blocking checks) and all requirements "Must". Cause: `logic.js:75`. Expected: leave the goal empty (honest orphan) or ask. [node]
4. **Goal = metric name.** Build draft copies the metric name into the goal (`G1: Disputes filed within deadline`). A goal is an outcome, not a measure. Cause: `logic.js:66`. [node]
5. **Jira CSV will not build the epic → story link.** `Parent` holds the epic's title and there is no `Work item ID` column. Atlassian's page asks for three columns, "Work item ID", "Work type" and "Parent", with Parent holding the parent's Work item ID number (see §2). Cause: `prd-builder/index.js:267-273`. [code]
6. **Last workspace comes back in the wrong language.** After the CB FR sample was loaded once, opening the tool in the EN interface shows the French PRD (`O3`, `EX-6`); I saw no "New / Clear" button in the button list. Cause: `shell/tool-frame.js:343-358` restores the last workspace whatever its language; `reset()` exists (line 328) but I did not find it wired to a visible button (not fully checked). Applies to all tools. [live, `shots/prd-builder-01-empty.png`]

### Example problems
- The sample is good (real numbers, the 18 Oct stand-in incident, two gaps left on purpose). But it opens on the **Requirements** tab with 8 rows of inputs; the "aha" (two red checks → fix → 100 %) is not signposted.
- The four command-bar inputs are pre-filled with a 2-line scope while the sample has 8 requirements: the link between "what I typed" and "what was built" is not visible.
- Better opening: land on the Trace tab (goal × requirement × metric matrix) with a one-line hint "Fix the 2 red items to reach 100 %".

### Best-in-class
No web research done for this tool (quota). From my own knowledge, not re-checked today: Productboard, Aha! and Jira Product Discovery all sell the same view, a live objective → feature → metric tree. That is the 20 % to copy.

### V3 plan
1. Fix the two parsers (bugs 1, 2) and add them to a `logic.test.mjs` (S).
2. Build draft: do not auto-assign G1; show orphans and offer a one-click "assign to goal" (S).
3. Open the sample on a **trace tree** (goal → requirements → metrics) with the two gaps highlighted; clicking a gap focuses the cell to fix (M).
4. Jira CSV: add `Issue Id` / `Parent` id columns so the epic → story hierarchy imports (S, see §2).
5. Add "New" next to "Load sample"; restore the last workspace only in its own language (S).
6. Carry the requirement ids forward: "Send to Story builder" creates stories with `source = FR-n` as a real link (M).

### Talking points
- **Replaces:** Confluence PRD template + Productboard / Aha! goal tracking.
- **What it does:** Builds a PRD where every goal has a requirement and a metric, and shows what is missing.
- **How it works:**
  - Type problem, users, goal metric, scope → Build draft.
  - Fix the red checks until the trace meter is 100 %.
  - Export Word, Markdown or a Jira CSV.

---

## 2. story-builder

**Score: Wk.** The sample output is hand-over quality. What the tool generates from your own input is not: broken story sentence, nonsense after "split", and a Jira CSV that will not build the epic link.

### Bugs
1. **Story sentence is ungrammatical.** Feature `Dispute a card payment in the app` → `As a cardholder, I want dispute a card payment in the app.` Expected `I want to dispute…`. Cause: `story-builder/logic.js:53` sets `want = lowerFirst(feature)` with no "to" (the sample hides this because its `want` is hand-written). [node]
2. **"Split by rule" writes nonsense stories.** → `As a cardholder, I want a fraud dispute needs the card to be blocked first.` and an empty "so that". Cause: `logic.js:80`, `want = lowerFirst(rule text)`. Expected: keep the parent's want, put the rule in the title. [node]
3. **Leading digits eaten in rules.** `3 documents max per dispute` → rule `documents max per dispute`. Cause: `logic.js:26` (same regex as PRD bug 1). [node]
4. **"Given Given".** A user who types `Given Sam has…` in the Given box gets `Given Given Sam has…` in the .feature and the Jira description. Cause: `logic.js:174-176`, keywords are not stripped. [node]
5. **Third label is dropped silently.** Labels `cards disputes extra` → CSV has only `cards`, `disputes`. Cause: `logic.js:217,223`, two fixed `Labels` columns. [node]
6. **Jira CSV: `Parent` = epic name (`PAN declaration`), no Epic row, no `Work item ID`.** Checked against Atlassian's CSV import page (https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/): hierarchy needs the columns "Work item ID", "Work type" and "Parent"; Parent must "reference the unique Work item ID number"; parents must come before children. So the stories import, the epic link does not. What is right: Summary present (the only required field), repeated `Labels` columns, quoted multi-line cells, UTF-8. The header says `Issue Type`; the page now says "Work type" (mapped by hand in the wizard either way). Cause: `logic.js:217-223`. [node]
7. **Story id and dependencies are not exported.** `S1`, `dependsOn: S1` and the story's rule ids are absent from the CSV, so the trace to SFD/UAT is lost at the Jira boundary. [node]
8. **"Generate examples" stubs export as real scenarios.** A stub is a `Scenario` with a name and one `Given`, no When/Then; it goes into the .feature and the CSV unless the user removes it. Cause: `logic.js:90-100` + `toFeature`. Expected: skip or tag `@wip`. [node]

### Example problems
- The sample (3 stories, 11 scenarios, the stand-in case as E4) is the best of my five tools; a senior BA would hand over its Gherkin as is.
- The home card promises "Workshop notes → user stories → Jira CSV", but offline the tool does not turn notes into stories: it puts every rule in one story and stubs. The promise is only true with the pre-built sample.

### Best-in-class
Atlassian CSV import page above (the hierarchy columns). From my own knowledge, not re-checked today: Cucumber's example mapping (four card colours: story, rule, example, question) is the method this tool already follows; showing it as cards is the "wow".

### V3 plan
1. Fix the sentence builder and split (bugs 1, 2, 4) (S).
2. Jira CSV: Epic row + `Issue Id` / `Parent` ids, all labels, story id as a label or in the summary, Gherkin wrapped in a code block (S).
3. Make the example-mapping board the hero: yellow story, blue rules, green examples, red questions as cards, with a live Gherkin pane beside it (M).
4. A real offline "notes → rules" step: split pasted notes into rule / example / question cards by simple cues ("must", "if", "?", numbers) (M).
5. Do not export stubs; show "3 rules have no example" instead (S).
6. Take requirement ids from the PRD builder and show them as chips on each story (M).

### Talking points
- **Replaces:** Jira story writing + Cucumber example mapping (Miro board).
- **What it does:** Turns business rules into user stories with Gherkin scenarios and checks them against INVEST.
- **How it works:**
  - Type the feature, persona and rules → Build map.
  - Add examples per rule; INVEST shows what blocks "ready".
  - Export a Jira CSV or a .feature file.

---

## 3. sfd-builder

**Score: W (works).** The most solid of the three spec tools: numbering, field parsing and the rule checks behave on my own input. Weak points are the trace claims and small parser gaps.

### Bugs
1. **A duplicate rule id is renumbered silently.** Two lines starting `RG-05` → the second becomes `RG-08` with no message. Cause: `sfd-builder/logic.js:80`. Expected: a warning. [node]
2. **`1.` list numbers are kept in the rule text** (`RG-07: 1. The merchant should be contacted first`), the opposite of the PRD/Story parsers. Cause: `logic.js:23` strips only `- * •`. [node]
3. **A field that points at a rule that does not exist yet is a blocking error right after Build** (`Disputed amount → RG-02` when numbering started at RG-05). Correct, but the message does not offer the fix. [node]
4. **`€` never detects an amount.** `\b(…|€|eur)\b` cannot match `€` (not a word character), so `Amount in €: number` relies on the typed type. Cause: `logic.js:10`. [code]
5. **"Test idea" is the example with a prefix**, not a test. `logic.js:166`. A senior BA would delete that column.
6. **Rules CSV does not feed the UAT tracker or Xray builder** (see top). `logic.js:174`. [node]

### Example problems
- Strong sample (9 rules, each with a worked example, RG-03 = the incident). The Word export is an HTML `.doc`: fine to open, but check the look before a demo.
- The stories column (`S1`) only means something if the viewer has seen the Story builder sample first.

### Best-in-class
No web research done for this tool (quota). From my own knowledge: Jira + Xray or Jama show a requirement × test coverage matrix; that matrix is the feature to copy.

### V3 plan
1. "Import stories" from the Story builder workspace (same pattern as `xray-builder/index.js:318`) so rule → story is a real link (M).
2. "Send rules to Xray builder": one Manual test per rule, the example as expected result, requirement = story key (M).
3. Trace view as a matrix (rules × stories) with clickable cells, not a table of ids (M).
4. Parser fixes 1, 2, 4 (S).
5. Replace "test idea" by a generated Given/When/Then skeleton from the example (S).

### Talking points
- **Replaces:** the Word functional-spec template (SFD) + an Excel traceability matrix.
- **What it does:** Numbers the business rules, lists the fields and shows which story each rule serves.
- **How it works:**
  - Type the feature, rules and fields → Build tables.
  - Give each rule an example and a story.
  - Export Word or the rules CSV.

---

## 4. uat-tracker

**Score: W.** The best "it works" of my five: the sample gives a clear NO-GO with reasons, a burn-up and defects by severity; three exports download; no console errors. One counting rule would be challenged by a test manager. [live, `shots/uat-tracker-02-sample-en.png`]

### Bugs
1. **"Every requirement has a passed test: 5 / 5" is shown green while 4 of the 5 requirements have a failed or blocked test**, including CARD-112, the headline incident (UAT-09 failed, UAT-10/11 blocked). Cause: `uat-tracker/logic.js:58,95`, a requirement counts as covered if *any* of its tests passed. Expected: a requirement is OK only when all its tests passed (this is how Xray reports requirement status, from my own knowledge, not re-checked today). With that rule the sample would show 1 / 5, which is the honest picture. [live + node]
2. **Sample note says "2 of 5 met"; the tool shows 1 of 5.** `uat-tracker/samples.js:4`. Comment only, but check the Guide text. [node]
3. **Unknown run statuses become "not run" quietly.** `ABORTED` (a default Xray Server status) is counted as not run; it is returned in `unknown` (`logic.js:132-136`) — check the UI shows it. [node]
4. **"Blocked" leaves the tool as `BLOCKED`** in the runs CSV (`logic.js:174`) but becomes `TODO` when sent to the Xray builder (`xray-builder/logic.js:334`). Same case, two statuses.
5. **The SFD rules CSV cannot be pasted here** (`noStatus`), although the SFD builder says it feeds this tool. [node]

### Example problems
- Good, realistic sample (day 8 of 10, 24 cases, 7 defects, the 160-minute listing as CARD-301).
- The command bar asks for four numbers before anything is visible; the valuable action (set a status on a case and watch the verdict move) is far down the page.
- Better demo move: "Close CARD-301 and pass UAT-09/10/11" as a one-click what-if that turns the gauge.

### Best-in-class
From my own knowledge, not re-checked today: Xray test execution and coverage reports, TestRail run dashboards. Worth copying: requirement status as the worst of its tests, and a what-if on the exit criteria.

### V3 plan
1. Requirement coverage = all tests passed; show OK / failed / not run per requirement (S).
2. What-if mode: tick defects as fixed, see the verdict and the gauge change, then reset (M).
3. Put the run grid first with one-click status chips; the verdict updates live, no "Evaluate" press (M).
4. Accept the SFD rules CSV and the Story builder scenarios as case lists (status = not run) (S).
5. Same status vocabulary in and out (Blocked) and a visible note for unknown statuses (S).
6. One-page sign-off report (PV de recette) with the decision maker's name, as Word (S).

### Talking points
- **Replaces:** the Excel UAT tracker + Xray / TestRail execution dashboard.
- **What it does:** Follows a UAT campaign day by day and says go or no-go, with the reasons.
- **How it works:**
  - Load or paste the test runs and the defects.
  - Set each case to passed, failed or blocked.
  - Read the go / no-go and export the report.

---

## 5. xray-builder

**Score: Wk.** The editor, validator and five exports work with no console errors, and the import guide is something I would hand over. But "validated export" does not stop a bad file, and the CSV covers only half of what the Xray importer accepts. [live, `shots/xray-builder-02-sample-en.png`]

### Format check against the Xray Cloud Test Case Importer page
Source: https://docs.getxray.app/display/XRAYCLOUD/Importing+Tests+using+Test+Case+Importer
- **Matches:** one id column that groups the rows of a test (the doc calls it "Issue Id", shown as "Test ID" in mapping); Summary and Test Type present (both required); repository folder as a `/` path; link fields hold issue keys; delimiter `,`; quoted multi-line cells.
- **Does not match:** the doc lists **Gherkin Definition** and **Unstructured Definition** as mappable fields, so Cucumber and Generic tests *can* go in the CSV. The tool leaves them out (`xray-builder/logic.js:126`, manual only) and tells the user they are "not CSV" (`logic.js:105-106`). In the sample, 3 of 6 tests are missing from `tests-cloud.csv`.
- **Does not match:** the doc has real **Preconditions** (issue type + "Precondition Specification"). The tool writes the precondition into the Description as text.
- **Not confirmed by the page text:** the step column names (Action / Data / Expected Result are only in the doc's images) and a Labels field. The doc gives a limit the tool does not check: **1,000 issues per import**.
- **Bulk JSON** (`tests-cloud.json`): `xray_requirements` is marked *to confirm* in the code itself (`logic.js:226`). I did not verify it either. Do not present this file as import-ready until one real import has been done.

### Bugs
1. **Export works with validation errors.** Sample has 1 error (label `high risk`); `tests-cloud.csv` still downloads with the bad label in it. Expected: block, or warn in the toast and the file name. Cause: `xray-builder/index.js:383`, `build` never calls `validate`. [live]
2. **Cucumber and Generic tests are dropped from the CSV** (see above). [node]
3. **Pasted tests get ids like `CARD-T-01`** while the sample uses `CARD-T01`. Cause: `index.js:307` prefix `CARD-T` + `-`. [node]
4. **A pasted numbered list becomes tests with no steps** (`1. Duplicate payment refunded once`), which then fail validation one by one (`noSteps`). Expected: one starter step. `logic.js:285-300`. [node]
5. **Tests brought from the UAT tracker have one step whose action is the test title** (`logic.js:337`). Valid for import, weak as a test.

### Example problems
- Good sample: 6 tests of 3 types, one error left on purpose. But the fix that makes it pass (rename a label) is trivial; it does not show why the validator matters.
- Stronger story: paste a messy Excel header (`TC ID; Title; Steps; Expected`) → the column checker renames it → Validate → export. That shows a real pain being solved.

### Best-in-class
Xray importer page above. Worth copying: saving the column mapping as a configuration file, and a preview of what will be created (n tests, n steps, n links) before import.

### V3 plan
1. Gate the export: errors block CSV / JSON, with a "download anyway" link (S).
2. One CSV for all test types, with Gherkin Definition and Unstructured Definition columns, and Preconditions as their own rows (M).
3. Import preview panel: "6 tests · 9 steps · 6 links to 2 stories · 1 folder", like the importer's last screen (S).
4. Coverage strip: each requirement key with its tests and their last result; this is the real trace to the Story builder (M).
5. "Bring stories from Story builder": each scenario becomes a Cucumber test linked to its story key (M).
6. Mark the bulk JSON as "unverified format" or remove it until tested on a real Xray (S).
7. Fix ids and the empty-step paste (S).

### Talking points
- **Replaces:** Jira + Xray Test Case Importer, and the Excel sheet testers prepare for it.
- **What it does:** Writes test cases and checks them before export, so the Xray import works first time.
- **How it works:**
  - Add or paste tests; link each to a story key.
  - Validate for Xray Cloud or Server / DC.
  - Export the CSV, the results JSON and the import guide.

---

## Shared notes for the lead
- **Blank tool if browser storage hangs.** `shell/tool-frame.js:345-361` awaits `store.list()` before the first mount, with no timeout. When I left an IndexedDB delete pending in my own test, all tools opened with no input fields and no error. Provoked by my test, not seen in a fresh profile, but a 1-second timeout would make it safe (S).
- In a fresh profile all five tools open with a proper empty state and their inputs. No console errors anywhere.
- Not tested (quota): the FR interface, the Word exports opened in Word, "Copy prompt for Claude", the local server build. A real Jira or Xray import was not possible; format findings come from the two doc pages.

## Summary

| Tool | Score | Top bug | Top V3 change |
|---|---|---|---|
| prd-builder | Wk | Build draft eats leading digits and splits FR metric names on "de" | Trace tree with the gaps highlighted; fix the parsers |
| story-builder | Wk | "I want dispute…" and nonsense stories after split; Jira `Parent` is a name, not an id | Fix sentence builder; Jira CSV with Work item ID + Epic row |
| sfd-builder | W | Rules CSV does not feed UAT / Xray as claimed | Real import of stories and "send rules to Xray" |
| uat-tracker | W | Requirement shown covered (5/5) when its tests failed | Coverage = all tests passed; what-if on defects |
| xray-builder | Wk | Export downloads with validation errors; Cucumber / Generic missing from CSV | Gate the export; one CSV for all test types |
