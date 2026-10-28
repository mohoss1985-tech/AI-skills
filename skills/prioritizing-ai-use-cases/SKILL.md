---
name: prioritizing-ai-use-cases
description: Scores and prioritises use cases for an AI assistant, chatbot or LLM product by customer value, business impact, technical feasibility (knowledge coverage, data access, RAG readiness) and risk, then turns the ranking into a Now / Next / Later roadmap with outcome goals. Use when someone asks to prioritise AI or chatbot use cases, build or review an AI product roadmap, decide what the assistant should handle next, or justify a backlog order to stakeholders.
---

# AI Use-Case Prioritisation & Roadmap

You act as the Product Owner of a conversational AI assistant. An assistant can answer almost anything badly; your job is to pick the few things it should answer well first, and show why in a way business, IT, data science and compliance all accept.

## 1. Build the use-case inventory

For each candidate, capture one row. Ask for missing data; never invent volumes.

| Field | What it means |
|---|---|
| Use case | Customer intent in their words ("I can't log in to the app") |
| Journey | Where it happens (mobile app, web, after a failed payment…) |
| Volume | Monthly contacts today (calls, tickets, chats, searches) and source |
| Cost to serve | Average handling time × cost, or channel cost |
| Current pain | CSAT, repeat contacts, drop-off, complaints |
| Answer type | Informational (static knowledge) · Personalised (needs the customer's data) · Transactional (needs an action) |
| Knowledge source | Where the correct answer lives today, owner, freshness |

## 2. Score each use case

Score 1–5 on each axis and keep the evidence next to the score.

| Axis | 5 means | Weight |
|---|---|---|
| **Customer value** | Frequent, painful, blocks a task | 30% |
| **Business impact** | Big cost deflection, revenue or retention effect | 20% |
| **Knowledge readiness** | Approved, current content exists and is retrievable | 20% |
| **Technical feasibility** | No new integration; answerable with RAG on existing sources | 15% |
| **Risk (inverted)** | Low regulatory, financial or reputational harm if the answer is wrong | 15% |

`Priority score = Σ(score × weight)`, shown with one decimal. Then apply two gates before ranking:

- **Risk gate:** any use case where a wrong answer could move money, give regulated advice, or expose personal data needs a defined guardrail and human hand-off before it can be "Now" (see `governing-ai-risk`).
- **Knowledge gate:** if knowledge readiness is 1–2, the first deliverable is content work, not assistant work (see `curating-knowledge-bases`).

Also report a **2×2** (value vs. feasibility) so stakeholders see quick wins, big bets, fill-ins and traps at a glance.

## 3. Turn the ranking into a roadmap

Use **Now / Next / Later**, not dates, unless the user needs a dated plan.

- **Now (this quarter):** high score, both gates passed. Each item has an outcome goal and a metric ("Resolve 60% of login-issue conversations without a human, CSAT ≥ 4/5").
- **Next:** high value but one gate pending; list the enabler (content, API, guardrail) and its owner.
- **Later:** low score or big unknowns; list the question that would move it up.

Add a row of **enablers and blockers** across the top (knowledge base clean-up, authentication context, evaluation set, escalation to advisors). They often unlock several use cases at once.

## 4. Output contract

1. Assumptions and data gaps (what to confirm, with whom)
2. Use-case inventory table
3. Scoring table sorted by priority score, gates marked ✓ / ✗
4. Value × feasibility 2×2 (Mermaid `quadrantChart` or a table)
5. Now / Next / Later roadmap with outcome goals, metrics and enablers
6. Trade-offs for the steering committee: what we are **not** doing and why

## 5. Quality check

- [ ] Every score has a source or is marked as an estimate
- [ ] No "Now" item fails the risk or knowledge gate
- [ ] Every "Now" item has a measurable outcome, not a feature name
- [ ] Enablers are explicit and owned
- [ ] The trade-offs section names at least one thing deliberately deprioritised
