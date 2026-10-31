{"client": "Harbor Bank (sample)", "skill": "writing-prds", "lang": "en", "title": "PRD: declare a lost or stolen card in the app"}
===INPUT===
One-pager for lost / stolen card declaration in the app. We are a Visa issuer.

Today cardholders must call: 62% of lost/stolen declarations are by phone, average wait 6 min, peaks at 20 min on Saturdays. Fraud on lost/stolen cards was 1.4M€ last year; our analysis says 18% of it happened between the loss and the declaration. When a card is blocked, the PAN is added to the Visa Exception File by a nightly batch, so stand-in can still approve a stolen card for hours if our host is down. Want: block in the app in under a minute, Exception File updated in real time, cardholder flags unknown transactions so fraud ops can declare the fraud and dispute. Replacement card ordered in the same flow. Deadline: before summer peak (June).
===OUTPUT===
# Declare a lost or stolen card in the app

**Owner:** PO Cards · **Status:** draft for review · **Target:** live before June

## TL;DR
Let cardholders block a lost or stolen card in the app in under a minute, list the PAN on the Visa Exception File immediately, and flag unrecognised transactions so fraud operations can declare the fraud and open disputes. Goal: cut the fraud that happens between loss and declaration.

## 1. Problem
- **Declaring takes too long.** 62% of declarations are by phone, with a 6-minute average wait and 20-minute peaks on Saturdays.
- **Fraud happens in the gap.** 1.4M€ of lost / stolen card fraud last year; **18%** happened between the loss and the declaration.
- **Stand-in gap.** The Exception File is updated by a nightly batch, so Visa Stand-In Processing can approve a blocked card for hours when our host is unavailable.

## 2. Goals and non-goals
**Goals**
- G1: a cardholder blocks a card in the app in **under 60 seconds**.
- G2: a blocked PAN is **declined everywhere at once**, including in stand-in.
- G3: unrecognised transactions reach fraud operations the same day, for the fraud declaration and the dispute.

**Non-goals**
- Unblocking a card declared **stolen** (a new card is always issued).
- Disputes for non-fraud reasons (goods not received…): separate project.

## 3. Success metrics
| Metric | Baseline | Target (3 months after launch) | Type |
|---|---|---|---|
| Share of declarations made in the app | 38% | **70%** | Primary |
| Lost / stolen fraud value between loss and declaration | 18% of 1.4M€ | **−40%** | Primary |
| Time from block to Exception File listing | up to 24 h | **< 5 min** | Guardrail |
| Calls to the lost / stolen line | per month | −50% | Secondary |
| Cards blocked by mistake (unblocked within 24 h, reason "lost") | — | tracked | Guardrail |

## 4. Scope
| ID | Requirement | Priority |
|---|---|---|
| FR-1 | The cardholder blocks a card in the app with a reason: **lost**, **stolen** or **used without my permission** | Must |
| FR-2 | The block is effective on the authorisation host immediately: next authorisation declined with **41** (lost) or **43** (stolen) | Must |
| FR-3 | The PAN is added to the **Visa Exception File** with the matching action in under 5 minutes | Must |
| FR-4 | The cardholder sees the last 30 days of transactions and flags the ones they don't recognise | Must |
| FR-5 | Flagged transactions create a case for fraud operations, who confirm and **declare the fraud to Visa** before any dispute | Must |
| FR-6 | A replacement card with a **new PAN** is ordered in the same flow | Should |
| FR-7 | Wallet tokens (Apple Pay, Google Pay) linked to the card are suspended | Should |
| FR-8 | A card blocked as **lost** can be unblocked by the cardholder within 24 h if found; **stolen** cannot | Could |

## 5. Risks and assumptions
| Type | Item | Mitigation |
|---|---|---|
| Risk | Cardholder blocks the wrong card | Show card image and last 4 digits, confirmation step |
| Risk | Real-time Exception File update not available with our processor | Check with the processor in week 1; fallback: hourly batch |
| Assumption | Fraud operations can absorb more cases | Size from the pilot |
| Dependency | Visa fraud reporting and dispute rules (deadlines, condition codes) | Confirm against the current Visa Core Rules |

## 6. Open questions
1. Does the block also stop recurring payments (subscriptions), or only new authorisations?
2. Who pays for the replacement card when the reason is "lost"?
3. What do we tell the cardholder about their liability for transactions before the declaration? (Legal)
