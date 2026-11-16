# Skills Portal · User manual

How to use the 20 tools **for real**, on your own projects, data and APIs — not only in the demo.

🇫🇷 Résumé en français : [README.fr.md › Utiliser pour de vrai](README.fr.md#utiliser-pour-de-vrai) · 🏠 [README](README.md) · ▶ [Live demo](https://mohoss1985-tech.github.io/AI-skills/)

**Contents:** [1. Demo or local?](#1-demo-or-local) · [2. Install and run](#2-install-and-run-on-your-computer) ·
[3. How every tool works](#3-how-every-tool-works) · [4. Tool by tool](#4-tool-by-tool) · [5. Troubleshooting](#5-troubleshooting)

---

## 1. Demo or local?

| | **Online demo** | **On your computer** |
|---|---|---|
| Good for | Trying the tools, showing them in an interview | Real work on your projects |
| Your own input and exports | ✅ | ✅ |
| Where your work is saved | Only in that browser (gone if you clear it) | `app/data/kit.db` on your disk |
| API tester on your own APIs | ❌ Browsers block calls to most APIs (CORS). Only the built-in Harbor Bank mock and public echo APIs (httpbin.org…) work | ✅ Any API you can reach: internal, VPN, UAT, sandbox |
| Company proxy | — | ✅ `HTTPS_PROXY` / `HTTP_PROXY` / `NO_PROXY` are used |
| "Ask Claude" | Copies a ready prompt to paste in Claude | Sends the request to a Claude Code session on your machine |
| Setup | None | Python 3 and one command |

**Rule of thumb:** every tool except the API tester is fully usable in the demo (paste your data, Run, Export).
Run it locally when you want your work saved on disk, or to call real APIs.

---

## 2. Install and run on your computer

Nothing to install except **Python 3** (no npm, no database server, no API key). Nothing is sent anywhere except the
API calls *you* make in the API tester.

### Step 1 · Python 3
- **Mac:** open Terminal, type `python3 --version`. If macOS offers to install the developer tools, accept.
- **Windows:** install Python from [python.org/downloads](https://www.python.org/downloads/) and tick **"Add python.exe to PATH"**. Use `python` instead of `python3` below.
- **Linux:** already there on most distributions (`python3 --version`).

### Step 2 · Get the files
- **Without git:** on the [GitHub page](https://github.com/mohoss1985-tech/AI-skills) click the green **Code** button → **Download ZIP**, then unzip it (for example into `Documents`).
- **With git:** `git clone https://github.com/mohoss1985-tech/AI-skills.git`

### Step 3 · Start it
Open a terminal **in the unzipped folder** (Mac: right-click the folder → *New Terminal at Folder*; Windows: open the
folder, type `cmd` in the address bar) and run:

```bash
python3 app/server/server.py
```

Open **http://localhost:4317** in your browser. Keep the terminal open while you work; press **Ctrl + C** to stop.

### Options
| You want to… | Do this |
|---|---|
| Use another port (4317 is busy) | `PORT=4400 python3 app/server/server.py` (Windows: `set PORT=4400` first) |
| Go through your company proxy | `export HTTPS_PROXY=http://proxy.mycompany:8080` before starting (Windows: `set HTTPS_PROXY=…`) |
| Back up your work | Copy `app/data/kit.db` |
| Update to a new version | Download the new ZIP, then copy your old `app/data/kit.db` into the new folder |

---

## 3. How every tool works

Every tool page has the same layout, so once you know one you know all 20.

1. **Talking points** (top card): *Replaces …*, what it does, how it works in 3 steps. Collapse it with the chevron.
2. **New** starts empty · **Load sample** (Visa EN / CB FR) fills the inputs with a worked example. Start from a sample, then replace it with your own content: it is the fastest way to see the expected format.
3. **Inputs** (top bar, 3–4 fields) and **settings** (left pane). Paste your own notes, CSV, curl, etc.
4. **Run** (the blue button, or **⌘↵ / Ctrl+↵** from anywhere). Nothing is computed before you press it.
5. **Results** (right pane). Most tools also recompute live once you've run them once.
6. **Bottom bar:**
   - **Save as deliverable (⌘S)** keeps a dated version (local app: in `kit.db`, listed under *Deliverables*).
   - **Export ▾** downloads the files listed per tool below (Markdown is always available).
   - **Ask Claude ▾** (local) queues a request that Claude, running in Claude Code on the same machine, answers with
     `python3 app/server/kit.py pending` then `kit.py reply …`. In the demo it copies the prompt instead.
7. **EN / FR** (top right) switches the language; samples exist in both (Visa vocabulary in English, CB in French).

Your last state per tool is restored when you come back. Use **New** to start a fresh piece of work.

---

## 4. Tool by tool

Format: **Replaces** · **You bring** · **Steps** · **You get** · ⚠️ limits.

### Specify

<a id="bpmn-editor"></a>

#### BPMN editor · `#/tool/bpmn-editor`
- **Replaces:** Camunda Modeler / bpmn.io, Visio, Signavio for a first draft.
- **You bring:** the actors (lanes) and the steps, one per line (who does what, decisions as questions).
- **Steps:** type lanes + steps → **Run** → rename/move shapes on the canvas → **Fit** to see the whole flow.
- **You get:** `.bpmn` (BPMN 2.0, opens in Camunda Modeler and bpmn.io), `.svg` / `.png` image, step table `.csv`.

<a id="prd-builder"></a>

#### PRD builder · `#/tool/prd-builder`
- **Replaces:** a Confluence/Word PRD template.
- **You bring:** problem, goals, metrics written as *"Name: current → target"* (e.g. "Declarations made in the app: 38% → 70%"), requirements, out of scope.
- **Steps:** fill or paste your notes → **Run** → check the traceability (each goal → requirement → metric).
- **You get:** Word `.doc`, Markdown `.md`, Jira epic CSV.

<a id="story-builder"></a>

#### Story builder · `#/tool/story-builder`
- **Replaces:** writing stories by hand in Jira + a separate Gherkin file.
- **You bring:** business rules or workshop notes, the persona, the epic name/ID.
- **Steps:** paste rules → **Run** → read the INVEST check → split a story by rule if it's too big.
- **You get:** Jira CSV (epic row + stories linked with `Work item ID` / `Parent` — import with Jira's CSV importer),
  Gherkin `.feature`, Markdown.

<a id="sfd-builder"></a>

#### SFD builder (functional spec) · `#/tool/sfd-builder`
- **Replaces:** the Word SFD with hand-numbered rules.
- **You bring:** the business rules and the data fields.
- **Steps:** paste rules and fields → **Run** → every rule gets an ID (RG-nn) and is traced to a story.
- **You get:** Word `.doc`, Markdown, Gherkin `.feature`, **rules CSV** — which the UAT tracker and the Xray builder import
  (one test per rule).

### Test

<a id="api-tester"></a>

#### API tester · `#/tool/api-tester` — ⚠️ run it locally for your own APIs
- **Replaces:** Postman / Hoppscotch + the Excel sheet of UAT evidence.
- **You bring:** the endpoint (or a `curl` command, an OpenAPI/Swagger file, or a Postman collection), the auth, the environment URL.
- **Steps:**
  1. Paste the `curl` your developers sent into the URL box: method, headers and body fill themselves. Or **Import** an OpenAPI file (JSON/YAML: pick an endpoint or add them all as test cases) or a Postman collection.
  2. **More → Variables:** set `base_url` (e.g. your UAT host). Change only this to rerun the same tests elsewhere.
  3. **Auth:** API key, Bearer token or Basic.
  4. **Send** → **click any value in the answer** to turn it into a check (e.g. `status = BLOCKED`).
  5. **⌘S** saves it as a test case; add the next steps; **Run all**.
- **You get:** curl, Postman collection (`skills-portal.postman_collection.json`, runs in Postman/newman), pytest file
  (`skills_portal_api_test.py`, for developers' CI), evidence report (`.md` / `.csv`) for your UAT file.
- ⚠️ In the online demo only the Harbor Bank mock and public echo APIs answer. Locally, writes (POST/PUT/PATCH/DELETE)
  to a host that looks like production ask for confirmation first. Use test credentials; secrets are masked in the history.

<a id="uat-tracker"></a>

#### UAT tracker · `#/tool/uat-tracker`
- **Replaces:** the UAT Excel tracker and the daily status email.
- **You bring:** test cases with requirement IDs, daily results (pass / fail / blocked), defects, exit criteria.
- **Steps:** paste or import (incl. *Import from SFD rules CSV*) → update results each day → **Run**.
- **You get:** go / no-go with reasons, coverage per requirement (covered / at risk / not covered), `uat-test-runs.csv`, `uat-defects.csv`.

<a id="xray-builder"></a>

#### Xray builder · `#/tool/xray-builder`
- **Replaces:** hand-building Xray import files.
- **You bring:** test cases (Manual steps, Cucumber/Gherkin, or Generic/automated), project key, Xray Cloud or Server/DC.
- **Steps:** paste tests or *Add from → SFD rules CSV* → **Run** → fix validation errors (download is blocked until clean).
- **You get:** Xray test CSV, bulk JSON, results JSON, and `IMPORT-*.md` with the exact import steps.

### Data

<a id="sql-runner"></a>

#### SQL runner · `#/tool/sql-runner`
- **Replaces:** Metabase / DBeaver on a copy of the card database.
- **You bring:** a business question (plain words) or a SQL query.
- **Steps:** type the question (SQL is drafted offline) or write SQL → **Run query** → read table + chart.
- **You get:** results `.csv`, the query as `.sql` in SQLite, PostgreSQL or Oracle syntax.
- ⚠️ Queries run on the **built-in sample card database** only. For your real database: build and check the query here,
  export it in your dialect, run it in your own SQL tool.

<a id="mapping-grid"></a>

#### Mapping grid · `#/tool/mapping-grid`
- **Replaces:** the source-to-target mapping spreadsheet.
- **You bring:** source fields, target fields, transformation rules, one sample source record.
- **Steps:** map fields → **Run** → the sample record is transformed so you can check every rule.
- **You get:** mapping `.csv`, generated `.sql` and `.py` transformation snippets.

<a id="tokenization"></a>

#### Tokenization simulator · `#/tool/tokenization`
- **Replaces:** Visa VTS / Mastercard MDES slides and the whiteboard sequence diagram.
- **You bring:** a test card, wallet (Apple Pay, Google Pay…), device, token requestor.
- **Steps:** **Run flow** → **Next ▸** (or →) shows each message one by one (green / yellow with OTP / red) → then pay,
  suspend, resume, replace the card, delete the token.
- **You get:** `tokenization-timeline.csv`, `tokenization-test-cases.json`, run `.json` — material for your spec and tests.
- ⚠️ Demo values and test PANs only; field names are indicative — check them against your scheme's specification.

<a id="payment-lifecycle"></a>

#### Payment lifecycle & chargebacks · `#/tool/payment-lifecycle`
- **Replaces:** the dispute-process slide and the deadline spreadsheet.
- **You bring:** the payment (amount, scheme Visa/CB, 3-D Secure or wallet) and what happens (refund, dispute, representment…).
- **Steps:** **Run** → move the clock → see deadlines, outcomes (a missed deadline loses the case) and who carries the money.
- **You get:** `payment-timeline.csv`, `payment-ledger.csv`, `payment-lifecycle-test-cases.json`, `chargeback-dispute.bpmn`.

### Plan

<a id="wsjf-planner"></a>

#### WSJF & PI planner · `#/tool/wsjf-planner`
- **Replaces:** Jira Align / the WSJF spreadsheet in PI planning.
- **You bring:** features with business value, time criticality, risk reduction (Fibonacci) and job size; team capacity.
- **Steps:** paste or type features → **Run** → ranking by WSJF; items that don't fit the PI are marked; blank sizes are "not estimated".
- **You get:** `features.csv`, `jira-import.csv`.

<a id="impact-heatmap"></a>

#### Impact heatmap · `#/tool/impact-heatmap`
- **Replaces:** the change-impact matrix in Excel.
- **You bring:** the change, the impacted teams/areas, scores for people, process, data, tech.
- **Steps:** fill the grid → **Run** → heatmap + gap list.
- **You get:** `impact-heatmap.csv`, `impact-gaps.csv`.

### Facilitate

<a id="workshop-kit"></a>

#### Workshop kit · `#/tool/workshop-kit`
- **Replaces:** the agenda doc, a phone timer and the notes file.
- **You bring:** goal, attendees, duration, topics.
- **Steps:** build the agenda (*Fit to duration* moves extra topics to "Next workshop") → **Run** the session timer → take notes and actions live.
- **You get:** workshop report, `workshop-actions.csv`. The live session survives a page reload.

<a id="raci-grid"></a>

#### RACI & power grid · `#/tool/raci-grid`
- **Replaces:** the stakeholder map and RACI spreadsheet.
- **You bring:** stakeholders (power / interest) and the decisions.
- **Steps:** place stakeholders → fill the RACI → **Run** → the check enforces exactly one *Accountable* per decision.
- **You get:** `raci.csv`, `stakeholders.csv`, `decision-memo.md`.

### AI governance

<a id="use-case-scorer"></a>

#### Use-case scorer · `#/tool/use-case-scorer`
- **Replaces:** airfocus / Productboard scoring, or the prioritisation sheet.
- **You bring:** AI use cases scored on value, feasibility, risk; the weights.
- **Steps:** fill the grid → set the weights → **Run** → Now / Next / Later roadmap.
- **You get:** `ai-use-case-scores.csv`.

<a id="ai-risk-register"></a>

#### AI risk register · `#/tool/ai-risk-register`
- **Replaces:** the EU AI Act checklist and the risk Excel.
- **You bring:** the AI system, its purpose and users, and answers to the tier questions.
- **Steps:** answer the wizard → **Run** → tier (Prohibited / High-risk / Transparency / Minimal / *Incomplete*) with
  the reasoning path, article numbers, obligations and dates → score the risk register.
- **You get:** `ai-risk-register.csv`, Markdown report.
- ⚠️ Not legal advice — verify the classification with counsel.

<a id="rag-eval"></a>

#### RAG eval scorer · `#/tool/rag-eval`
- **Replaces:** Ragas / DeepEval notebooks and the Excel answer-review sheet.
- **You bring:** a golden Q&A set (CSV) and your bot's answers with their retrieved context (CSV), a release threshold.
- **Steps:** paste both CSVs → **Score answers** → each claim is green / amber / red with the reason → release gate.
- **You get:** `eval_results.csv`, `llm_judge_prompt.md` (to plug an LLM judge in production).
- ⚠️ Rule-based scoring catches numbers, units, yes/no flips and terms not in the context; it can't judge synonyms — use the LLM-judge prompt for that.

<a id="journey-builder"></a>

#### Journey builder · `#/tool/journey-builder`
- **Replaces:** Voiceflow / Botmock / a Miro flow for a chatbot or voice journey.
- **You bring:** intents, example phrases, steps and hand-off rules.
- **Steps:** build the flow → **Run** → chat with it in the simulator → *Run test phrases* to see which phrases reach a branch.
- **You get:** journey `.json` (re-import later), Mermaid flowchart `.mmd`.

<a id="kb-audit"></a>

#### KB audit grid · `#/tool/kb-audit`
- **Replaces:** the knowledge-base audit spreadsheet.
- **You bring:** article list (CSV: id, title, owner, last review date…) and top customer questions with volumes.
- **Steps:** paste both → **Run** → stale articles, missing owners, unanswered questions; bad rows are reported by line.
- **You get:** `kb-article-audit.csv`, `kb-question-coverage.csv`, `kb-content-backlog.csv`.

---

## 5. Troubleshooting

| Problem | Fix |
|---|---|
| `python3: command not found` | Install Python 3 (step 1). On Windows use `python`. |
| `Address already in use` | Another app uses 4317: `PORT=4400 python3 app/server/server.py` |
| API tester: *"The local server is not answering"* | The terminal running `server.py` was closed — start it again. |
| API tester: *"The browser blocked this call"* | You're on the online demo. Run locally to call your API. |
| API tester: timeout on a company API | Set `HTTPS_PROXY` (section 2 › Options) or connect to the VPN first. |
| My work disappeared (demo) | The demo saves only in that browser. Use the local app for real work. |
| A CSV import shows row errors | Read the row number in the message; usually a comma inside a text field (quote it) or a DD/MM date (use YYYY-MM-DD). |

Fictional data only in the samples (Harbor Bank, Banque Lumière). Not affiliated with Visa, Mastercard or GIE CB.
