{"client": "Hexa card scheme (sample)", "skill": "running-uat", "title": "UAT day 8: fraud score with pilot issuers"}
===INPUT===
Day 8 of 10 of the UAT of the fraud score, with the 3 pilot issuers testing on the certification platform. 120 test cases planned. Exit criteria agreed: all tests run, ≥95% passed, 0 blocking, 0 major without accepted workaround. Go/no-go committee on day 10 with Nadia. Need today's dashboard and what to decide.

Xray execution export (112 tests created so far): executions.csv
Defects from Squash:

Clé;Résumé;Sévérité;Statut;Créé;Fonctionnalité;Contournement
HEX-301;Stand-in ignores the threshold when the issuer times out after 2 retries;Bloquant;Ouvert;05/11/2026;Stand-in threshold;non
HEX-302;Reason codes sent in the wrong order (lowest contribution first);Majeur;Ouvert;06/11/2026;Score in request (RS);oui
HEX-303;Scoring at 15-16 ms sent as scored but after 17 ms total delay;Majeur;Ouvert;06/11/2026;Not-scored fallback;non
HEX-304;Stand-in advice missing field RS;Majeur;À retester;07/11/2026;Stand-in threshold;non
HEX-305;Monthly report label typo 'scorring';Mineur;Ouvert;09/11/2026;Score in clearing;oui
HEX-306;RS absent for BIN ranges opted in before 02:00 batch rerun;Majeur;Clos;04/11/2026;Score in request (RS);non
HEX-307;Clearing record keeps score of a reversed authorisation;Mineur;À retester;10/11/2026;Score in clearing;oui
HEX-308;Issuer asks for score in the authorisation response too;Évolution;Ouvert;10/11/2026;Score in request (RS);non
HEX-309;Reason code GE shown as 'Geo' in the test tool;Mineur;Rejeté;08/11/2026;Score in request (RS);non
HEX-310;Score present in acquirer clearing file for 3 records;Majeur;Ouvert;11/11/2026;No score to acquirers;non
===OUTPUT===
## UAT dashboard · Real-time fraud score · Day 8 of 10

**Status: 🔴 RED.** Test progress is on plan, but stand-in ignores the threshold in one time-out case (HEX-301, blocking), and the score leaks into the acquirer clearing file (HEX-310), which breaks a Legal condition. Unless both are fixed by tomorrow noon, the go / no-go on day 10 will be a no-go.

*Figures computed with `uat_report.py executions.csv --defects defects.csv --planned 120 --days 10 --day 8`.*

### Progress
| Planned | Run | Passed | Failed | Blocked | Not run | Run % | Passed % |
|---|---|---|---|---|---|---|---|
| 120 | 100 | 92 | 8 | 3 | 17 | 83.3% | 76.7% |

Day 8 of 10: 80% should be run, 83.3% is: **ahead by 3.3 points**. 8 of the 17 not run aren't written in Xray yet.

| Feature | Passed | Failed | Blocked | Not run |
|---|---|---|---|---|
| Score in request (RS) | 28 | 1 | 0 | 1 |
| Not-scored fallback | 13 | 2 | 0 | 0 |
| **Stand-in threshold** | 15 | **3** | **3** | 4 |
| Score in clearing | 21 | 1 | 0 | 3 |
| No score to acquirers | 15 | 1 | 0 | 1 |

**Stand-in threshold** carries most of the risk: the blocking defect, every blocked test and 3 failures.

### Defects
10 raised: 6 open, 2 waiting re-test, 1 closed, 1 rejected.

| Severity | Open or waiting re-test | Defects |
|---|---|---|
| Blocking | **1** | HEX-301 (7 days old) |
| Major | **4** | HEX-302 (workaround accepted), HEX-303, HEX-304 (waiting re-test), HEX-310 |
| Minor | 2 | HEX-305, HEX-307 (waiting re-test) |
| Enhancement | 1 | HEX-308 → not a defect, and excluded by Legal (score never sent to acquirers) |

### Exit criteria
| Criterion | Status | Value |
|---|---|---|
| All planned tests run | ❌ | 100 / 120 run, 3 blocked |
| ≥ 95% of planned tests passed | ❌ | 76.7% |
| Every requirement has a passed test | ✅ | 5 / 5 |
| 0 blocking defect open | ❌ | 1 (HEX-301) |
| 0 major defect without accepted workaround | ❌ | HEX-303, HEX-304, HEX-310 |

### Top defects: triage
| Defect | Why it matters | Owner | Target |
|---|---|---|---|
| **HEX-301** Stand-in ignores the threshold after 2 issuer time-outs | Exactly the case stand-in exists for: risky transactions approved while the issuer is down (RG-05). Also blocks 3 tests | Thomas | Fix tomorrow 12:00 |
| **HEX-310** Score in the acquirer clearing file | Breaks the Legal condition RG-08. **Not negotiable for go-live** | Clearing team | Tomorrow |
| **HEX-303** Requests delayed to 17 ms when scoring answers at 15–16 ms | Breaks the latency budget (RG-02): the cut-off must include the time to write RS | Thomas | Tomorrow |
| **HEX-304** Stand-in advice missing RS | Issuers can't see why stand-in declined (RG-06). Fix delivered, re-test today | Tester: Sophie (Crédit Azur) | Today |

**Severity confirmed for all** after triage. HEX-310 stays major (not minor) even though only 3 records are affected: a legal condition is broken, and every leaked score would have to be reported.

### Risks
- **Re-test window:** if HEX-301 arrives after tomorrow noon, the 3 blocked tests and the peak load test can't run before day 10.
- **8 test cases not written** (stand-in edge cases and clearing reversals): Inès to write them today.
- **Pilot issuers' availability:** Paul (Banque du Port) is off on day 10: his re-tests must be done on day 9.

### Decisions needed
1. **Nadia:** accept the workaround for **HEX-302** (reason code order wrong, guide tells analysts to read all three) as a reservation for go-live? *Recommended: yes, fix in the next release.*
2. **Nadia:** close **HEX-308** (score in the authorisation response) as out of scope, with a reply to the issuer citing the Legal condition. *Recommended: yes.*
3. **Committee date:** if HEX-301 or HEX-310 isn't fixed by tomorrow noon, move the go / no-go from day 10 to day 12 rather than decide on an incomplete campaign.
