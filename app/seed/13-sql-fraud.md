{"client": "Banque Lumière (sample)", "skill": "generating-sql", "title": "Suspicious card decline bursts: how fast do customers reach us?"}
===INPUT===
PostgreSQL. The fraud team wants to know, over the last 30 days: when a card has a burst of declined payments that looks like fraud (3 or more declines close together, in at least 2 different countries), how fast does the customer contact us, through which channel (assistant, phone, email, branch), and how long until the card is blocked? This feeds the "card lost or stolen" journey design.

card_authorisations(id, card_id, authorised_at timestamptz, merchant_country char(2), amount_cents, result)   -- result: approved / declined
cards(id, customer_id)
card_events(card_id, event, created_at timestamptz)          -- event: blocked_by_customer, blocked_by_bank, unblocked…
conversations(id, customer_id, intent, started_at timestamptz)   -- assistant
advisor_contacts(id, customer_id, channel, created_at timestamptz)
===OUTPUT===
### Restated question
- **Burst:** consecutive declined payments on the same card, each **within 2 hours** of the previous one *(assumed: confirm the gap with the fraud team)*
- **Suspicious burst:** 3 or more declines **and** 2 or more merchant countries
- **Metrics per burst:** declines, countries, amount attempted, first contact channel and time to contact (within 48h), time to block (within 48h)
- **Grain:** one row per suspicious burst, plus a summary
- **Window:** declines in the last 30 days
- **Dialect:** PostgreSQL

### Query

```sql
WITH declines AS (            -- declined payments, with the time of the previous decline on the same card
  SELECT
    a.card_id,
    a.authorised_at,
    a.merchant_country,
    a.amount_cents,
    LAG(a.authorised_at) OVER (PARTITION BY a.card_id ORDER BY a.authorised_at) AS prev_at
  FROM card_authorisations a
  WHERE a.result = 'declined'
    AND a.authorised_at >= NOW() - INTERVAL '30 days'
),
numbered AS (                 -- gaps and islands: a new burst starts after more than 2 h of quiet
  SELECT
    d.*,
    SUM(CASE WHEN d.prev_at IS NULL
               OR d.authorised_at - d.prev_at > INTERVAL '2 hours' THEN 1 ELSE 0 END)
      OVER (PARTITION BY d.card_id ORDER BY d.authorised_at ROWS UNBOUNDED PRECEDING) AS burst_no
  FROM declines d
),
bursts AS (                   -- one row per burst, kept only if it looks like fraud
  SELECT
    n.card_id,
    n.burst_no,
    MIN(n.authorised_at)                                        AS started_at,
    MAX(n.authorised_at)                                        AS ended_at,
    COUNT(*)                                                    AS declines,
    COUNT(DISTINCT n.merchant_country)                          AS countries,
    STRING_AGG(DISTINCT n.merchant_country, ', ')               AS country_list,
    SUM(n.amount_cents) / 100.0                                 AS attempted_eur
  FROM numbered n
  GROUP BY n.card_id, n.burst_no
  HAVING COUNT(*) >= 3
     AND COUNT(DISTINCT n.merchant_country) >= 2
),
detail AS (                   -- first contact and first block after each burst
  SELECT
    b.card_id,
    c.customer_id,
    b.started_at,
    b.ended_at,
    b.declines,
    b.country_list,
    b.attempted_eur,
    fc.channel                         AS first_contact_channel,
    fc.contacted_at - b.started_at     AS time_to_contact,
    blk.created_at - b.started_at      AS time_to_block,
    blk.event                          AS blocked_by
  FROM bursts b
  JOIN cards c ON c.id = b.card_id
  LEFT JOIN LATERAL (         -- first time the customer reached us, any channel, within 48 h
    SELECT x.channel, x.contacted_at
    FROM (
      SELECT 'assistant' AS channel, cv.started_at AS contacted_at
      FROM conversations cv
      WHERE cv.customer_id = c.customer_id
      UNION ALL
      SELECT ac.channel, ac.created_at
      FROM advisor_contacts ac
      WHERE ac.customer_id = c.customer_id
    ) x
    WHERE x.contacted_at >= b.started_at
      AND x.contacted_at <  b.started_at + INTERVAL '48 hours'
    ORDER BY x.contacted_at
    LIMIT 1
  ) fc ON TRUE
  LEFT JOIN LATERAL (         -- first block of the card within 48 h, by the customer or the bank
    SELECT e.created_at, e.event
    FROM card_events e
    WHERE e.card_id = b.card_id
      AND e.event IN ('blocked_by_customer', 'blocked_by_bank')
      AND e.created_at >= b.started_at
      AND e.created_at <  b.started_at + INTERVAL '48 hours'
    ORDER BY e.created_at
    LIMIT 1
  ) blk ON TRUE
)
SELECT *
FROM detail
ORDER BY started_at DESC;
```

**Summary for the fraud team:** replace the final `SELECT` with:

```sql
SELECT
  COALESCE(first_contact_channel, 'no contact in 48 h')                         AS first_contact_channel,
  COUNT(*)                                                                       AS bursts,
  ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (), 1)                             AS share_pct,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_to_contact)                   AS median_time_to_contact,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY time_to_block)                     AS median_time_to_block,
  ROUND(100.0 * COUNT(time_to_block) / COUNT(*), 1)                              AS blocked_within_48h_pct
FROM detail
GROUP BY 1
ORDER BY bursts DESC;
```

### How it works
1. **declines** lists every declined payment in the last 30 days and looks up when the previous decline on the same card happened (`LAG`).
2. **numbered** groups declines into bursts: each time more than 2 hours passed since the previous decline, a new burst number starts (the classic *gaps and islands* pattern, a running `SUM` over a 0/1 flag).
3. **bursts** summarises each burst and keeps only the suspicious ones: 3+ declines in 2+ countries.
4. **detail** finds, for each burst, the customer's **first contact** on any channel and the card's **first block** within 48 hours. `LATERAL … LIMIT 1` takes only the earliest of each, so a customer who calls three times isn't counted three times.
5. The **summary** gives, per first channel, how many bursts, the median time to contact and to block, and the share blocked within 48h.

### Validation
```sql
-- 1. Burst logic: no two declines in the same burst are more than 2 h apart
--    (run on numbered) max gap per card_id, burst_no must be <= 2 hours

-- 2. Totals: declines summed over all bursts (before HAVING) = all declines in the window
SELECT COUNT(*) FROM card_authorisations
WHERE result = 'declined' AND authorised_at >= NOW() - INTERVAL '30 days';

-- 3. Grain: one row per card_id + started_at in detail
SELECT card_id, started_at, COUNT(*) FROM (/* detail */) d GROUP BY 1, 2 HAVING COUNT(*) > 1;

-- 4. Value check: result values are exactly 'approved' / 'declined' (a 'DECLINED' would be missed)
SELECT result, COUNT(*) FROM card_authorisations GROUP BY 1;

-- 5. Spot check: take the 3 largest bursts and compare with the fraud team's case files
```

**Tested** on a synthetic data set: a card declined in Portugal then Spain (3 declines in 70 min, customer asked the assistant, card blocked 5 minutes later), a single later decline (separate burst, ignored), 3 declines in one country (ignored), a US/GB burst followed by a phone call the next morning. The query returned exactly the 2 expected bursts with the right channels and timings.

### Assumptions and performance
- The **2-hour gap**, **3 declines** and **2 countries** are starting thresholds. Ask the fraud team for their rule, and check the volume of bursts it produces before using it in a dashboard.
- A burst that started just before the 30-day window may be cut in two. Widen the `declines` window by 2 hours if exact counts matter.
- Contacts are counted whatever their topic. To count only fraud-related contacts, filter `cv.intent IN ('card_lost_stolen', 'unknown_payment')` and the advisor contact reason, if it exists.
- `merchant_country` should be ISO codes. Card-not-present payments sometimes carry the acquirer's country, not the cardholder's location. Confirm with the fraud team.
- Indexes: `card_authorisations (card_id, authorised_at) WHERE result = 'declined'`, `card_events (card_id, created_at)`, `conversations (customer_id, started_at)`, `advisor_contacts (customer_id, created_at)`. On a large authorisation table, partition by month.
- **Personal data:** the detail output identifies customers. Share the summary outside the fraud team, not the detail.
