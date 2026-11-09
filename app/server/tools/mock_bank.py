"""Mock card-issuer API served by the local app (owner C): /mock/harbor/v1/* (Visa terms, EN) and
/mock/lumiere/v1/* (CB terms, FR). Rule-for-rule mirror of app/web/js/mock/bank.js (the in-page mock used by the
static demo), so the API tester's exported curl / Postman / pytest suites run against the same behaviour:

    curl -s -X POST http://localhost:4317/mock/harbor/v1/cards/crd_hb_008/block \
         -H 'X-API-Key: hb_test_demo_key' -H 'Content-Type: application/json' \
         --data-raw '{"reason":"lost","channel":"app"}'

Fixtures come from the same file as the front end (app/web/js/mock/fixtures.js: strict JSON after
"export default"). Specs: research/demo-api/harbor-bank-openapi.yaml + tokens-and-disputes-openapi.yaml.
Routes are token=False (curl/pytest send no X-Kit-Token) and db=False (state lives in memory; POST
/_mock/reset restores it). Fictional bank, fictional data, no real cryptography. Python 3.9 compatible.
"""

import copy
import datetime as dt
import json
import re
import threading
import time
from pathlib import Path

from router import route

FIX_PATH = Path(__file__).resolve().parents[2] / "web" / "js" / "mock" / "fixtures.js"


def _load_fixtures():
    text = FIX_PATH.read_text(encoding="utf-8")
    text = text[text.index("export default") + len("export default"):]
    return json.loads(text[text.index("{"):text.rindex("}") + 1])


FIX = _load_fixtures()
KEYS = {"harbor": "hb_test_demo_key", "lumiere": "bl_test_demo_key"}
OTP = "123456"
RATE_LIMIT = 60


# ---------------------------------------------------------------- helpers (same as bank.js)
def luhn(pan):
    s = str(pan)
    if not re.fullmatch(r"\d{12,19}", s):
        return False
    t = 0
    for i, ch in enumerate(reversed(s)):
        d = int(ch)
        if i % 2:
            d *= 2
            if d > 9:
                d -= 9
        t += d
    return t % 10 == 0


def luhn_complete(body):
    for c in range(10):
        if luhn(body + str(c)):
            return body + str(c)
    return body + "0"


def mask_pan(pan):
    return (str(pan)[:6] + "******" + str(pan)[-4:]) if pan else None


def pad(n, w):
    return str(n).zfill(w)


def clone(o):
    return copy.deepcopy(o)


def fnv(s):
    h = 0x811C9DC5
    for ch in str(s):
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def hex8(n):
    return pad(format(n, "x"), 8)


def code6(seed, prefix=""):
    alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    n, out = fnv(seed), prefix or ""
    while len(out) < 6:
        out += alphabet[n % 36]
        n = (n // 36) or fnv(out + seed)
    return out


def _d(s):
    return dt.date(*map(int, s.split("-")))


def add_days(d, n):
    return (_d(d) + dt.timedelta(days=n)).isoformat()


def days_between(a, b):
    return (_d(b) - _d(a)).days


def next_business_day(d):
    x = _d(d) + dt.timedelta(days=1)
    while x.weekday() >= 5:
        x += dt.timedelta(days=1)
    return x.isoformat()


def add_months(d, n):
    y, m, dd = map(int, d.split("-"))
    idx = (y * 12 + m - 1) + n
    y2, m2 = idx // 12, idx % 12 + 1
    nxt = dt.date(y2 + (m2 == 12), m2 % 12 + 1, 1)
    last = (nxt - dt.timedelta(days=1)).day
    return dt.date(y2, m2, min(dd, last)).isoformat()


def iso_plus(at, seconds):
    t = dt.datetime.strptime(at, "%Y-%m-%dT%H:%M:%SZ") + dt.timedelta(seconds=seconds)
    return t.strftime("%Y-%m-%dT%H:%M:%SZ")


PROBLEMS = {
    "unauthorized": ("Missing or invalid API key", "Clé d'API absente ou invalide"),
    "forbidden": ("This key cannot write (read-only scope)", "Cette clé ne peut pas écrire (lecture seule)"),
    "not-found": ("Not found", "Introuvable"),
    "no-route": ("This endpoint is not part of the demo API", "Ce point d'accès ne fait pas partie de l'API de démo"),
    "method-not-allowed": ("Method not allowed on this endpoint", "Méthode non autorisée sur ce point d'accès"),
    "invalid-json": ("Body is not valid JSON", "Le corps n'est pas un JSON valide"),
    "invalid-field": ("Invalid field", "Champ invalide"),
    "unknown-test-pan": ("Not a test card of this demo", "Pas une carte de test de cette démo"),
    "card-already-blocked": ("Card already blocked", "Carte déjà en opposition"),
    "card-not-blocked": ("Card is not blocked", "La carte n'est pas en opposition"),
    "unblock-not-allowed": ("Only a lost card can be unblocked", "Seule une carte perdue peut être réactivée"),
    "unblock-window-expired": ("Unblock window (24 h) is over", "Le délai de réactivation (24 h) est dépassé"),
    "activity-since-block": ("A payment was attempted since the block", "Un paiement a été tenté depuis l'opposition"),
    "transaction-card-mismatch": ("Transaction does not belong to this card", "L'opération n'appartient pas à cette carte"),
    "transaction-not-approved": ("Only approved transactions can be reported", "Seules les opérations acceptées peuvent être déclarées"),
    "fraud-already-reported": ("Fraud already reported for this transaction", "Fraude déjà déclarée pour cette opération"),
    "unknown-condition": ("Unknown dispute condition", "Motif de contestation inconnu"),
    "time-limit-exceeded": ("Dispute time limit exceeded", "Délai de contestation dépassé"),
    "fraud-report-required": ("A fraud report is required for 10.x", "Une déclaration de fraude est requise pour 10.x"),
    "fraud-report-mismatch": ("Fraud report is for another transaction", "La déclaration de fraude porte sur une autre opération"),
    "amount-exceeds-transaction": ("Amount is more than what is left to dispute", "Montant supérieur au reste contestable"),
    "dispute-already-open": ("A dispute is already open on this transaction", "Une contestation est déjà ouverte sur cette opération"),
    "idempotency-key-reused": ("Idempotency-Key reused with a different body", "Idempotency-Key réutilisée avec un autre corps"),
    "rate-limited": ("Too many calls (over 60 a minute)", "Trop d'appels (plus de 60 par minute)"),
    "server-error": ("Forced server error (X-Mock-Fault)", "Erreur serveur forcée (X-Mock-Fault)"),
    "unknown-token-requestor": ("Unknown token requestor (TRID)", "Demandeur de jeton (TRID) inconnu"),
    "token-already-exists": ("This card already has a token on this device", "Cette carte a déjà un jeton sur cet appareil"),
    "token-not-pending": ("Token is not waiting for ID&V", "Le jeton n'attend pas de vérification d'identité"),
    "idv-failed": ("Wrong one-time code", "Code à usage unique erroné"),
    "idv-expired": ("One-time code expired", "Code à usage unique expiré"),
    "invalid-token-transition": ("Token status does not allow this", "Le statut du jeton ne le permet pas"),
    "token-deleted": ("Token is deleted (final)", "Jeton supprimé (définitif)"),
    "card-blocked": ("Card behind the token is blocked", "La carte liée au jeton est en opposition"),
    "token-compromised": ("Token was used for fraud: delete it", "Jeton utilisé pour une fraude : supprimez-le"),
    "token-not-active": ("Token is not active", "Le jeton n'est pas actif"),
    "domain-restriction": ("Channel outside the token domain", "Canal hors du domaine du jeton"),
    "cryptogram-invalid": ("Demo cryptogram unknown or already used", "Cryptogramme de démo inconnu ou déjà utilisé"),
    "invalid-payment-transition": ("Payment status does not allow this", "Le statut du paiement ne le permet pas"),
    "capture-exceeds-authorisation": ("Capture is more than the authorised amount", "Remise supérieure au montant autorisé"),
    "reversal-exceeds-authorisation": ("Reversal is more than the authorised amount", "Annulation supérieure au montant autorisé"),
    "already-captured": ("Payment already captured", "Paiement déjà remis en compensation"),
    "not-captured": ("Payment not captured yet", "Paiement pas encore remis"),
    "refund-exceeds-captured": ("Refunds are more than the captured amount", "Remboursements supérieurs au montant remis"),
    "dispute-open": ("A dispute is open on this payment", "Une contestation est ouverte sur ce paiement"),
    "not-cleared": ("Only cleared payments can be charged back", "Seuls les paiements compensés peuvent faire l'objet d'un impayé"),
    "credit-already-processed": ("Credit already processed", "Remboursement déjà effectué"),
    "liability-shifted": ("Fraud liability shifted to the issuer", "Responsabilité de la fraude transférée à l'émetteur"),
    "too-early": ("Too early: expected delivery date not passed", "Trop tôt : la date de livraison prévue n'est pas passée"),
    "response-window-closed": ("Response window closed", "Délai de réponse dépassé"),
    "no-response-step": ("Allocation disputes have no merchant response step", "Pas d'étape de réponse du commerçant en allocation"),
}
AUTH_MSG = {
    "00": ("Approved", "Acceptée"), "05": ("Do not honour", "Refusée (ne pas honorer)"), "41": ("Lost card", "Carte perdue"),
    "43": ("Stolen card", "Carte volée"), "51": ("Insufficient funds", "Provision insuffisante"), "54": ("Expired card", "Carte expirée"),
    "59": ("Suspected fraud", "Suspicion de fraude"), "91": ("Issuer unavailable", "Émetteur indisponible"),
}
STIP_MSG = ("Approved in Stand-In Processing", "Acceptée en traitement de secours (STIP)")
ENUMS = {
    "currency": ["EUR", "USD", "GBP"], "auth_channel": ["pos", "ecom", "atm"],
    "entry_mode": ["CHIP", "CONTACTLESS", "ECOM", "MAGSTRIPE", "MANUAL"],
    "block_reason": ["lost", "stolen", "used_without_permission"], "block_channel": ["app", "call_centre"],
    "declared_by": ["cardholder", "agent"], "fraud_type": ["0", "1", "2", "3", "4", "5", "6"],
    "wallet": ["apple_pay", "google_pay", "merchant_card_on_file"], "device_type": ["phone", "watch", "tablet", "browser"],
    "device_risk": ["low", "medium", "high"], "idv_method": ["sms_otp", "issuer_app", "call_centre"],
    "lifecycle_reason": ["device_lost", "device_found", "card_blocked_lost", "card_blocked_stolen", "card_replaced",
                         "fraud_on_token", "cardholder_request", "card_closed"],
    "requested_by": ["cardholder", "issuer", "wallet", "tsp"], "crypto_channel": ["contactless", "in_app", "web", "card_on_file"],
    "pay_channel": ["pos", "ecom", "in_app", "contactless"], "three_ds": ["authenticated", "attempted", "none"],
    "reversal_reason": ["customer_cancelled", "merchant_cancelled", "final_amount_lower", "duplicate", "timeout"],
    "refund_reason": ["goods_returned", "service_cancelled", "goodwill", "duplicate"],
    "evidence": ["proof_of_delivery", "signed_delivery", "tracking_only", "refund_issued", "product_description", "return_policy",
                 "cancellation_policy_accepted", "two_separate_orders", "compelling_evidence_3_0", "authorisation_proof"],
}
WIN_EVIDENCE = {"13.1": [["proof_of_delivery"]], "13.3": [["product_description", "return_policy"]],
                "13.6": [["refund_issued"], ["cancellation_policy_accepted"]],
                "13.7": [["refund_issued"], ["cancellation_policy_accepted"]],
                "12.6": [["two_separate_orders"]], "10.4": [["compelling_evidence_3_0"]]}
OPEN_DISPUTE = ["submitted", "acquirer_responded", "pre_arbitration", "chargeback", "represented", "arbitration"]
STATUS_TEXT = {200: "OK", 201: "Created", 204: "No Content", 400: "Bad Request", 401: "Unauthorized", 403: "Forbidden",
               404: "Not Found", 405: "Method Not Allowed", 409: "Conflict", 422: "Unprocessable Content",
               429: "Too Many Requests", 500: "Internal Server Error", 503: "Service Unavailable", 504: "Gateway Timeout"}


def is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def present(b, f):
    return b.get(f) is not None and b.get(f) != ""


class Reply:
    def __init__(self, status, body, headers=None):
        self.status, self.body, self.headers = status, body, list(headers or [])


class MockBank:
    def __init__(self, brand="harbor"):
        self.brand = brand
        self.cfg = FIX["brands"][brand]
        self.fr = self.cfg["lang"] == "fr"
        self.lock = threading.Lock()
        self.reset()

    # ---- state
    def reset(self):
        c = self.cfg
        cards = {}
        for i, card in enumerate(c["cards"]):
            x = clone(card)
            x.pop("expect", None)
            x["block"] = x.get("block") or None
            x["par"] = "Z999FAKEPAR" + pad(c["par_offset"] + i + 1, 18)
            x["activity_since_block"] = False
            cards[x["card_id"]] = x
        payments = {}
        for i, p in enumerate(c["payments"]):
            x = clone(p)
            x["authorised_minor"] = x.pop("amount_minor")
            x.update({"response_code": "00", "captured_minor": x["authorised_minor"] if x["status"] == "captured" else 0,
                      "reversed_minor": 0, "refunded_minor": 0, "disputed_minor": 0, "wallet": False,
                      "authentication": "none" if x["three_ds"] == "none" else "3ds", "token_ref": None,
                      "arn": c["arn_prefix"] + pad(9000 + i + 1, 12) if x.get("captured_at") else None, "refunds": []})
            x["timeline"] = [{"at": x["authorised_at"], "event": "authorised", "amount_minor": x["authorised_minor"]}]
            if x.get("captured_at"):
                x["timeline"].append({"at": x["captured_at"], "event": "captured", "amount_minor": x["captured_minor"]})
            payments[x["payment_id"]] = x
        disputes = {}
        for d in c["disputes"]:
            x = clone(d)
            x["kind"] = "base"
            disputes[x["dispute_id"]] = x
        self.state = {
            "today": FIX["today"], "tick": 0,
            "seq": {"auth": 0, "fraud": 1200, "dispute": 30, "ldispute": 100, "token": 0, "payment": len(c["payments"]),
                    "req": 0, "repl": 0},
            "cards": cards, "payments": payments,
            "transactions": {t["transaction_id"]: clone(t) for t in c["transactions"]},
            "fraud_reports": {r["fraud_report_id"]: clone(r) for r in c["fraud_reports"]},
            "disputes": disputes, "authorisations": {}, "tokens": {}, "cryptograms": {}, "idempotency": {}, "calls": [],
        }

    def now(self):
        s = self.state
        s["tick"] += 1
        return iso_plus(s["today"] + "T10:00:00Z", s["tick"])

    def t(self, en, fr):
        return fr if self.fr else en

    def problem(self, status, slug, detail=None, rule=None, extra=None):
        en, fr = PROBLEMS.get(slug, (slug, slug))
        body = {"type": self.cfg["problem_base"] + slug, "title": fr if self.fr else en, "status": status}
        if detail:
            body["detail"] = detail
        if rule:
            body["rule"] = rule
        body.update(extra or {})
        return Reply(status, body, [["Content-Type", "application/problem+json"]])

    def bad(self, field, detail=None):
        return self.problem(400, "invalid-field", detail or self.t("%s is invalid" % field, "%s est invalide" % field),
                            None, {"field": field})

    def required(self, f):
        return self.bad(f, self.t("%s is required" % f, "%s est obligatoire" % f))

    # ---- entry point
    def handle(self, method="GET", path="/", headers=None, body=""):
        h = {}
        items = headers.items() if isinstance(headers, dict) else (headers or [])
        for k, v in items:
            if k:
                h[str(k).lower()] = str(v)
        m = str(method).upper()
        p = ("/" + str(path).split("?")[0].lstrip("/")).rstrip("/") or "/"
        with self.lock:
            try:
                reply = self.dispatch(m, p, h, "" if body is None else str(body))
            except Exception as e:  # mirror the JS: a bug becomes a 500 problem, never a dropped connection
                reply = self.problem(500, "server-error", str(e))
            self.state["seq"]["req"] += 1
            out = [["Content-Type", "application/json"],
                   ["X-Request-Id", "req_%s_%s" % (self.brand, pad(self.state["seq"]["req"], 5))],
                   ["X-Mock-Clock", self.state["today"]]]
            for k, v in reply.headers:
                idx = next((i for i, (ok, _) in enumerate(out) if ok.lower() == k.lower()), -1)
                if idx >= 0:
                    out[idx] = [k, v]
                else:
                    out.append([k, v])
            if reply.body is None:
                out = [x for x in out if x[0] != "Content-Type"]
                text = ""
            else:
                text = json.dumps(reply.body, indent=2, ensure_ascii=False)
            return {"status": reply.status, "reason": STATUS_TEXT.get(reply.status, ""), "headers": out, "body": text,
                    "json": None if reply.body is None else clone(reply.body)}

    def dispatch(self, m, p, h, raw):
        s = self.state
        if p == "/_mock/reset":
            if m != "POST":
                return self.problem(405, "method-not-allowed")
            self.reset()
            return Reply(204, None)
        if p == "/_mock/state" and m == "GET":
            return Reply(200, self.public_state())
        b = {}
        if raw.strip():
            try:
                b = json.loads(raw)
            except ValueError:
                return self.problem(400, "invalid-json", self.t("Fix the JSON syntax of the body.", "Corrigez la syntaxe JSON du corps."))
            if not isinstance(b, dict):
                return self.problem(400, "invalid-json", self.t("The body must be a JSON object.", "Le corps doit être un objet JSON."))
        if p == "/_mock/clock":
            if m != "POST":
                return self.problem(405, "method-not-allowed")
            n = b.get("advance_days")
            if not is_int(n) or n < 1 or n > 400:
                return self.bad("advance_days", self.t("advance_days must be a whole number from 1 to 400",
                                                       "advance_days doit être un entier de 1 à 400"))
            s["today"] = add_days(s["today"], n)
            return Reply(200, {"today": s["today"]})
        now_ms = time.time() * 1000
        s["calls"] = [t for t in s["calls"] if now_ms - t < 60000]
        if len(s["calls"]) >= RATE_LIMIT:
            r = self.problem(429, "rate-limited", self.t("Wait 30 s or call POST /_mock/reset.", "Attendez 30 s ou appelez POST /_mock/reset."))
            r.headers.append(["Retry-After", "30"])
            return r
        s["calls"].append(now_ms)

        scope = self.cfg["keys"].get(h.get("x-api-key", ""))
        if not scope:
            return self.problem(401, "unauthorized", self.t("Send the header X-API-Key: %s" % KEYS[self.brand],
                                                            "Envoyez l'en-tête X-API-Key: %s" % KEYS[self.brand]))
        fault = h.get("x-mock-fault")
        if fault in ("500", "503", "504"):
            return self.problem(int(fault), "server-error", self.t("Forced by X-Mock-Fault: %s" % fault, "Forcée par X-Mock-Fault: %s" % fault))
        if m != "GET" and scope != "all":
            return self.problem(403, "forbidden", self.t("Use the full demo key for writes.", "Utilisez la clé de démo complète pour écrire."),
                                "D6" if (p.startswith("/disputes") or p.endswith("/disputes")) else None)
        idem = h.get("idempotency-key", "") if m == "POST" else ""
        fp = m + " " + p + " " + json.dumps(b, sort_keys=True)
        if idem:
            prev = s["idempotency"].get(idem)
            if prev:
                if prev["fp"] != fp:
                    return self.problem(409, "idempotency-key-reused", self.t("Use a new Idempotency-Key for a different request.",
                                                                              "Utilisez une nouvelle Idempotency-Key pour une autre requête."), "B5")
                return Reply(prev["status"], clone(prev["body"]), prev["headers"] + [["Idempotent-Replayed", "true"]])
        reply = self.route(m, p, h, b)
        if idem and reply.status < 500:
            s["idempotency"][idem] = {"fp": fp, "status": reply.status, "body": clone(reply.body), "headers": list(reply.headers)}
        return reply

    def route(self, m, p, h, b):
        routes = [
            ("GET", r"/cards/([^/]+)", lambda i: self.get_card(i)),
            ("POST", r"/cards/([^/]+)/block", lambda i: self.block(i, b)),
            ("POST", r"/cards/([^/]+)/unblock", lambda i: self.unblock(i)),
            ("POST", r"/authorisations", lambda: self.authorise(b)),
            ("GET", r"/authorisations/([^/]+)", lambda i: Reply(200, clone(self.state["authorisations"][i])) if i in self.state["authorisations"] else self.not_found(i)),
            ("POST", r"/fraud-reports", lambda: self.fraud_report(b)),
            ("POST", r"/disputes", lambda: self.dispute(b)),
            ("GET", r"/disputes/([^/]+)", lambda i: self.get_dispute(i)),
            ("POST", r"/disputes/([^/]+)/representment", lambda i: self.represent(i, b, h)),
            ("POST", r"/disputes/([^/]+)/pre-arbitration", lambda i: self.pre_arbitration(i, b)),
            ("POST", r"/tokens", lambda: self.provision(b)),
            ("GET", r"/tokens/([^/]+)", lambda i: self.get_token(i)),
            ("POST", r"/tokens/([^/]+)/idv", lambda i: self.idv(i, b)),
            ("POST", r"/tokens/([^/]+)/(suspend|resume|delete)", lambda i, op: self.lifecycle(i, op, b)),
            ("POST", r"/tokens/([^/]+)/cryptogram", lambda i: self.cryptogram(i, b)),
            ("POST", r"/payments", lambda: self.pay(b)),
            ("GET", r"/payments/([^/]+)", lambda i: self.get_payment(i)),
            ("POST", r"/payments/([^/]+)/capture", lambda i: self.capture(i, b)),
            ("POST", r"/payments/([^/]+)/reversal", lambda i: self.reverse(i, b)),
            ("POST", r"/payments/([^/]+)/refunds", lambda i: self.refund(i, b)),
            ("POST", r"/payments/([^/]+)/disputes", lambda i: self.chargeback(i, b)),
        ]
        known = False
        from urllib.parse import unquote
        for meth, rx, fn in routes:
            mm = re.fullmatch(rx, p)
            if mm:
                known = True
                if meth == m:
                    return fn(*[unquote(g) for g in mm.groups()])
        if known:
            return self.problem(405, "method-not-allowed", "%s %s" % (m, p))
        return self.problem(404, "no-route", self.t(
            "%s %s is not part of the demo API. See the endpoint list in the API tester." % (m, p),
            "%s %s ne fait pas partie de l'API de démo. Voir la liste des points d'accès dans le testeur." % (m, p)))

    def not_found(self, i):
        return self.problem(404, "not-found", self.t("No object with id %s" % i, "Aucun objet avec l'identifiant %s" % i))

    # ---- views
    def card_view(self, c):
        out = {"card_id": c["card_id"], "pan_masked": mask_pan(c["pan"]), "brand": self.cfg["brand"], "issuer": self.cfg["issuer"],
               "product": c["product"], "status": c["status"], "block": clone(c["block"]) if c.get("block") else None,
               "expiry": c["expiry"], "available_minor": c["available_minor"], "currency": c["currency"],
               "wallet_tokens": clone(c.get("wallet_tokens") or [])}
        for wt in out["wallet_tokens"]:
            wt.pop("suspended_by_block", None)
        for tk in self.state["tokens"].values():
            if tk["card_id"] == c["card_id"] and tk["status"] != "declined":
                out["wallet_tokens"].append({"token_id": tk["token_ref"], "wallet": tk["wallet"], "status": tk["status"]})
        for k in ("replacement", "replaces", "refund_due_by"):
            if c.get(k):
                out[k] = clone(c[k])
        return out

    def token_view(self, tk):
        out = clone(tk)
        out.pop("token_number", None)
        out.pop("attempts", None)
        return out

    def payment_view(self, p):
        out = clone(p)
        out.pop("refunds", None)
        return out

    def dispute_view(self, d):
        out = clone(d)
        out.pop("kind", None)
        out.pop("evidence_on_file", None)
        return out

    def public_state(self):
        s = self.state
        return {"brand": self.brand, "today": s["today"],
                "cards": [self.card_view(c) for c in s["cards"].values()],
                "tokens": [self.token_view(t) for t in s["tokens"].values()],
                "payments": [self.payment_view(p) for p in s["payments"].values()],
                "disputes": [clone(d) for d in s["disputes"].values()],
                "fraud_reports": [clone(r) for r in s["fraud_reports"].values()],
                "authorisations": [clone(a) for a in s["authorisations"].values()]}

    # ---- cards
    def get_card(self, i):
        c = self.state["cards"].get(i)
        return Reply(200, self.card_view(c)) if c else self.not_found(i)

    def block(self, i, b):
        s = self.state
        c = s["cards"].get(i)
        if not c:
            return self.not_found(i)
        if b.get("reason") not in ENUMS["block_reason"]:
            return self.problem(400, "invalid-field", self.t("reason must be one of lost, stolen, used_without_permission",
                                                             "reason doit valoir lost, stolen ou used_without_permission"), "B1", {"field": "reason"})
        if b.get("channel") not in ENUMS["block_channel"]:
            return self.problem(400, "invalid-field", self.t("channel must be one of app, call_centre",
                                                             "channel doit valoir app ou call_centre"), "B1", {"field": "channel"})
        if b.get("declared_by") is not None and b.get("declared_by") not in ENUMS["declared_by"]:
            return self.bad("declared_by")
        if c["status"] == "blocked":
            since = c["block"] and c["block"].get("blocked_at")
            return self.problem(409, "card-already-blocked", self.t("Card %s was blocked on %s" % (i, since),
                                                                    "La carte %s est en opposition depuis le %s" % (i, since)), "B2")
        at = self.now()
        c["status"] = "blocked"
        c["activity_since_block"] = False
        c["block"] = {"reason": b["reason"], "blocked_at": at, "channel": b["channel"], "exception_file": "listed",
                      "unblock_allowed_until": iso_plus(at, 86400) if b["reason"] == "lost" else None}
        for wt in c.get("wallet_tokens") or []:
            if wt["status"] == "active":
                wt["status"] = "suspended"
                wt["suspended_by_block"] = True
        for tk in s["tokens"].values():
            if tk["card_id"] == i and tk["status"] in ("active", "pending_idv"):
                tk["status"] = "suspended"
                tk["suspend_reason"] = "card_blocked_" + ("stolen" if b["reason"] == "used_without_permission" else b["reason"])
                tk["suspended_by_block"] = True
                tk["history"].append({"at": at, "event": "suspended", "by": "issuer", "reason": tk["suspend_reason"]})
        if b["reason"] != "used_without_permission" and not c.get("replacement"):
            s["seq"]["repl"] += 1
            rid = i + "_r1"
            n = len(s["cards"]) + s["seq"]["repl"]
            rpan = luhn_complete(c["pan"][:12] + "9" + pad(n % 100, 2))
            s["cards"][rid] = {"card_id": rid, "pan": rpan, "expiry": add_months(s["today"], 48)[:7], "product": c["product"],
                               "status": "active", "available_minor": c["available_minor"], "currency": c["currency"],
                               "wallet_tokens": [], "block": None, "par": c["par"], "activity_since_block": False, "replaces": i}
            c["replacement"] = {"ordered": True, "card_id": rid}
        if self.fr:
            c["refund_due_by"] = next_business_day(s["today"])
        return Reply(200, self.card_view(c))

    def unblock(self, i):
        s = self.state
        c = s["cards"].get(i)
        if not c:
            return self.not_found(i)
        if c["status"] != "blocked" or not c.get("block"):
            return self.problem(409, "card-not-blocked", self.t("Card %s is %s" % (i, c["status"]), "La carte %s est %s" % (i, c["status"])))
        blk = c["block"]
        if blk["reason"] != "lost":
            return self.problem(422, "unblock-not-allowed", self.t(
                "Reason is %s: the cardholder needs a new card number" % blk["reason"],
                "Motif %s : le porteur a besoin d'un nouveau numéro de carte" % blk["reason"]), "U1")
        at = self.now()
        until = blk.get("unblock_allowed_until")
        if not until or at > until:
            return self.problem(422, "unblock-window-expired", self.t("Unblock was allowed until %s" % until,
                                                                      "La réactivation était possible jusqu'au %s" % until), "U2")
        if c.get("activity_since_block"):
            return self.problem(422, "activity-since-block", self.t("An authorisation was attempted after the block",
                                                                    "Une autorisation a été tentée après l'opposition"), "U3")
        c["status"] = "active"
        c["block"] = None
        c.pop("refund_due_by", None)
        for wt in c.get("wallet_tokens") or []:
            if wt.get("suspended_by_block"):
                wt["status"] = "active"
                wt.pop("suspended_by_block", None)
        for tk in s["tokens"].values():
            if tk["card_id"] == i and tk["status"] == "suspended" and tk.get("suspended_by_block"):
                tk["status"] = "active"
                tk.pop("suspended_by_block", None)
                tk.pop("suspend_reason", None)
                tk["history"].append({"at": at, "event": "resumed", "by": "issuer", "reason": "card_unblocked"})
        if c.get("replacement"):
            s["cards"].pop(c["replacement"]["card_id"], None)
            c.pop("replacement", None)
        return Reply(200, self.card_view(c))

    def card_by_pan(self, pan):
        return next((c for c in self.state["cards"].values() if c["pan"] == pan), None)

    def unknown_pan(self, pan):
        fixed = FIX["legacy_pans"].get(pan)
        if fixed:
            detail = self.t("%s is the old (non-Luhn) fixture number. Use %s." % (pan, fixed),
                            "%s est l'ancien numéro de test (Luhn faux). Utilisez %s." % (pan, fixed))
        else:
            detail = self.t("Only the demo test cards work. Never paste a real card number.",
                            "Seules les cartes de test de la démo fonctionnent. Ne collez jamais un vrai numéro de carte.")
        return self.problem(422, "unknown-test-pan", detail, "A1", {"field": "pan"})

    # ---- issuer decision A1-A7
    def decide(self, card, amount, channel):
        s = self.state
        if card["status"] == "blocked":
            card["activity_since_block"] = True

        def block_code(r):
            return "41" if r == "lost" else "43" if r == "stolen" else "05"
        blk = card.get("block")
        if card.get("issuer_host") == "down":
            if not card.get("stand_in"):
                return "91", False
            if card["status"] == "blocked" and blk and blk.get("exception_file") == "listed":
                return block_code(blk.get("reason")), True
            return ("00" if amount <= card["stip_limit_minor"] else "05"), True
        if card["status"] == "blocked":
            return block_code(blk and blk.get("reason")), False
        if card["expiry"] < s["today"][:7]:
            return "54", False
        if card.get("fraud_watch") and channel == "ecom":
            return "59", False
        if amount > card["available_minor"]:
            return "51", False
        return "00", False

    @staticmethod
    def valid_amount(v):
        return is_int(v) and 1 <= v <= 10000000

    def authorise(self, b):
        s = self.state
        for f in ("pan", "expiry", "amount_minor", "currency", "channel"):
            if not present(b, f):
                return self.required(f)
        pan = re.sub(r"\s", "", str(b["pan"]))
        card = self.card_by_pan(pan)
        if not card:
            return self.unknown_pan(pan)
        if not re.fullmatch(r"\d{4}-\d{2}", str(b["expiry"])):
            return self.bad("expiry", self.t("expiry must look like 2029-04", "expiry doit ressembler à 2029-04"))
        if not self.valid_amount(b["amount_minor"]):
            return self.bad("amount_minor", self.t("amount_minor must be a whole number of cents from 1 to 10000000",
                                                   "amount_minor doit être un entier en centimes de 1 à 10000000"))
        if b["currency"] not in ENUMS["currency"]:
            return self.bad("currency", self.t("currency must be EUR, USD or GBP", "currency doit valoir EUR, USD ou GBP"))
        if b["channel"] not in ENUMS["auth_channel"]:
            return self.bad("channel", self.t("channel must be one of pos, ecom, atm", "channel doit valoir pos, ecom ou atm"))
        if b.get("entry_mode") is not None and b["entry_mode"] not in ENUMS["entry_mode"]:
            return self.bad("entry_mode")
        code, stip = self.decide(card, b["amount_minor"], b["channel"])
        s["seq"]["auth"] += 1
        aid = "auth_" + pad(s["seq"]["auth"], 4)
        approved = code == "00"
        if approved and not stip:
            card["available_minor"] -= b["amount_minor"]
        msg = STIP_MSG if (approved and stip) else AUTH_MSG[code]
        a = {"auth_id": aid, "response_code": code, "approved": approved, "message": msg[1] if self.fr else msg[0],
             "auth_code": code6(self.brand + aid + pan, "S" if stip else "") if approved else None, "stip": stip,
             "amount_minor": b["amount_minor"], "currency": b["currency"], "card_id": card["card_id"], "channel": b["channel"],
             "merchant_id": b.get("merchant_id") or None, "created_at": self.now()}
        s["authorisations"][aid] = a
        return Reply(200, clone(a))

    # ---- fraud reports
    def fraud_report(self, b):
        s = self.state
        for f in ("transaction_id", "card_id", "fraud_type", "case_id"):
            if not present(b, f):
                return self.required(f)
        if str(b["fraud_type"]) not in ENUMS["fraud_type"]:
            return self.problem(400, "invalid-field", self.t("fraud_type must be 0 to 6 (values to confirm against current Visa rules)",
                                                             "fraud_type doit valoir de 0 à 6 (liste à confirmer)"), "F2", {"field": "fraud_type"})
        tx = s["transactions"].get(b["transaction_id"])
        if not tx:
            return self.not_found(b["transaction_id"])
        if tx["card_id"] != b["card_id"]:
            return self.problem(422, "transaction-card-mismatch", self.t("Transaction belongs to %s" % tx["card_id"],
                                                                         "L'opération appartient à %s" % tx["card_id"]), "F1")
        if not tx["approved"]:
            return self.problem(422, "transaction-not-approved", self.t("Transaction was declined (%s)" % tx.get("response_code"),
                                                                        "Opération refusée (%s)" % tx.get("response_code")), "F3")
        dup = next((r for r in s["fraud_reports"].values() if r.get("transaction_id") == tx["transaction_id"]), None)
        if dup:
            return self.problem(409, "fraud-already-reported", self.t("Already reported as %s" % dup["fraud_report_id"],
                                                                      "Déjà déclarée sous %s" % dup["fraud_report_id"]), "F4")
        s["seq"]["fraud"] += 1
        r = {"fraud_report_id": "FR-2026-" + pad(s["seq"]["fraud"], 4), "transaction_id": tx["transaction_id"],
             "card_id": tx["card_id"], "fraud_type": str(b["fraud_type"]), "case_id": b["case_id"],
             "confirmed_at": b.get("confirmed_at") or None, "status": "sent", "amount_minor": tx["amount_minor"],
             "currency": tx["currency"], "reported_at": self.now()}
        s["fraud_reports"][r["fraud_report_id"]] = r
        return Reply(201, clone(r))

    # ---- disputes on a transaction
    @staticmethod
    def condition_ok(code):
        return str(code) in FIX["conditions"]

    def dispute(self, b):
        s = self.state
        for f in ("transaction_id", "condition_code", "amount_minor", "currency"):
            if not present(b, f):
                return self.required(f)
        if not is_int(b["amount_minor"]) or b["amount_minor"] < 1:
            return self.bad("amount_minor", self.t("amount_minor must be a whole number of cents, 1 or more",
                                                   "amount_minor doit être un entier en centimes, au moins 1"))
        tx = s["transactions"].get(b["transaction_id"])
        if not tx:
            return self.not_found(b["transaction_id"])
        code = str(b["condition_code"])
        if not self.condition_ok(code):
            return self.problem(422, "unknown-condition", self.t(
                "%s is not a handled Visa condition (10.x, 11.x, 12.x, 13.x)" % code,
                "%s n'est pas un motif traité (10.x, 11.x, 12.x, 13.x)" % code), "D1")
        age = days_between(tx["date"], s["today"])
        if age > 120:
            return self.problem(422, "time-limit-exceeded", self.t("Transaction is %d days old (limit 120)" % age,
                                                                   "L'opération date de %d jours (limite 120)" % age), "D2")
        if code.startswith("10."):
            if not b.get("fraud_report_id"):
                return self.problem(422, "fraud-report-required", self.t(
                    "Send the fraud report first (POST /fraud-reports), then its fraud_report_id",
                    "Envoyez d'abord la déclaration de fraude (POST /fraud-reports), puis son fraud_report_id"), "D3")
            fr = s["fraud_reports"].get(b["fraud_report_id"])
            if not fr or fr.get("transaction_id") != tx["transaction_id"]:
                return self.problem(422, "fraud-report-mismatch", self.t("%s does not cover this transaction" % b["fraud_report_id"],
                                                                         "%s ne couvre pas cette opération" % b["fraud_report_id"]), "D3")
        open_d = next((d for d in s["disputes"].values()
                       if d.get("transaction_id") == tx["transaction_id"] and d["status"] in OPEN_DISPUTE), None)
        if open_d:
            return self.problem(409, "dispute-already-open", self.t("%s is still open" % open_d["dispute_id"],
                                                                    "%s est toujours ouverte" % open_d["dispute_id"]), "D5")
        used = sum(d["amount_minor"] for d in s["disputes"].values()
                   if d.get("transaction_id") == tx["transaction_id"] and d["status"] != "withdrawn")
        if b["amount_minor"] > tx["amount_minor"] - used:
            left = tx["amount_minor"] - used
            return self.problem(422, "amount-exceeds-transaction", self.t("At most %d can be disputed" % left,
                                                                          "Au plus %d peut être contesté" % left), "D4")
        s["seq"]["dispute"] += 1
        at = self.now()
        d = {"dispute_id": "DSP-2026-" + pad(s["seq"]["dispute"], 4), "transaction_id": tx["transaction_id"], "condition_code": code,
             "condition": FIX["conditions"][code], "amount_minor": b["amount_minor"], "currency": b["currency"], "status": "submitted",
             "fraud_report_id": b.get("fraud_report_id") or None, "opened_at": at, "respond_by": None,
             "history": [{"at": at, "status": "submitted"}], "kind": "base"}
        if self.fr:
            d["refund_due_by"] = next_business_day(s["today"])
            d["contest_until"] = add_months(tx["date"], 13)
        s["disputes"][d["dispute_id"]] = d
        return Reply(201, self.dispute_view(d), [["Location", "/disputes/" + d["dispute_id"]]])

    def get_dispute(self, i):
        d = self.state["disputes"].get(i)
        return Reply(200, self.dispute_view(d)) if d else self.not_found(i)

    # ---- tokens
    def provision(self, b):
        s = self.state
        for f in ("pan", "expiry", "wallet", "token_requestor_id", "device_id"):
            if not present(b, f):
                return self.required(f)
        if b["wallet"] not in ENUMS["wallet"]:
            return self.bad("wallet", self.t("wallet must be apple_pay, google_pay or merchant_card_on_file",
                                             "wallet doit valoir apple_pay, google_pay ou merchant_card_on_file"))
        if b.get("device_type") is not None and b["device_type"] not in ENUMS["device_type"]:
            return self.bad("device_type")
        if b.get("device_risk") is not None and b["device_risk"] not in ENUMS["device_risk"]:
            return self.bad("device_risk")
        pan = re.sub(r"\s", "", str(b["pan"]))
        card = self.card_by_pan(pan)
        if not card:
            r = self.unknown_pan(pan)
            r.body["rule"] = "T1"
            return r
        trq = next((t for t in FIX["token_requestors"] if t["token_requestor_id"] == str(b["token_requestor_id"])), None)
        if not trq:
            return self.problem(422, "unknown-token-requestor", self.t(
                "Use a demo TRID: 40010030273 (Apple Pay), 40010075001 (Google Pay), 40010099001 (card-on-file)",
                "Utilisez un TRID de démo : 40010030273 (Apple Pay), 40010075001 (Google Pay), 40010099001 (carte enregistrée)"), "T2")
        at = self.now()
        reason = None
        if card["status"] == "blocked":
            reason = "card_blocked_" + str(card["block"] and card["block"].get("reason"))
        elif card["status"] == "expired" or card["expiry"] < s["today"][:7]:
            reason = "card_expired"
        elif card.get("fraud_watch"):
            reason = "fraud_watch"
        if reason:
            return Reply(201, {"token_ref": None, "decision": "red", "status": "declined", "card_id": card["card_id"],
                               "pan_masked": mask_pan(card["pan"]), "decision_reason": reason, "rule": "T3", "demo_only": True})
        dupe = next((t for t in s["tokens"].values() if t["card_id"] == card["card_id"] and t["device_id"] == b["device_id"]
                     and t["status"] in ("active", "pending_idv", "suspended")), None)
        if dupe:
            return self.problem(409, "token-already-exists", self.t("%s already exists on %s" % (dupe["token_ref"], b["device_id"]),
                                                                    "%s existe déjà sur %s" % (dupe["token_ref"], b["device_id"])), "T4")
        if b.get("device_risk") == "high":
            return Reply(201, {"token_ref": None, "decision": "red", "status": "declined", "card_id": card["card_id"],
                               "pan_masked": mask_pan(card["pan"]), "decision_reason": "device_risk_high", "rule": "T5", "demo_only": True})
        age = b.get("wallet_account_age_days")
        yellow = b.get("device_risk") == "medium" or (is_int(age) and age < 30)
        s["seq"]["token"] += 1
        ref = self.cfg["token_prefix"] + pad(s["seq"]["token"], 4)
        number = luhn_complete("400099" + ("000000" if self.brand == "harbor" else "000001") + pad(s["seq"]["token"], 3))
        channels = ["contactless", "in_app", "web"] if trq["device_bound"] else ["card_on_file", "web"]
        tk = {"token_ref": ref, "decision": "yellow" if yellow else "green", "status": "pending_idv" if yellow else "active",
              "card_id": card["card_id"], "pan_masked": mask_pan(card["pan"]), "token_number": number, "token_masked": mask_pan(number),
              "token_expiry": card["expiry"], "par": card["par"], "wallet": b["wallet"], "token_requestor_id": trq["token_requestor_id"],
              "device_id": b["device_id"], "device_type": b.get("device_type") or None,
              "domain_restrictions": {"channels": channels, "token_requestor_id": trq["token_requestor_id"], "device_bound": trq["device_bound"]},
              "assurance": {"idv_method": "none", "level": "pending" if yellow else "issuer_approved"},
              "views": {"wallet_sees": ["token_ref", "token_masked", "card art", "last 4 of PAN"],
                        "device_secure_element_holds": ["token (device account number)", "cryptogram key (demo: none)"],
                        "merchant_sees": ["token_masked", "cryptogram", "eci", "par"],
                        "issuer_sees": ["pan", "token_ref", "par", "device_id", "wallet"]},
              "history": [{"at": at, "event": "idv_requested" if yellow else "provisioned", "by": "issuer"}],
              "atc": 0, "attempts": 0, "demo_only": True}
        if yellow:
            tk["idv_methods"] = [{"method": "sms_otp", "target": "+33 6** ** ** 42"}, {"method": "issuer_app"}, {"method": "call_centre"}]
            tk["idv_expires_at"] = iso_plus(at, 600)
            tk["demo_otp"] = OTP
        s["tokens"][ref] = tk
        return Reply(201, self.token_view(tk))

    def get_token(self, ref):
        tk = self.state["tokens"].get(ref)
        return Reply(200, self.token_view(tk)) if tk else self.not_found(ref)

    def idv(self, ref, b):
        tk = self.state["tokens"].get(ref)
        if not tk:
            return self.not_found(ref)
        if tk["status"] != "pending_idv":
            return self.problem(409, "token-not-pending", self.t("Token is %s" % tk["status"], "Le jeton est %s" % tk["status"]), "T8")
        if b.get("method") not in ENUMS["idv_method"]:
            return self.bad("method", self.t("method must be sms_otp, issuer_app or call_centre",
                                             "method doit valoir sms_otp, issuer_app ou call_centre"))
        at = self.now()
        if at > tk["idv_expires_at"]:
            return self.problem(422, "idv-expired", self.t("Code expired at %s" % tk["idv_expires_at"],
                                                           "Code expiré à %s" % tk["idv_expires_at"]), "T10")
        if b["method"] == "sms_otp" and str(b.get("otp") or "") != OTP:
            tk["attempts"] += 1
            if tk["attempts"] >= 3:
                tk["status"] = "deleted"
                tk["decision"] = "red"
                tk["history"].append({"at": at, "event": "deleted", "by": "issuer", "reason": "idv_failed_3_times"})
                return self.problem(422, "idv-failed", self.t("3 wrong codes: the token is deleted",
                                                              "3 codes erronés : le jeton est supprimé"), "T9", {"attempts_left": 0})
            return self.problem(422, "idv-failed", self.t("Wrong code. Demo code is %s." % OTP, "Code erroné. Le code de démo est %s." % OTP),
                                "T9", {"attempts_left": 3 - tk["attempts"]})
        tk["status"] = "active"
        tk["assurance"] = {"idv_method": b["method"], "level": "issuer_verified"}
        tk.pop("demo_otp", None)
        tk["history"].append({"at": at, "event": "provisioned", "by": "issuer", "idv": b["method"]})
        return Reply(200, self.token_view(tk))

    def lifecycle(self, ref, op, b):
        s = self.state
        tk = s["tokens"].get(ref)
        if not tk:
            return self.not_found(ref)
        if tk["status"] == "deleted":
            return self.problem(409, "token-deleted", self.t("Deleted is final. Provision a new token.",
                                                             "La suppression est définitive. Créez un nouveau jeton."), "T15")
        if b.get("reason") not in ENUMS["lifecycle_reason"]:
            return self.bad("reason", self.t("reason is required (device_lost, card_replaced, fraud_on_token, ...)",
                                             "reason est obligatoire (device_lost, card_replaced, fraud_on_token, ...)"))
        if b.get("requested_by") is not None and b["requested_by"] not in ENUMS["requested_by"]:
            return self.bad("requested_by")
        at = self.now()
        if op == "suspend":
            if tk["status"] != "active":
                return self.problem(409, "invalid-token-transition", self.t(
                    "Only an active token can be suspended (it is %s)" % tk["status"],
                    "Seul un jeton actif peut être suspendu (il est %s)" % tk["status"]), "T11")
            tk["status"] = "suspended"
            tk["suspend_reason"] = b["reason"]
            tk.pop("suspended_by_block", None)
            tk["history"].append({"at": at, "event": "suspended", "by": b.get("requested_by") or "cardholder", "reason": b["reason"]})
            return Reply(200, self.token_view(tk))
        if op == "resume":
            if tk["status"] != "suspended":
                return self.problem(409, "invalid-token-transition", self.t(
                    "Only a suspended token can be resumed (it is %s)" % tk["status"],
                    "Seul un jeton suspendu peut être réactivé (il est %s)" % tk["status"]), "T12")
            if tk.get("suspend_reason") == "fraud_on_token":
                return self.problem(422, "token-compromised", self.t("Delete this token and provision a new one",
                                                                     "Supprimez ce jeton et créez-en un nouveau"), "T14")
            card = s["cards"].get(tk["card_id"])
            if card and card["status"] == "blocked":
                repl = card.get("replacement") and card["replacement"]["card_id"]
                if not b.get("new_card_id") or b["new_card_id"] != repl or repl not in s["cards"] or s["cards"][repl]["status"] != "active":
                    hint = " (%s)" % repl if repl else ""
                    return self.problem(422, "card-blocked", self.t(
                        "Card %s is blocked. Send new_card_id = the active replacement%s." % (card["card_id"], hint),
                        "La carte %s est en opposition. Envoyez new_card_id = la carte de remplacement active%s." % (card["card_id"], hint)), "T13")
                nc = s["cards"][repl]
                tk["history"].append({"at": at, "event": "pan_updated", "by": "issuer", "from": card["card_id"], "to": nc["card_id"]})
                tk["card_id"] = nc["card_id"]
                tk["pan_masked"] = mask_pan(nc["pan"])
                tk["token_expiry"] = nc["expiry"]
            tk["status"] = "active"
            tk.pop("suspend_reason", None)
            tk.pop("suspended_by_block", None)
            tk["history"].append({"at": at, "event": "resumed", "by": b.get("requested_by") or "issuer", "reason": b["reason"]})
            return Reply(200, self.token_view(tk))
        tk["status"] = "deleted"
        tk["history"].append({"at": at, "event": "deleted", "by": b.get("requested_by") or "issuer", "reason": b["reason"]})
        return Reply(200, self.token_view(tk))

    def cryptogram(self, ref, b):
        s = self.state
        tk = s["tokens"].get(ref)
        if not tk:
            return self.not_found(ref)
        if not self.valid_amount(b.get("amount_minor")):
            return self.bad("amount_minor", self.t("amount_minor is required (cents)", "amount_minor est obligatoire (centimes)"))
        if not re.fullmatch(r"[A-Z]{3}", str(b.get("currency") or "")):
            return self.bad("currency", self.t("currency is required, e.g. EUR", "currency est obligatoire, par ex. EUR"))
        if b.get("channel") not in ENUMS["crypto_channel"]:
            return self.bad("channel", self.t("channel must be contactless, in_app, web or card_on_file",
                                              "channel doit valoir contactless, in_app, web ou card_on_file"))
        if tk["status"] != "active":
            return self.problem(422, "token-not-active", self.t("Token is %s" % tk["status"], "Le jeton est %s" % tk["status"]), "T16")
        chans = tk["domain_restrictions"]["channels"]
        if b["channel"] not in chans:
            return self.problem(422, "domain-restriction", self.t("This token works only for %s" % ", ".join(chans),
                                                                  "Ce jeton ne fonctionne que pour %s" % ", ".join(chans)), "T17")
        tk["atc"] += 1
        seed = "%s%s:%d:%d" % (self.brand, ref, tk["atc"], b["amount_minor"])
        value = "FAKE" + hex8(fnv(seed)) + hex8(fnv(seed + "#"))
        s["cryptograms"][value] = {"token_ref": ref, "used": False, "amount_minor": b["amount_minor"], "channel": b["channel"]}
        tk["history"].append({"at": self.now(), "event": "cryptogram", "atc": tk["atc"], "channel": b["channel"]})
        return Reply(200, {"token_ref": ref, "cryptogram": value, "atc": tk["atc"], "eci": "05", "single_use": True, "demo_only": True,
                           "warning": self.t("Random demo value. Not a cryptogram. No security meaning.",
                                             "Valeur de démo aléatoire. Pas un cryptogramme. Aucune valeur de sécurité.")})

    # ---- payments
    def get_payment(self, i):
        p = self.state["payments"].get(i)
        return Reply(200, self.payment_view(p)) if p else self.not_found(i)

    def pay(self, b):
        s = self.state
        for f in ("amount_minor", "currency", "channel"):
            if not present(b, f):
                return self.required(f)
        if not self.valid_amount(b["amount_minor"]):
            return self.bad("amount_minor", self.t("amount_minor must be a whole number of cents", "amount_minor doit être un entier en centimes"))
        if not re.fullmatch(r"[A-Z]{3}", str(b["currency"])):
            return self.bad("currency")
        if b["channel"] not in ENUMS["pay_channel"]:
            return self.bad("channel", self.t("channel must be pos, ecom, in_app or contactless", "channel doit valoir pos, ecom, in_app ou contactless"))
        tds = "none" if b.get("three_ds") is None else b["three_ds"]
        if tds not in ENUMS["three_ds"]:
            return self.bad("three_ds", self.t("three_ds must be authenticated, attempted or none", "three_ds doit valoir authenticated, attempted ou none"))
        has_pan = present(b, "pan")
        has_tok = b.get("payment_token") is not None
        if has_pan == has_tok:
            return self.problem(400, "invalid-field", self.t("Send exactly one of pan or payment_token", "Envoyez soit pan, soit payment_token (un seul)"), "P1")
        tk = None
        if has_pan:
            pan = re.sub(r"\s", "", str(b["pan"]))
            card = self.card_by_pan(pan)
            if not card:
                return self.unknown_pan(pan)
        else:
            pt = b["payment_token"] if isinstance(b["payment_token"], dict) else {}
            tk = s["tokens"].get(pt.get("token_ref"))
            if not tk:
                return self.not_found(pt.get("token_ref"))
            if tk["status"] != "active":
                return self.problem(422, "token-not-active", self.t("Token is %s" % tk["status"], "Le jeton est %s" % tk["status"]), "T16")
            cg = s["cryptograms"].get(pt.get("cryptogram"))
            if not cg or cg["token_ref"] != tk["token_ref"] or cg["used"]:
                return self.problem(422, "cryptogram-invalid", self.t(
                    "Ask a new demo cryptogram (POST /tokens/{ref}/cryptogram): each one works once",
                    "Demandez un nouveau cryptogramme de démo (POST /tokens/{ref}/cryptogram) : chacun ne sert qu'une fois"), "T18")
            cg["used"] = True
            card = s["cards"][tk["card_id"]]
        code, stip = self.decide(card, b["amount_minor"], b["channel"])
        at = self.now()
        s["seq"]["payment"] += 1
        approved = code == "00"
        if approved and not stip:
            card["available_minor"] -= b["amount_minor"]
        msg = STIP_MSG if (approved and stip) else AUTH_MSG[code]
        p = {"payment_id": "pay_" + pad(s["seq"]["payment"], 4), "card_id": card["card_id"],
             "status": "authorised" if approved else "declined", "response_code": code, "approved": approved,
             "message": msg[1] if self.fr else msg[0], "stip": stip, "authorised_minor": b["amount_minor"] if approved else 0,
             "captured_minor": 0, "reversed_minor": 0, "refunded_minor": 0, "disputed_minor": 0, "currency": b["currency"],
             "channel": b["channel"], "three_ds": "none" if tk else tds, "wallet": bool(tk),
             "authentication": "cryptogram" if tk else ("none" if tds == "none" else "3ds"),
             "token_ref": tk["token_ref"] if tk else None, "merchant": b.get("merchant_id") or None, "arn": None,
             "authorised_at": at, "captured_at": None,
             "timeline": [{"at": at, "event": "authorised" if approved else "declined", "amount_minor": b["amount_minor"], "response_code": code}],
             "refunds": []}
        s["payments"][p["payment_id"]] = p
        return Reply(201, self.payment_view(p))

    def capture(self, i, b):
        s = self.state
        p = s["payments"].get(i)
        if not p:
            return self.not_found(i)
        if p["status"] not in ("authorised", "partially_reversed"):
            return self.problem(409, "invalid-payment-transition", self.t(
                "Payment is %s: only an authorised payment can be captured" % p["status"],
                "Le paiement est %s : seul un paiement autorisé peut être remis" % p["status"]), "P3")
        left = p["authorised_minor"] - p["reversed_minor"]
        amt = left if b.get("amount_minor") is None else b["amount_minor"]
        if not is_int(amt) or amt < 1:
            return self.bad("amount_minor")
        if amt > left:
            return self.problem(422, "capture-exceeds-authorisation", self.t(
                "At most %d can be captured; more needs an incremental authorisation (out of scope)" % left,
                "Au plus %d peut être remis ; au-delà il faut une autorisation complémentaire (hors démo)" % left), "P4")
        at = self.now()
        p["captured_minor"] = amt
        p["status"] = "captured"
        p["captured_at"] = at
        p["arn"] = self.cfg["arn_prefix"] + pad(9000 + int(i[4:]), 12)
        p["timeline"].append({"at": at, "event": "captured", "amount_minor": amt})
        if amt < left:
            p["reversed_minor"] += left - amt
            p["timeline"].append({"at": at, "event": "remainder_released", "amount_minor": left - amt, "rule": "P5"})
        return Reply(200, self.payment_view(p))

    def reverse(self, i, b):
        s = self.state
        p = s["payments"].get(i)
        if not p:
            return self.not_found(i)
        if p["status"] in ("captured", "partially_refunded", "refunded", "disputed"):
            return self.problem(409, "already-captured", "Payment is cleared: use POST /payments/%s/refunds" % i, "P6")
        if p["status"] not in ("authorised", "partially_reversed"):
            return self.problem(409, "invalid-payment-transition", self.t("Payment is %s" % p["status"], "Le paiement est %s" % p["status"]), "P7")
        if b.get("reason") is not None and b["reason"] not in ENUMS["reversal_reason"]:
            return self.bad("reason")
        left = p["authorised_minor"] - p["reversed_minor"]
        amt = left if b.get("amount_minor") is None else b["amount_minor"]
        if not is_int(amt) or amt < 1:
            return self.bad("amount_minor")
        if amt > left:
            return self.problem(422, "reversal-exceeds-authorisation", self.t("At most %d can be reversed" % left, "Au plus %d peut être annulé" % left), "P7")
        at = self.now()
        p["reversed_minor"] += amt
        p["status"] = "reversed" if p["reversed_minor"] >= p["authorised_minor"] else "partially_reversed"
        card = s["cards"].get(p["card_id"])
        if card and not p.get("stip"):
            card["available_minor"] += amt
        p["timeline"].append({"at": at, "event": "reversed" if p["status"] == "reversed" else "partially_reversed",
                              "amount_minor": amt, "reason": b.get("reason") or None})
        return Reply(200, self.payment_view(p))

    def refund(self, i, b):
        s = self.state
        p = s["payments"].get(i)
        if not p:
            return self.not_found(i)
        if p["status"] not in ("captured", "partially_refunded", "refunded", "disputed"):
            return self.problem(409, "not-captured", "Not cleared yet: use reversal", "R1")
        open_d = next((d for d in s["disputes"].values() if d.get("payment_id") == i and d["status"] in OPEN_DISPUTE), None)
        if open_d:
            return self.problem(409, "dispute-open", self.t(
                "%s is open: refunding too would pay the cardholder twice" % open_d["dispute_id"],
                "%s est ouverte : rembourser en plus paierait le porteur deux fois" % open_d["dispute_id"]), "R3")
        if not is_int(b.get("amount_minor")) or b["amount_minor"] < 1:
            return self.bad("amount_minor", self.t("amount_minor is required (cents)", "amount_minor est obligatoire (centimes)"))
        if b.get("reason") is not None and b["reason"] not in ENUMS["refund_reason"]:
            return self.bad("reason")
        room = p["captured_minor"] - p["disputed_minor"] - p["refunded_minor"]
        if b["amount_minor"] > room:
            return self.problem(422, "refund-exceeds-captured", self.t("At most %d can still be refunded" % room,
                                                                       "Au plus %d peut encore être remboursé" % room), "R2")
        at = self.now()
        p["refunded_minor"] += b["amount_minor"]
        p["status"] = "refunded" if p["refunded_minor"] >= p["captured_minor"] else "partially_refunded"
        p["refunds"].append({"at": at, "amount_minor": b["amount_minor"], "reason": b.get("reason") or None})
        p["timeline"].append({"at": at, "event": "refunded", "amount_minor": b["amount_minor"], "reason": b.get("reason") or None})
        return Reply(201, self.payment_view(p))

    # ---- chargeback lifecycle
    def chargeback(self, i, b):
        s = self.state
        p = s["payments"].get(i)
        if not p:
            return self.not_found(i)
        if not present(b, "condition_code"):
            return self.bad("condition_code", self.t("condition_code is required, e.g. 13.1", "condition_code est obligatoire, par ex. 13.1"))
        if not is_int(b.get("amount_minor")) or b["amount_minor"] < 1:
            return self.bad("amount_minor", self.t("amount_minor is required (cents)", "amount_minor est obligatoire (centimes)"))
        code = str(b["condition_code"])
        if p["status"] not in ("captured", "partially_refunded", "refunded", "disputed"):
            return self.problem(422, "not-cleared", self.t(
                "Payment is %s: an authorisation hold is not charged back" % p["status"],
                "Le paiement est %s : une autorisation seule ne fait pas l'objet d'un impayé" % p["status"]), "D7")
        if not self.condition_ok(code):
            return self.problem(422, "unknown-condition", self.t("%s is not a handled Visa condition (10.x-13.x)" % code,
                                                                 "%s n'est pas un motif traité (10.x-13.x)" % code), "D1")
        age = days_between(p["captured_at"][:10], s["today"])
        if age > 120:
            return self.problem(422, "time-limit-exceeded", self.t("Payment was cleared %d days ago (limit 120)" % age,
                                                                   "Paiement compensé il y a %d jours (limite 120)" % age), "D2")
        if p["refunded_minor"] >= p["captured_minor"] or (code.startswith("13.") and p["refunded_minor"] > 0 and b["amount_minor"] <= p["refunded_minor"]):
            return self.problem(422, "credit-already-processed", self.t("Already refunded %d" % p["refunded_minor"],
                                                                        "Déjà remboursé %d" % p["refunded_minor"]), "D8")
        if code == "10.4" and (p["three_ds"] in ("authenticated", "attempted") or p["authentication"] == "cryptogram"):
            if p["authentication"] == "cryptogram":
                why = self.t("Wallet payment with a cryptogram", "Paiement mobile avec cryptogramme")
            elif p["three_ds"] == "authenticated":
                why = self.t("Payment was 3-D Secure authenticated (ECI 05)", "Paiement authentifié 3-D Secure (ECI 05)")
            else:
                why = self.t("3-D Secure attempted (ECI 06): treated as shifted, to confirm per region",
                             "3-D Secure tenté (ECI 06) : traité comme transféré, à confirmer selon la région")
            return self.problem(422, "liability-shifted", why, "D9")
        if code.startswith("10."):
            if not b.get("fraud_report_id"):
                return self.problem(422, "fraud-report-required", self.t("Send the fraud report first, then its fraud_report_id",
                                                                         "Envoyez d'abord la déclaration de fraude, puis son fraud_report_id"), "D3")
            fr = s["fraud_reports"].get(b["fraud_report_id"])
            if not fr or not (fr.get("payment_id") == i or (p.get("arn") and fr.get("transaction_id") == p["arn"])):
                return self.problem(422, "fraud-report-mismatch", self.t("%s does not cover %s" % (b["fraud_report_id"], i),
                                                                         "%s ne couvre pas %s" % (b["fraud_report_id"], i)), "D3")
        if code == "13.1" and (not b.get("expected_delivery_date") or str(b["expected_delivery_date"]) >= s["today"]):
            return self.problem(422, "too-early", self.t("Send expected_delivery_date (in the past) for 13.1",
                                                         "Envoyez expected_delivery_date (passée) pour 13.1"), "D11")
        open_d = next((d for d in s["disputes"].values() if d.get("payment_id") == i and d["status"] in OPEN_DISPUTE), None)
        if open_d:
            return self.problem(409, "dispute-already-open", self.t("%s is still open" % open_d["dispute_id"],
                                                                    "%s est toujours ouverte" % open_d["dispute_id"]), "D5")
        room = p["captured_minor"] - p["refunded_minor"] - p["disputed_minor"]
        if b["amount_minor"] > room:
            return self.problem(422, "amount-exceeds-transaction", self.t("At most %d can be disputed" % room,
                                                                          "Au plus %d peut être contesté" % room), "D4")
        at = self.now()
        allocation = code.startswith("10.") or code.startswith("11.")
        s["seq"]["ldispute"] += 1
        amt = b["amount_minor"]
        d = {"dispute_id": "DSP-2026-" + pad(s["seq"]["ldispute"], 4), "payment_id": i, "transaction_id": p["arn"], "condition_code": code,
             "condition": FIX["conditions"][code], "workflow": "allocation" if allocation else "collaboration", "status": "chargeback",
             "amount_minor": amt, "currency": p["currency"], "fraud_report_id": b.get("fraud_report_id") or None,
             "respond_by": None if allocation else add_days(s["today"], 30), "liability": "merchant", "opened_at": at,
             "ledger": [
                 {"at": at, "debit": "issuer", "credit": "cardholder", "amount_minor": amt, "note": "provisional credit"},
                 {"at": at, "debit": "acquirer", "credit": "issuer", "amount_minor": amt, "note": "chargeback"},
                 {"at": at, "debit": "merchant", "credit": "acquirer", "amount_minor": amt, "note": "chargeback passed on"}],
             "history": [{"at": at, "status": "chargeback"}], "evidence": [], "kind": "lifecycle",
             "deadline_confidence": None if allocation else "to_confirm"}
        if b.get("cardholder_statement"):
            d["cardholder_statement"] = str(b["cardholder_statement"])[:500]
        if self.fr:
            d["refund_due_by"] = next_business_day(s["today"])
            d["contest_until"] = add_months(p["captured_at"][:10], 13)
        s["disputes"][d["dispute_id"]] = d
        p["disputed_minor"] += amt
        p["status"] = "disputed"
        p["timeline"].append({"at": at, "event": "chargeback", "amount_minor": amt, "dispute_id": d["dispute_id"], "condition_code": code})
        return Reply(201, self.dispute_view(d), [["Location", "/disputes/" + d["dispute_id"]]])

    @staticmethod
    def evidence_wins(code, ev):
        return any(all(e in ev for e in group) for group in WIN_EVIDENCE.get(code, []))

    def close_dispute(self, d, status, at):
        p = self.state["payments"].get(d.get("payment_id"))
        d["status"] = status
        d["history"].append({"at": at, "status": status})
        if not p:
            return
        if status == "won":
            d["liability"] = "issuer"
            d["ledger"].append({"at": at, "debit": "issuer", "credit": "acquirer", "amount_minor": d["amount_minor"], "note": "representment accepted"})
            d["ledger"].append({"at": at, "debit": "acquirer", "credit": "merchant", "amount_minor": d["amount_minor"], "note": "funds back to the merchant"})
            p["disputed_minor"] -= d["amount_minor"]
        else:
            d["liability"] = "merchant"
        if p["refunded_minor"] > 0:
            p["status"] = "refunded" if p["refunded_minor"] >= p["captured_minor"] else "partially_refunded"
        else:
            p["status"] = "captured"
        p["timeline"].append({"at": at, "event": "dispute_" + status, "dispute_id": d["dispute_id"]})

    def represent(self, i, b, h):
        s = self.state
        d = s["disputes"].get(i)
        if not d or d.get("kind") != "lifecycle":
            return self.not_found(i)
        if d["workflow"] == "allocation" and d["status"] == "chargeback":
            return self.problem(422, "no-response-step", self.t("Allocation (10.x, 11.x): the acquirer can only go to pre-arbitration",
                                                                "Allocation (10.x, 11.x) : l'acquéreur ne peut aller qu'en pré-arbitrage"), "D10")
        if d["status"] != "chargeback" or (d.get("respond_by") and s["today"] > d["respond_by"]):
            return self.problem(422, "response-window-closed", self.t(
                "Status %s, respond_by %s, today %s: the merchant loses by default" % (d["status"], d.get("respond_by"), s["today"]),
                "Statut %s, réponse avant le %s, aujourd'hui %s : le commerçant perd par défaut" % (d["status"], d.get("respond_by"), s["today"])), "D12")
        at = self.now()
        if b.get("accept") is True:
            self.close_dispute(d, "merchant_accepted", at)
            return Reply(200, self.dispute_view(d))
        ev = [str(e) for e in b["evidence"]] if isinstance(b.get("evidence"), list) else []
        if not ev:
            return self.problem(400, "invalid-field", self.t("Send evidence (list) or accept: true", "Envoyez evidence (liste) ou accept: true"),
                                "D13", {"field": "evidence"})
        bad_ev = next((e for e in ev if e not in ENUMS["evidence"]), None)
        if bad_ev:
            return self.bad("evidence", self.t("Unknown evidence type %s" % bad_ev, "Type de preuve inconnu %s" % bad_ev))
        d["evidence"] = ev
        if b.get("note"):
            d["note"] = str(b["note"])[:1000]
        d["history"].append({"at": at, "status": "represented", "evidence": ev})
        forced = (h.get("x-mock-issuer-decision") or "").lower()
        win = True if forced == "accept" else False if forced == "pre_arbitrate" else self.evidence_wins(d["condition_code"], ev)
        if win:
            self.close_dispute(d, "won", at)
        else:
            d["status"] = "pre_arbitration"
            d["liability"] = "pending"
            d["respond_by"] = add_days(s["today"], 30)
            d["history"].append({"at": at, "status": "pre_arbitration"})
        return Reply(200, self.dispute_view(d))

    def pre_arbitration(self, i, b):
        s = self.state
        d = s["disputes"].get(i)
        if not d or d.get("kind") != "lifecycle":
            return self.not_found(i)
        if d["status"] != "pre_arbitration" or (d.get("respond_by") and s["today"] > d["respond_by"]):
            return self.problem(422, "response-window-closed", self.t(
                "Status %s, respond_by %s, today %s" % (d["status"], d.get("respond_by"), s["today"]),
                "Statut %s, réponse avant le %s, aujourd'hui %s" % (d["status"], d.get("respond_by"), s["today"])), "D15")
        if not isinstance(b.get("accept"), bool):
            return self.bad("accept", self.t("accept (true or false) is required", "accept (true ou false) est obligatoire"))
        at = self.now()
        if b["accept"]:
            self.close_dispute(d, "lost", at)
            return Reply(200, self.dispute_view(d))
        new_ev = [str(e) for e in b["new_evidence"]] if isinstance(b.get("new_evidence"), list) else []
        ev = list(d.get("evidence") or []) + new_ev
        d["history"].append({"at": at, "status": "arbitration"})
        d["status"] = "arbitration"
        win = self.evidence_wins(d["condition_code"], d.get("evidence") or [])
        d["fee_minor"] = FIX["arbitration_fee_minor"]
        d["fee_note"] = self.t("Scheme filing fee charged to the loser (amount to confirm)",
                               "Frais d'arbitrage à la charge du perdant (montant à confirmer)")
        d["new_evidence_ignored"] = len(ev) > len(d.get("evidence") or [])
        if win:
            self.close_dispute(d, "won", at)
            d["ledger"].append({"at": at, "debit": "issuer", "credit": "scheme", "amount_minor": d["fee_minor"], "note": "arbitration fee"})
        else:
            self.close_dispute(d, "lost", at)
            d["ledger"].append({"at": at, "debit": "merchant", "credit": "scheme", "amount_minor": d["fee_minor"], "note": "arbitration fee"})
        return Reply(200, self.dispute_view(d))


BANKS = {"harbor": MockBank("harbor"), "lumiere": MockBank("lumiere")}


# ---------------------------------------------------------------- HTTP routes (token=False: curl / pytest call them)
def _serve(h, conn, m, body):
    brand, rest = m.group(1), m.group(2) or ""
    if not (rest == "/v1" or rest.startswith("/v1/")):
        return h.send_json({"type": FIX["brands"][brand]["problem_base"] + "no-route", "title": "Use /mock/%s/v1/..." % brand,
                            "status": 404}, 404)
    raw = body.decode("utf-8", "replace") if isinstance(body, (bytes, bytearray)) else ""
    res = BANKS[brand].handle(h.command, rest[3:] or "/", list(h.headers.items()), raw)
    data = res["body"].encode("utf-8")
    ctype = next((v for k, v in res["headers"] if k.lower() == "content-type"), "application/json")
    extra = {k: v for k, v in res["headers"] if k.lower() != "content-type"}
    if res["status"] == 204:
        h.send_response(204)
        for k, v in extra.items():
            h.send_header(k, v)
        h.send_header("Content-Length", "0")
        h.end_headers()
        return None
    return h.send_bytes(data, res["status"], ctype + "; charset=utf-8", extra)


for _method in ("GET", "POST", "PUT", "PATCH", "DELETE"):
    route(_method, r"/mock/(harbor|lumiere)(/.*)?", db=False, token=False, raw=True, max_body=1024 * 1024)(_serve)
