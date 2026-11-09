"""Draft: export V1 at / and V2 at /v2/ in one GitHub Pages artifact.

Assumed layout (decided in DESIGN_SPEC; this draft assumes V2 lives beside V1):
    app/        V1 - untouched (server.py, export_static.py, static/)
    app_v2/     V2 - server.py (port 4318), static/, export_static.py with the same signature

Workflow change (.github/workflows/pages.yml, "build" job) - replace the single run line with:
      - run: python3 app/export_static.py dist
      - run: python3 app_v2/export_static.py dist/v2
      - run: python3 app_v2/smoke_static.py dist/v2      # optional: fails the build if a sample file is missing
Nothing else changes: upload-pages-artifact still uploads dist/, so
    https://mohoss1985-tech.github.io/AI-skills/      -> V1 (unchanged)
    https://mohoss1985-tech.github.io/AI-skills/v2/   -> V2

Rules that make this work:
- V1's exporter does rmtree(dist) first, so it must run before V2's.
- V2 front end uses only RELATIVE URLs (fetch('data/state.json'), not '/data/...'); hash routing (#/tool/api)
  so GitHub Pages never needs a server-side rewrite.
- Each version keeps its own localStorage keys prefix ('kit-' for V1, 'kit2-' for V2): same origin, shared storage.
- A banner link "Try V2" is injected into V1's exported index.html ONLY (not into app/static), so V1 source stays untouched.
"""

import json
import shutil
import sys
from pathlib import Path

import server  # app_v2/server.py

REPO = "https://github.com/mohoss1985-tech/AI-skills"


def main():
    out = Path(sys.argv[1] if len(sys.argv) > 1 else "dist/v2").resolve()
    if out.exists():
        shutil.rmtree(out)
    shutil.copytree(server.STATIC_DIR, out)
    data = out / "data"
    data.mkdir(exist_ok=True)
    # 1. same JSON snapshot approach as V1 (state.json + requests/<id>.json) - reuse V1 code paths
    # 2. tool samples: API test cases, SQL seed, BPMN files, WSJF tables ... copied as static files
    shutil.copytree(server.ROOT / "samples", data / "samples", dirs_exist_ok=True)
    (data / "state.json").write_text(json.dumps(server.demo_state(REPO), ensure_ascii=False))
    index = out / "index.html"
    index.write_text(index.read_text().replace(
        "<!--KIT_DEMO-->", f"<script>window.KIT_DEMO = {{ repo: {json.dumps(REPO)}, version: 2 }};</script>"))

    # Cross-link from V1's exported page (dist/index.html), only in the published copy.
    v1 = out.parent / "index.html"
    if v1.exists() and "data-v2-link" not in v1.read_text():
        v1.write_text(v1.read_text().replace(
            "<body>", '<body>\n<a data-v2-link href="v2/" style="position:fixed;top:8px;right:12px;z-index:50">'
                      'Analyst Kit V2 &rarr;</a>', 1))
    print(f"Exported V2 to {out}")


if __name__ == "__main__":
    main()
