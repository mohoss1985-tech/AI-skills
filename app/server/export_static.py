"""Export Analyst Kit as a static demo (for GitHub Pages or any static host).

    python3 app/server/export_static.py dist

Copies the front end (app/web), writes the skills, questions, scenarios and finished samples as JSON files,
and switches the page to demo mode by writing config.js (window.KIT_DEMO): everything can be browsed,
tools run in the browser (LocalStore), nothing is sent anywhere. Does not open the database or start the server.

Writes (V2):
  config.js                 window.KIT_DEMO = {repo, version}   (truthy = demo mode)
  data/catalog.json         {types, groups}  (same as GET /api/catalog)
  data/state.json           V1 shape + workspaces: []  (same as GET /api/state)
  data/requests/<n>.json    the finished samples
  data/samples/<tool>.json  copied from web/js/tools/<tool>/samples.json when the tool ships one
  data/samples/index.json   ["api-tester", ...] tools that have one
"""

import json
import shutil
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from catalog import DEFAULT_PROFILE, groups_payload, types_payload  # noqa: E402
from db import APP_DIR, load_seed  # noqa: E402
from toolreg import TOOLS  # noqa: E402

STATIC_DIR = APP_DIR / "web"
REPO = "https://github.com/mohoss1985-tech/AI-skills"
VERSION = "2.0.0-dev"
TOOLS_DIR = STATIC_DIR / "js" / "tools"


def export_samples(out):
    """data/samples/<tool>.json from each tool's samples.json (validated JSON). Returns the tool ids."""
    folder = out / "data" / "samples"
    folder.mkdir(parents=True, exist_ok=True)
    done = []
    for tool in sorted(TOOLS or [p.name for p in TOOLS_DIR.iterdir() if p.is_dir()]):
        src = TOOLS_DIR / tool / "samples.json"
        if not src.is_file():
            continue
        try:
            data = json.loads(src.read_text())
        except ValueError as e:
            print(f"  skipped {src}: not valid JSON ({e})", file=sys.stderr)
            continue
        (folder / f"{tool}.json").write_text(json.dumps(data, ensure_ascii=False))
        done.append(tool)
    (folder / "index.json").write_text(json.dumps(done))
    return done


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "dist").resolve()
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(STATIC_DIR, out)
    (out / "data" / "requests").mkdir(parents=True)

    seeds = load_seed()
    now = time.time()
    requests = []
    for i, s in enumerate(seeds, start=1):
        t = now - (len(seeds) - i) * 3600 * 2
        full = {"id": i, "type": s["skill"], "client": s.get("client", ""), "title": s["title"], "notes": s["input"],
                "output": s["output"], "answers": {}, "status": "ready", "is_sample": 1, "lang": s.get("lang", ""),
                "created_at": t, "updated_at": t, "sent_at": None, "unseen": 0, "changes": "",
                "messages": [], "versions": [], "sources": [], "knowledge": []}
        (out / "data" / "requests" / f"{i}.json").write_text(json.dumps(full, ensure_ascii=False))
        requests.append({k: full[k] for k in ("id", "type", "client", "title", "status", "is_sample", "lang",
                                               "created_at", "updated_at", "sent_at", "unseen")}
                        | {"unread": 0, "awaiting_reply": False})
    requests.sort(key=lambda r: -r["updated_at"])
    state = {"types": types_payload(), "groups": groups_payload(), "requests": requests,
             "claude_online": False, "chat_unread": 0, "profile": dict(DEFAULT_PROFILE), "learned": [],
             "clients": [], "workspaces": [], "demo": {"repo": REPO, "version": VERSION}}
    (out / "data" / "state.json").write_text(json.dumps(state, ensure_ascii=False))
    (out / "data" / "catalog.json").write_text(
        json.dumps({"types": types_payload(), "groups": groups_payload()}, ensure_ascii=False))
    samples = export_samples(out)

    # Demo switch: config.js replaces the local one (which sets KIT_DEMO to null).
    (out / "config.js").write_text(
        "// Written by app/server/export_static.py: static demo mode.\n"
        f"window.KIT_DEMO = {{ repo: {json.dumps(REPO)}, version: {json.dumps(VERSION)} }};\n")
    (out / ".nojekyll").write_text("")  # serve files as they are on GitHub Pages
    print(f"Exported {len(requests)} samples, {len(state['types'])} skills and {len(samples)} tool sample files to {out}")


if __name__ == "__main__":
    main()
