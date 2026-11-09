{"client": "Harbor Bank (sample)", "skill": "generating-sql", "lang": "en", "title": "Authorisation approval rate and top decline codes"}
===INPUT===
Daily approval rate of our Visa authorisations for the last 30 days, the share decided in stand-in, and the top 5 decline response codes per day. PostgreSQL.

authorisation(auth_id, auth_ts timestamptz, pan_token, amount_minor, currency, mcc, channel 'pos'|'ecom'|'atm', response_code char(2), stip boolean)
response_code '00' = approved.
===OUTPUT===
### Restated question
For each of the **last 30 days**, the share of authorisations approved (`00`), the share decided by **Visa Stand-In Processing**, and the **5 most frequent decline codes** with their share of declines.

- **Grain:** one row per day (summary), one row per day and decline code (top 5).
- **Period:** the 30 full days before today, by `auth_ts` in Europe/Paris time.
- **Assumption:** reversals and advices are not in this table *(confirm)*.

### Query

approval_rate.sql
```sql
WITH auth AS (
  SELECT (auth_ts AT TIME ZONE 'Europe/Paris')::date AS day, response_code, stip
  FROM authorisation
  WHERE auth_ts >= (current_date - 30) AND auth_ts < current_date
)
SELECT day,
       COUNT(*)                                                         AS authorisations,
       ROUND(100.0 * COUNT(*) FILTER (WHERE response_code = '00') / COUNT(*), 2) AS approval_rate_pct,
       ROUND(100.0 * COUNT(*) FILTER (WHERE stip) / COUNT(*), 2)        AS stip_pct
FROM auth
GROUP BY day
ORDER BY day;
```

Top 5 decline codes per day:

```sql
WITH declines AS (
  SELECT (auth_ts AT TIME ZONE 'Europe/Paris')::date AS day, response_code, COUNT(*) AS n
  FROM authorisation
  WHERE auth_ts >= (current_date - 30) AND auth_ts < current_date
    AND response_code <> '00'
  GROUP BY 1, 2
),
ranked AS (
  SELECT day, response_code, n,
         ROUND(100.0 * n / SUM(n) OVER (PARTITION BY day), 1) AS share_of_declines_pct,
         ROW_NUMBER() OVER (PARTITION BY day ORDER BY n DESC, response_code) AS rk
  FROM declines
)
SELECT day, rk, response_code, n, share_of_declines_pct
FROM ranked
WHERE rk <= 5
ORDER BY day, rk;
```

### How it works
1. **auth / declines** convert the timestamp to Paris time first, so a payment at 00:30 counts on the right day.
2. `COUNT(*) FILTER (WHERE …)` counts approvals and stand-in decisions in one pass.
3. **ranked** computes each code's share of the day's declines and ranks the codes; ties are broken by code so the result is stable.

### Reading the codes
| Code | Meaning | What to look at |
|---|---|---|
| 51 | Insufficient funds | Normal level, follows paydays |
| 05 | Do not honour | Too generic: check which rules return it |
| 59 | Suspected fraud | Fraud rule changes, attacks |
| 41 / 43 | Lost / stolen card | Rises after a PAN declaration campaign |
| 91 | Issuer unavailable | Host problems; compare with `stip_pct` |

### Validation
- **Totals:** the sum of `authorisations` over 30 days equals `SELECT COUNT(*)` on the same period.
- **Shares:** per day, `share_of_declines_pct` over all codes (without the top-5 filter) sums to 100.
- **Spot check:** pick one day and one code, count by hand.

### Notes
- A high `stip_pct` with few `91` means stand-in decided **for** us (time-outs): check the host's response times.
- For e-commerce only, add `AND channel = 'ecom'` in both queries.
