# Skills Portal (V3) · spec delta over DESIGN_SPEC.md (approved by owner 2026-11-16, "APPROVE")
DESIGN_SPEC.md still rules everything not changed here. Scorecard: research/v3/SCORECARD.md. Per-tool bugs, causes
(file:line), V3 plans and Talking points: research/v3/audit-1..4.md.

## 1 · Name
Product name is **Skills Portal** (was "Analyst Kit" / "AI skills"). Tagline: "20 working tools for business analysts in
payments". Change visible strings, <title>, README headings. Do NOT rename the GitHub repo, URLs, ids, storage keys
or file paths (saved workspaces must keep working).

## 2 · Talking points panel (new, every tool) — owner A
- Data: `app/web/js/tools/talking-points.js` → `export const TALKING_POINTS = { '<tool-id>': { replaces: {en,fr},
  what: {en,fr}, how: [{en,fr}, …2–3] } }`. EN text = the "Talking points" block of each tool in audit-1..4.md
  (keep it short; ≤ 12 words per bullet). FR: translate (plain, professional French).
- UI: in the tool page head, under the purpose line: a compact card "Replaces **Postman**" chip + "What it does" line +
  numbered "How it works" steps. Collapsible (chevron), open by default, state remembered (localStorage, try/catch).
  Also shown on each Home tool card as "Replaces X". Print/presentation friendly: readable at 1440 px from 2 m.

## 3 · Guided demo (new, every tool) — owner A (frame) + each tool owner (samples)
- Loading a sample (menu, Home demo card, `?sample=`) fills the INPUTS ONLY. The frame ignores `autorun` and does not
  recompute live until the presenter presses the primary button once. Then the primary button gets a subtle pulse
  + hint "Press Run ⌘↵" (respects prefers-reduced-motion). After the first run, live recompute (if the tool has it) resumes.
- ⌘↵ / Ctrl+↵ triggers the primary button in EVERY tool, including while focus is in a textarea/input.
- Tool owners: make sure the empty "result" pane before the first run shows a clear one-line invitation, not a blank.

## 4 · Correctness bar
Every bug listed in the tool's audit section is fixed or explicitly marked "won't fix" with a reason in the builder report.
Each fixed logic bug gets a regression test in `tools/<id>/logic.test.mjs` (`node --test`). No new console errors.

## 5 · Later wave (only if time/quota allows; owner decides): shared traceability IDs across PRD → SFD → Story → Xray → UAT.

## 6 · Model mix (owner approved "Mix")
Fable: ai-risk-register, rag-eval, tokenization rebuilds. Sonnet: shell + all other fixes. Max 2 agents at once.
