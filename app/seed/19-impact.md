{"client": "Hexa card scheme (sample)", "skill": "analysing-gaps-and-impacts", "title": "Impact analysis: new domestic interchange grid"}
===INPUT===
The board approved a new domestic interchange grid, effective 1 April (5 months). Need the gap & impact analysis for the steering committee.

Today: 4 domestic categories: consumer debit 0.20%, consumer credit 0.30% (both at the EU caps), commercial 1.10% + 0.05 €, and one "standard" fallback. Category assigned in the interchange engine at clearing from card type + consumer flag + domestic. Rates in a table maintained by hand by the pricing team (Excel → SQL script). Monthly billing to acquirers, credited to issuers, through net settlement positions.
New grid: consumer debit ≤ 20 € → 0.10%; consumer debit > 20 € stays 0.20%; consumer credit unchanged 0.30%; new "public & charity" category for MCC 9311, 9399, 8398 → 0.05% for consumer cards; commercial unchanged. New categories must appear in clearing records sent to members, and in their monthly reports.
Members: 22 issuers, 9 acquirers. Acquirers have to update merchant pricing (IC++ contracts) and merchant statements. Last grid change (3 years ago) took 7 months and had 2 weeks of wrong billing.
===OUTPUT===
## Gap & impact analysis · New domestic interchange grid · Effective 1 April

### 1 · Summary for the sponsor
- **What:** two new rules in the domestic grid. Consumer debit **≤ 20 € drops to 0.10%**, and a **public & charity** category (MCC 9311, 9399, 8398) at **0.05%** for consumer cards. Credit and commercial rates are unchanged.
- **Deadline:** **1 April**, in 5 months. The last grid change took **7 months** and caused 2 weeks of wrong billing.
- **Size:** about **90–210 person-days** at the scheme, plus each member's own work. The amount-based rule and member readiness are the critical path.
- **Top 3 impacts:** category assignment by amount and MCC in the interchange engine (L), new category codes in the clearing records to members (M, with member certification), member communication and acquirer merchant re-pricing (M, outside our control).
- **Decisions needed now:** freeze the member notice date (rules publication); choose a parallel run or a hard switch on 1 April; replace the manual rate table process.

### 2 · Scope and assumptions
**In scope:** domestic transactions cleared from 1 April; the interchange engine, clearing records, member billing, settlement positions, member reports, member rules and communication.
**Out of scope:** cross-border interchange; scheme fees; acquirer–merchant contracts (members' responsibility, but we support them).
**Assumptions:** the rule applies on the **clearing date**, not the authorisation date *(to confirm with Pricing: transactions authorised on 31 March and cleared on 1 April)*; the amount threshold is on the transaction amount in euros, including VAT.

### 3 · Existing vs target
| Area | Today | Target | Gap | Type |
|---|---|---|---|---|
| Category rules | Card type + consumer + domestic | + **transaction amount** (≤ 20 €) and **MCC** list | Amount and MCC not used in assignment | To change |
| Category codes | 4 domestic codes | 6 codes (2 new) | New codes and labels | Missing |
| Rate maintenance | Excel → SQL script by hand, no review | Rates with validity dates, 4-eyes approval, test before activation | Manual, error-prone (cause of the last incident) | To change |
| Clearing records to members | 4 codes | 6 codes; members must accept them | Message change + member certification | To change |
| Billing & settlement | Monthly, by category | Same, with 6 categories | Reports and invoices to update | To change |
| Member reports | 4 categories | 6 categories, with the MCC rule explained | Report layout | To change |
| Member rules | Grid in the rulebook | New grid, published with notice | Publication and notice period | To change |
| Acquirers → merchants | IC++ statements with 4 lines | Merchants see the new categories | Acquirers re-price and update statements | Members' work |

### 4 · Regulatory traceability
| Ref | Requirement (paraphrased) | Applies | Today | Action | Owner | Status |
|---|---|---|---|---|---|---|
| EU IFR, interchange caps | Consumer debit ≤ 0.2%, consumer credit ≤ 0.3% per transaction | Yes | Compliant | New rates are **lower**: still compliant. Add an automated cap check on the rate table | Pricing | To do |
| EU IFR, commercial cards | Commercial cards are outside the consumer caps | Yes | Separate category | No change | — | OK |
| EU IFR, transparency to merchants | Acquirers show merchants the interchange separately, by category | Yes (acquirers) | 4 categories shown | Give acquirers the new categories and labels early | Member relations | To do |
| Member rules | Changes published to members with the notice period of the rules | Yes | — | Fix the publication date now | Scheme governance | Decision |

*Summaries, not legal advice: Compliance confirms the caps and the transparency duties.*

### 5 · Impact matrix
Size basis: S < 10 days · M 10–40 · L 40–120.

| ID | Area | What changes | Who | Size | Risk if not done | Depends on | Owner |
|---|---|---|---|---|---|---|---|
| IMP-01 | Applications | Interchange engine: assignment by amount and MCC list, 2 new categories | Clearing IT | **L** (40–80 d) | Wrong interchange on ~35% of debit transactions | Rule spec | Clearing IT |
| IMP-02 | Data | Rate table with validity dates, 4-eyes approval, automatic cap check | Pricing, Clearing IT | M (15–30 d) | Repeat of the last incident | IMP-01 | Pricing |
| IMP-03 | Interfaces | New category codes in clearing records; member certification window | Clearing IT, 31 members | M (15–40 d) | Members reject or misread records | Message spec | Member certification |
| IMP-04 | Billing & settlement | Invoices, credit notes and positions by 6 categories | Finance | S–M (5–20 d) | Billing disputes with acquirers | IMP-01 | Finance |
| IMP-05 | Reporting | Member reports and data warehouse with new categories | BI | S–M (5–20 d) | Members can't reconcile | IMP-01 | BI |
| IMP-06 | Documents | Rulebook, member bulletin, FAQ, category labels for merchant statements | Governance, Member relations | S (5–10 d) | Late or unclear notice | Board decision | Governance |
| IMP-07 | Members | Acquirers re-price merchants and update statements; issuers update revenue forecasts | 9 acquirers, 22 issuers | outside our budget | Merchants billed at old rates | IMP-06 | Member relations (follow-up) |
| IMP-08 | Controls | Daily check billed vs expected interchange (see SQL sample) from 1 April | Finance, BI | S (5–10 d) | Errors found at month end only | IMP-01 | Finance |

**Heat map**
| Area | S | M | L |
|---|---|---|---|
| Applications & data | | IMP-02 | IMP-01 |
| Interfaces & members | IMP-06 | IMP-03 | |
| Finance, reporting, controls | IMP-08 | IMP-04, IMP-05 | |

**Total at the scheme:** about 90–210 person-days (sum of the ranges), excluding members' work.

### 6 · Options for the switch
| Option | How | Risk | Recommended |
|---|---|---|---|
| A · Hard switch on 1 April | New grid active at clearing from 1 April | Errors visible only on the first invoices | |
| B · Shadow run | From 1 March, compute the new interchange **in parallel** (not billed) and compare daily with the expected values; switch on 1 April | +10 days of work; needs IMP-01 ready one month earlier | **✅ B**, given the last incident |

### 7 · Transition plan
| Month | Milestone |
|---|---|
| M1 (Nov) | Rule spec signed by Pricing · **member bulletin published** with the new codes and labels · rate table process redesigned |
| M2 (Dec) | Engine and rate table built · message spec to members |
| M3 (Jan) | Member certification window opens · billing and reports updated |
| M4 (Feb) | Certification closes · acquirers confirm merchant re-pricing |
| M5 (Mar) | **Shadow run** from 1 March, daily comparison · go / no-go on 25 March |
| 1 April | New grid live · daily billed vs expected check for the first month |

### 8 · RAID
| Type | Item | Owner |
|---|---|---|
| Risk | Members not certified by end of February: their clearing records misread from 1 April | Member certification |
| Risk | The threshold applies on the cleared amount, but partial clearings and incremental authorisations make the "transaction amount" unclear | Pricing |
| Assumption | Amount threshold in euros, including VAT; clearing date decides the grid | Pricing |
| Issue | The manual rate table process has no owner today | Head of Clearing |
| Dependency | Acquirers' own merchant re-pricing (IMP-07) | Acquirers |

### 9 · To confirm
- Clearing date vs authorisation date for transactions around 1 April: **Pricing**.
- Amount used for the 20 € threshold with partial clearing: **Pricing, Clearing IT**.
- Notice period in the member rules and publication date: **Scheme governance**.
- Interchange caps and merchant transparency duties: **Compliance**.
