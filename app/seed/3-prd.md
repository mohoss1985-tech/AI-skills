{"client": "Hexa card scheme (sample)", "skill": "writing-prds", "title": "PRD: real-time fraud score in authorisation"}
===INPUT===
One-page PRD for the real-time fraud score (LCLF).

We see the authorisations of all our member issuers; each issuer sees only its own cards. Card-not-present fraud is growing: 0.17% of CNP value last year vs 0.11% two years ago (our numbers). Most fraud attacks test many cards across several issuers in minutes (card testing, BIN attacks), which a single issuer can't see. Idea: score every authorisation request centrally in real time (0-999) with reason codes and send it in the request to the issuer, who keeps the decision. Latency budget: we add at most 15 ms. Issuers ask for it (survey: 14 of 22 issuers want it). Small issuers have no fraud engine of their own. Pilot with 3 issuers in Q2, all issuers by end of year. Not in scope: the scheme declining transactions itself (except in stand-in).
===OUTPUT===
# Real-time fraud score in authorisation

**Owner:** PO Authorisation & Fraud · **Status:** draft for review · **Pilot:** Q2 with 3 issuers · **Target:** all issuers by year end

## TL;DR
Score every authorisation request centrally, in real time, using what only the scheme sees (traffic across all issuers), and send the score with reason codes to the issuer, who keeps the decision. Goal: cut card-not-present fraud by a quarter in the pilot without hurting approval rates.

## 1. Problem
- **Card-not-present fraud is rising:** 0.17% of CNP value last year vs 0.11% two years ago.
- **The attacks cross issuers.** Card testing and BIN attacks try many cards at several issuers within minutes. Each issuer sees only its own cards, so it sees a few odd attempts, not the attack.
- **Small issuers have no fraud engine** and rely on static rules.
- **Demand:** 14 of 22 issuers asked for a network score in the last member survey.

## 2. Goals and non-goals
**Goals**
- G1: give every issuer a **network-level risk signal** in the authorisation request, in real time.
- G2: reduce **CNP fraud value** at pilot issuers.
- G3: keep **approval rates** for genuine cardholders unchanged.

**Non-goals**
- The scheme **doesn't decline** transactions on the issuer's behalf, except in stand-in (STIP) when the issuer has set a score threshold for it.
- No change to the merchant or acquirer side in this release.
- No cardholder-facing feature.

## 3. Success metrics
| Metric | Baseline | Target (pilot, 3 months) | Type |
|---|---|---|---|
| CNP fraud value / CNP value at pilot issuers | 0.17% | **−25%** | Primary |
| Approval rate of genuine CNP transactions | per issuer | **no drop > 0.2 pt** | Guardrail |
| Added latency, 99th percentile | — | **≤ 15 ms** | Guardrail |
| Share of fraud with a score ≥ 800 (detection) | — | ≥ 60% | Secondary |
| Score availability in requests | — | ≥ 99.95% | Guardrail |

## 4. Scope
| ID | Requirement | Priority |
|---|---|---|
| FR-1 | Every authorisation request routed to an issuer carries a **score 0–999** and up to **3 reason codes** | Must |
| FR-2 | If scoring fails or exceeds its time budget, the request goes **without a score** and with a "not scored" flag; it is never delayed further | Must |
| FR-3 | Issuers opt in per BIN range in the member portal | Must |
| FR-4 | Issuers can set a **score threshold for stand-in**: above it, STIP declines | Should |
| FR-5 | The score and reason codes are kept with the authorisation and carried into the **clearing record**, for fraud reporting and disputes | Should |
| FR-6 | Issuers get a **monthly performance report**: fraud caught per score band, false positives | Should |
| FR-7 | Issuers send their **fraud reports (LCLF declarations)** back to us; they feed the model | Must (already exists, check quality) |

## 5. Risks and assumptions
| Type | Item | Mitigation |
|---|---|---|
| Risk | Added latency pushes issuers into time-outs | Hard 15 ms budget, FR-2 fallback, load test at 3× peak |
| Risk | Issuers over-trust the score and decline genuine customers | Reason codes, monthly report, guidance pack |
| Risk | Model drifts as fraudsters adapt | Weekly monitoring, retrain monthly on fraud reports |
| Assumption | Fraud reports arrive within 30 days | Check per issuer before the pilot |
| Assumption | Message format has room for the score (reserved field) | Confirm with the message format owner |
| Dependency | GDPR and competition review of data use across issuers | Legal and DPO before the pilot |

## 6. Open questions
1. Is the score **free** for issuers or part of a paid service? (pricing committee)
2. Which **3 pilot issuers**: one large, one mid-size, one without a fraud engine?
3. Do we show the score to **acquirers**? (not in this release; to decide for next year)
4. Legal basis and DPIA for using cross-issuer data: **DPO**.
