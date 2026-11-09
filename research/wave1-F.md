# Wave 1 · F · WSJF & PI planner, AI use-case scorer

Files (owner F only): `app/web/js/tools/wsjf-planner/*`, `app/web/js/tools/use-case-scorer/*`. No server file. Port used: 4306.
Screenshots: `screenshots/v2/F-{wsjf-planner,use-case-scorer}-{light,dark}-{en,fr}.png` (1440×900, samples loaded, zero console errors).

## WSJF & PI planner (`wsjf-planner`, skill managing-backlog)

| File | What |
|---|---|
| `logic.js` | Line-for-line port of `skills/managing-backlog/scripts/wsjf.py`: `load(items)` (same validation messages), `plan(rows, capacity)` (rank by WSJF, ties by in-PI deadline then smaller size; items enter with their dependency closure; cycle detection), `compute(items, capacity)` (adds pids, cut index, per-item flags `dep-out / pulled / unknown / cycle / deadline`, deadline-missed list), `toScriptJson` (= `wsjf.py --json`), `jiraCsv(res, project)` (= `--jira-csv`, byte for byte), `featuresCsv`, `itemsFromCsv`, `capacityFrom({sprints, velocity, runPct, bufferPct})`, `round2` (Python `round()` half-even on the exact ratio: 5/8 → 0.62), `pyNum` (3 → `3.0` like Python). |
| `samples.js` / `samples.json` | 8 features of research/06 / V1 (Harbor Bank EN, CARD; Banque Lumière FR, CARTE), capacity 120, 4 PI objectives. F-02 = Exception File (FR: liste d'opposition CB) item with the 160-min storyline in its note. FR F-02 changed from V1's "remboursement J+1" to keep the shared storyline. |
| `test-cases.js`, `fixtures.js`, `compare.js` | 8 cases (EN/FR at 120, EN at 60/200, F-04 size 8, half-even ties, cycle, CSV quoting) + 406 `round()` ratios; fixtures = recorded `wsjf.py` output. |
| `test.html` | Open `http://localhost:4317/js/tools/wsjf-planner/test.html` (also in the static demo): **9 / 9 cases identical to wsjf.py**. Terminal: `node app/web/js/tools/wsjf-planner/logic.test.mjs` (`--write-json` regenerates samples.json). |
| `index.js`, `i18n.js`, `tool.css` | The screen (layout `single`). |

Screen: command bar = PI capacity (pts, required) · Jira project key, primary "Rank and plan ⌘↵". Advanced = capacity from
velocity (sprints × velocity − run % − buffer %, "Use n pts") + paste a features CSV (also the way back for AI answers).
Body: meta strip (`119 / 120 pts used · 99 %`, n in PI · n out) → capacity bar (one segment per committed item) → A's grid
(ID, feature, type, BV/TC/RR-OE/size as Fibonacci cells, computed CoD, WSJF, rank, PI badge + flag count) with **live
re-sort** (immediate on score change; deferred to blur while typing text) and a red dashed **cut line** row
("Capacity cut line · 1 pts free") → "Out of the PI and why" (script reasons, translated) + dependency/deadline flags | PI
objectives grid (text, BV 1–10, committed). Exports: Jira CSV, features CSV (runs in wsjf.py), Markdown (frame).
AI: "Challenge my scores" (relative scoring, regulatory TC, sizes vs points, enablers; asks for a corrected features CSV),
"Write PI objectives" (3–6 committed + stretch, BV proposed).

## AI use-case scorer (`use-case-scorer`, skill prioritizing-ai-use-cases)

| File | What |
|---|---|
| `logic.js` | `score(u, weights)` = Σ(score × weight)/Σweights, risk inverted (6 − risk), 1 decimal; `gates` (risk ≥ gate without guardrail; knowledge ≤ gate); `quadrant`; `compute(useCases, weights, rules)` → ranked + lanes Now (score ≥ nowMin, gates passed, ≤ nowSlots) / Next (gated, no slot, or ≥ nextMin) / Later / Excluded (regulated); `scoresCsv`, `useCasesFromCsv`, `bubbles` (geometry, overlapping bubbles spread). Tests: `node app/web/js/tools/use-case-scorer/logic.test.mjs`. |
| `samples.js` / `.json` | 6 card-payment use cases (EN Visa / FR CB): declines (Now), block card with guardrail (Now, storyline), refund status (Next, knowledge gate), unrecognised payment (Next, risk gate), merchant chargeback status (Later), credit-limit advice (Excluded, regulated). Volumes marked illustrative. |

Screen: command bar = value / feasibility / risk weights (default 50/30/20, normalised % shown), "Score and plan ⌘↵".
Advanced = lane rules (Now from score 3.5, Next from 2.5, Now slots 3, risk gate 4, knowledge gate 2) + paste CSV.
Grid (value, feasibility, risk, knowledge 1–5, volume, guardrail, regulated → live score + lane badge) → plain-SVG bubble
chart (x feasibility, y value, size = risk, quadrant labels, lane legend, direct id labels, `<title>` tooltips, focusable)
| Now / Next / Later / Excluded lanes with the reason per item. Exports: scores CSV, Markdown roadmap (inventory, gates ✓/✗,
2×2, lanes, trade-offs). AI: "Suggest use cases for card disputes" (answer as pasteable CSV).

## Demo script (60 s each)
1. WSJF: Load sample Visa EN → 119/120 pts, cut line under F-03. Set F-04 size 13 → 8: it jumps above F-08. Set capacity 60:
   F-01 drops out and the red "Due this PI but not planned: F-01" alert appears. Export ▾ Jira CSV = V1's jira-import.csv.
2. Scorer: Load sample → Now = declines + block card; "Where is my refund?" scores 4.0 but sits in Next (knowledge gate).
   Change its Knowledge to 4 → it moves to Now. Set value weight 0 → lanes reshuffle live.

## Checks done
- Parity: 9/9 wsjf.py cases (ranking, plan, reasons, deadline, Jira CSV byte-for-byte) in node and in test.html (browser).
- Local app (4306) and static export (`export_static.py`): both tools load EN/FR samples, zero console errors; interaction
  checked over CDP (re-sort, capacity cut, weights).

## Open issues
- Grid column widths come from A's `grid` (`width` honoured on `<th>`); long titles are truncated in their input.
- No JSON schema in `app/server/tools/schemas/` for `kit.py patch` (not my file); AI answers come back as Markdown with a
  CSV block the user pastes into Advanced → Paste CSV.
- "1 pts" singular not handled in the cut-line string.
