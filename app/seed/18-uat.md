{"client": "Harbor Bank (sample)", "skill": "running-uat", "lang": "en", "title": "UAT day 8: PAN declaration release"}
===INPUT===
Day 8 of 10 of the UAT of the PAN declaration release (block in app and by phone, Exception File, fraud declaration, replacement card). 120 test cases planned. Exit criteria: all run, ≥95% passed, 0 blocking, 0 major without accepted workaround. Go/no-go on day 10 with Ana.

Xray execution export: executions.csv (112 tests so far)
Defects (Jira export):

Key;Summary;Severity;Status;Created;Component;Workaround
CARD-301;PAN not added to the Exception File when the host times out during the block;Blocker;Open;2026-11-05;Exception File listing;no
CARD-302;Block confirmation screen shows the wrong card when the customer has 2 cards;Major;Open;2026-11-06;Block card in the app;yes
CARD-303;Phone block not visible in the app for 15 minutes;Major;Open;2026-11-06;Block card by phone;no
CARD-304;Fraud declaration accepted with a fraud date before the transaction date;Major;Ready for retest;2026-11-07;Fraud declaration;no
CARD-305;Typo in the replacement card email;Minor;Open;2026-11-09;Replacement card;yes
CARD-306;Block button missing for virtual cards;Major;Closed;2026-11-04;Block card in the app;no
CARD-307;Fraud report export includes declined authorisations;Minor;Ready for retest;2026-11-10;Fraud declaration;yes
CARD-308;Customer wants to unblock a card declared stolen;Enhancement;Open;2026-11-10;Block card in the app;no
CARD-309;Exception File action code shown as text in the test tool;Minor;Rejected;2026-11-08;Exception File listing;no
CARD-310;Fraud declaration sent twice for the same transaction;Major;Open;2026-11-11;Fraud declaration;no
===OUTPUT===
## UAT dashboard · PAN declaration release · Day 8 of 10

**Status: 🔴 RED.** Progress is on plan, but a blocked PAN is not listed on the Visa Exception File when the host times out (CARD-301, blocking): exactly the stand-in gap this release must close. Unless it is fixed by tomorrow noon, day 10 will be a no-go.

*Figures computed with `uat_report.py executions.csv --defects defects.csv --planned 120 --days 10 --day 8`.*

### Progress
| Planned | Run | Passed | Failed | Blocked | Not run | Run % | Passed % |
|---|---|---|---|---|---|---|---|
| 120 | 100 | 92 | 8 | 3 | 17 | 83.3% | 76.7% |

Day 8 of 10: 80% should be run, 83.3% is: **ahead by 3.3 points**. 8 of the 17 not run aren't written yet.

| Feature | Passed | Failed | Blocked | Not run |
|---|---|---|---|---|
| Block card in the app | 28 | 1 | 0 | 1 |
| Block card by phone | 13 | 2 | 0 | 0 |
| **Exception File listing** | 15 | **3** | **3** | 4 |
| Fraud declaration | 21 | 1 | 0 | 3 |
| Replacement card | 15 | 1 | 0 | 1 |

### Defects
10 raised: 6 open, 2 waiting re-test, 1 closed, 1 rejected.

| Severity | Open or waiting re-test | Defects |
|---|---|---|
| Blocking | **1** | CARD-301 (7 days old) |
| Major | **4** | CARD-302 (workaround accepted), CARD-303, CARD-304 (waiting re-test), CARD-310 |
| Minor | 2 | CARD-305, CARD-307 (waiting re-test) |
| Enhancement | 1 | CARD-308 → not a defect: stolen cards are never unblocked (RG-09) |

### Exit criteria
| Criterion | Status | Value |
|---|---|---|
| All planned tests run | ❌ | 100 / 120 run, 3 blocked |
| ≥ 95% of planned tests passed | ❌ | 76.7% |
| Every requirement has a passed test | ✅ | 5 / 5 |
| 0 blocking defect open | ❌ | 1 (CARD-301) |
| 0 major defect without accepted workaround | ❌ | CARD-303, CARD-304, CARD-310 |

### Top defects: triage
| Defect | Why it matters | Owner | Target |
|---|---|---|---|
| **CARD-301** PAN not listed on the Exception File after a host time-out | Stand-in can approve a stolen card (RG-03): the main risk this release addresses. Blocks 3 tests | Tom | Fix tomorrow 12:00 |
| **CARD-310** Fraud declaration sent twice for the same transaction | Duplicate fraud reports distort Visa fraud data and can break the dispute (RG-07) | Fraud tool team | Tomorrow |
| **CARD-303** Phone block visible in the app after 15 minutes | Cardholder may block again or call back; misleading | CMS team | Tomorrow |
| **CARD-304** Fraud date before the transaction date accepted | Fix delivered, re-test today | Tester: Priya | Today |

### Decisions needed
1. **Ana:** accept the workaround for **CARD-302** (confirmation shows the wrong card when there are two; the block itself is on the right card) as a reservation? *Recommended: yes, fix in the next release.*
2. **Ana:** close **CARD-308** (unblock a stolen card) as out of scope, citing RG-09. *Recommended: yes.*
3. If CARD-301 isn't fixed by tomorrow noon, move the go / no-go to day 12.
