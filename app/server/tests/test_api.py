"""Backend tests (stdlib unittest). Run:  python3 -m unittest discover -s app/server/tests -v

Each test class boots the real server in a thread on a free 127.0.0.1 port with a temporary database (KIT_DB)
and a fixed token (KIT_TOKEN).
"""

import http.client
import json
import os
import subprocess
import sys
import tempfile
import threading
import time
import unittest
from pathlib import Path

SERVER_DIR = Path(__file__).resolve().parent.parent
TMP = tempfile.mkdtemp(prefix="kit-test-")
os.environ["KIT_DB"] = str(Path(TMP) / "kit.db")
os.environ["KIT_TOKEN"] = "test-token"
sys.path.insert(0, str(SERVER_DIR))

import server  # noqa: E402

TOKEN = "test-token"


class Base(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.srv = server.make_server(port=0)
        cls.port = cls.srv.server_address[1]
        cls.thread = threading.Thread(target=cls.srv.serve_forever, daemon=True)
        cls.thread.start()

    @classmethod
    def tearDownClass(cls):
        cls.srv.shutdown()
        cls.srv.server_close()

    def req(self, method, path, body=None, headers=None, token=True, raw=None, host=None, conn=None):
        c = conn or http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        h = {"Host": host or f"127.0.0.1:{self.port}"}
        data = raw
        if body is not None:
            data = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
        if token and method not in ("GET", "HEAD"):
            h["X-Kit-Token"] = TOKEN
        h.update(headers or {})
        c.request(method, path, body=data, headers=h)
        r = c.getresponse()
        text = r.read()
        try:
            js = json.loads(text) if text else None
        except ValueError:
            js = None
        if conn is None:
            c.close()
        return r.status, js, r

    def ok(self, method, path, body=None, status=(200, 201)):
        st, js, _ = self.req(method, path, body)
        self.assertIn(st, status if isinstance(status, tuple) else (status,), js)
        return js


class SecurityTests(Base):
    def test_config_gives_token(self):
        self.assertEqual(self.ok("GET", "/api/config")["token"], TOKEN)

    def test_bad_host_refused(self):
        st, js, _ = self.req("GET", "/api/state", host="evil.example:80")
        self.assertEqual((st, js["error"]["code"]), (403, "security.bad_host"))
        st, _, _ = self.req("GET", "/", host="evil.example")
        self.assertEqual(st, 403)

    def test_localhost_host_ok(self):
        st, _, _ = self.req("GET", "/api/state", host=f"localhost:{self.port}")
        self.assertEqual(st, 200)

    def test_foreign_origin_refused(self):
        st, js, _ = self.req("POST", "/api/chat", {"body": "hi"}, headers={"Origin": "https://evil.example"})
        self.assertEqual((st, js["error"]["code"]), (403, "security.bad_origin"))
        st, js, _ = self.req("GET", "/api/config", headers={"Origin": "null"})
        self.assertEqual(st, 403)
        st, js, _ = self.req("GET", "/api/config", headers={"Sec-Fetch-Site": "cross-site"})
        self.assertEqual(st, 403)

    def test_same_origin_ok(self):
        st, _, _ = self.req("POST", "/api/chat", {"body": "hi"}, headers={"Origin": f"http://127.0.0.1:{self.port}"})
        self.assertEqual(st, 201)

    def test_write_needs_token(self):
        st, js, _ = self.req("POST", "/api/chat", {"body": "hi"}, token=False)
        self.assertEqual((st, js["error"]["code"]), (403, "security.bad_token"))
        st, js, _ = self.req("POST", "/api/chat", {"body": "hi"}, token=False, headers={"X-Kit-Token": "nope"})
        self.assertEqual(st, 403)
        st, _, _ = self.req("DELETE", "/api/workspaces/1", token=False)
        self.assertEqual(st, 403)

    def test_text_plain_refused(self):
        # The V1 CSRF hole: a "simple" text/plain POST.
        st, js, _ = self.req("POST", "/api/chat", raw=b'{"body":"x"}', headers={"Content-Type": "text/plain"})
        self.assertEqual((st, js["error"]["code"]), (415, "request.json_only"))

    def test_bad_json_keeps_connection(self):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        st, js, _ = self.req("POST", "/api/chat", raw=b"{not json", headers={"Content-Type": "application/json"}, conn=c)
        self.assertEqual((st, js["error"]["code"]), (400, "request.bad_json"))
        st, js, _ = self.req("POST", "/api/chat", raw=b"[1,2]", headers={"Content-Type": "application/json"}, conn=c)
        self.assertEqual(st, 400)
        st, _, _ = self.req("GET", "/api/config", conn=c)  # same keep-alive connection still works
        self.assertEqual(st, 200)
        c.close()

    def test_bad_length(self):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        c.putrequest("POST", "/api/chat", skip_host=True)
        c.putheader("Host", f"127.0.0.1:{self.port}")
        c.putheader("Content-Length", "abc")
        c.putheader("X-Kit-Token", TOKEN)
        c.endheaders()
        r = c.getresponse()
        self.assertEqual((r.status, json.loads(r.read())["error"]["code"]), (400, "request.bad_length"))
        c.close()

    def test_too_large(self):
        c = http.client.HTTPConnection("127.0.0.1", self.port, timeout=10)
        c.putrequest("POST", "/api/chat", skip_host=True)
        c.putheader("Host", f"127.0.0.1:{self.port}")
        c.putheader("Content-Type", "application/json")
        c.putheader("Content-Length", str(2 * 1024 * 1024 + 1))
        c.endheaders()
        r = c.getresponse()
        self.assertEqual((r.status, json.loads(r.read())["error"]["code"]), (413, "request.too_large"))
        c.close()

    def test_errors_structured(self):
        st, js, _ = self.req("GET", "/api/nope")
        self.assertEqual((st, js["error"]["code"]), (404, "request.not_found"))
        st, js, _ = self.req("PATCH", "/api/state", {})
        self.assertEqual((st, js["error"]["code"]), (405, "request.method_not_allowed"))
        st, js, _ = self.req("POST", "/api/chat", {"body": ""})
        self.assertEqual((st, js["error"]["code"]), (400, "validation.message_empty"))

    def test_options_no_cors(self):
        st, _, r = self.req("OPTIONS", "/api/chat")
        self.assertEqual(st, 403)
        self.assertIsNone(r.getheader("Access-Control-Allow-Origin"))

    def test_headers(self):
        _, _, r = self.req("GET", "/api/config")
        self.assertEqual(r.getheader("X-Content-Type-Options"), "nosniff")

    def test_spa_fallback(self):
        st, _, r = self.req("GET", "/some/client/route")
        self.assertEqual(st, 200)
        self.assertIn("text/html", r.getheader("Content-Type"))


class StateTests(Base):
    def test_state_etag(self):
        st, js, r = self.req("GET", "/api/state")
        self.assertEqual(st, 200)
        self.assertIn("workspaces", js)
        self.assertTrue(js["requests"])
        tag = r.getheader("ETag")
        st, _, _ = self.req("GET", "/api/state", headers={"If-None-Match": tag})
        self.assertEqual(st, 304)
        self.ok("POST", "/api/chat", {"body": "changes state? no, but a reply would"})
        self.ok("POST", "/api/workspaces", {"tool": "wsjf-planner", "title": "etag"})
        st, _, _ = self.req("GET", "/api/state", headers={"If-None-Match": tag})
        self.assertEqual(st, 200)

    def test_catalog(self):
        st, js, r = self.req("GET", "/api/catalog")
        self.assertEqual(st, 200)
        self.assertTrue(js["types"] and js["groups"])
        st, _, _ = self.req("GET", "/api/catalog", headers={"If-None-Match": r.getheader("ETag")})
        self.assertEqual(st, 304)


class WorkspaceTests(Base):
    def test_crud(self):
        ws = self.ok("POST", "/api/workspaces", {"tool": "api-tester", "title": "Block card", "lang": "en",
                                                 "state": {"url": "https://issuer.example/v1"}}, 201)
        wid = ws["id"]
        self.assertEqual(ws["state"]["url"], "https://issuer.example/v1")
        self.assertIsNone(ws["last_run"])
        got = self.ok("GET", f"/api/workspaces/{wid}")
        self.assertEqual(got["title"], "Block card")
        upd = self.ok("PUT", f"/api/workspaces/{wid}", {"title": "Block card v2", "state": {"x": 1}})
        self.assertEqual((upd["title"], upd["state"]), ("Block card v2", {"x": 1}))
        lst = self.ok("GET", "/api/workspaces?tool=api-tester")["workspaces"]
        self.assertIn(wid, [w["id"] for w in lst])
        self.assertNotIn("state", lst[0])
        st, _, _ = self.req("DELETE", f"/api/workspaces/{wid}")
        self.assertEqual(st, 204)
        st, js, _ = self.req("GET", f"/api/workspaces/{wid}")
        self.assertEqual((st, js["error"]["code"]), (404, "workspace.not_found"))

    def test_validation(self):
        st, js, _ = self.req("POST", "/api/workspaces", {"tool": "nope"})
        self.assertEqual((st, js["error"]["code"]), (400, "workspace.bad_tool"))
        st, js, _ = self.req("POST", "/api/workspaces", {"tool": "api-tester", "state": [1]})
        self.assertEqual(js["error"]["code"], "validation.state")
        st, js, _ = self.req("POST", "/api/workspaces", {"tool": "api-tester", "title": 5})
        self.assertEqual(js["error"]["code"], "validation.title")

    def test_runs_keep_50_and_cap(self):
        wid = self.ok("POST", "/api/workspaces", {"tool": "sql-runner"}, 201)["id"]
        for i in range(55):
            self.ok("POST", f"/api/workspaces/{wid}/runs", {"kind": "sql", "input": {"i": i}, "result": {"rows": i},
                                                             "ok": True, "ms": 3}, 201)
        runs = self.ok("GET", f"/api/workspaces/{wid}/runs?limit=50")["runs"]
        self.assertEqual(len(runs), 50)
        self.assertEqual(runs[0]["input"]["i"], 54)
        self.assertEqual(runs[-1]["input"]["i"], 5)
        big = self.ok("POST", f"/api/workspaces/{wid}/runs", {"kind": "sql", "result": {"blob": "x" * 300000}}, 201)
        self.assertTrue(big["result"]["truncated"])
        self.assertEqual(self.ok("GET", f"/api/workspaces/{wid}")["last_run"]["id"], big["id"])

    def test_publish_and_versions(self):
        wid = self.ok("POST", "/api/workspaces", {"tool": "prd-builder", "title": "Card block PRD",
                                                  "state": {"v": 1}}, 201)["id"]
        st, js, _ = self.req("POST", f"/api/workspaces/{wid}/publish", {"output": ""})
        self.assertEqual(js["error"]["code"], "validation.output")
        p1 = self.ok("POST", f"/api/workspaces/{wid}/publish", {"output": "# PRD v1"}, 201)
        self.assertTrue(p1["created"])
        rid = p1["request_id"]
        d = self.ok("GET", f"/api/requests/{rid}")
        self.assertEqual((d["output"], d["type"], d["status"]), ("# PRD v1", "writing-prds", "ready"))
        self.assertEqual(d["workspace"]["id"], wid)
        self.assertEqual(d["workspace"]["href"], f"#/tool/prd-builder?ws={wid}")
        self.ok("PUT", f"/api/workspaces/{wid}", {"state": {"v": 2}})
        p2 = self.ok("POST", f"/api/workspaces/{wid}/publish", {"output": "# PRD v2"}, 200)
        self.assertEqual((p2["request_id"], p2["created"]), (rid, False))
        d = self.ok("GET", f"/api/requests/{rid}")
        self.assertEqual(d["output"], "# PRD v2")
        self.assertEqual(len(d["versions"]), 1)
        self.assertEqual(d["versions"][0]["source"], "tool")
        v = self.ok("GET", f"/api/versions/{d['versions'][0]['id']}")
        self.assertEqual((v["output"], v["state"]), ("# PRD v1", {"v": 1}))
        self.assertEqual(self.ok("GET", f"/api/workspaces/{wid}")["request"]["id"], rid)

    def test_ai_message(self):
        wid = self.ok("POST", "/api/workspaces", {"tool": "api-tester"}, 201)["id"]
        run = self.ok("POST", f"/api/workspaces/{wid}/runs", {"kind": "http", "ok": False}, 201)
        st, js, _ = self.req("POST", f"/api/workspaces/{wid}/ai", {"action": "x", "prompt": "p", "run_id": 999999})
        self.assertEqual(js["error"]["code"], "validation.run_id")
        a = self.ok("POST", f"/api/workspaces/{wid}/ai", {"action": "explain-failure", "prompt": "Why 422?",
                                                           "run_id": run["id"], "expects": "markdown"}, 201)
        self.assertEqual(a["thread"], "chat")
        msgs = self.ok("GET", "/api/chat")["messages"]
        m = [x for x in msgs if x["id"] == a["message_id"]][0]
        self.assertEqual(m["meta"]["action"], "explain-failure")
        self.assertEqual(m["meta"]["workspace_id"], wid)


class KitTests(Base):
    def kit(self, *args):
        return subprocess.run([sys.executable, str(SERVER_DIR / "kit.py"), *args], capture_output=True, text=True,
                              env={**os.environ}, timeout=30)

    def write(self, name, text):
        p = Path(TMP) / name
        p.write_text(text)
        return str(p)

    def test_reply_marks_only_ids(self):
        rid = self.ok("POST", "/api/workspaces/%d/publish" % self.ok(
            "POST", "/api/workspaces", {"tool": "story-builder"}, 201)["id"], {"output": "# S"}, 201)["request_id"]
        a = self.ok("POST", f"/api/requests/{rid}/messages", {"body": "first"}, 201)["id"]
        b = self.ok("POST", f"/api/requests/{rid}/messages", {"body": "posted while Claude writes"}, 201)["id"]
        r = self.kit("reply", str(rid), self.write("r.md", "Answer to first"), "--ids", str(a))
        self.assertEqual(r.returncode, 0, r.stderr)
        pending = json.loads(self.kit("pending").stdout)["messages"]
        ids = [m["id"] for m in pending]
        self.assertNotIn(a, ids)
        self.assertIn(b, ids)
        r = self.kit("reply", str(rid), self.write("r2.md", "x"), "--ids", "999999")
        self.assertEqual(r.returncode, 1)
        self.assertIn("not user messages", r.stderr)

    def test_reply_default_spares_later_messages(self):
        f = self.write("early.md", "early reply")
        old = time.time() - 60
        os.utime(f, (old, old))
        c = self.ok("POST", "/api/chat", {"body": "late question"}, 201)["id"]
        self.assertEqual(self.kit("reply", "chat", f).returncode, 0)
        self.assertIn(c, [m["id"] for m in json.loads(self.kit("pending").stdout)["messages"]])

    def test_bad_args(self):
        r = self.kit("deliver", "999999", self.write("d.md", "x"))
        self.assertEqual(r.returncode, 1)
        self.assertIn("No deliverable", r.stderr)
        self.assertEqual(self.kit("start").returncode, 1)
        self.assertNotIn("Traceback", self.kit("start", "abc").stderr)

    def test_pending_tool_context_and_patch(self):
        wid = self.ok("POST", "/api/workspaces", {"tool": "api-tester", "state": {"cases": [], "ai": {"keep": 1}}}, 201)["id"]
        self.ok("POST", f"/api/workspaces/{wid}/runs", {"kind": "http", "result": {"status": 422}, "ok": False}, 201)
        mid = self.ok("POST", f"/api/workspaces/{wid}/ai", {"action": "gen-cases", "prompt": "Write cases",
                                                             "expects": "json"}, 201)["message_id"]
        msgs = json.loads(self.kit("pending").stdout)["messages"]
        m = [x for x in msgs if x["id"] == mid][0]
        self.assertEqual(m["tool"]["tool"], "api-tester")
        self.assertEqual(m["tool"]["run"]["result"]["status"], 422)
        self.assertEqual(m["tool"]["state"]["cases"], [])
        r = self.kit("patch", str(wid), self.write("p.json", '{"cases": [{"name": "422 on bad PAN"}]}'),
                     "--ids", str(mid))
        self.assertEqual(r.returncode, 0, r.stderr)
        ws = self.ok("GET", f"/api/workspaces/{wid}")
        self.assertEqual(ws["state"]["ai"]["gen-cases"]["cases"][0]["name"], "422 on bad PAN")
        self.assertEqual(ws["state"]["ai"]["keep"], 1)
        self.assertNotIn(mid, [x["id"] for x in json.loads(self.kit("pending").stdout)["messages"]])
        self.assertEqual(self.kit("patch", str(wid), self.write("bad.json", "{oops")).returncode, 1)

    def test_schema_validation(self):
        sys.path.insert(0, str(SERVER_DIR))
        import kit
        schema = {"type": "object", "required": ["cases"], "properties": {
            "cases": {"type": "array", "maxItems": 2, "items": {"type": "object", "required": ["name"],
                                                                 "properties": {"name": {"type": "string", "maxLength": 5}}}}}}
        self.assertEqual(kit.validate({"cases": [{"name": "ok"}]}, schema), [])
        errs = kit.validate({"cases": [{"name": "too long"}, {}, {}]}, schema)
        self.assertTrue(any("maxLength" in e or "longer" in e for e in errs))
        self.assertTrue(any("required" in e for e in errs))
        self.assertTrue(any("more than 2" in e for e in errs))
        self.assertEqual(kit.validate([], schema), ["$: expected object"])


class PluginTests(unittest.TestCase):
    def test_broken_plugin_is_skipped(self):
        import router
        self.assertIsInstance(router.LOAD_ERRORS, list)
        names = [r[2].__module__ for r in router.ROUTES]
        self.assertIn("routes.workspaces", names)


if __name__ == "__main__":
    unittest.main()
