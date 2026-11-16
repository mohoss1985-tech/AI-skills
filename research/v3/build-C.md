## prd-builder
- Fixed: list-marker strip keeps leading digits ("3DS", "24/7"; only `1.` / `2)` / `-` / `*` stripped); metric parser splits at the colon/"=" first, "from"/"de"/"du" only when a number follows (last such split), French "à" arrow now works (`\b` fails on "à"); with several goals Build draft no longer traces every requirement to G1 (blank = honest orphan the meter shows; single goal still G1); Jira CSV now has `Work item ID` / `Work type` / `Parent` = epic id.
- Guided (rule 8): results (meter, checks) hidden until Run, first paint deferred a macrotask; no autorun flags existed.
- Tests: new `logic.test.mjs` (3 tests, pass).
- Won't fix (this pass): goal = metric name (bug 4), trace tree opening view, New button / language-of-restored-workspace (shell-owned), send-to-Story.
## xray-builder
- Fixed: new `testsCsvAll` = one CSV for ALL types (Cucumber rows carry Test Type Cucumber + `Gherkin Definition`, Generic rows `Unstructured Definition`; manual-only specs stay byte-identical to build_xray.py so parity holds; `testsCsv` kept as the manual-only parity function). Preview, Markdown and the CSV export use it; old "not CSV" notes reworded EN/FR; import guide lists the new columns and warns "CSV or .feature, not both" for Cucumber. Export gate: csv / bulk JSON / results JSON throw while validation errors exist; the message lists the first 3 errors (the Validation panel shows all). Pasted ids `CARD-T01` (was `CARD-T-01`); a pasted numbered list gets one starter step (was step-less and failing validation).
- Guided (rule 8): validation + previews hidden until Run (tests table stays visible); first reveal deferred a macrotask; `autorun` removed from sampleList.
- Tests: logic.test.mjs +10 checks (parity untouched, all pass).
- Won't fix: Precondition as real issues, import preview panel, coverage strip, Story-builder import, bulk-JSON "unverified" label (JSON still flagged *to confirm* in the validation panel), "download anyway" link, UAT-imported test steps.
## uat-tracker
- Fixed: requirement coverage now counts only passed tests: covered = all its tests passed; at risk = one failed or blocked; not covered = nothing failed but not all passed. `requirements.{covered,atRisk,notCovered,list}` added; the "Every requirement covered" exit criterion uses it (sample: 0 covered, 4 at risk, 1 not covered, 0/5 criteria met, was a false "5/5"). New "Requirement coverage" block under the gauge (badges + per-requirement line with pass / fail / blocked / not run). Legacy any-pass `coveredPassed` kept ONLY for uat_report.py parity (the parity test now skips the reqCovered criterion: deliberate deviation from the skill script, which still uses "any pass"). Sample comment "2 of 5" corrected.
- Guided (rule 8): gauge, progress, defects dashboard and status hidden until Run (run grid etc. stay); first reveal deferred a macrotask; `autorun` removed.
- Tests: logic.test.mjs +6 checks, all pass.
- Won't fix (this pass): what-if mode, run grid first, sign-off Word report, unknown-status note (ABORTED), Blocked vocabulary mismatch with the Xray builder.
## sfd-builder (+ the SFD -> UAT / Xray path)
- The code comment was true only on paper (UAT: `noStatus`; Xray: no path). Made it real: `sfdRulesFromCsv` (uat-tracker/csv.js) reads the SFD "Rules CSV" header (ID, Rule, Example, Source, Message, Stories). UAT tracker: `casesFromSfdCsv` (one not-run case per rule, requirement = rule id, expected = example; recognised by the plain runs paste too) + new paste block "Import from SFD rules CSV" (adds cases, ids continue UAT-nn). Xray builder: `testsFromSfdCsv` + menu "Add from > SFD rules CSV..." (one manual test per rule: step = example, expected = rule, label = rule id, requirement = story only when it is a Jira key; the plain paste dialog also recognises the CSV). SFD comment on `rulesCsv` rewritten to state exactly this.
- Fixed: `1.` list numbers no longer left in rule text (a number inside the text is kept); `€` now detects an amount field.
- Guided (rule 8): results hidden until Run (frame invitation kept), first paint deferred a macrotask.
- Tests: new sfd-builder/logic.test.mjs (4 tests: round trip into UAT and Xray, parser) pass.
- Won't fix: duplicate rule id warning, "fix" button for missing rule refs, test idea column redesign, story import, trace matrix view.

## Smoke (rule 5)
Headless Edge on 9451/9452, `?sample=en` for all 5 tools: before Run only inputs + the frame's "Inputs loaded. Press ... to see the result." invitation; after Run results appear (PRD meter 78 %, SFD review, UAT NO-GO 0/5, story/xray results); no console errors. Shots: research/v3/shots/v3-{story-builder,prd-builder,xray-builder,uat-tracker,sfd-builder}.png. Server and Edge killed.

## Needs from others
- shell/tool-frame.js: restore last workspace only in its own language / visible "New" button (audit-2 PRD bug 6).
- uat-tracker -> Xray status vocabulary (Blocked vs TODO) not touched.
- skills/running-uat/scripts/uat_report.py still counts a requirement covered on ANY pass (the tool now deliberately differs; parity test skips that criterion).
