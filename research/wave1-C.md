# Wave 1 · Builder C · API tester (`api-tester`, skill `testing-apis`)

Status: built, logic verified headless (EN + FR). **Not yet verified in a browser:** this session could not bind port
4303 (sandbox denied; the unsandboxed retry was refused), so there are no screenshots and no live click-through.
The coordinator should run `PORT=4303 python3 app/server/server.py` and take the `screenshots/v2/C-api-tester-*.png` set.

## What was built

`app/web/js/tools/api-tester/`
| File | Role |
|---|---|
| `index.js` | Tool module for the tool frame: command bar (Method + URL, paste a curl into the URL field to import it), tabs Auth · Params · Body · Expect · More, Cases/History side panel, result view, exports, AI actions, `tick` for AI patches |
| `logic.js` | Pure: request model, `{{var}}` substitution, curl parse/emit, checks (6 targets × 18 operators) + plain-words explanations, JSON path, Postman v2.1 and OpenAPI 3 import, PAN scan/mask, production-host detection, secret masking |
| `send.js` | One `sendRequest()`, three routes: in-page mock (static demo), local proxy `/api/tools/http/send` (mock URLs rewritten to `/mock/<bank>/v1`), direct browser fetch with a plain-words CORS message |
| `runner.js` | `runSteps` / `runCase` / `runSuite`: multi-step cases, captures (chaining), data rows, mock reset before a case |
| `exporters.js` | cURL, Postman v2.1 (with `pm.test`), pytest, evidence report (Markdown + CSV) |
| `samples.js` | 4 samples per language: 60-second demo (block lost card → contactless payment declined 41), 10 ready test cases, 12 token/chargeback cases, real httpbin.org call |
| `yaml.js` | Small YAML reader for OpenAPI import |
| `i18n.js` | EN + FR strings (all keys used in code present in both; checked by script) |
| `tool.css` | Scoped styles, tokens only, 720 px breakpoint |
| `harbor-bank-openapi.yaml` | Copy of `research/demo-api/harbor-bank-openapi.yaml` for "Import ▸ Harbor Bank demo spec" (8 endpoints) |

Server: `app/server/tools/schemas/api-tester.json` (new) validates the `generate-cases` AI patch
(`kit.py patch <ws> <file> --action generate-cases`). The UI shows the result as an "AI-assisted draft" banner that adds the cases.

Safety rules in the tool: secrets are removed from history, saved cases and exports unless they are `{{variables}}` or the
published demo keys; real-looking PANs (non-test, Luhn-valid) give a red banner and a confirm dialog before sending;
writes to production-looking hosts need confirmation (client side and proxy `http.production_confirm`).

## Public API (tool contract)
`id 'api-tester'`, `layout 'split'`, `schema 1`, `defaults()`, `samples`, `mount`, `validate`, `run`, `renderResult`,
`status`, `toMarkdown`, `exports` [curl, postman, pytest, report-md, report-csv], `aiActions` [generate-cases (json),
explain-failure (markdown)], `onSave` (save as test case), `tick`, `migrate`. Keyboard: Cmd/Ctrl+Shift+C copies the request as curl.

## Verification done
- `node --check` on every module.
- Node smoke test with `window.KIT_DEMO` (in-page mock): all sample cases run, **24/24 pass in EN (Harbor Bank) and FR
  (Banque Lumière)**; Markdown/CSV reports, Postman (30/31 items), pytest (24 tests) and curl generated; OpenAPI demo spec
  imports 8 endpoints; curl import parses method, URL and API-key auth.
- Same smoke test passed on the files from `export_static.py` (the YAML spec is included in the export).
- Schema checked with `kit.validate`: valid example passes, a bad method or missing URL is rejected.
- Temp export, smoke script and logs deleted. No Edge profile was created; no server left running.

## Demo script (60 s)
1. Open API tester → empty state → "Load the 60-second demo" (autoruns).
2. Step 1 `POST /cards/crd_hb_008/block` → 200, card blocked, Exception File listed, wallet tokens suspended; checks bar green.
3. "Next: step 2" → contactless payment declined with response code 41 (lost card).
4. Click a value in the JSON answer → a check is added and explained in plain words.
5. "Run case" replays 3 steps; Export ▾ → curl / Postman / pytest / evidence report.
6. Sample "10 ready-made test cases" → "Run all (11)" → pass table + "Why it failed" + report buttons.

## Open issues
1. **No browser check yet** (see top): layout, both themes, FR wrapping, modal focus, and the proxy route on the local app
   are untested. Screenshots `screenshots/v2/C-*` are missing.
2. Local-app proxy path (`/api/tools/http/send`, `server/tools/http_proxy.py`) not exercised in this session; Python
   files parse, but the end-to-end call via the proxy was not run.
3. Exported curl/pytest point at `http://localhost:4317/mock/...` (exporters' `LOCAL_ORIGIN` default when not run in the
   browser); confirm 4317 is the intended default app port.
4. Postman import keeps unrecognised `pm.test` scripts as notes only; `-F` (multipart) curl is not supported (told to the user).
5. Browser route only shows CORS-exposed response headers (explained in the UI).
