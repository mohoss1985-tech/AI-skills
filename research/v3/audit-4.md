# Audit 4 · wsjf-planner, use-case-scorer, workshop-kit, raci-grid, ai-risk-register

Method: live site (https://mohoss1985-tech.github.io/AI-skills/) in headless Edge 157 over CDP, real typing/clicks, plus
code reading and `node` runs of each `logic.js`. No console errors on any of the five tools. Paths are relative to
`app/web/js/`.

**Cross-cutting (confirmed for all five tools)**
- **Samples open already computed.** Every sample has `autorun: true` and every tool recomputes on each keystroke, so the
  user never takes a first step: the page lands on the finished answer.
- **Primary button and ⌘↵ are no-ops.** "Rank and plan", "Score and sort", "Check the plan", "Check the grid", "Classify
  and score" only re-run the live refresh: 1 DOM mutation (the status time), nothing visible changes. Either remove the
  button or make it do something real (snapshot a scenario, freeze the plan, generate the report).
- **No row reordering anywhere** (`ui/grid.js` has no drag or move-up/down): agenda blocks, RACI activities, risks and
  use cases can only be deleted and retyped.

---

## 1 · wsjf-planner

**Score: Wk (works but weak).** The maths is right and live; adding an item is broken and the cut line can lie.

**Calculation check.** WSJF = (BV + TC + RR/OE) ÷ job size, modified Fibonacci 1–20: matches SAFe
(`tools/wsjf-planner/logic.js:62-63`). Sample verified by hand: F-07 29/3 = 9.67, F-02 41/5 = 8.20, 119/120 pts.
Capacity fit is a greedy pass in WSJF order that pulls dependencies in and skips items that do not fit
(`logic.js:103-111`): defensible, but not stated in the UI.

**Bugs**
1. **Add item overwrites another feature's ID.** Load sample → Add item → type a title. Observed: the new row F-09
   (defaults 1/1/1/1 = WSJF 3.00) is re-sorted to rank 6 at once, focus lands on the *last* row's ID cell (F-08), and the
   typing replaces "F-08" with the title. Expected: focus in the new row's Feature cell; no re-sort until the row is
   left. Cause: `ui/grid.js:99-103` (`addRow` emits, then focuses index `data.length-1`) + `wsjf-planner/index.js:214-218`
   (`onChange` re-sorts immediately because focus is not yet in an input); first editable column is ID, not Feature.
2. **Cut line is wrong when a smaller item fits below it.** Capacity 105 → rows: F-01 In, *cut line*, F-03 Out, **F-05
   In**, F-08 Out. A committed item sits under "Capacity cut line". Cause: `index.js:308-326` draws one line before the
   first Out row; `logic.js:153` same assumption. Shot: `shots/wsjf-planner-03-cutline-105.png`. Expected: no single
   line; show "skipped: does not fit" on the row, or stop filling at the first miss (strict cut) with a toggle.
3. **A new item is "In PI" for free.** A new row has 0 points, so it is committed at once with an empty title
   (`index.js:213`, `logic.js:107`). Expected: 0 or blank points = "not estimated", excluded and flagged.
4. **Blank score still ranks first.** Choose "—" in Size for F-07 → error "line 2 (F-07): job_size must be a number",
   but WSJF becomes 29.00 (size falls back to 1, `logic.js:48-50`) and the item stays rank 1; Jira CSV exports "size 1".
   The message speaks CSV ("line 2", `job_size`) in a grid UI. Expected: no "—" option, or WSJF blank and item unranked.
5. **Pasted CSV silently changes scores.** `rr=0` becomes 1 without a message (`logic.js:229`, `toInt(x) || 1`).
6. Minor: "1 pts free" (plural); `note` field exists in the sample (the storyline!) but has no column, so the 160-min
   story is invisible; Feature column truncates titles at ~30 characters with no wrap or tooltip.

**Example problems**
- The sample breaks SAFe's own rule and the tool's own AI prompt ("the smallest item gets 1"): no column contains a 1
  (BV min 3, TC min 2, RR min 2, Size min 3). A SAFe-trained reviewer will spot this in seconds.
- Size and Pts are two unexplained columns (size 5 = 21 pts, size 3 = 13 pts): looks arbitrary.
- 119/120 with every deadline met: nothing to decide. Better sample: capacity 100, so F-03 (fraud declaration,
  WSJF 4.25) misses the PI and the regulatory item F-01 only fits because its enabler is pulled in; one item with a
  "This PI" deadline that does **not** fit (red alert), and one visible trade-off the user fixes by moving the capacity.
- One capacity number for the whole PI; real PI planning loads teams per iteration.

**Best-in-class**
- SAFe WSJF article (column-by-column relative scoring, smallest = 1):
  https://v5.scaledagileframework.com/?p=3408 ; archived text https://webarchive.library.unt.edu/web/20161225132214mp_/http://www.scaledagileframework.com/wsjf
- Jira Align / Jira Product Discovery and airfocus: scoring columns with inline bars, drag a capacity line, scenario
  compare. Simple calculators (https://www.productlift.dev/wsjf-calculator/) already do what V2 does: V3 must show the
  *planning*, not just the division.
- Worth copying: what-if slider with live cut line; "why this rank" bar (BV/TC/RR stacked ÷ size); scenario A vs B;
  program-board view (iterations × features with dependency strings).

**V3 plan**
1. (S) Fix Add item: focus the new row's Feature cell, no re-sort until blur, blank points = not estimated.
2. (S) Fix the cut line: per-row "In / Skipped (needs 30, 3 free) / Out", plus a strict-cut toggle.
3. (M) Capacity slider (60–160) with animated re-plan and a "what changed" line ("F-03 drops out, F-05 comes in").
4. (M) Relative-scoring guard: warn per column when no item is 1; one-click "normalise column".
5. (M) Stacked CoD bar per row and a WSJF bar, so the ranking is readable without doing arithmetic.
6. (M) Rework the sample as above; show the note column; start with scores filled but the plan **not** run.
7. (L) Iteration board: drag committed features into 4–5 iterations with per-iteration load and dependency warnings.

**Talking points**
- **Replaces:** Jira Align / a WSJF spreadsheet in PI planning.
- **What it does:** Ranks features by cost of delay ÷ size and shows what fits the PI.
- **How it works:** Score each feature on the Fibonacci scale → ranking updates live → move the capacity to see what
  drops out → export to Jira.

---

## 2 · use-case-scorer

**Score: B (broken where it matters).** The headline feature, "move the weights and watch the ranking change", shows
stale numbers in the grid.

**Calculation check.** Score = Σ(score × weight) ÷ Σ(weights), risk inverted (6 − risk), one decimal
(`tools/use-case-scorer/logic.js:20-26`). Sample by hand: UC-01 = 5×.5 + 4×.3 + 4×.2 = 4.5; UC-02 3.8; UC-03 4.0;
UC-04 3.3; UC-05 2.2. Correct. Gates and lanes behave as documented.

**Bugs**
1. **Changing a weight does not update the Score and Roadmap columns of the grid.** Sample → set weights 20/20/60.
   Observed: hint says "value 20 %, feasibility 20 %, risk 60 %", the lanes and chart move, but the grid still shows
   4.5 / 3.8 / 4.0 / 3.3 / 2.2. Edit any cell and the grid jumps to 4.2 / 2.8 / 4.0 / 2.6 / 2.6. With all weights blank
   the lanes show "Later 5" while the grid still says UC-01 4.5 Now. Cause: `index.js:256-270` `refresh()` repaints
   chart and lanes only; computed cells are repainted only by the grid's own edit handler (`ui/grid.js:75-79`). Same
   for the five "Advanced" lane rules (`index.js:142`).
2. **Duplicate IDs after a delete.** Delete UC-02 → Add use case. Observed: a second "UC-06"; both rows show the same
   score and lane (the regulated UC-06 flips from "2.3 Excluded" to "3.0 Next" in the grid), and UC-06 appears in both
   Now and Excluded. Cause: `index.js:183` `nextId = rows.length + 1`, and `find(row.id)` (`index.js:162`) returns the
   first match. Shot: `shots/use-case-scorer-02-duplicate-id.png`.
3. **Volume does nothing.** The "Monthly contacts" column only breaks ties (`logic.js:56`); 900 or 900,000 gives the
   same score. A reader assumes it feeds value.
4. **`note` is invisible.** Each sample use case has a note with the reasoning (the best content of the sample); it
   appears only in the Markdown export.
5. Minor: grid is not sorted by score and has no sort control; bubbles cannot be dragged; bubble labels are IDs only.

**Example problems**
- The sample is good on domain (declines, block card, refund, unrecognised payment) but hides its reasoning (notes) and
  leaves one "Now" slot empty without saying why.
- Value / feasibility / risk 1–5 have no anchors: what is a "4" in feasibility? The skill has the definitions; the tool
  does not show them.
- Better sample: 8–10 intents with real-looking monthly volumes and handling time, so value is derived
  (volume × minutes saved), one case that jumps lane when the risk weight goes from 20 to 40 (make this the demo move),
  and one high-score case blocked by the knowledge gate.

**Best-in-class**
- No fresh search (quota). From knowledge: airfocus and Productboard (weighted scoring with a live value/effort chart
  and drag on the chart), Aha! scorecards (custom formula, anchors per score). Worth copying: weight sliders with
  instant re-rank animation, drag a bubble to re-score, score anchors on hover, "why" breakdown per item.

**V3 plan**
1. (S) Repaint grid computed cells on every weight or rule change; add a test for it.
2. (S) Unique IDs (max + 1); key rows by index, not ID.
3. (M) Weight sliders that always sum to 100, with rank-change arrows (▲2 ▼1) after each move.
4. (M) Per-row score breakdown bar (value / feasibility / risk parts) and the gate shown as a lock icon with its reason.
5. (M) Make volume count: value hint = volume × minutes saved, or drop the column.
6. (M) Draggable bubbles (drag = change value/feasibility), labels with short names, notes column or row expander.
7. (S) Score anchors (1 = …, 3 = …, 5 = …) in the column header tooltips.

**Talking points**
- **Replaces:** airfocus / Productboard scoring, or the prioritisation spreadsheet.
- **What it does:** Scores AI use cases on value, feasibility and risk, then builds a Now / Next / Later roadmap.
- **How it works:** List the use cases → score each 1–5 → move the weights → risky or unready cases are held back by
  gates.

---

## 3 · workshop-kit

**Score: Wk.** The timer really runs and the report is real, but a live session is easy to lose and the agenda cannot
be reordered.

**What works (tested).** Start → clock counts from the wall clock (00:03 after 3 s), "Next block" moves on and keeps
running, the clock keeps counting while on the Plan tab, quick capture parses `A: … @Tom 2026-11-20` into A-06 with
owner and date and files it under the current block, the report lists decisions, requirements, questions, actions and
the agenda with planned and actual minutes. Word and actions-CSV exports build.

**Bugs**
1. **Refresh wipes the live session when the tool was opened from a sample link.** Open `#/tool/workshop-kit?sample=en`
   (the URL every demo card uses), start the timer, capture three notes, reload. Observed: back to the Plan tab, timer
   00:00, my notes gone. Expected: the saved session wins once the user has changed anything. Cause:
   `shell/tool-frame.js:343-344` ("`?sample=` wins") and the hash is never cleaned after loading. Affects every tool;
   it hurts most here because a workshop runs for 2 hours.
2. **"Fit to duration" does not fix the plan it is the demo for.** Sample 2 (90 min of content in 60) → Fit. Observed:
   topics squeezed to 15 / 15 / 10 min, and the check still says "3 topics for 60 min: keep to 2"; status stays red.
   Cause: `logic.js:86-107` only scales minutes. Expected: propose which topic to move to the next workshop.
3. **Reset timer has no confirmation and no undo**; one click on the icon erases all actual times
   (`index.js:170`, `logic.js:128`).
4. **No end of workshop.** On the last block "Next" is disabled and there is no Finish: the read-back block counts until
   someone presses Pause. No sound, no notification, no flash when a block runs over (only a colour change, and only
   while the Live tab is open, `index.js:289`).
5. **Capture parsing gaps.** `@Ana Lopez` → owner "Ana", "Lopez" left in the text; `20/11` or "Friday" is not a date
   (`logic.js:138-141`). Note text cannot be edited after capture (`index.js:248`, a `<span>`), only deleted.
6. **Agenda cannot be reordered** (shared grid, no drag); the timer tracks the block by position (`timer.i`), so
   deleting an earlier block mid-session moves the "current" block.
7. Minor: sample 1 opens with 18 notes already captured and every "Actual" cell empty, so the report looks unfinished;
   who decided is typed inside the text "(Ana)" instead of a field.

**Example problems**
- Sample 1 is rich and on-domain, but it is a *finished* workshop: there is nothing for the presenter to do. Sample 2
  is the interesting one (over-booked, no read-back) and its one button does not solve it.
- Better: open on the plan with 2 problems to fix in two clicks, then "Start demo run" plays a 60-second accelerated
  session (timer ×60, three notes typed in), then the report appears with actual vs planned.

**Best-in-class**
- No fresh search (quota). From knowledge: SessionLab (drag-and-drop agenda blocks, times recalculate, block library),
  Miro/Mural timer (big visible countdown, sound at the end), Fellow/Otter (notes → actions with owners, sent at the
  end). Worth copying: drag blocks with auto-recalculated clock times, full-screen presenter timer with overrun alarm,
  one-click "send the report" (copy as email).

**V3 plan**
1. (S) Saved session beats `?sample=`; strip the query after first load; confirm on Reset.
2. (M) Drag to reorder blocks; timer keyed by block ID.
3. (M) Presenter mode: full-screen countdown, colour + sound at 2 min left and at overrun, "Finish workshop" button,
   total elapsed vs planned.
4. (M) Fit to duration v2: when topics exceed the limit, offer "move topic X to next workshop" and write it into the
   "Next workshop" field.
5. (S) Editable notes, multi-word owners (pick from attendees with `@` autocomplete), natural dates.
6. (M) Report: actual-vs-planned bar per block, decisions with "decided by", "Copy as email" and follow-up into the
   story builder (REQ rows → stories).
7. (S) Demo run button (accelerated timer) so the tool can be shown in one minute.

**Talking points**
- **Replaces:** SessionLab for the agenda, a phone timer, and the Word template for the minutes.
- **What it does:** Plans a workshop, times it live and turns the notes into the report.
- **How it works:** Set goal, people and duration → fix the agenda checks → run the timer and type notes → the report
  writes itself.

---

## 4 · raci-grid

**Score: W (works).** Best of the five: drag works, checks are right, the memo is useful. It needs depth, not repair.

**What works (tested).** Dragging a dot with the mouse moves the person and updates the table and the quadrant (Leo
30/70 → 60/85, "Keep informed" → "Manage closely"). Clicking a RACI cell cycles R → A → C → I → empty and keeps focus;
typing `a` on a focused cell sets A. Checks: R4 "2 A's", R7 "No A", and after my edit R1 "2 A's · No R". Priya flagged
overloaded (load 5 > 4). CSV, stakeholder CSV and memo exports build.

**RACI rule check.** `logic.js:18-25`: exactly one A, at least one R per row. The tool *flags* a second A, it does not
prevent it. That is the right behaviour for a workshop tool, but the fix should be one click ("make Jade the only A").

**Bugs**
1. **A person cannot be both A and R.** One letter per cell (`logic.js:7,15`). In practice the accountable person often
   does the work ("A/R"); here the row is marked "No R" until someone else gets an R. Expected: allow "A/R" (counts as
   both).
2. **Naming is confusing.** Activities are numbered R1…R7 next to the role letter R; the status pill says
   "7 decisions", the column says "Activity", the command bar asks for one "Decision".
3. **Only horizontal checks.** No column analysis: a person with no R or A at all, a person with A on everything, a row
   with too many C's (slow decisions). These are the classic RACI review questions.
4. Minor: the three tabs are not linked (a stakeholder in "Manage closely" who is only I on every row is not flagged);
   rows and columns cannot be reordered; the sample comment says only R4 is wrong on purpose but R7 also has no A.

**Example problems**
- The sample is clear and on-domain. Weak point: the power/interest numbers (85/90) look precise but come from nowhere,
  and the map, RACI and memo read as three separate tools.
- Better: keep the scenario, add the cross-check "Omar (Compliance, high power) is only Consulted on the liability
  wording" as a visible finding, and let the memo's "Consulted" list show dissent taken from the grid.

**Best-in-class**
- No fresh search (quota). From knowledge: Miro/Mural stakeholder-map templates (drag stickies on a 2×2), Smartsheet
  and monday.com RACI templates (colour-coded cells, per-person counts). Worth copying: colour per letter, row and
  column totals, filters ("show me everything Priya owns"), export to a slide-ready picture.

**V3 plan**
1. (S) Allow A/R in one cell; one-click fixes on each flagged row.
2. (M) Column analysis panel: per person R/A/C/I counts with plain findings ("Marc: A on nothing, C on 3").
3. (M) Cross-checks between map and RACI: high-power people who are only I; low-interest people who hold an A.
4. (S) Rename activity IDs to A1…/D1…, one word for the rows everywhere.
5. (M) Export the 2×2 and the matrix as PNG/SVG for a steering deck; "focus on a person" filter.
6. (S) Drag to reorder rows and columns.

**Talking points**
- **Replaces:** Miro stakeholder map + the RACI spreadsheet.
- **What it does:** Maps who has power and interest, and checks that every decision has one owner.
- **How it works:** Drag people on the grid → click cells to set R, A, C, I → fix the red rows → export the decision
  memo.

---

## 5 · ai-risk-register

**Score: B (legally unsafe).** The UI works and the register is solid, but the tier wizard can clear a credit-scoring
system as "Minimal", and its dates are out of date. For a hiring manager from Compliance this is the tool that can
hurt most.

Basis of the legal check: Regulation (EU) 2024/1689 as I know its text (Art. 5, Art. 6, Art. 50, Annex III), plus one
search on the 2026 amendments. Not re-read on EUR-Lex in this audit (quota): every point below marked *(verify)* must
be checked against the Official Journal before V3 ships.

**What is right.** Art. 5(1)(a)–(d) references and wording; Annex III 5(b) creditworthiness with the fraud-detection
exception; 5(c) life and health insurance; point 4 employment; Art. 6(3) profiling rule (profiling = always high-risk);
Art. 50(1)–(4) paragraph mapping; prohibitions in force since 2 February 2025; "unsure" never decides a tier.

**Bugs (legal logic)**
1. **Credit scoring + "fraud purpose = yes" → Minimal.** Sample → "evaluates creditworthiness" Yes, "purpose is to
   detect fraud" Yes. Observed: "Minimal", reason "excluded from the creditworthiness item". The exception covers
   systems used *for the purpose of detecting financial fraud*; a system that also scores credit stays high-risk.
   Cause: `tools/ai-risk-register/logic.js:46-48` (`if yes(h1) { if yes(h2) carveOut = true`). Expected: High-risk, or
   at least "to confirm"; ask "is fraud detection the only purpose?". Shot: `shots/ai-risk-register-02-credit-plus-fraud.png`.
2. **Art. 6(3) derogation granted while the profiling question is blank.** Credit scoring Yes, "narrow procedural
   task" Yes, profiling unanswered → "Minimal". Answer profiling Yes → "High-risk". Cause: `logic.js:52`
   (`yes('h6') && !yes('h7')`: blank counts as No). Credit scoring of a person is profiling by nature, so the derogation
   should not be offered at all for 5(b). Also Art. 6(3) has four conditions; the wizard shows two.
3. **An empty wizard says "Minimal".** `classify({})` returns `minimal` (`logic.js:64`) and the badge shows it before
   any answer. Expected: "Not assessed yet".
4. **High-risk hides the Art. 50 duties.** `logic.js:58` returns before the Art. 50 questions are read: a high-risk
   chatbot gets no "tell people they talk to an AI". The tiers are not exclusive in the Act.
5. **Dates are out of date (today 2026-11-16).** Text says high-risk applies "from 2 August 2026 … a postponement has
   been proposed" and Art. 50 "from 2 August 2026" (`i18n.js`, `tierSub_high`, `tierSub_limited`). The Digital Omnibus
   on AI was adopted in summer 2026: Annex III obligations now apply from **2 December 2027**, Annex I products from
   2 August 2028; a 2 December 2026 date is reported for Art. 50(2) marking *(verify)*; a new prohibition on sexual
   deepfakes / nudification apps was added to Art. 5 *(verify wording)*. Sources below.
6. **Missing scope.** Annex III areas 2 (critical infrastructure), 3 (education), 6 (law enforcement), 7 (migration),
   8 (justice, democratic processes) and Art. 6(1) / Annex I products are not asked: such a system ends "Minimal".
   Acceptable for a bank only if the result says "screened for banking uses only".
7. **No provider / deployer question.** "What it means" lists Art. 9–15 (provider duties) to a bank that is usually the
   deployer (Art. 26). Art. 27 (fundamental-rights impact assessment) is quoted for credit scoring only; it also covers
   5(c) insurance. Art. 50(1)–(2) are provider duties, (3)–(4) deployer duties: not said.
8. Wording: question p5 merges four different prohibitions (Art. 5(1)(e)–(h)) and drops "for law enforcement" from
   real-time biometric identification; Art. 50(1) "obvious to the person" exception is not mentioned.

**Bugs (UI)**
9. "Add starter risks" twice adds 9 duplicates (24 rows) (`index.js:137-141`).
10. Register grid is 1,560 px wide in a 1,158 px pane (11 columns): Control and Test need horizontal scrolling.
11. Questions h6/h7 are always shown although they matter only after an Annex III hit, so samples carry
    "2 question(s) not answered".

**Example problems**
- Sample 1 (LLM that drafts dispute letters for analysts) answers "Unsure" to "does it generate synthetic text?" and
  lands on "Minimal (to confirm)". An LLM that drafts letters plainly generates text; the honest result is
  "Limited (transparency), provider duty, check the human-review exception". The sample makes the tool look evasive.
- Sample 2 (fraud scoring, carve-out) is the strong one and should open first. Add a third: "credit-limit increase
  model" → High-risk with the obligations and the 2 December 2027 date, so all three outcomes are shown.

**Best-in-class**
- EU AI Act Compliance Checker (artificialintelligenceact.eu/assessment/eu-ai-act-compliance-checker): asks the role
  first (provider, deployer, importer…), then scope, then shows obligations per role with article links.
- Credo AI / OneTrust AI Governance / IBM watsonx.governance: use-case intake form → risk tier → controls mapped to
  the framework → evidence and owner per control.
- Omnibus sources: https://www.gibsondunn.com/eu-ai-act-omnibus-agreement-postponed-high-risk-deadlines-and-other-key-changes/ ,
  https://www.cuatrecasas.com/en/latam/intellectual-property/art/council-eu-approves-digital-omnibus-ai ,
  https://www.shumaker.com/insight/eu-ai-act-council-gives-final-green-light-to-the-digital-omnibus-on-ai/ ,
  https://natlawreview.com/article/eu-digital-omnibus-ai-enters-force
- Worth copying: role first; a visible decision path ("Art. 5 clear → Annex III 5(b) hit → exception? → Art. 6(3)?");
  every obligation with its article, owner and date; a one-page result for Legal.

**V3 plan**
1. (S) Fix the logic: bugs 1–4. Add tests for each (credit + fraud, blank profiling, empty wizard, high-risk chatbot).
2. (S) Update all dates and add the new Art. 5 prohibition after reading the consolidated text on EUR-Lex; put the
   "text as of <date>" line on the result.
3. (M) Step 0 "Your role" (provider / deployer) and show duties for that role only; add one catch-all question for the
   other Annex III areas and Annex I products.
4. (M) Turn the question list into a real wizard: one step at a time, later questions appear only when relevant, a
   decision-path diagram that lights up as the user answers.
5. (M) Link tier → register: a High-risk result adds the Art. 9–15 / Art. 26 duties as register rows to own and test.
6. (S) Register: no duplicate starters, risk row expander instead of 11 columns, residual score after control.
7. (S) Reorder samples (fraud carve-out first) and add the high-risk credit sample.

**Talking points**
- **Replaces:** the EU AI Act compliance checker + the risk register spreadsheet (or OneTrust / Credo AI intake).
- **What it does:** Screens an AI system against the EU AI Act and keeps its risks, controls and owners.
- **How it works:** Describe the system → answer yes / no / unsure → get the tier and what to confirm with Legal →
  score the risks on the heat grid.

---

## Summary

| Tool | Score | Top bug | Top V3 change |
|---|---|---|---|
| wsjf-planner | Wk | Add item re-sorts at once and typing overwrites another feature's ID | Fix add/cut line, then capacity slider with live "what changed" |
| use-case-scorer | B | Changing weights leaves stale Score / Roadmap in the grid | Repaint on weight change; weight sliders with rank-change arrows |
| workshop-kit | Wk | Reload from a sample link wipes timer and notes; Fit does not fix the over-booked sample | Session persistence + presenter timer with alarm and Finish |
| raci-grid | W | A person cannot be both A and R (false "No R") | Column analysis and map ↔ RACI cross-checks |
| ai-risk-register | B | Credit scoring + fraud purpose = "Minimal"; dates predate the 2026 omnibus | Fix the legal logic and dates, add role step and decision path |

Not tested (quota): FR for the last four tools beyond string presence, Word export content, dark theme, keyboard-only
use. wsjf-planner FR was checked (decimal comma, labels).
