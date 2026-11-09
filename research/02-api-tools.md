# 02 · API clients & "try it" consoles: UX research for the Analyst Kit V2 API tester

Researched 2026-11-08. Question from the owner: *"What are the 3–4 variables someone should input to actually test an API?"*
Short answer: **Method + URL, Auth, Data (query params or JSON body), then one Expected result.** Everything else (headers, cookies, timeouts, scripts, environments) goes behind "Advanced".

## Sources

- Postman, request basics: https://learning.postman.com/docs/sending-requests/create-requests/request-basics/
- Postman, test scripts (pm.test, Snippets, AI Agent Mode): https://learning.postman.com/docs/tests-and-scripts/write-scripts/test-scripts/
- Postman, cURL import and Code → cURL export: https://learning.postman.com/docs/getting-started/importing-and-exporting/importing-curl-commands/
- Postman, run tests manually / Collection Runner with CSV data: https://learning.postman.com/docs/tests-and-scripts/run-tests/run-tests-manually
- Postman collections handed to non-technical sales teams: https://apievangelist.com/2019/09/15/giving-a-postman-collection-to-your-sales-team/
- Bruno, Assert tab (expression · operator · value): https://docs.usebruno.com/testing/tests/assertions
- Bruno, plain-text `.bru` files in git: https://dev.to/jessyt/bruno-manage-your-api-collections-as-plain-files-in-git-28ah
- Thunder Client, scriptless GUI tests: https://docs.thunderclient.com/testing · operator list: https://mvolkmann.github.io/blog/thunder-client
- Insomnia, testing (scripts recommended, legacy unit tests hidden): https://developer.konghq.com/insomnia/test/
- HTTPie Desktop, layout, cURL paste, auth, environments, "we like to simplify things, a lot": https://httpie.io/docs/desktop
- Yaak, cURL import from clipboard/URL bar, Copy as Curl: https://yaak.app/docs/collaboration/import-curl-commands
- Hoppscotch, create a request: https://docs.hoppscotch.io/documentation/getting-started/rest/creating-a-request · interceptor/CORS proxy: https://docs.hoppscotch.io/documentation/features/interceptor
- Swagger UI config (`tryItOutEnabled`, `displayRequestDuration`, `persistAuthorization`, `requestSnippetsEnabled`): https://swagger.io/docs/open-source-tools/swagger-ui/usage/configuration/
- Swagger UI Authorize → padlock → Try it out → Execute → curl + Request URL + response: https://docs.zowe.org/v3.3.x/user-guide/api-mediation-swagger-try-it-out , https://help.hcl-software.com/zao/9.1.0/Admin_Guide/swagger_ui_use_authorization.html
- Scalar API reference with built-in client and proxy for CORS: https://github.com/scalar/scalar
- Stripe API reference (nested params collapsed by default, sandbox key decides mode, "Not a developer?" path) and Workbench API Explorer (fill params → equivalent command → "Print SDK code"): https://docs.stripe.com/api , https://docs.stripe.com/workbench/shell
- RapidAPI Hub, Endpoints tab → Test Endpoint, key header prefilled, snippets in right pane: https://rapidapi.com/guides/use-api-from-rapidapi

## Findings

### Comparison table

| Tool | First thing you see | Hidden / secondary | Auth entry | Response view | No-code assertions | Import / export |
|---|---|---|---|---|---|---|
| **Postman** | Method dropdown (GET) + URL + Send/Save; tabs Params · Authorization · Headers · Body · Scripts · Settings | Scripts, Settings, Cookies | Authorization tab, type dropdown; inherits from collection | Status · time · size badges, Pretty/Raw/Preview, JSONPath filter, Headers tab | **No.** JS `pm.test` plus Snippets and an AI agent | Paste curl into URL bar or Import dialog; Code panel with curl and ~20 languages; collection JSON |
| **Insomnia** | Method + URL, Body/Auth/Query/Headers tabs | Tests tab hidden as "legacy"; scripts recommended | Auth tab | Status, time, size; filter | **No.** Chai in scripts | curl, OpenAPI, Postman import; code generation |
| **Bruno** | Method + URL; tabs Params · Body · Headers · Auth · Vars · Script · **Assert** · Tests | Script and Tests (JS) | Auth tab, inherit from collection | Status, time, size, pretty JSON | **Yes.** Rows of `expression · operator · value`, e.g. `res.status equals 200`, `res.body.id isNotEmpty`, `res.responseTime lt 1000`. 25+ operators | `.bru` text files in git; curl and Postman import; CLI `bru run --env` |
| **Thunder Client** | Method + URL inside VS Code; tabs Query · Headers · Auth · Body · **Tests** | Scripting | Auth tab | Status, size, time | **Yes.** Dropdowns: ResponseCode / ResponseTime / Content-Type / Header / Json Query (`json.id`) / Set Env Var, actions equal, notEqual, contains, count, isType, `<` `<=` `>` `>=` | curl import, codegen, Postman import |
| **HTTPie Desktop/Web** | Method + URL; body and auth switchers at bottom left; preview panel | Everything else; "distraction-free" | Basic, Bearer, API key (header or query); collection-level auth | Status, time, size at the bottom (detail on hover); headers table collapsed when there's a body; copy body/headers | No | Paste curl into the URL field (it switches to curl mode, handles Chrome "Copy as cURL"); export curl |
| **Yaak** | Method + URL; sidebar | — | Auth tab | Status/time/size | Limited | Clipboard curl detection shows an Import button; Copy as Curl |
| **Hoppscotch (web)** | Method + URL + Send at the top; Parameters · Body · Headers · Authorization · Pre-request · Tests below | Scripts | Authorization tab | Status, time, size, JSON tree | JS `pw.expect` | curl import, codegen; **CORS needs an interceptor** (extension, proxy, local agent) |
| **Swagger UI** | Read-only docs; "Try it out" button per operation (`tryItOutEnabled` defaults to false) | Request duration (off by default), snippets | One global **Authorize** button; padlock closes once set; can persist | Generated curl, Request URL, status, headers, body, duration | No | Built from OpenAPI; curl only |
| **Scalar / Redoc** | Docs on the left, "Test request" client on the right with fields prefilled from the spec | Optional params | Auth block on top, applied to all calls | Status, time, body | No | OpenAPI in; snippets per language; CORS proxy URL option |
| **Stripe reference + Workbench** | Required params listed first, **nested/optional collapsed**, code sample + example response on the right | Optional params expand on demand | Your **sandbox test key prefilled** once logged in; the key decides test vs live | Example and live JSON | No | Fill params → equivalent CLI command → "Print SDK code" |
| **RapidAPI Hub** | Endpoint list on the left, params form in the middle, snippets on the right; "Test Endpoint" | Optional params | API key header **prefilled** | Status, latency, body | No | 20+ snippet languages |

### Patterns that recur (and that we copy)

1. **One line rules them all.** Every tool puts `[METHOD ▾] [URL ...........] [Send]` on one row at the top. Nothing else is required to fire a GET.
2. **Paste curl into the URL bar** (Postman, HTTPie, Yaak) is the quickest way in. Devs give BAs a curl; the BA pastes it and every field fills itself.
3. **Auth is set once, above the request** (Swagger's Authorize, Scalar's auth block, collection-level auth in HTTPie/Bruno/Postman). Supporting None, Bearer, API key and Basic covers almost every case a payments BA sees. OAuth2 client-credentials is the only one we add later.
4. **Docs consoles prefill.** Stripe, RapidAPI and Scalar prefill the key and example values, so the first Send works without typing anything. That's the "60-second demo" effect.
5. **Optional is collapsed.** Stripe collapses nested params, Swagger hides duration and snippets, HTTPie collapses the headers table. Required fields come first.
6. **Response header strip = 3 numbers.** Status (coloured: 2xx green, 4xx amber, 5xx red), time in ms, size in KB. Then pretty JSON, with Headers as a second tab.
7. **No-code assertions exist only in Bruno and Thunder Client**, and both use the same grammar: *target · operator · expected value* rows. Postman and Insomnia need JavaScript, which is the "complication" the owner is reacting to.
8. **Browser-only tools hit CORS** (Hoppscotch, Scalar). They fix it with a proxy. Our Python server can be that proxy locally. The static demo has to call CORS-enabled APIs or an in-page mock.
9. **BA/QA use for UAT** (Postman docs, API Evangelist): a dev or lead prepares a collection with an environment, and the BA picks the environment (UAT vs SIT), edits a few values (often from a CSV data file), runs the collection, and keeps the pass/fail report as evidence. BAs don't write scripts. They change *data* and read *results*.

## Decisions for Analyst Kit V2

**D1. The four inputs (answer to the owner).**
1. **Request**: Method (GET/POST/PUT/PATCH/DELETE, default GET) + URL. One row, with Send.
2. **Auth**: None · Bearer token · API key (name + value, header or query) · Basic (user/pass). Chosen once per collection, overridable per request.
3. **Data**: a key/value grid for *query params*, plus a JSON *body* editor for POST/PUT/PATCH (the body tab is hidden for GET/DELETE). Pasting `?a=1&b=2` into the URL fills the grid, and editing the grid updates the URL, in both directions.
4. **Expect**: what "pass" means. Defaults to `Status equals 200`, prefilled from the first response.

Advanced (collapsed under "More"): headers (Content-Type set automatically for JSON), timeout (default 30 s), follow redirects, environment variables `{{base_url}}`, `{{token}}`, notes.

**D2. Progressive disclosure, 3 levels.**
- L0 (first view): Method · URL · Send, plus a sample chooser ("Try a sample: Visa authorisation EN / Autorisation CB FR / Public echo API").
- L1 (shown after the first Send or by clicking): Auth · Params · Body · Expect tabs.
- L2 ("More"): Headers · Variables/Environment · Settings.

**D3. Layout (desktop ≥1100 px: request on the left, response on the right; mobile: stacked).**

```
┌ API Tester ─────────────────────────────── Env: [UAT ▾]  [Import ▾] [Export ▾] ┐
│ Saved tests        │ [POST ▾] [ {{base_url}}/v1/authorisations         ] [Send ▶]│
│ ▸ Visa auth (EN)   │  Paste a curl command here to fill everything              │
│   ✓ Approve 100€   │ ─────────────────────────────────────────────────────────── │
│   ✗ Decline 05     │ [Auth] [Params 2] [Body] [Expect 3] [More]                  │
│ ▸ CB FR            │  Auth: (•)Bearer ( )API key ( )Basic ( )None                │
│ History            │  Token [●●●●●●●●●●  👁]                                      │
│  14:02 POST 201    │ ── Response ─────────────────────────────────────────────── │
│  14:01 GET  200    │ [201 Created] 184 ms · 1.2 KB      [Pretty][Raw][Headers]   │
│                    │ {  "id": "auth_9f2", "status": "APPROVED",                  │
│ [+ New test]       │    "response_code": "00", "amount": 10000 }  ← click a value│
│                    │ ── Checks ────────────────────────────── 3/3 passed ✓ ───── │
│                    │ ✓ Status         equals      201                            │
│                    │ ✓ $.status       equals      APPROVED                       │
│                    │ ✓ Response time  less than   500 ms                         │
│                    │ [+ Add check]          [Save as test case]  [Run all ▶]     │
└────────────────────┴─────────────────────────────────────────────────────────────┘
```

**D4. Turning a sent request into a test case without code.**
- After a response, **"Save as test case"** opens a two-field dialog: Name (prefilled "POST /v1/authorisations → 201") and folder. It stores method, URL, auth reference, params, body and checks.
- **Click-to-assert:** clicking any value in the pretty JSON (or the status badge, or the time) adds a check row, prefilled with the JSON path and the current value, e.g. `$.response_code equals "00"`. This is what makes it faster than Bruno and Thunder Client, where you type the path yourself.
- Checks come from the first response: Status equals the actual status, and Response time < max(500 ms, 2× actual) rounded.

**D5. Assertion types (row = Target · Operator · Expected).**

| Target | Operators |
|---|---|
| Status code | equals, not equals, is one of (e.g. `200,201`), between (`200-299`) |
| Response time (ms) | less than, less or equal |
| JSON path (`$.a.b[0].c`) | equals, not equals, contains, exists, does not exist, is empty / not empty, is type (string/number/boolean/array/object/null), matches regex, greater/less than, length equals |
| Header (name) | exists, equals, contains |
| Body text | contains, does not contain |
| Size (bytes) | less than |
| JSON schema (L2) | is valid against the pasted schema |

Each failed row shows **expected vs actual** in plain language: "Expected `$.status` = APPROVED, got DECLINED." Pass/fail is computed in JS on the client, with no AI and no eval of user code.

**D6. Collections, history, environments.**
- History keeps the last 100 sends (method, URL, status, time, timestamp) in SQLite (`data/kit.db`) locally and in localStorage in the static demo. Clicking an entry reloads it.
- A collection is a folder of test cases. **Run all** runs them in order, then shows a results table (case · status · time · checks passed) and a summary "7/8 passed". Report export as Markdown/CSV for UAT evidence (D8).
- Environments are named key/value sets (`base_url`, `token`, `merchant_id`). The UAT / SIT / Demo switch sits top right. `{{var}}` is highlighted in the URL and body. Secrets are masked and never exported unless the user opts in ("include secrets" stays unchecked by default).
- Chaining (L2): "Save `$.id` as `{{auth_id}}`" on a check row, the same idea as Thunder Client's Set Env Var. This covers authorise → capture → refund flows.

**D7. Import.**
- **Paste curl** into the URL bar (auto-detects `curl `), or Import ▾ → cURL. It handles `-X`, `-H`, `-d/--data-raw`, `-u`, `--url` and Chrome's `$'…'` quoting.
- Import ▾ → **Postman collection v2.1 JSON** (requests and variables; `pm.test` scripts are kept as notes but not executed).
- Import ▾ → **OpenAPI 3.x** (JSON/YAML): one request per operation, with example values prefilled, the way Scalar and RapidAPI do it.

**D8. Export (Export ▾, per request or per collection).**
1. **cURL**: copy to clipboard (one request).
2. **Postman collection v2.1**: checks translated to `pm.test` (`pm.response.to.have.status(201)`, `pm.expect(pm.response.json().status).to.eql("APPROVED")`, `pm.expect(pm.response.responseTime).to.be.below(500)`).
3. **pytest + requests** file: one test per case; env vars for `BASE_URL`/`TOKEN`; assertions mirror the checks.
4. **Run report**: Markdown/CSV (case, expected, actual, pass/fail, timestamp, environment). This is the UAT evidence a BA attaches to Jira.
5. "Ask AI": hands the collection to the existing `testing-apis` skill to expand it into the full test matrix (validation, boundaries, auth/BOLA, idempotency). That's the one place the AI adds value.

**D9. How requests are fired.**
- **Local app:** `POST /api/http/send` on `server.py` (stdlib `urllib`/`http.client`) acts as the proxy, so there's no CORS problem. It returns status, headers, body, `elapsed_ms` and size. Guards: bind to localhost only, 10 MB response cap, 30 s timeout, and a warning banner if the host looks like production (`api.` with no `sandbox`/`test`/`uat`) on POST/PUT/PATCH/DELETE (per the SKILL.md rule).
- **Static demo (GitHub Pages):** direct browser `fetch()`. Samples only target CORS-open APIs (`https://httpbin.org/anything` echoes the payment body; `https://jsonplaceholder.typicode.com`) plus a **built-in mock** at `mock://payments/v1/authorisations`, resolved in JS. It returns `00 APPROVED` for amounts ≤ 50 000 and `51 DECLINED – insufficient funds` above, and `401` with no token. If a CORS error happens, show plain-language help ("This API blocks browser calls. Use the local app, which sends it from your machine.") rather than a raw `TypeError`.

**D10. Copy and onboarding for non-developers.**
- Field labels in business words with the technical word in grey: "What to call (URL)", "Who you are (Auth)", "What you send (Params/Body)", "What should come back (Checks)". EN/FR.
- Empty state: three sample cards. A one-line tip under the URL: "Got a curl from a developer? Paste it here."
- Status badge tooltips explain codes: 401 "not logged in / bad token", 403 "not allowed", 404 "wrong URL or id", 422 "data rejected, see body", 5xx "server problem, not your test".
- Keyboard: Ctrl/Cmd+Enter = Send, Ctrl/Cmd+S = Save as test case.

**D11. The 60-second demo script ("How to test an API", Visa EN; CB FR mirrors it).**
1. *(0–5 s)* Open API Tester → click **"Visa authorisation (sample)"**. Method POST, URL `{{base_url}}/v1/authorisations`, Env "Demo", Bearer token prefilled, body `{ "pan": "4111111111111111", "amount": 10000, "currency": "EUR", "merchant_id": "M123" }`.
2. *(5–15 s)* Press **Send**. You get `201 Created · 120 ms · 0.4 KB` and pretty JSON with `"status": "APPROVED", "response_code": "00"`.
3. *(15–25 s)* Click `"APPROVED"` in the response, and the check `$.status equals APPROVED` appears. Click the time badge to add `Response time < 500 ms`. Checks read 3/3 ✓.
4. *(25–35 s)* **Save as test case** → "Approve 100 €".
5. *(35–45 s)* Change `amount` to `90000`, Send. You get `DECLINED`, `51`, and the check turns red: "Expected APPROVED, got DECLINED". Save it as "Decline insufficient funds" with expected value `DECLINED`.
6. *(45–55 s)* Clear the token, Send → `401`, with the tooltip "not logged in". **Run all** → the table shows 2/2 passed.
7. *(55–60 s)* **Export ▾ → Postman collection / pytest / Report.md**. "That's your UAT evidence."

**D12. Out of scope for V2 (documented on purpose):** GraphQL/gRPC/WebSocket, OAuth2 authorization-code flow, pre-request JavaScript, mock-server authoring, cloud sync and team workspaces. These are where Postman gets complicated, and the owner explicitly asked to avoid them.
