# Wave 1 · B · backend API for tool builders (C, D, K, A)

Status: **all live and tested** (`router.py`, `server.py`, `security.py`, `routes/workspaces.py`, `routes/state.py`, `kit.py`). 27 unittest checks pass.

## 1 · Add routes from `app/server/tools/<name>.py` (no edit to B's files)

Every module in `app/server/tools/` is imported at boot (`router.load_all()`, alphabetical). Use `@route`:

```python
# app/server/tools/sql_runner.py  (owner D)
from router import route, ApiError

@route("POST", r"/api/tools/sql/run", db=False)      # db=False: open your own read-only connection
def run_sql(h, conn, m, body):                        # body = parsed JSON object ({} if empty)
    sql = body.get("sql") or ""
    if not sql.strip():
        raise ApiError(400, "sql.empty", "Write a query first.")
    ...
    return h.send_json({"columns": cols, "rows": rows, "ms": ms, "truncated": False})
```

`route(method, pattern, db=True, token=True, raw=False, max_body=2*1024*1024)`

| Option | Meaning |
|---|---|
| `method` | `GET` `POST` `PUT` `PATCH` `DELETE` |
| `pattern` | regex, `re.fullmatch` on the path without query string; groups in `m` |
| `db=True` | `conn` = app SQLite connection (`app/data/kit.db`) under the **global lock**, committed on success, rolled back if you raise. Use `db=False` for anything slow (outgoing HTTP, SQL on another DB) so you don't block the whole kit. |
| `token=True` | Non-GET requests must carry the per-boot `X-Kit-Token`. Set `token=False` only for **mock endpoints** (`/mock/harbor/*`, `/mock/lumiere/*`) that curl / pytest exports call. |
| `raw=False` | Non-GET bodies must be `Content-Type: application/json` and a JSON **object** (else 415/400 before your handler runs). `raw=True`: `body` is the raw `bytes`, any content type (mocks that accept form data, XML…). |
| `max_body` | bytes before `413 request.too_large`. |

Handler `fn(h, conn, m, body)`; `h` gives you:

- `h.send_json(data, status=200, headers=None)`
- `h.send_bytes(data, status=200, content_type="application/octet-stream", headers=None)`
- `h.error(status, code, message)` or `raise ApiError(status, code, message)` → `{"error": {"code", "message"}}`
- `h.query()` → `{key: value}` of the query string; `h.path_only`; `h.headers`; `h.command`; `h.now` (epoch s)
- Uncaught exceptions → `500 server.error` JSON (traceback on stderr); the connection is never dropped.
- A plug-in that fails to **import** is skipped with a stderr message; the kit still boots (`router.LOAD_ERRORS`).

Already done for you, on every request before your handler: Host check (localhost/127.0.0.1/[::1] on the
server port, anti DNS-rebinding), Origin check (foreign Origin or `Sec-Fetch-Site: cross-site` → 403),
token check (writes), JSON parsing, body size cap, keep-alive safe draining. Do **not** add CORS headers.

Error `code`s are stable i18n keys: use `<tool-or-area>.<snake_case>` (`http.timeout`, `http.scheme_not_allowed`,
`sql.read_only`, `sql.timeout`, `mock.card_not_found`). `message` is plain English; the front end translates by code.

Generic codes B emits: `security.bad_host`, `security.bad_origin`, `security.bad_token`, `security.cors`,
`request.not_found`, `request.method_not_allowed`, `request.json_only`, `request.bad_json`, `request.too_large`,
`request.length_required`, `request.bad_length`, `server.error`, `validation.<field>`, `workspace.not_found`,
`workspace.bad_tool`, `request_missing` …

Tips: route order = import order (routes/* first, then tools/* alphabetically), first match wins, so keep
patterns specific (`/mock/harbor/(.*)` is fine; don't register `/api/(.*)`). Put shared helpers in your own
module (e.g. `tools/_mock_data.py` — modules starting with `_` are imported too, harmlessly, if they have no routes).

## 2 · Front end (owner A: `core/api.js`)

1. On boot: `GET /api/config` → `{token, version, demo:false, token_header:"X-Kit-Token"}`.
2. Send `X-Kit-Token: <token>` + `Content-Type: application/json` on every POST/PUT/PATCH/DELETE.
3. On `403 security.bad_token` (server restarted): refetch `/api/config` once and retry.
4. Errors are now `{error: {code, message}}` (V1 was `{error: "text"}`): show `t('err.' + code)` falling back
   to `message`. `api.js` should read `data.error?.message ?? data.error`.
5. `GET /api/state` sends an `ETag`; send `If-None-Match` and treat `304` as "unchanged" (see §3).

## 3 · Core endpoints (B)

| Method | Path | Body → answer |
|---|---|---|
| GET | `/api/config` | `{token, version, demo, token_header}` |
| GET | `/api/catalog` | `{types, groups}` (cached per process; `ETag`) |
| GET | `/api/state` | V1 shape + `workspaces` (summaries); `ETag`, `304` on `If-None-Match` |
| GET | `/api/workspaces?tool=<id>` | `{workspaces:[summary]}` (summary = row without `state`) |
| POST | `/api/workspaces` | `{tool, title?, client?, lang?, state?, schema?}` → `201` full workspace |
| GET | `/api/workspaces/:id` | full workspace: `state` parsed, `last_run`, `request` (linked deliverable summary or null) |
| PUT | `/api/workspaces/:id` | any of `{title, client, lang, state, schema}` → full workspace (`state` replaced whole) |
| DELETE | `/api/workspaces/:id` | `204` (runs deleted; linked deliverable kept, unlinked) |
| POST | `/api/workspaces/:id/runs` | `{kind, input, result, ok, ms}` → `201 {id,…}`; keeps the last 50 runs; `result` capped at 256 KB (`result:{truncated:true, preview}` if over) |
| GET | `/api/workspaces/:id/runs?limit=20` | `{runs:[…]}` newest first |
| POST | `/api/workspaces/:id/publish` | `{output (Markdown), title?, type?}` → creates the linked deliverable or updates it; previous output goes to `versions` with `source='tool'` + `state` snapshot. → `{request_id, created}` |
| POST | `/api/workspaces/:id/ai` | `{action, prompt, run_id?, expects?}` → inserts a user message in the linked deliverable's thread (or general chat if not published) with `meta={action, workspace_id, tool, run_id, expects}` → `201 {message_id}` |

Deliverables (`GET /api/requests/:id`) gain `workspace` = `{id, tool, title}` or null → "Open in tool" link
`#/tool/<tool>?ws=<id>`; `versions[]` gain `source`.

Claude side (`kit.py`): `pending` shows tool messages with workspace state + last run; `reply <id|chat> <file> --ids 12 13`
marks only those messages handled; `patch <workspace_id> <file.json> [--action <id>]` validates against
`app/server/tools/schemas/<tool>.json` (if present) and merges into `state.ai[<action>]`. Tool owners: drop a
JSON Schema there (subset supported: type, properties, required, items, enum, maxLength, maxItems) to have Claude's
patches checked.
