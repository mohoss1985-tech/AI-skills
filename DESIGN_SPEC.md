# DESIGN_SPEC · Analyst Kit V2 (single source of truth)

Wins over every research file. Sources: `research/01…08` (+ `tech-draft/`, `demo-api/`). `GOAL.md` = done criteria.

## 0 · Identity in one line
**Analyst Kit V2 — working tools for payments BAs & POs.** Each skill is a tool that does the job in 3–4 inputs and
60 seconds (an API tester that really fires requests, SQL that really runs, a BPMN you can edit); Claude drafts,
critiques and explains on top. Calm, dense, precise: "Linear calm + Hoppscotch anatomy + Stripe status badges".

## 1 · Conflicts resolved (★ = owner decision 2026-11-08)
| Topic | Reports | Decision |
|---|---|---|
| Where V2 lives | 07: separate `v2/` folder · 08: one codebase + tags | ★ **One codebase.** V1 frozen as git tag `v1.0.0` (+ GitHub Release). V2 replaces `app/` on `main` (`app/server/`, `app/web/`), port **4317**. Pages: **V2 at `/`, V1 at `/v1/`** built from the tag. |
| Licence | 08 | ★ **MIT** (code) + **CC BY 4.0** (samples, docs, screenshots) |
| Demo API | 02/05/06 | ★ **Fictional Harbor Bank Card API** (EN, Visa terms) / **Banque Lumière** (FR, CB terms), in-page mock + same mock served by the local app (so curl/pytest exports run), + one real call to httpbin.org. Users may bring their own sandbox keys; we never ship keys. |
| Accent | 01: blue #2563eb / #4f8cff · 04: indigo #3e63dd | **Blue** (drops V1's Linear indigo): light `#2563eb`, dark `#4f8cff` — verify ≥ 4.5:1 for text use, else use the darker step for text. |
| Radii | 01: 4/6/10 · 04: 4/6/8/12 | **4 / 6 / 10 / full** |
| Type | 01: 11/12/13/14/16/20/24 · 04: Inter + JetBrains Mono base 13/20 | **Inter + JetBrains Mono** (Google Fonts, vendored woff2), scale 11/12/13/14/16/20/24, weights 400/500/600, base 13/20 |
| Neutrals & status | 01 Primer · 04 Radix slate (contrast-checked) | **04's tokens** (Radix slate, darkened where needed), HTTP 2xx/3xx/4xx/5xx + pass/fail pairs from 04 |
| Code editor | 05 | No CodeMirror in V2.0: textarea + highlight.js 11.11.1 + own JSON tree |
| Word export | 05 | Keep V1 HTML-as-`.doc` |
| Name | 08 | Keep **Analyst Kit**; subtitle "working tools for payments BAs & POs"; no "AI" in the title |

## 2 · Tokens
Use `research/04-ui-craft-moodboard.md` §4 as the drop-in CSS custom properties, with §1 overrides (accent, radii, type
scale). Spacing 4-pt grid (4/8/12/16/20/24/32/40/48). Control heights 28/32/40. Hairlines 1 px semi-transparent, no
shadows except floating layers (menu, popover, dialog, toast). Motion 100/160/240 ms, opacity/transform only.
Icons: **Lucide** (vendored SVG sprite). Light + dark themes (system default + manual toggle).
**Banned** (01 §tells): gradients, emoji in UI, glow, cards in cards, coloured left borders as decoration,
`transition: all`, any size/radius off the scale, filter-brighten hovers.

## 3 · Signature graphics
- **Status pill**: `● 200 OK · 182 ms · 1.2 KB` (dot = status colour) on every run result; pass/fail counts `3/3 ✓`.
- **Method chip**: GET/POST/PUT/PATCH/DELETE in mono 11/600 with method colours (02).
- **Sample switch**: "Load sample ▾ Visa EN | CB FR" on every tool head. One storyline runs through all samples:
  a stolen card approved in stand-in because its Exception File listing took 160 min (06).

## 4 · Information architecture
- **Sidebar (232 px)**: Home · Tools (18, grouped: Specify · Test · Data · Plan · Facilitate · AI governance) ·
  Deliverables · Chat with Claude · Profile · Guide. Top bar 44 px: crumb, ⌘K search, Claude online dot, theme, EN/FR.
- **Home**: three demo cards first (08): "Test a card-blocking API in 60 s" · "Workshop notes → user stories → Jira CSV"
  · "Top decline codes with SQL", then all tools.
- **Tool screen template** (04 §5): page head (crumb · title · one-line purpose · sample switch) → command bar with the
  3–4 required inputs + primary action (⌘↵) → config pane | results pane (status strip) → action bar
  (Save as deliverable · Export ▾ · Ask Claude). Fluid, max 1440, 24 gutters. "Advanced · n set" collapses the rest.
- **Deliverables**: V1 behaviour kept (conversation, versions, Word/PDF/Copy, mark as sent, continue). A deliverable made
  from a tool shows "Open in tool".
- Keyboard: ⌘↵ run, ⌘K palette, / focus search, Esc close, ⌘S save, ⌘⇧C copy as curl (API tester).

### Tools (skill → tool, minimum inputs, core) — details in research/03 (and 02 for the API tester)
| Owner | Skill → tool | 3–4 inputs | Interactive core | Exports |
|---|---|---|---|---|
| C | testing-apis → **API tester** | Method+URL · Auth · Data (params/body) · Expect (default status 200) | send via proxy/mock, response viewer, no-code checks (click a value → check), cases list, curl paste import, Postman/OpenAPI import | curl, Postman v2.1 + tests, pytest, Markdown/CSV evidence |
| D | generating-sql → **SQL runner** | Question · Table(s) · Dialect | sql.js on Harbor Bank sample DB (06 `seed.sql`), results grid + mini chart, AI drafts SQL | .sql, CSV |
| E | modeling-processes → **BPMN editor** | Process name · Actors · Steps | bpmn-js modeler (watermark visible), AI draft from notes | .bpmn, SVG, PNG |
| E | designing-conversational-journeys → **Journey builder** | Intent · Channel · Steps | node canvas + test chat | JSON, Markdown |
| F | managing-backlog → **WSJF & PI planner** | Items · BV/TC/RR · Job size | editable grid, Fibonacci cells, live WSJF sort, capacity cut line | Jira CSV |
| F | prioritizing-ai-use-cases → **Use-case scorer** | Use cases · Value · Feasibility · Risk | weighted scorer, bubble chart, Now/Next/Later | CSV, Markdown |
| G | running-uat → **UAT tracker** | Scope · Cases · Exit criteria | run status grid, go/no-go gauge, defects | CSV, Markdown report |
| G | managing-xray-tests → **Xray builder** | Test cases · Target (Cloud/DC) | validator per target | Xray CSV/JSON |
| G | evaluating-rag-quality → **RAG eval scorer** | Golden Q&A · Answers · Threshold | score grid, release gate | CSV, Markdown |
| H | writing-prds → **PRD builder** | Problem · Users · Goal metric · Scope | section editor + trace meter (goal→req→metric) | Markdown, Word |
| H | writing-user-stories → **Story builder** | Feature · Persona · Rules | example-mapping board → Gherkin, INVEST check | Jira CSV, .feature |
| H | writing-functional-specs → **SFD builder** | Feature · Rules · Fields | numbered rules table + field list | Markdown, Word |
| I | mapping-data → **Mapping grid** | Source fields · Target fields · Rules | two-column mapper + checks | CSV, Markdown |
| I | analysing-gaps-and-impacts → **Impact heatmap** | Change · Areas · Scale | click-to-score 0–3 heatmap | CSV, Markdown |
| I | curating-knowledge-bases → **KB audit grid** | Articles · Owners · Questions | freshness by age, coverage | CSV |
| J | facilitating-workshops → **Workshop kit** | Goal · Attendees · Duration | agenda builder + timer + live notes → report | Markdown, Word |
| J | aligning-stakeholders → **RACI & power grid** | Stakeholders · Decisions | power/interest 2×2 + RACI (exactly one A per row) | CSV, Markdown |
| J | governing-ai-risk → **AI risk register** | System · Use · Data | EU AI Act tier wizard + register | CSV, Markdown |

★ **New in V2 (owner 2026-11-08), owner K**, details in `research/09-tokenization-chargebacks.md`:
| K | NEW skill `tokenizing-cards` → **Tokenization simulator** | PAN (test only) · Wallet (Apple Pay / Google Pay) · Device · Merchant/TRID | step-by-step provisioning flow (ID&V, TSP, PAN → device token/DPAN, token reference, cryptogram per payment, lifecycle: suspend / resume / delete on card block), sequence diagram, token vault view | JSON, Markdown, sequence diagram |
| K | NEW skill `handling-chargebacks` → **Payment lifecycle & chargeback simulator** | Payment (amount, card, merchant) · Event (cancel/void, reversal, refund, chargeback) · Reason (Visa condition / CB motif) | timeline: authorisation → clearing → cancellation vs refund vs chargeback → representment → pre-arbitration/arbitration, deadlines, who pays at each step, worked examples (Visa EN / CB FR) | Markdown, CSV, BPMN |
Both tools also get mock endpoints in the Harbor Bank / Banque Lumière mock API (C serves them; K defines them) and
seeds linked to the shared storyline. Registry has **20** ids.

Every tool works without AI and without network (also in the static demo). AI actions add drafts/critiques; in the demo
they become "Copy prompt for Claude".

## 5 · Copy rules
Sentence case, plain verbs, EN + FR from day one (FR +30 % room). Numbers with units. Error = what happened + what to do.
Disclaimer EN/FR on Home + footer: "Fictional data. Not affiliated with Visa or GIE CB. No real card data."
Test PANs only (Luhn-valid test ranges, masked), and the API tester warns on any non-test PAN. AI output labelled
"AI-assisted draft". Anything only a scheme rulebook can confirm stays *to confirm*.

## 6 · Motion
100 ms hover/press, 160 ms panels/tabs, 240 ms dialogs. Results fade in; no bouncing. `prefers-reduced-motion`: opacity only.

## 7 · Demo mode
`export_static.py` → `dist/` (V2) with `config.js` setting `KIT_DEMO=true`; `LocalStore` (IndexedDB, try/catch) so tools
are interactive; deliverables/chat read-only. V1 built from tag `v1.0.0` into `dist/v1/` by `pages.yml`.

## 8 · Shared API contract (names FIXED)
Tool module `app/web/js/tools/<id>/index.js` — exactly the interface in `research/07-code-audit.md` §3
(`id, skill, icon, title, schema, defaults(), samples{en,fr}, mount(el, ctx), run?, toMarkdown, exports?, aiActions?`),
`ctx = {state, setState, run, ai, store, i18n, ui, server}`.
Core (owner A): `core/dom.js` (`html` escaping tagged template, `esc`), `core/i18n.js` (`t(key)`, `register(ns, {en, fr})`),
`core/store.js` (`Store` with `ServerStore`/`LocalStore`), `core/router.js` (`#/tool/:id`, `#/d/:id`, …),
`core/api.js`, `ui/*` (button, field, select, tabs, table, grid (editable), modal, toast (aria-live), empty-state,
code-editor, kv-editor, json-view, splitpane, status-pill, method-chip), `shell/tool-frame.js` (the §4 template),
`tools/registry.js` (all 18 ids pre-filled, lazy import).
Backend (owner B): `server/server.py` (127.0.0.1:4317, Origin/Host + `X-Kit-Token` on writes, JSON errors with `code`),
`router.py` (`@route`), `db.py` (`workspaces`, `runs`, `messages.meta`, `versions.source/state`), routes
`/api/workspaces[/:id[/publish|/ai|/runs]]`, `/api/catalog`, `/api/state` (ETag), `kit.py patch|reply <ids>`.
Tools backend: `POST /api/tools/http/send` (C, from `tech-draft/proxy.py`), `/mock/harbor/*` + `/mock/lumiere/*`
(C, same logic as the in-page mock), `POST /api/tools/sql/run` (D, read-only, time limit).

## 9 · Parallel build rules
- Wave 0 (one agent): `git init` + baseline commit; restructure per research/07 §5 Wave 0 but **into `app/`** (V2 replaces
  V1 in place; V1 is preserved by the tag), port 4317, 18 stub tools that show the V1 form, both Pages builds.
  Done = V2 matches V1 screen for screen.
- Wave 1: **A** (design system + shell, lands §8 names first) and **B** (backend) start; **C–J** start when A's
  `ui/*` + `tool-frame.js` + registry stubs exist. Owners and files per research/07 §5 (paths `v2/` → `app/`).
- Each builder edits only its files, builds/serves on its own port (`PORT=43xx`), checks §9 of research/04 on every
  screen (both themes, both languages), writes `research/wave1-<LETTER>.md`, replies in ≤ 5 lines.
- Never remove a V1 feature. No real card data. No secrets in the repo.
