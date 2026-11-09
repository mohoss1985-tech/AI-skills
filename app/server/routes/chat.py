"""General chat with Claude (messages with request_id NULL)."""

from common import thread
from router import ApiError, route


@route("GET", r"/api/chat")
def get_chat(h, conn, m, body):
    return h.send_json({"messages": thread(conn, None)})


@route("POST", r"/api/chat")
def post_chat(h, conn, m, body):
    text = (body.get("body") or "").strip()
    if not text:
        raise ApiError(400, "validation.message_empty", "Write a message first.")
    cur = conn.execute("INSERT INTO messages (request_id,role,body,created_at) VALUES (NULL,'user',?,?)",
                       (text[:20000], h.now))
    return h.send_json({"ok": True, "id": cur.lastrowid}, 201)
