{"client": "Harbor Bank (sample)", "skill": "writing-functional-specs", "lang": "en", "title": "SFD: PAN declaration (block, Exception File, fraud report)"}
===INPUT===
SFD for the PAN declaration, from workshops 1 and 2. Visa issuer.

Decided: reasons lost / stolen / used without permission. Block real time in card management system (CMS) + authorisation host; response 41 lost, 43 stolen, 59 for "used without permission"? (Priya: we use 62 restricted card? no — decided: 05 do not honor for "used without permission", agents see the reason). Exception File: processor confirmed real-time update API, listing within 5 min. Wallet tokens suspended. Lost card: unblock by cardholder within 24h allowed (Legal OK if no transaction since block). Stolen/used without permission: no unblock, new PAN. Cardholder flags unknown transactions (last 90 days); fraud ops confirm within 2 working days, then fraud report to Visa (fraud type per transaction), then dispute (10.x). Replacement card ordered automatically except "used without permission" where cardholder chooses. Channels: app, call centre tool.
===OUTPUT===
## SFD · PAN declaration: block, Exception File and fraud report

### 1 · Document control
| Version | Status | Author | Reviewers |
|---|---|---|---|
| 0.9 | For review | BA, Cards | Ana (sponsor), Tom (Card IT), Priya (Fraud ops), Kim (Disputes), Legal |

### 2 · Context and objectives
A cardholder declares a card lost, stolen or used without permission. The card must be refused everywhere at once (our host, and Visa Stand-In Processing through the Exception File), the cardholder's unrecognised transactions must reach fraud operations, and confirmed fraud must be reported to Visa so it can be disputed.

### 3 · Scope
**In scope:** declaration in the app and in the call-centre tool; block in the CMS and the authorisation host; Exception File listing; wallet token suspension; flagging of unrecognised transactions; fraud confirmation and fraud report to Visa; replacement card; unblock of a lost card.
**Out of scope:** the dispute itself (separate SFD), non-fraud disputes, card controls.

### 4 · Actors and rights
| Action | Cardholder (app) | Call-centre agent | Fraud analyst |
|---|---|---|---|
| Declare and block | ✅ | ✅ | — |
| Flag unrecognised transactions | ✅ | ✅ on behalf | — |
| Confirm fraud, send fraud report | — | — | ✅ |
| Unblock a lost card (≤ 24 h) | ✅ | ✅ | — |

### 5 · Target process
1. The cardholder or agent picks the card and the reason (RG-01).
2. The block is applied in the CMS and on the authorisation host (RG-02), the PAN is listed on the Exception File (RG-03), wallet tokens are suspended (RG-04).
3. The cardholder flags unrecognised transactions (RG-05); a fraud case is created.
4. The fraud analyst confirms each transaction within 2 working days and sends the fraud report to Visa (RG-06, RG-07).
5. A replacement card is ordered (RG-08).

**Error path:** Exception File update fails → retry every minute for 15 minutes, then alert card operations (RG-03).

### 6 · Business rules
| ID | Rule | Example |
|---|---|---|
| RG-01 | Reason is one of: **lost**, **stolen**, **used without my permission**. | Card in pocket but unknown payment → "used without my permission" |
| RG-02 | After the block, authorisations are declined with **41** (lost), **43** (stolen) or **05** (used without permission), within 5 seconds of confirmation. | Blocked 10:02:10, authorisation at 10:02:20 → 43 |
| RG-03 | The PAN is listed on the Visa Exception File with the action matching the reason, within **5 minutes**. If the update fails, retry every minute for 15 minutes, then alert card operations. | Processor API down → alert at 10:17 |
| RG-04 | Wallet tokens linked to the card are suspended at the block. | Apple Pay token on the iPhone stops working |
| RG-05 | The cardholder can flag transactions of the **last 90 days** as unrecognised. Pending authorisations can be flagged; they become fraud reports only once cleared. | 3 e-commerce payments on 2 Nov flagged |
| RG-06 | The fraud analyst confirms or rejects each flagged transaction within **2 working days**. | — |
| RG-07 | Each confirmed transaction is reported to Visa with a fraud type (lost, stolen, card-not-present use…) **before** a fraud dispute can be opened. | Confirmed on 4 Nov → reported 4 Nov → dispute possible |
| RG-08 | Lost or stolen: a replacement card with a **new PAN** is ordered automatically. Used without permission: the cardholder chooses a replacement now or later. | — |
| RG-09 | A card blocked as **lost** can be unblocked by the cardholder within **24 h**, only if no transaction was attempted since the block. Stolen and used without permission can never be unblocked. | Lost Saturday 18:00, found Sunday 10:00, no attempt → unblocked |

### 7 · Screens and fields
**E-01 · Declare a card (app)**
| Field | Type | Values | Rule |
|---|---|---|---|
| Card | choice | Cards of the cardholder: image + last 4 digits | — |
| Reason | choice | Lost · Stolen · Used without my permission | RG-01 |
| Confirmation | button | "Block this card" | RG-02 |

**E-02 · Unrecognised transactions** – list of the last 90 days, checkbox per transaction, "Send to our fraud team" (RG-05).

### 8 · Messages
| ID | When | Text |
|---|---|---|
| MSG-01 | After the block | "Your card ending {last4} is blocked. It can't be used anymore, including in Apple Pay or Google Pay." |
| MSG-02 | Lost card, within 24 h | "Found your card? You can unblock it until {date} {time}." |
| MSG-03 | After flagging | "We've sent {n} payments to our fraud team. We'll get back to you within 2 working days." |

### 9 · Interfaces
| Interface | Direction | Trigger | Content | Errors |
|---|---|---|---|---|
| CMS block | App / agent tool → CMS | RG-02 | PAN token, reason | Synchronous; failure = block not confirmed to the user |
| Authorisation host | CMS → host | RG-02 | Card status | Real time |
| Visa Exception File update | CMS → processor → Visa | RG-03 | PAN, action, purge date | RG-03 retries |
| Wallet token service | CMS → token service | RG-04 | Suspend all tokens of the PAN | Retry, alert |
| Fraud report to Visa | Fraud tool → processor → Visa | RG-07 | Transaction id, fraud type, amount, date | Rejected report → back to the analyst |

### 10 · Non-functional requirements
- Block effective in **5 s**; Exception File in **5 min**; 99.9% availability of the declaration in the app.
- Every declaration, unblock and fraud confirmation audited (who, when, channel).
- No PAN displayed in clear: last 4 digits only.

### 11 · Acceptance test ideas
- RG-02: each reason, authorisation right after the block → 41 / 43 / 05.
- RG-03: processor API down 20 minutes → retries then alert; listing done when it comes back.
- RG-05: flag a pending authorisation → no fraud report until cleared.
- RG-07: dispute attempted before the fraud report → refused by our dispute tool.
- RG-09: unblock at 23 h 59 with no attempt → OK; at 24 h 01 → refused; after an attempt → refused.

### 12 · Open points
| Question | Owner |
|---|---|
| Fraud type codes and reporting deadline in the current Visa fraud reporting rules | Fraud ops |
| Recurring payments after a block: stop or continue? | Card IT |

> **Review box:** 9 rules · 2 screens · 3 messages · 5 interfaces. Riskiest assumptions: the processor's real-time Exception File API holds 5 minutes; analysts can confirm within 2 working days.
