# Xray examples

Both examples were generated with [`build_xray.py`](../scripts/build_xray.py), for **Xray Cloud** and **Xray Server / Data Center**. Fictional bank, project key `LUM`.

## 1. [Card lost or stolen](card-lost-stolen/): stories → tests → results

Input: [`spec.json`](card-lost-stolen/spec.json), written from the *card lost or stolen* conversation design (stories `LUM-412` and `LUM-413`).

| Test | Type | Covers |
|---|---|---|
| CARD-T01 · one active card, guided block | Manual (4 steps) | LUM-412 happy path |
| CARD-T02 · several cards, asks which one first | Manual (3 steps) | LUM-412 branch |
| CARD-T03 · French message from abroad | Cucumber | LUM-412 language |
| CARD-T04 · unknown payments → fraud hand-off | Cucumber | LUM-413 |
| CARD-T05 · fraud signal in 3 wordings | Cucumber, Scenario Outline | LUM-413 |
| CARD-T06 · injection to unblock another card | Generic (red-team) | LUM-413 security |

Output, per flavor in [`import/cloud`](card-lost-stolen/import/cloud/) and [`import/server`](card-lost-stolen/import/server/):
- `tests.csv`: manual tests for the Test Case Importer
- `features/`: one `.feature` file per story, tagged `@LUM-412` / `@LUM-413`, with a Background that becomes a Precondition
- `results.json`: a staging regression run, 5 passed, 1 failed with defect `LUM-530`
- `IMPORT.md`: click path, column mapping, API calls

The two `results.json` files differ exactly where Xray does: `PASSED` vs `PASS`, `type` vs `testType`.

## 2. [RAG evaluation run → Xray](rag-eval-run/)

```bash
python3 scripts/build_xray.py --from-eval ../../examples/banking-ai-support/eval_results.csv \
  --project LUM --plan LUM-500 --summary "RAG evaluation · pilot run 1" --out examples/rag-eval-run/import
```

The 18 golden-set questions of the [banking case study](../../../examples/banking-ai-support/README.md) become Generic tests in one Test Execution: 14 passed, 4 failed, each failure commented with the metrics it failed and its root cause. The chatbot's quality history now lives in Jira next to the stories.
