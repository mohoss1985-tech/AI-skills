{"client": "Hexa card scheme (sample)", "skill": "testing-apis", "title": "Disputes API test plan (chargebacks)"}
===INPUT===
Test plan and docs for the new member API for disputes (chargebacks). Issuers open disputes, acquirers answer with a representment. pytest.

POST /v1/disputes   (issuer)
Body: { "clearing_id": "clr_7Qa21", "reason_code": "10.4", "amount": 8990, "currency": "EUR", "fraud_report_id": "frd_51K" }   amount in cents
Header: Idempotency-Key. Auth: OAuth2 client credentials, mTLS, token scope disputes:write, member id in the token.
Rules:
- only the issuer of the card can open a dispute on a clearing record
- within 120 days of the clearing date
- amount ≤ cleared amount minus amounts already disputed
- one open dispute per clearing record
- fraud reasons (10.x) need a fraud report already declared to us (LCLF declaration)
Returns 201 with the dispute (status "open", response_due = +30 days).

POST /v1/disputes/{id}/representment   (acquirer of the transaction), within 30 days, with evidence ids. Returns 200, status "represented".
===OUTPUT===
### Endpoint inventory

| Method | Path | Purpose | Caller | Success | Errors |
|---|---|---|---|---|---|
| POST | /v1/disputes | Open a dispute (chargeback) on a cleared transaction | Issuer | 201 dispute | 400, 401, 403, 404, 409, 422 *(inferred)* |
| POST | /v1/disputes/{id}/representment | Contest the dispute with evidence | Acquirer of the transaction | 200 dispute | 401, 403, 404, 409, 422 *(inferred)* |

**Business rules**
- **R1** Only the **issuer of the card** can open a dispute on a clearing record.
- **R2** A dispute is opened **within 120 days** of the clearing date.
- **R3** Amount ≤ cleared amount − amounts already disputed.
- **R4** **One open dispute** per clearing record.
- **R5** Fraud reasons (`10.x`) need a **fraud report** (LCLF declaration) for the same transaction.
- **R6** The same `Idempotency-Key` returns the original dispute and never creates a second one.
- **R7** Only the **acquirer of the transaction** can represent, **within 30 days** of opening, once.

**Open questions:** is day 120 inclusive, and in which time zone? Can an issuer withdraw a dispute? Partial representment (part of the amount)? Error format (assumed RFC 9457).

### Test matrix

| ID | Case | Expect | Rule | Pri |
|---|---|---|---|---|
| DSP-01 | Issuer disputes the full amount, reason 13.1 (not received), day 30 | 201, `status: open`, `response_due` = opening + 30 d | — | P1 |
| DSP-02 | Another issuer's card (valid token, other member) | 404, no detail leaked | R1 | P1 |
| DSP-03 | Acquirer token calls POST /v1/disputes | 403 | R1 | P1 |
| DSP-04 | Clearing date + 120 days | 201 | R2 | P1 |
| DSP-05 | Clearing date + 121 days | 422 `dispute-window-closed` | R2 | P1 |
| DSP-06 | Amount = cleared amount + 1 cent | 422 `amount-exceeds-cleared` | R3 | P1 |
| DSP-07 | Previous dispute of 50.00 € closed, new one for the remaining 39.90 € | 201 | R3 | P2 |
| DSP-08 | Second dispute while the first is open | 409 `dispute-already-open` | R4 | P1 |
| DSP-09 | Reason 10.4 without `fraud_report_id` | 422 `fraud-report-required` | R5 | P1 |
| DSP-10 | Reason 10.4 with a fraud report on **another** transaction | 422 `fraud-report-mismatch` | R5 | P1 |
| DSP-11 | Same Idempotency-Key twice, same body | 201 twice, same dispute id | R6 | P1 |
| DSP-12 | Same key, different amount | 409 `idempotency-key-reused` | R6 | P2 |
| DSP-13 | Token without scope `disputes:write` | 403 | — | P1 |
| DSP-14 | No client certificate (mTLS) | TLS handshake refused | — | P1 |
| DSP-15 | Acquirer represents on day 30 with 2 evidence ids | 200, `status: represented` | R7 | P1 |
| DSP-16 | Acquirer represents on day 31 | 422 `representment-window-closed` | R7 | P1 |
| DSP-17 | Issuer token on representment | 403 | R7 | P1 |
| DSP-18 | Second representment | 409 | R7 | P2 |
| DSP-19 | Error body | `type`, `title`, `detail`, no stack trace, no PAN | — | P2 |

### Tests

disputes_test.py
```python
import os, uuid, pytest, httpx

BASE = os.environ["API_BASE_URL"]
CERT = (os.environ["MEMBER_CERT"], os.environ["MEMBER_KEY"])

def client(token):
    return httpx.Client(base_url=BASE, cert=CERT, headers={"Authorization": f"Bearer {token}"})

@pytest.fixture
def issuer():
    return client(os.environ["ISSUER_TOKEN"])

@pytest.fixture
def acquirer():
    return client(os.environ["ACQUIRER_TOKEN"])

def open_dispute(api, clr, amount=None, reason="13.1", key=None, **extra):
    body = {"clearing_id": clr.id, "reason_code": reason, "amount": amount or clr.amount, "currency": clr.currency, **extra}
    return api.post("/v1/disputes", json=body, headers={"Idempotency-Key": key or str(uuid.uuid4())})

def test_window_closes_after_120_days(issuer, cleared_txn_factory):
    assert open_dispute(issuer, cleared_txn_factory(age_days=120)).status_code == 201
    r = open_dispute(issuer, cleared_txn_factory(age_days=121))
    assert r.status_code == 422 and r.json()["type"].endswith("/dispute-window-closed")

def test_amount_cannot_exceed_cleared(issuer, cleared_txn):
    r = open_dispute(issuer, cleared_txn, amount=cleared_txn.amount + 1)
    assert r.status_code == 422 and r.json()["type"].endswith("/amount-exceeds-cleared")

def test_fraud_reason_needs_fraud_report(issuer, cleared_txn):
    r = open_dispute(issuer, cleared_txn, reason="10.4")
    assert r.status_code == 422 and r.json()["type"].endswith("/fraud-report-required")

def test_other_issuers_card_is_hidden(issuer, foreign_cleared_txn):
    assert open_dispute(issuer, foreign_cleared_txn).status_code == 404

def test_idempotent_retry(issuer, cleared_txn):
    key = str(uuid.uuid4())
    a, b = open_dispute(issuer, cleared_txn, key=key), open_dispute(issuer, cleared_txn, key=key)
    assert a.status_code == b.status_code == 201 and a.json()["id"] == b.json()["id"]

def test_representment_window(issuer, acquirer, cleared_txn, clock):
    d = open_dispute(issuer, cleared_txn).json()
    clock.advance(days=31)
    r = acquirer.post(f"/v1/disputes/{d['id']}/representment", json={"evidence_ids": ["evd_1"]})
    assert r.status_code == 422 and r.json()["type"].endswith("/representment-window-closed")
```

### Reference

**POST /v1/disputes**: opens a chargeback on a cleared transaction. Caller: the card's issuer. Safe to retry with the same `Idempotency-Key`.

| Field | Type | Required | Rules |
|---|---|---|---|
| clearing_id | string | yes | A clearing record on one of your cards, cleared ≤ 120 days ago |
| reason_code | string | yes | Hexa reason code, e.g. `10.4` fraud card-absent, `12.6` duplicate, `13.1` not received |
| amount | integer | yes | Cents, 1 … cleared amount minus amounts already disputed |
| currency | string | yes | ISO 4217, same as the clearing record |
| fraud_report_id | string | for `10.x` | The fraud report declared for this transaction |

```bash
curl -X POST "$API_BASE_URL/v1/disputes" \
  --cert "$MEMBER_CERT" --key "$MEMBER_KEY" \
  -H "Authorization: Bearer $ISSUER_TOKEN" \
  -H "Idempotency-Key: 7d2e..." \
  -d '{"clearing_id":"clr_7Qa21","reason_code":"10.4","amount":8990,"currency":"EUR","fraud_report_id":"frd_51K"}'
```

### Coverage

7 of 7 rules covered · 19 cases, 6 automated above · not covered: notifications to the acquirer (webhooks), arbitration after representment, rate limits (no spec). Fixtures must create their own cleared transactions in the test environment; a `clock` fixture is needed to test the 30-day window.
