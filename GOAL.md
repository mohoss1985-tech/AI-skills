# Analyst Kit V2 · from document generators to working tools — goal

**Product:** Analyst Kit (repo `mohoss1985-tech/AI-skills`, live demo https://mohoss1985-tech.github.io/AI-skills/).
18 AI skills (`skills/*/SKILL.md`) for Business Analyst / Product Owner work in card payments (authorisation,
PAN declaration, chargebacks; Visa samples in English, CB samples in French) + a local app (`app/`: Python stdlib
server `server.py` on :4317, vanilla JS `static/`, SQLite `data/kit.db`, Claude Code answers requests through `kit.py`)
+ a read-only static demo exported by `export_static.py` and published by `.github/workflows/pages.yml`.

V1 (this repo as of 2026-11-02) stays untouched and published. **V2 is a separate version** so the move from the
old design/functions to the new one stays visible (exact placement decided in DESIGN_SPEC).

## Owner's ask (2026-11-08)
"Ameliorate all of the Analyst Kit. Super clear. For the API test tool, I just want an actual tool that works: put in
the UI the endpoint and 2, 3, 4 parameters, someone puts the data in and tests. It fires just like Postman and actually
works, without the complications of Postman. What are the 3–4 variables someone must input to test an API?
Same for the PRD and all the others: enhanced UX/UI, enhanced functionality, enhanced design. Demos you can show
people (e.g. how to test an API). Take all the time, put all your agents to work."

## Principles for V2
1. **Every skill becomes a tool that does the job**, not only a prompt that writes a document. The API tester sends
   real HTTP requests; SQL runs on a sample database; BPMN renders and edits; WSJF computes; UAT tracks; etc.
   The AI writes/assists where it adds value; the tool works without the AI for the basic job.
2. **Minimum inputs.** Each tool asks for the 3–4 things that matter first; everything else is optional/advanced.
3. **Demo-able.** Each tool ships with a guided sample (Visa EN / CB FR) that a non-expert can run in 60 s, also in
   the public web demo.
4. **Does not look vibe-coded.** Crafted UI, consistent design system, clear copy, EN + FR.
5. **Keep every V1 feature** (deliverables, conversation, versions, profile, exports, sources, FR/EN, Claude online).

## Done means
- V2 app runs locally with zero errors; every one of the 18 skills has a V2 tool screen (or a documented reason why
  a document flow stays best), each with a sample that runs.
- API tester: real requests (method, URL, auth, params/body), response view, assertions, save as test case, export
  (curl / Postman collection / pytest), works on a public demo API from the static demo.
- Web demo for V2 published next to V1; README explains V1 → V2.
- Screenshots of every tool (light + dark if themed) and a short V1 → V2 changelog.
