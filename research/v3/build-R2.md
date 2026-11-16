# Build R2 · rag-eval rebuild (claim-level scoring, explainer, LLM-judge prompt)

Owner files only: `app/web/js/tools/rag-eval/*`, `skills/evaluating-rag-quality/*`. Release gates untouched (same 5 gates,
same thresholds, `report()` still byte-identical to `score_eval.py`).

## What changed

**1. Scoring is now claim-level and browser-only (`logic.js`, no LLM, no network)**
- `pieces()` / `splitClaims()`: answer → sentences → clauses (`;`, `and`, `but`, `et`, `mais` when both sides carry a fact).
  Greetings and questions are not claims.
- `quantities()` + `sameQty()`: numbers with units normalised. Days / weeks / months / years / hours / minutes, %, EUR / USD /
  GBP, amounts (`€1,250.50`, `1 250,50 €`, `10k EUR`), number words EN + FR (`four months`, `within a week`, `treize mois`).
  Same unit = exact match; two time units = within 5 % (4 months ≈ 122 days = 120 days; 6 months ≠ 120 days).
- `polarityFlip()`: words one text negates and the other affirms (`cannot be disputed`, `no need to contact`, `ne … pas`),
  scope limited to the clause; plus a leading yes / no (oui / non) check against the approved answer.
- Hallucination: terms of a claim that are neither in the retrieved context nor in the question. Red when ≥ 2 terms or
  ≥ 1/3 of the claim; amber ("to review") for one unknown word in a long claim.
- Every claim gets `status` ok / warn / bad and a list of `reasons` (scope `context` or `golden`, code, quantities, conversion).

**Metrics: Ragas names kept only where the formula matches** (`METHOD` map; the ratio is kept in `ratios`, the CSV column
stays 1 / 0 so the gates and `score_eval.py` are unchanged):

| Column | Label | Method |
|---|---|---|
| faithfulness | Faithfulness | Ragas formula, rule-based: supported claims / claims. 1 only if all supported |
| correctness | Answer correctness | Ragas factual-correctness F1 over claims (TP covered, FN missing, FP contradicting). 1 = no contradiction, no missing number, ≥ half covered |
| context_recall | Context recall | Ragas formula: reference claims found in the context / reference claims (source ids when no context text). 1 when ≥ 50 % |
| context_precision | Context precision | Ragas formula with id relevance: mean precision@k at the ranks of the expected sources. 1 when ≥ 50 % |
| answer_relevance | **On-topic (keywords)** (renamed) | Rule: keyword overlap. Explicitly not Ragas response relevancy |
| citation_accuracy, correct_refusal | unchanged | Rule |

- UI: "How each score is computed" panel (one line per metric + a `Ragas formula · rule-based` / `Rule` badge), ratio in the
  table cells (`0/1`, tooltip with F1 / precision@k), ratio under each metric in the detail pane.

**2. Per-answer explainer (`index.js`, `tool.css`)**: the model answer is shown with each claim highlighted green / amber / red
(+ legend, text badges, not colour alone), then one line per claim with its reasons, e.g.
`Sources: 180 days is not in the retrieved context, which says 120 days` · `Approved answer: 180 days ≠ 120 days` ·
`4 months matches 120 days in the context (within 5 %) → 120 days ≈ 3.9 months` · `polarity flipped vs the approved answer (contact, merchant)`.
A second list shows the approved answer claim by claim (covered / to review / missing / contradicted).

**3. LLM-judge prompt**: "Copy LLM-judge prompt" button (results pane + Advanced) and Export ▾ "LLM-judge prompt (.md)".
Ragas / DeepEval method (claims → verdict per claim → ratios → thresholds → reason), one scored example, all test cases with
the offline hints, strict JSON output. The JSON pastes back into Advanced › "Apply judge scores"; the judge's `reason` is now
kept (`state.judgeNotes`) and shown on the question. The existing "Ask Claude" judge action uses the same prompt.

**4. Guided demo (rules 8)**: samples load inputs only (`autorun` removed), empty pane shows "Press Score answers ⌘↵ to …",
nothing is computed in mount / rerender while `ctx.guided`. EN sample DSP-06 now says "four months" (source: 120 days) so the
presenter can show an accepted unit conversion next to the blocked DSP-02. `samples.json` regenerated.

## Audit bugs
- Fixed #1 negation passes all metrics · #2 "four months" vs "120 days" · hallucinated "drone" faithful · mislabelled metrics ·
  ratio computed but never shown · #6 CSV export label (now "Results CSV (one row per question)") · #7 icon-only cells (ratio + tooltip).
- Fixed in passing: FR auxiliaries counted as content words; "art." split a sentence.
- Not done (outside this brief): #3 headline average vs gate, #4 detail as a side drawer, #5 baseline (2.4 vs 2.5) comparison,
  question cards instead of CSV.

## Tests
`cd app/web/js && node --test tools/rag-eval/logic.test.mjs` → 19 / 19 pass (needs python3 for the parity test).
- parity with `score_eval.py` (2 samples + 40 random sets)
- EN + FR samples: still overall 96.7 % ≥ 90 % but BLOCKED by DSP-02 / CTS-02 only, no amber / red claim elsewhere; inputs only
- audit 1 "about four months" passes · audit 2 flipped yes / no fails correctness + faithfulness (and the honest answer passes
  7/7) · audit 2b sample DSP-06 answered "No, you cannot" · audit 3 "drone" → faithfulness 1/2
- polarity EN / FR incl. no false flip ("goods not received", "no later than") · units parsing + equivalence + "6 months ≠ 120 days"
  with conversion · wrong amount / currency · hallucination amber vs red · claim splitting · context recall / precision ratios · refusals
- Browser smoke (headless Edge, ports 9441 / 9442, `?sample=en` and `?sample=fr`): no result before Run, Run → BLOCKED 96.7 %,
  DSP-02 red with reasons, DSP-06 conversion line, 7 "how computed" rows, copy buttons present. Console: only the expected
  `/api/*` 404 / 501 of a plain `http.server` (rule 9). Screenshot: `research/v3/shots/v3-rag-eval.png`.

## Limits (say it on stage)
- Rules do not understand synonyms or implied meaning: a faithful paraphrase with new vocabulary shows amber / red, and a
  wrong answer built only from context words with no number or negation can still pass. That is the LLM judge's job.
- Polarity = negation words + yes / no; antonyms (before / after, free / charged) are not detected.
- Month = 30.44 days, 5 % tolerance: "17 weeks" equals "120 days"; business vs calendar days are not distinguished.

## Needs from others
- `tools/talking-points.js` (owner A): step 2 could say "each answer is checked claim by claim: numbers, units, negation, sources";
  a 4th point "in production an LLM judge takes this place: Copy LLM-judge prompt".
- Any doc / help text that lists the metric as "Answer relevance" for this tool (`guide/help*.js`, `server/catalog.py`,
  `seed/8-evaluation.md` mention the tool): label is now "On-topic (keywords)"; `score_eval.py` report rows are
  "On-topic (keywords)" and "Answer correctness".
