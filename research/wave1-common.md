# Wave 1 · common rules for tool builders C–K

Folder: `/Users/fr152071/Documents/Claude Built Apps/AnalystKit_V2_2026-11-08_1431`.
Read in order: `GOAL.md`, `DESIGN_SPEC.md` (wins over everything; §4 table row(s) for your tools, §5 copy, §8 contract),
`research/09-wave0.md` (file map, tool interface, ctx), `research/03-skill-tools.md` (your skills' rows + decisions),
`research/04-ui-craft-moodboard.md` §5 screen template + §9 checklist, `research/06-payments-demo.md` (+ `demo-api/`),
and the `skills/<skill>/SKILL.md` of each tool you own (the method the tool must embody; its scripts/ may be ported to JS).

Order of work:
1. Start with pure logic (`logic.js`), samples (`samples.js`, EN = Visa / Harbor Bank, FR = CB / Banque Lumière, using the
   shared storyline: stolen card approved in stand-in because its Exception File listing took 160 min), `i18n.js` (EN+FR),
   exports, AI actions (prompt builders), and any server file you own.
2. Builder A publishes `research/wave1-A-api.md` (components + tool-frame) and B publishes `research/wave1-B-api.md`
   (server plug-in routes, workspaces). Check for them; when present, build your UI with A's components and the
   tool-frame template. Until then do not invent your own design system.
3. Each tool: works with no AI and no network (also in the static demo where `window.KIT_DEMO` is true), 3–4 required
   inputs in the command bar, "Advanced · n set" for the rest, sample switch loads a runnable sample, ⌘↵ runs,
   Save as deliverable via `toMarkdown`, Export ▾, Ask Claude (aiActions; "Copy prompt for Claude" in demo).
   Write a `samples.json` too (same content as samples.js) if B's export asks for it.
4. Apply research/04 §9 checklist (both themes, EN + FR). No emoji, no gradients, nothing from 01's banned list.
   No real card data (test PANs only). Scheme facts not in public sources stay *to confirm*.

Rules: edit ONLY your files (your `app/web/js/tools/<id>/` folders, plus server files named in your prompt). Do NOT
git commit. Run the app with `PORT=<your port> python3 app/server/server.py` (if the sandbox blocks the port, re-run with
the sandbox disabled). Screenshot each tool (1440×900, light + dark, EN + FR sample) with headless Edge:
`"/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" --headless=new --user-data-dir=<tmp> --window-size=1440,900 --virtual-time-budget=5000 --screenshot=<file> "<url>#/tool/<id>"`
into `screenshots/v2/<LETTER>-<id>-*.png`. Also open the static export once (`python3 app/server/export_static.py <tmp>`)
and check your tool works there.
When done write `research/wave1-<LETTER>.md` (what you built, public API, demo script, open issues) and reply with a
5-line summary.

## Disk rule (added 2026-11-09 after the disk filled up)
Reuse ONE Edge profile folder per builder (`$TMPDIR/edge-<LETTER>`) and delete it, plus any temp export dirs, when you
finish. Stop any server you started. Never write large files outside the project.
