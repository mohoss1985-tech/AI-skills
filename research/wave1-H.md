# Wave 1 · H · PRD builder, Story builder, SFD builder
(Saved by Claude from H's hand-back; H could not write it because the disk was full.)

Owner H. Files: `app/web/js/tools/{prd,story,sfd}-builder/*` only. Port 4308. Built on A's split tool frame and ui/*.
All three work without AI or network, locally and in the static demo. Samples use the shared storyline (stolen card
approved in stand-in because its Exception File listing took 160 min, 18 Oct, crd_hb_009), matching V1 seeds
3/103, 5/105, 17/117. EN = Visa / Harbor Bank, FR = CB / Banque Lumière.

## Files per tool
logic.js (pure, Node-testable) · samples.js · i18n.js (EN/FR same keys) · index.js · tool.css (scoped, tokens only).
PRD builder also has ai.js and shared.js. shared.js is used by all three: makeT ({var} filling; UI vs document
language), wordDoc (HTML .doc via A's core/exports clientHtml), debounce, fileBase, checkItem, sectionHead.

## PRD builder
- Inputs: Problem · Users · Goal metric (baseline → target) · Scope. "Build draft" (⌘↵) fills only empty sections,
  ids G1/M1/FR-1 (FR: O1/I1/EX-1).
- Section tabs (editable grids): problem (evidence, TL;DR), users & jobs, goals & non-goals, metrics, requirements,
  out of scope, risks (RAID), open questions.
- Trace meter: per goal (has requirement, has metric), orphan requirements/metrics; %, verdict, status pill.
- Other checks: evidence, guardrail metric, baseline, target, vague words, non-goals, owned questions, share of Must.
- Results: Checks (click to jump) · Trace matrix · offline Critique · Preview.
- Exports: Markdown, Word, Jira epic CSV. AI: "Draft from my notes" (JSON → `kit.py patch --action draft` →
  state.ai.draft, Apply banner), "Critique this PRD" (Markdown).
- Sample gaps on purpose: G3 has no metric, FR-6 has no goal (78 %).

## Story builder
- Inputs: Feature · Persona · Rules. "Map examples" adds rules to the active story; imported lines skipped.
- Board: story tabs → story card → rule columns → example cards (happy/fail/edge, G/W/T, inline lint) → question
  cards (unanswered question blocks Ready). Rules can move between stories. Offline "Split by rule" (SPIDR) and
  "Add example stubs".
- INVEST with plain reasons (I dependsOn · N UI/impl words · V no "so that" · E open questions · S > 8 pts / 4 rules /
  10 examples · T missing examples, lint failures, no failing case). Scenario lint: one When, concrete values, no impl
  in Then, no vague words.
- Gherkin: one Feature, Rule per rule, Scenario per example, tags @S1 @kind; FR `# language: fr`
  (Fonctionnalité/Règle/Scénario/Soit/Quand/Alors/Et).
- Exports: Jira CSV (BOM, repeated Labels, AC in Description, Parent = epic), .feature, Markdown.
  AI: "Split this story", "Generate examples" (JSON → state.ai.split / state.ai.examples; Apply merges by story id).
- Sample: 3 stories, 11 scenarios, 2/3 ready (S3 has an open Legal question).

## SFD builder
- Inputs: Feature · Rules · Fields. Rules RG-01… (existing RG-xx kept); fields parse from
  `Name: type, mandatory, format, RG-xx` or pipe format; `E-01: Screen` starts a screen; reruns never duplicate rows.
- Advanced: level SFD/SFG, language, version, status, author, reviewers, context, scope.
- Tabs: Business rules · Fields · Screens & flow (screens, process, error path, MSG-xx, stories, NFR, open points).
- Checks: missing example, vague words, unknown story/message/rule refs, untraced rule, story without rule, field
  without type/format, unknown screen, unused message, duplicate ids.
- Results: stat tiles · Checks · Traceability (rule × story, fields per rule, test idea per rule) · Preview.
- Exports: Markdown, Word, rules CSV. AI: "Write the SFD prose", "Review this spec".
- Sample: 9 rules, 3 screens, 8 fields, 3 messages, S1–S3; RG-06/RG-07 untraced on purpose.

## Public API (pure)
prd: buildDraft, meter, traceMatrix, check, critique, toMarkdown · story: buildMap, invest, readiness, summary,
toFeature(state, storyId?), toJiraCsv, splitByRule, stubExamples, lintExample · sfd: buildTables, parseField, review,
traceMatrix, testIdeas, rulesCsv.

## Demo (60 s each)
- PRD: load sample → click "G3 has no metric" → add metric → set FR-6 goal to G1 → 100 % → Export Word.
- Stories: load sample → answer S3's open question → 3/3 ready → Gherkin tab → Jira CSV → switch to CB FR.
- SFD: load sample → Traceability → add S4 linking RG-06/RG-07 → "Ready to build" → rules CSV.

## Verification / open issues
- Node runs of each logic.js; headless Edge on 4308 with zero console errors; screenshots H-*-{en,fr}-{light,dark}.png.
- Static demo re-check after the SFD rerun-duplication fix was cut off by the full disk → re-run.
- No JSON schema in app/server/tools/schemas/ (B's folder) → AI patches not validated.
- Word is HTML-as-.doc. Screenshots predate 3 copy fixes (SFD plurals, FR " : " spacing, FR page titles).
- Visa fraud types/deadlines and CB typology/format stay *to confirm*.
