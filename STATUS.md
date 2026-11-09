# Analyst Kit V2 · build status (saved 2026-11-09 00:40)

Resume by telling Claude: **"Continue the Analyst Kit V2 build from STATUS.md in
~/Documents/Claude Built Apps/AnalystKit_V2_2026-11-08_1431."**

## Where things are
- Folder: this one. Own local git repo (NOT the home repo). Commits so far: `a577883` baseline (tag `v1-baseline`),
  `37a410e` Wave 0. Wave 1 work is **uncommitted** on purpose (builders must not commit; Claude commits at integration).
- Published V1 repo: `~/Documents/Claude Built Apps/AI-skills` (clone of github.com/mohoss1985-tech/AI-skills) — untouched.
- Contract: `GOAL.md`, `DESIGN_SPEC.md` (owner decisions ★: one codebase, V2 at `/`, V1 frozen at `/v1/` from tag
  `v1.0.0`; MIT + CC BY; fictional Harbor Bank / Banque Lumière mock API; new tools tokenization + payment-lifecycle).
- Research: `research/01…09` (+ `09-wave0.md`, `demo-api/`, `tech-draft/`). Builder rules: `research/wave1-common.md`.

## Update 2026-11-09 afternoon
All 11 Wave-1 builders done (reports research/wave1-A…K.md). Integration: 27 backend tests + 13 tool logic test files
pass; all 20 tools render with their sample (screenshots/v2/final/); static demo checked (API tester OK; SQL runner
needs a real-browser check because headless virtual time stalls the sql.js worker). Committed `d5f37f0`.
Next: owner says "push" → tag v1.0.0 in AI-skills repo + Release, sync V2 into it, README V1→V2, push, check Pages.
Known polish: Home tool card descriptions still use V1 deliverable text; FR labels in A's action bar; 35 old Edge
profile folders in the system temp dir (deleting them needs the owner's OK).

## Wave 1 builders (reports in research/wave1-<LETTER>.md)
| Builder | Tools | State at save |
|---|---|---|
| A | design system, shell, core, V1 views restyle | running · `wave1-A-api.md` published; no final report yet |
| B | backend, security token, workspaces, kit.py, pages.yml, LICENSE, CHANGELOG | **done** (27 tests pass) |
| C | API tester + Harbor Bank mock (+ tokens/disputes endpoints) | running |
| D | SQL runner | **done** (screenshots to retake once A's CSS lands) |
| E | BPMN editor, Journey builder | running |
| F | WSJF & PI planner, AI use-case scorer | **done** |
| G | UAT tracker, Xray builder, RAG eval | running |
| H | PRD, Story, SFD builders | running |
| I | Mapping grid, Impact heatmap, KB audit | running |
| J | Workshop kit, RACI & power grid, AI risk register | **not started** — prompt pattern = same as I (see below) |
| K | Tokenization simulator, Payment lifecycle & chargeback simulator, skills `tokenizing-cards`, `handling-chargebacks` | running |

If the session ended, running builders stopped: check which `research/wave1-<LETTER>.md` exist, then relaunch missing
builders with "re-check the current state of your files first, then finish your Wave-1 <LETTER> task" + their prompt
(prompts saved in `_Command Library/history/Analyst Kit V1 to V2 (2026-11-08)/`).

## Known follow-ups
- Test PANs: use the corrected Luhn-valid list in `research/wave1-D.md` everywhere (C and K told).
- D: `expects:'sql'` for AI actions → A to allow; B could add `tools/schemas/sql-runner.json`.
- F: long titles truncated in A's grid; "1 pts free" plural.
- Sandbox blocks local ports and `.git` writes → run servers/git with the sandbox disabled.
- Usage limit hit twice (14:00 and 21:00); 7+ agents at once burn ~5 h of quota in ~2 h.

## Remaining phases
1. Finish Wave 1 (J + any unfinished builder).
2. Integrate: run `python3 app/server/server.py`, fix cross-module errors, `python3 -m unittest` in `app/server/tests`,
   static export, headless-Edge screenshots of every tool (light/dark, EN/FR) into `screenshots/v2/`, §9 checklist.
3. Commit in this folder; then sync into `AI-skills` repo: tag `v1.0.0` on current V1 commit + GitHub Release, commit V2,
   README (V1 → V2 before/after, 3 demos, disclaimer), push → Pages builds V2 at `/` and V1 at `/v1/` (only on owner "push").
4. Save this run's prompts to the command library history (folder already created).
