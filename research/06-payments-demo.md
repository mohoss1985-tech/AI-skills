# 06 · Payments demo content for the V2 working tools

Companion files: `research/demo-api/harbor-bank-openapi.yaml` (OpenAPI 3.1, 8 paths, fixtures, 10 test cases, CB twin) and `research/demo-api/seed.sql` (SQLite. Ran clean with sqlite3 3.54; it builds 2,536 authorisations and the 5 questions return the answers given below).

## Sources

- Visa Developer quick start (sandbox is free; fees only at certification/production): https://developer.visa.com/docs/quick-start · two-way SSL / mTLS + CSR: https://developer.visa.com/pages/working-with-visa-apis/create-project · Hello World over mTLS: https://developer.visa.com/resources/learning-hub/helloworld-java
- Mastercard Developers sandbox, OAuth 1.0a with a .p12 signing key: https://developer.mastercard.com/user-account-management-service/documentation/tutorials-and-guides/sandbox-access-tutorial/ · signer library: https://unpkg.com/mastercard-oauth1-signer@1.2.0/README.md
- Stripe test cards (Visa, CB co-badged, lost/stolen/insufficient funds, dispute cards): https://docs.stripe.com/testing · secret key must stay server-side: https://stripe.com/ie/docs/development/get-started
- Adyen test cards, incl. Cartes Bancaires 4360 0000 0100 0005: https://docs.adyen.com/development-resources/test-cards-and-credentials/test-card-numbers · refusal reasons via magic holder name: https://docs.adyen.com/development-resources/testing/result-codes
- Checkout.com test cards and response codes (20051 = 51): https://www.checkout.com/docs/developer-resources/testing/test-cards · https://www.checkout.com/docs/developer-resources/testing/codes/api-response-codes
- Lithic sandbox, `POST /v1/simulate/authorize`, key from dashboard, not for automated testing at scale: https://docs.lithic.com/docs/simulate-auth · https://docs.lithic.com/docs/quick-start-send-requests
- Marqeta free public sandbox, Basic auth, `/simulations/cardtransactions/authorization`: https://www.marqeta.com/docs/developer-guides/core-api-quick-start · https://www.marqeta.com/docs/core-api/simulations-card-transactions
- Galileo sandbox on request: https://www.galileo-ft.com/request-access/ · Rapyd sandbox, HMAC request signatures: https://docs.rapyd.net/en/request-signatures.html · https://docs.rapyd.net/en/environments.html
- Visa dispute conditions (10.4 other fraud card-absent, 12.6 duplicate, 13.1 not received): https://usa.visa.com/run-your-business/merchant-support/merchant-disputes.html · https://www.visa.ca/dam/VCOM/download/merchants/chargeback-management-guidelines-for-visa-merchants.pdf · public Visa Rules (proprietary parts left out): https://www.visa.com/en-us/support/visa-rules.html
- Problem details format: RFC 9457, https://www.rfc-editor.org/rfc/rfc9457
- CORS checks run on 2026-11-08 with `curl -H "Origin: https://mohoss1985-tech.github.io"` (results below).

## Findings

### 1. No real card sandbox can run in a public browser demo

| Sandbox | Access | Browser call (CORS, 2026-11-08) | Usable in the static demo? |
|---|---|---|---|
| Visa Developer | Free account, **mutual TLS** (client certificate) or XPay token | A browser cannot present a client certificate from JS | **No** |
| Mastercard Developers | Free sandbox project, **OAuth 1.0a signed with a .p12 private key** | The private key would have to sit in the page | **No** |
| Stripe test mode | Free account, `sk_test_` secret key | Preflight **allowed** (ACAO echoes origin, `authorization` allowed) | Only with the visitor's **own** test key, never ours. Card-acquiring view, not issuer |
| Adyen test | Test account on request, API key + merchant account | Server-side API by design | No |
| Checkout.com | Sandbox account, secret key | Server-side | No |
| Lithic | Free sandbox key (issuer-side, has simulate authorise) | Preflight to `sandbox.lithic.com` returned **401, no CORS headers** | No (fine from the local app's Python proxy) |
| Marqeta | Free public sandbox, Basic auth | Server-side | Local app only |
| Galileo | Sandbox on request | — | No |
| Rapyd | Free sandbox, HMAC signature with secret key in each request | Secret in page = leak | No |
| httpbin.org, jsonplaceholder | No key | **ACAO returned** for our origin | Yes, but generic, not payments |
| postman-echo.com | No key | No ACAO seen on a simple GET | Not reliable |

Lesson: the schemes protect their sandboxes with keys or certificates a static page cannot hold. The issuer-side sandboxes closest to our use cases (Lithic, Marqeta) are server-side only. Stripe accepts browser calls but works from the acquirer side and needs a secret key.

### 2. Legal and safety

- **Test PANs:** gateways publish their test numbers (Stripe 4242…, Adyen CB 4360 0000 0100 0005, etc.). Copying another vendor's test list into our demo ties our behaviour to theirs. A clean option is our own Luhn-valid numbers under the `400000` test prefix (the prefix Stripe's decline cards use), each with a documented behaviour. **The mock refuses any PAN that is not in its fixture list** (rule A1). So if someone pastes a real card number, the demo never treats it as a card.
- **Names:** Harbor Bank and Banque Lumière are fictional. Merchant names are tagged "(demo)". The mock's problem URLs use the reserved `harbor.example` domain. No Visa or CB logos.
- **Scheme content:** response codes 00/05/41/43/51/54/59/91 are standard ISO 8583 values and published widely. Visa dispute condition numbers come from Visa's public merchant guides. The public Visa Rules leave proprietary detail out. CB2A field formats, GIE CB fraud-type lists and impayé reason codes are not public, so they stay *to confirm*.
- **Data minimisation in the demo itself:** URLs carry `card_id`, never a PAN. Responses return `pan_masked` (6+4). The SQL dataset stores bin + last4 + token only. This is the practice a BA should show anyway.

## Demo API · Harbor Bank Card API (and Banque Lumière twin)

Auth: header `X-API-Key: hb_test_demo_key` (all scopes) or `hb_test_readonly` (403 on writes). CB twin: `bl_test_demo_key`, server `mock://lumiere/v1`. POSTs accept `Idempotency-Key`. Errors use RFC 9457. The mock clock is frozen at 2026-11-08. `X-Mock-Fault: 500|503|504` forces server errors. Over 60 calls a minute returns 429.

| Endpoint | Rules it enforces |
|---|---|
| `GET /cards/{card_id}` | Masked PAN only; scopes |
| `POST /authorisations` | A1 unknown test PAN → 422; A2 issuer down → stand-in (≤ €100 → 00, else 05, `stip:true`) or 91 if no stand-in; A3 blocked → 41 / 43 / 05; A4 expired → 54; A5 fraud watch + ecom → 59; A6 funds → 51; A7 → 00. Declines are HTTP 200 |
| `POST /cards/{id}/block` | Reasons lost / stolen / used_without_permission; 409 if already blocked; lists the PAN on the Exception File, suspends wallet tokens, orders a replacement |
| `POST /cards/{id}/unblock` | Lost only, ≤ 24 h, no activity since the block |
| `POST /fraud-reports` | Transaction belongs to the card; fraud type 0–6 (*to confirm*); approved transactions only; one report per transaction |
| `POST /disputes` | 10/11/12/13.x only; ≤ 120 days, inclusive; 10.x needs that transaction's fraud report; amount ≤ remaining; one open dispute per transaction; scope `disputes:write` |
| `GET /disputes/{id}` | Status + history |
| `POST /_mock/reset` | Restores the fixtures (the tester calls it before each case) |

**Test PANs** (Luhn-valid): `4000000000001014` approved · `…1023` 51 · `…1032` 54 · `…1041` 41 · `…1050` 43 · `…1069` 59 on ecom · `…1078` issuer down, stand-in · `…1087` spare card for block tests · CB `…2013` approved · `…2022` 05 · `…2031` 91.

**Ready-made test cases** (full requests and assertions in the YAML `x-test-cases`):
TC-01 no key → 401 · TC-02 card read has no `pan` field, < 500 ms · TC-03 contactless €42.50 → 00 + 6-character auth code · TC-04 data-driven decline table (51, 54, 41, 43, 59) · TC-05 stand-in €45 → 00 / €250 → 05, `stip:true` · TC-06 block stolen → Exception File listed, tokens suspended, next authorisation 43, block again 409 · TC-07 stolen can't be unblocked, lost can · TC-08 fraud report 201, then duplicate 409, then declined transaction 422 · TC-09 10.4 without a fraud report → 422, an already-open dispute → 409 · TC-10 day 120 → 201, day 121 → 422.

These cases answer the owner's "3–4 variables" question: **method + URL, API key, body (or path id), expected status/field**.

## Demo dataset for SQL (`seed.sql`)

| Table | Rows | Columns |
|---|---|---|
| merchants | 12 | merchant_id, name, mcc, country, city, channel, acquirer |
| cards | 20 (14 Visa, 6 CB) | card_id, brand, issuer, bin, last4, pan_token, product, segment, status, block_reason, blocked_at, exception_file_listed_at, expiry, limit_minor, country, opened_on |
| authorisations | 2,536 | auth_id, auth_ts, card_id, merchant_id, scheme, channel, entry_mode, amount_minor, currency, response_code, stip, arn, cleared |
| fraud_reports | 15 | fraud_report_id, auth_id (unique), card_id, fraud_type, case_id, confirmed_on, reported_at, amount_minor, currency, status |
| disputes | 14 | dispute_id, auth_id, condition_code, amount_minor, currency, status, opened_at, closed_at, fraud_report_id |

Distribution (October 2026): 88.3 % approved · 51 5.5 % (higher in the last week of the month) · 05 3.3 % · 59 2.2 % · 54 0.4 % · 43/41 0.2 % · 91 0.1 % · stand-in 0.8 %. Channels: 56 % pos, 36 % ecom, 8 % ATM. The rows are generated deterministically with a recursive CTE, so every run gives the same answers. Five stories are planted in the data, one for each question:

| # | Analyst question | Answer the query returns |
|---|---|---|
| Q1 | Daily approval rate and stand-in share: which day had a host problem? | 14 Oct: stand-in 3.8 %, the only 91s (CB has no stand-in) |
| Q2 | Decline codes by channel | 51 leads pos/ATM (57 %); in ecom 59 reaches 27 % |
| Q3 | Merchant-days with 59 ≥ 20 % | M-011 QuickGift Codes, 17 Oct, 28 of 41 (card testing) |
| Q4 | Disputes that break the procedure | DSP-2026-0021 opened day 127; DSP-2026-0022 10.4 without fraud report |
| Q5 | Approvals after a block | crd_hb_009 approved in **stand-in** 75 min after the block; Exception File listing took 160 min (SFD target: 5 min) |

The SQL for Q1–Q5 is at the end of `seed.sql`. Q4 refers to a column alias in WHERE, which SQLite accepts. When the tool exports to PostgreSQL it must rewrite that as a subquery.

## Seed inputs for the other tools

Each one is minimal: 3–4 fields, all filled.

**PRD (EN)**. Product: Harbor Bank app · Problem: "Cardholders call to block a lost card; 6 min average wait, 1 in 5 cards used fraudulently before the block" (*illustrative figures*) · Users: cardholder, call-centre agent, fraud analyst · Success: 80 % of blocks self-served, block live everywhere in < 5 min. FR: Banque Lumière, mise en opposition, remboursement J+1 (CMF L133-18).

**User stories**. Feature: "Block a lost or stolen card and flag unknown payments". Rules: reasons lost / stolen / used without permission; unblock of a lost card within 24 h; flags cover the last 90 days. Persona: cardholder in the app.

**BPMN**. "Cardholder declares the card in the app → app calls the block API → CMS and authorisation host block → PAN listed on Exception File (retry 3× then alert ops) → tokens suspended → cardholder flags transactions → fraud analyst confirms within 2 working days → fraud report to Visa → dispute 10.x." Lanes: Cardholder, App, Card IT, Visa, Fraud ops.

**WSJF backlog** (same data as the V1 sample, so V1 and V2 screens match). WSJF = (BV+TC+RR/OE) ÷ size:

| ID | Feature | BV | TC | RR/OE | Size | WSJF | Pts | Needs |
|---|---|---|---|---|---|---|---|---|
| F-07 | Suspend wallet tokens on block | 8 | 8 | 13 | 3 | 9.67 | 13 | F-06 |
| F-02 | Blocked PANs to Exception File automatically | 8 | 13 | 20 | 5 | 8.20 | 21 | F-06 |
| F-06 | Real-time block API (enabler) | 3 | 13 | 20 | 5 | 7.20 | 21 | — |
| F-01 | Block a lost/stolen card in the app | 20 | 13 | 13 | 8 | 5.75 | 34 | F-06 |
| F-03 | Fraud declaration workflow | 13 | 8 | 13 | 8 | 4.25 | 30 | — |
| F-05 | Explain declined payments (response codes) | 5 | 2 | 2 | 3 | 3.00 | 13 | — |
| F-08 | Merchant category controls | 5 | 2 | 3 | 8 | 1.25 | 26 | — |
| F-04 | Open disputes from the fraud declaration | 8 | 3 | 5 | 13 | 1.23 | 40 | F-03 |

Capacity 120 pts. F-08 and F-04 are almost tied, which makes a good live demo of how the size estimate changes the order.

**UAT campaign**. "PAN declaration release, UAT 3–14 Nov, 12 cases": UAT-01…04 block per reason and channel (app, call centre); UAT-05 Exception File listing ≤ 5 min; UAT-06 tokens suspended; UAT-07 unblock lost < 24 h; UAT-08 unblock refused for stolen; UAT-09 flag transactions (90 days); UAT-10 fraud report sent; UAT-11 dispute 10.4 opened; UAT-12 FR labels. Status on day 8: 9 pass, 1 fail (UAT-05, 160 min in stand-in, the same story as SQL Q5), 2 not run. Exit criteria: 100 % P1 passed, no open blocking defect. Each case can call the demo API (TC-06 = UAT-03 + UAT-06).

**Data mapping**. Fraud case → scheme report:

| Case tool field | Visa fraud report (EN) | CB déclaration (FR) |
|---|---|---|
| arn | transaction identifier (ARN) | référence de la transaction (*to confirm*) |
| card_token | PAN via token vault, never in the file | PAN via token vault |
| fraud_reason | fraud type 0–6 (*to confirm* against current Visa rules) | type de fraude GIE CB (*to confirm*, list not public) |
| txn_date / confirmed_at | transaction date / fraud reported date | date opération / date de déclaration |
| amount, currency | amount (minor units), currency ISO 4217 | montant, devise |
| pos_entry | POS entry mode → CHIP/CONTACTLESS/ECOM/MAGSTRIPE/MANUAL | mode de lecture (*to confirm* codes) |
| — | reporting deadline *to confirm* | délai de déclaration *to confirm* |

## Decisions for Analyst Kit V2

1. **The API tester's default target is an in-browser mock of the Harbor Bank Card API**, built from `harbor-bank-openapi.yaml`. It is a `fetch` interceptor or Service Worker answering `mock://harbor/v1/...` and `mock://lumiere/v1/...`. It runs in the public static demo with no network and no keys. The local app also serves the same mock at `http://localhost:4317/mock/harbor/v1`, so the curl, Postman and pytest exports actually run.
2. **Real HTTP stays possible**: any URL works. The demo shows one live call to `https://httpbin.org/anything`, which returned CORS headers for our origin, to prove requests really leave the browser. Stripe, Lithic and Marqeta go in a "bring your own test key" help panel. In the local app those calls go through the Python proxy, which avoids CORS. We never ship a key of ours.
3. **The 4 inputs on the tester's first screen**: method + URL, auth (API key header, prefilled), parameters/body (form generated from the schema), expected result (status + 1–3 field assertions). Headers, idempotency and fault injection go in "Advanced".
4. **Ship the 10 `x-test-cases` as "Try a test case" chips.** TC-04 shows the data-driven table. Each case resets the mock first.
5. **Safety rule in product copy:** "Only the demo test cards work. Never paste a real card number." The mock enforces it (422 `unknown-test-pan`), and the tester warns when someone types a Luhn-valid number that is not in the fixtures.
6. **The SQL tool loads `seed.sql` into sql.js** and offers Q1–Q5 as starter questions. Expected answers are stored, so the tool can show "✓ matches the sample". The SQLite dialect is the default, and the PostgreSQL export is a rewrite.
7. **One storyline across tools**: the 18 Oct Exception File delay (crd_hb_009) shows up in SQL Q5, the failed UAT-05, the BPMN retry path and WSJF item F-02. This makes the demo feel like one real project.
8. **Keep *to confirm* markers** on CB2A codes, GIE CB fraud types and reporting deadlines, Visa fraud-type values, impayé reason codes and the 120-day exceptions. The tools render them as amber badges.
9. **No vendor test-card lists copied in.** We document our own fixtures and link to vendor pages for anyone who wants a real sandbox.
