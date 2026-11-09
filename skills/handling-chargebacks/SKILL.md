---
name: handling-chargebacks
description: Analyses and specifies payment cancellation, refunds and chargebacks - reversal vs refund, Visa dispute conditions (10-13, Allocation vs Collaboration), representment, pre-arbitration, arbitration, deadlines, liability shift (3-D Secure, wallet cryptogram) and who pays at each step; CB impayés with CMF L133-18 / L133-24. Produces timelines, ledgers, rules tables, evidence checklists, API specs and test cases. Use when someone asks how to cancel, refund or charge back a card payment, what a dispute reason code means, who carries a fraud loss, or to design a dispute process (litige, impayé, représentation).
---

# Cancellation, refunds and chargebacks

You act as a payments Business Analyst (issuer or acquirer side). Visa vocabulary in English (Harbor Bank), CB vocabulary in French (Banque Lumière: *annulation*, *remboursement / avoir*, *impayé*, *représentation*). A dispute spec is good when **every transition has an allowed and a refused case, every deadline names its source and confidence, and nobody can be credited twice**.

Tool: **Payment lifecycle & chargeback simulator** in Analyst Kit (`#/tool/payment-lifecycle`) replays the flow on the demo mock (rules P3–P7, R1–R3, D1–D16) with a clock, a ledger and the deadlines table. Use it to show the case, then paste its Markdown / CSV exports.

## 1. Decision tree: which tool fixes the payment?

| Question | Answer | Use |
|---|---|---|
| Is the payment cleared (captured)? | No | **Reversal** (full or partial) or **void** (same day, before the batch). Nothing clears, no refund, no cost |
| Final amount lower before clearing (hotel, fuel)? | Yes | **Partial capture**: the rest is released |
| Cleared, merchant agrees | Yes | **Refund** (credit): a new transaction, visible in 1–5 days |
| Cleared, merchant did not fix it, or fraud | Yes | **Chargeback** raised by the issuer through the scheme |

The rule to write down: **cancel = reversal before clearing, refund after clearing. A chargeback is the scheme's tool when the merchant did not refund.** A refund on top of an open chargeback pays the cardholder twice (R3). A chargeback on an already-refunded payment is invalid (D8).

## 2. Classify the dispute

| Category | Conditions (public names) | Workflow | Merchant step |
|---|---|---|---|
| 10 Fraud | 10.1 EMV counterfeit · 10.2 EMV non-counterfeit · 10.3 other fraud card-present · 10.4 other fraud card-absent · 10.5 monitoring programme | **Allocation** | None: the scheme assigns liability; the acquirer may file pre-arbitration |
| 11 Authorisation | 11.1 card recovery bulletin · 11.2 declined · 11.3 no authorisation | Allocation | Same |
| 12 Processing errors | 12.1–12.7 (late presentment, wrong currency, amount, duplicate…) | **Collaboration** | Representment with evidence |
| 13 Consumer disputes | 13.1 not received · 13.2 cancelled recurring · 13.3 not as described · 13.6 credit not processed · 13.7 cancelled … | Collaboration | Representment with evidence |

A 10.x dispute needs the fraud report first (D3). 13.1 needs the expected delivery date in the past (D11).

## 3. Timeline, deadlines and who pays

1. **Authorisation**: hold only, no money moves.
2. **Clearing**: cardholder debited, merchant paid. Day 0 for disputes.
3. **Chargeback**: issuer credits the cardholder, acquirer debits the merchant (+ contract fee, *to confirm*). Raise within **120 days** of the processing date (Visa, public; exceptions per condition *to confirm*).
4. **Representment**: merchant answers within **30 days** at scheme level (public); acquirers give less (Adyen: 18 days, 9 for US/Canada). Matching evidence wins: money back to the merchant; the issuer re-bills the cardholder or absorbs.
5. **Pre-arbitration**: the other side has **30 days** to accept or decline.
6. **Arbitration**: the scheme decides on the evidence on file, **no new evidence**; the loser pays the amount and the filing fee (USD 600 cited by Adyen, *to confirm*).
Accepted or missed deadline: the merchant pays.

Keep all deadlines and fees in **one table**: `scheme · step · value · confidence (public | to confirm) · source URL`, and state whether the last day is inclusive.

## 4. Merchant evidence

| Condition | Evidence that wins the first round | Weak evidence |
|---|---|---|
| 13.1 not received | Proof of delivery (signed) | Tracking only |
| 13.3 not as described | Product description + return policy | Photos alone |
| 13.6 / 13.7 credit, cancelled | Refund already issued, or cancellation policy accepted | — |
| 12.6 duplicate | Two separate orders | — |
| 10.4 fraud | Compelling Evidence 3.0 (eligibility *to confirm*) | — |

When to accept: the merchant has no matching evidence, the amount is lower than the cost of defending, or liability is plainly theirs.

## 5. Liability shift (fraud conditions only)

- Card-absent, **3-D Secure authenticated (ECI 05)**: a 10.4 dispute is blocked; the **issuer** carries the fraud.
- **Attempted (ECI 06)**: treated differently by region (*to confirm*).
- **Wallet payment with a device cryptogram**: public processor sources treat it as authenticated (exact ECI and rules *to confirm*).
- Card-present chip or contactless: conditions 10.1 / 10.2, not 3-D Secure.
- Exclusions exist (missing CAVV, some MCCs, monitoring programmes). The shift **never** covers 13.x.

## 6. France / CB: two tracks

- **Cardholder rights (CMF)**: an unauthorised payment is refunded **immediately, at the latest by the end of the next business day** (L133-18), unless the bank has good reason to suspect cardholder fraud (and informs the Banque de France). The cardholder can contest for **13 months** after the debit (L133-24). Gross negligence is the bank's to prove (L133-23, wording *to confirm*).
- **Interbank impayé**: motifs and deadlines live in the CB rulebook (not public). Adyen documents motif **45** "Fraude – opération contestée" (cannot be defended) and auto-defence when the payment was refunded or 3-D Secure authenticated. Every other CB code and deadline: *to confirm*.
- The bank may owe the L133-18 refund even when it can no longer raise an impayé. Never merge the two tracks in one status field.

## 7. Output contract

1. Decision tree (§1) for the case.
2. Timeline per stage with dates, deadline countdowns, workflow badge and confidence.
3. Ledger CSV: date · movement · debit party · credit party · amount ("who carries the money now").
4. BPMN with lanes Cardholder, Issuer, Scheme, Acquirer, Merchant.
5. Rules table P/R/D with an allowed and a refused example per rule.
6. Evidence checklist per condition (§4).
7. API fragment (`/payments`, `/capture`, `/reversal`, `/refunds`, `/disputes`, `/representment`, `/pre-arbitration`) and PL-style tests.
8. Open questions (acquirer windows, fees, ECI 06, CB motifs).

## 8. Quality check

- Allowed and refused case per transition; deadline boundaries tested (day 30 vs day 31) and stated as inclusive or exclusive.
- No double credit: refund blocked while a dispute is open; dispute blocked after a full refund.
- Liability shift applied to fraud conditions only.
- Rulebook values (CB motifs, fees, regional rules) marked *to confirm* with the source of what is public.
- Hand-off: process → `modeling-processes`; rules → `writing-functional-specs`; stories → `writing-user-stories`; tests → `testing-apis`, `managing-xray-tests`; data from the dispute tables → `generating-sql`; token effects of the card block → `tokenizing-cards`.
