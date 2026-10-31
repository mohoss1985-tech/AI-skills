#!/usr/bin/env python3
"""Rank features by WSJF, fit them into a PI capacity and write a Jira CSV import.

Usage:
  python3 wsjf.py features.csv --capacity 120 [--project PAY] [--jira-csv jira-import.csv] [--json]

Input columns: id, title, type, business_value, time_criticality, risk_reduction,
job_size, points, depends_on (ids separated by ;), deadline (in-pi | next-pi | empty).
WSJF = (business_value + time_criticality + risk_reduction) / job_size.
"""
import argparse
import csv
import json
import sys

FIB = {1, 2, 3, 5, 8, 13, 20}


def load(path):
    rows, errors = [], []
    with open(path, newline="", encoding="utf-8-sig") as f:
        for n, r in enumerate(csv.DictReader(f), start=2):
            r = {k.strip(): (v or "").strip() for k, v in r.items()}
            for c in ("business_value", "time_criticality", "risk_reduction", "job_size"):
                try:
                    r[c] = int(r[c])
                except (KeyError, ValueError):
                    errors.append(f"line {n} ({r.get('id', '?')}): {c} must be a number")
                    r[c] = 1
                else:
                    if r[c] not in FIB:
                        errors.append(f"line {n} ({r['id']}): {c}={r[c]} is not on the scale 1,2,3,5,8,13,20")
            try:
                r["points"] = int(r.get("points") or 0)
            except ValueError:
                errors.append(f"line {n} ({r['id']}): points must be a number")
                r["points"] = 0
            r["depends_on"] = [d.strip() for d in r.get("depends_on", "").split(";") if d.strip()]
            r["cod"] = r["business_value"] + r["time_criticality"] + r["risk_reduction"]
            r["wsjf"] = round(r["cod"] / r["job_size"], 2)
            rows.append(r)
    ids = {r["id"] for r in rows}
    for r in rows:
        for d in r["depends_on"]:
            if d not in ids:
                errors.append(f"{r['id']}: depends on unknown item {d}")
    return rows, errors


def plan(rows, capacity):
    # Rank by WSJF, ties broken by in-PI deadline, then smaller job size.
    ranked = sorted(rows, key=lambda r: (-r["wsjf"], r.get("deadline") != "in-pi", r["job_size"]))
    by_id = {r["id"]: r for r in rows}
    planned, used = [], 0

    def closure(r, seen=()):
        """The item plus its not-yet-planned dependencies, dependencies first (None on a cycle)."""
        if r["id"] in seen:
            return None
        out = []
        for d in r["depends_on"]:
            dep = by_id[d]
            if dep in planned or dep in out:
                continue
            sub = closure(dep, seen + (r["id"],))
            if sub is None:
                return None
            out += [x for x in sub if x not in out]
        return out + [r]

    # In rank order, an item enters with the dependencies it needs, if they all fit together.
    for r in ranked:
        if r in planned:
            continue
        group = closure(r)
        need = sum(x["points"] for x in group) if group else None
        if group and used + need <= capacity:
            planned += group
            used += need
    out = []
    for r in ranked:
        if r in planned:
            continue
        group = closure(r)
        if group is None:
            why = "circular dependency"
        else:
            extra = [x["id"] for x in group if x is not r]
            need = sum(x["points"] for x in group)
            why = f"no capacity left ({capacity - used} pts free, needs {need}" + (f" with {', '.join(extra)})" if extra else ")")
        out.append((r, why))
    return ranked, planned, used, out


def jira_csv(path, rows, planned_ids, project):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, lineterminator="\n")
        w.writerow(["Summary", "Issue Type", "Description", "Labels", "Labels", "Story Points"])
        for r in rows:
            desc = (f"WSJF {r['wsjf']} (BV {r['business_value']} + TC {r['time_criticality']} + "
                    f"RR {r['risk_reduction']}) / size {r['job_size']}. Ref {r['id']}.")
            if r["depends_on"]:
                desc += " Depends on: " + ", ".join(r["depends_on"]) + "."
            w.writerow([r["title"], r.get("type") or "Story", desc,
                        "PI-committed" if r["id"] in planned_ids else "PI-candidate",
                        f"{project}-WSJF", r["points"] or ""])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("features")
    ap.add_argument("--capacity", type=int, required=True, help="story points available for features in the PI")
    ap.add_argument("--project", default="PROJ")
    ap.add_argument("--jira-csv")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args()

    rows, errors = load(a.features)
    if errors:
        print("Fix the input first:\n- " + "\n- ".join(errors), file=sys.stderr)
        sys.exit(1)
    ranked, planned, used, out = plan(rows, a.capacity)
    pids = {p["id"] for p in planned}
    late = [r for r, _ in out if r.get("deadline") == "in-pi"]

    if a.json:
        print(json.dumps({"ranked": [{k: r[k] for k in ("id", "title", "cod", "job_size", "wsjf", "points")} for r in ranked],
                          "planned": [p["id"] for p in planned], "used": used, "capacity": a.capacity,
                          "not_planned": {r["id"]: why for r, why in out}, "deadline_missed": [r["id"] for r in late]}, indent=2))
    else:
        print(f"| Rank | ID | Feature | BV | TC | RR | Size | WSJF | Points | PI |")
        print("|---|---|---|---|---|---|---|---|---|---|")
        for i, r in enumerate(ranked, 1):
            print(f"| {i} | {r['id']} | {r['title']} | {r['business_value']} | {r['time_criticality']} | "
                  f"{r['risk_reduction']} | {r['job_size']} | **{r['wsjf']}** | {r['points']} | "
                  f"{'✅ in' if r['id'] in pids else '— out'} |")
        print(f"\nCapacity used: {used} / {a.capacity} points ({round(100 * used / a.capacity)}%).")
        for r, why in out:
            print(f"- Not planned: {r['id']} {r['title']}: {why}")
        for r in late:
            print(f"- ⚠️ DEADLINE: {r['id']} must be delivered in this PI but is not planned. Decide: add capacity, cut scope or drop another feature.")
    if a.jira_csv:
        jira_csv(a.jira_csv, ranked, pids, a.project)
        print(f"\nJira CSV written: {a.jira_csv} ({len(ranked)} rows)", file=sys.stderr)


if __name__ == "__main__":
    main()
