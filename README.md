# AI Skills for Product Owners · Conversational AI, RAG & Business Analysis

**Twelve AI skills that do a Product Owner's work on conversational AI and digital products, plus a worked banking case study and Analyst Kit, a local app that turns notes into client-ready deliverables.**

🇫🇷 [Version française](README.fr.md)

I'm a Product Owner. I built this to answer one question: *what parts of my product work can an AI do to a professional standard, if I teach it the methods I actually use?* Each skill packages a named method (RAG evaluation metrics, OWASP Top 10 for LLMs, INVEST, Gherkin, BPMN 2.0, MoSCoW…) as instructions Claude follows step by step, with scripts where precision matters. The result is structured, traceable, and ready for Jira or Confluence.

![Access blocked journey for a banking AI assistant, generated as BPMN 2.0](examples/banking-ai-support/journey.png)

---

## Track 1 · Conversational AI & RAG product ownership

For teams building an LLM assistant or chatbot with retrieval-augmented generation, especially in regulated sectors like banking.

| Skill | What it does | Methods & tools |
|---|---|---|
| [**AI use-case roadmap**](skills/prioritizing-ai-use-cases/SKILL.md) | Scores use cases on customer value, business impact, knowledge readiness, feasibility and risk. Applies risk and knowledge gates, then builds a Now / Next / Later roadmap with outcome goals | Weighted scoring, value × feasibility matrix, outcome-based roadmap |
| [**Conversation design**](skills/designing-conversational-journeys/SKILL.md) | Designs journeys with every branch (clarify, no source, out of scope, frustration, sensitive topics, hand-off to an advisor) and writes stories with conversational acceptance criteria | Intent & utterance design, Gherkin, BPMN journeys |
| [**RAG evaluation**](skills/evaluating-rag-quality/SKILL.md) | Golden test set, quality metrics, LLM-as-judge with human calibration, go / no-go gates, failure analysis by root cause, production monitoring | Faithfulness, answer relevance, context precision and recall (Ragas definitions), citation accuracy, correct refusal · [`score_eval.py`](skills/evaluating-rag-quality/scripts/score_eval.py) |
| [**AI risk & guardrails**](skills/governing-ai-risk/SKILL.md) | Risk register, testable guardrail requirements, red-team test cases, compliance checklist for Legal, DPO, Security and Compliance | OWASP Top 10 for LLM Applications 2025, EU AI Act transparency (Art. 50), GDPR, DORA |
| [**Knowledge base curation**](skills/curating-knowledge-bases/SKILL.md) | Audits content for coverage, freshness and contradictions, sets writing standards that retrieve well and a metadata schema, and turns production logs into a content backlog | Coverage mapping, retrieval-friendly writing, content governance |
| [**Steering & alignment**](skills/aligning-stakeholders/SKILL.md) | Decision memos for trade-offs, steering committee updates, RACI, release notes, change and adoption plans | Decision log, RACI, change management |

### ▶ Case study: [AI Support for a retail bank's assistant](examples/banking-ai-support/README.md)

A fictional bank extends its assistant to help customers stuck in their digital spaces. The case study walks through the whole loop with real outputs from the skills:

1. **Prioritised six support use cases** and picked two for the first quarter, each with an outcome goal.
2. **Designed the "access blocked" journey** as a [BPMN file](examples/banking-ai-support/journey.bpmn), including hand-off and fraud branches.
3. **Ran the evaluation** with [`score_eval.py`](skills/evaluating-rag-quality/scripts/score_eval.py). The verdict was **no-go**: four failures, each traced to its root cause and owner.
4. **Built the risk register** (prompt injection, data disclosure, outdated tariffs, excessive agency, regulated advice).
5. **Found the content gaps** behind the wrong answers.
6. **Wrote the steering committee decision memo.**

## Track 2 · Business analysis & delivery

| Skill | You give | You get | Methods |
|---|---|---|---|
| [**Process Modeler**](skills/modeling-processes/SKILL.md) | SOPs, meeting notes, policy text | Colour-coded BPMN 2.0 file with swimlanes (opens in Camunda, bpmn.io, Signavio), steps traced to the source, open questions | BPMN 2.0, *Method & Style*, UML · [`build_bpmn.py`](skills/modeling-processes/scripts/build_bpmn.py) |
| [**PRD Writer**](skills/writing-prds/SKILL.md) | A brief or an idea | One-pager or full PRD: problem with evidence, goals and non-goals, guardrail metrics, traceable requirement IDs | Jobs to be done, MoSCoW, RAID, working backwards |
| [**User Stories & Acceptance Criteria**](skills/writing-user-stories/SKILL.md) | Requirements or a PRD section | Sprint-ready stories, Gherkin scenarios, INVEST check, Definition of Ready, Jira or Linear format | Story mapping, INVEST, SPIDR, Example Mapping |
| [**API Test & Documentation**](skills/testing-apis/SKILL.md) | Spec, curl calls or a description | Test matrix tied to business rules, runnable tests, OpenAPI 3.1, reference docs | Boundary values, OWASP API Top 10, RFC 9457 |
| [**Xray Test Manager**](skills/managing-xray-tests/SKILL.md) | Stories with acceptance criteria, or test / evaluation results | Manual, Cucumber and Generic tests with requirement coverage, plus import files for **Xray Cloud and Server / Data Center** (CSV, `.feature`, Xray JSON) · [examples](skills/managing-xray-tests/examples/README.md) | Test design, Test Plans, Xray JSON · [`build_xray.py`](skills/managing-xray-tests/scripts/build_xray.py) |
| [**SQL Query Generator**](skills/generating-sql/SKILL.md) | A business question and a schema | Readable SQL, a plain-language walkthrough and validation queries. Samples include [chatbot containment with resolution](app/seed/12-sql-containment.md) and [fraud decline bursts](app/seed/13-sql-fraud.md) (window functions, gaps and islands, `LATERAL`) | Metric / grain / filter framing |

The skills hand work to each other:

```
AI use-case roadmap ─► Conversation design ─► User stories ─► RAG evaluation ─► Steering & alignment
                              │                                   ▲
                              └─► AI risk & guardrails ───────────┘  (red-team cases join the golden set)
Knowledge base curation ─► fixes the "missing content" failures found by RAG evaluation
User stories + RAG evaluation ─► Xray tests: story coverage and evaluation runs tracked in Jira
```

## How each skill is built

Every skill follows the same five-part structure, so the AI works like a specialist rather than a general chatbot:

1. **Trigger:** a precise description of when the skill applies.
2. **Role & method:** one expert stance and one named method.
3. **Guardrails:** ask about ambiguities, flag assumptions, frame legal points as items to confirm with the owner, never act on production without confirmation.
4. **Output contract:** fixed sections in a fixed order, ready for Jira, Confluence or a steering committee.
5. **Quality gate:** a checklist the AI applies to its own answer, plus a hand-off to the next skill.

Where precision matters, the skill ships a script instead of trusting the model. `build_bpmn.py` lays out the diagrams, `score_eval.py` computes the release gates and `build_xray.py` writes Xray import files for both Cloud and Server / Data Center. This follows Anthropic's [Agent Skills](https://www.claude.com/blog/equipping-agents-for-the-real-world-with-agent-skills) format.

---

## Analyst Kit: the app

A minimal, Linear-style workspace for using all twelve skills on real work. No API key needed.

![Analyst Kit: a deliverable with its conversation](docs/deliverable.png)

- **Notes in, deliverable out.** Pick a deliverable, paste notes or drop a file, and get a client-ready document.
- **Try before you write.** Every skill ships a finished sample, and each AI skill has three realistic scenarios (banking support, insurance, advisor copilot, go-live…) that fill the form in one click.
- **Xray assistant.** The Xray tests page has its own chat for Xray questions: Cloud vs Server / Data Center, test types, Test Plans, imports and import errors. Each import file has Copy and Download buttons.
- **Built-in Guide.** An instant help chatbot that knows every skill, the jargon (faithfulness, prompt injection, containment, AI Act Art. 50…) and the app. It suggests what to paste, opens samples, and hands anything else to Claude.
- **Conversation next to every document.** Ask questions or request changes. Claude replies and updates the document, and every version is kept.
- **Professional process diagrams.** Real BPMN 2.0 drawn with bpmn-js (the engine behind Camunda): colour legend, swimlanes, zoom, full screen, `.bpmn` / PNG / SVG downloads.
- **Handover.** Word (diagrams included), PDF or formatted copy. *Mark as sent* tracks what each stakeholder has received.
- **One-click next step**, for example turning a use-case roadmap into a conversation design, then into an evaluation plan.
- **Learns how you work:** your name on every document, plus your language, tone and backlog tool.

```bash
python3 app/server.py      # then open http://localhost:4317
```

Requests wait in a local queue. Claude, running in a Claude Code session, picks them up with [`app/kit.py`](app/kit.py), applies the matching skill and posts the result back.

## Use the skills directly

- **Claude Code:** copy any folder from `skills/` into `~/.claude/skills/` or a repository's `.claude/skills/`.
- **claude.ai:** zip a skill folder and upload it under *Settings → Capabilities → Skills*.

## Repository layout

```
skills/     twelve skills, one SKILL.md each (+ scripts/ and templates/ where needed)
examples/   banking-ai-support: end-to-end case study with BPMN, evaluation data and report
app/        Analyst Kit (server.py, kit.py, static/ front end, seed/ samples)
site/       one-page showcase of the business-analysis skills
docs/       screenshots
```

## References

[OWASP Top 10 for LLM Applications](https://genai.owasp.org/llm-top-10/) · [Ragas metrics](https://docs.ragas.io/en/stable/references/metrics.html) · EU AI Act, Art. 50 · [OMG BPMN 2.0.2](https://www.omg.org/spec/BPMN/2.0.2/) · Bruce Silver, *BPMN Method and Style* · Bill Wake, INVEST · Mike Cohn, SPIDR · Matt Wynne, Example Mapping · [Gherkin](https://cucumber.io/docs/gherkin/reference/) · [The Linear Method](https://linear.app/method) · [OpenAPI 3.1](https://spec.openapis.org/oas/v3.1.0) · [OWASP API Security Top 10](https://owasp.org/API-Security/)

All organisations and figures in this repository are fictional. Regulatory points are summaries to confirm with legal and compliance owners, not legal advice.
