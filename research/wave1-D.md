# Wave 1 · D · SQL runner (`sql-runner`, skill generating-sql)

Status: **working, locally and in the static demo**. Zero JS errors in headless Edge in either mode. All 12 samples (6 EN + 6 FR) return their stored answers, both through Python sqlite3 and through sql.js. Final screenshots must be retaken after A lands the tool-frame CSS (see open issues).

## Files (owner D only)

| File | Contents |
|---|---|
| `app/web/js/tools/sql-runner/index.js` | Tool module (A's §1 interface, `layout: 'split'`): mount, update, validate, run, renderResult, status, toMarkdown, exports, aiActions |
| `…/logic.js` | Pure, node-testable: `maskSql`, `splitStatements`, `pickStatement(sql, selStart, selEnd)`, `isReadOnly`, `translate(sql, 'postgres'\|'oracle') → {sql, notes}`, `starterQuery(tables, schema)`, `tablesIn`, `columnKinds`, `chartSpec`, `checks(run)`, `matchesExpect(run, expect)`, `toCsv` (RFC 4180 with a formula-injection guard), `toTsv`, `mdTable`, `slug`, `schemaText`, `JOINS`, `DIALECTS` |
| `…/engine.js` | `runSql({server, engine, sql, maxRows})`, `getSchema(...)`, `resetBrowser()`. `auto` uses `POST /api/tools/sql/run` when `ctx.server` exists and falls back to the browser engine if that call fails |
| `…/worker.js` | sql.js 1.14.2 in a classic Web Worker (`vendor/sql.js/`, seeded from `data/cards-sample.sql`, `PRAGMA query_only = ON`). The page terminates the worker after 3 s, which is how the time limit works in the browser |
| `…/samples.js` | 6 EN (Visa / Harbor Bank) + 6 FR (CB / Banque Lumière), each with `expect` (the stored answer) and `autorun` |
| `…/prompts.js` | `draftPrompt`, `explainPrompt`, `translatePrompt` (the method from skills/generating-sql) |
| `…/i18n.js`, `…/tool.css` | EN + FR strings. Styles are scoped and use tokens only (the one exception is a 2 px gap between chart bars) |
| `app/server/tools/sql_runner.py` | `POST /api/tools/sql/run` `{sql, max_rows?}` → `{ok, columns, rows, total, truncated, ms, engine}` or `{ok:false, error:{code, message}}` (HTTP 200: a bad query counts as a result). `GET /api/tools/sql/schema` → `{tables:[{name, rows, columns:[{name,type,pk}]}]}`. Both routes use `db=False` |
| `app/server/tools/sample/cards-sample.sql` | **The single source of the seed.** It is research/06 `seed.sql` minus the Q1–Q5 tail, with corrected PANs and 2 lookup tables added |
| `app/server/tools/sample/build_cards_db.py` | `python3 app/server/tools/sample/build_cards_db.py [--check]` rebuilds `cards.db` and copies the seed to `app/web/data/cards-sample.sql` |
| `app/server/tools/sample/cards.db` | Generated (612 KB). The server also rebuilds it on its own when the .sql is newer. **Suggest adding it to .gitignore** |
| `app/web/data/cards-sample.sql` | The copy that sql.js loads (21 KB). `export_static.py` already ships it |

## Safety (server)
- Opened as a `mode=ro` URI with `PRAGMA query_only`.
- An authorizer allows only SELECT, READ, FUNCTION, RECURSIVE and the read-only PRAGMAs (table_info…). ATTACH, writes, DDL and other PRAGMAs are refused.
- One statement per call.
- `set_progress_handler` stops a query after 2 s.
- 500-row cap; `total` is still counted up to 100 000 rows.
- 20 000-character limit on the SQL text and a 64 KB body cap.

Tested: DELETE / CREATE / ATTACH / `PRAGMA query_only=OFF` → `sql.read_only`; a runaway recursive CTE → `sql.timeout` after 2.0 s; two statements → `sql.one_statement`; `load_extension` is unavailable. Error codes: `sql.empty|too_long|read_only|timeout|one_statement|error`. The front end translates them by code.

## Data changes
- **Test PANs corrected (research/09 decision 12).** `last4` now makes `400000 000000 <last4>` Luhn-valid on every card: 1018 1026 1034 1042 1059 1067 1075 1083 · 1091 1109 1117 1125 1133 1141 · CB 2016 2024 2032 2040 2057 2065. **C and K must use the same values** in the mock fixtures (`…1014` → `…1018`, etc.).
- **New lookup tables** feed the "approval rate by merchant category" and "top decline codes" questions in EN and FR:
  - `mcc_codes(mcc, label_en, label_fr)`: 11 rows, ISO 18245 descriptions, shortened.
  - `response_codes(code, label_en, label_fr, is_approval)`: 8 ISO 8583 codes.
- The generated data is unchanged: Q1–Q5 from research/06 give the same answers.

## Samples (answers verified)
| # | EN (Visa) | Answer | FR (CB) | Answer |
|---|---|---|---|---|
| 0 | **Storyline:** stolen card approved in stand-in | crd_hb_009 · E008 · stip 1 · listing 160 min | Fil rouge: listing delay per blocked card | crd_hb_009 160 min / 1 approval; crd_bl_002 1 min / 0 |
| 1 | Approval rate by merchant category | Misc retail 47.4 % (QuickGift) | Taux d'acceptation par catégorie | 87.5–92.1 %, no anomaly |
| 2 | Top decline codes | 51 44.1 %, 05 28.0 %, 59 21.3 % | Principaux motifs de refus | 51 54.0 %, 91 appears (no stand-in for CB) |
| 3 | Which day had a host problem | 14 Oct, stip 3.8 %, three 91s | Jours avec refus 91 | 14 Oct, 3 out of 27 |
| 4 | Card-testing attack | M-011, 17 Oct, 28 of 41 | same, in FR | same |
| 5 | Disputes that break the procedure | DSP-2026-0021 (day 127), DSP-2026-0022 (10.4 without a report) | same, in FR | same |

## Screen
- **Command bar:** Question · Tables (chips, ticked in the schema browser) · Dialect (SQLite / PostgreSQL / Oracle segmented) · Run ⌘↵.
- **Config pane:**
  - An "AI-assisted draft · Use this draft" notice appears when `state.ai['draft-sql'].sql` exists.
  - SQL editor (A's codeEditor). Running a selection runs only that part; otherwise the statement under the caret runs.
  - "Starter query" joins the ticked tables on their known keys, with no AI. Copy button.
  - Live translation panel when the dialect is not SQLite: rewritten SQL plus notes.
  - Schema browser: every table with its row count. Expand a table to see columns (type, PK). Clicking a column or table name inserts it at the caret; the checkbox picks the table.
  - Advanced · n set: engine (Auto / Local server / In the browser), row limit, Reset sample data.
- **Results pane:**
  - Status pill: `● 11 rows · 11 ms`.
  - Status-strip extras: engine badge (Local / In-browser SQLite), Table | Chart switch (when there is a label column and a numeric column; the chart is the default view for 2-column results), Copy (TSV), CSV.
  - Check badges: "Matches the sample answer", row count, no NULLs, one row per first column.
  - Truncation notice, A's table (numbers right-aligned and formatted with Intl; NULL shown muted).
  - "What this shows" interpretation field, prefilled by the samples.
- **Save as deliverable:** `toMarkdown` gives question / tables / dialect, the query plus its translation and notes, a result table (first 50 rows), checks and the interpretation.
- **Exports:** `.sql` in the chosen dialect, result CSV (the Markdown export comes from the frame).
- **Ask Claude:**
  - `draft-sql` (`expects: 'sql'`): schema of the ticked tables, join keys, skill rules. It asks for an SQLite block, plus the target dialect, and for `{"sql": …}` through `kit.py patch --action draft-sql`.
  - `explain` (markdown): query plus the first 10 result rows; skill review mode.
  - `translate` (`expects: 'sql'`): includes the rule-based drafts so Claude corrects them.

## Demo script (60 s)
1. Open `#/tool/sql-runner`, then Load sample, then "Stolen card approved in stand-in". It runs on its own and shows 1 row: crd_hb_009, E008, stip 1, 160 min, with a ✓ for matching the sample answer.
2. Switch the dialect to PostgreSQL to see the translation panel, then use Export ▾ → .sql.
3. Load "Top decline codes" and switch to Chart; the CSV is also there. Then Save as deliverable.
4. Type `DELETE FROM cards` and press ⌘↵. The error reads "read-only: only SELECT and WITH".

## Verification done
- **Python:** `build_cards_db.py --check`; the guard matrix above; all 12 samples matched their `expect`.
- **Node:** logic unit checks, plus `toMarkdown` / exports / prompts in Node.
- **Headless Edge (CDP), local app, port 4304:** the samples autorun with the right pills and badges and "Matches the sample answer" in EN and FR. No exceptions.
- **Static export** (`export_static.py`, served on its own): the sql.js worker loads.
  - The sample matches.
  - A 2-column query draws 3 bars.
  - DELETE gives the read-only message.
  - A runaway CTE is stopped at 3 s and the next query runs fine.
  - FR also passes.

## Open issues
1. **A's CSS for the tool frame, fields, code editor and segmented controls was not in place at screenshot time.** `screenshots/v2/D-sql-runner-{light-en,dark-en,light-fr,dark-fr,result-en}.png` show the shell styled but the tool body unstyled. Retake them once A lands the CSS.
   - Also, at one point `core/router.js` imported `views/deliverables.js` before that file existed, which left the whole app blank. It exists now.
2. **The PostgreSQL / Oracle translation was not executed on a real database.** The sandbox refused a throwaway Postgres (shared memory). It covers boolean SUM, julianday, strftime, substr, LIMIT → FETCH FIRST, and an alias in WHERE / GROUP BY; anything else is flagged "to check" in the notes. Oracle `TO_DATE` on a 10-character date is *to confirm*.
3. **Two items for other builders:**
   - `expects: 'sql'` is outside A's documented `markdown|json`; it is passed through to `/ai`.
   - No `app/server/tools/schemas/sql-runner.json` (not my folder). B could add `{"type":"object","properties":{"sql":{"type":"string","maxLength":20000}}}` so Claude's draft-sql patch is validated.
4. **No `samples.json` was written:** the export already produces tool sample files, and mine live in `samples.js`. I can add one if B's export asks for it.
5. **The tool-frame logs run errors with `console.error`** (A's code), so expected user errors such as read-only show up in the console.
