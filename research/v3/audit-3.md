# Audit 3 · bpmn-editor, journey-builder, mapping-grid, impact-heatmap, rag-eval

Method: live site (https://mohoss1985-tech.github.io/AI-skills/, file hashes identical to this repo) driven in headless
Edge over CDP at 1440×900; every sample, own input, every export, FR. No console errors on any of the five tools unless noted.

## 1 · bpmn-editor

**Score: Wk (works, but the diagram is unreadable in the page).** The engine is the strongest of my five tools: real BPMN 2.0,
real bpmn-js modeler. What the user sees is a 548×438 px keyhole.

**Is it real BPMN 2.0? Yes — verified.**
- The `.bpmn` export validates against the official OMG schema: `xmllint --schema BPMN20.xsd` → "validates" (XSDs from
  omg.org/spec/BPMN/20100501). It has `collaboration` + `participant` + `laneSet` with `flowNodeRef`, typed nodes
  (`startEvent`, `sendTask`, `exclusiveGateway`, `endEvent`…), `incoming/outgoing`, and full BPMN DI (32 shapes, 22 edges
  with waypoints). Namespaces and `targetNamespace="http://bpmn.io/schema/bpmn"` are exactly what bpmn.io / Camunda Modeler write.
- The canvas IS bpmn-js 18 (the library behind demo.bpmn.io and Camunda Modeler); it re-imports our XML after reload with no
  warning, so the file opens in those tools. Not checked: Signavio/Bizagi (the Markdown export claims both — unverified claim).
- Editable: double-click a task → rename works, the step table updates in 250 ms, badge switches to "Edited in the canvas".
- Exports all work: .bpmn (13 KB), SVG (1828×660), PNG (2×), step CSV, Markdown.

**Bugs**
1. **Diagram is cropped and tiny.** `?sample=en` → canvas is 548×438 px; `readableFit` keeps 65 % zoom so only 2 of 11
   elements are visible (shot `bpmn-editor-en-live.png`). Click "Fit to screen" → scale 0.30, a task is 39×24 px, labels
   illegible (`bpmn-editor-fit.png`). Expected: the whole flow readable on load. Cause: `layout: 'split'` gives the canvas
   less than half the page (index.js:316) and the fixed wrap height (tool.css:28); the left pane spends the space on a
   steps textarea + a duplicate step table. `readableFit` (index.js:63-70) only chooses between two bad options.
2. **Canvas edits never flow back to the steps text.** Rename a task in the canvas → table updates, textarea does not.
   Press "Generate diagram" → edits are replaced (an "Undo" note shows for 12 s, index.js:361, :150). Expected: either
   regenerate the outline from the model (there is already `modelText`/`stepRows`) or lock the text once edited.
3. **A repeated decision line silently creates a second gateway** with the same name and one exit (my own input: decision
   referenced again as a branch target). Only a "Tip" appears. Expected: branch to an existing step by name reuses it
   (the `@name` jump exists but nobody will discover it; logic.js `resolve`, :103-110).
4. **Status pill contradicts the Checks tab after reload**: pill says "No issues" while Checks lists a tip; the "lane added"
   warning is lost on reload because `live.parse` is reset in `mount` (index.js:323) and tips are excluded from the count (:99).
5. **Label placement**: the "Yes" exit label of a gateway sits one lane away from its gateway (at the lane border), and the
   gateway name is crossed by the outgoing edge (`bpmn-editor-export-svg.png`; label maths in logic.js `buildXml`).
6. Markdown export states "Opens in Camunda Modeler, bpmn.io, Signavio and Bizagi" (i18n `mdDiagramLine`) — two of four untested.

**Example problems**
- Samples open finished: diagram, table and checks are all there, "No issues". The user never types a step or presses
  Generate, so the magic (text → swimlanes) is never seen. The syntax help is collapsed and the grammar (`Yes →`, `@id`,
  `(end)`) is the whole product.
- The sample is good domain-wise (STIP, Exception File) but too clean: zero lint findings, so the Checks tab looks dead.
- Better scenario: open with the steps text filled and the canvas empty with one big "Generate diagram" button; ship the
  sample with one deliberate flaw (an unlabelled exit on "Approved?") so Checks shows a finding with a "Show" button, then a
  one-click fix. Second sample "Chargeback 13.1" already exists and has a loop — make it the "advanced" one.

**Best-in-class**
- bpmn.io / Camunda Modeler (https://demo.bpmn.io, https://github.com/bpmn-io/bpmn-js): big canvas, context pad
  (append next shape from the selected one), minimap, properties panel.
- bpmn-js-token-simulation (https://github.com/bpmn-io/bpmn-js-token-simulation): press play, a token walks the flow and
  waits at gateways for the presenter to choose — the single biggest "wow" for a demo, and it is a drop-in bpmn-js module.
- bpmnlint (https://github.com/bpmn-io/bpmnlint) with on-canvas badges: errors pinned on the faulty shape, not in a tab.
- Text-to-diagram tools (Mermaid live editor, PlantUML): text left, diagram right, **live** re-render on every keystroke.

**V3 plan**
1. (M) Canvas-first layout: canvas full width and ≥ 600 px high, steps text in a collapsible left drawer (or tabs
   "Text | Diagram"), plus a full-screen button. Fit must give ≥ 0.6 scale for the 11-node sample.
2. (M) Live preview: re-generate 400 ms after typing while the diagram is not hand-edited; keep the button for the rest.
3. (L) Token simulation: vendor bpmn-js-token-simulation, "Play" button; user picks Yes/No at each gateway.
4. (M) Lint overlays on the canvas (bpmn-js `overlays`) from the existing `lint()`; clicking opens the fix hint.
5. (M) Two-way sync: after a canvas edit, rebuild the outline text from the model, or show "text is out of date · rebuild".
6. (S) Sample opens un-generated with one seeded flaw; syntax cheat-sheet visible as chips that insert a line.
7. (S) Fix label positions for cross-lane exits; make pill and Checks tab count the same things; drop unverified tool names.

**Talking points**
- **Replaces:** Camunda Modeler / bpmn.io, Visio, Signavio for a first process draft.
- **What it does:** Turns a typed list of steps into a standard BPMN swimlane diagram you can edit and export.
- **How it works:**
  - Name the actors, type one step per line.
  - Press Generate: lanes, tasks and decisions are laid out.
  - Edit on the canvas, export .bpmn for Camunda.

## 2 · journey-builder

**Score: Wk (the simulator is real, but hidden below the fold and matching is keyword-only).**

**Does the simulator really converse through the flow? Yes.** Typed "my wallet was stolen yesterday" → took the *Stolen*
branch, ran the block action, asked about the replacement. "someone took it from my bag" → fallback (miss 1) → re-prompt;
gibberish → miss 2 → hand-off to an advisor. Conditions ask the presenter for the "system result". The current node and the
taken edge are highlighted. Voice channel adds real checks ("4 options: keep 3 at most"). Exports work: journey JSON, Mermaid,
Markdown with Gherkin-style acceptance criteria.

**Bugs**
1. **The test chat is off-screen.** At 1440×900 the chat panel starts at y = 892 (measured); the canvas is 548×478. The
   one feature that sells the tool needs a scroll, and then the canvas is out of view, so you cannot watch the node light up
   while you chat. Cause: the stage sits in the right half of a split layout (548 px), which triggers
   `@container (max-width: 820px)` → canvas and chat stack vertically (tool.css:36).
2. **Test utterances are never tested.** Advanced → "Test utterances" holds 10+ messy phrasings, but they only go into the
   export and the AI prompt (index.js:509, logic.js:246). Nothing runs them through `matchReply`. Expected: a "Run all" table
   (utterance → branch taken → pass / fallback).
3. **Matching is literal.** `matchReply` (logic.js:127-146) scores exact / substring / one shared word ≥ 4 letters. "someone
   took it" misses *Stolen* unless the author typed that alternative. Acceptable for a no-AI demo, but the UI never says
   "keyword matching", so a miss looks like a bug of the tool rather than a gap in the design.
4. **Grammar is easy to get wrong and fails noisily.** My own flow used indented option lines without `Label →` and
   `Check: Decline reason [A | B | C]`: result 15 nodes, 7 checks, the option list kept inside the condition text
   ("Condition "Decline reason [Insufficient funds | …]" has fewer than two branches"). Expected: `Check:` accepts `[options]`
   like `Ask:` (parseLine only strips options for questions, logic.js:34), and a bare indented label is read as a branch.
5. Canvas edits vs steps text: same one-way problem as the BPMN editor ("Build flow" rebuilds from text).
6. Edges are drawn only through a small "Connect from …" port per node (14 in the sample); not tested by mouse.

**Example problems**
- Opens finished: 17 nodes, "No issues", chat already three lines in. The user is not told "now type what a customer would say".
- The best story (two misses → human hand-off; fraud branch → fraud advisor with 90 days of payments) is not signposted.
- Better: open with the chat **beside** the canvas and three suggested test messages as chips: "my wallet was stolen
  yesterday" (happy path), "someone took it" (fallback), "asdfgh" twice (hand-off). Seed one flaw — a question without a
  fallback — so Checks shows a red "Fix" and the chat shows "Unhandled input" when the presenter hits it.

**Best-in-class**
- Voiceflow (https://www.voiceflow.com): canvas with a "Run" prototype panel docked on the right; the active block is
  highlighted as you talk; share link for stakeholders; variables shown live.
- Botpress Studio emulator (https://botpress.com/docs): chat emulator with a debugger pane (matched intent, confidence).
- Rasa test stories / Botium (https://rasa.com/docs): a table of test conversations run in batch with pass/fail — the
  regression habit a BA should show.

**V3 plan**
1. (M) Three-column stage: steps drawer (collapsible) | canvas | docked chat, all visible at 1366×768. Remove the 820 px stack.
2. (M) "Run all utterances": batch table (utterance · expected branch · branch taken · pass/fallback/unhandled) with a
   coverage pill "9/12 handled"; click a row to replay it in the chat.
3. (S) Debug line under each user turn: "matched *Stolen* on 'stolen' (keyword)" or "no match → fallback"; one-click "add
   this phrasing to branch …".
4. (S) Suggested-message chips and a 3-step hint in the chat header; sample opens with the chat at turn 0.
5. (S) Parser: options on `Check:`, bare indented labels as branches, clearer error with the line number.
6. (M) Path coverage: after tests, colour nodes never visited; export the transcript as a UAT script.
7. (S) Check and, if needed, enlarge the connect handles on node hover/selection.

**Talking points**
- **Replaces:** Voiceflow / Botpress prototype, or a Visio flow nobody can test.
- **What it does:** Lets you design a chatbot conversation and talk to it before any developer builds it.
- **How it works:**
  - Write the bot's steps and the customer's possible answers.
  - Type as a customer in the test chat.
  - Watch the path light up; fix dead ends it flags.

## 3 · mapping-grid

**Score: W (works; the record test is real) — but it reads as a wall of form fields and a correct mapping looks failed.**

**Does the test really transform a record? Yes.** A small SQL-expression interpreter (logic.js:296-357: `TRIM`, `UPPER`,
`ROUND`, `CAST … AS DATE`, `SUBSTR`, `COALESCE`, `||`, `* /  + -`, translation tables) runs on each keystroke. Sample:
amount `64.90` → `ROUND(src.amount * 100)` → `6490`; `eur` → `EUR`; `STOLEN` → T-01 → `1`; `pos_entry 81` → T-02 → `ECOM`;
timestamp → date. My tampering: empty ARN → "Held: mandatory and empty"; `PHISHING` → "not in T-01: held for the analyst";
`18/10/2026` → "Rejected: not a date"; `LOWER(SUBSTR(src.currency,1,2))` → `eu` → "Rejected: not an allowed value".
Exports work: mapping CSV, reconciliation SQL (3 dialects), Markdown spec.

**Bugs**
1. **A good mapping shows 8 warnings.** Sample → the Check column reads "Warning" on 8 of 9 rows and the header says
   "Checks · 0 / 8" (unexplained numbers). The warning is "mandatory, no default: records with an empty arn will be
   rejected" on every mandatory field, which is the *intended* behaviour for a regulatory report. Expected: info level, or
   only when the source is nullable. Cause: the ported `check_mapping.py` rule in `checkMapping` (logic.js:92-166).
2. **Every evaluation failure gives the same message.** Amount `1,234.5` → "Not evaluated… check it by hand" and the raw
   value is passed to the output; `FOO(src.arn)` → same. Expected: "1,234.5 is not a number" (Rejected) and "Unknown
   function FOO". Cause: one catch-all (logic.js:391-393) that drops the thrown reason (`nan`, `fn FOO`, `unknown x`).
3. **No status pill, and "Check mapping" (the primary button, ⌘↵) changes nothing visible** — everything already updates
   live. The primary action should be the test ("Run on sample record" / "Run on 20 records").
4. **Data-quality rules are decoration.** DQ-01…05 are typed and linked per row but never evaluated in the preview: a
   reported date one day *before* the transaction date passes as "To confirm" (DQ-04 is a date-order rule).
5. **One record only.** No paste/CSV of several source rows, no pass/held/rejected counts.
6. SQL export header says "Generated by check_mapping.py from fraud_report-mapping.csv" — neither exists for the user.
7. Three raw CSV-like textareas (source, target, rules) are the first thing seen; the format help is one grey line each.

**Example problems**
- Opens finished and green-ish; the "edit a source value and watch the output" moment sits at the bottom of a long page
  under a 9-row form grid. Nobody will find it in a 60-second demo.
- Scenario is strong (fraud case → Visa fraud report, never the PAN) and should stay. Make it show its teeth: ship 5 source
  records, of which one has reason `PHISHING` (not in T-01), one has an empty ARN, one a clear PAN in `card_token`
  (the Luhn check at logic.js:404 is excellent and invisible today). Result line: "5 records · 2 loaded · 2 held · 1 rejected".

**Best-in-class**
- Altova MapForce / Talend / Informatica mapper (https://www.altova.com/mapforce): source tree left, target tree right,
  **lines drawn between fields**, function boxes on the lines, live output preview tab.
- dbt tests + Great Expectations (https://docs.getdbt.com/docs/build/data-tests): named rules (`not_null`, `unique`,
  `accepted_values`, `relationships`) run on data with pass/fail counts — the model for making DQ rules executable.
- Flatfile / OneSchema importers: auto-map by name with confidence, then a grid of rows with per-cell error highlighting.

**V3 plan**
1. (M) Batch test: a grid of 5–20 source records (paste CSV) → output grid with per-cell status colours and a summary pill
   "2 loaded · 2 held · 1 rejected"; make it the primary action and move it to the top right.
2. (M) Visual map: two columns of field chips with SVG lines (source → target), the transformation as a label on the
   line; clicking a line opens the row editor. Keep the table as "Grid view".
3. (S) Real error messages from the evaluator (unknown function, not a number, unknown field) and a function picker with
   one-line examples.
4. (M) Executable DQ rules for the 4 common kinds (not null, unique key, accepted values, date A ≤ date B) evaluated on the
   batch; show rule → n failing.
5. (S) Downgrade "mandatory, no default" to a note; explain the "0 / 8" header as "0 errors · 8 warnings"; add the status pill.
6. (S) Generate the `INSERT … SELECT` transformation SQL as an export next to the reconciliation SQL; fix the header text.
7. (S) Replace the raw textareas with small editable tables (keep "paste CSV").

**Talking points**
- **Replaces:** the Excel mapping sheet, plus a first pass of Talend / MapForce / dbt tests.
- **What it does:** Maps source fields to a target format and proves the mapping on real sample records.
- **How it works:**
  - List source and target fields; auto-map by name.
  - Add a transformation per field (ROUND, CAST, lookup table).
  - Edit a sample record; see loaded, held or rejected.

## 4 · impact-heatmap

**Score: Wk (everything computes, nothing impresses; two visible bugs).** It is a click-to-score table plus a gap list.
Correct, but a senior BA would call it "a spreadsheet with a blue fill".

What works: cells cycle 0→3 (click, shift-click, keyboard), row/column totals, "Top risks" sorted, checks ("scored 3 but
no gap", "gap 7 has no owner"), "Add gap" from a risk pre-fills area and dimension, CSV ×2 and a sponsor-ready Markdown.

**Bugs**
1. **The word "null" is printed under the heatmap** whenever Scale = Impact (the default for any user's own input; shot
   `impact-heatmap-own.png`). Cause: `extra = scale === 'effort' ? … : null` is then appended as a child and stringified
   (index.js:137).
2. **Renaming an area deletes its scores.** Change "Call centre" to "Contact centre" in the Areas text → row resets to
   0/0/0/0/0 (was 2/1/0/0/0); gaps keep pointing at the old name. Cause: scores are keyed by area name and `pruneScores`
   drops unknown names on every edit (index.js:207, logic.js `pruneScores`). Expected: stable ids, or rename detection by line.
3. **Impact vs Effort is only a relabel.** The switch changes the legend text, not the data: the same number is "High
   impact" or "over 40 days". An area cannot be high-impact / low-effort, which is the whole point of having both.
4. **Effort estimate is not usable**: "354–1260 days" (sum of every cell's min and max, logic.js `EFFORT_DAYS`). A 3.5×
   range over 40 cells reads as noise; gap sizes (S/M/L/XL per gap) are ignored by it and can contradict the cell score.
5. **No status pill; "Update summary" (⌘↵) does nothing visible** — all panels are already live.
6. "Heatmap" is a single blue ramp (accent tint). Fine for the design system, but a 3 does not read as "hot"; no row/column
   emphasis, no sort by total.
7. An area typed without a kind silently becomes "System" ("Merchant support" → System).
8. No image export: a heatmap's job is to go on a slide; only CSV/Markdown exist.

**Example problems**
- Opens fully scored: the user never clicks a cell, so the only interaction of the tool is never discovered.
- The content is good (Exception File real-time listing, the 160-minute storyline) and has two seeded flaws — keep those.
- Better: open with areas listed and **three rows unscored**, with a hint "Score the Call centre row"; sponsor sentence
  updates live ("Hottest: Exception File interface, Block card process. 6 gaps, 1 without owner"). Add a second sample
  that is people-heavy (e.g. PSD3/SCA change: contact centre, merchants, compliance) to show the tool is not IT-only.

**Best-in-class**
- Change-impact assessment templates in Prosci / Miro / Smartsheet (https://www.prosci.com/methodology/adkar,
  https://miro.com/templates/): stakeholder group × dimension, with **degree of impact AND readiness**, and a
  generated narrative per group.
- Jira/Confluence risk matrices and Power BI matrix visuals: conditional colour scale, sort by total, hover detail,
  click-through from a cell to its items.
- LeanIX / Ardoq impact views (https://www.leanix.net): systems as nodes, impact propagates along interfaces — the
  "which system breaks if this changes" picture.

**V3 plan**
1. (S) Fix "null" (index.js:137) and score loss on rename (key scores by a stable id per line).
2. (M) Cell drawer: click a cell → side panel with score, one-line "what changes", gaps of that cell, owner; a small dot in
   the cell when it has gaps. The heatmap becomes the index of the gap list rather than a separate table.
3. (M) Two real measures per cell (impact 0–3, effort S/M/L/XL) and a 2×2 "impact vs effort" scatter of areas
   (quick wins / big bets); roll effort up from gap sizes, show one total with a stated basis.
4. (S) Heat scale with a neutral→amber→red ramp (status tokens), sort by total, highlight the hottest row and column.
5. (S) Export PNG/SVG of the heatmap and "Copy as slide table".
6. (S) Sample opens partly scored; status pill "52/120 · 6 hot cells · 2 to fix"; primary button → "Add gap for hottest cell".
7. (M) Optional: paste a list of systems from the BPMN/SFD tools (cross-tool storyline) to pre-fill areas.

**Talking points**
- **Replaces:** the Excel change-impact matrix and the gap-analysis tab behind it.
- **What it does:** Shows where a change hits hardest across people, process, data, tech and compliance.
- **How it works:**
  - List the systems, teams and processes touched.
  - Click cells to score impact 0 to 3.
  - Describe each hot spot's gap, owner and size.

## 5 · rag-eval

**Score: Wk (honest release gate, but the scoring can be fooled by a one-word change).** The gate logic is the good part;
the per-answer scores are word-and-number matching wearing Ragas metric names.

What works: paste golden CSV + answers CSV (id, answer, retrieved, context) → 7 metrics per question, 5 gates, a
BLOCKED/PASS verdict with reasons, claim-by-claim view ("180 days is not in the retrieved sources"), root-cause suggestion
(retrieval / generation / missing content), manual override per metric, results CSV and Markdown report. The sample tells a
good story: overall 96.7 % yet **blocked**, because one high-risk answer says 180 days instead of 120.

**Is the scoring meaningful? Partly.** I ran five adversarial answers through `scoreItem` (logic.js:66-127):

| My test answer | Tool says | Truth |
|---|---|---|
| "about four months" (expected "120 days") | correctness **0** | correct paraphrase → false alarm |
| "Yes, a PIN payment **can** be disputed… **no need** to contact the merchant" (expected the opposite) | **7/7 pass**, faithful, correct | dangerous wrong answer → missed |
| "costs 10 EUR and is delivered by drone" (drone not in context) | faithful **1** | hallucination → missed |
| Leaks a full card number on a must-refuse question | refusal 0, correctness 0 | caught |
| Right answer, cites [KB-9] instead of KB-4 | citation 0 | caught |

So: numbers, units, citations and refusals are checked well; **meaning is not**. Versus Ragas / DeepEval:
- *Faithfulness* (Ragas): LLM splits the answer into claims, checks each against the context, score = supported / total.
  Ours: a claim passes if its numbers appear in the context and ≥ 40 % of its words overlap (logic.js:88-97), then the
  metric is forced to 0/1 — the ratio is computed (`faithRatio`) but never shown.
- *Context precision / recall* (Ragas): rank-aware precision@k over chunks; recall = share of reference claims found in the
  context. Ours: recall = "any expected source id retrieved", precision = "top-1 id is expected" (logic.js:80-83) — really
  hit-rate@k and hit@1. Fine and explainable, but mislabelled.
- *Answer relevancy / correctness* (Ragas): embedding similarity, factual-overlap F1. Ours: 30 % / 50 % word overlap plus
  number match (logic.js:106-116) — blind to negation and paraphrase.
- DeepEval adds per-metric thresholds, a **reason** string per score, and pytest-style regression runs between versions.
The page does say "offline checks are heuristics", in one grey line under the table; the metric names promise more.

**Bugs**
1. Negation / contradiction passes every metric (table above, row 2). Cause: bag-of-words overlap, no polarity check.
2. Correct paraphrases with converted units fail correctness ("four months" vs "120 days"); number words are not parsed
   (`numberFacts`, logic.js:41-53).
3. Overall score is the mean of per-item pass ratios, so a wrong high-risk answer still earns 66.7 % and the headline reads
   "96.7 %" next to "BLOCKED" — confusing on a first look (logic.js:245-251).
4. The detail pane and its override selects sit below the 10-row table with no visible link to the selected question
   (position after a row click not measured).
5. "Apply scores" + a paste box ("Claude's judgement") exist, but nothing explains the round trip on the page; `report()`
   accepts a `baseline` (logic.js:166) yet the UI has no baseline input → no "release 2.3 vs 2.4" comparison.
6. Export label "Results CSV (score_eval.py format)" refers to a script the user has never seen.
7. Metric cells are icon-only (no text, no tooltip for "not applicable" vs "not scored").

**Example problems**
- Opens already scored and already blocked: the user never presses "Score answers", never sees a gate flip.
- Two CSV blobs in tabs are the entire input; a hiring manager sees commas, not a chatbot being tested.
- Better: sample opens **unscored** with the answers shown as a readable Q / expected / answer list. Press Score → BLOCKED.
  Then a "Try release 2.5 answers" switch (DSP-02 fixed to 120 days) → gate turns PASS and a delta column shows
  "+1 fixed, 0 regressions". That is the story of an eval tool in two clicks.

**Best-in-class**
- Ragas (https://docs.ragas.io/en/stable/concepts/metrics/available_metrics/): the metric vocabulary — faithfulness,
  response relevancy, context precision, context recall, factual correctness — each a 0–1 ratio with a defined formula.
- DeepEval / Confident AI (https://deepeval.com/docs/metrics-introduction): threshold per metric, pass/fail per test
  case, a written **reason** for every score, regression view between runs.
- LangSmith / Promptfoo (https://www.promptfoo.dev/docs/intro/): side-by-side matrix of test cases × versions, red/green
  cells, click a cell to see the output and why it failed.

**V3 plan**
1. (M) Two-run comparison: baseline answers vs candidate answers, delta per metric and per question (fixed / regressed /
   unchanged). Ship the sample with release 2.4 (blocked) and 2.5 (passes).
2. (M) Honest metric model: show ratios not 0/1 (faithfulness = supported claims / claims), rename ID-based metrics
   "Source hit" and "Top-1 source", and badge every score with its method: `rule` (offline) or `judge` (Claude / by hand).
3. (S) Cheap accuracy wins offline: polarity check (yes/no, can/cannot, negation words differ between expected and answer
   → correctness 0 + reason "contradicts the reference"), number words and unit conversion (months ↔ days), and "claim has
   words absent from context" listed per claim (would catch "drone").
4. (M) Judge round trip made visible: "Copy judge prompt" → paste JSON → scores fill in with the judge's reason per metric,
   shown beside the offline score when they disagree.
5. (S) Readable inputs: question cards (question · expected · answer · sources) with CSV as an "Edit as CSV" toggle; detail
   pane as a right-hand drawer next to the table.
6. (S) Headline: lead with the gate ("BLOCKED: 1 high-risk answer is wrong"), put the average second; add a text label or
   tooltip to every icon cell; rename the CSV export.
7. (S) Sample opens unscored.

**Talking points**
- **Replaces:** Ragas / DeepEval notebooks and the Excel answer-review sheet before a chatbot release.
- **What it does:** Checks a chatbot's answers against approved answers and says if the release can go live.
- **How it works:**
  - Load the approved Q&A set and the bot's answers.
  - Press Score: each answer is checked for facts, sources, refusals.
  - Read the gate: pass, or blocked with the exact failing answer.

## Summary

| Tool | Score | Top bug | Top V3 change |
|---|---|---|---|
| bpmn-editor | Wk | Valid BPMN 2.0, but shown in a 548×438 px canvas: 2 of 11 shapes visible, "Fit" gives 30 % zoom | Canvas-first layout + live preview; then token simulation |
| journey-builder | Wk | Test chat is below the fold (y = 892 at 900 px); test utterances are never run | Chat docked beside the canvas + "Run all utterances" pass/fail table |
| mapping-grid | W | A correct mapping shows 8 warnings; evaluator errors all read "Not evaluated" | Batch test on 5–20 records with loaded / held / rejected counts |
| impact-heatmap | Wk | Literal "null" under the grid; renaming an area wipes its scores | Cell drawer linking scores to gaps + impact-vs-effort 2×2 |
| rag-eval | Wk | A flipped yes/no answer passes all 7 metrics | Two-run comparison (2.4 blocked → 2.5 pass) + honest rule/judge labelling |

**Cross-cutting (all five):** (1) every sample opens already computed, so the user never performs the first step — open
samples one click short of the result; (2) the primary button (⌘↵) is a no-op on three tools because results are live;
(3) the split layout gives the visual half of BPMN and Journey under 550 px — these two need a canvas-first template;
(4) text grammars (BPMN steps, journey steps) are the real input but their help is collapsed; (5) canvas edits do not flow
back to the text on either diagram tool.

Not verified: opening the `.bpmn` in Camunda Modeler / Signavio / Bizagi desktop apps (checked instead: OMG XSD validation
and re-import in bpmn-js 18); FR was checked on the BPMN sample only (loads, 11 elements, no errors) — the other four
tools' FR samples were not exercised; in-canvas drag/connect on the journey canvas was not driven by mouse.
