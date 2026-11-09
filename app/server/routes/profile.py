"""POST /api/profile: the user's profile and the notes Claude learned."""

from catalog import DEFAULT_PROFILE
from db import set_meta
from router import route


@route("POST", r"/api/profile")
def post_profile(h, conn, m, body):
    profile = {k: str(body.get(k, "")).strip()[:120] for k in DEFAULT_PROFILE}
    set_meta(conn, "profile", profile)
    if isinstance(body.get("learned"), list):
        set_meta(conn, "learned", [str(x)[:300] for x in body["learned"]][:50])
    return h.send_json({"ok": True})
