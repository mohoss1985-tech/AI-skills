# Wave 1 · B · backend core — report

Contract for tool builders and A: **`research/wave1-B-api.md`** (plug-in routes, codes, endpoints).

## Done
- **Security** (`app/server/security.py`, `server.py`): binds 127.0.0.1; Host must be localhost/127.0.0.1/[::1]:port
  (static files too, anti DNS-rebinding); foreign `Origin` or `Sec-Fetch-Site: cross-site` → 403; every
  POST/PUT/PATCH/DELETE needs `X-Kit-Token` (per boot, `secrets.token_urlsafe`, `KIT_TOKEN` env to fix it) served by
  `GET /api/config` (JSON only, never in config.js because a script tag is readable cross-origin); JSON-only bodies
  (415 otherwise, closes V1's text/plain CSRF); body caps (413, 120 MB on uploads); bad JSON / bad Content-Length /
  handler exception → JSON error, keep-alive kept (HTTP/1.1); OPTIONS → 403 no CORS; `nosniff`, `no-referrer`,
  sandbox CSP on uploaded files. Errors everywhere `{error:{code,message}}` (legacy routes converted).
- **Router plug-ins** (`router.py`): `@route(method, pattern, db, token, raw, max_body)`, PUT/PATCH, `ApiError`,
  `h.send_json/send_bytes/error/query/send_no_content`; `tools/*.py` auto-imported, a failing plug-in is skipped
  with a stderr note (`router.LOAD_ERRORS`). DB handlers commit or roll back as a unit.
- **Endpoints**: `/api/catalog` (cached, ETag), `/api/state` (ETag/304, + `workspaces`, 2 grouped queries, seeds
  read once), `/api/workspaces` CRUD, `/runs` (last 50, result capped 256 KB), `/publish` (create/update linked
  deliverable; previous output → `versions` `source='tool'` + the state that produced it), `/ai` (user message with
  `meta`), `GET /api/requests/:id` gains `workspace {id, tool, title, href:"#/tool/<tool>?ws=<id>"}` and
  `versions[].source/has_state`; `GET /api/versions/:id` returns `state` parsed. Deleting a deliverable unlinks
  its workspace; deleting a workspace keeps the deliverable.
- **kit.py**: `pending` lists message `id`s and, for tool messages, `tool {action, expects, state, run, schema}`;
  `reply <id|chat> <file> --ids …` marks only those (unknown ids → error); without `--ids` only messages older than
  the reply file (lost-message bug fixed); `patch <ws> <file.json> [--action] [--ids]` validates against
  `tools/schemas/<tool>.json` (one schema or `{"actions": {id: schema}}`; subset: type/properties/required/items/
  enum/maxLength/maxItems/minimum/maximum/additionalProperties:false) and deep-merges into `state.ai[action]`;
  all commands check ids/args (no tracebacks, exit 1). `deliver` keeps the tool state on the pushed version.
- **db.py**: `KIT_DB` env override; `migrations/NNN_<tool>.sql` runner (applied once, tracked in meta).
  `toolreg.py` reads tool ids from `web/js/tools/registry.js` (single source).
- **export_static.py**: `config.js` `window.KIT_DEMO = {repo, version}` (truthy object, V1-compatible),
  `data/catalog.json`, `data/state.json` (+ `workspaces: []`), `data/samples/<tool>.json` + `index.json` from
  `web/js/tools/<id>/samples.json` (2 found now: wsjf-planner, use-case-scorer). **pages.yml**: tests step,
  V2 at `/`, V1 from tag `v1.0.0` at `/v1/` (tolerant skip kept), build check.
- `LICENSE` (MIT), `LICENSE-CONTENT` (CC BY 4.0 scope + summary), `CHANGELOG.md`, `app/README.md` (kit.py, security, tests).

## Verified
`python3 -m unittest discover -s app/server/tests -t app/server` → **27 tests OK** (security ×13, state/catalog
ETag, workspaces CRUD/validation/runs cap/publish+versions/ai, kit reply ids, default reply, bad args, pending tool
context + patch, schema validator, plug-ins). Live run `PORT=4302` on a temp DB: `/`, modules, state 200; write
without token 403; with token 201. (Sandbox blocks local binding: tests/server run with it disabled.)

## Needs other owners
- **A (`core/api.js`) — blocking**: the UI writes now get `403 security.bad_token` until api.js fetches
  `/api/config` and sends `X-Kit-Token` on non-GET (refetch once on bad_token), and reads
  `data.error?.message ?? data.error` (errors are objects now). Optional: `If-None-Match` on `/api/state`;
  `ServerStore` maps to `PUT /api/workspaces/:id` (not POST) for save; `ctx.ai` → `POST /api/workspaces/:id/ai`.
- **C**: mocks with `token=False` (and `raw=True` if non-JSON); proxy with `db=False`; refuse calls to our own port.
- Tool owners: optional `app/server/tools/schemas/<tool>.json` for `kit.py patch`; `web/js/tools/<id>/samples.json`
  to get exported into `data/samples/`.
- Real repo: create tag `v1.0.0` so Pages publishes `/v1/`.
