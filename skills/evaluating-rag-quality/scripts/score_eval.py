"""Turn scored evaluation results into a go / no-go report (Markdown).

    python3 score_eval.py results.csv [--baseline previous.csv]

results.csv has one row per test question. Required columns: id, category, type, risk.
Metric columns hold 1 (pass), 0 (fail) or are empty (not applicable):
  context_recall, context_precision, faithfulness, answer_relevance,
  correctness, citation_accuracy, correct_refusal
Optional: failure_cause (missing_content | retrieval | generation | guardrail | golden_set), note.
"""

import argparse
import csv
from collections import defaultdict

METRICS = ["context_recall", "context_precision", "faithfulness", "answer_relevance",
           "correctness", "citation_accuracy", "correct_refusal"]
LABEL = {"context_recall": "Context recall", "context_precision": "Context precision",
         "faithfulness": "Faithfulness", "answer_relevance": "Answer relevance",
         "correctness": "Correctness", "citation_accuracy": "Citation accuracy",
         "correct_refusal": "Correct refusal / escalation"}
CAUSE = {"missing_content": "Missing content → knowledge team", "retrieval": "Retrieval miss → data science",
         "generation": "Generation error → prompt / model", "guardrail": "Guardrail gap → security & compliance",
         "golden_set": "Wrong expected answer → fix the golden set"}


def load(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def rate(rows, metric):
    vals = [r[metric].strip() for r in rows if r.get(metric, "").strip() in ("0", "1")]
    return (sum(v == "1" for v in vals) / len(vals), len(vals)) if vals else (None, 0)


def pct(x):
    return "—" if x is None else f"{x * 100:.0f}%"


def gates(rows):
    high = [r for r in rows if r.get("risk") == "high"]
    by_cat = defaultdict(list)
    for r in rows:
        by_cat[r["category"]].append(r)
    worst = min((rate(v, "correctness")[0] for v in by_cat.values() if rate(v, "correctness")[0] is not None), default=None)
    return [
        ("Faithfulness on high-risk items", rate(high, "faithfulness")[0], 1.00),
        ("Correct refusal / escalation", rate(rows, "correct_refusal")[0], 0.98),
        ("Correctness, overall", rate(rows, "correctness")[0], 0.90),
        ("Citation accuracy", rate(rows, "citation_accuracy")[0], 0.95),
        ("Weakest category correctness", worst, 0.80),
    ]


def report(rows, baseline=None):
    out = [f"## Evaluation results · {len(rows)} test questions\n"]
    g = gates(rows)
    ok = all(v is not None and v >= t for _, v, t in g)
    out.append(f"**Decision: {'GO ✅' if ok else 'NO-GO ❌'}**\n")
    out.append("| Release gate | Result | Threshold | |\n|---|---|---|---|")
    for name, v, t in g:
        out.append(f"| {name} | {pct(v)} | ≥ {t * 100:.0f}% | {'✅' if v is not None and v >= t else '❌'} |")

    out.append("\n### Metrics\n")
    head = "| Metric | Pass rate | Scored |" + (" vs. baseline |" if baseline else "")
    out.append(head + "\n|---|---|---|" + ("---|" if baseline else ""))
    for m in METRICS:
        v, n = rate(rows, m)
        line = f"| {LABEL[m]} | {pct(v)} | {n} |"
        if baseline:
            b, _ = rate(baseline, m)
            line += " — |" if v is None or b is None else f" {(v - b) * 100:+.0f} pts{' ⚠️' if v - b < -0.02 else ''} |"
        out.append(line)

    out.append("\n### By category (correctness · faithfulness)\n")
    out.append("| Category | Questions | Correctness | Faithfulness |\n|---|---|---|---|")
    by_cat = defaultdict(list)
    for r in rows:
        by_cat[r["category"]].append(r)
    for cat, rs in sorted(by_cat.items(), key=lambda kv: rate(kv[1], "correctness")[0] or 0):
        out.append(f"| {cat} | {len(rs)} | {pct(rate(rs, 'correctness')[0])} | {pct(rate(rs, 'faithfulness')[0])} |")

    fails = [r for r in rows if any(r.get(m, "").strip() == "0" for m in METRICS)]
    if fails:
        causes = defaultdict(int)
        for r in fails:
            causes[r.get("failure_cause") or "unclassified"] += 1
        out.append(f"\n### Failures by root cause · {len(fails)} questions\n")
        out.append("| Root cause → owner | Count |\n|---|---|")
        for c, n in sorted(causes.items(), key=lambda kv: -kv[1]):
            out.append(f"| {CAUSE.get(c, 'Not yet classified')} | {n} |")
        out.append("\n| ID | Category | Risk | Failed on | Note |\n|---|---|---|---|---|")
        for r in sorted(fails, key=lambda r: (r.get("risk") != "high", r["id"])):
            failed = ", ".join(LABEL[m] for m in METRICS if r.get(m, "").strip() == "0")
            out.append(f"| {r['id']} | {r['category']} | {r.get('risk', '')} | {failed} | {r.get('note', '')} |")
    return "\n".join(out) + "\n"


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("results")
    ap.add_argument("--baseline")
    a = ap.parse_args()
    print(report(load(a.results), load(a.baseline) if a.baseline else None))
