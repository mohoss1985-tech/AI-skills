{"client": "Harbor Bank (sample)", "skill": "testing-apis", "lang": "en", "title": "Disputes API test plan (Visa chargebacks)"}
===INPUT===
Test plan for our internal Disputes API, used by the disputes back office to open Visa chargebacks. It sends them to Visa through our processor. pytest.

POST /v1/disputes
{ "transaction_id": "<ARN>", "condition_code": "10.4", "amount": 8990, "currency": "EUR", "fraud_report_id": "FR-2026-1182" }   (amount in cents)
Auth: OAuth2, role disputes-analyst. Header Idempotency-Key.
Rules (from our Visa dispute procedure):
- condition code must be one of the Visa dispute categories we handle: 10.x fraud, 11.x authorisation, 12.x processing errors, 13.x consumer disputes
- within 120 days of the transaction processing date (our procedure; some conditions have other limits, out of scope)
- 10.x fraud conditions need the fraud already reported to Visa for this transaction
- amount ≤ transaction amount minus amounts already disputed
- one open dispute per transaction
Returns 201 with status "submitted".
===OUTPUT===
### Endpoint inventory

| Method | Path | Purpose | Caller | Success | Errors |
|---|---|---|---|---|---|
| POST | /v1/disputes | Open a Visa chargeback on a cardholder transaction | Disputes analyst (back office) | 201 dispute | 400, 401, 403, 404, 409, 422 *(inferred)* |

**Business rules**
- **R1** `condition_code` belongs to a handled Visa dispute category: **10** fraud, **11** authorisation, **12** processing errors, **13** consumer disputes.
- **R2** Opened **within 120 days** of the transaction processing date.
- **R3** Fraud conditions (`10.x`) need a **fraud report already sent to Visa** for the same transaction.
- **R4** Amount ≤ transaction amount − amounts already disputed.
- **R5** **One open dispute** per transaction.
- **R6** The same `Idempotency-Key` returns the original dispute.
- **R7** Only the role `disputes-analyst` can open disputes.

**Open questions:** is day 120 inclusive? Which conditions have a different time limit in the current Visa rules (to list, then test)? Error format assumed RFC 9457.

### Test matrix

| ID | Case | Expect | Rule | Pri |
|---|---|---|---|---|
| DSP-01 | 13.1 (merchandise not received), full amount, day 30 | 201, `status: submitted` | — | P1 |
| DSP-02 | Condition `14.1` (not a handled category) | 422 `unknown-condition` | R1 | P1 |
| DSP-03 | Day 120 | 201 | R2 | P1 |
| DSP-04 | Day 121 | 422 `time-limit-exceeded` | R2 | P1 |
| DSP-05 | 10.4 without `fraud_report_id` | 422 `fraud-report-required` | R3 | P1 |
| DSP-06 | 10.4 with a fraud report of another transaction | 422 `fraud-report-mismatch` | R3 | P1 |
| DSP-07 | 10.4 with the matching fraud report | 201 | R3 | P1 |
| DSP-08 | Amount = transaction amount + 1 cent | 422 `amount-exceeds-transaction` | R4 | P1 |
| DSP-09 | Second partial dispute for the remaining amount, first one closed | 201 | R4 | P2 |
| DSP-10 | Second dispute while the first is open | 409 `dispute-already-open` | R5 | P1 |
| DSP-11 | Same Idempotency-Key, same body | 201 twice, same id | R6 | P1 |
| DSP-12 | Same key, different amount | 409 | R6 | P2 |
| DSP-13 | Token of a call-centre agent | 403 | R7 | P1 |
| DSP-14 | Unknown transaction id | 404 | — | P2 |
| DSP-15 | Error body | `type`, `title`, `detail`; no PAN, no stack trace | — | P2 |

### Tests

disputes_test.py
```python
import os, uuid, pytest, httpx

BASE = os.environ["API_BASE_URL"]

@pytest.fixture
def analyst():
    return httpx.Client(base_url=BASE, headers={"Authorization": f"Bearer {os.environ['ANALYST_TOKEN']}"})

def open_dispute(api, txn, condition="13.1", amount=None, key=None, **extra):
    body = {"transaction_id": txn.arn, "condition_code": condition, "amount": amount or txn.amount, "currency": txn.currency, **extra}
    return api.post("/v1/disputes", json=body, headers={"Idempotency-Key": key or str(uuid.uuid4())})

def test_time_limit_120_days(analyst, txn_factory):
    assert open_dispute(analyst, txn_factory(age_days=120)).status_code == 201
    r = open_dispute(analyst, txn_factory(age_days=121))
    assert r.status_code == 422 and r.json()["type"].endswith("/time-limit-exceeded")

def test_fraud_condition_needs_fraud_report(analyst, txn, fraud_report_for):
    r = open_dispute(analyst, txn, condition="10.4")
    assert r.status_code == 422 and r.json()["type"].endswith("/fraud-report-required")
    assert open_dispute(analyst, txn, condition="10.4", fraud_report_id=fraud_report_for(txn)).status_code == 201

def test_amount_cannot_exceed_transaction(analyst, txn):
    r = open_dispute(analyst, txn, amount=txn.amount + 1)
    assert r.status_code == 422

def test_one_open_dispute_per_transaction(analyst, txn):
    assert open_dispute(analyst, txn).status_code == 201
    assert open_dispute(analyst, txn).status_code == 409
```

### Reference

**POST /v1/disputes**: opens a Visa chargeback through the processor. Safe to retry with the same `Idempotency-Key`.

| Field | Type | Required | Rules |
|---|---|---|---|
| transaction_id | string | yes | ARN of a cleared transaction, processed ≤ 120 days ago |
| condition_code | string | yes | Visa dispute condition, e.g. `10.4` other fraud card-absent, `12.6` duplicate processing, `13.1` merchandise / services not received |
| amount | integer | yes | Cents, ≤ transaction amount − already disputed |
| currency | string | yes | Transaction currency |
| fraud_report_id | string | for `10.x` | The fraud report sent to Visa for this transaction |

### Coverage
7 of 7 rules · 15 cases, 4 automated above · not covered: conditions with other time limits (to list), the acquirer's response and pre-arbitration (separate API).
