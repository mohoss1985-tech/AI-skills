# Build B report
## use-case-scorer
- Fixed: grid Score/Lane columns now repaint on every weight/rule change and CSV paste (setRows + per-paint compute cache); duplicate IDs after delete (nextId = max suffix+1, unique); rows keyed by hidden `_uid`, not by id; note shown on lane cards; volume documented as tie-break only (hint EN/FR); rank-change arrows (▲n/▼n) after weight/rule changes (plan item 3, partial).
- Guided (rule 8): results (computed columns, chart, lanes) hidden until first Run, invitation shown; first paint deferred one macrotask because the frame sets ctx.guided after mount; `autorun` removed.
- Tests: logic.test.mjs +8 (weight change, blank weights, nextId, duplicate ids/_uid).
- Won't fix: draggable bubbles, anchors, volume-as-value (M, later).
## wsjf-planner
- Fixed: Add item no longer re-sorts or overwrites IDs (new row stays put until you leave it, focus goes to its Feature cell; ID no longer clobbered); new row has blank Pts = "not estimated" (excluded + flagged, was committed for free); cut line: when a smaller item fits below the first miss, the single line is not drawn and rows are labelled "Skipped" instead (`res.skipped`, `res.cleanCut`); blank/invalid score never ranks (WSJF null, last, flagged; Jira desc shows "?"); pasted CSV blank/0 scores are kept and reported, not silently 1; errors worded for the grid (no "line 2 / job_size"), EN+FR; note column added (plan item 6, partial).
- Guided (rule 8): ranking, WSJF/CoD/PI cells, bar, lower panels, errors hidden until Run; invitation shown; no auto-sort before Run; `autorun` removed. First paint deferred one macrotask (frame sets ctx.guided after mount).
- Deliberate deviation from wsjf.py: 0/blank points are not committed (parity test `quotes` replaced by an explicit expectation).
- Tests: +9 in logic.test.mjs.
- Won't fix: "1 pts" plural, Feature column truncation (grid.js is not mine), capacity slider / normalise column / iteration board (M/L, later). Sample not reworked.
## impact-heatmap
- Fixed: stray "null" under the heatmap (replaceChildren(null)); rename of an area keeps scores and re-points gaps (`renameAreas`, no more pruning on edit; retyping a name restores its scores); area without a kind now flagged instead of silently "System" (EN/FR); "Update summary" now does something visible (reveals Top risks + Checks + status pill); heat ramp neutral -> amber -> red on status tokens (plan item 4, partial).
- Guided (rule 8): heatmap + gap grid are inputs and show at once; Top risks / Checks / status hidden with an invitation until Run; `autorun` removed.
- Tests: +5 in logic.test.mjs.
- Won't fix (M-size redesign): Impact vs Effort second measure, effort-range rollup (354-1260 d), cell drawer, image export, sort by total.
## workshop-kit
- Fixed: reload from a `?sample=` link wipes the live session (tool strips `sample=` from the hash at the first user change via history.replaceState, so the frame restores the last workspace; frame itself untouched); Fit to duration now moves surplus topics to "Next workshop" (fitAndMove) so the 2-topics-per-60-min check passes; Reset timer needs a second click within 4 s; "Finish workshop" on the last block (stores time, pauses); overrun beep once per block; notes editable; capture parses `@"Ana Lopez"`, `@Ana` + attendee full name, and day-first dates (20/11, 20/11/2026, 20.11.26).
- Guided (rule 8): checks, status pill and report hidden with invitation until Run; `autorun` removed.
- Tests: +7 asserts in logic.test.mjs.
- Won't fix (M): drag-reorder / timer keyed by block id (timer still by position), full-screen presenter mode, weekday dates, demo-run button; sample still opens with 18 notes.
## kb-audit
- Fixed: comma in a title (7 columns) now reported with its row ("put the title in quotes"), not silently shifted; DD/MM/YYYY, DD.MM.YYYY, D/M/YY accepted (day first, normalised to ISO) and impossible/garbage dates reported; duplicate article ids, non-numeric volume and bad answer letters reported; errors shown in an alert panel and block Run via validate(); unknown owner no longer "has left" (new wording EN/FR); "1 week" plural; Markdown now has an H1 and ## sections.
- Guided (rule 8): tiles/tabs hidden with invitation until Run; `autorun` removed.
- Tests: +8 in logic.test.mjs.
- Won't fix (M, later): editable grid, CSV file import, verdict-first/Pareto, health score, second sample.
