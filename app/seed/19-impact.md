{"client": "Harbor Bank (sample)", "skill": "analysing-gaps-and-impacts", "lang": "en", "title": "Impact analysis: Visa chargebacks out of spreadsheets"}
===INPUT===
Gap & impact analysis: we want to stop handling Visa chargebacks with emails and a shared spreadsheet and use a dispute management tool connected to our processor. 3 months.

Today: cardholder complaints arrive by phone, email and branch. Disputes team (6 people) re-keys them in a spreadsheet, checks the transaction in the back office, and opens the chargeback in the processor's web portal. Fraud is reported to Visa by fraud ops in another spreadsheet, sometimes weeks later. Deadlines followed by hand: last year 9% of disputes were lost because of a missed time limit (about 210k€). No link between the cardholder refund and the dispute outcome. Volume: 1,100 disputes a month, 60% fraud.
===OUTPUT===
## Gap & impact analysis · Visa chargebacks: from spreadsheets to a dispute tool

### 1 · Summary for the sponsor
- **What:** replace emails and a shared spreadsheet with a dispute management tool connected to the processor, so every chargeback is opened, tracked and closed in one place.
- **Why now:** **9% of disputes lost on time limits** last year (≈ 210k€), fraud reported to Visa weeks late.
- **Size:** about **75–175 person-days** over 6 impacts; the processor connection and the fraud report link are the critical path.
- **Decisions needed:** who owns deadlines (disputes team or the tool); whether cardholder refunds are triggered from the tool.

### 2 · Scope and assumptions
**In scope:** Visa disputes of our cardholders (we are the issuer): intake, fraud report link, chargeback, acquirer response, pre-arbitration, cardholder refund.
**Out of scope:** acquiring-side disputes, arbitration filing.
**Assumptions:** the processor offers an API or file interface for disputes; volumes stay around 1,100 a month (60% fraud).

### 3 · Existing vs target
| Area | Today | Target | Gap |
|---|---|---|---|
| Intake | Phone, email, branch; re-keyed in a spreadsheet | One case per complaint, created from the app, call-centre tool or branch | Missing |
| Fraud report | Separate spreadsheet, sent weeks later | Fraud reported from the same case, **before** the fraud dispute | To change |
| Chargeback | Processor web portal, by hand | Sent from the tool to the processor | To change |
| Deadlines | Followed by hand | Computed per dispute from the processing date, alerts before expiry | Missing |
| Cardholder refund | Separate, no link to the outcome | Provisional credit and final decision linked to the case | Missing |
| Reporting | Monthly count in the spreadsheet | Win / loss rate, reasons, deadlines missed | Missing |

### 4 · Rules to trace
| Ref | Requirement (paraphrased) | Action | Owner |
|---|---|---|---|
| Visa dispute rules | Each dispute condition has a time limit and required information | Load the conditions we use, with their time limits, in the tool | Disputes lead |
| Visa dispute rules | Fraud disputes need the transaction reported as fraud first | Block a fraud dispute until the fraud report exists | Disputes lead |
| Cardholder protection rules (local law) | Unauthorised transactions refunded within the legal time frame | Provisional credit rule in the tool | Legal |

*Paraphrased; confirm against the current Visa Core Rules and with Legal.*

### 5 · Impact matrix
Size basis: S < 10 days · M 10–40 · L 40–120.

| ID | Area | What changes | Who | Size | Owner |
|---|---|---|---|---|---|
| IMP-01 | Applications | Dispute tool set up: conditions, time limits, workflow | Disputes, IT | M (20–40 d) | Disputes lead |
| IMP-02 | Interfaces | Connection to the processor for chargebacks and responses | Card IT | M–L (30–60 d) | Card IT |
| IMP-03 | Interfaces | Link to fraud reporting (fraud report id on the case) | Fraud ops, Card IT | M (10–30 d) | Fraud ops |
| IMP-04 | Process & people | New intake from app, call centre and branch; training of 6 analysts and agents | Disputes, call centre | S–M (5–20 d) | Disputes lead |
| IMP-05 | Finance | Provisional credit and write-off accounting from the tool | Finance | S–M (5–15 d) | Finance |
| IMP-06 | Data & reporting | Win / loss and deadline dashboard; migration of open cases | BI | S (5–10 d) | BI |

**Total:** about 75–175 person-days (sum of the ranges).

### 6 · Transition plan
| Month | Milestone |
|---|---|
| M1 | Tool configured with our conditions and time limits; processor interface specified |
| M2 | Processor and fraud report links in test; analysts trained; pilot on 13.x consumer disputes only |
| M3 | All conditions; open spreadsheet cases migrated; spreadsheet read-only |

### 7 · RAID
| Type | Item | Owner |
|---|---|---|
| Risk | Open cases lost during migration → missed deadlines | Disputes lead (double run in M3) |
| Risk | Processor interface later than M2 | Card IT |
| Assumption | 1,100 disputes / month, 60% fraud | Disputes lead |
| Dependency | Fraud ops reporting fraud the same day (see PAN declaration project) | Fraud ops |

### 8 · To confirm
- Time limits per dispute condition in the current Visa rules: **Disputes lead**.
- Refund time frame for unauthorised transactions: **Legal**.
