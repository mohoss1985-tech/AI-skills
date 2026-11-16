# Audit 1 · api-tester, sql-runner, tokenization, payment-lifecycle, kb-audit

Method: live site (https://mohoss1985-tech.github.io/AI-skills/) driven in headless Edge over CDP (real time, no
virtual-time budget), every sample loaded, own input typed, exports captured from the Blob, console watched.
Screenshots: `research/v3/shots/<tool>-*.png`. Paths below are relative to `app/web/js/`.
Best-in-class notes come from product knowledge (quota: no web fetches this session); URLs are the vendors' public
doc roots, not pages re-read today — treat feature claims as *to confirm* before quoting them publicly.

Side effects of this audit (disclosed): I started `app/server/server.py` once on port 9313 to replay the exported
curl; it created the git-ignored `app/data/kit.db`, which I deleted again (and the then-empty `app/data/`). I also ran
one read-only `git status` by mistake. No tracked file was changed.

---

## 1 · api-tester

**Score: W (Works)** — the strongest tool of the kit: requests really fire, checks, cases, Run all and exports are
right. One demo-killing state bug and a few export rough edges.

Verified working: 60-s demo (3 steps, 10/10 checks); "Harbor Bank · 10 ready-made" → Run all 11/11; "Tokens and
chargebacks" → 12/12 (14 runs with data rows); httpbin sample really leaves the browser (CDP saw `OPTIONS` + `POST
https://httpbin.org/anything`, 200, 4/4); curl paste fills method/URL/auth/body; click-a-value adds a check; Save as
test case; OpenAPI demo spec lists 8 endpoints; FR UI complete; 0 console errors. Exported curl replayed against the
local app mock (`/mock/harbor/v1`): block → `blocked`, then authorisation → `41`. Postman v2.1 JSON is valid and has
`pm.test` scripts; pytest file is syntactically sound (could not execute: `requests` is not installed here).

### Bugs
1. **Second Send on the hero demo turns it red (409, 0/4).** Open `#/tool/api-tester?sample=en` (200, 4/4) → press
   Send again (the guide literally says "1. Send") → `409 Conflict · 0/4 ✗`. It stays red after an EN/FR toggle and
   after leaving and re-opening the Home demo card. Expected: step 1 of a `reset: true` case always resets the mock
   first. Cause: `resetFirst` is one-shot — set in `tools/api-tester/index.js:478`, cleared at `:624`; nothing sets it
   again when the same step is re-sent, when the frame remounts, or when the sample is re-applied. Shot:
   `api-tester-15-send-again.png`.
2. **Checks added by clicking a value are silently ignored by "Run case".** Step 2 → click `"41"` → 5/5 → Run case →
   report shows 10/10 (not 11): the new check lives only in the working copy until "Update step 2" is pressed.
   Expected: auto-update the step, or warn "unsaved checks". (`index.js:744` `addCheck` writes `req.checks` only.)
3. **Click-a-value creates duplicates.** Clicking `"41"` when `$.response_code equals 41` already exists adds a second
   identical row (`index.js:744`, no de-dupe).
4. **pytest/Postman exports of a pasted or typed literal mock URL are not runnable.** Paste a curl with
   `https://issuer.example/harbor/v1/authorisations` → Save as test case → Export pytest: the step calls
   `https://issuer.example/...` (a host that does not exist) while the reset line calls `{{base_url}}/_mock/reset`.
   The cURL export does rewrite to `localhost:4317`. Cause: `exporters.js:21` rewrites only the `base_url` variable,
   not literal URLs in steps (`:277`).
5. **pytest docstring names the wrong file.** Says `pytest -q analyst_kit_api_tests_test.py` (`exporters.js:258`); the
   download is `analyst_kit_api_test.py` (`index.js:84`). Also the per-test docstring is emitted after `v = dict(VARS)`
   so it is not a docstring.
6. **Exports only run for someone who cloned the repo.** Every export points at `http://localhost:4317/mock/...`
   (`exporters.js:12`). A hiring manager on the live demo cannot run the curl. Not a code bug, a demo gap (see plan 2).
7. "Harbor Bank · 10 ready-made test cases" loads **11** (the 60-s demo is prepended) → "Run all (11)", "11/11".
8. httpbin over HTTP/2 shows `200 ·` with an empty reason (`index.js:~70` uses `res.reason`; fall back to a status table).
9. Opening `#/tool/api-tester` with no sample restores the last workspace, so "type your own request" starts inside the
   demo case (method POST, 4 old checks). A new visitor who types a GET URL gets `405 · 0/4`. Needs a visible "New
   request" button (today only Load sample ▾ → Start empty).

### Example problems
- The 60-s demo is good and on-domain. What is unclear: the screen opens already *sent*, while the guide says "1.
  Send" — the user's first click breaks it (bug 1). The sample should open **un-sent** with the Send button pulsing,
  or the guide should start at "Next: step 2".
- The story stops at "declined 41". The kit's storyline (stolen card approved in stand-in, 160-minute listing delay)
  is not the hero case. Better hero: **"Prove the stand-in gap"** — block `crd_hb_009` as stolen → authorise while the
  issuer is down (STIP approves `00`, check fails red on purpose) → same call after the Exception File listing (`43`).
  A red check with a plain-words reason is more convincing than three greens.
- Nothing shows *why* a check is useful to a BA: add a one-line "this is your UAT evidence" under the report.

### Best-in-class
Postman (https://learning.postman.com/docs/) and Hoppscotch (https://docs.hoppscotch.io/). The 20 % that gives the wow:
(a) collection runner with a pass/fail matrix and per-iteration data; (b) environments switcher (dev/UAT) in the top
bar; (c) response panel with pretty/raw/preview, search and a status/time/size line; (d) snippets ("generate code");
(e) visual schema validation / saved example responses; (f) request chaining with variables visible as chips.
We already have a, c, d, f. Missing: a visible **environment switcher**, **response diff vs. last run**, **JSON
schema / contract check from the OpenAPI file**, and a **timeline of the chain** (which variable was captured where).

### Talking points
- **Replaces:** Postman / Hoppscotch (plus the Excel sheet of UAT evidence).
- **What it does:** Sends real API calls to a mock card issuer and turns the answers into repeatable test cases with evidence.
- **How it works:**
  - Load the card-blocking demo → Send → read the answer.
  - Click any value → it becomes a pass/fail check.
  - Run all → export curl, Postman, pytest, evidence report.

### V3 plan
1. **(S)** Fix reset: before sending step 1 of any `reset: true` case (and on sample load/remount), always call
   `resetMockFor`; or make Send on step 1 imply reset. Add a "Reset mock" chip next to "Demo mock".
2. **(M)** Make exports runnable from the live demo: ship a single-file `harbor_mock.py` (stdlib only) as a download
   in the Export menu and in the curl/pytest header ("python3 harbor_mock.py, then run this"), rewrite literal mock
   URLs to `{{base_url}}` in pytest/Postman (bug 4), fix file name (bug 5).
3. **(S)** Auto-save clicked checks into the open step (bug 2), de-dupe (bug 3), toast "Check added to step 2".
4. **(M)** New hero sample "Prove the stand-in gap" with one deliberate red check and a plain-words explanation;
   open samples un-sent; rename "10 ready-made" to match the real count.
5. **(M)** Contract check: with the bundled OpenAPI spec loaded, one toggle "Validate answer against the spec" →
   missing/extra/wrong-type fields listed. This is the feature a senior BA has not seen in a free tool.
6. **(M)** Response diff: "Compare with previous answer" (before/after block) — shows `status: active → blocked`.
7. **(S)** "New request" button in the command bar; status-reason fallback; environment switcher (Harbor / Lumière /
   httpbin / custom) as a visible select instead of living under More.

---

## 2 · sql-runner

**Score: Wk (Works but weak)** — SQL really runs (sql.js, 7 tables, 2,536 authorisations, 1–8 ms), all 6 EN samples
match their expected answers, errors are caught, read-only is enforced, CSV/.sql/Markdown exports are correct. Weak
because the headline input ("Question") does nothing without Claude, and the chart is hidden and basic.

### Bugs
1. **"Question" is a required field that does nothing in the demo.** Start empty → type "How many authorisations
   were declined per channel?" → Run query → "Write a query first, or load a sample question." (`sql-runner/i18n.js:59`).
   The only path from question to SQL is "Copy prompt for Claude". For a tool whose pitch is "ask a question", this is
   the main reason it feels like it does not work. Shot: `sql-runner-04-question-only.png`.
2. **The chart is hidden for every sample.** The Home card promises "chart the result", but the view defaults to the
   table unless the result has exactly 2 columns (`sql-runner/index.js:280` and `:283`); all 6 samples have 3+
   columns, so no visitor sees a chart without finding the Table | Chart switch.
3. **Only horizontal bars.** A per-day series (32 rows) renders as 32 bars, first text column + first numeric column
   (`logic.js:268`); no line chart, no choice of measure. Shot: `sql-runner-06-timeseries.png`.
4. **Stale result controls on error.** After a failed query the status strip still shows Table | Chart | Copy | CSV
   from the previous run (status-extra not cleared in the error path, `index.js:28` `runError` / `:207` `run`).
5. **Errors are raw SQLite text**: `no such column: chanel` — no line/column marker, no "did you mean `channel`?",
   and both expected user errors are logged as `console.error` with a stack (`index.js:29`).
6. **Oracle/PostgreSQL translation leaves `GROUP BY 1`** (positional GROUP BY is not valid on Oracle before 23ai);
   `logic.js:199-205` handles aliases in GROUP BY but not ordinals. No warning is listed either.
7. **Export name/title follow the Question, not the query.** Change the SQL, keep the old question → the file is
   `how-many-authorisations-were-declined-per-channe.oracle.sql` (truncated mid-word, `logic.js:328`) for an unrelated query.
8. Editor does not wrap or scroll-hint long lines (single-line CTE is cut at the pane edge); no autocomplete, no
   ⌘/ comment, no format button.
9. Page purpose in FR says "Banque Lumière" while the EN sample set (Harbor Bank) is loaded — cosmetic.

### Example problems
- Samples are realistic and on-storyline (stolen card approved in stand-in, card-testing merchant, day-120 disputes).
  The problem is presentation: the default sample returns **one row** and no chart — correct but flat as a first
  impression. The demo card says "Top decline codes" yet `?sample=en` opens the storyline query instead (index 0).
- The "What this shows" box is empty on the samples that ship an interpretation only for index 0.
- Better opening: **"Top decline codes, October"** shown as a bar chart with a one-line insight ("51 Insufficient
  funds = 44 % of declines"), then a "Next question ▸" strip that walks the 6 samples as an investigation:
  decline codes → which day → which merchant (M-011, 68 % code 59) → the stolen card → the disputes.

### Best-in-class
Metabase (https://www.metabase.com/docs/latest/) question builder, Mode / Hex notebooks, DBeaver/DataGrip editors,
and DuckDB-WASM shells (https://shell.duckdb.org). The wow 20 %: (a) **no-code question builder** (pick table →
filter → summarise → group) that *shows the generated SQL*; (b) auto-chosen chart with a one-click switch (bar /
line / number); (c) schema-aware autocomplete; (d) saved questions as a gallery; (e) click a bar to drill down;
(f) "explain this query" in plain words.

### Talking points
- **Replaces:** Metabase / DBeaver on a read-only copy of the card database.
- **What it does:** Answers a business question with real SQL on sample card data, and charts it.
- **How it works:**
  - Pick a question → the SQL appears → Run.
  - Read the table, switch to the chart.
  - Export the SQL in Oracle/PostgreSQL, or the result as CSV.

### V3 plan
1. **(L)** Offline **question → SQL builder**: a guided row "Measure (count / approval rate / decline share / amount)
   · of (authorisations, disputes…) · by (channel, MCC, day, response code, merchant) · where (scheme, month,
   response code) · top N" that writes the SQL into the editor live. Typing in Question fuzzy-matches the 6 samples +
   builder templates ("declined per channel" → fills the builder). Claude stays as the free-text path.
2. **(M)** Chart first: auto-pick bar (category), **line (date column)**, or big-number (1×1); show chart *and*
   table stacked; let the user pick the measure column; highlight the top bar and print the one-line insight.
3. **(S)** Make `?sample=en` open "Top decline codes" (matches the Home card); add the "Next question ▸" investigation strip.
4. **(M)** Editor quality: schema autocomplete (tables/columns already known from `loadSchema`), Format button, wrap,
   error marker on the line, "did you mean" for unknown column/table (Levenshtein over the schema).
5. **(S)** Clear result controls on error; stop `console.error` for user errors; warn on `GROUP BY 1` in translation;
   name exports from the first SQL comment or the question, cut at a word.
6. **(M)** Plain-words "What this query does" panel generated by rules (tables joined, filters, grouping) so the
   demo explains itself without Claude.

---

## 3 · tokenization

**Score: Wk (Works but weak)** — the engine is right and rich (green/yellow/red paths, single-use cryptogram, domain
restriction, suspend/resume/delete, PAN update on replacement, "who sees what" matrix, vault history, 5 exports, 0
console errors). It is weak as a *demo*: every sample opens at its end state, so nothing is "step by step", and the
screen never tells the story.

Verified: Run flow → token active; Pay → `00`, ATC 1; Replay → refused (T18); Card stolen → token suspended, Pay
disabled; Activate replacement → PAN update, PAR unchanged; Pay → ATC 2; Undo; Delete → final. Red sample: declined,
no token. MDES sample: contactless refused by domain restriction (T17).

### Bugs
1. **Samples open finished, so the advertised steps cannot be tried.** "Yellow path: new device, one-time code — Wrong
   code, then 123456" loads as `Yellow · Active · Step 4`, already paid; **Verify code is disabled**, so the user can
   never type a wrong code. Same for Green (already paid) and Storyline. Cause: every sample is `autorun: true` with a
   pre-recorded `actions` list (`tokenization/samples.js:7-17`) replayed in one go.
2. **"Start empty" is not empty**: it shows `Green · Active · TRF-HB-0001` with a token already provisioned (defaults
   auto-run), so "Run flow" appears to do nothing (status identical before and after). Shot: `tokenization-02-empty.png`.
3. **Status pill "Step N" contradicts the stepper.** Pill says `Step 2` while the 7-step stepper highlights
   "6 Pay (cryptogram)": the pill prints the action-log length (`tokenization/index.js:139`), not the stepper position.
4. **Sequence diagram is cut off.** At 1440 px only 2½ of 6 lifelines are visible in the results pane (needs
   horizontal scroll; no fit-to-width, no zoom). Shot: `tokenization-01-sample-en.png`.
5. **"Steps and API calls" table is misleading**: "Replay refused" is listed under `POST /payments` 422 with rule T18
   but step name "Pay (cryptogram)"; "Replacement card active" and "PAN update" are two rows with the same
   `POST /tokens/…/resume` call; lifecycle rows show no request/response body, so "API calls" cannot be inspected.
6. The Mastercard MDES sample keeps Visa wording in the provisioning messages ("VTS: card range…") — to confirm in
   `logic.js` message table; the CSV timeline for a Google Pay run also prints "(VTS)".
7. Amount field shows `42,5` (browser locale) next to `€42.50` in the result; test-card select lists Banque Lumière
   cards under the Visa EN set (18 options, EN and FR mixed).

### Example problems
- A senior BA does not learn *what changed at each step*: the result card shows only the last message. The value of a
  tokenization demo is watching PAN → token → cryptogram move between actors, one arrow at a time.
- The lifecycle buttons are a flat panel of 10 actions; nothing says "do this next".
- Better scenario (the kit's storyline): **"The phone is stolen with the card"** as a 6-click guided tour with a
  Next button: (1) add card to Apple Pay — ID&V by SMS code, type it yourself; (2) pay €42.50 — watch the merchant get
  a token, never the PAN; (3) replay the cryptogram — refused; (4) cardholder reports the card stolen — token
  suspended in the vault; (5) fraudster taps the phone — declined; (6) replacement card activated — same token, new
  PAN, cardholder did nothing. Each click animates the new arrows and updates the "who sees what" matrix.

### Best-in-class
There is no public interactive tool; the references are the scheme docs and wallet sandboxes: Visa Token Service
(https://developer.visa.com/capabilities/vts), Mastercard MDES (https://developer.mastercard.com/mdes-digital-enablement/documentation/),
EMVCo Payment Tokenisation framework (https://www.emvco.com/emv-technologies/payment-tokenisation/), and the
animated explainers of Stripe/Adyen docs. What makes those feel strong: a **single animated sequence** that plays
arrow by arrow, a **before/after data view** (what the merchant stores), and a clear **lifecycle state machine**
(inactive → active → suspended → deleted).

### Talking points
- **Replaces:** the Visa VTS / Mastercard MDES slide deck and a whiteboard sequence diagram.
- **What it does:** Shows how a card becomes a wallet token, pays, and survives a card block.
- **How it works:**
  - Pick a test card and wallet → Run flow.
  - Pay → see token and one-time cryptogram, never the PAN.
  - Block the card → token suspended → replacement restores it.

### V3 plan
1. **(M)** Guided mode: samples load at step 0 with a big **Next step ▸** button and a "why" line per step; arrows
   appear one step at a time; keep "Play all" for the old behaviour. Yellow path stops at the code box.
2. **(M)** Sequence diagram fit-to-width (scale lifelines to the pane, wrap labels), highlight the arrows of the
   current step, dim the rest; click an arrow → show the mock request/response JSON.
3. **(S)** Fix the pill (`index.js:139`): show stepper position and name ("6/7 · Pay"), not log length.
4. **(S)** Real empty state ("Pick a card and press Run flow") instead of a pre-provisioned token.
5. **(M)** Add a **state-machine strip** (Inactive → Active → Suspended → Deleted) with the current state lit, and a
   "what the merchant stores" before/after card (PAN vs token + PAR) — the one picture hiring managers remember.
6. **(S)** Steps table: one row per real call with expandable request/response; scheme-correct wording for MDES;
   filter the card list by the chosen sample set; fixed-format amount input.

---

## 4 · payment-lifecycle

**Score: Wk (Works but weak)** — the rules engine is solid and careful (greyed buttons name the rule that forbids
them, ledger, deadlines table with sources and "to confirm", 6 exports incl. BPMN, 0 console errors; 3-D Secure
switch re-runs live). Weak because the first screen shows a case where nothing happens, the money panel reads as
all zeros, and the clock never produces a consequence.

Verified: 4 EN samples load and match their labels; own input (€250, Chargeback, 13.1) runs; Represent / Refund /
Raise chargeback gating is correct; full Visa condition list 10.1–13.9 present; exports JSON, 2 CSV, BPMN, test
cases, Markdown all carry the typed values.

### Bugs
1. **A missed deadline has no outcome.** Own chargeback → `+30 days` twice (today 7 Jan 2027, respond-by was
   8 Dec 2026) → "Represent with evidence" greys out ("Deadline passed") but the status stays `chargeback open`
   forever; the only move left is "Merchant accepts". Expected: the timeline closes itself with "Merchant loses by
   default — response window missed" (the mock API already has this as case PL-05). Cause: the clock only gates
   buttons; no auto-transition on `respond_by` in `payment-lifecycle/logic.js` (deadline set at `:179`/`:204`, never
   evaluated against the clock to change `dispute.status`).
2. **"Who carries the money now: Merchant" next to four €0.00 balances.** While a chargeback is open the panel
   shows Cardholder €0.00 · Issuer €0.00 · Acquirer €0.00 · Merchant €0.00 (net positions cancel out) although the
   ledger says the merchant was debited €89/€250 and the cardholder holds a provisional credit. The headline and the
   numbers contradict each other for a first-time reader (`logic.js:299-304` `whoPays` vs. the net-balance tiles).
   Expected: show the movement ("Merchant −€250 provisional · Cardholder +€250 provisional credit").
3. **Sample hint is wrong.** "Stolen card, 10.4 … €219.00 … (switch 3-D Secure to None to see **€349** charged
   back)" (`samples.js:15`, `samples.json:89`): switching to None gives a €219 chargeback that is merely *open*, with
   €0.00 everywhere — neither €349 nor "charged back".
4. **"Start empty" is not empty** — it opens a €89 13.1 chargeback already run (defaults auto-run, `index.js:49`).
5. **Flat first impression.** `?sample=en` opens "Hotel cancels before clearing: reversal": result "Nobody · Nothing
   moved", five tiles at €0.00, 4 of 6 timeline stages "Not reached". The most valuable scenario (fraud + 3-D Secure
   liability shift) is sample 4.
6. Chargeback and representment are both stamped the same day (8 Nov 2026) in the 13.1 sample — the 30-day window,
   the tool's main teaching point, is invisible; no countdown ("22 days left to respond") anywhere on the timeline.
7. The left pane is long: 10 evidence checkboxes, 3 clock buttons and 9 action buttons with no "do this next" cue;
   evidence choice has no visible effect until Represent is pressed (and no explanation of which evidence wins 13.1).
8. Test-case export steps use `"base": "mock://harbor/v1"` and "assume pay_0001 exists" — not importable into the
   API tester as-is (no import path for this JSON in api-tester's Import menu).

### Example problems
- The domain content is right; the *order* and *drama* are wrong. A senior BA wants to see the fork: same payment,
  three endings (reversal costs nothing, refund costs the merchant the goods, chargeback costs goods + fee + ratio).
- Better hero scenario (storyline): **"The €219 gift-code fraud on the stolen card"** — run it once with 3-D Secure
  (dispute blocked, issuer pays), flip one switch to "None" and watch liability jump to the merchant, then let the
  30-day clock run out and see the merchant lose by default. One payment, one switch, three outcomes, with a
  running money bar.
- Add a **compare view**: Reversal vs Refund vs Chargeback side by side for the same €120 (who pays, how long, fees).

### Best-in-class
Chargeback tooling: Stripe Disputes dashboard (https://docs.stripe.com/disputes), Adyen dispute flow docs
(https://docs.adyen.com/risk-management/disputes-api/), Visa dispute condition guides, Chargebacks911 / Midigator
explainers. What feels powerful there: (a) a **countdown** on every open dispute ("evidence due in 7 days");
(b) an **evidence checklist per reason code** with a strength meter; (c) a status timeline with money movements
inline; (d) win-likelihood hint. For a browser demo the wow is the **what-if switch** (3DS on/off, evidence
strong/weak) changing the outcome live.

### Talking points
- **Replaces:** the Visa dispute-flow slide and the Stripe/Adyen disputes screen.
- **What it does:** Follows one card payment through cancel, refund or chargeback, showing deadlines and who pays.
- **How it works:**
  - Enter a payment → pick the event and reason.
  - Step through: represent, pre-arbitration, arbitration; move the clock.
  - Flip 3-D Secure or evidence → see who pays change.

### V3 plan
1. **(M)** Clock with consequences: countdown chip on the open stage ("respond by 8 Dec · 22 days left"), and
   auto-close on expiry ("merchant lost by default", ledger entry, rule id). Give sample stages distinct dates.
2. **(M)** Money panel as movements, not net zeros: a 4-party bar (cardholder / issuer / acquirer / merchant) with
   provisional amounts and fees, animated per step; headline and numbers must agree.
3. **(S)** Make the fraud + 3-D Secure sample the default with a prominent "What if: no 3-D Secure" toggle in the
   results pane; fix the €349 hint; real empty state.
4. **(M)** Compare view: Reversal vs Refund vs Chargeback for the same payment (cost, delay, who pays) — one table,
   exportable; this is the slide every BA has had to draw.
5. **(M)** Evidence per reason code: show only the evidence relevant to the chosen condition, with a strength meter
   and the predicted outcome before pressing Represent.
6. **(S)** "Next best step" highlight in the left pane; collapse unavailable actions under "Not allowed now (why)".
7. **(S)** "Open these test cases in the API tester" (deep link with state) instead of a JSON the tester cannot import.

---

## 5 · kb-audit

**Score: Wk (Works but weak)** — the audit maths is right on the sample (freshness by review cycle, owner status,
volume-weighted question coverage, a prioritised backlog with weeks; 3 CSV + Markdown exports; unknown article ids
are flagged). Weak because it is three raw comma-separated text boxes — not a grid — that accept broken input
silently, and the output is tables only.

### Bugs
1. **A comma in a title silently shifts every column.** Paste `A2, Apple Pay, how to add a card, Lea Martin,
   2025-01-15, Procedure, Customer` → title "Apple Pay", owner "how to add a card" (Unknown owner), last review
   "Lea Martin", freshness "Never reviewed", and the backlog says *Give A2 "Apple Pay" a new owner (how to add a
   card has left)*. No warning. (A quoted title works.) Cause: positional parsing with no column-count or type check,
   `kb-audit/logic.js:19-24` via `mapping-grid/csv.js parseList`. Shot: `kb-audit-02-own-input.png`.
2. **Non-ISO dates are swallowed.** `15/03/2026` → "Never reviewed", no error (`logic.js:17` accepts only
   `YYYY-MM-DD` and returns null for anything else). A FR user will type exactly this format.
3. **Duplicate article ids are not detected** (two `A2` rows both kept; questions attach to one of them).
4. **Non-numeric volume becomes 0 silently** (`abc` → 0, `logic.js:30`) and the question drops to the bottom of the backlog.
5. **Unknown owner is reported as "has left".** An owner missing from the Owners list yields "Give A2 … a new owner
   (Nobody Known has left)" (`i18n.js:26` `a_ownerLeft` used for both `left` and `unknown`).
6. "1 weeks with 2 writers" — plural (`i18n.js:18`); FR likewise (`:49`).
7. Markdown export starts at `## Source inventory` followed by `### 1 · Summary` — no H1/title, heading order odd
   (`index.js:~35-41`).
8. The "grid" is read-only: freshness, owner or coverage cannot be edited in the table; every fix means editing raw
   text and pressing Run again. No CSV/Excel file import, no column-mapping step.
9. Only one sample per language; the Visa EN / CB FR switch is meaningless here.

### Example problems
- The sample is good and on-storyline (KB-01 "blocked everywhere at once" vs. the 160-minute incident; two
  duplicate dispute articles; an owner who left). But the screen opens on the **Articles** table, and the finding
  that matters — "44 % of monthly questions are not fully answered; 'Where is my refund?' (7,200/month) has no
  article" — sits on tab 2 and 4.
- Input format is the main clarity problem: a BA has a Confluence/Zendesk export, not three hand-typed CSV blocks.
- Better scenario: **"Is the KB ready to feed the card-support assistant?"** — load a realistic 25-article export
  (as an editable table), headline verdict "Not ready: 3 blockers" (stale high-volume answer, contradicting
  duplicates, orphaned fraud script), a Pareto bar of unanswered volume, then the 2-week fix plan.

### Best-in-class
Zendesk Guide "article verification" and Knowledge reporting (https://support.zendesk.com/hc/en-us/categories/4405298745370),
Guru verification/trust score (https://help.getguru.com/), Confluence analytics / content-lifecycle apps, Intercom
Fin content gap reports. The wow 20 %: (a) a **trust/health score** per article and overall; (b) **verification
workflow** (owner + interval + "verify" click); (c) **content gap report** ranked by unanswered question volume;
(d) duplicate/conflict detection; (e) owner dashboards.

### Talking points
- **Replaces:** Zendesk Guide / Guru verification reports and the KB audit spreadsheet.
- **What it does:** Finds stale, ownerless and missing articles behind the top customer questions.
- **How it works:**
  - Paste articles, owners and top questions → Run audit.
  - Read freshness, owner and coverage scores.
  - Export the prioritised content backlog as CSV.

### V3 plan
1. **(M)** Replace the three textareas with the kit's editable grid (`ui/grid`) — typed columns (date picker, owner
   select, Y/P/N chips), add/delete rows, paste from Excel (tabs) and CSV-file import; keep "paste as text" behind a toggle.
2. **(S)** Validation with row-level messages: wrong column count, bad/ambiguous date (accept `DD/MM/YYYY`), duplicate
   id, non-numeric volume, unknown owner (distinct wording from "left").
3. **(M)** Verdict first: a readiness headline ("Not ready for the assistant: 3 blockers") + a Pareto bar of monthly
   question volume by coverage state (covered / partial / stale / gap); open on that, not on the article table.
4. **(M)** Article health score (freshness × owner × volume) with a sortable heat column; click a tile to filter the grid.
5. **(S)** Duplicate/conflict panel (articles answering the same question, side by side, "merge" action) — already
   computed for the backlog, just surface it.
6. **(S)** Fix plural, Markdown heading, and add a second sample (e.g. disputes/chargeback KB) so the sample switch means something.

---

## Summary

| id | score | top bug | top V3 change |
|---|---|---|---|
| api-tester | **W** | Second Send on the hero demo → 409, 0/4 red, sticks across remounts (`resetFirst` one-shot, `index.js:624`) | Always reset the mock on step 1; make exports runnable from the live demo (downloadable `harbor_mock.py`) |
| sql-runner | **Wk** | "Question" field does nothing without Claude; chart hidden on all samples (`index.js:280`) | Offline question → SQL builder; chart-first results (bar / line / number) |
| tokenization | **Wk** | Samples open at the end state: Verify code disabled, nothing is "step by step" (`samples.js:7-17`) | Guided "Next step ▸" mode with arrows appearing one at a time; diagram fit-to-width |
| payment-lifecycle | **Wk** | Missed deadline has no outcome; "Merchant carries the money" beside four €0.00 tiles | Clock with countdown + auto-close; money shown as movements; 3-D Secure what-if as hero |
| kb-audit | **Wk** | Comma in a title / non-ISO date silently corrupts the audit (`logic.js:17-24`) | Real editable grid with validation; verdict + Pareto of unanswered volume first |

Cross-tool pattern (all five): **"Start empty" and sample loads auto-run to a finished state**, so the user never
performs the first action themselves; fixing that one shell habit (open un-run, pulse the primary button, one "next
step" cue) would change the feel of every tool. Not tested: dark theme, mobile widths, the local (non-demo) app UI,
running the pytest export (no `requests` here), FR for sql-runner/tokenization/payment-lifecycle/kb-audit beyond
the sample switch.
