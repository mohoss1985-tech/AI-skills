{"client": "Banque Lumière (sample)", "skill": "curating-knowledge-bases", "title": "Content backlog from 4 weeks of assistant logs"}
===INPUT===
The assistant has been live for 4 weeks on cards & payments. Export of conversations where it said "I can't answer that reliably" or got a thumbs down (anonymised, grouped by the data team):

- "Apple Pay / Google Pay card not working after replacement" 1,350 conversations, no article
- "Card declined abroad" 1,100, answered but 22% thumbs down: two pages give different limits (Card limits 2026 says 1,500€, Travel FAQ says 1,000€)
- "Instant transfer to a new beneficiary blocked" 900, the article exists but is a scanned PDF from Pricing
- "How long for a new card" 600, answered, fine
- "Change PIN" 450, article from 2023 with old app screenshots
- "Virtual card" 300, product launches next month, no content yet

Help centre: 420 articles, owner Digital team. Tariffs: owner Pricing. 3 writers available, about 15 articles per week.
===OUTPUT===
### 1 · Source inventory (sources involved in these gaps)

| Source | Owner | Format | Last review | Flags |
|---|---|---|---|---|
| Card limits 2026 | Digital | Help article | Jan 2026 | ⚠️ Contradicts Travel FAQ |
| Travel FAQ | Marketing | Help article | Jun 2024 | ⚠️ Contradiction, ⚠️ over 12 months old |
| Instant transfer: new beneficiary | Pricing | **Scanned PDF** | Mar 2026 | ⚠️ Not retrievable (no text layer) |
| Change your PIN | Digital | Help article | 2023 | ⚠️ Old screenshots, over 12 months old |
| Mobile wallets (Apple Pay, Google Pay) | — | — | — | ❌ Missing |
| Virtual card | Product | — | — | ❌ Missing, launch next month |

### 2 · Coverage map, ranked by volume

| Intent | Conversations / 4 wks | Gap type | Impact today | Priority |
|---|---|---|---|---|
| Mobile wallet not working after card replacement | 1,350 | **Missing** | "I can't answer" → advisor | **P1** |
| Card declined abroad | 1,100 | **Contradiction** | Wrong limit given in some answers, 22% 👎 | **P1** (customer harm) |
| Instant transfer to new beneficiary | 900 | **Not retrievable** | "I can't answer" → advisor | **P1** |
| Change PIN | 450 | **Outdated** | Customers can't find the menu | P2 |
| Virtual card | 300 | **Missing, upcoming** | "I can't answer" | P2 (before launch) |
| New card delivery time | 600 | ✓ Covered | — | — |

> If the three P1 fixes bring "I can't answer" and 👎 down by 70% on those intents, that's about 2,350 conversations a month resolved without an advisor (to confirm after release).

### 3 · Content backlog

**KB-01 · Write "Use your new card with Apple Pay or Google Pay"** · P1 · Writer: Digital · Reviewer: Cards product
As a customer with a replacement card, I want to know how to add it to my phone wallet, so that I can pay with my phone again.
- [ ] One question per section: *Why doesn't my wallet work after a new card?* · *How do I add the new card?* (iPhone, Android) · *What if it still fails?*
- [ ] Answer in the first sentence of each section
- [ ] Metadata: `intent: wallet_replacement`, `product: debit_card`, `valid_from`, `owner`
- [ ] Test questions PAY-020 to PAY-024 pass in the evaluation set

**KB-02 · Resolve the "card limits abroad" contradiction** · P1 · Decision: Cards product owner · Writer: Digital
- [ ] Product owner confirms the correct limit (1,500€ per 30 days per *Card limits 2026*?)
- [ ] Travel FAQ links to *Card limits 2026* instead of repeating the number
- [ ] Travel FAQ moved to owner Digital, review date set
- [ ] Old chunks re-indexed; PAY-003 and PAY-011 pass

**KB-03 · Publish "Instant transfer to a new beneficiary" as text** · P1 · Writer: Pricing + Digital
- [ ] PDF content rewritten as a help article with a plain-text fee table
- [ ] `valid_from` / `valid_to` set; PDF archived
- [ ] FEE-010 to FEE-013 pass

**KB-04 · Update "Change your PIN"** · P2 · New screenshots from the current app, steps as a numbered list, review date 12 months.

**KB-05 · Draft "Virtual card" articles before launch** · P2 · With Product: *What is a virtual card?* · *Create one* · *Limits and fees*. Publish on launch day with `valid_from` = launch date so the assistant doesn't answer before.

**Capacity:** KB-01 to KB-03 fit in week 1 (about 8 articles), KB-04 and KB-05 in week 2.

### 4 · Writing standard (retrieval-friendly)

1. **One question per section**, phrased like the customer asks it, as the heading.
2. **Answer first** in one sentence, details after.
3. **Numbers in text, never only in images or PDFs.** Every fee and limit in a table with its unit and validity date.
4. **One truth, one place:** other pages link to it instead of copying the number.
5. **Self-contained sections:** each section makes sense on its own (chunks get retrieved alone). Repeat the product name, avoid "as above".
6. **Plain words**, short sentences, no internal jargon (*"opposition"* → *"block your card"*).

**Metadata schema**

| Field | Example | Used for |
|---|---|---|
| `intent` | `wallet_replacement` | Coverage reporting |
| `product` | `debit_card` | Filtering |
| `audience` | `customer` / `advisor` | Entitlement filter |
| `owner` | `Digital` | Review routing |
| `status` | `draft` / `approved` / `archived` | Only `approved` is retrievable |
| `valid_from` / `valid_to` | `2026-01-01` | No outdated answers |
| `review_by` | `2027-01-01` | Freshness alerts |

### 5 · Governance

| Activity | Digital | Pricing | Product | PO assistant | Data science |
|---|---|---|---|---|---|
| Write and update articles | **R/A** | R (tariffs) | C | I | — |
| Decide the correct number when pages disagree | C | A (tariffs) | **A** (product rules) | R (raises it) | — |
| Weekly gap report from logs | I | I | I | **A** | R |
| Re-index and re-test after a release | I | — | — | A | **R** |

**Review calendar:** tariffs at each price change and every January · procedures every 12 months · any article with 👎 > 15% for 2 weeks reviewed within 5 working days.

**Next step:** re-run the evaluation on PAY, FEE and the new wallet questions after KB-01 to KB-03 go live.
