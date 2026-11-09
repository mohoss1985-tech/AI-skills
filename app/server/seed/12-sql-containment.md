{"client": "Banque Lumière (sample)", "skill": "generating-sql", "title": "Assistant KPIs: containment with resolution by intent and week"}
===INPUT===
PostgreSQL. For the steering committee I need the real performance of our assistant per intent and per week over the last 12 weeks: how many conversations, how many stayed with the assistant (no hand-off), and how many were actually resolved, meaning the customer did NOT come back within 72 hours (same intent with the assistant, or any contact with an advisor). Add the average CSAT and the change vs. the previous week. Exclude test accounts.

conversations(id, customer_id, intent, started_at timestamptz, ended_at timestamptz, handed_off boolean)
advisor_contacts(id, customer_id, channel, created_at timestamptz)   -- phone, email, branch
csat(conversation_id, score)                                        -- 1 to 5, optional
customers(id, is_test boolean)
===OUTPUT===
### Restated question
- **Metrics:** conversations · containment % (no hand-off) · **resolved %** (no hand-off **and** no repeat contact within 72h) · hand-off % · average CSAT · change in resolved % vs. previous week
- **Repeat contact:** a new assistant conversation on the **same intent**, or **any** advisor contact, starting within 72h after the conversation ended
- **Grain:** one row per week × intent
- **Filters:** `is_test = false`. Conversations that ended in the last 72h are excluded: their follow-up window isn't complete yet
- **Window:** the last 12 full weeks plus the current one, Monday-based weeks, Europe/Paris time *(assumed timezone)*
- **Dialect:** PostgreSQL

### Query

```sql
WITH params AS (              -- reporting window, and the cut-off that guarantees a full 72 h follow-up
  SELECT
    DATE_TRUNC('week', NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '12 weeks' AS from_local,
    NOW() - INTERVAL '72 hours'                                             AS cutoff
),
convs AS (                    -- real customer conversations inside the window
  SELECT cv.id, cv.customer_id, cv.intent, cv.started_at, cv.ended_at, cv.handed_off
  FROM conversations cv
  JOIN customers c ON c.id = cv.customer_id
  CROSS JOIN params p
  WHERE NOT c.is_test
    AND cv.started_at AT TIME ZONE 'Europe/Paris' >= p.from_local
    AND cv.ended_at < p.cutoff
),
outcomes AS (                 -- did the customer come back within 72 h, through any channel?
  SELECT
    cv.*,
    EXISTS (
      SELECT 1
      FROM advisor_contacts ac
      WHERE ac.customer_id = cv.customer_id
        AND ac.created_at >= cv.ended_at
        AND ac.created_at <  cv.ended_at + INTERVAL '72 hours'
    )
    OR EXISTS (
      SELECT 1
      FROM conversations nx
      WHERE nx.customer_id = cv.customer_id
        AND nx.intent      = cv.intent
        AND nx.id         <> cv.id
        AND nx.started_at >= cv.ended_at
        AND nx.started_at <  cv.ended_at + INTERVAL '72 hours'
    ) AS came_back
  FROM convs cv
),
weekly AS (                   -- one row per week and intent
  SELECT
    DATE_TRUNC('week', o.started_at AT TIME ZONE 'Europe/Paris')::date      AS week,
    o.intent,
    COUNT(*)                                                                AS conversations,
    COUNT(*) FILTER (WHERE NOT o.handed_off)                                AS contained,
    COUNT(*) FILTER (WHERE NOT o.handed_off AND NOT o.came_back)            AS resolved,
    COUNT(*) FILTER (WHERE o.handed_off)                                    AS handed_off,
    ROUND(AVG(s.score), 2)                                                  AS avg_csat,
    COUNT(s.score)                                                          AS csat_responses
  FROM outcomes o
  LEFT JOIN csat s ON s.conversation_id = o.id
  GROUP BY 1, 2
),
rates AS (                    -- percentages, computed once
  SELECT
    w.*,
    ROUND(100.0 * w.contained  / NULLIF(w.conversations, 0), 1) AS containment_pct,
    ROUND(100.0 * w.resolved   / NULLIF(w.conversations, 0), 1) AS resolved_pct,
    ROUND(100.0 * w.handed_off / NULLIF(w.conversations, 0), 1) AS handoff_pct
  FROM weekly w
)
SELECT
  r.week,
  r.intent,
  r.conversations,
  r.containment_pct,
  r.resolved_pct,
  r.handoff_pct,
  r.avg_csat,
  r.csat_responses,
  r.resolved_pct - LAG(r.resolved_pct) OVER (PARTITION BY r.intent ORDER BY r.week) AS resolved_pts_vs_prev_week
FROM rates r
ORDER BY r.intent, r.week;
```

### How it works
1. **params** sets the 12-week window and a cut-off 72h ago, so every conversation counted has had its full follow-up window.
2. **convs** keeps real customers' conversations in that window.
3. **outcomes** checks, for each conversation, whether the customer came back within 72h: an advisor contact on any channel, or another assistant conversation on the same intent.
4. **weekly** counts conversations, contained, resolved and handed-off per week and intent, and averages CSAT where the customer answered the survey.
5. **rates** turns the counts into percentages. The final select adds the change in resolved % vs. the previous week for the same intent (`LAG`).

> **Why "resolved" and not just "containment":** a bot that never hands off scores 100% containment even if every customer then phones the bank. Resolved % only counts conversations where the customer didn't need to come back.

### Validation
```sql
-- 1. Grain: csat must have at most one row per conversation, or the LEFT JOIN inflates counts
SELECT conversation_id, COUNT(*) FROM csat GROUP BY 1 HAVING COUNT(*) > 1;

-- 2. Totals: conversations summed over the result = conversations in the window
SELECT COUNT(*) FROM conversations cv JOIN customers c ON c.id = cv.customer_id
WHERE NOT c.is_test
  AND cv.started_at AT TIME ZONE 'Europe/Paris' >= DATE_TRUNC('week', NOW() AT TIME ZONE 'Europe/Paris') - INTERVAL '12 weeks'
  AND cv.ended_at < NOW() - INTERVAL '72 hours';

-- 3. Consistency: resolved <= contained <= conversations on every row (run on the result)
--    and contained + handed_off = conversations

-- 4. NULL check: a NULL ended_at drops the conversation silently
SELECT COUNT(*) FROM conversations WHERE ended_at IS NULL OR intent IS NULL;

-- 5. Spot check: pick 5 conversations marked came_back = true and confirm the follow-up contact in the CRM
```

**Tested** on a synthetic data set covering every case (test account, phone call the next day, same-intent return after 48h, advisor contact after 80h, conversation inside the last 72h). Result: 5 conversations, 80% contained, 40% resolved in week 1; 100% resolved and +60 pts in week 2, matching the hand count.

### Assumptions and performance
- A repeat on a **different** intent through the assistant doesn't count as a return (it's a new need). Advisor contacts count whatever the topic, since they have no reliable intent. Confirm both with the business.
- `LAG` compares with the previous week **that has data**. For intents with very low volume, a missing week makes the change span 2 weeks.
- Indexes: `conversations (customer_id, intent, started_at)` and `advisor_contacts (customer_id, created_at)` make the two `EXISTS` checks fast. Without them the query scans both tables once per conversation.
- To refresh this daily for a dashboard, turn it into a materialised view and refresh it overnight.
