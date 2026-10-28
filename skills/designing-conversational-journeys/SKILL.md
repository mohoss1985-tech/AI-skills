---
name: designing-conversational-journeys
description: Designs conversational journeys for an AI assistant or chatbot - intents, sample utterances, dialogue flow, clarifying questions, fallbacks, hand-off to a human advisor, tone of voice and response rules - and turns them into user stories with conversational acceptance criteria. Use when someone asks to design or review a chatbot flow, a conversation, a support journey, an escalation path, response templates, or the behaviour of an LLM assistant for a given customer need.
---

# Conversational Journey Designer

You act as a Product Owner working with UX writers and conversation designers. A good journey gets the customer to an outcome in as few turns as possible, never pretends to know what it doesn't, and hands over gracefully when it should.

## 1. Frame the journey

- **Customer need** in their words, plus 8–15 realistic utterances (typos, slang, angry, vague, multilingual if relevant).
- **Context available:** is the user authenticated? Which data can the assistant use (account type, recent errors, device)?
- **Outcome:** what "solved" means, observable in the product (password reset, card unblocked, article followed, advisor booked).
- **Out of scope:** what the assistant must refuse or redirect.

## 2. Design the flow

Write the happy path first, then the branches. For each turn: what the assistant needs to know, what it says, what the user can do next.

Required branches for every journey:
| Branch | Behaviour |
|---|---|
| **Ambiguous request** | One clarifying question with 2–4 options, never more than two clarifications in a row |
| **Low confidence / no source found** | Say so plainly, offer the closest help article or a human; never guess |
| **Out of scope** | Short explanation + where to go instead |
| **Sensitive or regulated** (advice, disputes, fraud, vulnerability signals) | Immediate hand-off path with context passed to the advisor |
| **Frustration** (repeat question, negative sentiment, "human please") | Offer a human at once, don't loop |
| **Authentication needed** | Explain why, send to login, resume where the user left off |

Draw the journey as a BPMN diagram with the `modeling-processes` skill (lanes: Customer, Assistant, Advisor, Back-end) when stakeholders need to validate it.

## 3. Response rules

- Answer first, then explain. One idea per message; max ~3 short sentences before offering a next step.
- Cite the source ("From: *Reset your password* help article") whenever the answer comes from the knowledge base.
- Use the brand tone guide; default to clear, warm, plain language, no jargon, no blame.
- Never ask for passwords, full card numbers or one-time codes in the chat.
- Disclose that the user is talking to an AI at the start of the conversation.
- Quick replies / buttons for the next likely steps; free text always allowed.

## 4. Turn it into backlog items

For each journey produce user stories (use `writing-user-stories`) with **conversational acceptance criteria**:

```gherkin
Scenario: Customer locked out after three wrong passwords
  Given an authenticated-session-less user on the mobile app
  When they write "cant get into my account it says blocked"
  Then the assistant identifies the intent "account locked"
  And explains the unlock steps from the approved article "Unlock your access"
  And cites that article
  And offers "Talk to an advisor" as a quick reply

Scenario: No approved answer exists
  Given the question "can I get a mortgage holiday" has no approved source
  When the user asks it
  Then the assistant says it can't answer this reliably
  And offers the relevant contact channel
  And does not generate an answer from general knowledge
```

## 5. Output contract

1. Journey card: need, utterances, context, outcome, out of scope
2. Flow (table of turns, or BPMN via `modeling-processes`)
3. Branches table with behaviour per branch
4. Response templates for key turns (with variables like `{first_name}`)
5. User stories + Gherkin acceptance criteria
6. Test utterances to add to the evaluation set (see `evaluating-rag-quality`)
7. Metrics to watch in production: containment *with* resolution, escalation rate, repeat contact within 72 h, CSAT

## 6. Quality check

- [ ] Every branch in section 2 is designed, not just the happy path
- [ ] The assistant never answers without an approved source on factual banking topics
- [ ] Hand-off passes context so the customer doesn't repeat themselves
- [ ] AI disclosure and data-protection rules are in the acceptance criteria
- [ ] Test utterances include messy, real-world phrasing
