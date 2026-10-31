{"client": "Harbor Bank (sample)", "skill": "facilitating-workshops", "lang": "en", "title": "Workshop report: lost and stolen card declaration"}
===INPUT===
Notes from this morning, need the report today.

Workshop 1 – PAN declaration (lost/stolen + fraud) – 9:30-11:30. Ana (head of cards, sponsor), Tom (card IT / authorisation host), Priya (fraud ops), Leo (call centre manager), Kim (disputes), me. Legal invited, didn't come.

- Ana: block must be real time in the app AND by phone. Decided.
- Tom: blocking in the card management system is immediate, but the Exception File update to Visa is a nightly batch. Processor may offer real-time updates, he will ask. If host down + card not on Exception File = STIP may approve.
- Leo: agents today block with reason lost/stolen only. They want "used without my permission" (card still in pocket). Ana ok.
- Priya: when customer says "I don't recognise these payments", fraud ops must confirm, then declare fraud to Visa (fraud report) for each transaction. Today done in a spreadsheet, sometimes 2-3 weeks late. Kim: for fraud disputes the fraud must be reported to Visa first, otherwise dispute rejected. So declaration before dispute. Decided.
- Stolen card: never unblock, new PAN. Lost: unblock possible within 24h? Leo yes, Priya worried (fraudster finds card). Not decided.
- Wallet tokens (Apple Pay): Tom says not suspended today when card blocked!! Must be.
- Kim: dispute deadline counts from the processing date, so late fraud declaration = lost disputes. Wants a dashboard of cases close to the deadline.
- Next: workshop 2 with Legal on cardholder liability + the unblock rule.
===OUTPUT===
## Workshop report · Lost and stolen card declaration (PAN declaration) · Workshop 1

**Date:** today, 9:30–11:30 · **Objective:** agree how a lost, stolen or misused card is declared, blocked, reported to Visa and disputed.
**Present:** Ana (Head of cards, sponsor), Tom (Card IT, authorisation host), Priya (Fraud operations), Leo (Call centre manager), Kim (Disputes), BA (author).
**Invited, absent:** Legal. ⚠️ Cardholder liability and the unblock rule need them.

### Summary
Blocking will be real time in the app and by phone, with a third reason "used without my permission". Fraud operations will declare confirmed fraud to Visa **before** any fraud dispute. Two gaps came out: the Exception File is only updated nightly, and wallet tokens stay active when a card is blocked.

### Decisions
| ID | Decision | By |
|---|---|---|
| D-01 | Blocking is real time in the app and by phone | Ana |
| D-02 | Three reasons: lost, stolen, used without my permission | Ana, Leo |
| D-03 | A card declared stolen is never unblocked: a new PAN is issued | Workshop |
| D-04 | Confirmed fraud is declared to Visa before a fraud dispute is opened | Priya, Kim |

### Requirements
| ID | Requirement | Type | Source | Priority |
|---|---|---|---|---|
| REQ-01 | Block a card in real time from the app and from the call-centre tool | Functional | Ana | Must |
| REQ-02 | Add a blocked PAN to the Visa Exception File as soon as it is blocked, not in the nightly batch | Functional | Tom | Must *(feasibility open, Q-01)* |
| REQ-03 | Suspend the wallet tokens of a blocked card | Functional / security | Tom | Must |
| REQ-04 | Reason "used without my permission" when the card is still with the cardholder | Functional | Leo | Must |
| REQ-05 | Fraud operations confirm flagged transactions and declare each confirmed fraud to Visa | Process / regulatory | Priya | Must |
| REQ-06 | Dashboard of fraud cases close to the dispute deadline | Reporting | Kim | Should |

### Business rules
| ID | Rule | Example |
|---|---|---|
| RG-01 | If a card is blocked as lost, then authorisations are declined with **41**; stolen with **43** | Card ending 4821 blocked "stolen" at 10:02 → 43 at 10:03 |
| RG-02 | If a fraud dispute is to be opened, then the fraud must already be declared to Visa | Unknown e-commerce payment of 89.90€ → fraud report, then dispute |
| RG-03 | If the reason is stolen, then the card can't be unblocked | — |

### Open questions
| ID | Question | Owner | Due |
|---|---|---|---|
| Q-01 | Can our processor update the Visa Exception File in real time? At what cost? | Tom | Workshop 2 |
| Q-02 | Can a card blocked as lost be unblocked within 24 h? Leo for, Priya against (risk if a fraudster finds the card) | Ana, with Legal | Workshop 2 |
| Q-03 | What do we tell the cardholder about liability for transactions before the declaration? | Legal | Workshop 2 |
| Q-04 | Do blocked cards stop recurring payments? | Tom | Workshop 2 |

### Risks & dependencies
- **Stand-in gap:** until Q-01 is solved, stand-in can approve a blocked card for up to a day when our host is down.
- **Late fraud declarations** (today 2–3 weeks, spreadsheet) lose disputes, since deadlines run from the processing date.
- **Legal absent:** Q-02 and Q-03 block the cardholder wording.

### Actions
| ID | Action | Owner | Due |
|---|---|---|---|
| A-01 | Ask the processor about real-time Exception File updates | Tom | Workshop 2 |
| A-02 | Fix token suspension on block (bug, not a project) | Tom | Next sprint |
| A-03 | Volumes and lead times of fraud declarations today | Priya | Workshop 2 |
| A-04 | Bring Legal to workshop 2 | Ana | This week |
| A-05 | Draft the SFD from this report | BA | Workshop 2 |

### Next workshop
**Topics:** liability wording, unblock rule, real-time Exception File, the dispute deadline dashboard. **Attendees:** the same plus Legal (mandatory).
