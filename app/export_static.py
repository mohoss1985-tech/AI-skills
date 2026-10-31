"""Export Analyst Kit as a read-only static demo (for GitHub Pages or any static host).

    python3 app/export_static.py dist
    sh app/publish_demo.sh          # build and publish to the gh-pages branch (GitHub Pages)

Copies the front end, writes the skills, questions, scenarios and finished samples as JSON files,
and switches the page to demo mode: everything can be browsed, nothing is sent anywhere.
"""

import json
import shutil
import sys
import time
from pathlib import Path

import server

REPO = "https://github.com/mohoss1985-tech/AI-skills"


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "dist").resolve()
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(server.STATIC_DIR, out)
    (out / "data" / "requests").mkdir(parents=True)

    seeds = server.load_seed()
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
    state = {"types": server.types_payload(), "groups": server.groups_payload(), "requests": requests,
             "claude_online": False, "chat_unread": 0, "profile": dict(server.DEFAULT_PROFILE), "learned": [],
             "clients": [], "demo": {"repo": REPO}}
    (out / "data" / "state.json").write_text(json.dumps(state, ensure_ascii=False))

    index = out / "index.html"
    index.write_text(index.read_text().replace(
        "<script src=\"i18n.js\"></script>",
        f"<script>window.KIT_DEMO = {{ repo: {json.dumps(REPO)} }};</script>\n<script src=\"i18n.js\"></script>"))
    (out / ".nojekyll").write_text("")  # serve files as they are on GitHub Pages
    print(f"Exported {len(requests)} samples and {len(state['types'])} skills to {out}")


if __name__ == "__main__":
    main()
