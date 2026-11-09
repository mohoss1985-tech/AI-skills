# 05 · Technical feasibility for V2 working tools

Scope: what can be built with no build step, no npm or pip install, Python 3 stdlib, vanilla JS, and CDN libraries pinned on jsDelivr/cdnjs/unpkg. I checked everything on 2026-11-08 using the npm registry, `curl` against the CDNs and public APIs, and smoke tests run on this machine (Python 3.9.6, Node). The draft code is in `research/tech-draft/`. Some of it has been run (marked **tested** below).

## Sources

- npm registry metadata (versions, dates, licences): https://registry.npmjs.org/sql.js · /bpmn-js · /mermaid · /codemirror · /highlight.js · /prismjs · /docx · /jszip
- sql.js: https://github.com/sql-js/sql.js · https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/
- bpmn-js licence (watermark clause): https://cdn.jsdelivr.net/npm/bpmn-js@18.31.1/LICENSE · https://bpmn.io/license/
- bpmn-js API (importXML/saveXML/saveSVG): https://github.com/bpmn-io/bpmn-js · https://bpmn.io/toolkit/bpmn-js/walkthrough/
- CodeMirror 6 on esm.sh: https://esm.sh/codemirror@6.0.2 · https://codemirror.net/examples/bundle/
- highlight.js CDN build: https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/
- Public test APIs (CORS checked with `curl -H Origin: https://mohoss1985-tech.github.io` plus a preflight): https://httpbin.org · https://postman-echo.com · https://jsonplaceholder.typicode.com · https://reqres.in · https://dummyjson.com · https://echo.free.beeceptor.com · https://api.restful-api.dev · https://restful-booker.herokuapp.com
- Postman Collection v2.1 schema: https://schema.getpostman.com/json/collection/v2.1.0/collection.json
- Xray: https://docs.getxray.app/display/XRAYCLOUD/Import+Tests+-+REST+v2 · https://docs.getxray.app/display/XRAYCLOUD/Test+Case+Importer · https://confluence.getxray.app/display/XRAYCLOUD/Project+Settings%3A+Test+Types · https://confluence.getxray.app/display/XRAYCLOUD/Using+Xray+JSON+format+to+import+execution+results · third-party summary: https://tessl.io/registry/testland/xray-case-management/files/SKILL.md
- Jira CSV import: https://support.atlassian.com/jira-cloud-administration/docs/import-data-from-a-csv-file/
- Gherkin languages (`# language: fr` keywords): https://cucumber.io/docs/gherkin/languages/
- RFC 2606 (reserved `.example`): https://www.rfc-editor.org/rfc/rfc2606

## Findings

### 1. API tester that sends real requests

**Local app: a `/api/proxy` endpoint is feasible with the stdlib alone** (**tested**, `tech-draft/proxy.py`). It uses `http.client` directly rather than `urllib`, for four reasons:
- every method is supported, including PATCH and OPTIONS;
- error statuses (4xx/5xx) come back as normal responses instead of exceptions;
- redirects are handled by our own code (up to 5, with 303→GET);
- `Accept-Encoding` is not added, so the reported size is the real body size.

It returns `{status, reason, headers:[[k,v]], body, body_encoding, time_ms, size, truncated, final_url, redirects}`. Header pairs are kept as a list so duplicate `Set-Cookie` headers survive.

Results on this machine:
- POST to httpbin: 200 in 402 ms, 503 bytes.
- A call to `127.0.0.1:4317` is refused with "can't call Analyst Kit itself".
- `/redirect/2` is followed, with 2 redirects reported.

**Corporate proxy (important).** This machine, like many corporate laptops, has no direct DNS and reaches the internet only through `HTTPS_PROXY`. Plain `http.client` ignores that variable and fails with "nodename nor servname". The draft reads `urllib.request.getproxies()` and `proxy_bypass()`, then tunnels HTTPS with `set_tunnel()` and sends Basic proxy-auth when the proxy URL contains credentials. With that change it worked.

Security controls in the draft:
- **Bind:** `127.0.0.1` is already used in `server.py:686`.
- **Caller check (`allowed_caller`):** `Host` must be `localhost:4317` or `127.0.0.1:4317`, which defeats DNS rebinding. `Origin`, when present, must be the app's own origin. The custom header `X-Kit-Proxy: 1` is required: a cross-site page would need a CORS preflight to add it, and the server never answers preflights, which blocks CSRF from other websites open in the same browser.
- **Self-block:** the target hostname is resolved, and any loopback or unspecified address on the app's port is refused.
- **Limits:** 1 MB request body, 5 MB response (anything beyond is cut and flagged `truncated`), timeout capped at 60 s, at most 5 redirects, only `http` and `https` schemes.
- **No credential logging:** `log_message` already does nothing. The proxy never writes to the database. Saving a test case should mask the values of `Authorization`, `x-api-key` and `Cookie` (replace them with `{{token}}`) unless the user ticks "keep secrets".
- **TLS:** verification is on by default. An "insecure" toggle exists for internal test hosts with self-signed certificates.
- **Python version:** the draft avoids 3.10+ syntax because the Mac's CLT Python is 3.9.6, while CI uses 3.12.

**Static demo: CORS check of public APIs** (GET plus a preflight for `POST` with `authorization, content-type, x-api-key`):

| API | GET ACAO | Preflight with Authorization | Verdict |
|---|---|---|---|
| httpbin.org (`/anything`, `/status/402`, `/delay/n`, `/redirect/n`) | reflects origin | ✓ all methods incl. PATCH | **Best echo/negative-path API** |
| jsonplaceholder.typicode.com | reflects origin | ✓ | Good CRUD (fakes writes) |
| dummyjson.com | reflects origin | ✓ | Good CRUD + `/auth/login` |
| reqres.in | `*` | ✓ (x-api-key listed) | Works; currently 200 without key; has changed its policy before, so not a primary choice |
| echo.free.beeceptor.com | `*` | ✓ | Echo, rate-limited free tier |
| api.restful-api.dev | `*` | preflight lists only POST | Partial |
| postman-echo.com | **none** | **none** | ✗ Blocked from browsers |
| restful-booker.herokuapp.com | **none** | **none** | ✗ Blocked |

**Mock card-issuer API** (**tested** in Node, `tech-draft/mock-issuer.js`). It lives in the page at `https://issuer.example/v1`. `.example` is reserved by RFC 2606, so it can never reach a real host. Endpoints:
- `POST /authorisations`: Luhn check, then 201 approved (`00`) or 402 declined (`51` insufficient funds, `54` expired card, `43` stolen card);
- `GET /authorisations/{id}`;
- `POST …/reversal` (409 the second time);
- `POST /cards/{last4}/block` (PAN declaration);
- `POST /chargebacks` (422 if the authorisation is not disputable).

Auth is `Bearer demo-token` or `x-api-key: demo-key`; anything else gets a 401. Field errors return 400/422 with a `field` key. Latency is 40–160 ms. Test PANs: `4111111111111111`, `4000000000009995`, `4000000000000069`, `4970100000000154` (all Luhn-valid).

**Service Worker vs in-page interceptor.**
- A Service Worker would make the calls show up in DevTools → Network, but it has drawbacks: it does not control the first page load without `clients.claim()` plus a reload, its scope on Pages is `/AI-skills/v2/`, it has a lifecycle and caching to debug, and it does not work on `file://`.
- The in-page interceptor is a branch inside our own `sendRequest()`, not a monkey-patch of `window.fetch`. It is deterministic, can be unit-tested, and the same mock serves the local app too. **Recommended.**

A single `sendRequest()` (`tech-draft/send.js`) picks the transport:
- `issuer.example` → mock;
- local app → `/api/proxy`;
- demo → direct `fetch` with `credentials:'omit'`, an AbortController timeout, and a plain-English CORS message on `TypeError`.

Assertions (status, JSON path, time, contains) run in the browser for every transport. Limitation of the demo: a browser only exposes CORS-safelisted or exposed response headers, so the headers tab will show fewer headers there. Label it "Headers visible to the browser".

### 2. SQL runner

**sql.js 1.14.2** (MIT, released 2026-08-14; 1.15.x is very recent, 2026-10-14 to 10-26). Files:
- `sql-wasm.js`: 46.5 KB (16.7 KB gz)
- `sql-wasm.wasm`: 658 KB (323 KB gz)

jsDelivr serves the `.wasm` with `content-type: application/wasm` and `access-control-allow-origin: *`, so streaming compilation works from Pages and from localhost. Load it lazily when the SQL tool opens: `initSqlJs({locateFile: f => BASE + f})`.

**Seed:** ship a plain `cards-sample.sql` script (schema plus INSERTs, diffable, a few tens of KB) and load it with `db.exec(text)`. "Reset sample data" just rebuilds the database. `db.exec` returns `[{columns, values}]`; show the last result set, `getRowsModified()` and the time taken. The schema panel uses `PRAGMA table_info`. Exports: CSV, plus a `.sqlite` download via `db.export()`. Draft: `tech-draft/sql-runner.js`.

**Local alternative:** Python `sqlite3` behind `/api/sql`, on a copy of the database, with `PRAGMA query_only` and `set_progress_handler` as the time limit. It is feasible, but it would duplicate the code path and is not needed: sql.js gives identical behaviour locally and in the demo. Keep the Python option only if a user wants to query their own large `.db` file, which is a later feature.

cdnjs carries sql.js only up to 1.13.0. jsDelivr is the source to use.

### 3. BPMN

- **bpmn-js 18.31.1** (2026-10-21). V1 uses the 17.11.1 viewer.
- **Modeler UMD:** `dist/bpmn-modeler.production.min.js`, 572 KB (162 KB gz).
- **Navigated viewer:** 195 KB (55 KB gz).
- **CSS:** `dist/assets/diagram-js.css`, `bpmn-js.css`, `bpmn-font/css/bpmn.css` (about 15 KB).
- **API:** `importXML(xml)`, `saveXML({format:true})` for `.bpmn` export, `saveSVG()` for PNG through V1's `svgTextToPng`, and the `commandStack.changed` event for dirty state.
- **Global name clash:** both UMD bundles assign the global `BpmnJS`. In V2, load only the modeler, which can also be used read-only by hiding the palette, or capture the viewer constructor before loading the modeler.
- **Licence:** MIT plus a clause: *"The source code responsible for displaying the bpmn.io project watermark … MUST NOT be removed or changed … the watermark must stay fully visible and not visually overlapped by other elements."* So nothing (zoom buttons, toasts) may sit in the bottom-right corner of the canvas, and the canvas must not be clipped there.
- Draft: `tech-draft/bpmn-editor.js`, with an empty-diagram template.

**Mermaid** stays as a light read-only alternative for flowcharts and sequence diagrams. It is heavy: 10.9.1 is 3.3 MB (994 KB gz), 11.17.2 is 3.6 MB. 12.x is a new major (12.3.0 came out 5 days ago), so stay on a pinned 11.x and lazy-load it. Mermaid cannot edit BPMN or export `.bpmn`, so it is no substitute for the Process map tool.

### 4. Code editors and JSON viewer

- **CodeMirror 6 without a bundler** works through esm.sh (`codemirror@6.0.2` → a 387 KB bundled module). The catch: esm.sh resolves transitive dependencies as **semver ranges** (`/@codemirror/view@^6.0.0`, `/@codemirror/state@^6.0.0`). Versions are therefore not really pinned, and mixing packages risks the well-known "multiple instances of @codemirror/state" error. Pinning everything needs `?deps=` on every import plus an import map. That is fragile, and it breaks "pinned versions only".
- **Textarea plus highlight.js** is much lighter. Use a plain `<textarea>` (monospace, tab-to-indent, a "Format JSON" button using `JSON.stringify(JSON.parse(x), null, 2)`, and an inline parse error with line and column). Highlight read-only views with **highlight.js 11.11.1** from `@highlightjs/cdn-assets`: `highlight.min.js` is 127 KB (43 KB gz) and includes json, sql, bash, python and xml; the theme CSS is under 1.5 KB. Note that the plain `highlight.js` npm package has no browser build in `lib/`, so `cdn-assets` is the one to use. Prism 1.30.0 (20 KB core) is the alternative.
- **JSON viewer:** write our own tree with `<details>`/`<summary>` (folding for free, keyboard-accessible, about 60 lines). Use "copy path" on click, which feeds the assertion builder (`$.data.response_code`).

### 5. Exports

All generators are pure browser functions (`tech-draft/exporters.js`, **tested**: the curl output quotes `'` correctly, the pytest output compiles with `py_compile`, and the French Gherkin and Xray CSV are correct). Secrets are scrubbed to `{{token}}` by default.

- **curl:** `-sS -X METHOD 'url' -H '…' --data-raw '…'`, POSIX single-quoted.
- **Postman v2.1:** `{info:{name, schema:"https://schema.getpostman.com/json/collection/v2.1.0/collection.json"}, item:[{name, request:{method, header:[{key,value}], body:{mode:"raw", raw, options:{raw:{language:"json"}}}, url}, event:[{listen:"test", script:{exec:[…pm.test…]}}]}], variable:[{key:"token"}]}`. A raw string `url` is valid. The assertions become `pm.test` scripts.
- **pytest + requests:** one `test_*` per case, `TOKEN` from `API_TOKEN`, `timeout=30`, and asserts on `status_code`, `r.json()[...]` and `elapsed`.
- **Jira CSV:** columns `Summary, Issue Type, Description, Priority, Labels, Labels, Story Points, Parent`. Repeat a column for multiple values. Acceptance criteria go in the Description, because custom-field names differ per site and are mapped in Jira's import wizard. Add a UTF-8 BOM so French text survives Excel.
- **Xray CSV (Test Case Importer):** one row per step, and rows sharing a `Test ID` form one test. Columns: `Test ID, Summary, Test Type, Priority, Labels, Action, Data, Expected Result`.
- **Xray JSON (Cloud REST v2 bulk, `POST /api/v2/import/test/bulk`):** an array of `{testtype:"Manual", fields:{summary, project:{key}}, steps:[{action,data,result}]}` or `{testtype:"Cucumber", …, gherkin_def}`. The field names come from Xray docs and community examples; the official page did not render through the fetch tool, so check them against one real import before promising them.
- **Gherkin `.feature`:** English keywords, or `# language: fr` with `Fonctionnalité/Scénario/Soit/Quand/Alors/Et`.
- **DOCX:** V1 actually exports **HTML saved as `.doc`** (`application/msword`, `app.js` `downloadWord`). Word opens it, and Google Docs and LibreOffice mostly do too. A true `.docx` would need either the `docx` library or our own OOXML writer. The `docx` 9.x UMD on jsDelivr is `dist/index.umd.cjs` (808 KB), served as `content-type: application/node` with `nosniff`, so **browsers refuse to execute it**: it would have to be vendored as `.js`. Keep V1's `.doc` approach. If a real `.docx` becomes a must, build a minimal OOXML zip with vendored JSZip 3.10.1 (cdnjs, 98 KB) covering headings, paragraphs, tables and PNG images.

### 6. Publishing V2 next to V1

The workflow already uploads `dist/`. Add one step after V1's export (V1's exporter wipes `dist/` first):

```yaml
      - run: python3 app/export_static.py dist
      - run: python3 app_v2/export_static.py dist/v2
```

Result: `/AI-skills/` serves V1 unchanged and `/AI-skills/v2/` serves V2. For this to work, V2 must use only relative URLs (`fetch('data/state.json')`) and hash routing, so GitHub Pages never needs rewrites. The root `.nojekyll` from V1 covers `v2/`. Use a separate `localStorage` prefix (`kit2-`), because both versions share the same origin. The "Try V2 →" link is injected into the **exported** V1 page only, so V1 source stays untouched. Locally V2 runs on its own port (4318) so both can run side by side. Draft: `tech-draft/export_static_v2.py`.

## Draft code (excerpt; full files in `research/tech-draft/`)

```python
# server.py do_POST (V2)
if path == "/api/proxy":
    if not proxy.allowed_caller(self.headers, PORT):
        return self.send_json({"error": "Forbidden"}, 403)
    return self.send_json(proxy.send(self.read_json(), PORT))
```

```js
async function sendRequest({ method = 'GET', url, headers = [], body = '', timeout = 30 }) {
  const u = new URL(url);
  if (u.hostname === MockIssuer.HOST) return MockIssuer.handle({ method, url, headers, body }); // demo + local
  if (!DEMO) return (await fetch('api/proxy', { method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Kit-Proxy': '1' },
      body: JSON.stringify({ method, url, headers, body, timeout }) })).json();
  return directFetch({ method, url, headers, body, timeout }); // CORS-enabled public APIs only
}
```

Files:
- `proxy.py`: the stdlib proxy; has a `__main__` smoke test.
- `send.js`: the transports and assertions.
- `mock-issuer.js`: the fake card-issuer API.
- `exporters.js`: curl, Postman, pytest, Jira CSV, Xray CSV/JSON, Gherkin.
- `sql-runner.js`: the sql.js runner.
- `bpmn-editor.js`: the bpmn-js modeler.
- `export_static_v2.py`: the `/v2/` export.

## Decisions for Analyst Kit V2

1. **API tester transport.** Local: `POST /api/proxy` built on `http.client`, using `tech-draft/proxy.py` as is. It honours `HTTPS_PROXY`/`NO_PROXY`, checks Host, Origin and `X-Kit-Proxy: 1`, refuses calls to itself, and enforces 1 MB in / 5 MB out / 60 s / 5 redirects. Secrets are masked in saved cases and exports by default, and nothing is logged.
2. **Static demo API: both, mock first.** The guided sample targets the in-page mock **`https://issuer.example/v1`** (no Service Worker). A second "real internet" sample targets **`https://httpbin.org/anything`** (echo), plus `https://httpbin.org/status/402` and `/delay/3` for the negative and timeout paths. Also allowed in the demo: `https://jsonplaceholder.typicode.com`, `https://dummyjson.com`. Do not use: postman-echo.com and restful-booker (no CORS). The CORS failure message suggests running locally.
3. **The 4 inputs:** Method + URL, Auth (none / Bearer / API key / Basic, which becomes a header), Params (key/value list merged into the URL), Body (JSON). Headers, timeout and TLS options go under "Advanced". Assertions: status, JSON path equals, time under X ms, body contains.
4. **SQL:** sql.js **1.14.2** from `https://cdn.jsdelivr.net/npm/sql.js@1.14.2/dist/` (`sql-wasm.js` + `sql-wasm.wasm`), lazy-loaded, seeded from a shipped `.sql` script, the same code locally and in the demo. No Python SQL endpoint in V2.0.
5. **BPMN:** bpmn-js **18.31.1** Modeler `https://cdn.jsdelivr.net/npm/bpmn-js@18.31.1/dist/bpmn-modeler.production.min.js` plus its 3 CSS files under `dist/assets/`, lazy-loaded. Import and export `.bpmn`, export SVG/PNG. Keep the bpmn.io watermark visible and uncovered (bottom-right canvas corner stays free). Load a single bundle per page because of the `BpmnJS` global.
6. **Diagrams other than BPMN:** mermaid pinned to **11.17.2** (`https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.min.js`), lazy-loaded only where a Mermaid block exists. Not 12.x yet.
7. **Editors:** no CodeMirror in V2.0. Use a `<textarea>` editor with Format/Validate, highlight.js **11.11.1** `https://cdn.jsdelivr.net/npm/@highlightjs/cdn-assets@11.11.1/highlight.min.js` (plus `styles/github.min.css` and `styles/github-dark.min.css`) for read-only views, and our own `<details>` JSON tree with copy-path. Revisit CodeMirror 6 only by vendoring a self-built ESM file.
8. **Exports:** use `tech-draft/exporters.js`: curl, Postman v2.1, pytest+requests, Jira CSV (BOM, repeated Labels), Xray Test Case Importer CSV, Xray Cloud bulk JSON (verify with one real import), Gherkin `.feature` EN/FR. Word stays as V1's HTML `.doc`. A true `.docx`, if required later, would use vendored JSZip 3.10.1 rather than the `docx` package, whose jsDelivr file is served as `application/node` and blocked.
9. **Publishing:** V1 at `/`, V2 at `/v2/`. Add one workflow step, `python3 app_v2/export_static.py dist/v2`, after the V1 export. V2 uses only relative URLs and hash routes, the `kit2-` storage prefix, and local port 4318. The V1 → V2 link is injected only into the exported V1 page.
10. **Pinning rule:** every CDN URL carries an exact version at least 2 weeks old, with jsDelivr as the default (cdnjs lacks sql.js ≥ 1.14). Add `crossorigin="anonymous"`. Optionally vendor the four heavy files (sql-wasm, bpmn-modeler, mermaid, highlight.js) under `static/vendor/` for offline use. Together they are about 1.5 MB gz, so lazy-loading is mandatory.
