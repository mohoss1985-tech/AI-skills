"""Build Xray import files for Jira, for Xray Cloud and Xray Server / Data Center, from one spec.

    python3 build_xray.py spec.json [--flavor cloud|server|both] [--out xray-import]
    python3 build_xray.py --from-eval results.csv --project KEY [--plan KEY-1] [--flavor ...] [--out ...]

From a spec (see templates/xray_spec.json) it writes, per flavor:
  tests.csv          manual tests for the Test Case Importer (one row per step)
  features/*.feature Cucumber tests, one file per requirement, tagged with the requirement key
  results.json       Xray JSON execution results (only if the spec has an "execution" block)
  IMPORT.md          step-by-step import guide and API calls for that flavor

--from-eval turns a scored RAG evaluation CSV (the evaluating-rag-quality format) into an Xray JSON
execution: one Generic test per golden-set question, created on first import, PASSED only if every
scored metric passed.

The spec is validated first; nothing is written if it has errors.
"""

import argparse
import csv
import json
import re
import sys
from collections import OrderedDict
from pathlib import Path

KEY = re.compile(r"^[A-Z][A-Z0-9_]+-\d+$")
PROJECT = re.compile(r"^[A-Z][A-Z0-9_]+$")
TYPES = {"manual": "Manual", "cucumber": "Cucumber", "generic": "Generic"}
STATUS = {  # one vocabulary in the spec, the right word per flavor
    "cloud": {"passed": "PASSED", "failed": "FAILED", "todo": "TODO", "executing": "EXECUTING"},
    "server": {"passed": "PASS", "failed": "FAIL", "todo": "TODO", "executing": "EXECUTING"},
}
TYPE_FIELD = {"cloud": "type", "server": "testType"}  # testInfo field name differs
GHERKIN = re.compile(r"^\s*(Given|When|Then|And|But|\*|Examples:|\|)", re.I)
METRICS = ["context_recall", "context_precision", "faithfulness", "answer_relevance",
           "correctness", "citation_accuracy", "correct_refusal"]


# ---------- validation ----------
def validate(spec):
    errs = []
    if not PROJECT.match(spec.get("project", "")):
        errs.append('"project" must be a Jira project key, e.g. "LUM"')
    ids = set()
    for i, t in enumerate(spec.get("tests", []), 1):
        where = f'test {i} ({t.get("id", "no id")})'
        if not t.get("id"):
            errs.append(f"{where}: missing \"id\"")
        elif t["id"] in ids:
            errs.append(f"{where}: duplicate id")
        ids.add(t.get("id"))
        if t.get("type") not in TYPES:
            errs.append(f"{where}: type must be one of {', '.join(TYPES)}")
        if not (t.get("summary") or "").strip():
            errs.append(f"{where}: missing summary")
        if t.get("key") and not KEY.match(t["key"]):
            errs.append(f"{where}: key {t['key']!r} is not a Jira issue key")
        for r in t.get("requirements", []):
            if not KEY.match(r):
                errs.append(f"{where}: requirement {r!r} is not a Jira issue key")
        for lab in t.get("labels", []):
            if " " in lab:
                errs.append(f"{where}: label {lab!r} contains a space (Jira labels can't)")
        if t.get("type") == "manual":
            steps = t.get("steps") or []
            if not steps:
                errs.append(f"{where}: a manual test needs steps")
            for j, s in enumerate(steps, 1):
                if not (s.get("action") or "").strip():
                    errs.append(f"{where}, step {j}: missing action")
                if not (s.get("result") or "").strip():
                    errs.append(f"{where}, step {j}: missing expected result")
        if t.get("type") == "cucumber":
            lines = [l for l in (t.get("scenario") or "").splitlines() if l.strip()]
            if not lines:
                errs.append(f"{where}: a cucumber test needs a scenario")
            for l in lines:
                if not GHERKIN.match(l):
                    errs.append(f"{where}: not a Gherkin step: {l.strip()!r}")
        if t.get("type") == "generic" and not (t.get("definition") or "").strip():
            errs.append(f"{where}: a generic test needs a definition (the automated test's id)")
    ex = spec.get("execution")
    if ex:
        if ex.get("testExecutionKey") and not KEY.match(ex["testExecutionKey"]):
            errs.append("execution: testExecutionKey is not a Jira issue key")
        if ex.get("testPlanKey") and not KEY.match(ex["testPlanKey"]):
            errs.append("execution: testPlanKey is not a Jira issue key")
        tests = {t.get("id"): t for t in spec.get("tests", [])}
        for r in ex.get("results", []):
            if r.get("test") not in tests:
                errs.append(f"execution: result for unknown test {r.get('test')!r}")
            if r.get("status") not in STATUS["cloud"]:
                errs.append(f"execution: status {r.get('status')!r} must be passed, failed, todo or executing")
            t = tests.get(r.get("test"), {})
            if r.get("steps") and len(r["steps"]) != len(t.get("steps") or []):
                errs.append(f"execution: {r.get('test')} has {len(r['steps'])} step results "
                            f"but {len(t.get('steps') or [])} steps")
    return errs


# ---------- writers ----------
def write_csv(spec, path):
    manual = [t for t in spec["tests"] if t["type"] == "manual"]
    if not manual:
        return 0
    n_req = max([len(t.get("requirements", [])) for t in manual] + [1])
    n_lab = max([len(t.get("labels", [])) for t in manual] + [1])
    head = (["Test ID", "Summary", "Description", "Test Type", "Priority", "Test Repository Path"]
            + ["Requirement"] * n_req + ["Labels"] * n_lab + ["Action", "Data", "Expected Result"])
    rows = [head]
    for t in manual:
        desc = (t.get("description") or "").strip()
        if t.get("precondition"):
            desc = (desc + "\n\n" if desc else "") + "Precondition: " + t["precondition"].strip()
        reqs = t.get("requirements", []) + [""] * (n_req - len(t.get("requirements", [])))
        labs = t.get("labels", []) + [""] * (n_lab - len(t.get("labels", [])))
        first = [t["id"], t["summary"], desc, "Manual", t.get("priority", ""),
                 t.get("folder") or spec.get("folder", "")] + reqs + labs
        blank = [t["id"]] + [""] * (len(first) - 1)
        for j, s in enumerate(t["steps"]):
            rows.append((first if j == 0 else blank) + [s["action"], s.get("data", ""), s["result"]])
    with open(path, "w", newline="", encoding="utf-8") as f:
        csv.writer(f).writerows(rows)
    return len(manual)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:50] or "tests"


def write_features(spec, folder):
    groups = OrderedDict()
    for t in spec["tests"]:
        if t["type"] == "cucumber":
            groups.setdefault((t.get("requirements") or [None])[0], []).append(t)
    for req, tests in groups.items():
        name = spec.get("features", {}).get(req or "", tests[0]["summary"])
        out = []
        if req:
            out.append(f"@{req}")  # tag before Feature: links every test in the file to the requirement
        out.append(f"Feature: {name}")
        bg = spec.get("background", {}).get(req or "")
        if bg:
            out += ["", "  Background:"] + [f"    {l.strip()}" for l in bg.splitlines() if l.strip()]
        for t in tests:
            tags = [f"@{t['key']}"] if t.get("key") else []
            tags += [f"@{r}" for r in t.get("requirements", [])[1:]]
            tags += [f"@{l}" for l in t.get("labels", [])]
            kind = "Scenario Outline" if "Examples:" in t["scenario"] else "Scenario"
            out += [""] + ([f"  {' '.join(tags)}"] if tags else []) + [f"  {kind}: {t['summary']}"]
            for l in t["scenario"].splitlines():
                if l.strip():
                    indent = "      " if l.strip().startswith("|") else "    "
                    out.append(indent + l.strip())
        folder.mkdir(parents=True, exist_ok=True)
        (folder / f"{(req or 'no-requirement').lower()}-{slug(name)}.feature").write_text("\n".join(out) + "\n")
    return sum(len(v) for v in groups.values()), len(groups)


def test_info(spec, t, flavor):
    info = {"projectKey": spec["project"], "summary": t["summary"], TYPE_FIELD[flavor]: TYPES[t["type"]]}
    if t.get("requirements"):
        info["requirementKeys"] = t["requirements"]
    if t.get("labels"):
        info["labels"] = t["labels"]
    if t["type"] == "manual":
        info["steps"] = [{"action": s["action"], "data": s.get("data", ""), "result": s["result"]} for s in t["steps"]]
    elif t["type"] == "cucumber":
        info["scenario"] = "\n".join(l.strip() for l in t["scenario"].splitlines() if l.strip())
    else:
        info["definition"] = t["definition"]
    return info


def execution_json(spec, flavor):
    ex = spec["execution"]
    tests = {t["id"]: t for t in spec["tests"]}
    st = STATUS[flavor]
    doc = {}
    if ex.get("testExecutionKey"):
        doc["testExecutionKey"] = ex["testExecutionKey"]
    info = {"project": spec["project"]}
    for k_in, k_out in [("summary", "summary"), ("description", "description"), ("version", "version"),
                        ("revision", "revision"), ("start", "startDate"), ("finish", "finishDate"),
                        ("testPlanKey", "testPlanKey")]:
        if ex.get(k_in):
            info[k_out] = ex[k_in]
    if ex.get("environments"):
        info["testEnvironments"] = ex["environments"]
    doc["info"] = info
    doc["tests"] = []
    for r in ex["results"]:
        t = tests[r["test"]]
        item = {"testKey": t["key"]} if t.get("key") else {"testInfo": test_info(spec, t, flavor)}
        item["status"] = st[r["status"]]
        if r.get("comment"):
            item["comment"] = r["comment"]
        if r.get("steps"):
            item["steps"] = [{"status": st[s]} if isinstance(s, str) else
                             {"status": st[s["status"]], **{k: v for k, v in s.items() if k in ("comment", "actualResult")}}
                             for s in r["steps"]]
        if r.get("defects"):
            item["defects"] = r["defects"]
        doc["tests"].append(item)
    return doc


def import_guide(spec, flavor, counts):
    p = spec["project"]
    base = ("https://xray.cloud.getxray.app/api/v2" if flavor == "cloud" else "https://YOUR-JIRA/rest/raven")
    auth = ('-H "Authorization: Bearer $XRAY_TOKEN"' if flavor == "cloud" else '-H "Authorization: Bearer $JIRA_PAT"')
    feat_url = f"{base}/import/feature?projectKey={p}" if flavor == "cloud" else f"{base}/1.0/import/feature?projectKey={p}"
    exec_url = f"{base}/import/execution" if flavor == "cloud" else f"{base}/2.0/import/execution"
    title = "Xray Cloud" if flavor == "cloud" else "Xray Server / Data Center"
    login = ("# get a token (valid 24 h)\nexport XRAY_TOKEN=$(curl -s -H \"Content-Type: application/json\" -X POST "
             "--data '{\"client_id\":\"'$XRAY_CLIENT_ID'\",\"client_secret\":\"'$XRAY_CLIENT_SECRET'\"}' "
             f"{base}/authenticate | tr -d '\"')" if flavor == "cloud" else
             "# JIRA_PAT = a Jira personal access token (Profile › Personal Access Tokens)")
    g = [f"# Import guide · {title} · project {p}", ""]
    n_csv, n_feat, n_files, n_res = counts
    step = 1
    if n_csv:
        g += [f"## {step}. Manual tests ({n_csv}) · `tests.csv`", "",
              "Jira › Xray › **Test Case Importer** › CSV. Delimiter `,`, encoding UTF-8. "
              "Tick **Create folders** if the repository folders don't exist yet.", "",
              "| CSV column | Map to |", "|---|---|",
              "| Test ID | Test Case Identifier (groups the step rows of one test) |",
              "| Summary | Summary |", "| Description | Description |", "| Test Type | Test Type |",
              "| Priority | Priority |", "| Test Repository Path | Test Repository Path |",
              "| Requirement (each column) | Link \"Tests\" |", "| Labels (each column) | Labels |",
              "| Action · Data · Expected Result | " + ("Action · Data · Expected Result" if flavor == "cloud" else "Step · Data · Expected Result (named Action in recent versions)") + " |",
              "", "Save the mapping as a configuration file at the end: next imports take one click.", ""]
        step += 1
    if n_feat:
        g += [f"## {step}. Cucumber tests ({n_feat} in {n_files} file{'s' if n_files > 1 else ''}) · `features/`", "",
              "Each `.feature` file is tagged with its requirement key, so Xray links the tests to the story. "
              "A `Background` becomes a Precondition. Scenarios tagged with an existing test key update that test.", "",
              "```bash", login,
              f'curl -H "Content-Type: multipart/form-data" {auth} -F "file=@features/<file>.feature" "{feat_url}"',
              "```", "", "No API access? Zip the `features` folder and use **Import Cucumber Tests** in the Xray menu "
              "(Test Repository or the Xray project page).", ""]
        step += 1
    if n_res:
        tests = {t["id"]: t for t in spec["tests"]}
        dup = [r["test"] for r in spec["execution"]["results"]
               if not tests[r["test"]].get("key") and tests[r["test"]]["type"] in ("manual", "cucumber")]
        g += [f"## {step}. Execution results ({n_res} tests) · `results.json`", "",
              f"Statuses use the {title} vocabulary ({', '.join(STATUS[flavor].values())}). "
              "Tests without a key are created by this import.", ""]
        if dup and (n_csv or n_feat):
            g += [f"> ⚠️ **Avoid duplicates.** {', '.join(dup)} are also in the files above but have no Jira key yet. "
                  "Pick one route: **(A)** import the tests first, copy the keys Xray gives them into the spec "
                  f"(`\"key\": \"{p}-…\"`), rebuild, then import `results.json`; or **(B)** skip the steps above "
                  "and let `results.json` create the tests with their results in one go.", ""]
        g += ["```bash"] + ([] if n_feat else [login]) + [f'curl -H "Content-Type: application/json" {auth} --data @results.json "{exec_url}"', "```", "",
              "Then check the Test Execution in Jira: every test listed, statuses right, defects linked.", "",
              "No API access? Open the Test Execution › **Import Execution Results** › Xray JSON.", ""]
    g += ["## Before importing", "", f"- Requirement keys and project `{p}` exist and you can create Test issues in it.",
          "- Try with 2 or 3 tests first, check them in Jira, then import the rest.",
          "- Never paste a token or secret into a file you share: use environment variables as above.", ""]
    return "\n".join(g)


def build(spec, flavors, out):
    errs = validate(spec)
    if errs:
        print("Spec has errors, nothing written:\n- " + "\n- ".join(errs), file=sys.stderr)
        sys.exit(1)
    for fl in flavors:
        d = out / fl if len(flavors) > 1 else out
        d.mkdir(parents=True, exist_ok=True)
        n_csv = write_csv(spec, d / "tests.csv")
        n_feat, n_files = write_features(spec, d / "features")
        n_res = 0
        if spec.get("execution"):
            doc = execution_json(spec, fl)
            (d / "results.json").write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
            n_res = len(doc["tests"])
        (d / "IMPORT.md").write_text(import_guide(spec, fl, (n_csv, n_feat, n_files, n_res)))
        print(f"{fl}: {n_csv} manual tests in tests.csv, {n_feat} cucumber tests in {n_files} feature file(s), "
              f"{n_res} results in results.json → {d}")


def spec_from_eval(path, project, plan, summary):
    """Scored golden set (evaluating-rag-quality CSV) → spec with one Generic test per question."""
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    tests, results = [], []
    for r in rows:
        failed = [m for m in METRICS if r.get(m, "").strip() == "0"]
        cat = slug(r.get("category", "rag"))
        tests.append({"id": r["id"], "type": "generic", "key": r.get("xray_key") or None,
                      "summary": f"RAG eval · {r['id']} · {r.get('category', '')}".strip(" ·"),
                      "definition": f"rag-eval.{r['id']}", "labels": ["rag-eval", cat, f"risk-{r.get('risk', 'na')}"],
                      "requirements": [k for k in (r.get("requirement") or "").split() if k]})
        comment = ("Failed on: " + ", ".join(failed) + (f". Cause: {r['failure_cause']}" if r.get("failure_cause") else "")
                   + (f". {r['note']}" if r.get("note") else "")) if failed else "All scored metrics passed."
        results.append({"test": r["id"], "status": "failed" if failed else "passed", "comment": comment})
    return {"project": project, "tests": tests,
            "execution": {"summary": summary, "testPlanKey": plan, "results": results}}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("spec", nargs="?")
    ap.add_argument("--from-eval")
    ap.add_argument("--project")
    ap.add_argument("--plan")
    ap.add_argument("--summary", default="RAG evaluation run")
    ap.add_argument("--flavor", choices=["cloud", "server", "both"])
    ap.add_argument("--out", default="xray-import")
    a = ap.parse_args()
    if a.from_eval:
        if not a.project:
            ap.error("--from-eval needs --project")
        spec = spec_from_eval(a.from_eval, a.project, a.plan, a.summary)
    elif a.spec:
        spec = json.loads(Path(a.spec).read_text())
    else:
        ap.error("give a spec.json or --from-eval results.csv")
    flavor = a.flavor or spec.get("flavor", "both")
    build(spec, ["cloud", "server"] if flavor == "both" else [flavor], Path(a.out))
