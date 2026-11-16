# Build D report
## 1 api-tester
- Bug 1 fixed: logic.js `needsMockReset(st)` (step 1 of any reset:true case always resets the mock); run() uses it. Autorun flags removed from samples; mount never runs; empty state remains. Test: api-tester/logic.test.mjs (new, 3 tests).
- Audit bugs 2-9 not in the brief: untouched.
## 2 bpmn-editor
- Canvas wrap height clamp(520px, 100vh-300px, 1000px); steps pane defaults to 30 % (unless user dragged); new "Wide canvas / Show steps" toggle hides the steps pane; Fit (and the load fit) now fits ALL shapes, and if scale < 55 % auto-widens the canvas and refits (old 65 %-anchored crop removed).
- Not touched: audit bugs 2-6 (two-way sync, gateways, labels), out of brief.
## 3 sql-runner
- Chart is the default view whenever chartSpec exists (label + number, any column count). Autorun flag removed.
- Question box now works offline: logic.js `questionToSql` (EN+FR keywords: count / declines / approval rate / amount, by channel, MCC category, merchant, response code, day, scheme, entry mode; stand-in, Visa/CB, e-com, month, top N; disputes by status/condition). If the SQL box is empty (or still holds the last generated template) Run builds it from the Question, writes it into the editor and runs it. No match -> clear message "No offline template fits... use Copy prompt for Claude" (EN/FR). Tests: sql-runner/logic.test.mjs (new, 2).
- Not done (out of brief): audit bugs 3-9.
## 4 payment-lifecycle
- Missed deadline: logic.js `expire()` runs after every op; open chargeback past respond_by -> `merchant_accepted` (pre-arbitration -> `lost`), rule D12, new log line "Window missed: merchant loses by default" (EN/FR), button gating unchanged. Tests: payment-lifecycle/logic.test.mjs (new, 3).
- Money tiles: net stays, but each tile now shows "in X · out Y" from new `res.flows` (no more bare EUR 0.00 beside "Merchant").
- mount no longer calls runNow (empty state shows); autorun flags removed (samples.js + samples.json); fixed the wrong "EUR 349" hint (EN) and the FR equivalent.
- Not done: audit 4-8 (Start empty is now truly empty since the auto-run is gone), compare view, countdown chip.
## 5 journey-builder
- Layout: steps pane defaults to 30 % (unless dragged), canvas | chat stay side by side down to 560 px container width (was 820 px -> stacked, chat at y=892); grid height clamp(380px, 100vh-480px). Browser-checked in smoke section.
- Test utterances now run: logic.js `runUtterances(graph, text)` (each phrase tried at every question; optional `phrase => expected branch`); statuses pass / fallback only / unhandled / wrong branch; "Run test phrases" button in Advanced shows a coverage pill "N of T phrases reach a branch" + table (EN/FR). Test in logic.test.mjs. Autorun flags removed.
- Not done: audit 3-6 (parser options on Check, debug line, coverage colouring).
(journey update) Split pane defaults to 30 % via per-tool first-visit flag (splitpane saves 0.5 on creation, so the old "no stored value" check never fired); after Run the stage scrolls into view: at 1440x900 chat = y 254..634, canvas 460x380 side by side. Run test phrases verified in browser: "7 of 10 phrases reach a branch" for the EN sample.
## 6 mapping-grid
- analyse(): `mandNoDefault` is now level info (checkMapping itself untouched so check_mapping.py parity holds); issues sorted error>warning>info. EN sample 0: Checks 0 / 0, 0 warning lines (was 8). Old test expectation for sample 1 updated; new zero-warning tests. Rule 8: results (checks, coverage, output record, Check column) hidden until first run, invitation line shown; autorun removed from samples.js and samples.json. Browser: before run invite visible/lower hidden/0 badges; after run 9 badges, 0 warnings. Not done: audit 2-7.
## 7 raci-grid
- Shell contract only: chart + strategies + pill + status + RACI check badges/load row wait for first run (invitation "Press Check RACI"); autorun removed. Browser verified (before: map hidden; after: 12 chart marks). No real bug in audit fixed (A/R, column analysis are plan items).
## 8 tool-frame.js
- Visible "New" button (secondary, file-plus) in page head -> same as Start empty. Restored workspace that still equals a sample of another language is reloaded as the same sample in the current language (guided). Edited work is never replaced. Browser check of the language follow was inconclusive (hash kept same route, no remount); logic is a strict key-equality match, please eyeball once: open EN sample, toggle FR, leave and re-open the tool.
## Smoke (1440x900, static export, 0 console errors on each): api-tester (2nd Send 200 4/4), bpmn (canvas 1158x598, scale 0.64, auto-wide), sql (chart default, offline question OK), payment-lifecycle (flows shown), journey, mapping, raci. Shots in shots/v3-*.png.
Tests: api-tester, sql-runner, payment-lifecycle, journey-builder, mapping-grid, raci-grid logic tests pass.
