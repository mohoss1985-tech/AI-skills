# Wave 1 · I · Mapping grid, Impact heatmap, KB audit grid

Status: **working, locally and in the static demo**. All three tools load their EN and FR samples with zero console errors in headless Edge, in both themes. Node tests pass: `node app/web/js/tools/<id>/logic.test.mjs` (`--write-json` regenerates `samples.json`).

Port: 4309 was already held by a `python3 -m http.server 4309` that I did not start, so I left it running and used **4319** (app) and 4329 (static export) instead. Both are stopped now, and the Edge profile and the export folder are deleted.

Screenshots: `screenshots/v2/I-{mapping-grid,impact-heatmap,kb-audit}-{light,dark}-{en,fr}.png` (1440×900), plus `I-mapping-grid-defects-en.png`.

## Files (owner I only; no server file)

| Folder | Files |
|---|---|
| `mapping-grid/` | `csv.js` (shared by all three tools: `parseRows`/`parseList` (a comma inside brackets does not split, e.g. `decimal(9,2)`), `toCsv` (formula-injection guard), `mdTable`, `luhn`, `fill`), `logic.js`, `samples.js` + `.json`, `logic.test.mjs`, `index.js`, `i18n.js`, `tool.css` |
| `impact-heatmap/` | `logic.js`, `samples.js` + `.json`, `logic.test.mjs`, `index.js`, `i18n.js`, `tool.css` |
| `kb-audit/` | `logic.js`, `samples.js` + `.json`, `logic.test.mjs`, `index.js`, `i18n.js`, `tool.css` |

All three use `layout: 'single'`. The command bar holds the 3 required inputs as pasteable lists (textareas). Results refresh live as you type (debounced). The primary button re-runs and records the run.

## 1 · Mapping grid (`mapping-grid`, skill mapping-data)

**Inputs**
- **Command bar:**
  - Source fields: `table.field, type, example`. The example values form the sample record.
  - Target fields: `field, type, mandatory Y/N (O/N), allowed a|b, to-confirm note`.
  - Rules: DQ rules `id, dimension, rule, threshold, on failure, owner`.
- **Advanced:** target table, record key, SQL dialect, translation tables (`T-01, LOST, 0, Lost`), context.

**Mapper:** built on A's grid.
- Columns: source select → target select (`*` = mandatory), transformation, default, mandatory (from the target definition), rule, and a per-row check badge (tooltip lists the issues).
- "Auto-map by name" and "Add rows for unmapped targets".

**Checks**
- `checkMapping()` is a **line-for-line port of `check_mapping.py`**. It gives the same issues in the same order, the same summary line, the same exit code, and the **reconciliation/DQ SQL byte for byte**. The test runs the Python script on 7 cases (the skill example with `--rules`, a SQL Server run, all 4 samples, a defect matrix) and compares.
- `extraChecks()` adds:
  - unknown source or target
  - **type mismatch** (pass-through rule only)
  - **length mismatch** (source longer than target, with no SUBSTR/LEFT/MASK/translation)
  - translation table missing, or giving a value that is not allowed
  - unused source fields (data minimisation)
  - *to confirm* notes
- Three or more issues of the same kind fold into one expandable line.

**Test with a sample record**
- Editable source values give the output record live.
- A small evaluator handles `TRIM UPPER LOWER ROUND ABS COALESCE NULLIF CONCAT SUBSTR LEFT RIGHT LPAD RPAD MASK CAST(… AS DATE|INT|…)`, `* / + - ||`, and "translation table T-nn". A comment in brackets after the expression is allowed, for example `(never the PAN)`.
- Each field gets a status: OK, Default, Empty, Held (mandatory and empty, or a code missing from T-nn), Rejected (too long, not a number or date, not an allowed value, or a **Luhn-valid clear PAN**, per DQ-02), Not evaluated, or *To confirm* (amber).

**Samples**
- EN 0 = V1 seed 20-mapping: fraud cases → Visa fraud report. The sample record is the storyline: E008, crd_hb_009, token tok_9f3a09, €64.90 ECOM, STOLEN → fraud type 1. Result: 0 errors and 8 warnings, the same as the seed.
- FR 0 = 120-mapping: dossier → déclaration GIE CB (crd_bl_002 / E010, VAD → NUMERO_USURPE). Codes and deadlines are marked *à confirmer*.
- Sample 1 (EN and FR): ISO 8583 → internal JSON, with defects on purpose: a duplicate target, an unmapped mandatory field, 40 → 25 characters, an unknown rule. It uses the test PANs …1091 and …2024.

**Exports:** mapping spec CSV (`check_mapping.py` format, runs in the script), reconciliation + checks `.sql`, Markdown (scope, mapping + CSV, translation tables, DQ rules, checks, sample test, to confirm).

**AI actions:** "Suggest transformations" (answer as a mapping CSV), "Draft data quality rules".

## 2 · Impact heatmap (`impact-heatmap`, skill analysing-gaps-and-impacts)

**Inputs**
- **Command bar:** Change, Areas (`name, system|team|process, owner`), Scale (Impact | Effort).
- **Advanced:** deadline + source, context.

**Heatmap**
- Areas × people / process / data / tech / compliance.
- **Click cycles a cell 0 → 3 → 0**; Shift-click lowers it. Keyboard: arrows move (roving tabindex), 0–3 set a score, Space raises it.
- Colour is a sequential single-hue scale (accent mixed into the surface). Every cell also shows its number.
- Row totals, column totals, and grand total / max.
- Effort scale: day range from the skill's basis (S < 10 · M 10–40 · L 40–120).

**Side panel**
- **Checks:**
  - a cell scored 3 with no gap
  - a gap with no owner or no size
  - a gap on an unknown area or on a cell scored 0
  - an impacted area with no owner
- **Top risks:** cells scored 2–3, sorted. Each one shows its gap's to-be, or an "Add gap" button that pre-fills a gap row.
- Totals by kind.

**Gap grid:** as-is vs to-be, with columns area, dimension, as-is, to-be, type (missing / change / remove / no action), owner, size (S–XL).

**Samples:** "Exception File listing in real time" (EN, Visa) and "Liste d'opposition en temps réel" (FR, CB, no stand-in, L133-18 CMF).
- 8 areas, 52 / 120 points.
- 2 flags on purpose: Card management system · tech scored 3 with no gap; a fraud-ops gap with no owner.
- The 4-hourly batch is labelled illustrative. Visa / GIE CB listing methods and timings are *to confirm*.

**Exports:** heatmap CSV, gaps CSV, Markdown (sponsor summary, heatmap table with legend, top risks, existing vs target, open checks).

**AI actions:** "Draft as-is / to-be gaps" (answer as a CSV), "Write the sponsor summary" (with options and RAID).

## 3 · KB audit grid (`kb-audit`, skill curating-knowledge-bases)

**Inputs**
- **Command bar:**
  - Articles: `id, title, owner, last review, type, audience`
  - Owners: `name, team, active|left`
  - Questions: `question, monthly volume, article ids, full answer Y/P/N`
- **Advanced:** audit date, due-soon window, review cycle per type (FAQ 180, procedure 90, tariff 30, policy 365, script 90 days), writers × articles a week, context.

**Tiles**
- Freshness: segmented bar, Fresh / Due soon / Stale / Never reviewed, each with a label.
- Owner coverage.
- Question coverage, as % of monthly volume fully answered, plus gaps and their volume.
- Content backlog, in articles of work and weeks.

**Tabs**
- **Articles:** age / cycle, freshness badge, owner status (none / unknown / left), internal badge, linked questions, volume.
- **Questions:** by volume. Coverage is Covered / Partial / Stale answer / Gap / Internal only; duplicate articles are shown as ×2; unknown article ids are flagged.
- **Owners:** load and stale count, plus a "no owner" row.
- **Actions:** ranked by monthly volume.
  - Action types: write, internal-only (customer version, exclude by metadata), complete partial, review stale or never-reviewed, merge duplicates and check for contradictions, give an owner.
  - Each action has an effort and a week fitted to writer capacity.

**Samples:** Harbor Bank (EN) and Banque Lumière (FR) card support, as of 2026-11-09.
- 10 articles, 8 questions (lost card, declines, refund, unrecognised payment, chargeback / contestation timelines, stolen and used, new card, child card).
- Result: 3 fresh, 1 due, 5 stale, 1 never reviewed; 1 article with no owner and 1 whose owner left; 2 gaps; 56 % covered; 12 actions over 2 weeks.

**Exports:** content backlog CSV, article audit CSV, question coverage CSV, Markdown (frame).

**AI actions:** "Write the content stories" (writer-ready, with acceptance criteria), "Draft the writing standard" (with the metadata schema and review calendar).

## Public API (`_internals` + logic)

- **mapping-grid/logic.js:**
  - parsing: `parseSources`, `parseTargets`, `parseRules`, `parseTranslations`, `model`
  - checks: `checkRows`, `checkMapping(rows, {key, dialect, ruleIds, rulesName, file})`, `extraChecks`, `analyse`
  - mapping CSV: `mappingCsv`, `CSV_HEAD`
  - preview: `evalExpr`, `sampleRecord`, `preview`
  - grid helpers: `autoMap`, `addUnmappedRows`, `typeInfo`
  - messages: `EN_MSG`, `fill`
- **impact-heatmap/logic.js:** `DIMS`, `KINDS`, `GAP_TYPES`, `SIZES`, `EFFORT_DAYS`, `parseAreas`, `cycle`, `compute`, `pruneScores`, `heatmapCsv`, `gapsCsv`.
- **kb-audit/logic.js:** `TYPES`, `DEFAULT_CYCLES`, `parseArticles`, `parseOwners`, `parseQuestions`, `audit`, `actionsCsv`, `auditCsv`, `coverageCsv`.

## Demo script (60 s each)

1. **Mapping:** Load "Fraud cases → Visa fraud reports".
   - Status reads 9 target fields · 0 errors · 8 warnings, matching `check_mapping.py`.
   - `fraud_type` = 1 and `fraud_reported_date` are amber *To confirm*.
   - Type `4000000000001091` into the ARN source value: the output turns Rejected with "Looks like a clear card number".
   - Export ▾ → `.sql`.
   - Then load the ISO 8583 sample to see the duplicate, unmapped-mandatory and 40 → 25 issues.
2. **Heatmap:** Load the sample.
   - Click Card management system · Compliance to raise it.
   - In Top risks, use "Add gap" on a cell that has none, so a pre-filled row appears.
   - Switch Scale to Effort to see the day range. Save as deliverable.
3. **KB audit:** Load the sample.
   - Tiles read 4/10 fresh, 8/10 owned, 56 %, 6 articles of work.
   - The Actions tab starts with "Write an article for 'Where is my refund?'" (7,200 a month).
   - Set Writers to 1 in Advanced: the weeks double.

## Open issues

1. **Unrecognised transformations show "Not evaluated" instead of guessing.** This covers vendor functions, CASE expressions and date formats.
2. **Pasting an AI answer back is not wired into the form.** AI answers come back as CSV blocks for the user to paste into the right field (mapping rows aren't parsed back from CSV into the grid yet). There is also no `app/server/tools/schemas/<id>.json` for `kit.py patch`, which isn't my folder.
3. **Areas are matched by name, so renaming one drops its scores.** Scores are keyed by area name, and `pruneScores` removes scores for names that are no longer listed.
4. **Mapping row badges count warnings.** Every mandatory field without a default shows "Warning", which is what the Python script reports; it is intended (hold, don't invent).
5. **No ui.grid change was needed from A.**
