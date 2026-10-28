{"client": "Paylo (sample)", "skill": "testing-apis", "title": "Refunds endpoint test plan", "input_tokens": 2610, "output_tokens": 1720, "seconds": 52}
===INPUT===
Write tests and docs for this endpoint. We use pytest.

POST /v1/refunds
Body: { "payment_id": "pay_8Hk2", "amount": 4500, "currency": "EUR" }   (amount in cents)
Header: Idempotency-Key
Rules: a refund can't exceed the amount captured on the payment (minus earlier refunds). Only the merchant who owns the payment can refund it.
Returns 201 with the refund object.
===OUTPUT===
### Endpoint inventory

| Method | Path | Purpose | Auth | Success | Errors |
|---|---|---|---|---|---|
| POST | /v1/refunds | Return money to a customer for a captured payment | Bearer (merchant) | 201 refund | 400, 401, 404, 409, 422 *(inferred)* |

**Business rules**
- **R1** Refund ≤ captured amount − earlier refunds.
- **R2** Only the owning merchant can refund.
- **R3** The same Idempotency-Key returns the original refund and never creates a second one.

**Open questions:** error body format (assumed RFC 9457), partial refund limit per day, behaviour on currency mismatch.

### Test matrix

| ID | Case | Expect | Rule | Pri |
|---|---|---|---|---|
| RF-01 | Refund equal to remaining amount | 201, status `succeeded` | R1 | P2 |
| RF-02 | Remaining + 1 cent | 422 `refund-exceeds-capture` | R1 | P1 |
| RF-03 | Two partial refunds summing above capture | 2nd → 422 | R1 | P1 |
| RF-04 | amount = 0 / negative | 422 | — | P2 |
| RF-05 | Currency ≠ payment currency | 422 | — | P2 |
| RF-06 | No token | 401 | — | P1 |
| RF-07 | Another merchant's payment | 404 (no leak) | R2 | P1 |
| RF-08 | Same Idempotency-Key twice | 201, same refund id | R3 | P1 |
| RF-09 | Same key, different body | 409 | R3 | P2 |
| RF-10 | Error body has no stack trace | `type`, `title`, `detail` only | — | P2 |

### Tests

```python
import os, uuid, pytest, httpx

BASE = os.environ["API_BASE_URL"]

@pytest.fixture
def api():
    return httpx.Client(base_url=BASE, headers={"Authorization": f"Bearer {os.environ['MERCHANT_TOKEN']}"})

def refund(api, payment, amount, key=None):
    return api.post("/v1/refunds", json={"payment_id": payment.id, "amount": amount, "currency": payment.currency},
                    headers={"Idempotency-Key": key or str(uuid.uuid4())})

def test_refund_cannot_exceed_capture(api, captured_payment):
    r = refund(api, captured_payment, captured_payment.amount + 1)
    assert r.status_code == 422
    assert r.json()["type"].endswith("/refund-exceeds-capture")

def test_partial_refunds_respect_remaining(api, captured_payment):
    assert refund(api, captured_payment, captured_payment.amount - 100).status_code == 201
    assert refund(api, captured_payment, 101).status_code == 422

def test_idempotent_retry_returns_same_refund(api, captured_payment):
    key = str(uuid.uuid4())
    a, b = refund(api, captured_payment, 500, key), refund(api, captured_payment, 500, key)
    assert a.status_code == b.status_code == 201
    assert a.json()["id"] == b.json()["id"]

def test_other_merchants_payment_is_hidden(api, foreign_payment):
    assert refund(api, foreign_payment, 100).status_code == 404
```

### Reference

**POST /v1/refunds** — Returns all or part of a captured payment to the customer. Safe to retry with the same `Idempotency-Key`.

| Field | Type | Required | Rules |
|---|---|---|---|
| payment_id | string | yes | A captured payment you own |
| amount | integer | yes | Cents, 1 … remaining refundable |
| currency | string | yes | ISO 4217, must match the payment |

```bash
curl -X POST "$API_BASE_URL/v1/refunds" \
  -H "Authorization: Bearer $MERCHANT_TOKEN" \
  -H "Idempotency-Key: 3f1c..." \
  -d '{"payment_id":"pay_8Hk2","amount":4500,"currency":"EUR"}'
```

### Coverage

3 of 3 rules covered · rate limiting and webhooks not tested (no spec) · fixtures `captured_payment` and `foreign_payment` must create their own data.
