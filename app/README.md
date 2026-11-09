# Analyst Kit

Turn your notes into client-ready deliverables (process maps, PRDs, user stories, API test plans, SQL queries) and talk to Claude about them.

## Everyday use

- **New deliverable** (or press `N`): pick the type, choose the client, paste your notes, then `⌘↵`.
- **Conversation** next to every document: ask questions or request changes. Claude answers there and updates the document. Earlier versions stay in the **Version** menu.
- **Chat with Claude**: for everything that isn't a deliverable, like workshop prep, client emails, document reviews or interview practice.
- **Hand it over**: Download Word, Save as PDF or Copy, then **Mark as sent** so you can see what the client already has.
- **Continue from this document**: turn a PRD into user stories, or a process map into a PRD, in one click.
- **Your profile**: your name and company go on every document. Language, writing style and backlog tool shape how Claude writes. Claude also adds what it learns from your feedback.

When the sidebar says **Claude is online**, everything is picked up automatically. When it's offline, type "check my requests" in your Claude chat.

## Start the app again later

```bash
python3 app/server/server.py            # PORT=4399 python3 app/server/server.py to use another port
```

Then open http://localhost:4317. No API key or installs needed. Claude's side runs `python3 app/server/kit.py pending`.

## Claude's side (kit.py)

```bash
python3 app/server/kit.py pending                          # work + unanswered messages (with ids)
python3 app/server/kit.py reply 12 answer.md --ids 41 42   # answer deliverable #12, marks only messages 41 and 42
python3 app/server/kit.py reply chat answer.md --ids 43    # answer in the general chat
python3 app/server/kit.py deliver 12 prd.md                # new version of deliverable #12
python3 app/server/kit.py patch 7 cases.json --ids 44      # fill tool workspace #7 (state.ai.<action>)
```

## Security (local only)

The server listens on 127.0.0.1 only and answers only to `Host: localhost|127.0.0.1:<port>`.
Every write needs the per-boot token the page reads from `GET /api/config` (header `X-Kit-Token`) and a
JSON body; requests from other web sites (foreign `Origin`) are refused. So a web page you visit cannot
post to your kit or to Claude. Script it from a terminal with:

```bash
TOKEN=$(curl -s localhost:4317/api/config | python3 -c 'import json,sys;print(json.load(sys.stdin)["token"])')
curl -s -X POST localhost:4317/api/chat -H "X-Kit-Token: $TOKEN" -H 'Content-Type: application/json' -d '{"body":"hi"}'
```

The mock card API (`/mock/harbor/*`, `/mock/lumiere/*`) needs no token, so exported curl / pytest suites run as is.

## Tests

```bash
python3 -m unittest discover -s app/server/tests -t app/server
```

Tool back ends: add `app/server/tools/<name>.py` with `@route` (auto-loaded); see `research/wave1-B-api.md`.

## Layout

```
app/server/   server.py (boot, static files, dispatch), security.py (Host/Origin/token), router.py (@route),
              db.py (schema + migrations), migrations/ (per-tool SQL), catalog.py (skills), toolreg.py (tool ids),
              routes/*.py (API), tools/*.py (tool back ends, auto-loaded), kit.py (Claude's CLI),
              export_static.py (web demo), seed/, tests/
app/web/      index.html, config.js, css/ (tokens, base, layout, components, print), js/ (ES modules:
              core/, ui/, shell/, views/, guide/, i18n/, tools/<id>/)
app/data/     kit.db and uploads (local only)
```

Static demo: `python3 app/server/export_static.py dist` writes a copy with `config.js` setting `KIT_DEMO`
(tools run in the browser; deliverables and chat are read-only), plus `data/catalog.json` and `data/samples/<tool>.json`.

Licences: code MIT (`LICENSE`), content CC BY 4.0 (`LICENSE-CONTENT`). Changes: `CHANGELOG.md`.
