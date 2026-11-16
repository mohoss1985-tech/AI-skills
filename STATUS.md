# Analyst Kit V3 · build status (started 2026-11-16)

Resume by telling Claude: **"Continue the Analyst Kit V3 build from STATUS.md in
~/Documents/Claude Built Apps/AnalystKit_V3_2026-11-16_0022."**

- Folder = git clone of the published AI-skills repo at V2 (`e0e6339`). Published repo untouched.
- Owner goal: "a lot of tools are good, a lot are not; examples unclear, functions don't work right" →
  every tool really works + is impressive. Builders run on the **Fable** model (owner request).
- Method: command-library product-refinement-swarm playbook.

## Phase
1. Audit + best-in-class research: ONE Fable agent at a time (owner: slow burn). Queue: audit-1 (api-tester, sql-runner, tokenization, payment-lifecycle, kb-audit) **RUNNING** + audit-2 (prd, story, sfd, uat, xray) **RUNNING** → audit-3 (bpmn, journey, mapping, impact, rag) → audit-4 (wsjf, use-case, workshop, raci, ai-risk). Prompts = same as audit-1 with tool list + ports 93N1–93N9. Brief: `research/v3/00-audit-brief.md` (incl. talking points + quota rules).
   NEW V3 feature (owner): every tool shows a Talking points panel — Replaces <product> · what it does · 2–3 how-it-works bullets.
2. Checkpoint 1: owner reviews scores + V3 plan per tool.
3. DESIGN_SPEC V3 delta → Checkpoint 2 → builders (≤7 at once, Fable) → integrate → ship as v3.0.0 (V2 kept at /v2/?).

## Pace + deadline (owner, 2026-11-16)
- **2 Fable agents at once, never more.** Frugal prompts. Deadline: V3 shipped by **2026-11-17**.
- Plan: audit-1 + audit-2 running → audit-3 + audit-4 → Checkpoint 1 (owner) → short DESIGN_SPEC V3 delta
  (incl. shared Talking points panel) → builders in pairs, worst tools first → integrate, test, ship.

## Owner decisions (2026-11-16, before sleeping)
- **V3 is named "Skills Portal"** (instead of "AI skills" / "Analyst Kit"). Rename in-app title, README, Pages title.
  Renaming the GitHub repo/URL is outward-facing → ask owner first (old links would redirect).
- Overnight: Claude keeps going on its own (2 agents max): finish audits 1–4 → draft DESIGN_SPEC V3 delta →
  start builders on clear bugs + Talking points panel + rename. **Nothing is pushed/published until the owner says so.**

## 2026-11-16 05:11 — quota event
- 4 Fable agents (≈5 min) + 2 Fable agents (≈7 min) used the WHOLE 5-hour quota by 00:31; reset 05:10.
  → Fable is very expensive. Now: **1 Fable agent at a time**, report saved per tool. Agent 2 paused until agent 1 is done.
- Agent 1 resumed 05:11 (api-tester, sql-runner, tokenization captured; payment-lifecycle, kb-audit to do).
- Agent 2 had screenshots for prd/story/sfd but no report → resume it after agent 1 (SendMessage, same instructions).
- 05:16 audit-1 DONE (api-tester W; sql-runner, tokenization, payment-lifecycle, kb-audit Wk; none broken). Agent 2 resumed.
- 05:23 audit-2 DONE (prd Wk, story Wk, sfd W, uat W, xray Wk; worst: cross-tool traceability cosmetic, Jira CSV epic link broken). Agent 3 resumed.
- 05:31 audit-3 DONE (bpmn Wk, journey Wk, mapping W, impact Wk, rag Wk; worst: rag-eval scoring is word matching under Ragas names). Agent 4 resumed.
- 05:33 quota hit AGAIN (window 05:10→10:10 lasted ~23 min with 1 Fable agent at a time). 10:11 agent 4 resumed (wsjf done; 4 tools left).
- 10:14 audit-4 DONE. Scorecard: research/v3/SCORECARD.md (2 B, 13 Wk, 5 W). Waiting for owner Checkpoint 1 + Mix/Fable choice.

## Checkpoint 1 APPROVED by owner (2026-11-16 ~10:30, "APPROVE" → Mix plan)
Spec: research/v3/SPEC-V3.md · builder rules: research/v3/builder-common.md · reports: research/v3/build-<L>.md
Waves (2 agents max):
- W1: A (Sonnet) shell: rename, Talking points panel, guided demo, ⌘↵ · R1 (Fable) ai-risk-register
- W2: B (Sonnet) use-case-scorer, wsjf, workshop-kit, impact-heatmap, kb-audit · R2 (Fable) rag-eval
- W3: C (Sonnet) prd, story, xray, sfd, uat · R3 (Fable) tokenization
- W4: D (Sonnet) api-tester, sql-runner, payment-lifecycle, bpmn, journey, mapping, raci
- Then: lead integrates, tests, screenshots, owner says "push".
- 10:45 A DONE (rename, talking points EN+FR, guided demo, ⌘↵). Launching B (Sonnet).
- 10:50 quota hit (window 10:10→15:10 ≈ 40 min: A done, R1 + B partly done). 15:11 R1 + B resumed.
- 15:12 R1 DONE (ai-risk-register: decision tree, OJ-sourced dates incl. Reg 2026/1744, 22/22 tests). R2 (Fable, rag-eval) launched; B still running.
- 15:14 B DONE (use-case-scorer, wsjf, impact, workshop, kb-audit; tests pass; WSJF: blank/0 points = not estimated — owner to confirm). C (Sonnet) launched; R2 running.
- 15:22 C DONE (story, prd, xray, uat, sfd; Jira CSV epic IDs, SFD→UAT/Xray import, honest UAT coverage). D (Sonnet, last 7 tools + tool-frame restore-lang/New) launched; R2 running; R3 tokenization after R2. Note: skills/running-uat/scripts/uat_report.py still counts covered on any pass (tool differs on purpose).
- 15:25 R2 DONE (rag-eval claim-level scoring, 19/19 tests, LLM-judge prompt export; sample DSP-06 now 'four months'). R3 (Fable, tokenization) launched; D running.
- ~15:40 quota hit (reset 20:10 announced). 15:44 owner 'continue' → D (5/7 done) and R3 (no report yet) resumed.
- 15:44 D DONE (8 tasks; frame restore-lang unverified; sql default sample = 1 row → no chart).
- 15:44 Integration check: node --test over 19 tool suites → 74 tests pass, 0 fail (145 PASS asserts). Waiting on R3.
- 15:53 R3 DONE (tokenization guided steps + lifecycle, 10/10 tests). ALL BUILDERS DONE → lead integration.
- 15:57 Integration: static export OK; Edge smoke 20 tools × EN/FR → 0 console errors, no NaN/null/undefined text; screenshots checked (tokenization, rag-eval, sql-runner). Local commit done. NEXT: owner 'push' → tag v2.0.0 already exists; sync into AI-skills clone, tag v3.0.0, keep V2 at /v2/?, push.
- 15:57 Integration: static export OK; Edge smoke 20 tools × EN/FR → 0 console errors, no NaN/null/undefined text; screenshots checked. Local commit done (identity: Claude, as in AI-skills). NEXT on owner "push": sync into AI-skills clone, tag v3.0.0, push → Pages.
- 16:02 SHIPPED: pushed main 523af8c (merged owner's Nov 9 README edit), tag v3.0.0, Pages run 43891909002 success. Live check: / (V3), /v2/, /v1/ load with 0 errors.
- 16:12 CLEANUP shipped (a457652): catalog 20 skills, Skills Portal name in exports/server/skills, CHANGELOG 3.0.0, FR README, V2 badge; repo description updated (+topic payments); GitHub Release v3.0.1 = Latest (force-moving v3.0.0 was blocked, so new tag). Live: 20 skills, 0 'Analyst Kit' in tool strings.
- 16:25 MANUAL shipped (cfa6058): MANUAL.md (install + per-tool sections with anchors), READMEs 'Use it for real', link in every Talking points card + footer. Live verified.
