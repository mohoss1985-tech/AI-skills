# 07 · Code audit of V1 and the V2 build plan

Scope: `app/*.py`, `app/static/*`, `app/seed/*` (31 files), `.github/workflows/pages.yml`, `skills/*/scripts`. About 3,450 lines in total. Read-only audit, dated 2026-11-08.

> **Blocker before any commit:** this folder is **not its own git repo**. `git rev-parse --show-toplevel` returns `/Users/fr152071` (the home directory). Wave 0 must run `git init` here first, or commits will land in the home-directory repo.

## 1. Architecture (V1)

**Processes.** There are two processes and they talk only through SQLite (`app/data/kit.db`):
- `server.py` is a stdlib `ThreadingHTTPServer` on `127.0.0.1:4317`. It serves `static/` (any unknown path falls back to `/`), the JSON API and uploaded files.
- `kit.py` is a CLI that Claude Code runs inside the user's chat session. There is no API key.

**Request → Claude → deliverable loop.**
1. The browser sends `POST /api/requests` with `{type, client, title, notes, answers, files[base64]}`. The server checks the type and the required guided questions (`questions.py`), inserts the row as `status='draft'`, saves the files through `sources.save` and then sets `status='waiting'`. This keeps Claude from picking up a request before its files are on disk.
2. Claude runs `kit.py wait`. It writes a heartbeat to `meta` every 3 s, and "Claude is online" means a heartbeat less than 45 s old. It returns when work exists. Then:
   - `kit.py pending` prints JSON with `rules`, `profile`, `learned`, the waiting requests (answers rendered as labelled text, plus source and knowledge file paths) and the unhandled user messages.
   - `kit.py start <id>` sets `working`.
   - `kit.py deliver <id> file.md` copies the old `output` into `versions` and sets `output`, `ready` and `unseen=1`.
   - `kit.py reply <id|chat> file.md` marks every user message in that thread as handled and inserts a message with role `claude`.
   - `kit.py learn "<note>"` appends a note to `meta.learned`, keeping the last 50.
3. The browser polls `GET /api/state` every 3 s. It raises toasts when a status or unread count changes, and the current view's `tick()` re-renders.

**Routes.**

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/state` | types (with questions, FR labels, scenarios), groups, request summaries, `claude_online`, `chat_unread`, profile, learned, clients |
| GET | `/api/requests/:id` | full request + thread (marks Claude msgs read, clears `unseen`) + version list + sources + skill knowledge |
| GET | `/api/versions/:id` | one old output |
| GET/POST | `/api/chat` | general thread (`request_id IS NULL`) |
| POST | `/api/requests/:id/messages`, `/api/requests/:id/sent` | thread message; mark sent/unsent |
| POST | `/api/profile` | profile + learned list |
| GET/POST/DELETE | `/api/files?scope=req-N\|skill-<id>` | list, upload, remove sources |
| GET | `/files/<scope>/<name>` | download a source |
| DELETE | `/api/requests/:id` | delete request, messages, versions, uploads |

**Data model (SQLite).**
- `requests(id, type, client, title, notes, changes, output, status[draft|waiting|working|ready], is_sample, created_at, updated_at)`, plus columns added later with `ALTER`: `sent_at, unseen, answers JSON, lang`.
- `messages(id, request_id NULL=chat, role user|claude, body, handled, read, created_at)`.
- `versions(id, request_id, output, created_at)`. This holds older outputs only; the latest one stays in `requests.output`.
- `meta(key, value JSON)` holds `profile`, `learned`, `seeded` (sample titles already inserted) and `heartbeat`.
- Uploads live on disk at `data/uploads/<scope>/`. Word, Excel and PowerPoint files get a `.txt` sidecar extracted with the stdlib.

**Catalog and samples.** About 360 of the 690 lines in `server.py` are content: `TYPES` (18 skills: name, colour, gives, gets, placeholder, next), the scenario tables `BA_EN`, `BA_FR` and `EXAMPLES`, and the merge of `QUESTIONS` and `TYPES_FR`. Each `seed/*.md` is one JSON header line, then `===INPUT===`, then `===OUTPUT===`. On startup, samples are inserted once per title. Samples whose titles are no longer in the seed folder are deleted.

**Frontend.**
- `index.html` loads, as classic scripts, marked, DOMPurify, mermaid and bpmn-js (navigated viewer) from jsDelivr, then `i18n.js`, `app.js`, `help_fr.js` and `help.js`.
- `app.js` is one 857-line IIFE: global state `S`, a hash router (`#/`, `#/new/:type`, `#/type/:id`, `#/d/:id`, `#/chat`, `#/profile`) and views built with template-string `innerHTML`.
- `help.js` is a rule-based "Guide" chatbot plus an Xray assistant, wired through `window.Kit`.
- Theme: tokens on `:root` in `app.css`, a dark theme via `prefers-color-scheme` or `data-theme`, and `localStorage` keys `kit-theme` and `kit-lang`.

**Versions, profile and exports.**
- The Version menu loads `/api/versions/:id`.
- Profile fields `name`, `title` and `company` produce "Prepared by…". `tool`, `language` and `tone` steer Claude.
- **Word:** `clientHtml()` re-renders the markdown in light mode and rasterises the BPMN and Mermaid diagrams to PNG. It wraps the result in Word-flavoured HTML and downloads it as `.doc` (`application/msword`). It is not real `.docx`.
- **PDF:** `window.print()` with `@media print` rules.
- **Copy:** writes `text/html` and `text/plain` to the clipboard.

**i18n.**
- `KIT_FR` is a dictionary keyed by the English string, used through `L(en)`. `tx(type, key)` covers type fields.
- Server-side FR content lives in `i18n_fr.py`. Questions carry `en` and `fr` inline. The Guide has its own `KIT_GUIDE_FR`.
- Samples are filtered by `lang`: Visa samples are English, CB samples are French.

**Static demo.**
- `export_static.py dist` copies `static/` and writes `data/state.json` and `data/requests/<n>.json` from the seeds. It injects `window.KIT_DEMO` by string-replacing the `i18n.js` script tag.
- In demo mode, `api()` maps GETs to those JSON files. Any non-GET call throws "read-only demo".
- `pages.yml` builds this on every push to `main` and deploys it to the root of Pages.

## 2. Problems

**Monoliths and coupling**
- `server.py` mixes content (catalog and scenarios) with HTTP, the database and migrations. `app.js` holds every view, the markdown and diagram pipeline, exports, polling and the router in one closure, so it cannot be split across builders without conflicts.
- `help.js` reaches into `window.Kit` internals (`state`, `fill`, `startExample`). It depends on script order (`i18n` → `app` → `help_fr` → `help`).
- `server.py` and `kit.py` both hard-code the DB path and schema. `meta` access is duplicated, and the status strings are spread through both files.
- `export_static.py` imports `server`, so building the demo runs module-level catalog code. The demo hook is a string replace on the HTML.

**Correctness and error handling**
- `read_json()` raises on malformed JSON and `int(Content-Length)` raises on bad input. Both produce an uncaught exception, a dropped connection and the generic "Something went wrong". The front end also calls `r.json()` on non-JSON error bodies.
- `kit.py reply` marks **all** unhandled user messages in a thread as handled. A message posted between `pending` and `reply` is silently lost.
- `kit.py deliver` and `kit.py start` do not check that the id exists. Bad `argv` gives a raw traceback.
- Migrations are ad-hoc `ALTER`s with no `schema_version`. There are no foreign keys and no indexes on `messages.request_id` or `versions.request_id`.
- The poll loop swallows every error (`catch {}`). When the server is down the UI just freezes, with no "server offline" state.
- If a CDN fails to load, the app breaks: `marked` is undefined and nothing renders. `help.js` falls back to raw HTML when `DOMPurify` is missing.

**Security**
- **CSRF and DNS rebinding (high).**
  - There is no `Origin`, `Host` or `Content-Type` check, and `read_json` accepts any body. Any web page the user visits can `fetch('http://127.0.0.1:4317/api/chat', {method:'POST', body:'{"body":"…"}'})` as a simple `text/plain` request.
  - That text is then handed to **Claude Code, which has local tool access**. This is a remote prompt-injection path into the user's machine.
  - DNS rebinding also allows reading `/api/state` and `/files/…`.
  - This must be fixed in V2 before an HTTP proxy exists, because the proxy would turn the hole into SSRF.
- **Localhost binding** is correct (`127.0.0.1`). Keep it, and refuse `0.0.0.0` unless a flag is set.
- **Path traversal** is handled correctly. Scopes must match the `req-\d+|skill-[a-z-]+` regex, `safe_name()` keeps only `Path(name).name`, and `remove()` checks the parent directory. Keep this pattern for V2 tool files.
- **Upload limits.** The 25 MB limit applies after base64 decoding of a body read fully into memory, and there is no total body cap. Uploads are also served without `X-Content-Type-Options: nosniff` and with no CSP.
- **XSS** is mostly handled.
  - Markdown goes through `DOMPurify.sanitize(marked.parse())`. Mermaid uses `securityLevel:'strict'`, and bpmn-js renders labels as SVG text.
  - User strings in templates go through `esc()`. Toasts use `textContent`.
  - Remaining risks: the `help.js` `md()` fallback; the many `innerHTML` templates, where one missed `esc()` is an XSS bug (V2 should use an auto-escaping `html` tagged template); and third-party CDN scripts with **no SRI**.

**Accessibility**
- Toasts are not `aria-live`. Status is shown mostly by a coloured dot.
- `.type` cards use `div[data-href]` and are not reachable by keyboard.
- Focus does not move to the page heading on route change.
- The 3 s `tick()` re-render with `innerHTML` can destroy focus, scroll position and text selection while someone reads.
- `--faint #9a9ea8` on `#fcfcfd` is about 2.6:1, which fails WCAG AA. The base font is 13.5 px.
- The single-key shortcuts (`n`, `/`) are not documented anywhere on screen. The Guide has `role=dialog` but no focus trap.

**i18n gaps**
- Using the English string as the key means a typo silently falls back to English, and there is no missing-key report.
- Server error messages are English only ("Pick a deliverable.", "Answer: …").
- Relative times and plurals are built by string concatenation.
- FR lives in four places: `i18n.js`, `i18n_fr.py`, inline in `questions.py`, and `help_fr.js`.
- Seeds `10`–`15` have no `lang`, so the English AI samples also appear in the French UI.

**Performance**
- Every 3 s, `/api/state` re-reads and parses all 31 seed files (in `types_payload`), sends the whole catalog with its scenario notes, and runs two `COUNT` queries per request (N+1).
- One global `_lock` serialises every request, including base64 decoding and Office text extraction.
- About 3 MB of mermaid and bpmn-js loads on every page even when no diagram is shown. These should be loaded lazily with `import()`.

## 3. Data contract for V2 tools

**Principle.** A tool's logic is **pure browser JS**, so the same module runs locally and on GitHub Pages. The server adds only three things: persistence, a way past CORS and the sandbox (HTTP proxy, SQL), and the Claude queue.

**Tool module interface** (`web/js/tools/<id>/index.js`):

```js
export default {
  id: 'api-tester', skill: 'testing-apis', icon, title: {en, fr},
  schema: 1,                       // state version; migrate(old) when bumped
  defaults(),                      // empty state, the 3-4 primary inputs first
  samples: { en: [...], fr: [...] },  // guided demos (Visa EN / CB FR)
  mount(el, ctx),                  // ctx = {state, setState, run, ai, store, i18n, ui}
  run?(state, ctx),                // the work: pure, or ctx.server.* when local
  toMarkdown(state, lastRun),      // becomes a deliverable version
  exports?: [{id:'curl', label, build(state) -> {name, mime, text}}],
  aiActions?: [{id:'explain-failure', label, prompt(state, run) -> string, expects:'markdown'|'json', schema?}],
}
```

**Storage.** Use generic tables so that no builder writes a migration. Backend owner B adds them in `v2/server/db.py` with `PRAGMA user_version`:
- `workspaces(id, tool, title, client, lang, state JSON, schema INT, request_id NULL, is_sample, created_at, updated_at)` holds the editable tool state: an API collection, a WSJF table, a UAT campaign, a BPMN XML.
- `runs(id, workspace_id, kind, input JSON, result JSON, ok INT, ms INT, created_at)` holds executions: an HTTP response with its assertion results, an SQL result set (capped at 500 rows), a WSJF computation. Keep the last 50 per workspace.
- Existing tables gain `requests.workspace_id NULL`, `versions.source TEXT DEFAULT 'claude'` (`claude|tool|user`) and `versions.state JSON NULL`.
- If a tool needs a real relational store (for example, the UAT tracker querying test cases), it gets `v2/server/migrations/NNN_<tool>.sql` from a number range reserved per owner (C 100–199, D 200–299, and so on). The default is JSON in `workspaces.state`.

**Tool → deliverable.** "Save as deliverable" sends `POST /api/workspaces/:id/publish`. The server renders `toMarkdown(state, lastRun)`, which the client sends. It creates or updates the linked `request` (`status='ready'`), pushes the previous output into `versions` with `source='tool'` and `state=<snapshot>`, and sets `requests.workspace_id`. The deliverable then gets every V1 feature for free: conversation, versions, Word, PDF, Copy, mark as sent, and continue. "Open in tool" on a deliverable restores `versions.state`.

**Tool → AI.**
- `POST /api/workspaces/:id/ai` with `{action, prompt, context}` inserts into the request thread as a user message carrying `meta JSON` (add a `messages.meta` column), where meta is `{action, workspace_id, run_id, expects}`.
- `kit.py pending` includes the workspace state and run for those messages.
- Claude answers with `kit.py reply` for markdown. For structured results it uses the new `kit.py patch <workspace_id> <file.json>`, which validates against the tool's JSON schema in `v2/server/tools/schemas/<id>.json` and merges into `state.ai[action]`. Examples: generated test cases go to the API tester's case list, a BPMN XML goes to the editor.
- `reply` must mark only the message ids it was given, which fixes the lost-message bug.
- **In the static demo**, AI actions become "Copy prompt for Claude": the same `prompt()` output with a link to the README.

**Static demo without a server.**
- The `Store` interface has two adapters: `ServerStore` (fetch `/api/*`) and `LocalStore` (IndexedDB, with `localStorage` as fallback, every call wrapped in try/catch). With these, tools are **interactive** in the demo, not read-only. Deliverables and chat stay read-only, as in V1.
- **API tester:** direct browser `fetch` to CORS-enabled demo APIs (for example `httpbin.org`, `postman-echo.com`, `jsonplaceholder.typicode.com`, or a mock in a service worker such as `/mock/v1/disputes` returning the Visa sample's 201/409/422). Locally, the request goes through `POST /api/tools/http/send` (server-side `urllib`). That endpoint must be protected by the Origin/CSRF token and have a timeout, a size cap and a scheme allowlist.
- **SQL:** locally, Python `sqlite3` on `v2/server/sample/cards.db` (read-only connection, `PRAGMA query_only`, time limit through `set_progress_handler`). In the demo, **sql.js** (pinned WASM) with the same DB file exported to `data/cards.sqlite`.
- **WSJF, RAG scoring, mapping checks:** port `skills/managing-backlog/scripts/wsjf.py`, `evaluating-rag-quality/scripts/score_eval.py` and `mapping-data/scripts/check_mapping.py` to JS. Keep the Python versions as reference tests.
- **BPMN:** lazy-loaded `bpmn-js` Modeler. Port `build_bpmn.py` layout only if it is needed.
- `export_static.py` writes `data/catalog.json`, `data/samples/<tool>.json` and the request JSONs, and sets `window.KIT_DEMO` through a dedicated `config.js`, not a string replace.

## 4. Where V2 lives

**Option A (recommended): a sibling `v2/` folder that shares nothing at runtime.**
- `app/` stays byte-identical. `v2/` has its own server on **:4318**, its own DB at `v2/data/kit.db` and its own `kit.py`, and it reads only the shared `skills/` (read-only).
- Pages publishes V1 at `/` (the existing URL stays the same) and V2 at `/v2/`, with a banner on each linking to the other. Later the two can be swapped (V2 at `/`, V1 at `/v1/`) by changing one line in the workflow.
- Pros:
  - V1 cannot regress.
  - Both run side by side for screenshots and the changelog.
  - The V1 → V2 diff is visible in the tree.
  - Builders never touch V1.
  - There is no deployment coupling.
- Cons:
  - `sources.py`, `questions.py` and the seeds are copied, so a fix has to be applied twice. That is acceptable because V1 is frozen.
  - Two Claude loops exist. Document "check my V2 requests" and use a different heartbeat key.
  - Users must import their V1 workspace. Provide `python3 v2/server/import_v1.py`, which copies `requests`, `messages`, `versions` and `meta` read-only from `app/data/kit.db`.

**Option B: evolve `app/`, freeze V1 at the `v1.0` tag, and build `/v1/` in Pages from the tag.**
- Pros: one codebase, and users upgrade in place.
- Cons:
  - V1 is no longer visible in the tree.
  - The workflow needs a second checkout of the tag.
  - Builders editing `app/` risk breaking the frozen behaviour that the owner asked to keep.
  - A rollback means reverting merges.

Go with **A**. The new `pages.yml` steps are:
1. `python3 app/export_static.py dist`
2. `python3 v2/server/export_static.py dist/v2`
3. upload `dist`

## 5. File ownership and Wave 0

Ten builders. A comes first, at the end of Wave 0. B starts with A. C–J start once A's components and `registry.js` stubs are merged. **Rule:** a builder edits only the files listed under their letter. Shared registries are pre-filled in Wave 0, so nobody needs to edit them later.

```
v2/
  README.md                         B
  server/
    server.py          (boot, static, security headers, Origin/Host/CSRF check, :4318)   B
    router.py          (@route registry; auto-imports routes/*.py and tools/*.py)        B
    db.py              (connect, user_version migrations, meta, workspaces/runs tables)  B
    catalog.py         (TYPES/groups/scenarios moved out of server.py)                   B
    questions.py, i18n_fr.py, sources.py  (copied from app/)                             B
    routes/requests.py chat.py profile.py files.py workspaces.py (publish, ai)          B
    kit.py             (+ patch, reply by message ids, id checks)                        B
    export_static.py, import_v1.py, tests/test_api.py                                     B
    migrations/        (NNN_<tool>.sql, ranges per owner)                                 per owner
    tools/http_proxy.py                                                                   C
    tools/sql_runner.py, sample/cards.sql (+ build script)                                D
    tools/schemas/<id>.json                                                               tool owner
    seed/  (copied V1 seeds)                                                              B; seed/tools/<id>.*  tool owner
  web/
    index.html, config.js, main.js                                                        A
    css/tokens.css base.css components.css layout.css print.css                           A
    js/core/api.js store.js (ServerStore/LocalStore) router.js dom.js (html``, esc)       A
    js/core/markdown.js (lazy marked/DOMPurify/mermaid/bpmn) exports.js (Word/PDF/copy)  A
    js/core/i18n.js (t(key), missing-key log) + i18n/en.js fr.js (core strings only)     A
    js/ui/*.js  button field select tabs table grid(editable) modal toast(aria-live)
                empty-state code-editor kv-editor json-view splitpane                    A
    js/shell/sidebar.js topbar.js tool-frame.js (inputs | run | result | AI | publish)   A
    js/views/home.js new.js type.js deliverable.js chat.js profile.js                    A (ported V1)
    js/tools/registry.js (all 18 ids pre-filled, lazy import)                            A
    js/guide/help.js help_fr.js (ported to module)                                        A
    vendor/ (pinned marked, dompurify, mermaid, bpmn-js modeler, sql.js + SRI)           A
    js/tools/<id>/index.js view.js logic.js i18n.js samples.js tool.css  test.html        owner below
```

Every tool folder carries its own `i18n.js` (`{en:{}, fr:{}}`), which `core/i18n.js` merges, and its own `tool.css`, scoped as `.tool-<id>`. This keeps translations and styles conflict-free.

| Owner | Tools (skill → tool) |
|---|---|
| **A** | Design system, shell, core, V1 views ported, Guide, registry, vendor |
| **B** | Backend core, kit.py, DB, static export, `pages.yml`, V1 import, tests |
| **C** | `testing-apis` → **API tester**: method, URL, auth, params/body; assertions; save case; export curl, Postman collection, pytest; `http_proxy.py`; mock API for the demo |
| **D** | `generating-sql` → **SQL runner** on the sample cards DB (sql.js in the demo); `sql_runner.py` |
| **E** | `modeling-processes` → **BPMN editor**; `designing-conversational-journeys` → **journey flow builder** |
| **F** | `managing-backlog` → **WSJF and PI capacity planner** (Jira CSV); `prioritizing-ai-use-cases` → **value × feasibility matrix** |
| **G** | `running-uat` → **UAT tracker** (dashboard, go/no-go); `managing-xray-tests` → **Xray import builder**; `evaluating-rag-quality` → **eval scorer** |
| **H** | `writing-prds` → **PRD builder**; `writing-user-stories` → **story builder** with INVEST check and CSV; `writing-functional-specs` → **SFD/SFG builder** |
| **I** | `mapping-data` → **mapping grid and checks**; `analysing-gaps-and-impacts` → **impact matrix**; `curating-knowledge-bases` → **content backlog** |
| **J** | `facilitating-workshops` → **agenda, timer and report**; `aligning-stakeholders` → **RACI and decision memo**; `governing-ai-risk` → **risk register** |

**Wave 0: mechanical moves, one agent, no behaviour change.** Done when V2 at `:4318` matches V1 screen for screen.
1. Run `git init` in this folder and commit the V1 copy as the baseline. Tag it `v1-baseline`.
2. Create the `v2/` tree. Copy `app/seed`, `sources.py`, `questions.py` and `i18n_fr.py` to `v2/server/`.
3. Split `server.py`. Lines 29–365 (`TYPES`, `BA_EN`, `BA_FR`, `EXAMPLES` and the merge) go to `catalog.py`. `db()`, `init_db`, `get_meta`, `set_meta` and `load_seed` go to `db.py`. Each `do_GET`/`do_POST`/`do_DELETE` branch goes to `routes/*.py` through `@route`. Set `PORT=4318` and the DB path to `v2/data`. Cache `types_payload()` once at boot.
4. Copy `kit.py` and point it at the V2 DB. Use the heartbeat key `heartbeat` in the V2 DB. Since the DBs are separate, there is no clash.
5. Split `app.js` along its existing `// ----------` sections, as listed after these steps. Replace `window.Kit` with imports, but keep a temporary `window.Kit` shim until `help.js` is ported.
6. Turn `i18n.js` into `i18n/fr.js` (`export default`). Split `app.css` by its comment sections into tokens, base, components, layout, views and print.
7. Change `index.html` to load `<script type="module" src="main.js">` and move the libraries into `vendor/`, lazily loaded.
8. Create `registry.js` with 18 stub tools. Each stub shows the V1 "new deliverable" form, so the app is never broken. Add the route `#/tool/:id`.
9. Write `v2/server/export_static.py` and a `pages.yml` that builds `dist/` (V1) plus `dist/v2/`.
10. Smoke-test: run both servers, open every route in EN and FR, and check that the demo export loads with zero console errors.

The `app.js` split for step 5:

| Section of `app.js` | Moves to |
|---|---|
| helpers | `core/dom.js`, `core/format.js` |
| diagrams and markdown | `core/markdown.js` |
| state and live updates | `core/store.js` |
| shared pieces | `ui/` |
| views | `views/*.js` |
| exports | `core/exports.js` |
| router | `core/router.js` |

**Wave 1 fixes that come before any tool lands** (owned by A and B):
- Origin, Host and `X-Kit-Token` check on every write; JSON-only bodies.
- An `html` tagged template that escapes by default.
- An `aria-live` toast and focus moved on route change.
- An ETag on `/api/state`, with the catalog moved to its own `/api/catalog`.
- Structured JSON errors carrying an i18n `code`.
- A "server offline" banner.
