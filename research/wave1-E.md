# Wave 1 · E · BPMN editor + Journey builder

Owner E. Files: `app/web/js/tools/bpmn-editor/*`, `app/web/js/tools/journey-builder/*` (nothing else touched).
Tested on port 4305 (local) and on the static export (`KIT_DEMO`): zero console errors, EN + FR, light + dark.

## What was built

### BPMN editor (`modeling-processes`)
- **Inputs**: command bar = Process name · Actors (lanes, comma-separated, parentheses kept: `Merchant (Atlas Home, demo)`);
  config pane = **Steps** (one per line). Advanced · n set: Start event, End event, Organisation (pool), Your notes (AI source).
- **Steps syntax** (shared `outline.js`): `Actor: step` · `Actor: question?` = decision · indented `Yes → Actor: step`
  branches (repeat the label to chain, nest by indenting) · `Yes →` empty = continue · `(end)`, `(start)`, `(wait)`, `(message)`
  markers (FR `(fin)`, `(début)`, `(attente)`) · `[id] step` + `@id` jumps for retries/loops. Send/receive tasks inferred from the verb.
  Unknown actors become lanes (reported). Several open paths into a task get a merge gateway.
- **Generate diagram** (⌘↵) → `logic.js` = JS port of `skills/modeling-processes/scripts/build_bpmn.py` (layering with
  back-edge detection, lane rows, waypoints, label bounds, one colour per meaning, bioc + OMG colour attributes).
- **bpmn-js 18.31.1 Modeler** via `core/lazy.js loadBpmnModeler()` only (never the viewer). Edits sync (250 ms debounce)
  into `state.xml`, the **step table** (row click selects + scrolls to the element) and the **checks** tab.
  First render keeps a readable 65 % minimum and starts at the left; "Fit to screen" fits everything.
- **Validation hints** (`lint`): no start, **no end event**, **decision exits without condition labels** (default flow and
  `conditionExpression` count), unnamed decision, 1-in/1-out gateway, dead end, orphan, unnamed task/end, element without lane,
  empty lane, > 15 activities, unreachable elements. Plus step-parse problems. Each hint has "Show".
- Import `.bpmn` (any BPMN 2.0 XML, any namespace prefix: regex scanner `modelFromXml`, no DOMParser so it runs in node).
  Regenerating over canvas edits shows an inline "Undo" (no toast, see watermark).
- **Exports**: `.bpmn`, SVG (`saveSVG`), PNG (2×, white background, Blob), step table CSV, Markdown (```bpmn block +
  steps table + checks + source notes; the deliverable renders the diagram).
- **AI**: "Draft from my notes" (expects JSON `{title, actors, trigger, steps, open_questions}` in the steps grammar; when
  `kit.py patch` puts it in `state.ai.draft`, `tick()` picks it up and shows "AI-assisted draft ready · Apply / Dismiss"),
  "Review this process" (Markdown: model as text + automatic checks + the skill's quality checklist).
- **Samples** (all autorun, all lint-clean): EN Visa authorisation with Stand-In Processing (V1 seed 1), Visa chargeback
  13.1 lifecycle (research/09: 120 days, representment 30 days, pre-arbitration, arbitration fee *to confirm*), Block a stolen
  card with the Exception File retry loop (storyline: 160 min listing). FR twins: Autorisation CB avec secours (seed 101),
  Impayé CB (codes/délais *à confirmer*), Opposition d'une carte volée avec relance.
- **Watermark**: verified in every screenshot run. The bpmn.io logo is the top element at its own centre
  (`elementFromPoint`), its bottom (796 px) is above the sticky action bar (851 px) at 1440×900. Nothing of ours is positioned in
  the canvas; toolbar sits above it; canvas height `clamp(400px, 100vh − 460px, 960px)`. The canvas is a light "paper"
  (`color-scheme: light; background: Canvas`) in both themes.

### Journey builder (`designing-conversational-journeys`)
- **Inputs**: Intent · Channel (segmented Chat / Voice / In-app) in the command bar, **Steps** in the config pane.
  Advanced: What "solved" means, Hand-off rule, Test utterances, Journey name.
- **Steps syntax** (same outline parser): `Say:` `Ask: question [A | B]` `Do:` `Check: condition?` `Handoff:` `End:`
  (FR `Dire / Demander / Faire / Vérifier / Transfert / Fin`). Branch labels hold what customers may type (`Lost / lost it /
  can't find`), `*` (other, else, autre, sinon) = fallback. The start node is the customer's intent.
- **Node canvas** (plain HTML + SVG): drag nodes (8 px snap), drag the right-edge port onto a node to connect (default
  label = next unused option, `*`, or Yes/No), bezier edges with labels, fallback edges dashed amber, back-edges routed below.
  Zoom −/+ and Fit (auto-fit on build, min 80 %), Tidy layout, add Message/Question/Action/Condition/Hand-off/End.
  Keyboard: Tab to a node, arrows move (Shift = 32 px), Enter edits, Delete removes. Nodes with issues show a flag icon.
- **Inspector**: type, text, quick replies, branches (reply label + target select + remove, "Add a connection"),
  **Test from here**, Delete.
- **Test chat**: walks the flow from the start or any node. Messages/actions/conditions/hand-offs/ends as lines; quick-reply
  buttons; free text matched to branch alternatives (exact > whole word > substring > shared word ≥ 4 letters); fallback
  taken is shown with a miss counter; **unhandled input** (no match, no fallback) is shown in red and the chat stays put;
  "Test unhandled input" sends gibberish. Condition nodes offer "System result" buttons. Voice shows bot/user icons and
  "Caller says". The walked edge is highlighted.
- **Checks**: no fallback on a question (unhandled input), no hand-off node, no AI disclosure in the first message, question
  asks for card number / PIN / password / OTP / CVV (EN + FR patterns), fallback loops back with no way out, quick reply
  without a branch, too many options (> 4, voice > 3), unlabelled branches, one-way condition, dead end, unreachable, long
  voice turns, no "advisor/human" reply.
- **Exports**: JSON (`analyst-kit/journey` v1, re-importable via "Import JSON"), Mermaid `.mmd`, Markdown (journey card, flow
  table, checks, Mermaid diagram, utterances, Gherkin conversational acceptance criteria generated per branch, metrics).
- **AI**: "Draft the journey" (JSON with steps + utterances, same Apply flow), "Write test utterances", "Review this journey".
- **Samples**: EN "I lost my card" chat (Harbor Bank: AI disclosure, signed-in check, lost/stolen block that lists the card on
  the Exception File and suspends tokens, fraud → advisor, two-level clarification, replacement card), EN voice line
  (3 options max), FR « J'ai perdu ma carte » (Banque Lumière, opposition). Card only ever "ending 0004". All check-clean.

## Public API (for other builders)
- `bpmn-editor/outline.js`: `tokenize`, `parseOutline(text, isDecision)`, `walkOutline(items, hooks, start)`,
  `layer(ids, edges, starts)`, `norm(s)`. Reusable for any "indented steps → graph" input.
- `bpmn-editor/logic.js`: `stepsToSpec(input, words)`, `buildXml(spec)` (same spec as `build_bpmn.py`: `{pool, lanes, nodes,
  flows}`), `modelFromXml(xml)`, `lint(model)`, `stepRows(model)`, `modelText(model)`. **K (payment-lifecycle) can export a
  BPMN by building a spec and calling `buildXml`**, or deep-link to the editor with `?sample=en:1` (chargeback lifecycle).
- `journey-builder/logic.js`: `stepsToGraph`, `checkGraph`, `walk`, `matchReply`, `toMermaid`, `toJson`, `fromJson`.
- Tests: `node app/web/js/tools/bpmn-editor/logic.test.mjs` and `.../journey-builder/logic.test.mjs` (all samples clean,
  lint codes, matcher, sensitive-ask, unhandled input).

## Demo script (60 s each)
1. BPMN: Load sample ▾ "Visa authorisation with Stand-In Processing" → diagram renders (11 elements · 4 lanes · No issues) →
   drag the "Approved?" gateway, delete the "Declined" end event → Checks tab: "No end event… / has no outgoing flow" → Show →
   Export ▾ .bpmn / PNG. Switch to "Block a stolen card" to show the retry loop.
2. Journey: Load "I lost my card" → test chat: Yes (signed in) → type "my wallet was stolen on the metro" → block → "Yes"
   replacement → "No" → end. Restart, type "zxqv" → fallback clarification. Delete the `*` branch in the inspector →
   Checks: "Unhandled input…"; the chat now shows the red unhandled line. Export ▾ Markdown (Gherkin included).

## Screenshots
`screenshots/v2/E-bpmn-editor-{en,fr}-{light,dark}.png`, `E-journey-builder-{en,fr}-{light,dark}.png`, `E-journey-builder-en-voice.png`.

## Open issues
- No JSON Schema in `app/server/tools/schemas/` for the AI patches (`draft`) of either tool: not in my file scope. Suggested
  shape is in the prompts (`{title, actors, trigger, steps, open_questions}` / `{intent, steps, utterances, solved}`).
- The frame toast (bottom right, e.g. "Sample loaded") is transient and sits over the action bar, not the canvas, at
  1440×900. On very short windows (< 700 px) it could pass over the watermark for 4 s: A may want toasts bottom-left on
  `.tool-bpmn-editor`.
- `logic.test.mjs` files are copied into the static export (small, harmless); `export_static.py` could skip `*.test.mjs`.
- One-level ambiguity: a branch line at the same indent as a sibling with a *different* label always starts a new branch of
  the same decision; nested decisions need deeper indentation (documented in the Syntax disclosure).
- BPMN PNG/SVG export needs the diagram rendered (message "Generate the diagram first."); `.bpmn` and CSV work from state.
- Gherkin keywords stay English (Given/When/Then) in FR Markdown; steps are French.
- Disk rule: I deleted `edge-E` and my export dir. 36 unnamed `edge*` profile dirs from my first runs (before the rule)
  remain in the system temp dir (`/var/folders/…/T/`). I did not bulk-delete them because the glob could catch other
  builders' profiles. Delete them by hand if they are all stale.
