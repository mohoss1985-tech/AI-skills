{"client": "Banque Lumière (sample)", "skill": "aligning-stakeholders", "title": "Go-live pack: cards & payments assistant"}
===INPUT===
We go live on Monday with cards & payments (card lost or stolen, card declined, fees) at 10% of customers. Need:
1. Release notes for the internal Confluence page
2. A short briefing for the 400 phone advisors who'll receive the hand-offs
3. A RACI for the squad now that we're in run mode: PO, UX/conversation designer, data science, IT, security, business experts (cards), content writers, compliance

Evaluation run 2 was a go. Rollout: 10% → 50% → 100%, one week each if the monitoring is green.
===OUTPUT===
### 1 · Release notes · Assistant v1.3 · cards & payments

**Go-live:** Monday, 10% of authenticated app and web customers · **Next steps:** 50% on day 8, 100% on day 15, if monitoring is green

**What's new for customers**
- **Lost or stolen card:** the assistant guides the customer to block the card in the app in under a minute, then offers a replacement.
- **Card declined:** explains the most common reasons (limits, contactless, online security) and how to change limits.
- **Fees:** answers fee questions from the 2026 tariffs, with the source.
- **Fraud signals** ("payments I don't recognise") go straight to the card & fraud team with priority.

**What it doesn't do (on purpose)**
- It doesn't block cards or change limits itself: the customer does it in the app.
- It doesn't handle disputes or refunds, or give product advice. It offers an advisor.

**Quality at release:** evaluation run 2 passed all five release gates (high-risk faithfulness 100%, correct escalation 100%, correctness 95%). Report: *Evaluation: cards & payments, run 2*.

**Known issue:** for "online payment limit" the assistant may answer with the contactless limit (1 test case). Fix in v1.3.1.

**If something goes wrong:** the kill switch (assistant back to v1.2 scope) is owned by the PO, decision within 30 minutes on any security incident or a faithfulness alert.

### 2 · Advisor briefing (5 minutes, for team huddles)

> **From Monday, some of your chats will come from the assistant.** They arrive with a summary, so the customer doesn't repeat themselves.
>
> **What you'll see:** a banner *"Handed off by the assistant"*, the reason (fraud signal, block failed, customer asked for a person…) and the conversation so far.
>
> **Fraud hand-offs are tagged 🔴 priority.** Treat them first, like a fraud call.
>
> **What the customer has already been told:** check the conversation before you start. Don't repeat the block steps if the summary says they failed.
>
> **Spot a wrong answer?** Click *"Report answer"* on the conversation. The product team reviews every report within 2 working days and tells your team leader what changed.
>
> **Volumes:** at 10% we expect about 60 extra hand-offs a day across all teams, mostly *block failed* and *fraud*.

### 3 · RACI · run mode

R = does it · A = decides, one per row · C = consulted · I = informed

| Activity | PO | Conversation designer | Data science | IT | Security | Cards experts | Content writers | Compliance |
|---|---|---|---|---|---|---|---|---|
| Prioritise the backlog and roadmap | **A/R** | C | C | C | C | C | I | I |
| Design or change a journey | A | **R** | C | I | C | C | C | C |
| Write and update knowledge articles | A | C | I | — | — | C | **R** | C (regulated topics) |
| Run the evaluation before a release | A | C | **R** | I | C (adversarial set) | C (expected answers) | I | I |
| Go / no-go for a release | **A** | C | R | C | C | I | I | C |
| Monitor production, weekly report | A | I | **R** | C | I | I | I | I |
| Security incident (leak, injection) | C | I | C | R | **A** | — | — | I |
| Approve refusal and disclosure wording | C | R | — | — | — | C | C | **A** |
| Infrastructure, releases, kill switch execution | C | — | C | **A/R** | C | — | — | — |

**Rituals:** weekly quality review (PO, data science, conversation designer, content: 30 min, monitoring + 👎 sample) · monthly steering (sponsors, compliance) · sprint review open to cards experts and advisor team leaders.

### Follow-ups

| Action | Owner | Due |
|---|---|---|
| Publish release notes on Confluence | PO | Friday |
| Send the briefing to team leaders for Monday huddles | Contact centre lead | Friday |
| Validate the RACI with every lead | PO | Next steerco |
| Fix PAY-005 (v1.3.1) | Prompt owner | Day 8 |
| Gate review for 50% rollout | PO + data science | Day 7 |
