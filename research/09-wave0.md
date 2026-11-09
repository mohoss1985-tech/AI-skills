# 09 · Wave 0: restructure into modules (no behaviour change)

Done 2026-11-08 by the Wave 0 agent. Git repo initialised **in this folder** (not the home-directory repo):
commit `Baseline: untouched copy of V1` tagged **`v1-baseline`**, then `Wave 0: restructure into modules, no behaviour change`.
Nothing pushed. Tag `v1.0.0` (the frozen V1 that Pages builds at `/v1/`) does not exist yet: create it in the real repo on
the last V1 commit. Until then `pages.yml` skips `/v1/` with a warning.

V2 replaces V1 in place (DESIGN_SPEC §1): `app/server/` + `app/web/`, port **4317** (`PORT` env overrides), DB
`app/data/kit.db` (same file as V1, so existing workspaces upgrade through the migrations).

```bash
python3 app/server/server.py                 # http://localhost:4317
PORT=4399 python3 app/server/server.py       # a builder's own port
python3 app/server/kit.py pending            # Claude's side
python3 app/server/export_static.py dist     # static demo (V2) into dist/
```

## Verification

- API: the same 27-call script (state, requests CRUD, messages, sent, files list/upload/download/delete, versions,
  chat, profile, 404s, SPA fallback) run against V1 (`v1-baseline` worktree) and V2: **identical JSON** except the new
  nullable keys `workspace_id` (requests) and `meta` (messages) added by migration 2.
- Static export: `data/state.json` and all 32 `data/requests/*.json` identical to V1's export (timestamps aside).
- Headless Edge 157 over CDP, local server and static demo, EN + FR (+ dark in EN): Home, New (×3), skill pages
  (incl. Xray assistant), 6 deliverables (BPMN, SQL, PRD/Xray), Chat, Profile, and the 20 `#/tool/:id` + an unknown id.
  Zero JS exceptions, zero console errors, zero failed requests (local: 105 page loads; demo: 105; V1 reference: 42 + 42).
  Sidebar + `#main` DOM **identical to V1** on all 42 shared pages, local and demo (after normalising whitespace inside
  templates, bpmn-js random marker ids and "n min ago"). Screenshots byte-identical except 2 local + 3 demo where the
  only difference is the typing-dot animation frame or the focus ring timing on the New form.
- Interaction script (local V2): tool frame mounts + loads `tool.css`, scenario chip, create deliverable from the
  `#/tool/prd-builder` stub → `#/d/34`, send message, delete (two clicks), FR/EN toggle, theme toggle, Guide open + answer,
  Xray assistant, "Try it" scenario → preset form, `n` shortcut, profile. Zero errors.
- One server change was needed for modules: `Server.request_queue_size = 128` (the stdlib backlog of 5 reset
  connections when the browser fetched ~50 modules at once). `daemon_threads = True`.

## File map

### Backend `app/server/` (owner B unless noted)

| File | Contents |
|---|---|
| `server.py` | Boot: `Handler(SimpleHTTPRequestHandler)` serving `app/web/`, `send_json`, `read_json`, `dispatch(method, body)` → router; SPA fallback to `/`; `PORT = int(os.environ.get("PORT") or 4317)`; binds `127.0.0.1`. `STATIC_DIR`. |
| `router.py` | `route(method, pattern, db=True)` decorator, `ROUTES`, `find(method, path)`, `load_all()` (imports every module of `routes/` and `tools/`). Handler signature: `fn(h, conn, m, body)`; `conn` is opened under the global lock unless `db=False`; `body` is the parsed JSON (POST) or `None`; `h.now` = request time on POST. |
| `db.py` | `DB_PATH` (`app/data/kit.db`), `APP_DIR`, `SERVER_DIR`, `SEED_DIR`, `SCHEMA_VERSION = 2`, `db()`, `lock()`, `load_seed()`, `get_meta`, `set_meta`, `claude_online`, `migrate(conn)` (`PRAGMA user_version`; `MIGRATIONS = {1: V1 schema + V1 ALTERs (idempotent), 2: V2}`), `seed_samples(conn)`, `init_db()`. |
| `catalog.py` | V1 content moved verbatim: `TYPES`, `BA_EN`, `BA_FR`, `EXAMPLES`, the FR/questions merge, `TYPE_IDS`, `DEFAULT_PROFILE`; `types_payload()` (cached once per process), `groups_payload()`. |
| `common.py` | `public(files)`, `urlparse_query(path)`, `summary(conn, row)`, `thread(conn, request_id)`. |
| `routes/state.py` | `GET /api/state`. |
| `routes/requests.py` | `GET /api/requests/:id`, `GET /api/versions/:id`, `POST /api/requests`, `POST /api/requests/:id/messages`, `POST /api/requests/:id/sent`, `DELETE /api/requests/:id`. |
| `routes/chat.py` | `GET`/`POST /api/chat`. |
| `routes/profile.py` | `POST /api/profile`. |
| `routes/files.py` | `GET /files/<scope>/<name>`, `GET`/`POST`/`DELETE /api/files`. |
| `routes/workspaces.py` | Empty (B, Wave 1): `/api/workspaces[/:id[/publish|/ai|/runs]]`. |
| `tools/http_proxy.py` | Empty (C): `POST /api/tools/http/send`, `/mock/harbor/*`, `/mock/lumiere/*`. |
| `tools/sql_runner.py` | Empty (D): `POST /api/tools/sql/run`. |
| `kit.py` | Moved from `app/kit.py`; DB path now from `db.DB_PATH`; usage lines say `python3 app/server/kit.py`. Logic unchanged (B adds `patch`, reply-by-ids). |
| `export_static.py` | Copies `app/web` to the target, writes `data/state.json`, `data/requests/<n>.json`, `.nojekyll`, and **`config.js`** = `window.KIT_DEMO = { repo: … }` (no HTML string replace). Imports `catalog` + `db` only (no server, no DB file). |
| `sources.py`, `questions.py`, `i18n_fr.py`, `seed/` | Moved from `app/`. `sources.ROOT` → `app/data/uploads` (same place as V1). |

**DB schema 2** (migration 2, all `IF NOT EXISTS` / column checks):
`workspaces(id, tool, title, client, lang, state JSON, schema INT, request_id, is_sample, created_at, updated_at)`,
`runs(id, workspace_id, kind, input JSON, result JSON, ok, ms, created_at)`, `messages.meta TEXT` (JSON),
`versions.source TEXT NOT NULL DEFAULT 'claude'` (`claude|tool|user`), `versions.state TEXT` (JSON),
`requests.workspace_id INTEGER`, indexes on `messages(request_id)`, `versions(request_id)`, `workspaces(tool)`, `runs(workspace_id)`.
Per-tool SQL migrations (research/07 §3 ranges) can be added as `MIGRATIONS[n]`.

### Front end `app/web/` (owner A unless noted)

`index.html` loads the same CDN libraries as V1 as classic scripts (globals `marked`, `DOMPurify`, `mermaid`, `BpmnJS`),
then `config.js`, then `<script type="module" src="js/main.js">`. Vendoring/lazy-loading the libraries is left to A.

| File | Contents / exports |
|---|---|
| `config.js` | `window.KIT_DEMO = null` locally; the export writes the demo version. |
| `css/tokens.css` | `:root` tokens + dark theme (V1 values). |
| `css/base.css` | Reset, links, focus ring, `[hidden]`. |
| `css/layout.css` | `.app` grid, sidebar, main column / page head. |
| `css/components.css` | Everything else, **in V1 cascade order** (buttons, lists, forms, deliverable, markdown, chat, BPMN, try-it, Guide, files…). |
| `css/print.css` | All `@media print` rules (moved last; they use `!important` or do not conflict, so output is unchanged). |
| `js/main.js` | Entry: `initMermaid()`, `onRefresh(renderChrome)`, 3 s poll (`refresh` + `S.view.tick`), hashchange → `route`, `[data-href]` clicks, `n` and `/` shortcuts, `wireSidebar()`, first `route()`. Imports `shell/kit-shim.js`, then `guide/help_fr.js`, `guide/help.js`. |
| `js/core/dom.js` | `$`, `$$`, `esc`, **`html`** (escaping tagged template; nested `html`/`raw()` not re-escaped; arrays joined; `null`/`false` → ''), `raw`, `el(markup)`, `download(name, blob)`, `isDark()`. |
| `js/core/i18n.js` | **`t(key)`**, `L` (= `t`, V1 name), **`register(ns, {en, fr})`** → scoped `T(key)` (keys stored as `ns.key`), `getLang`, `setLang` (persists `kit-lang`), `onLangChange`, `LANGS`, `tx(type, field)`, `pick({en, fr})`, `locale()`, `colon()`. |
| `js/i18n/en.js`, `js/i18n/fr.js` | `export default {…}`. EN is empty (V1 keys are the English text); FR is V1's `KIT_FR`. |
| `js/core/format.js` | `date`, `time`, `ago`, `initials`, `lower1`, `fileName`, `greeting`, `size`. |
| `js/core/api.js` | `DEMO`, `DEMO_MSG`, `api(path, opts)`, `get`, `post`, `del`, `server` (`{get, post, del, api}`, `null` in the demo). |
| `js/core/store.js` | `S` (V1 state; `S.lang` is a getter/setter on i18n), `refresh()`, `onRefresh(fn)`, `typeOf`, `statusOf`, `exsOf`, `exLabel`, `prepared`; **`Store`** (interface: `list(tool)`, `get(id)`, `save(ws)`, `remove(id)`, `addRun(wsId, run)`, `runs(wsId)`), **`ServerStore`** (`/api/workspaces…`, routes not built yet), **`LocalStore`** (localStorage + memory fallback, try/catch; IndexedDB is A's), `store` (the active adapter). |
| `js/core/router.js` | `route()`, `currentPath()`, `navigate(hash)`. Routes: `#/`, `#/new[/:type]`, `#/type/:id`, `#/d/:id`, `#/chat`, `#/profile`, **`#/tool/:id`**. |
| `js/core/markdown.js` | `initMermaid`, `renderMarkdown(el, md)`, `renderBpmnBox`, `mountBpmn`, `bpmnSvg`, `svgTextToPng`, `openFullscreen`. |
| `js/core/exports.js` | `svgToPng`, `clientHtml(md)`, `downloadWord(r, t, version)`, `copyRich(r, version)`. |
| `js/ui/button.js` … | §8 component stubs, each a function returning an element: `button`, `field`, `select`, `tabs`, `table`, `grid`, `modal`, `toast` (V1 toast, `toast(msg, href)`), `emptyState` (`empty-state.js`), `codeEditor` (`code-editor.js`), `kvEditor` (`kv-editor.js`), `jsonView` (`json-view.js`), `splitpane`, `statusPill` (`status-pill.js`), `methodChip` (`method-chip.js`). All options objects, e.g. `button({label, variant, onClick, kbd})`. |
| `js/ui/index.js` | Re-exports the 15 components (this is `ctx.ui`). |
| `js/ui/badges.js`, `list.js`, `feed.js`, `files.js`, `questions.js`, `notice.js` | V1 shared pieces: `sq`, `pill`, `claudeMark`, `LABEL`; `listHtml`; `messageHtml`, `paintFeed`, `wireComposer`; `ACCEPT`, `KIND_LABEL`, `kindOf`, `readFile`, `dropHtml`, `wireDrop`, `filesHtml`, `upload`; `qLabel`, `questionsHtml`, `answersHtml`; `demoNotice`. |
| `js/views/home.js` | `viewHome()`. |
| `js/views/type.js` | `viewType(id)`, `tryHtml`, `wireTry`, `startExample(typeId, i)`. |
| `js/views/new.js` | `viewNew(typeId, preset = {}, root = main)` (the `root` argument lets tool stubs mount the V1 form). |
| `js/views/deliverable.js`, `chat.js`, `profile.js`, `tool.js` | `viewDeliverable(id)`, `viewChat()`, `viewProfile()`, `viewTool(id)` (registry → tool frame; unknown id → "Not found"). |
| `js/shell/sidebar.js` | `renderChrome()` (V1 sidebar), `wireSidebar()` (theme + FR/EN buttons). |
| `js/shell/topbar.js` | `topbar({crumb})` stub, not mounted (V1 has no top bar). |
| `js/shell/tool-frame.js` | `mountTool(el, tool)` → wraps in `<div class="tool-frame tool-<id>" data-tool>`, loads `tools/<id>/tool.css` once (`loadToolCss`), builds `ctx` with `makeCtx(tool)`, calls `tool.mount(root, ctx)`, returns `{tick}` if the tool has `tick(ctx)`. |
| `js/shell/kit-shim.js` | Temporary `window.Kit` (`state, typeOf, startExample, toast, esc, L, tx, exsOf, ask, demo, fill`) for the Guide. |
| `js/guide/help.js`, `help_fr.js` | V1 Guide + Xray assistant, unchanged, now loaded as modules (still `window.Kit`/`window.KitChat`/`window.KIT_GUIDE_FR`). |
| `js/tools/registry.js` | `TOOLS` (20 × `{id, skill, group, owner}`), `GROUPS`, `TOOL_IDS`, `toolMeta(id)`, `toolForSkill(skill)`, `loadTool(id)` (literal lazy `import()` per id). |
| `js/tools/<id>/index.js` | Default export, §8 interface: `id, skill, icon, title{en,fr}, schema: 1, defaults(), samples{en:[],fr:[]}, mount(el, ctx), toMarkdown(state, lastRun), exports: [], aiActions: []` (optional `run`, `update(state, ctx)`, `tick(ctx)` are honoured by the frame). 18 stubs mount the V1 form (`viewNew(this.skill, {}, el)`); `tokenization` and `payment-lifecycle` show an EN/FR placeholder. |
| `js/tools/<id>/i18n.js` | `export default { en: {}, fr: {} }`, registered by `index.js` as namespace `<id>`. |
| `js/tools/<id>/tool.css` | Empty, scope rules under `.tool-<id>`. |
| `js/package.json` | `{"type": "module"}` so `node` can import modules for unit tests. |

**`ctx`** (tool-frame): `{tool, state (getter), setState(objOrFn), lastRun, run(), ai(actionId, run), store, i18n: {t, register, pick, lang}, ui, server}`.
`ai()` copies the prompt in the demo, and locally posts it to `/api/chat` until B ships `/api/workspaces/:id/ai`.

### Tool ids (registry)

| id | skill | group | owner |
|---|---|---|---|
| `api-tester` | testing-apis | test | C |
| `sql-runner` | generating-sql | data | D |
| `bpmn-editor` | modeling-processes | specify | E |
| `journey-builder` | designing-conversational-journeys | ai | E |
| `wsjf-planner` | managing-backlog | plan | F |
| `use-case-scorer` | prioritizing-ai-use-cases | ai | F |
| `uat-tracker` | running-uat | test | G |
| `xray-builder` | managing-xray-tests | test | G |
| `rag-eval` | evaluating-rag-quality | ai | G |
| `prd-builder` | writing-prds | specify | H |
| `story-builder` | writing-user-stories | specify | H |
| `sfd-builder` | writing-functional-specs | specify | H |
| `mapping-grid` | mapping-data | data | I |
| `impact-heatmap` | analysing-gaps-and-impacts | plan | I |
| `kb-audit` | curating-knowledge-bases | ai | I |
| `workshop-kit` | facilitating-workshops | facilitate | J |
| `raci-grid` | aligning-stakeholders | facilitate | J |
| `ai-risk-register` | governing-ai-risk | ai | J |
| `tokenization` | tokenizing-cards | data | K |
| `payment-lifecycle` | handling-chargebacks | data | K |

### Other files

| File | Change |
|---|---|
| `.github/workflows/pages.yml` | Checkout with `fetch-depth: 0`; `python3 app/server/export_static.py dist` (V2 at `/`); if tag `v1.0.0` exists: `git worktree add --detach $RUNNER_TEMP/v1 v1.0.0` + `python3 $RUNNER_TEMP/v1/app/export_static.py dist/v1`, else `::warning::` and skip. |
| `README.md`, `README.fr.md`, `app/README.md` | Run command `python3 app/server/server.py`, `app/server/kit.py`, seed links → `app/server/seed/`, layout. |

## Notes for Wave 1

- The sidebar still links to `#/type/<skill>`; `#/tool/:id` is reachable by URL only. A decides the new IA.
- Nothing calls the `ui/*` stubs or `Store` yet; their signatures are a starting point, A may extend them (keep names).
- The sandbox here blocks `.git` writes and local port binding/connecting; git and servers were run with the sandbox
  disabled (`sandbox.network.allowLocalBinding: true` avoids that for servers).
