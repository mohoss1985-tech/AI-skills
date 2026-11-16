# Skills Portal (V3) · Audit scorecard of the 20 V2 tools (2026-11-16)
Details + Talking points per tool: audit-1..4.md. W = works · Wk = works but weak · B = broken.

| # | Tool | Score | Top problem | Fix size |
|---|---|---|---|---|
| 1 | ai-risk-register | **B** | Tier wizard legally unsafe (credit scoring → "Minimal"; blank → derogation; old dates) | L (Fable) |
| 2 | use-case-scorer | **B** | Score/Roadmap stale after weights change | S |
| 3 | rag-eval | Wk | Scoring = word matching under Ragas names; flipped yes/no passes | L (Fable) |
| 4 | tokenization | Wk | Opens at end state; not step-by-step | M (Fable) |
| 5 | payment-lifecycle | Wk | Missed deadline has no outcome; €0.00 tiles | M |
| 6 | sql-runner | Wk | Question box needs Claude; chart hidden | M |
| 7 | story-builder | Wk | Broken sentences, nonsense split, Jira epic link lost | M |
| 8 | prd-builder | Wk | Parser eats digits ("3DS"→"DS"), FR metric split | S |
| 9 | xray-builder | Wk | Drops Cucumber/Generic; downloads with errors | S |
| 10 | bpmn-editor | Wk | Canvas 548×438 shows 2 of 11 shapes; Fit → 30 % | M |
| 11 | journey-builder | Wk | Chat below the fold; test utterances never run | S |
| 12 | impact-heatmap | Wk | Prints "null"; rename wipes scores | S |
| 13 | wsjf-planner | Wk | Add item re-sorts + overwrites IDs; cut line wrong | S |
| 14 | workshop-kit | Wk | Timer/notes lost on reload; Fit-to-duration fails on sample | S |
| 15 | kb-audit | Wk | Comma / DD-MM date silently corrupts | S |
| 16 | api-tester | W | 2nd Send on demo → 409 red, sticks | S |
| 17 | sfd-builder | W | Rules CSV doesn't feed UAT/Xray as claimed | S |
| 18 | uat-tracker | W | "5/5 covered" when 4 failed/blocked | S |
| 19 | mapping-grid | W | Correct mapping shows 8 warnings | S |
| 20 | raci-grid | W | (minor) no row reordering | S |

## Cross-cutting (all tools)
1. Samples open already computed → the presenter never takes the first step. V3: sample loads inputs only; the
   primary button runs it (guided demo).
2. Primary button / ⌘↵ no-op in several tools.
3. No shared ID scheme across PRD → SFD → Story → Xray → UAT (FR-n / RG-nn / S-n / CARD-nnn) → traceability is cosmetic.
4. NEW: Talking points panel in every tool (Replaces · What it does · How it works) — texts ready in audit files.
5. Rename to "Skills Portal".
