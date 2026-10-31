{"client": "Hexa card scheme (sample)", "skill": "facilitating-workshops", "title": "Workshop report: fraud score with pilot issuers"}
===INPUT===
Notes from this morning's workshop with the 3 pilot issuers, need the CR today.

Workshop 1 – score LCLF – 9:30-12:00. Scheme: Nadia (head of fraud/LCLF, sponsor), Thomas (authorisation platform lead), Inès (data science), me. Issuers: Marc (Banque Lumière, fraud manager, big issuer, own fraud engine), Sophie (Crédit Azur, mid-size), Paul (Banque du Port, small, no fraud engine, static rules only). Legal/DPO invited, not there.

- Inès: score 0-999 + up to 3 reason codes (e.g. "card testing pattern", "new device for this card across network", "merchant under attack"). Model retrained monthly on fraud reports.
- Thomas: score in a reserved field of the authorisation request. Budget 15 ms. If scoring is late -> send without score + flag "not scored". DECIDED, nobody objected.
- Marc: wants the score in the clearing record too, for disputes and for their fraud reporting. Nadia ok in principle, in scope for the pilot? not decided.
- Sophie: needs the reason codes documented with examples, otherwise analysts won't trust it. Inès will write a guide.
- Paul: can't change his host quickly. Wants the scheme to decline in stand-in above a threshold AND also... asked if the scheme could decline even when his host is up. Nadia: NO, issuer keeps the decision, only in stand-in. Decided.
- Paul: opt-in per BIN range is fine. Marc: per BIN range + per channel (e-commerce only first). Open.
- Fraud reports (LCLF declarations): Marc sends daily, Sophie weekly, Paul monthly by file. Inès: monthly is too slow to learn, ideally within 10 days.
- Pilot start: Thomas says test environment ready in 6 weeks. Issuers need 4 weeks of certification after.
- Metrics: Nadia: fraud value -25% in pilot, approval rate genuine not down by more than 0.2 pt.
- Marc worried about competition/data sharing: scheme uses his data to score other issuers' cards. Needs Legal answer before signing pilot agreement.
- next: technical workshop on message format + certification plan; Legal must come.
===OUTPUT===
## Workshop report · Real-time fraud score (LCLF) with pilot issuers · Workshop 1

**Date:** today, 9:30–12:00 · **Objective:** agree how the pilot issuers receive and use the network fraud score, and what the pilot measures.
**Scheme:** Nadia (Head of fraud / LCLF, sponsor), Thomas (Authorisation platform lead), Inès (Data science), BA (author).
**Pilot issuers:** Marc (Banque Lumière, large, own fraud engine), Sophie (Crédit Azur, mid-size), Paul (Banque du Port, small, static rules only).
**Invited, absent:** Legal / DPO. ⚠️ Marc's data-sharing question (Q-04) blocks the pilot agreement.

### Summary
The score will travel in the authorisation request (0–999, up to 3 reason codes) within a 15 ms budget, and requests are never delayed if scoring is late. The **issuer keeps the decision**; the scheme declines only in stand-in, above a threshold set by the issuer. Open: score in the clearing record, opt-in by channel, the frequency of fraud reports, and the legal basis for using data across issuers.

### Decisions
| ID | Decision | By |
|---|---|---|
| D-01 | The score is sent in a reserved field of the authorisation request, with up to 3 reason codes | Thomas, Inès |
| D-02 | If scoring exceeds 15 ms, the request goes **without a score**, flagged "not scored" | Thomas, agreed by all |
| D-03 | The scheme **never declines when the issuer host is up**. It declines only in stand-in, above the issuer's threshold | Nadia |
| D-04 | Opt-in is **per BIN range** | Nadia, Paul, Marc |
| D-05 | Pilot targets: CNP fraud value −25%, genuine approval rate not down by more than 0.2 pt | Nadia |

### Requirements
| ID | Requirement | Type | Source | Priority |
|---|---|---|---|---|
| REQ-01 | Each opted-in authorisation request carries a score 0–999 and up to 3 reason codes | Functional | Inès, Thomas | Must |
| REQ-02 | Scoring adds at most 15 ms; beyond, the request goes unscored with a flag | Non-functional | Thomas | Must |
| REQ-03 | Issuers can set a stand-in decline threshold | Functional | Paul | Must |
| REQ-04 | Every reason code is documented with its meaning and examples | Documentation | Sophie | Must |
| REQ-05 | The score and reason codes are carried into the clearing record | Functional | Marc | Should *(pilot scope open, Q-01)* |
| REQ-06 | Fraud reports (LCLF declarations) reach the scheme within 10 days of detection | Process / data | Inès | Should |
| REQ-07 | Opt-in by channel (e-commerce first) in addition to BIN range | Functional | Marc | Could *(open, Q-02)* |

### Business rules
| ID | Rule | Example |
|---|---|---|
| RG-01 | If a BIN range is opted in, then every authorisation request on it is scored | 45671200–45671299 opted in → all its requests carry a score |
| RG-02 | If scoring takes more than 15 ms, then the request is sent unscored with the flag "not scored" | Model latency spike at 20 ms → request sent at once, flagged |
| RG-03 | If the issuer doesn't answer and the score is above the issuer's stand-in threshold, then stand-in declines | Threshold 850, score 910, issuer host down → declined |

### Open questions
| ID | Question | Owner | Due |
|---|---|---|---|
| Q-01 | Is the score in the clearing record part of the pilot or of the general release? | Nadia | Workshop 2 |
| Q-02 | Opt-in by channel as well as BIN range? Effort and value | Thomas, Marc | Workshop 2 |
| Q-03 | Can Paul (monthly fraud reports by file) move to 10 days, and through which channel? | Paul, Inès | Workshop 2 |
| Q-04 | Legal basis and competition rules for using one issuer's data to score other issuers' cards | Legal / DPO | **Before the pilot agreement** |

### Risks & dependencies
- **Legal (Q-04)** may block or change the model inputs: needed before the agreement is signed.
- **Slow fraud reports** weaken the model; the pilot results could look worse than the real potential.
- **Planning:** test environment in 6 weeks + 4 weeks of issuer certification = pilot start in about 10 weeks at the earliest.
- **Trust:** without documented reason codes, issuer analysts won't use the score.

### Actions
| ID | Action | Owner | Due |
|---|---|---|---|
| A-01 | Get a Legal / DPO answer on Q-04 | Nadia | 2 weeks |
| A-02 | Reason code guide with examples | Inès | Workshop 2 |
| A-03 | Message format proposal and certification plan | Thomas | Workshop 2 |
| A-04 | Effort for score in clearing and opt-in by channel | Thomas | Workshop 2 |
| A-05 | Draft the SFD from this report | BA | Workshop 2 |

### Next workshop
**Topics:** message format, certification plan, decision on Q-01 and Q-02.
**Attendees:** the same, plus Legal / DPO (mandatory) and the issuers' authorisation IT leads.
