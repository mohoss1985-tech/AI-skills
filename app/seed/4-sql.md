{"client": "Hexa card scheme (sample)", "skill": "generating-sql", "title": "Interchange check: billed vs expected per acquirer"}
===INPUT===
Every month we bill interchange to acquirers (paid on to issuers). Finance thinks some clearing records were billed with the wrong interchange category. Check last month: per acquirer, expected vs billed interchange, and the transactions where they differ by more than 1 cent. PostgreSQL.

clearing_record(clearing_id, acquirer_id, issuer_id, card_product, card_type 'debit'|'credit'|'commercial', consumer boolean, merchant_country, card_country, mcc, amount_cents, currency, clearing_date, ic_category, ic_billed_cents)
ic_rate(ic_category, valid_from, valid_to, rate_pct numeric, fixed_cents int)  -- valid_to null = current
ic_assignment(card_type, consumer, domestic boolean, ic_category)  -- which category should apply
===OUTPUT===
### Restated question
For **last month's clearing records**, compute the **expected interchange** (from the category the card and transaction should get, and the rate valid on the clearing date), compare it with the **billed** interchange, and show per acquirer the totals and the number of records off by more than 1 cent. Then list those records.

- **Grain:** one row per acquirer (summary), one row per clearing record (detail).
- **Period:** previous calendar month, by `clearing_date`.
- **Domestic:** merchant country = card country.
- **Assumption:** expected interchange = `ROUND(amount × rate% / 100) + fixed`, in cents. *(Confirm the rounding rule with Finance.)*

### Query

interchange_check.sql
```sql
WITH last_month AS (
  SELECT date_trunc('month', current_date) - interval '1 month' AS start_d,
         date_trunc('month', current_date)                      AS end_d
),
records AS (
  SELECT c.*, (c.merchant_country = c.card_country) AS domestic
  FROM clearing_record c, last_month m
  WHERE c.clearing_date >= m.start_d AND c.clearing_date < m.end_d
),
expected AS (
  SELECT r.clearing_id, r.acquirer_id, r.amount_cents, r.ic_category AS billed_category, r.ic_billed_cents,
         a.ic_category AS expected_category,
         ROUND(r.amount_cents * rt.rate_pct / 100) + rt.fixed_cents AS ic_expected_cents
  FROM records r
  LEFT JOIN ic_assignment a
    ON a.card_type = r.card_type AND a.consumer = r.consumer AND a.domestic = r.domestic
  LEFT JOIN ic_rate rt
    ON rt.ic_category = a.ic_category
   AND r.clearing_date >= rt.valid_from
   AND (rt.valid_to IS NULL OR r.clearing_date < rt.valid_to)
)
SELECT acquirer_id,
       COUNT(*)                                                              AS records,
       SUM(ic_billed_cents) / 100.0                                          AS billed_eur,
       SUM(ic_expected_cents) / 100.0                                        AS expected_eur,
       (SUM(ic_billed_cents) - SUM(ic_expected_cents)) / 100.0               AS difference_eur,
       COUNT(*) FILTER (WHERE ABS(ic_billed_cents - ic_expected_cents) > 1)  AS records_off,
       COUNT(*) FILTER (WHERE billed_category <> expected_category)          AS wrong_category,
       COUNT(*) FILTER (WHERE ic_expected_cents IS NULL)                     AS no_rule_found
FROM expected
GROUP BY acquirer_id
ORDER BY ABS(SUM(ic_billed_cents) - SUM(ic_expected_cents)) DESC NULLS FIRST;
```

Detail of the records to correct (same CTEs, last `SELECT` replaced):

```sql
SELECT acquirer_id, clearing_id, amount_cents, billed_category, expected_category,
       ic_billed_cents, ic_expected_cents, ic_billed_cents - ic_expected_cents AS diff_cents
FROM expected
WHERE ic_expected_cents IS NULL OR ABS(ic_billed_cents - ic_expected_cents) > 1
ORDER BY ABS(ic_billed_cents - ic_expected_cents) DESC NULLS FIRST;
```

### How it works
1. **last_month** fixes the period once, so the whole query uses the same dates.
2. **records** adds *domestic* (merchant and card in the same country), which decides the category together with card type and consumer / commercial.
3. **expected** finds the category the record *should* have (`ic_assignment`) and the rate **valid on the clearing date** (`ic_rate`), so a rate change in the middle of the month is handled.
4. The final query compares totals per acquirer and counts the records off by more than 1 cent, the ones in the wrong category, and those with no rule at all.

### Validation
- **Totals:** `SUM(ic_billed_cents)` must equal the interchange line of last month's acquirer invoices. If not, the period or the source differs.
- **Overlapping rates:** this must return nothing, or a record would be counted twice:
```sql
SELECT a.ic_category FROM ic_rate a JOIN ic_rate b
  ON a.ic_category = b.ic_category AND a.valid_from < b.valid_from
 AND (a.valid_to IS NULL OR a.valid_to > b.valid_from);
```
- **No rule found:** records with `expected_category` NULL point to a gap in `ic_assignment` (e.g. cross-border or a new card product), not to a billing error. They count in `billed_eur` but not in `expected_eur`, so check `no_rule_found` before reading the difference.
- **Spot check:** recompute 5 records by hand, one per category.

### Notes
- Commercial cards are outside the EU interchange caps that apply to consumer cards: they have their own categories here.
- Amounts are in cents; currency is assumed EUR. If not, filter `currency = 'EUR'` or convert first.
