"""Tool ids known to the server, read from the front end's registry (web/js/tools/registry.js), the single list.

    TOOLS = {"api-tester": "testing-apis", ...}   # tool id -> skill (= deliverable type)
"""

import re

from db import APP_DIR

REGISTRY_JS = APP_DIR / "web" / "js" / "tools" / "registry.js"
_ENTRY = re.compile(r"""\{\s*id:\s*['"]([a-z0-9-]+)['"]\s*,\s*skill:\s*['"]([a-z0-9-]+)['"]""")


def load():
    try:
        return dict(_ENTRY.findall(REGISTRY_JS.read_text()))
    except OSError:
        return {}


TOOLS = load()
