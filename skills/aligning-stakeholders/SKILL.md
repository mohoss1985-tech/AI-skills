---
name: aligning-stakeholders
description: Prepares the communication that keeps a multidisciplinary product team aligned - stakeholder map and RACI, decision memos for trade-offs, steering committee updates, sprint review and release notes, and change-management plans for new AI or digital features. Use when someone asks to prepare a steering committee, a status update, an arbitration or decision request, a RACI, release communication, a change or adoption plan, or to align business, IT, data science, UX, security and compliance.
---

# Stakeholder Alignment & Change Management

You act as a Product Owner coordinating business experts, UX/UI, data scientists, IT, security, compliance and content writers. Alignment comes from making decisions easy to take and progress easy to see, not from more meetings.

## 1. Stakeholder map

List each group with: what they care about, what they decide, what they need from the PO, preferred format and cadence. Then a **RACI** for recurring decisions (roadmap priority, release go/no-go, content approval, guardrail changes, model changes).

## 2. Decision memo (arbitration)

One page, written so the decision-maker can decide in five minutes:

```markdown
# Decision needed: <question>        Decide by: <date>   Decider: <name/role>
## Context        two or three sentences, with the number that matters
## Options
| Option | Customer impact | Business impact | Effort | Risk | Who prefers it |
## Recommendation  which option and why, in one paragraph
## If we don't decide   what slips or breaks
## Consulted        who gave input, and any dissent
```

Record the outcome in a **decision log** (date, decision, decider, rationale) linked from Confluence.

## 3. Steering committee update

Keep to one screen per section:
1. **Headline:** on track / at risk / off track, and why, in one sentence
2. **Outcomes:** key metrics vs. target with trend (e.g. resolution rate, CSAT, escalation, answer quality)
3. **Delivered since last time** in customer terms
4. **Next period:** the 3 priorities
5. **Risks & decisions needed:** each with owner and date
6. **Asks:** what you need from the committee

## 4. Release communication

- **Release notes for stakeholders:** what changes for customers, for advisors, and for operations; known limitations
- **Advisor / support briefing:** new behaviours of the assistant, what it now hands over, how to give feedback
- **Customer-facing message** if behaviour changes visibly

## 5. Change & adoption plan

For a new AI feature: who is affected, what changes for them, concerns to address (job impact, trust in AI answers, workload), training, champions, feedback channel, and adoption metrics (usage, satisfaction, escalation quality) with a review date.

## 6. Output contract

Return the artefact requested (memo, steerco update, release notes, RACI, change plan) in the formats above, ready to paste into Confluence or slides, plus a short list of follow-ups with owners.

## 7. Quality check

- [ ] Every decision request has a decider, a date and a recommendation
- [ ] Metrics are outcomes for customers and business, not activity counts
- [ ] Risks have owners; asks are explicit
- [ ] Dissent is recorded, not hidden
