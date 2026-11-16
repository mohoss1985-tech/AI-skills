# Skills Portal V3 · rules for every builder agent (read fully, follow exactly)
Folder: /Users/fr152071/Documents/Claude Built Apps/AnalystKit_V3_2026-11-16_0022
1. Read `research/v3/SPEC-V3.md`, then ONLY your tools' sections in `research/v3/audit-*.md` (grep for `## ` headings
   to find them; don't read other tools' sections). DESIGN_SPEC.md §8 (tool interface) + the header comment of
   `app/web/js/shell/tool-frame.js` define the API. Read code with grep/sed ranges, not whole big files.
2. Edit ONLY the files you own (listed in your prompt). Another agent edits other files at the same time.
   If you need something outside your files, write it under "Needs from others" in your report.
3. Quota is very tight (owner rule). Be economical: no web research unless your prompt asks for it; don't load
   screenshots into context; don't re-read files you already read.
4. Tests: `cd app/web/js && node --test tools/<id>/logic.test.mjs`. Add a regression test for each logic bug you fix.
5. Smoke check in a real browser at the end only: `cd app/web && python3 -m http.server <your port>` + headless Edge
   (`/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge --headless=new --remote-debugging-port=<port+1>`)
   via Node 22 DevTools protocol: load `#/tool/<id>?sample=en`, press the primary button, check no console errors,
   save ONE screenshot per tool to `research/v3/shots/v3-<id>.png`. Commands binding ports/launching Edge need the
   sandbox disabled. Kill your server + Edge when done.
6. No git commands (the lead commits). No npm installs. Never remove an existing feature. No real card data.
7. Save progress: after each tool, append to your report `research/v3/build-<LETTER>.md` (what changed, bugs fixed /
   won't-fix + reason, tests, open issues), so nothing is lost if quota runs out. Reply to the lead in ≤ 5 lines.
8. Shell contract from A (research/v3/build-A.md): `ctx.guided` is true until the presenter's first run. Every tool:
   (a) shows ONLY inputs while `ctx.guided` (no ranking/results computed in mount/update), (b) shows a one-line
   invitation in the empty result pane ("Press Run ⌘↵ to …"), (c) never calls `frame.runNow()` from mount,
   (d) delete the now-useless `autorun` flags from samples. Talking points live in `tools/talking-points.js` (owner A — don't edit).
9. A plain `python3 -m http.server` of app/web has no mock backend (API tester shows "No answer"); for demo-mode checks
   run `python3 app/server/export_static.py` into a temp dir under the scratchpad, or ignore network-dependent results.
