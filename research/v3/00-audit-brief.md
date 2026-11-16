# Analyst Kit V3 · Audit brief (shared by all audit agents)

## Context
Analyst Kit is a set of 20 browser tools for business analysts in payments/banking (repo: this folder,
live demo: https://mohoss1985-tech.github.io/AI-skills/ , tool URL pattern `#/tool/<id>` and
`#/tool/<id>?sample=en`). V2 shipped 2026-11-09. Each tool: `app/web/js/tools/<id>/` (index.js = UI,
logic.js, samples.js, i18n.js, tool.css). The skill each tool comes from: `skills/<skill>/SKILL.md`.
Shell/design system: `app/web/js/{shell,ui,core}`, rules in `DESIGN_SPEC.md`.

## Owner's verdict on V2 (verbatim intent)
"A lot of them are good and a lot of them are not. The examples are not clear and the functions don't work
right." Goal for V3: every tool **actually works** and is **really impressive** to a senior analyst / hiring manager.

## Your job (per tool you are assigned)
1. **Use it for real** in a real browser — headless Microsoft Edge
   (`/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge --headless=new --remote-debugging-port=<YOUR PORT>`),
   driven over the DevTools protocol with Node 22 (built-in `WebSocket`, no npm installs needed).
   Test the LIVE site first; you may also serve the static app locally
   (`cd app/web && python3 -m http.server <YOUR PORT+1>`). Click every button, load every sample, try the
   main workflow end to end with your OWN realistic input (not just the sample), try exports, EN and FR,
   capture console errors. Take screenshots into `research/v3/shots/<tool-id>-*.png`.
2. **Read the code** (index.js, logic.js, samples.js) to find the cause of each bug (file:line).
3. **Judge the example**: would a senior BA instantly understand what this tool is for, what to type, and why
   the output is valuable? Is the sample realistic (payments/cards domain), complete, and does it show off the tool?
4. **Research best-in-class** (WebSearch/WebFetch, cite URLs): the 1–2 real products a pro uses for this job
   (e.g. Postman, bpmn.io, Jira/Xray, Miro, dbt, Ragas…). What makes them feel powerful? What is the 20% of
   their features that gives 80% of the "wow"? What would make OUR tool impressive in a browser-only demo?

## Output — `research/v3/audit-<N>.md` (max ~2500 words), one section per tool:
- **Score**: Works (W) / Works but weak (Wk) / Broken (B) + one-line verdict
- **Bugs**: numbered, each with repro steps → observed → expected → cause (file:line)
- **Example problems**: what is unclear or unconvincing, and a concrete better sample scenario
- **Best-in-class**: sources + the specific features worth copying
- **V3 plan**: 3–7 numbered, specific, implementable changes, ordered by impact; mark size S/M/L

End with a table of all your tools (id · score · top bug · top V3 change).

## Rules
- READ-ONLY on the app: do NOT edit any file outside `research/v3/`. No git commands. No npm installs.
- Use only your assigned debugging port range so agents don't clash. Kill your Edge + servers when done.
- Bash commands that launch Edge, bind ports or write to this folder may need the sandbox disabled.
- Reply to the lead in ≤ 6 lines (scores + the single worst problem).

## ADDED 2026-11-16 (owner request) — Talking points, one per tool
Each tool section must ALSO include a **Talking points** block, which V3 will show inside the tool so the owner can
present the demo by reading it:
- **Replaces:** the real product(s) it stands in for (e.g. "Postman", "Camunda Modeler / bpmn.io", "Jira + Xray").
- **What it does:** one sentence, plain words.
- **How it works:** 2–3 very short bullets (≤ 12 words each), in demo order ("Pick a request → Send → click a value to add a check").
Write them EN only; FR comes later.

## ADDED — Quota budget (owner request: slow burn)
Agents run ONE AT A TIME. Be frugal: max ~3 web searches + 2 page reads per tool, screenshots only where a bug is
visible, no repeated full-page dumps into your context (grep/head the code instead of reading whole files).
