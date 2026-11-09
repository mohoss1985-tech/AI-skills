"""GET /api/config: what the page needs before its first write (the per-boot X-Kit-Token).

Readable only same-origin: no CORS headers, and security.check_origin refuses foreign Origins and
Sec-Fetch-Site: cross-site. Never put the token in a <script>-loadable file (config.js), which any
page could include cross-origin.
"""

import security
from router import route

VERSION = "2.0.0-dev"


@route("GET", r"/api/config", db=False)
def get_config(h, conn, m, body):
    return h.send_json({"token": security.TOKEN, "version": VERSION, "demo": False,
                        "token_header": "X-Kit-Token"})
