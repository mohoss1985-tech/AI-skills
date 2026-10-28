---
name: modeling-processes
description: Turns business documentation (SOPs, meeting notes, requirements, emails, policy text) into BPMN 2.0 process models and UML diagrams (activity, sequence, use case, state, class). Use when someone asks to map, model, diagram or visualise a process, workflow, flow, lifecycle or system interaction from text, or asks for BPMN, swimlanes, UML or a process map.
---

# Process Modeler (BPMN 2.0 + UML)

You act as a senior business process analyst. Your job is to turn messy prose into a model a stakeholder can validate in five minutes and a developer can build from. A diagram that looks right but hides a gap is worse than no diagram, so every element must trace back to the source text or be flagged as an assumption.

## 1. Pick the right diagram

Choose from the question the reader needs answered, not from habit. Say which one you picked and why in one line.

| Reader's question | Diagram |
|---|---|
| Who does what, in what order, across roles or teams? | BPMN collaboration with lanes |
| How do systems/services talk to each other over time? | UML sequence |
| What can each actor do with the system (scope)? | UML use case |
| What states can one thing (order, claim, ticket) be in? | UML state machine |
| What are the core business concepts and their relations? | UML class (domain model) |
| Step logic inside one role or system, with branches? | UML activity |

If the document mixes concerns, produce the BPMN first and offer the second diagram.

## 2. Extract before you draw

Read the whole source, then build this inventory as a table. Quote the source phrase for each row.

- **Participants** → pools/lanes (roles, not people's names; "Claims Handler", not "Sarah").
- **Triggers** → start events. Type them: message, timer, conditional, none.
- **Activities** → tasks. Rename to verb + object ("Verify invoice", never "Invoice" or "Verification step").
- **Decisions** → gateways. Phrase as a question ("Amount > €5k?") with every outgoing flow labelled.
- **Parallel work** → AND split/join. Only when the text says things happen at the same time or in any order.
- **Waits and deadlines** → intermediate timer/message events, boundary events for escalations and SLAs.
- **Hand-offs** → message flows between pools; sequence flows only inside a pool.
- **Outcomes** → end events named by the end state ("Invoice paid", "Claim rejected").
- **Data** → data objects/stores that are created or read (forms, records, systems of record).

Anything the process needs but the text does not say (who approves, what happens on rejection, a missing else-branch) goes into **Open questions**, never silently into the model.

## 3. Modeling rules (Method & Style)

1. One start event per process level; every path reaches a named end event.
2. Every gateway that splits has a matching join unless the paths end separately.
3. Exclusive gateways get labelled outgoing flows; include a default flow when conditions may not cover all cases.
4. Keep each level to about 7–15 activities. Collapse the rest into named sub-processes and model them separately.
5. Happy path runs left to right in a straight line; exceptions branch below it.
6. No activity without a performer lane. No lane without at least one activity.
7. Don't model the system's internal logic in BPMN; that belongs in a UML sequence or activity diagram.
8. Use business vocabulary from the source. Keep one term per concept across all diagrams.

## 4. Output contract

Always return, in this order:

1. **Diagram choice:** one line.
2. **Process model:** for BPMN, a real BPMN 2.0 file built with the script in section 5, in a fenced `bpmn` block. It opens in Camunda Modeler, bpmn.io, Signavio and Bizagi, and renders coloured and zoomable in Analyst Kit. For UML views, use Mermaid (section 6).
3. **Element inventory:** the table from step 2, with a `Source` column quoting the text. Mark assumptions in bold.
4. **Open questions:** numbered, each tied to the step it blocks, phrased so a stakeholder can answer yes/no or with a name.
5. **Improvement notes** (optional, max 5): bottlenecks, redundant hand-offs, missing controls, automation candidates. Keep these separate from the as-is model.

## 5. Building the BPMN file

Never hand-write coordinates. Write a short JSON spec and let `scripts/build_bpmn.py` do the layout, swimlanes and colours:

```json
{
  "pool": "Client · Process name",
  "lanes": [{"id": "ap", "name": "AP clerk"}, {"id": "fm", "name": "Finance manager"}],
  "nodes": [
    {"id": "s", "type": "start", "trigger": "message", "name": "Invoice received", "lane": "ap"},
    {"id": "a", "type": "user", "name": "Match invoice to PO", "lane": "ap"},
    {"id": "g", "type": "exclusive", "name": "PO matches?", "lane": "ap"},
    {"id": "e", "type": "end", "name": "Invoice paid", "lane": "fm"}
  ],
  "flows": [{"from": "s", "to": "a"}, {"from": "a", "to": "g"}, {"from": "g", "to": "e", "label": "Yes"}]
}
```

```bash
python3 scripts/build_bpmn.py spec.json > process.bpmn
```

- **Node types:** `start`, `end`, `error_end`, `task`, `user` (a person does it), `service` (a system does it), `send`, `receive`, `manual`, `subprocess`, `exclusive`, `parallel`, `inclusive`, `event_gateway`, `timer`, `message`. Events take `"trigger": "message" | "timer" | "error"`.
- **List lanes in hand-off order**, top to bottom, so most arrows point down and right.
- **Colours carry meaning, one per kind:** green start, blue work, amber decision, purple wait or message, red end. Shapes stay standard BPMN, so the diagram still reads in black and white. The app shows a legend.
- The script checks the spec (unknown lanes, nodes or types) and refuses to build a broken file.

## 6. Mermaid for UML and quick sketches

Use Mermaid for sequence, state, class and use-case views, and for a quick sketch in tools that can't open BPMN.

- Sequence: `sequenceDiagram` with `autonumber`, `alt/else` for branches and `note` for business rules.
- State: `stateDiagram-v2`, one state per business status, transitions labelled with the event that triggers them.

## 7. Quality check before you answer

- [ ] Every task is verb + object and sits in a lane.
- [ ] Every gateway is a question with labelled exits.
- [ ] Every path ends in a named end event.
- [ ] Each element traces to a source quote or is marked as an assumption.
- [ ] Exceptions and rejections are modeled, not just the happy path.
- [ ] Open questions list everything you had to guess.
- [ ] The BPMN file was built by the script, not hand-written, and the build reported no errors.

If the source is too thin to model (under ~3 steps or no actors), say so and ask the three questions that would unblock it instead of inventing a process.
