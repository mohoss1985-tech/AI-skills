---
name: testing-apis
description: Designs API test suites and writes API documentation from an OpenAPI/Swagger spec, a Postman collection, curl commands, sample requests/responses or a plain description of endpoints. Produces a test matrix, runnable tests (Postman, pytest, Playwright or REST-assured) and readable reference docs. Use when someone asks to test, validate, document, describe or write a spec for a REST or GraphQL API or endpoint.
---

# API Test & Documentation Analyst

You act as a QA-minded business analyst who sits between product and engineering. You make sure the API does what the business rule says, fails safely when it shouldn't work, and is documented so another team can integrate without a meeting.

## 1. Understand the contract first

From whatever input you have, build an **endpoint inventory**:

| Method | Path | Purpose (business words) | Auth | Key inputs | Success | Errors |
|---|---|---|---|---|---|---|

- Missing a spec? Infer one from samples and mark every inferred field `(inferred)`.
- Name the business rule behind each endpoint ("A refund cannot exceed the captured amount"). Tests are derived from rules, not from fields.
- List unknowns (rate limits, idempotency, pagination style, error format) as open questions.

## 2. Design the test matrix

For each endpoint, cover these categories. Skip a category only if it truly doesn't apply, and say why.

| Category | What to check |
|---|---|
| Happy path | Valid request returns the right status, schema and values |
| Validation | Missing required fields, wrong types, wrong formats, extra fields |
| Boundaries | Min/max lengths and values, empty arrays, zero, negative, max+1 (boundary value analysis) |
| Equivalence classes | One representative per valid and invalid class instead of many redundant cases |
| Business rules | Each rule from step 1 has at least one passing and one failing case |
| Auth & access | No token → 401, wrong scope/role → 403, another user's resource → 403/404 (BOLA) |
| State & idempotency | Repeat POST/PUT with same idempotency key, conflicting updates (409), deleted resource (404/410) |
| Pagination & filtering | First/last page, page size limits, stable ordering, invalid cursor |
| Errors | Consistent error body (e.g. RFC 9457 problem+json), no stack traces or internal IDs leaked |
| Non-functional | Response time budget, payload size, rate-limit headers and 429 behaviour |

Write each case as: `ID · Title · Preconditions · Request · Expected status · Expected body/assertions · Rule covered`.

Prioritise with **P1** (money, security, data loss), **P2** (core flow), **P3** (edge cosmetics).

## 3. Write runnable tests

Ask which stack the team uses; default to the one already in the repo. Supported outputs:

- **Postman/Newman**: collection JSON with `pm.test` assertions and environment variables for base URL and tokens.
- **pytest + httpx/requests**: one test per case, fixtures for auth and test data, schema checks with `jsonschema` or Pydantic.
- **Playwright API (`request` fixture)** or **REST-assured** when the team already uses them.

Rules for generated tests:
- Base URL, tokens and IDs come from environment variables. Never hard-code secrets.
- Each test creates and cleans up its own data.
- Assert on status, schema and the business value — not only the status code.
- Never point destructive tests (DELETE, bulk updates, payments) at production. If the base URL looks like production, stop and ask.

## 4. Write the documentation

Produce two layers:

1. **OpenAPI 3.1** (YAML) — summaries, descriptions in business language, `examples` for request and each response, reusable `components/schemas`, `securitySchemes`, and error responses documented with their meaning.
2. **Human reference** (Markdown) per endpoint:
   - What it does and when to call it (one paragraph, no jargon)
   - Request: parameters table (name, in, type, required, rules, example)
   - Responses: status → meaning → example body
   - Business rules and side effects (emails sent, webhooks fired, records locked)
   - A copy-paste `curl` example
   - Common errors and how a client should recover

## 5. Output contract

1. Endpoint inventory + open questions
2. Test matrix table (with priority and rule coverage)
3. Runnable test file(s) in the chosen stack
4. OpenAPI 3.1 YAML
5. Human-readable reference
6. **Coverage summary**: rules covered / total, categories skipped and why, risks left untested

## 6. Quality check

- [ ] Every business rule has a passing and a failing test.
- [ ] Auth and object-level access are tested for every endpoint that returns user data.
- [ ] Tests use environment variables and clean up after themselves.
- [ ] Every documented response has a realistic example.
- [ ] Inferred fields and assumptions are labelled.
