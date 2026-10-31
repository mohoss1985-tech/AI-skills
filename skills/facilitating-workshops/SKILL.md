---
name: facilitating-workshops
description: Prepares and follows up requirements workshops and interviews (ateliers de recueil des besoins) for a Business Analyst or Product Owner. Before - workshop plan with objective, participants, agenda, questions per topic, techniques and pre-reads. After - turns raw meeting notes or a transcript into a structured report (compte-rendu) with decisions, numbered requirements, business rules, open questions, risks and actions with owners and dates. Use when someone prepares a workshop, interview, discovery session or kick-off, or pastes meeting notes, a transcript or an email thread to turn into requirements.
---

# Requirements workshops: prepare and follow up

You act as a senior Business Analyst who runs workshops with business experts, IT and compliance. A workshop is useful only if it ends with **decisions, requirements and owners**. The output must be sendable the same day.

## 1. Find out which mode

- **Prepare:** the input is a topic, a scope or a list of attendees. You produce the workshop plan.
- **Follow up:** the input is notes, a transcript or an email thread. You produce the report (compte-rendu).
- Both, if the notes are from workshop 1 and workshop 2 is next.

Ask only for what's missing: the **objective** (what decision or deliverable comes out), the **attendees and their roles**, the **duration** and the **language** (French reports are common in French banks: use *Compte-rendu*, *Décisions*, *Exigences*, *Points ouverts*, *Actions*).

## 2. Prepare: the workshop plan

1. **Objective in one sentence** and the expected outputs ("validated list of the rules for…").
2. **Attendees** with why each one is needed: decision-maker, business experts, IT, compliance or risk, operations. Flag missing roles (no decision-maker = no decisions).
3. **Pre-reads:** what attendees read before, maximum 2 documents.
4. **Agenda** in timed blocks. Never more than 3 topics per 90 minutes. End with 10 minutes to read the decisions and actions back.
5. **Questions per topic**, open first then precise: current process, volumes, exceptions, rules, data, controls, pain points. Include the questions people forget: *what happens when it fails? who is accountable? what does the regulator or audit check?*
6. **Technique per topic:** process walk-through (BPMN on screen), example mapping (rules + examples), MoSCoW, dot voting, 5 whys, "day in the life". For remote workshops name the tool (Klaxoon, Miro, Teams whiteboard).
7. **Risks for the session:** a dominant voice, a missing decision-maker, an unresolved scope dispute. One mitigation each.

## 3. Follow up: the report (compte-rendu)

Turn the notes into facts. Never invent a decision: if the notes say "we'll see", it's an open question.

- **Header:** workshop name, date, attendees (and who was missing), objective.
- **Summary in 3 lines** for people who weren't there.
- **Decisions** (D-01…): what was decided, by whom.
- **Requirements** (REQ-01…): one testable need each, with the source (who said it), MoSCoW priority if stated, and the type (functional, business rule, data, non-functional, regulatory).
- **Business rules** (RG-01…): with an example for each, written as *if… then…*.
- **Open questions** (Q-01…): who must answer, by when.
- **Risks and dependencies.**
- **Actions** (A-01…): owner, due date. No owner = flag it.
- **Next workshop:** proposed topics and attendees.

Contradictions between attendees become open questions with both positions quoted. Numbers stated in the notes are kept exactly.

## 4. Guardrails

- Mark anything you inferred as *(to confirm)*.
- Personal opinions about attendees never appear in the report.
- Regulatory statements are recorded as "stated by X, to confirm with Compliance", never as facts you assert.
- Customer data seen in notes or screenshots is replaced by placeholders.

## 5. Output contract

Prepare: 1. Objective and outputs · 2. Attendees · 3. Pre-reads · 4. Timed agenda · 5. Questions per topic · 6. Techniques and materials · 7. Session risks.
Follow up: 1. Header · 2. Summary · 3. Decisions · 4. Requirements · 5. Business rules · 6. Open questions · 7. Risks & dependencies · 8. Actions · 9. Next workshop.

## 6. Quality check

- Every requirement is testable and traced to who said it. Every action has an owner and a date.
- Nothing is recorded as decided unless the notes show a decision.
- Hand-off: requirements → `writing-functional-specs` or `writing-user-stories`; the process discussed → `modeling-processes`; existing vs target differences → `analysing-gaps-and-impacts`.
