---
name: evaluating-rag-quality
description: Designs and runs the evaluation of a RAG (retrieval-augmented generation) assistant or LLM chatbot - golden test set, quality metrics (faithfulness, answer relevance, context precision and recall, citation accuracy, correct refusals), human and LLM-as-judge review rubrics, release thresholds, regression tests and production monitoring. Use when someone asks how to test a chatbot or RAG system, measure answer quality, build an evaluation dataset, set go/no-go criteria, analyse test results, or monitor an AI assistant in production.
---

# RAG & Conversational AI Evaluation

You act as the Product Owner accountable for answer quality. The question is never "is the model good?" but "for *these* customer questions, are the answers correct, grounded, safe and useful enough to ship, and how do we know when that changes?"

## 1. Build the golden set

A versioned table, owned by the PO, reviewed by business experts. Start with 150–300 questions; grow it from production logs.

| Column | Content |
|---|---|
| `id` | Stable ID (e.g. `LOG-014`) |
| `category` | Use case / intent |
| `question` | Real customer phrasing, including typos and vague asks |
| `expected_answer` | Short reference answer approved by a business expert |
| `expected_sources` | Document IDs that contain the answer |
| `type` | `answerable` · `must_refuse` · `must_escalate` · `needs_clarification` |
| `risk` | `high` (money, regulated advice, personal data) · `medium` · `low` |

Cover each category with: common questions, paraphrases, multi-turn follow-ups, out-of-scope questions, adversarial prompts (prompt injection, requests for other customers' data), and questions whose answer recently changed. A template is in `templates/golden_set.csv`.

## 2. Metrics

Score each answer 0/1 (or 0–1) per metric. Retrieval and generation are measured separately so the team knows what to fix.

| Metric | Question it answers | Layer |
|---|---|---|
| **Context recall** | Did retrieval find the passages needed for the reference answer? | Retrieval |
| **Context precision** | Are the useful passages ranked at the top? | Retrieval |
| **Faithfulness / groundedness** | Is every claim in the answer supported by the retrieved context? | Generation |
| **Answer relevance** | Does it address the question, without padding? | Generation |
| **Correctness** | Does it match the approved reference answer? | End to end |
| **Citation accuracy** | Do cited sources actually support the answer? | End to end |
| **Correct refusal / escalation** | For `must_refuse` / `must_escalate` items, did it refuse or hand off? | Safety |
| **Tone & policy** | Clear, on-brand, discloses AI, no forbidden content | Experience |

Faithfulness, answer relevance, context precision and context recall follow the definitions popularised by the Ragas framework; any evaluation tool can compute them.

## 3. Who judges

- **LLM-as-judge** for scale, with a written rubric per metric and 2–3 scored examples in the prompt.
- **Business-expert review** on a stratified sample (all `high` risk items + 10% of the rest) to calibrate the judge. Report judge–human agreement; below ~85%, fix the rubric before trusting automated scores.
- **Disagreement log:** every case where human and judge differ is reviewed in the weekly quality ritual.

## 4. Release thresholds (go / no-go)

Agree these *before* testing, with business, data science and compliance. Example starting point:

| Gate | Threshold |
|---|---|
| Faithfulness on `high` risk items | 100% (any unsupported claim blocks release) |
| Correct refusal / escalation | ≥ 98% |
| Correctness, overall | ≥ 90% |
| Citation accuracy | ≥ 95% |
| No category below | 80% correctness |
| Regression vs. last release | No metric drops more than 2 points |

## 5. Run and analyse

Score results with `scripts/score_eval.py` (pass rates per metric, per category and per risk level, failures listed, comparison with a baseline run):

```bash
python3 scripts/score_eval.py results.csv --baseline last_release.csv
```

Then classify every failure by root cause, because each one has a different owner:
**missing content** (knowledge team) · **retrieval miss** (data science: chunking, embeddings, filters) · **generation error** (prompt, model) · **guardrail gap** (security/compliance) · **wrong expected answer** (fix the golden set).

## 6. In production

Track weekly, per use case: containment *with* resolution, escalation rate, repeat contact within 72 h, thumbs-down rate, CSAT, "no answer found" rate, and a sampled faithfulness score on live conversations. Feed every thumbs-down and escalation back into the golden set. Banking assistants typically see lower containment than other sectors; accuracy matters more than raw deflection.

## 7. Output contract

1. Evaluation plan: scope, golden-set composition, metrics, judges, thresholds, owners, cadence
2. Golden-set extract (or the full CSV)
3. Results summary from `score_eval.py` with go / no-go per gate
4. Failure analysis by root cause, with owner and next action
5. Production monitoring dashboard definition (metric, definition, source, target, alert)

## 8. Quality check

- [ ] Thresholds were agreed before results were seen
- [ ] High-risk items are 100% human-reviewed
- [ ] Retrieval and generation failures are separated
- [ ] Every failure has a root cause and an owner
- [ ] Production feedback flows back into the golden set
