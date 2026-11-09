-- Analyst Kit V2 · demo card-payments dataset (SQLite dialect, runs in sql.js / sqlite3)
-- Entirely fictional: Harbor Bank (Visa, EN) and Banque Lumière (CB, FR). No PAN stored: bin + last4 + token only.
-- Period: October 2026 (fixed dates so the sample questions always return the same answer).
-- Stories hidden in the data (the 5 sample questions find them):
--   1. 2026-10-14 13:00-13:59 issuer host outage → Visa Stand-In Processing (stip=1), CB cards get 91.
--   2. End of month (25-31 Oct): more 51 insufficient funds.
--   3. 2026-10-17 02:00-02:59 card-testing attack on merchant M-011 → burst of 59 suspected fraud, 12 got through.
--   4. Disputes: one 10.4 without a fraud report, one opened after day 120.
--   5. crd_hb_009 blocked 09:00 on 18 Oct, listed on the Exception File only at 11:40 → one approval in stand-in at 10:15.

PRAGMA foreign_keys = ON;

DROP TABLE IF EXISTS fraud_reports;
DROP TABLE IF EXISTS disputes;
DROP TABLE IF EXISTS authorisations;
DROP TABLE IF EXISTS cards;
DROP TABLE IF EXISTS merchants;

CREATE TABLE merchants (
  merchant_id   TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  mcc           TEXT NOT NULL,          -- merchant category code
  country       TEXT NOT NULL,          -- ISO 3166 alpha-2
  city          TEXT,
  channel       TEXT NOT NULL CHECK (channel IN ('pos','ecom','atm')),
  acquirer      TEXT NOT NULL
);

CREATE TABLE cards (
  card_id                  TEXT PRIMARY KEY,
  brand                    TEXT NOT NULL CHECK (brand IN ('VISA','CB')),
  issuer                   TEXT NOT NULL,
  bin                      TEXT NOT NULL,          -- first 6 digits (test prefix)
  last4                    TEXT NOT NULL,
  pan_token                TEXT NOT NULL UNIQUE,   -- never the PAN
  product                  TEXT NOT NULL CHECK (product IN ('debit','credit')),
  segment                  TEXT NOT NULL CHECK (segment IN ('standard','premium','student')),
  status                   TEXT NOT NULL CHECK (status IN ('active','blocked','expired')),
  block_reason             TEXT CHECK (block_reason IN ('lost','stolen','used_without_permission')),
  blocked_at               TEXT,                   -- ISO 8601 UTC
  exception_file_listed_at TEXT,                   -- when the PAN reached the Visa Exception File / CB opposition list
  expiry                   TEXT NOT NULL,          -- YYYY-MM
  limit_minor              INTEGER NOT NULL,       -- monthly spending limit, cents
  country                  TEXT NOT NULL,
  opened_on                TEXT NOT NULL
);

CREATE TABLE authorisations (
  auth_id        TEXT PRIMARY KEY,
  auth_ts        TEXT NOT NULL,                     -- ISO 8601 UTC
  card_id        TEXT NOT NULL REFERENCES cards(card_id),
  merchant_id    TEXT NOT NULL REFERENCES merchants(merchant_id),
  scheme         TEXT NOT NULL CHECK (scheme IN ('VISA','CB')),
  channel        TEXT NOT NULL CHECK (channel IN ('pos','ecom','atm')),
  entry_mode     TEXT NOT NULL CHECK (entry_mode IN ('CHIP','CONTACTLESS','ECOM','MAGSTRIPE','MANUAL')),
  amount_minor   INTEGER NOT NULL CHECK (amount_minor > 0),
  currency       TEXT NOT NULL DEFAULT 'EUR',
  response_code  TEXT NOT NULL CHECK (response_code IN ('00','05','41','43','51','54','59','91')),
  stip           INTEGER NOT NULL DEFAULT 0 CHECK (stip IN (0,1)),  -- 1 = decided in stand-in
  arn            TEXT UNIQUE,                       -- acquirer reference number, approved & cleared only
  cleared        INTEGER NOT NULL DEFAULT 0 CHECK (cleared IN (0,1))
);
CREATE INDEX ix_auth_ts   ON authorisations(auth_ts);
CREATE INDEX ix_auth_card ON authorisations(card_id);

CREATE TABLE fraud_reports (
  fraud_report_id TEXT PRIMARY KEY,
  auth_id         TEXT NOT NULL UNIQUE REFERENCES authorisations(auth_id),  -- one report per transaction
  card_id         TEXT NOT NULL REFERENCES cards(card_id),
  fraud_type      TEXT NOT NULL CHECK (fraud_type IN ('0','1','2','3','4','5','6')), -- Visa fraud types, to confirm
  case_id         TEXT NOT NULL,
  confirmed_on    TEXT NOT NULL,
  reported_at     TEXT NOT NULL,
  amount_minor    INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  status          TEXT NOT NULL CHECK (status IN ('sent','accepted','rejected'))
);

CREATE TABLE disputes (
  dispute_id      TEXT PRIMARY KEY,
  auth_id         TEXT NOT NULL REFERENCES authorisations(auth_id),
  condition_code  TEXT NOT NULL,          -- Visa dispute condition (10.x, 11.x, 12.x, 13.x); CB: reason code to confirm
  amount_minor    INTEGER NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'EUR',
  status          TEXT NOT NULL CHECK (status IN ('submitted','acquirer_responded','pre_arbitration','won','lost','withdrawn')),
  opened_at       TEXT NOT NULL,
  closed_at       TEXT,
  fraud_report_id TEXT REFERENCES fraud_reports(fraud_report_id)
);

-- ------------------------------------------------------------------ merchants (fictional names)
INSERT INTO merchants VALUES
 ('M-001','Café du Port (demo)',          '5812','FR','Paris',     'pos', 'Acquirer A'),
 ('M-002','Northgate Grocers (demo)',     '5411','GB','London',    'pos', 'Acquirer B'),
 ('M-003','Bluebird Fuel (demo)',         '5541','FR','Lyon',      'pos', 'Acquirer A'),
 ('M-004','Harbor Bank ATM',              '6011','FR','Paris',     'atm', 'Harbor Bank'),
 ('M-005','Pixel Electronics (demo)',     '5732','NL','Amsterdam', 'ecom','Acquirer C'),
 ('M-006','Rail Tickets (demo)',          '4112','FR','Paris',     'ecom','Acquirer A'),
 ('M-007','Streamio Subscriptions (demo)','4899','IE','Dublin',    'ecom','Acquirer C'),
 ('M-008','Le Petit Marché (demo)',       '5411','FR','Nantes',    'pos', 'Acquirer A'),
 ('M-009','Atlas Hotels (demo)',          '7011','ES','Madrid',    'ecom','Acquirer B'),
 ('M-010','Corner Pharmacy (demo)',       '5912','FR','Lille',     'pos', 'Acquirer B'),
 ('M-011','QuickGift Codes (demo)',       '5999','MT','Valletta',  'ecom','Acquirer D'),
 ('M-012','FlyHigh Airways (demo)',       '4511','FR','Toulouse',  'ecom','Acquirer C');

-- ------------------------------------------------------------------ cards (bin 400000 = test prefix)
INSERT INTO cards VALUES
 ('crd_hb_001','VISA','Harbor Bank',   '400000','1014','tok_9f3a01','debit', 'standard','active', NULL,NULL,NULL,'2029-04',250000,'FR','2021-03-02'),
 ('crd_hb_002','VISA','Harbor Bank',   '400000','1023','tok_9f3a02','debit', 'student', 'active', NULL,NULL,NULL,'2028-06', 60000,'FR','2023-09-10'),
 ('crd_hb_003','VISA','Harbor Bank',   '400000','1032','tok_9f3a03','debit', 'standard','expired',NULL,NULL,NULL,'2026-09',150000,'FR','2022-09-01'),
 ('crd_hb_004','VISA','Harbor Bank',   '400000','1041','tok_9f3a04','debit', 'standard','blocked','lost',  '2026-10-21T08:30:00Z','2026-10-21T08:33:00Z','2028-11',150000,'FR','2023-11-15'),
 ('crd_hb_005','VISA','Harbor Bank',   '400000','1050','tok_9f3a05','credit','premium', 'blocked','stolen','2026-10-06T18:00:00Z','2026-10-06T18:02:00Z','2029-01',600000,'FR','2020-01-20'),
 ('crd_hb_006','VISA','Harbor Bank',   '400000','1069','tok_9f3a06','credit','premium', 'active', NULL,NULL,NULL,'2029-02',800000,'FR','2019-05-05'),
 ('crd_hb_007','VISA','Harbor Bank',   '400000','1078','tok_9f3a07','debit', 'standard','active', NULL,NULL,NULL,'2029-03',200000,'GB','2024-02-11'),
 ('crd_hb_008','VISA','Harbor Bank',   '400000','1087','tok_9f3a08','debit', 'standard','active', NULL,NULL,NULL,'2029-05',150000,'FR','2024-06-30'),
 ('crd_hb_009','VISA','Harbor Bank',   '400000','1096','tok_9f3a09','debit', 'standard','blocked','stolen','2026-10-18T09:00:00Z','2026-10-18T11:40:00Z','2028-08',150000,'FR','2022-08-08'),
 ('crd_hb_010','VISA','Harbor Bank',   '400000','1104','tok_9f3a10','credit','standard','active', NULL,NULL,NULL,'2027-12',300000,'FR','2022-12-01'),
 ('crd_hb_011','VISA','Harbor Bank',   '400000','1113','tok_9f3a11','debit', 'student', 'active', NULL,NULL,NULL,'2028-03', 50000,'FR','2025-03-01'),
 ('crd_hb_012','VISA','Harbor Bank',   '400000','1122','tok_9f3a12','debit', 'standard','active', NULL,NULL,NULL,'2029-07',200000,'ES','2024-07-19'),
 ('crd_hb_013','VISA','Harbor Bank',   '400000','1131','tok_9f3a13','credit','premium', 'active', NULL,NULL,NULL,'2028-10',900000,'FR','2018-10-10'),
 ('crd_hb_014','VISA','Harbor Bank',   '400000','1140','tok_9f3a14','debit', 'standard','active', NULL,NULL,NULL,'2029-09',150000,'FR','2025-09-09'),
 ('crd_bl_001','CB',  'Banque Lumière','400000','2013','tok_7c1b01','debit', 'standard','active', NULL,NULL,NULL,'2029-04',180000,'FR','2021-04-04'),
 ('crd_bl_002','CB',  'Banque Lumière','400000','2022','tok_7c1b02','debit', 'standard','blocked','used_without_permission','2026-10-12T07:45:00Z','2026-10-12T07:46:00Z','2028-12',150000,'FR','2022-12-12'),
 ('crd_bl_003','CB',  'Banque Lumière','400000','2031','tok_7c1b03','debit', 'student', 'active', NULL,NULL,NULL,'2029-06', 40000,'FR','2025-06-06'),
 ('crd_bl_004','CB',  'Banque Lumière','400000','2040','tok_7c1b04','credit','premium', 'active', NULL,NULL,NULL,'2028-05',700000,'FR','2019-05-15'),
 ('crd_bl_005','CB',  'Banque Lumière','400000','2059','tok_7c1b05','debit', 'standard','active', NULL,NULL,NULL,'2029-01',150000,'FR','2023-01-23'),
 ('crd_bl_006','CB',  'Banque Lumière','400000','2068','tok_7c1b06','debit', 'standard','active', NULL,NULL,NULL,'2027-11',150000,'FR','2021-11-30');

-- ------------------------------------------------------------------ 2,480 generated authorisations (deterministic)
-- 80 a day for 31 days, 06:00-23:00, active cards only, merchant mix weighted towards grocery / café.
INSERT INTO authorisations (auth_id, auth_ts, card_id, merchant_id, scheme, channel, entry_mode, amount_minor, currency, response_code, stip, arn, cleared)
WITH RECURSIVE seq(n) AS (SELECT 1 UNION ALL SELECT n + 1 FROM seq WHERE n < 2480),
active AS (SELECT card_id, brand, ROW_NUMBER() OVER (ORDER BY card_id) AS i, COUNT(*) OVER () AS c FROM cards WHERE status = 'active'),
base AS (
  SELECT n,
         (n - 1) / 80                                   AS d,
         21600 + ((n * 7841) % 61200)                   AS secs,
         (n * 7919 + 13) % 1000                         AS r,
         (n * 31 + 7) % 100                             AS s,
         CASE WHEN (n * 53) % 100 < 18 THEN 'M-001' WHEN (n * 53) % 100 < 30 THEN 'M-002'
              WHEN (n * 53) % 100 < 38 THEN 'M-003' WHEN (n * 53) % 100 < 46 THEN 'M-004'
              WHEN (n * 53) % 100 < 56 THEN 'M-005' WHEN (n * 53) % 100 < 62 THEN 'M-006'
              WHEN (n * 53) % 100 < 70 THEN 'M-007' WHEN (n * 53) % 100 < 80 THEN 'M-008'
              WHEN (n * 53) % 100 < 84 THEN 'M-009' WHEN (n * 53) % 100 < 93 THEN 'M-010'
              WHEN (n * 53) % 100 < 94 THEN 'M-011' ELSE 'M-012' END AS merchant_id,
         (n * 37) % (SELECT c FROM active LIMIT 1) + 1 AS ci
  FROM seq
),
enriched AS (
  SELECT b.*, a.card_id, a.brand AS scheme, m.channel, m.mcc,
         datetime('2026-10-01', '+' || b.d || ' days', '+' || b.secs || ' seconds') AS ts,
         CASE m.channel
           WHEN 'pos'  THEN CASE WHEN b.n % 10 < 6 THEN 'CONTACTLESS' WHEN b.n % 10 < 9 THEN 'CHIP' ELSE 'MAGSTRIPE' END
           WHEN 'atm'  THEN 'CHIP'
           ELSE CASE WHEN b.n % 50 = 0 THEN 'MANUAL' ELSE 'ECOM' END END AS entry_mode,
         CASE WHEN m.mcc IN ('4511','7011') THEN 9000 + (b.n * 3571) % 60000
              WHEN m.channel = 'atm'  THEN 2000 + ((b.n * 13) % 15) * 1000
              WHEN m.channel = 'ecom' THEN 1500 + (b.n * 104729) % 18000
              WHEN b.n % 10 < 6       THEN 300 + (b.n * 7919) % 4700
              ELSE 500 + (b.n * 7919) % 9000 END AS amount_minor
  FROM base b
  JOIN active a   ON a.i = b.ci
  JOIN merchants m ON m.merchant_id = b.merchant_id
),
decided AS (
  SELECT e.*,
         CASE WHEN e.d = 13 AND strftime('%H', e.ts) = '13' THEN 1                -- outage
              WHEN e.scheme = 'VISA' AND e.s < 1 THEN 1 ELSE 0 END AS outage_or_stip,
         CASE WHEN e.d >= 24 THEN 80 ELSE 50 END AS t51
  FROM enriched e
)
SELECT printf('A%06d', n), strftime('%Y-%m-%dT%H:%M:%SZ', ts), card_id, merchant_id, scheme, channel, entry_mode, amount_minor, 'EUR',
       CASE
         WHEN outage_or_stip = 1 AND scheme = 'CB'   THEN '91'
         WHEN outage_or_stip = 1 AND amount_minor > 10000 THEN '05'
         WHEN outage_or_stip = 1                     THEN '00'
         WHEN r < t51                                THEN '51'
         WHEN r < t51 + 30                           THEN '05'
         WHEN r < t51 + 42                           THEN '59'
         WHEN r < t51 + 50 AND channel = 'ecom'      THEN '54'   -- card-on-file with an old expiry
         ELSE '00' END,
       CASE WHEN outage_or_stip = 1 AND scheme = 'VISA' THEN 1 ELSE 0 END,
       NULL, 0
FROM decided;

-- ------------------------------------------------------------------ card-testing attack, 17 Oct 02:00-02:59, merchant M-011
INSERT INTO authorisations (auth_id, auth_ts, card_id, merchant_id, scheme, channel, entry_mode, amount_minor, currency, response_code, stip, arn, cleared)
WITH RECURSIVE k(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM k WHERE i < 40),
v AS (SELECT card_id, ROW_NUMBER() OVER (ORDER BY card_id) AS j FROM cards WHERE brand = 'VISA' AND status = 'active')
SELECT printf('X%04d', i),
       strftime('%Y-%m-%dT%H:%M:%SZ', datetime('2026-10-17T02:00:00', '+' || (i * 83 % 3600) || ' seconds')),
       v.card_id, 'M-011', 'VISA', 'ecom', 'ECOM', 2500 + (i * 613) % 2500, 'EUR',
       CASE WHEN i % 10 IN (0, 3, 6) THEN '00' ELSE '59' END, 0, NULL, 0
FROM k JOIN v ON v.j = (i % 10) + 1;

-- ------------------------------------------------------------------ hand-written lifecycle rows (blocks, fraud, expired card, old transaction)
INSERT INTO authorisations (auth_id, auth_ts, card_id, merchant_id, scheme, channel, entry_mode, amount_minor, currency, response_code, stip, arn, cleared) VALUES
 ('E001','2026-10-05T21:14:00Z','crd_hb_005','M-005','VISA','ecom','ECOM',     8990,'EUR','00',0,'74000002305000000001187',1),
 ('E002','2026-10-06T10:02:00Z','crd_hb_005','M-009','VISA','ecom','ECOM',    12990,'EUR','00',0,'74000002305000000004418',1),
 ('E003','2026-10-07T08:11:00Z','crd_hb_005','M-005','VISA','ecom','ECOM',     9990,'EUR','43',0,NULL,0),
 ('E004','2026-10-07T08:13:00Z','crd_hb_005','M-011','VISA','ecom','ECOM',     4990,'EUR','43',0,NULL,0),
 ('E005','2026-10-08T19:40:00Z','crd_hb_005','M-001','VISA','pos', 'MAGSTRIPE',2500,'EUR','43',0,NULL,0),
 ('E006','2026-10-21T12:05:00Z','crd_hb_004','M-008','VISA','pos', 'CHIP',     3400,'EUR','41',0,NULL,0),
 ('E007','2026-10-18T08:20:00Z','crd_hb_009','M-002','VISA','pos', 'CONTACTLESS',1850,'EUR','00',0,'74000002305000000007731',1),
 ('E008','2026-10-18T10:15:00Z','crd_hb_009','M-005','VISA','ecom','ECOM',     6490,'EUR','00',1,'74000002305000000007790',1),
 ('E009','2026-10-18T10:20:00Z','crd_hb_009','M-005','VISA','ecom','ECOM',     7990,'EUR','43',0,NULL,0),
 ('E010','2026-10-11T16:30:00Z','crd_bl_002','M-007','CB',  'ecom','ECOM',     5999,'EUR','00',0,'74000002305000000006102',1),
 ('E011','2026-10-12T09:00:00Z','crd_bl_002','M-007','CB',  'ecom','ECOM',     5999,'EUR','05',0,NULL,0),
 ('E012','2026-10-03T12:00:00Z','crd_hb_003','M-007','VISA','ecom','ECOM',     1299,'EUR','54',0,NULL,0),
 ('E013','2026-10-09T18:45:00Z','crd_hb_003','M-003','VISA','pos', 'CHIP',     6000,'EUR','54',0,NULL,0),
 ('E014','2026-06-15T15:00:00Z','crd_hb_001','M-012','VISA','ecom','ECOM',    24500,'EUR','00',0,'74000002305000000000615',1),
 ('E015','2026-10-02T11:00:00Z','crd_hb_001','M-005','VISA','ecom','ECOM',    15900,'EUR','00',0,'74000002305000000002011',1),
 ('E016','2026-10-02T11:00:40Z','crd_hb_001','M-005','VISA','ecom','ECOM',    15900,'EUR','00',0,'74000002305000000002012',1);

-- every approved generated / attack row gets an ARN and is cleared (except the last day, still pending)
UPDATE authorisations
SET arn = '7400000230599' || printf('%010d', rowid), cleared = CASE WHEN auth_ts >= '2026-10-31' THEN 0 ELSE 1 END
WHERE response_code = '00' AND arn IS NULL;

-- ------------------------------------------------------------------ fraud reports
INSERT INTO fraud_reports VALUES
 ('FR-2026-1182','E001','crd_hb_005','1','CASE-2026-0398','2026-10-08','2026-10-08T15:00:00Z', 8990,'EUR','accepted'),
 ('FR-2026-1183','E002','crd_hb_005','1','CASE-2026-0398','2026-10-08','2026-10-08T15:00:00Z',12990,'EUR','accepted'),
 ('FR-2026-1190','E008','crd_hb_009','1','CASE-2026-0421','2026-10-20','2026-10-20T10:30:00Z', 6490,'EUR','sent'),
 ('FR-2026-1191','E010','crd_bl_002','6','CASE-2026-0405','2026-10-14','2026-10-14T09:00:00Z', 5999,'EUR','accepted');

-- attack approvals: confirmed card-not-present fraud (type 6), all reported except X0036 (still in the case tool)
INSERT INTO fraud_reports
SELECT 'FR-2026-12' || substr(auth_id, 4, 2), auth_id, card_id, '6', 'CASE-2026-0430', '2026-10-19', '2026-10-19T16:00:00Z', amount_minor, 'EUR', 'sent'
FROM authorisations WHERE auth_id LIKE 'X%' AND response_code = '00' AND auth_id <> 'X0036';

-- ------------------------------------------------------------------ disputes
INSERT INTO disputes VALUES
 ('DSP-2026-0007','E001','10.4', 8990,'EUR','acquirer_responded','2026-10-12T08:00:00Z',NULL,'FR-2026-1182'),
 ('DSP-2026-0008','E002','10.4',12990,'EUR','won',               '2026-10-12T08:05:00Z','2026-10-29T10:00:00Z','FR-2026-1183'),
 ('DSP-2026-0012','E016','12.6',15900,'EUR','submitted',         '2026-10-09T09:30:00Z',NULL,NULL),           -- duplicate processing
 ('DSP-2026-0015','E010','10.4', 5999,'EUR','submitted',         '2026-10-16T10:00:00Z',NULL,'FR-2026-1191'), -- CB: impayé, reason code to confirm
 ('DSP-2026-0021','E014','13.1',24500,'EUR','submitted',         '2026-10-20T14:00:00Z',NULL,NULL),           -- 127 days after the transaction
 ('DSP-2026-0022','X0036','10.4', (SELECT amount_minor FROM authorisations WHERE auth_id='X0036'),'EUR','submitted','2026-10-21T09:00:00Z',NULL,NULL), -- no fraud report
 ('DSP-2026-0023','X0003','10.4', (SELECT amount_minor FROM authorisations WHERE auth_id='X0003'),'EUR','submitted','2026-10-21T09:00:00Z',NULL,'FR-2026-1203'),
 ('DSP-2026-0024','X0010','10.4', (SELECT amount_minor FROM authorisations WHERE auth_id='X0010'),'EUR','submitted','2026-10-21T09:00:00Z',NULL,'FR-2026-1210');

-- 13.1 merchandise not received on four ordinary e-commerce payments, 12.6 / 13.3 on two more
INSERT INTO disputes
SELECT 'DSP-2026-00' || (30 + ROW_NUMBER() OVER (ORDER BY auth_id)),
       auth_id,
       CASE WHEN ROW_NUMBER() OVER (ORDER BY auth_id) <= 4 THEN '13.1' WHEN ROW_NUMBER() OVER (ORDER BY auth_id) = 5 THEN '12.6' ELSE '13.3' END,
       amount_minor, 'EUR',
       CASE WHEN ROW_NUMBER() OVER (ORDER BY auth_id) % 3 = 0 THEN 'lost' ELSE 'submitted' END,
       strftime('%Y-%m-%dT%H:%M:%SZ', datetime(auth_ts, '+12 days')), NULL, NULL
FROM (SELECT auth_id, amount_minor, auth_ts FROM authorisations
      WHERE auth_id LIKE 'A%' AND response_code = '00' AND merchant_id IN ('M-005','M-009') AND auth_ts < '2026-10-20'
      ORDER BY auth_id LIMIT 6);

-- ==================================================================
-- SAMPLE ANALYST QUESTIONS (tested on this dataset with sqlite3 3.x)
-- ==================================================================

-- Q1 · Daily approval rate and stand-in share in October. Which day had a host problem?
--      Expected: 2026-10-14 tops stip_pct (3.8 %) and is the only day with 91 (3 CB declines).
SELECT substr(auth_ts, 1, 10)                                AS day,
       COUNT(*)                                              AS auths,
       ROUND(100.0 * SUM(response_code = '00') / COUNT(*), 1) AS approval_pct,
       ROUND(100.0 * SUM(stip) / COUNT(*), 1)                 AS stip_pct,
       SUM(response_code = '91')                              AS issuer_unavailable
FROM authorisations
WHERE auth_ts >= '2026-10-01' AND auth_ts < '2026-11-01'
GROUP BY day
ORDER BY day;

-- Q2 · Decline codes by channel, as a share of that channel's declines.
--      Expected: 51 leads in pos and atm (57 %); in ecom 59 suspected fraud reaches 27 %.
SELECT channel, response_code, COUNT(*) AS n,
       ROUND(100.0 * COUNT(*) / SUM(COUNT(*)) OVER (PARTITION BY channel), 1) AS share_of_channel_declines_pct
FROM authorisations
WHERE response_code <> '00' AND auth_ts >= '2026-10-01' AND auth_ts < '2026-11-01'
GROUP BY channel, response_code
ORDER BY channel, n DESC;

-- Q3 · Merchant-days where 59 (suspected fraud) is 20 %+ of authorisations (min 10 attempts).
--      Expected: one row, M-011 QuickGift Codes on 2026-10-17, 28 of 41 declined 59 (card testing).
WITH m AS (
  SELECT merchant_id, substr(auth_ts, 1, 10) AS day, COUNT(*) AS auths, SUM(response_code = '59') AS n59
  FROM authorisations GROUP BY merchant_id, day
)
SELECT m.day, m.merchant_id, me.name, m.auths, m.n59, ROUND(100.0 * m.n59 / m.auths, 1) AS fraud_decline_pct
FROM m JOIN merchants me USING (merchant_id)
WHERE m.auths >= 10 AND 1.0 * m.n59 / m.auths >= 0.2
ORDER BY fraud_decline_pct DESC;

-- Q4 · Disputes that break our procedure: 10.x without a matching fraud report, or opened after day 120.
--      Expected: DSP-2026-0021 (127 days) and DSP-2026-0022 (10.4, no fraud report).
SELECT d.dispute_id, d.condition_code, a.auth_ts, d.opened_at,
       CAST(julianday(substr(d.opened_at, 1, 10)) - julianday(substr(a.auth_ts, 1, 10)) AS INTEGER) AS days_after_txn,
       CASE WHEN d.condition_code LIKE '10.%' AND f.fraud_report_id IS NULL THEN 'fraud dispute without fraud report'
            WHEN d.condition_code LIKE '10.%' AND f.auth_id <> d.auth_id    THEN 'fraud report of another transaction'
            WHEN julianday(substr(d.opened_at, 1, 10)) - julianday(substr(a.auth_ts, 1, 10)) > 120 THEN 'opened after day 120'
       END AS issue
FROM disputes d
JOIN authorisations a ON a.auth_id = d.auth_id
LEFT JOIN fraud_reports f ON f.fraud_report_id = d.fraud_report_id
WHERE issue IS NOT NULL;

-- Q5 · Approvals after a card was blocked, with the Exception File listing delay.
--      Expected: crd_hb_009, E008 approved in stand-in at 10:15, listing took 160 min (target 5 min).
SELECT c.card_id, c.block_reason, c.blocked_at, c.exception_file_listed_at,
       CAST(ROUND((julianday(c.exception_file_listed_at) - julianday(c.blocked_at)) * 1440) AS INTEGER) AS listing_delay_min,
       a.auth_id, a.auth_ts, a.stip, a.amount_minor
FROM cards c
JOIN authorisations a ON a.card_id = c.card_id AND a.auth_ts > c.blocked_at
WHERE c.status = 'blocked' AND a.response_code = '00';
