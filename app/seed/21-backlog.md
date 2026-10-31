{"client": "Hexa card scheme (sample)", "skill": "managing-backlog", "title": "PI planning: Authorisation & Fraud team, PI 27.1"}
===INPUT===
PI planning next week for the Authorisation & Fraud team (SAFe, ART "Card processing"). Jira project HEX. Velocity ~40 pts per sprint, 4 dev sprints + IP sprint. ~10% run support. Keep a buffer.

Candidates (BV / TC / RR / size from refinement with Nadia, business owner):
F-01 Fraud score in the authorisation request (pilot issuers) 20/13/13/8, 34 pts, needs F-06. Pilot promised to 3 issuers this PI.
F-02 New domestic interchange grid in the clearing engine 8/20/8/8, 30 pts. Board decision, live 1 April.
F-03 Disputes API v2: representment with evidence upload 8/3/5/13, 40 pts
F-04 Stand-in decline threshold set by the issuer 8/8/8/3, 13 pts, needs F-01. Part of the pilot.
F-05 Token lifecycle notifications to issuers 5/3/3/8, 26 pts
F-06 Low-latency scoring service (enabler) 3/13/20/5, 21 pts
F-07 Score in the clearing record 8/5/8/5, 21 pts, needs F-01
F-08 Decommission the legacy clearing file for 2 acquirers 2/2/8/5, 18 pts

Need: ranking, what fits, PI objectives, risks, and a CSV to import into Jira.
===OUTPUT===
## PI planning · Authorisation & Fraud team · PI 27.1

### 1 · Assumptions
- **Capacity:** 4 development sprints × 40 points = 160 points, minus 10% run support (16) and a **15% buffer** for unplanned work and incidents (24) → **120 points for features**. The IP sprint stays free.
- **Scale:** modified Fibonacci (1, 2, 3, 5, 8, 13, 20), scores from refinement with Nadia (business owner).
- **WSJF** = (business value + time criticality + risk reduction) ÷ job size, computed with `wsjf.py`.

### 2 · Ranked backlog
| Rank | ID | Feature | BV | TC | RR | Size | WSJF | Points | PI |
|---|---|---|---|---|---|---|---|---|---|
| 1 | F-04 | Stand-in decline threshold set by the issuer | 8 | 8 | 8 | 3 | **8.0** | 13 | ✅ in |
| 2 | F-06 | Low-latency scoring service (15 ms budget) | 3 | 13 | 20 | 5 | **7.2** | 21 | ✅ in |
| 3 | F-01 | Fraud score in the authorisation request (pilot issuers) | 20 | 13 | 13 | 8 | **5.75** | 34 | ✅ in |
| 4 | F-02 | New domestic interchange grid in the clearing engine | 8 | 20 | 8 | 8 | **4.5** | 30 | ✅ in |
| 5 | F-07 | Score in the clearing record | 8 | 5 | 8 | 5 | **4.2** | 21 | ✅ in |
| 6 | F-08 | Decommission the legacy clearing file for 2 acquirers | 2 | 2 | 8 | 5 | **2.4** | 18 | — out |
| 7 | F-05 | Token lifecycle notifications to issuers | 5 | 3 | 3 | 8 | **1.38** | 26 | — out |
| 8 | F-03 | Disputes API v2: representment with evidence upload | 8 | 3 | 5 | 13 | **1.23** | 40 | — out |

**Capacity used: 119 / 120 points (99%).** Every item with a deadline this PI is in. With 1 point left, any new request means taking something out.

**Why this order**
- **F-04 first by WSJF** (small, part of the pilot), but it **depends on F-01**, so it's planned after it.
- **F-06 before F-01:** the scoring service is an enabler without direct value, but the pilot can't start without it.
- **F-02 interchange grid:** lower value for the team, but a board decision with a fixed date (1 April); the deadline raises its time criticality, it still went through the ranking.
- **F-07 score in clearing** fits and was asked for by the pilot issuers (workshop 1).

### 3 · Plan by iteration
| Sprint | Features | Points |
|---|---|---|
| 27.1.1 | F-06 scoring service (21) · F-02 interchange grid, part 1: rule engine (9) | 30 |
| 27.1.2 | F-01 fraud score, part 1: field RS, opt-in (17) · F-02 part 2: rate table with 4-eyes (13) | 30 |
| 27.1.3 | F-01 part 2: not-scored fallback, monitoring (17) · F-04 stand-in threshold (13) | 30 |
| 27.1.4 | F-02 part 3: clearing record codes for member certification (8) · F-07 score in clearing (21) | 29 |
| 27.1.5 (IP) | Innovation, inspect & adapt, planning for PI 27.2 | — |

F-02 must be ready for **member certification in January** and the **shadow run from 1 March** (see the interchange impact analysis): its last part lands in sprint 4 at the latest.

### 4 · PI objectives
| # | Objective | Business value (proposed) | Features |
|---|---|---|---|
| 1 | 3 pilot issuers receive a real-time fraud score in their authorisation requests, within 15 ms | 10 | F-06, F-01 |
| 2 | Issuers can make stand-in decline above their own score threshold | 7 | F-04 |
| 3 | The clearing engine applies the new interchange grid, ready for member certification | 9 | F-02 |
| 4 | Pilot issuers find the score in their clearing records | 5 | F-07 |
| *Uncommitted* | Legacy clearing file switched off for 2 acquirers | 3 | F-08 (if buffer unused) |

*Business values are proposals: Nadia sets them during PI planning.*

### 5 · Dependencies & risks (ROAM)
| Item | Type | Needed by | Owner | ROAM |
|---|---|---|---|---|
| Legal answer on cross-issuer data (pilot agreement) | Dependency | Before sprint 2 | Nadia | **Owned:** escalated, answer expected in 2 weeks |
| Field RS free in pilot issuers' message versions | Dependency (issuers) | Sprint 2 | Thomas | **Mitigated:** checked in the certification plan |
| 15 ms latency at peak | Risk | Sprint 1 | Thomas | **Mitigated:** load test at 3× peak in sprint 1 |
| Interchange grid date 1 April | Risk | Sprint 4 | Pricing + team | **Mitigated:** F-02 split over 3 sprints, shadow run in March |
| Capacity at 99% | Risk | — | Team | **Accepted:** no new scope this PI without removing an item |

### 6 · Out of this PI
| Feature | Why |
|---|---|
| F-08 legacy file decommission | Low WSJF (2.4), no capacity left; uncommitted objective |
| F-05 token lifecycle notifications | WSJF 1.38, no deadline |
| F-03 disputes API v2 | Largest item (40 pts), low time criticality; first candidate for PI 27.2 |

### 7 · Jira import
Import with *Jira settings → System → External system import → CSV*. Map *Story Points* to your instance's field, and test with 3 rows first.

jira-import.csv
```csv
Summary,Issue Type,Description,Labels,Labels,Story Points
Stand-in decline threshold set by the issuer,Story,WSJF 8.0 (BV 8 + TC 8 + RR 8) / size 3. Ref F-04. Depends on: F-01.,PI-committed,HEX-WSJF,13
Low-latency scoring service (15 ms budget),Enabler,WSJF 7.2 (BV 3 + TC 13 + RR 20) / size 5. Ref F-06.,PI-committed,HEX-WSJF,21
Fraud score in the authorisation request (pilot issuers),Epic,WSJF 5.75 (BV 20 + TC 13 + RR 13) / size 8. Ref F-01. Depends on: F-06.,PI-committed,HEX-WSJF,34
New domestic interchange grid in the clearing engine,Epic,WSJF 4.5 (BV 8 + TC 20 + RR 8) / size 8. Ref F-02.,PI-committed,HEX-WSJF,30
Score in the clearing record,Epic,WSJF 4.2 (BV 8 + TC 5 + RR 8) / size 5. Ref F-07. Depends on: F-01.,PI-committed,HEX-WSJF,21
Decommission the legacy clearing file for 2 acquirers,Enabler,WSJF 2.4 (BV 2 + TC 2 + RR 8) / size 5. Ref F-08.,PI-candidate,HEX-WSJF,18
Token lifecycle notifications to issuers,Epic,WSJF 1.38 (BV 5 + TC 3 + RR 3) / size 8. Ref F-05.,PI-candidate,HEX-WSJF,26
Disputes API v2: representment with evidence upload,Epic,WSJF 1.23 (BV 8 + TC 3 + RR 5) / size 13. Ref F-03.,PI-candidate,HEX-WSJF,40
```

*Enabler is a SAFe issue type: if your Jira has no "Enabler" type, replace it with Story or Epic before importing.*
