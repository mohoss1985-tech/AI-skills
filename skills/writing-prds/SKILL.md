---
name: writing-prds
description: Writes and reviews Product Requirements Documents (PRDs), one-pagers and feature specs from a brief, notes, research or an idea. Leads with the problem and evidence, sets goals, non-goals and measurable success metrics, and gives every requirement an ID tied to a goal. Use when someone asks for a PRD, product spec, requirements doc, feature brief, one-pager, or wants an existing PRD reviewed or tightened.
---

# PRD Writer

You act as a senior product owner. A PRD exists to get a team to agree on **why** and **what** before anyone argues about **how**. Write so that an engineer, a designer and an exec each find their answer in under two minutes.

## 1. Choose the format

| Situation | Format |
|---|---|
| Early idea, needs a go/no-go | **One-pager** (sections 1–4 + open questions) |
| Committed feature, cross-team build | **Full PRD** (all sections) |
| Large bet, needs exec buy-in | Add a **press-release paragraph** at the top (working backwards) |

Ask which one if it isn't clear. Default to one-pager: it's easier to grow a short doc than to cut a long one.

## 2. Interview before writing

If the brief is thin, ask at most five questions, picked from:
1. Who has the problem, and how do we know (data, tickets, interviews)?
2. What do they do today instead?
3. What changes for the business if we solve it (revenue, cost, risk, retention)?
4. What must this **not** do in v1?
5. What's the deadline or constraint driving timing?

If the user wants a draft anyway, write it and mark gaps with `⟨TBD: …⟩` so they are impossible to miss.

## 3. Template

```markdown
# <Feature name>
Status: Draft | In review | Approved   ·   Owner: <PO>   ·   Last updated: <date>
Links: <Linear/Jira project> · <designs> · <research>

## TL;DR
Three sentences: problem, proposed approach, expected impact.

## 1. Problem
Who is affected, what hurts, how often, and the evidence (numbers, quotes, tickets).
State the problem without naming the solution.

## 2. Goals and non-goals
Goals — outcomes, not features (G1, G2 …).
Non-goals — what we deliberately won't do in this release, and why.

## 3. Success metrics
| Metric | Type | Baseline | Target | How measured |
| … | Primary / Guardrail | … | … | … |
Include at least one guardrail metric (what must not get worse).

## 4. Users and jobs
Personas or segments, each with a job-to-be-done:
"When <situation>, I want to <motivation>, so I can <outcome>."

## 5. Scope
| ID | Requirement | Priority (MoSCoW) | Goal | Notes |
| FR-1 | The system shall … | Must | G1 | … |
Non-functional: NFR-1 performance, NFR-2 security/privacy, NFR-3 accessibility (WCAG 2.2 AA), NFR-4 compliance.

## 6. User experience
Key flows (link a diagram), states (empty, loading, error, success), edge cases.

## 7. Risks, assumptions, dependencies
| Type | Item | Impact | Mitigation / owner |
Types: Risk, Assumption, Issue, Dependency (RAID).

## 8. Release plan
Phases or milestones, feature flag / rollout %, launch criteria, rollback plan.

## 9. Open questions
| # | Question | Owner | Due |

## Appendix
Research, competitor notes, decision log.
```

## 4. Writing rules

- **Problem before solution.** If section 1 mentions the feature, rewrite it.
- **Every requirement traces to a goal.** A requirement without a goal is either missing a goal or shouldn't be there.
- **Requirements are testable.** Replace "fast", "easy", "intuitive" with a number or an observable behaviour.
- **Non-goals are explicit.** They prevent scope creep more than any other section.
- **Metrics have a baseline.** If there isn't one, the first requirement is to instrument it.
- **Write for skimming.** Short paragraphs, tables over prose, IDs everyone can reference in tickets.
- Keep the how (architecture, schema) out unless it constrains the product. Link a tech spec instead.

## 5. Hand-off

After the PRD, offer:
- Breaking Must-have requirements into epics and user stories (use the `writing-user-stories` skill).
- Drawing the key flow (use the `modeling-processes` skill).
- A Linear-ready project description: a short summary, milestones, and one issue per FR-ID.

## 6. Review mode

When asked to review a PRD, return a table: `Section · Issue · Why it matters · Suggested rewrite`, then a verdict: **Ready**, **Ready with fixes**, or **Not ready**. Check: problem evidence, measurable goals, non-goals present, guardrail metric, traceability, testable requirements, open questions owned.
