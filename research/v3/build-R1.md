# Build R1 · ai-risk-register rebuild (V3)

Owner files only: `app/web/js/tools/ai-risk-register/*`, `skills/governing-ai-risk/SKILL.md`. Date: 2026-11-16.

## Legal basis (official text only, read on the Publications Office / Official Journal)
- Regulation (EU) 2024/1689: Art. 6, Art. 50, Annex III read in full (`publications.europa.eu/resource/celex/32024R1689`).
- Regulation (EU) 2026/1744 of 8 July 2026 (Digital Omnibus on AI), OJ L 24.7.2026, in force 27.7.2026
  (`publications.europa.eu/resource/celex/32026R1744`). EUR-Lex HTML itself returns an empty page to scripts (WAF), so the
  same documents were taken from the Publications Office (Cellar).
- Confirmed from the amending text:
  - Art. 113(c): Annex III high-risk from **2 December 2027**; Art. 6(1) / Annex I from **2 August 2028**.
  - Art. 5(1) new points **(ba)** non-consensual intimate material and **(bb)** child sexual abuse material, plus 5(1a), 5(1b):
    apply from **2 December 2026** (Art. 113(a)). Other prohibitions: since 2 February 2025.
  - Art. 111(4): Art. 50(2) marking for systems placed on the market before 2 August 2026: by **2 December 2026**. Art. 50 itself
    applies since 2 August 2026 (general date, unchanged).
  - Art. 4 reworded ("take measures to support the development of AI literacy"). Art. 27(4)-(5) reworded (FRIA can reuse the DPIA).
  - Art. 6(3), 6(4) and Annex III point 5 are **not** amended (Art. 6 only gets 1a-1c on safety components).
- Not re-read (taken from knowledge of the 2024 text, flagged for counsel): Art. 5(1)(a)-(h) wording, Art. 26, 27 scope, 86, 99(3).

## What changed
- `logic.js`: tier logic rewritten as an explicit decision tree. Gate 1 Art. 5 → Gate 2 Art. 6(1)/Annex I, Art. 6(2)/Annex III,
  5(b) fraud exception, Art. 6(3) derogation → Gate 3 Art. 50 → minimal. New result shape: `tier` (adds `incomplete`),
  `status` (final / provisional / incomplete), `atLeast`, `worstCase`, `path` (reasoning steps), `transparency`,
  `derogationState`, `fria`. New: `obligations(c, role)`, `keyDates(c, today)`, `visibleQuestions`, `derogationOpen`,
  `addUnique`, `LEGAL` (dates + source). New questions: `p6` (Art. 5(1)(ba)-(bb)), `hA` (Annex I), `h8` (Annex III 2, 3, 6, 7, 8).
  Existing answer ids keep their meaning, so saved workspaces still load (they show "Incomplete" until the 3 new questions are answered).
- `index.js`: step 0 "Your role" (provider / deployer / both); Art. 6(3) questions appear only after an Annex III hit;
  result panel = tier + status + worst case, reasoning path (coloured steps with article numbers), "why this tier",
  to confirm, obligations by role with article and date, application dates, legal basis line, disclaimer
  ("Screening aid, not legal advice. Verify the classification with counsel…"). Button "Add the obligations to the register".
  Guided demo: `autorun` flags removed; nothing is classified while `ctx.guided` (or before the first run, state `_classified`); the tier appears after "Classify and score", then follows
  the answers live. Before the run the pane shows a one-line invitation. The register, heat grid and checks are always live and editable.
  Markdown export and both AI prompts updated (path, obligations, dates, new articles).
- `samples.js` / `samples.json`: 4 samples per language. EN: Visa credit-limit scoring model (High-risk) · fraud scoring
  (Minimal, 5(b) exception) · card services chatbot (Limited) · chargeback triage (Limited). FR: CB fraud scoring first, then credit, chatbot, tri des impayés.
- `i18n.js`: all legal strings rewritten EN + FR (255 keys each, parity tested). `tool.css`: path, obligations, dates styles.
- `skills/governing-ai-risk/SKILL.md`: transparency date fixed; new section "EU AI Act tier screening (decision tree)" with the
  obligations / dates table; two quality-check lines.

## Audit bugs (audit-4 §5)
| # | Bug | Status |
|---|---|---|
| 1 | Credit scoring + fraud purpose → Minimal | Fixed. Credit scoring is always 5(b); the exception needs credit = No. Test "bug 1", "bug 1b" |
| 2 | Art. 6(3) granted on blank profiling | Fixed. Needs profiling = explicit No AND conditions = explicit Yes; never for 5(b) or Annex I. All four conditions (a)-(d) shown. Tests "bug 2", "bug 2b" |
| 3 | Empty wizard → Minimal | Fixed. "Incomplete"; minimal needs every relevant answer. Test "bug 3" |
| 4 | High-risk hides Art. 50 duties | Fixed (cumulative, Art. 50(6)). Test "bug 4" |
| 5 | Dates out of date | Fixed from the OJ text of 2026/1744; "text used / checked on" line shown. Test "bug 5" |
| 6 | Missing scope | Fixed: `hA`, `h8` + scope line "screened for banking and payments uses". Test "bug 6" |
| 7 | No provider / deployer | Fixed: role step, duties filtered by role, FRIA for 5(b) and 5(c). Test "bug 7" |
| 8 | Wording p5, Art. 50(1) "obvious" | Fixed: p5 now says "for law enforcement"; note under t1. p5 still groups (e)-(h) in one question (kept short for a bank; ref shows (e)-(h)) |
| 9 | Starter risks duplicated | Fixed (`addUnique`). Test "bug 9" |
| 10 | Register grid 1,560 px wide | Partly: min width cut to 1,320 px. Won't fix fully here: a row expander needs the shared `ui.grid` (not my file) |
| 11 | h6/h7 always shown | Fixed. Test "bug 11" |
| Ex. | Evasive triage sample; add high-risk sample | Fixed: triage now "Limited"; credit sample added; fraud sample is the FR opener |
Plan items not done: residual score after control (register), one-question-at-a-time wizard (kept the full list with a live path instead).

## Tests
`cd app/web/js && node --test tools/ai-risk-register/logic.test.mjs` → 22 pass, 0 fail (11 regression tests, 7 tier-path tests,
unsure handling, EN/FR key coverage for every reachable result, samples, register).
Smoke (headless Edge, 1440 px): `#/tool/ai-risk-register?sample=en` → invitation, no tier; primary button → "High-risk",
path of 5 steps; "Add the obligations" twice → 14 rows (no duplicates); `?sample=fr` → Minimal with the fraud exception step.
No console errors from the tool (only the `/api/*` 404s of the static test server). Shot: `research/v3/shots/v3-ai-risk-register.png`.

## Open issues / for counsel
- The tool treats credit scoring as profiling in every case (no Art. 6(3) route for 5(b)). This is the cautious reading; counsel may accept narrower cases.
- "Unsure" keeps the lower tier but flags "provisional" and shows the worst case; it does not force the higher tier.
- GPAI model duties, importer / distributor duties and Art. 2 exclusions are out of scope (said on screen).
- Fine amounts (Art. 99(3)) and Art. 26 / 27 / 86 summaries were not re-read on the OJ in this session.

## Needs from others
- A (shell): `tools/talking-points.js` entry for this tool could add "see the reasoning path with article numbers"; registry `desc` is still fine.
- A (shell): `ui.grid` row expander would finish bug 10.
