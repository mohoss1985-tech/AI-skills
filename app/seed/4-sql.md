{"client": "Northwind Retail (sample)", "skill": "generating-sql", "title": "30-day repeat purchase rate by cohort", "input_tokens": 1990, "output_tokens": 980, "seconds": 29}
===INPUT===
PostgreSQL. What share of new customers order again within 30 days, by month of their first order? Exclude test accounts and cancelled orders.

orders(id, customer_id, status, created_at timestamptz, total_cents)
customers(id, email, is_test boolean, created_at)
===OUTPUT===
### Restated question
- **Metric:** % of first-time buyers who place a 2nd paid order within 30 days of the first
- **Grain:** one row per month of first order
- **Filters:** `status = 'paid'`, `is_test = false`
- **Window:** all history; timestamps converted to Europe/Paris before truncating *(assumed timezone)*
- **Dialect:** PostgreSQL

### Query

```sql
WITH paid_orders AS (            -- real, paid orders only
  SELECT o.id, o.customer_id,
         o.created_at AT TIME ZONE 'Europe/Paris' AS ordered_at
  FROM orders o
  JOIN customers c ON c.id = o.customer_id
  WHERE o.status = 'paid'
    AND NOT c.is_test
),
first_order AS (                 -- each customer's first purchase
  SELECT customer_id, MIN(ordered_at) AS first_at
  FROM paid_orders
  GROUP BY customer_id
),
repeaters AS (                   -- customers with another order inside 30 days
  SELECT DISTINCT f.customer_id
  FROM first_order f
  JOIN paid_orders p
    ON p.customer_id = f.customer_id
   AND p.ordered_at >  f.first_at
   AND p.ordered_at <  f.first_at + INTERVAL '30 days'
)
SELECT
  DATE_TRUNC('month', f.first_at)::date              AS cohort_month,
  COUNT(*)                                           AS new_customers,
  COUNT(r.customer_id)                               AS repeat_customers,
  ROUND(100.0 * COUNT(r.customer_id) / NULLIF(COUNT(*), 0), 1) AS repeat_30d_pct
FROM first_order f
LEFT JOIN repeaters r ON r.customer_id = f.customer_id
GROUP BY 1
ORDER BY 1;
```

### How it works
1. **paid_orders** keeps paid orders from real customers and converts times to local time.
2. **first_order** finds each customer's first purchase date.
3. **repeaters** lists customers who bought again within 30 days. `DISTINCT` stops a customer with three orders being counted twice.
4. The final select counts new and repeat customers per first-order month.

### Validation
```sql
-- 1. Grain: one row per customer in first_order
SELECT customer_id, COUNT(*) FROM (/* first_order */) x GROUP BY 1 HAVING COUNT(*) > 1;
-- 2. Totals: new_customers summed across months = distinct paying customers
SELECT COUNT(DISTINCT customer_id) FROM orders o JOIN customers c ON c.id=o.customer_id
WHERE o.status='paid' AND NOT c.is_test;
-- 3. NULL check on keys
SELECT COUNT(*) FROM orders WHERE customer_id IS NULL OR created_at IS NULL;
```

### Notes
- The latest cohort month is incomplete: customers from the last 30 days haven't had a full window yet. Exclude it or label it.
- An index on `orders (customer_id, created_at) WHERE status = 'paid'` keeps the self-join fast.
