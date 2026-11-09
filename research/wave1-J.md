# Wave 1 · J · Workshop kit, RACI & power grid, AI risk register

Files (owner J only): `app/web/js/tools/workshop-kit/*`, `app/web/js/tools/raci-grid/*`, `app/web/js/tools/ai-risk-register/*`. No server file. Port used: 4310.
All three are `layout: 'single'` tools built on A's frame and `ui/*` (grid, tabs, segmented, badge, statusPill, advanced, emptyState). No AI or network needed; they work in the static demo (checked on an `export_static.py` build: samples, timer persistence through IndexedDB, zero console errors).
Screenshots: `screenshots/v2/J-<tool>-{light,dark}-{en,fr}.png` + `J-workshop-kit-{live,report}-light-en.png`, `J-raci-grid-{raci,memo}-light-en.png`, `J-ai-risk-register-register-light-en.png`.
Tests: `node app/web/js/tools/<tool>/logic.test.mjs` (all pass; `--write-json` regenerates `samples.json` for the static export).

## Shared
`workshop-kit/jshared.js` (imported by the other two): `csv` (RFC 4180, CRLF), `parseCsv`/`csvObjects` (comma or semicolon), `mdTable`, `fmtT`, `fileBase`, `nextNum`, `h()` DOM builder (text only, never HTML), `wordDoc(title, md)` (HTML-as-.doc through A's `core/exports.clientHtml`, same approach as the PRD/SFD builders).

## Workshop kit (`workshop-kit`, facilitating-workshops)
- Command bar: Goal · Attendees (`Name (role), …`; "sponsor"/"decider"/"décideur" marks the decision-maker, "absent" an invited no-show) · Duration (min). Primary "Check agenda ⌘↵". Advanced: date, start time, room/tool, pre-reads, next workshop, paste agenda CSV (`title,kind,minutes,technique,questions`, the format Claude is asked to return).
- **Plan** tab: agenda grid (computed clock time from the start time, kind intro/topic/break/read-back, minutes, technique, questions, notes per block) + checks: overrun/under vs duration, max 3 topics per 90 min (`floor(3 × d / 90)`), a ≥ 10-min read-back that is last, a decision-maker present, empty blocks, actions without owner/date. **Fit to duration**: adds the read-back if missing, keeps intro/break/read-back, scales topics in 5-min steps, remainder to the longest topic (tested at 45/60/90/120/180 min).
- **Live** tab: block timer (start/pause/resume, previous/next, reset) stored as `state.timer = {i, startedAt, acc, spent}` on the wall clock, so it survives remounts, language switches and reloads (verified: reload during a running block keeps counting); over-run turns the clock red with "n over". Capture: type segmented (Decision/Action/Question/Requirement) + one line with shortcuts `A: … @Owner 2026-11-20`, Enter adds; stable IDs D-01, A-01, Q-01, REQ-01; notes go to the current block; owner/date editable inline for A and Q.
- **Report** tab: rendered compte-rendu (skill §3 contract: header, present/absent, summary counts, decisions, requirements, open questions, actions with a missing-owner flag, agenda planned vs actual, checks, next workshop). Exports: Markdown (frame), **Report (Word)**, **Actions (CSV)** `id,action,owner,due,block,workshop`.
- AI: "Draft agenda from my goal" (asks for a CSV block to paste back), "Clean up my notes into a report" (keep IDs, never invent a decision, *to confirm* for inferences and regulatory statements).
- Samples: EN "Lost / stolen card declaration · notes captured" (Harbor Bank, Visa, V1 seed 16 + the 160-min stand-in storyline, 18 notes) and "Workshop 2 with Legal · plan to fix" (60 min, 3 topics, no read-back → 3 failed checks, Fit to duration fixes 2); FR equivalents (Banque Lumière, CB, liste d'opposition, seed 116).

## RACI & power grid (`raci-grid`, aligning-stakeholders)
- Command bar: Decision needed · Decider · Decide by. Primary "Check RACI ⌘↵". Advanced: overload threshold (default: R or A on more than 4 rows), context, paste stakeholders CSV (`name,role,cares_about,power,interest`).
- **Stakeholder map**: grid (name, role, cares about, power 0–100, interest 0–100, computed quadrant) + plain-SVG 2×2: dots drag with the pointer and move with arrow keys (5 per step, Shift = 1), `role="slider"` with a spoken value; quadrants Manage closely / Keep satisfied / Keep informed / Monitor with an editable engagement strategy each (defaults from the skill).
- **RACI**: matrix of decisions × stakeholders; click cycles R → A → C → I → empty, or type r/a/c/i/Delete, arrows move between cells; per-row check badge (No A / n A's / No R) and a footer "Load (R + A)" with an Overloaded flag per person. Status strip counts row issues and overloaded people.
- **Decision memo**: options grid (customer impact, business impact, effort, risk, who prefers it), recommendation, "if we don't decide", live preview in the skill §2 template; Consulted = everyone marked C.
- Exports: RACI CSV (with a check column), Stakeholders CSV (quadrant + strategy), Decision memo (.md), full Markdown (frame). AI: "Draft the decision memo", "Write a steering update".
- Sample: card-blocking project (issuer ops Ana/Anne, fraud lead Priya, scheme liaison Marc, app team Jade, compliance Omar, customer service Leo/Léo): decision = near-real-time Exception File / liste d'opposition listing; R4 has two A's and R7 no A on purpose, Priya is overloaded (5 rows).

## AI risk register (`ai-risk-register`, governing-ai-risk)
- Command bar: System · Intended use · Data used. Primary "Classify and score ⌘↵". Advanced: what it can do, users, hosting/providers, paste risks CSV (rows are added; the format Claude is asked to return).
- **AI Act tier** wizard, Yes / No / Unsure per question (Unsure rows are highlighted): Art. 5(1)(a)–(h) prohibited → Annex III (5(b) creditworthiness with the **fraud-detection carve-out** stated on screen, 5(c) insurance, 4 employment, 1/5(a)/5(d)) with the Art. 6(3) derogation and the profiling rule → Art. 50(1)–(4) transparency → minimal. "Unsure" never sets a tier; it lists the item under *To confirm (with Legal)*. Result panel: tier badge, why (article refs), to-confirm list, unanswered count, what it means (obligations; dates: prohibitions since 2 Feb 2025, Art. 50 and Annex III from 2 Aug 2026 with the proposed omnibus postponement marked *to confirm*).
- **Risk register**: grid (risk, category, likelihood 1–5, impact 1–5, score badge high ≥ 15 / medium 8–14 / low, owner, control, test, NIST AI RMF Govern/Map/Measure/Manage, status Open/Mitigating/Accepted/Closed), "Add starter risks" (skill §2 list = OWASP LLM Top 10 2025 + banking), 5×5 heat grid with risk IDs per cell, checks (high risk without control = error, without test / without owner / NIST function unused = warning), count per NIST function.
- Exports: Register CSV, Markdown (exposure, screening + all answers + disclaimer, register, checks). AI: "Suggest risks and controls" (CSV back), "Review my classification".
- Samples: EN "AI-assisted chargeback triage" (minimal, Art. 50(1)/(2) *to confirm*; masked test PAN •••• 1018) and "Fraud-scoring assistant" (credit item Unsure + fraud purpose Yes → minimal with the 5(b) carve-out to confirm; storyline risk R-01 stand-in/160 min; R-02 high without control shows the error); FR "Tri des impayés assisté par IA" (•••• 2016) and "Assistant de scoring de fraude".

## Demo script (60 s each)
1. Workshop kit: Load sample 2 → three red checks; Fit to duration → fits 60 min and adds the read-back; only the topic count stays red (remove one topic). Sample 1 → Live → Start → type `A: Confirm stand-in rule @Priya 2026-11-21` + Enter → A-06; switch language: the timer keeps running. Report → Export ▾ Word / Actions CSV.
2. RACI: Load sample → status "2 row issue(s) · 1 overloaded"; RACI tab, on R4 focus Jade's A and type c → row OK; Map tab, drag Omar (Compliance) right → moves to Manage closely. Decision memo tab → Export ▾ Decision memo.
3. AI risk register: Load "Fraud-scoring assistant" → Minimal, to confirm (5(b) fraud carve-out); answer the credit question Yes and the fraud question No → High-risk with the Annex III obligations. Register tab → R-02 has no control (red check), fill it → check clears.

## Open issues
- Markdown, Word and AI prompts follow the UI language (not a per-document language switch).
- No JSON schema in `app/server/tools/schemas/` for `kit.py patch`; AI answers come back as Markdown with CSV blocks pasted via Advanced.
- Workspace autosave is A's 1 s debounce: a note captured less than 1 s before closing the tab can be lost.
- The wizard is a screening aid; legal wording (Art. 6(3), Art. 50(2) assistive-editing exception, omnibus dates) stays *to confirm with Legal*.
