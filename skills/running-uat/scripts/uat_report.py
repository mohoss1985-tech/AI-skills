#!/usr/bin/env python3
"""UAT (recette) progress and exit criteria from test execution and defect exports.

Usage:
  python3 uat_report.py executions.csv [--defects defects.csv] [--planned 120] [--days 10 --day 8]
                        [--today 2026-11-12] [--pass-rate 95] [--json]

Accepts Jira, Xray, Squash and HP ALM column names, in English or French.
executions.csv: one row per test case (latest run): test id, status, feature, requirement.
defects.csv: one row per defect: key, severity (or priority), status, created, feature, workaround.
"""
import argparse
import csv
import json
import sys
from collections import Counter, defaultdict
from datetime import date, datetime

COLS = {
    "test": ["test", "test key", "test id", "test case", "cas de test", "id", "key", "clé", "name", "nom"],
    "status": ["status", "statut", "execution status", "test run status", "résultat", "result", "état", "etat"],
    "feature": ["feature", "fonctionnalité", "fonctionnalite", "component", "components", "composant", "module", "folder", "dossier", "epic"],
    "requirement": ["requirement", "requirements", "exigence", "exigences", "story", "user story", "covers", "linked issues"],
    "key": ["key", "issue key", "clé", "id", "defect id", "anomalie", "defect"],
    "severity": ["severity", "sévérité", "severite", "gravité", "gravite", "priority", "priorité", "priorite"],
    "created": ["created", "créé", "cree", "creation date", "date de création", "detected on date", "date"],
    "workaround": ["workaround", "contournement", "solution de contournement"],
    "summary": ["summary", "résumé", "resume", "titre", "title"],
}
RUN = {"PASS": "passed", "PASSED": "passed", "OK": "passed", "SUCCESS": "passed", "SUCCÈS": "passed", "SUCCES": "passed",
       "RÉUSSI": "passed", "REUSSI": "passed", "FAIL": "failed", "FAILED": "failed", "KO": "failed", "ÉCHEC": "failed",
       "ECHEC": "failed", "BLOCKED": "blocked", "BLOQUÉ": "blocked", "BLOQUE": "blocked", "TODO": "not run",
       "NOT RUN": "not run", "NO RUN": "not run", "NON EXÉCUTÉ": "not run", "NON EXECUTE": "not run", "READY": "not run",
       "EXECUTING": "not run", "EN COURS": "not run", "UNTESTABLE": "blocked", "N/A": "not run", "": "not run"}
SEV = {"blocker": "blocking", "blocking": "blocking", "bloquant": "blocking", "bloquante": "blocking", "critical": "blocking",
       "critique": "blocking", "highest": "blocking", "major": "major", "majeur": "major", "majeure": "major", "high": "major",
       "haute": "major", "minor": "minor", "mineur": "minor", "mineure": "minor", "medium": "minor", "moyenne": "minor",
       "low": "minor", "lowest": "minor", "basse": "minor", "trivial": "minor", "cosmetic": "minor",
       "enhancement": "enhancement", "évolution": "enhancement", "evolution": "enhancement"}
CLOSED = {"closed", "done", "clos", "close", "fermé", "ferme", "fermée", "validated", "validé", "verified", "terminé"}
REJECTED = {"rejected", "rejeté", "rejete", "not a bug", "won't fix", "wont fix", "duplicate", "doublon", "cancelled", "annulé"}
RETEST = {"resolved", "fixed", "ready for retest", "to retest", "à retester", "a retester", "corrigé", "corrige", "livré", "delivered", "in test"}


def read(path, wanted):
    with open(path, newline="", encoding="utf-8-sig") as f:
        sample = f.read(4096); f.seek(0)
        dialect = csv.Sniffer().sniff(sample, delimiters=",;\t")
        rows = list(csv.DictReader(f, dialect=dialect))
    if not rows:
        sys.exit(f"{path}: no rows")
    headers = {h.strip().lower(): h for h in rows[0]}
    found = {}
    for k in wanted:
        for name in COLS[k]:
            if name in headers:
                found[k] = headers[name]; break
    return rows, found


def parse_date(s):
    s = (s or "").strip()
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d/%b/%y %I:%M %p", "%d/%b/%y"):  # ISO, French, Jira export
        for part in (s, s[:10], s.split(" ")[0]):
            try:
                return datetime.strptime(part, fmt).date()
            except ValueError:
                continue
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("executions")
    ap.add_argument("--defects")
    ap.add_argument("--planned", type=int, help="test cases planned for the campaign (default: rows in executions)")
    ap.add_argument("--days", type=int, help="campaign length in working days")
    ap.add_argument("--day", type=int, help="current campaign day")
    ap.add_argument("--today", help="YYYY-MM-DD, for defect ageing (default: latest created date)")
    ap.add_argument("--pass-rate", type=float, default=95.0, help="exit criterion, %% of planned tests passed")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    ex, c = read(a.executions, ["test", "status", "feature", "requirement"])
    if "status" not in c:
        sys.exit(f"{a.executions}: no status column (expected one of {COLS['status']})")
    unknown = Counter()
    runs = []
    for r in ex:
        raw = (r.get(c["status"]) or "").strip().upper()
        st = RUN.get(raw)
        if st is None:
            unknown[raw] += 1; st = "not run"
        runs.append({"test": r.get(c.get("test"), ""), "status": st,
                     "feature": (r.get(c.get("feature")) or "—").strip() or "—",
                     "reqs": [x.strip() for x in (r.get(c.get("requirement")) or "").replace(";", ",").split(",") if x.strip()]})
    planned = a.planned or len(runs)
    s = Counter(r["status"] for r in runs)
    executed = s["passed"] + s["failed"]
    res = {"planned": planned, "in_export": len(runs), "passed": s["passed"], "failed": s["failed"],
           "blocked": s["blocked"], "not_run": s["not run"] + max(0, planned - len(runs)),
           "executed_pct": round(100 * executed / planned, 1), "passed_pct": round(100 * s["passed"] / planned, 1),
           "pass_rate_of_executed": round(100 * s["passed"] / executed, 1) if executed else 0.0}
    if a.days and a.day:
        res["expected_executed_pct"] = round(100 * a.day / a.days, 1)
        res["schedule_gap_pts"] = round(res["executed_pct"] - res["expected_executed_pct"], 1)

    feats = defaultdict(Counter)
    for r in runs:
        feats[r["feature"]][r["status"]] += 1
    reqs = defaultdict(set)
    for r in runs:
        for q in r["reqs"]:
            reqs[q].add(r["status"])
    res["requirements"] = {"total": len(reqs), "covered_passed": sum("passed" in v for v in reqs.values()),
                           "not_passed": sorted(q for q, v in reqs.items() if "passed" not in v)}

    crit = [("All planned tests run", res["not_run"] == 0 and res["blocked"] == 0,
             f"{executed}/{planned} run, {res['blocked']} blocked"),
            (f"≥ {a.pass_rate:g}% of planned tests passed", res["passed_pct"] >= a.pass_rate, f"{res['passed_pct']}%")]
    if reqs:
        crit.append(("Every requirement has a passed test", not res["requirements"]["not_passed"],
                     f"{res['requirements']['covered_passed']}/{len(reqs)}"))

    defects = []
    if a.defects:
        dr, dc = read(a.defects, ["key", "severity", "status", "created", "feature", "workaround", "summary"])
        dates = [parse_date(r.get(dc.get("created"))) for r in dr]
        today = date.fromisoformat(a.today) if a.today else max([d for d in dates if d] or [date.today()])
        for r, d in zip(dr, dates):
            st = (r.get(dc.get("status")) or "").strip().lower()
            state = "rejected" if st in REJECTED else "closed" if st in CLOSED else "retest" if st in RETEST else "open"
            sev_raw = (r.get(dc.get("severity")) or "").strip().lower()
            wa = (r.get(dc.get("workaround")) or "").strip().lower()
            defects.append({"key": r.get(dc.get("key"), ""), "summary": (r.get(dc.get("summary")) or "").strip(),
                            "severity": SEV.get(sev_raw, "unknown:" + sev_raw), "state": state,
                            "feature": (r.get(dc.get("feature")) or "—").strip() or "—",
                            "age": (today - d).days if d else None,
                            "workaround": wa in {"yes", "y", "oui", "true", "1", "accepted", "accepté", "accepte"}})
        live = [d for d in defects if d["state"] in ("open", "retest")]
        bysev = Counter(d["severity"] for d in live)
        res["defects"] = {"total": len(defects), "open": sum(d["state"] == "open" for d in defects),
                          "waiting_retest": sum(d["state"] == "retest" for d in defects),
                          "closed": sum(d["state"] == "closed" for d in defects),
                          "rejected": sum(d["state"] == "rejected" for d in defects),
                          "live_by_severity": dict(bysev),
                          "oldest_live": sorted([d for d in live if d["age"] is not None], key=lambda d: -d["age"])[:5],
                          "by_feature": dict(Counter(d["feature"] for d in live))}
        major_nowa = [d for d in live if d["severity"] == "major" and not d["workaround"]]
        crit.append(("0 blocking defect open", bysev["blocking"] == 0, f"{bysev['blocking']} open or waiting re-test"))
        crit.append(("0 major defect without accepted workaround", not major_nowa,
                     ", ".join(d["key"] for d in major_nowa) or "none"))
        unk = sorted({d["severity"] for d in defects if d["severity"].startswith("unknown")})
        if unk:
            res["warnings"] = [f"unrecognised severities: {', '.join(unk)}"]
    if unknown:
        res.setdefault("warnings", []).append("unrecognised statuses counted as not run: " + ", ".join(f"{k or '(empty)'} ×{v}" for k, v in unknown.items()))
    res["exit_criteria"] = [{"criterion": n, "met": ok, "value": v} for n, ok, v in crit]
    res["exit_criteria_met"] = all(ok for _, ok, _ in crit)

    if a.json:
        print(json.dumps(res, indent=2, ensure_ascii=False)); return

    print("## Progress\n")
    print("| Planned | Run | Passed | Failed | Blocked | Not run | Run % | Passed % |")
    print("|---|---|---|---|---|---|---|---|")
    print(f"| {planned} | {executed} | {s['passed']} | {s['failed']} | {res['blocked']} | {res['not_run']} | {res['executed_pct']}% | {res['passed_pct']}% |")
    if "expected_executed_pct" in res:
        gap = res["schedule_gap_pts"]
        print(f"\nDay {a.day} of {a.days}: {res['expected_executed_pct']}% should be run, {res['executed_pct']}% is "
              f"({'ahead' if gap >= 0 else 'behind'} by {abs(gap)} points).")
    print("\n## By feature\n\n| Feature | Passed | Failed | Blocked | Not run |\n|---|---|---|---|---|")
    for f, cn in sorted(feats.items()):
        print(f"| {f} | {cn['passed']} | {cn['failed']} | {cn['blocked']} | {cn['not run']} |")
    if "defects" in res:
        d = res["defects"]
        print(f"\n## Defects\n\n{d['total']} raised: {d['open']} open, {d['waiting_retest']} waiting re-test, "
              f"{d['closed']} closed, {d['rejected']} rejected.\n")
        print("| Severity | Open or waiting re-test |\n|---|---|")
        for k in ("blocking", "major", "minor", "enhancement"):
            print(f"| {k} | {d['live_by_severity'].get(k, 0)} |")
        if d["oldest_live"]:
            print("\nOldest live defects: " + ", ".join(f"{x['key']} ({x['severity']}, {x['age']} d)" for x in d["oldest_live"]))
    print("\n## Exit criteria\n\n| Criterion | Status | Value |\n|---|---|---|")
    for e in res["exit_criteria"]:
        print(f"| {e['criterion']} | {'✅' if e['met'] else '❌'} | {e['value']} |")
    print(f"\n**Exit criteria {'MET' if res['exit_criteria_met'] else 'NOT MET'}.**")
    if res["requirements"]["not_passed"]:
        print("Requirements without a passed test: " + ", ".join(res["requirements"]["not_passed"]))
    for w in res.get("warnings", []):
        print(f"\n⚠️ {w}")


if __name__ == "__main__":
    main()
