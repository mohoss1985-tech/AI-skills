{"client": "Hexa card scheme (sample)", "skill": "writing-functional-specs", "title": "SFD: fraud score in the authorisation request"}
===INPUT===
SFD for the fraud score in authorisation, from workshops 1 and 2.

Decided: score 0-999 + up to 3 reason codes (2 chars each) in a reserved field of the authorisation request to the issuer (field "network data", tag RS). Budget 15 ms, if late: no score + flag "not scored" (RS status N). Opt-in per BIN range (8 digits), set in the member portal, active at 02:00 next night. Stand-in: issuer threshold, decline with response code 59 (suspected fraud) if score ≥ threshold. Stand-in advice to the issuer includes the score. Score and reason codes stored with the authorisation and copied into the clearing record when matched (pilot: yes, decided in workshop 2). Legal OK with conditions: score not sent to acquirers or merchants, model inputs listed in the member rules. Reason codes: CT card testing, ND new device across network, MA merchant under attack, VE velocity across issuers, GE geography mismatch. Pilot: 3 issuers.
===OUTPUT===
## SFD · Real-time fraud score in the authorisation request

### 1 · Document control
| Version | Status | Author | Reviewers |
|---|---|---|---|
| 0.9 | For review | BA, Authorisation & Fraud | Nadia (sponsor), Thomas (Authorisation platform), Inès (Data science), Legal, pilot issuers |

**Change log:** 0.9: first version after workshops 1 and 2.

### 2 · Context and objectives
The scheme sees the authorisation traffic of all its issuers. A network-level score detects attacks that cross issuers (card testing, BIN attacks) and that no single issuer can see. This spec describes how the score is computed in the authorisation flow, sent to the issuer, used in stand-in and carried into clearing.

**Objective:** every opted-in authorisation request reaches the issuer with a score, within 15 ms of added latency, and the issuer keeps the decision.

### 3 · Scope
**In scope:** scoring of authorisation requests on opted-in BIN ranges; the score field in the request to the issuer; stand-in decline above the issuer's threshold; the score in stand-in advices; the score in matched clearing records.
**Out of scope:** the score in responses to acquirers and merchants (excluded by Legal); the member portal screens (separate stories); model training.
**Assumptions:** the reserved field RS is free in every issuer's message version; the 3 pilot issuers are certified before go-live.

### 4 · Actors and rights
| Action | Issuer | Scheme authorisation platform | Acquirer / merchant |
|---|---|---|---|
| Opt BIN ranges in / out, set stand-in threshold | ✅ (member portal, 4-eyes) | — | — |
| Receive score in the request | ✅ | sends | ❌ never |
| Decide approve / decline | ✅ | only in stand-in | — |
| See score in clearing records | ✅ (own cards) | stores | ❌ |

### 5 · Target process
1. The authorisation request arrives from the acquirer.
2. If the card's BIN range is opted in (RG-01), the platform calls the scoring service with a **15 ms** budget (RG-02).
3. The score and reason codes are written in field RS (RG-03, RG-04) and the request is routed to the issuer.
4. **Issuer available:** the issuer decides; the scheme forwards the response unchanged.
5. **Issuer unavailable:** stand-in applies the issuer's limits and the score threshold (RG-05), then sends an advice with the score (RG-06).
6. The score is stored with the authorisation, and copied into the clearing record when matched (RG-07).

**Error path:** scoring service down or late → RS status `N` ("not scored"), routing continues with no extra delay.

### 6 · Business rules
| ID | Rule | Example | Source |
|---|---|---|---|
| RG-01 | If the card's 8-digit BIN range is opted in and active, the request is scored; otherwise RS is absent. A change of opt-in is active from 02:00 the next night. | Range 45671200–45671299 opted in Tuesday, scored from Wednesday 02:00 | D-04 |
| RG-02 | If the scoring service hasn't answered within 15 ms, the request is sent with RS status `N` and no score. | Answer after 18 ms → `N`, answer discarded | D-02 |
| RG-03 | RS carries: status (`S` scored / `N` not scored), score 000–999, and 0 to 3 reason codes, highest contribution first. | `S` `912` `CT` `VE` | D-01 |
| RG-04 | Reason codes: `CT` card testing · `ND` new device across the network · `MA` merchant under attack · `VE` velocity across issuers · `GE` geography mismatch. Unknown codes are never sent. | — | Reason code guide |
| RG-05 | In stand-in, if the issuer has a threshold for the range and score ≥ threshold, decline with response code **59** (suspected fraud). Otherwise stand-in applies the usual limits. Unscored requests (`N`) ignore the threshold. | Threshold 850, score 850 → 59; score 849 → usual limits | D-03 |
| RG-06 | Every stand-in advice to the issuer carries RS as sent or computed. | — | Workshop 2 |
| RG-07 | When a clearing record is matched to an authorisation, the score, status and reason codes are copied into it. Unmatched records have no score. | — | Q-01, workshop 2 |
| RG-08 | The score is **never** sent in responses to acquirers, in merchant reports, or in acquirer clearing files. | — | Legal |

### 7 · Message fields
**Field RS · Network risk data** (authorisation request and stand-in advice to the issuer)

| Sub-field | Type | Length | Values | Rule |
|---|---|---|---|---|
| RS.1 status | alpha | 1 | `S` scored, `N` not scored | RG-02, RG-03 |
| RS.2 score | numeric | 3 | 000–999, absent if `N` | RG-03 |
| RS.3 reason codes | alpha | 0–6 | up to 3 × 2 characters from RG-04 | RG-03, RG-04 |

**Response code used by stand-in:** 59 suspected fraud (RG-05).

### 8 · Messages
No end-user screen in this spec. Issuer-facing texts (member portal, monthly report) are in the portal stories. The reason code guide (A-02) is the reference text for issuer analysts.

### 9 · Data
| Data | Where | Retention |
|---|---|---|
| Score, status, reason codes | Authorisation log; clearing record (RG-07) | As authorisation and clearing data *(to confirm with the DPO)* |
| Opt-in and thresholds per BIN range, with history | Member configuration | Life of the membership |
| Model inputs | Listed in the member rules (Legal condition) | — |

### 10 · Interfaces
| Interface | Direction | Trigger | Content | Errors |
|---|---|---|---|---|
| Scoring service (internal) | Platform → scoring | Each opted-in request | Request data allowed by the member rules | Timeout 15 ms → RG-02 |
| Authorisation request to issuer | Scheme → issuer | Each request | Field RS | As today |
| Stand-in advice | Scheme → issuer | Each stand-in decision | Field RS | As today |
| Clearing record to issuer | Scheme → issuer | Matching | Score, status, reason codes | Unmatched: no score |

### 11 · Non-functional requirements
- Added latency **≤ 15 ms at the 99th percentile**, measured at the platform.
- Scoring available ≥ 99.95% of requests on opted-in ranges (status `S`).
- Load test at 3× the yearly peak (Black Friday).
- Every configuration change audited (who requested, who approved, when).

### 12 · Traceability
| Requirement | Rules | Fields |
|---|---|---|
| REQ-01 score and reason codes | RG-01, RG-03, RG-04 | RS.1–RS.3 |
| REQ-02 latency, fallback | RG-02 | RS.1 = `N` |
| REQ-03 stand-in threshold | RG-05, RG-06 | Response code 59 |
| REQ-05 score in clearing | RG-07 | Clearing record |
| Legal condition | RG-08 | — |

### 13 · Acceptance test ideas
- RG-01: request on an opted-in range → RS present; on a non-opted range → RS absent; opt-in approved at 16:00 → scored only after 02:00.
- RG-02: scoring stub answers at 14 ms → `S`; at 16 ms → `N`, no extra delay.
- RG-05: threshold 850 with score 849, 850, 851; status `N` in stand-in → usual limits only.
- RG-07: matched clearing record carries the score; unmatched one doesn't.
- RG-08: acquirer response, acquirer clearing file and merchant report contain no score.

### 14 · Open points
| Question | Owner | Due |
|---|---|---|
| Retention period of the score in logs and clearing | DPO | Before UAT |
| RS free in every issuer message version? | Thomas | Certification plan |
| Monthly performance report content (FR-6) | Inès | Next sprint |

> **Review box:** 8 rules · 1 field with 3 sub-fields · 4 interfaces · 3 open points. Riskiest assumptions: the 15 ms budget holds at peak; field RS is free for every issuer; Legal's conditions don't change the model inputs.
