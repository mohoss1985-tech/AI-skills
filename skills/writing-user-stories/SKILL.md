---
name: writing-user-stories
description: Writes, splits and reviews user stories, epics and acceptance criteria from a PRD, feature idea, process model or meeting notes. Applies INVEST, SPIDR splitting, Example Mapping and Gherkin (Given/When/Then), and can output Jira-style stories or Linear-style issues. Use when someone asks for user stories, acceptance criteria, backlog items, tickets, epics, BDD scenarios, Definition of Ready/Done, or wants stories refined or split.
---

# User Story & Acceptance Criteria Writer

You act as a product owner preparing a backlog for refinement. A good story is a promise of a conversation; the acceptance criteria are the record of what that conversation agreed. The team should be able to estimate it, build it in a sprint and know without debate when it's done.

## 1. Start from the outcome

From the input, identify:
- **Persona** — specific ("first-time buyer on mobile", not "user")
- **Goal** — what they're trying to get done
- **Value** — why it matters to them or the business
- **Source** — PRD requirement ID, process step or note it came from (for traceability)

If the input is an epic, map it first: list the user's steps left to right (backbone), then the stories under each step, then draw a line for the first releasable slice (story mapping).

## 2. Write the story

```
Title: <short, starts with a verb>
As a <persona>,
I want <capability>,
so that <benefit>.
```

Then check it against **INVEST** and report any failure:
- **I**ndependent — can be built and released without another story in the same sprint
- **N**egotiable — describes the need, not the UI implementation
- **V**aluable — a user or the business notices when it ships
- **E**stimable — the team knows enough to size it
- **S**mall — fits in one sprint, ideally 1–3 days
- **T**estable — has clear acceptance criteria

## 3. Split stories that are too big (SPIDR)

Try in this order and name the technique used:
- **Paths** — split by alternative paths (pay by card / pay by invoice)
- **Interfaces** — split by device or channel (web first, then mobile)
- **Data** — split by data types or ranges (domestic addresses, then international)
- **Rules** — defer complex business rules (basic discount first, stacking rules later)
- **Spike** — when the unknown is technical, a time-boxed research story first

Never split by technical layer (frontend story, backend story); each slice must deliver user value.

## 4. Discover the rules (Example Mapping)

Before writing criteria, list:
- **Rules** — the business rules the story must enforce
- **Examples** — one concrete example per rule, including a failing one
- **Questions** — anything nobody can answer yet (these block "Ready")

## 5. Write acceptance criteria

Use **Gherkin** for behaviour, one scenario per example:

```gherkin
Scenario: Discount code applied to an eligible basket
  Given a basket worth €80
  And a valid code "AUTUMN10" for 10% off orders over €50
  When the shopper applies "AUTUMN10"
  Then the basket total shows €72.00
  And the discount line reads "AUTUMN10 −€8.00"
```

Rules for criteria:
- One behaviour per scenario. Concrete values, not "a valid amount".
- Cover the happy path, each rule's failure, and at least one edge case (empty, limit, expired, duplicate).
- Describe observable outcomes, never implementation ("the total shows", not "the API returns 200").
- Use a short **checklist** instead of Gherkin for non-behavioural criteria (copy, tracking events, accessibility, performance).
- Add relevant **non-functional criteria**: response time, WCAG 2.2 AA, audit logging, permissions.

## 6. Output formats

Ask which tool the team uses. Default to the standard format.

**Standard / Jira**: Title · Story · Context · Acceptance criteria (Gherkin) · Checklist · Out of scope · Open questions · Source · Estimate placeholder.

**Linear-style issue**: Linear recommends plain, task-like issues over the "As a…" template. Use an imperative title ("Let shoppers apply discount codes at checkout"), a two-to-three line description of the user need and why, then the acceptance criteria as a checklist, labels and the parent project.

## 7. Definition of Ready check

Mark each story **Ready** or **Not ready** with the reason:
- [ ] Persona, goal and value are clear
- [ ] Passes INVEST (or the failure is explained)
- [ ] Acceptance criteria cover happy path, failures and an edge case
- [ ] No open questions that block building
- [ ] Dependencies and designs are linked
- [ ] Traces back to a PRD requirement or process step

## 8. Review mode

When given existing stories, return a table: `Story · Problem · Rewrite`, then flag stories to split (with the SPIDR technique) and missing scenarios.
