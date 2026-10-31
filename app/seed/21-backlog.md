{"client": "Harbor Bank (sample)", "skill": "managing-backlog", "lang": "en", "title": "PI planning: cards team, PAN declaration and disputes"}
===INPUT===
PI planning next week for the cards team (SAFe). Jira project CARD. Velocity ~40 per sprint, 4 dev sprints + IP. ~10% run, keep a buffer.

F-01 Block a lost or stolen card in the app 20/13/13/8, 34 pts, needs F-06. Promised before June.
F-02 Add blocked PANs to the Visa Exception File automatically 8/13/20/5, 21 pts, needs F-06. Audit point, this PI.
F-03 Fraud declaration workflow 13/8/13/8, 30 pts
F-04 Open disputes from the fraud declaration 8/3/5/13, 40 pts, needs F-03
F-05 Explain declined payments in the app (response codes) 5/2/2/3, 13 pts
F-06 Real-time block API on the authorisation host (enabler) 3/13/20/5, 21 pts. In PI.
F-07 Suspend wallet tokens when the card is blocked 8/8/13/3, 13 pts, needs F-06
F-08 Merchant category controls 5/2/3/8, 26 pts
===OUTPUT===
## PI planning · Cards team · PAN declaration and disputes

### 1 · Assumptions
- **Capacity:** 4 sprints × 40 = 160 points, minus 10% run (16) and a 15% buffer (24) → **120 points**. IP sprint free.
- **WSJF** = (business value + time criticality + risk reduction) ÷ job size, computed with `wsjf.py`. An item enters the PI **with the dependencies it needs**.

### 2 · Ranked backlog
| Rank | ID | Feature | BV | TC | RR | Size | WSJF | Points | PI |
|---|---|---|---|---|---|---|---|---|---|
| 1 | F-07 | Suspend wallet tokens when the card is blocked | 8 | 8 | 13 | 3 | **9.67** | 13 | ✅ in |
| 2 | F-02 | Add blocked PANs to the Visa Exception File automatically | 8 | 13 | 20 | 5 | **8.2** | 21 | ✅ in |
| 3 | F-06 | Real-time block API on the authorisation host | 3 | 13 | 20 | 5 | **7.2** | 21 | ✅ in |
| 4 | F-01 | Block a lost or stolen card in the app | 20 | 13 | 13 | 8 | **5.75** | 34 | ✅ in |
| 5 | F-03 | Fraud declaration workflow for unrecognised transactions | 13 | 8 | 13 | 8 | **4.25** | 30 | ✅ in |
| 6 | F-05 | Explain declined payments in the app (response codes) | 5 | 2 | 2 | 3 | **3.0** | 13 | — out |
| 7 | F-08 | Merchant category controls set by the cardholder | 5 | 2 | 3 | 8 | **1.25** | 26 | — out |
| 8 | F-04 | Open disputes from the fraud declaration | 8 | 3 | 5 | 13 | **1.23** | 40 | — out |

**Capacity used: 119 / 120 (99%).** All three items with a deadline this PI are in.

**Why this order**
- **F-07 token suspension** ranks first (small, high risk reduction) and brings **F-06**, the block API it depends on.
- **F-02 Exception File** closes the stand-in gap found in workshop 1; it's also an audit point.
- **F-01** has the highest value but the largest size of the three deadline items.
- **F-04 disputes** waits for PI 2: it depends on F-03 and is the largest item.

### 3 · Plan by sprint
| Sprint | Features | Points |
|---|---|---|
| 1 | F-06 block API (21) · F-07 token suspension (8 of 13) | 29 |
| 2 | F-07 end (5) · F-02 Exception File (21) | 26 |
| 3 | F-01 block in the app (34) | 34 |
| 4 | F-03 fraud declaration workflow (30) | 30 |
| 5 (IP) | Innovation, planning | — |

### 4 · PI objectives
| # | Objective | Business value (proposed) |
|---|---|---|
| 1 | A blocked card is refused everywhere at once, including wallet payments and stand-in | 10 |
| 2 | Cardholders block a lost or stolen card in the app in under a minute | 9 |
| 3 | Fraud ops declare confirmed fraud to Visa from the case, the same day | 7 |
| *Uncommitted* | Declined payments explained in the app | 3 |

### 5 · Risks (ROAM)
| Risk | ROAM |
|---|---|
| Processor real-time Exception File API late | **Owned:** Tom, checkpoint sprint 1 |
| Capacity at 99% | **Accepted:** no new scope without removing an item |
| Fraud ops capacity for same-day declarations | **Mitigated:** pilot volumes in sprint 4 |

### 6 · Jira import
jira-import.csv
```csv
Summary,Issue Type,Description,Labels,Labels,Story Points
Suspend wallet tokens when the card is blocked,Story,WSJF 9.67 (BV 8 + TC 8 + RR 13) / size 3. Ref F-07. Depends on: F-06.,PI-committed,CARD-WSJF,13
Add blocked PANs to the Visa Exception File automatically,Epic,WSJF 8.2 (BV 8 + TC 13 + RR 20) / size 5. Ref F-02. Depends on: F-06.,PI-committed,CARD-WSJF,21
Real-time block API on the authorisation host,Enabler,WSJF 7.2 (BV 3 + TC 13 + RR 20) / size 5. Ref F-06.,PI-committed,CARD-WSJF,21
Block a lost or stolen card in the app,Epic,WSJF 5.75 (BV 20 + TC 13 + RR 13) / size 8. Ref F-01. Depends on: F-06.,PI-committed,CARD-WSJF,34
Fraud declaration workflow for unrecognised transactions,Epic,WSJF 4.25 (BV 13 + TC 8 + RR 13) / size 8. Ref F-03.,PI-committed,CARD-WSJF,30
Explain declined payments in the app (response codes),Story,WSJF 3.0 (BV 5 + TC 2 + RR 2) / size 3. Ref F-05.,PI-candidate,CARD-WSJF,13
Merchant category controls set by the cardholder,Epic,WSJF 1.25 (BV 5 + TC 2 + RR 3) / size 8. Ref F-08.,PI-candidate,CARD-WSJF,26
Open disputes from the fraud declaration,Epic,WSJF 1.23 (BV 8 + TC 3 + RR 5) / size 13. Ref F-04. Depends on: F-03.,PI-candidate,CARD-WSJF,40
```
*Enabler is a SAFe issue type: replace it with Story if your Jira doesn't have it. Test the import with 3 rows first.*
