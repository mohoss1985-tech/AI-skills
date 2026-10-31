{"client": "Hexa card scheme (sample)", "skill": "mapping-data", "title": "Data mapping: acquirer clearing file to the clearing API"}
===INPUT===
Acquirers move from the legacy fixed-width clearing file to our new clearing API (JSON). During migration we load both into staging and convert the legacy records. Need the mapping legacy → API, the data quality rules, and the checks, including matching clearing records to authorisations. 9 acquirers, ~14M clearing records a day at peak.

Legacy record (staging table acq_legacy_record): arn_23, member_id, merch_no, mcc, card_token (tokenised at file intake, never the PAN), amount_12 (12 digits, implied 2 decimals), curr_num (978…), txn_yymmdd, auth_cd, trx_type (05 purchase, 06 refund, 07 cash), pos_entry (05 chip, 07 contactless, 81 e-commerce, 90 magstripe, 01 manual), ctry_num (250…), eci_ind.
API record (table clr_api_record): arn, acquirer_id (6), merchant_id, mcc, pan_token, amount_minor, currency (alpha), transaction_date, auth_code, transaction_type (PURCHASE/REFUND/CASH), entry_mode (CHIP/CONTACTLESS/ECOM/MAGSTRIPE/MANUAL), merchant_country (alpha-2), eci, source_format.
Matching rule: token + auth code, authorisation approved, within 30 days, cleared amount ≤ authorised amount (+20% for restaurants, MCC 5812/5814).
===OUTPUT===
## Data mapping · Legacy clearing file → clearing API

### 1 · Scope
| | |
|---|---|
| **Source** | Acquirer legacy fixed-width clearing file, loaded to staging `acq_legacy_record` |
| **Target** | Clearing API record `clr_api_record` (JSON payload, stored in staging for comparison) |
| **Volume** | ~14M records a day at peak, 9 acquirers |
| **Flow** | Daily batch during migration; acquirers then call the API directly |
| **Key** | `arn_23` → `arn` (Acquirer Reference Number, 23 digits) |

### 2 · Data dictionary (target)
| Field | Business definition | Type | Mandatory | Values / format | Sensitivity |
|---|---|---|---|---|---|
| arn | Acquirer Reference Number: unique id of the transaction, used in disputes | varchar(23) | Y | 23 digits | Internal |
| acquirer_id | Scheme member id of the acquirer | varchar(6) | Y | 6 digits | Internal |
| merchant_id | Merchant id at the acquirer | varchar(15) | Y | — | Internal |
| mcc | Merchant category code | varchar(4) | Y | In the MCC referential | Internal |
| pan_token | Token of the card number | varchar(19) | Y | Token, **never a PAN** | Payment data |
| amount_minor | Transaction amount in minor units (cents) | bigint | Y | > 0 | Internal |
| currency | Transaction currency | varchar(3) | Y | EUR · USD · GBP · CHF | Internal |
| transaction_date | Date of the sale | date | Y | ≤ clearing date | Internal |
| auth_code | Approval code given by the issuer or stand-in | varchar(6) | Y | 6 characters | Internal |
| transaction_type | Kind of transaction | varchar(10) | Y | PURCHASE · REFUND · CASH | Internal |
| entry_mode | How the card was read | varchar(12) | N | CHIP · CONTACTLESS · ECOM · MAGSTRIPE · MANUAL | Internal |
| merchant_country | Country of the merchant | varchar(2) | Y | ISO 3166 alpha-2 | Internal |
| eci | E-commerce indicator (3-D Secure result) | varchar(2) | N | Present for ECOM | Internal |
| source_format | Where the record came from | varchar(10) | Y | LEGACY · API | Technical |

### 3 · Source → target mapping
clearing-mapping.csv
```csv
target_table,target_field,type,mandatory,source_table,source_field,transformation,default,rule,allowed
clr_api_record,arn,varchar(23),Y,acq_legacy_record,arn_23,TRIM(src.arn_23),,DQ-01,
clr_api_record,acquirer_id,varchar(6),Y,acq_legacy_record,member_id,"LPAD(TRIM(src.member_id), 6, '0')",,DQ-02,
clr_api_record,merchant_id,varchar(15),Y,acq_legacy_record,merch_no,TRIM(src.merch_no),,DQ-02,
clr_api_record,mcc,varchar(4),Y,acq_legacy_record,mcc,src.mcc,,DQ-03,
clr_api_record,pan_token,varchar(19),Y,acq_legacy_record,card_token,src.card_token (never the PAN),,DQ-04,
clr_api_record,amount_minor,bigint,Y,acq_legacy_record,amount_12,"CAST(src.amount_12 AS BIGINT) -- implied 2 decimals",,DQ-05,
clr_api_record,currency,varchar(3),Y,acq_legacy_record,curr_num,translation table T-01 (ISO 4217 numeric to alpha),,DQ-06,EUR|USD|GBP|CHF
clr_api_record,transaction_date,date,Y,acq_legacy_record,txn_yymmdd,"TO_DATE(src.txn_yymmdd, 'YYMMDD')",,DQ-07,
clr_api_record,auth_code,varchar(6),Y,acq_legacy_record,auth_cd,UPPER(TRIM(src.auth_cd)),,DQ-10,
clr_api_record,transaction_type,varchar(10),Y,acq_legacy_record,trx_type,translation table T-02,,DQ-08,PURCHASE|REFUND|CASH
clr_api_record,entry_mode,varchar(12),N,acq_legacy_record,pos_entry,translation table T-03,,DQ-08,CHIP|CONTACTLESS|ECOM|MAGSTRIPE|MANUAL
clr_api_record,merchant_country,varchar(2),Y,acq_legacy_record,ctry_num,translation table T-01 (ISO 3166 numeric to alpha-2),,DQ-06,
clr_api_record,eci,varchar(2),N,acq_legacy_record,eci_ind,TRIM(src.eci_ind),,DQ-09,
clr_api_record,source_format,varchar(10),Y,,,,LEGACY,,
```

### 4 · Value translation tables
**T-01 · Codes** (numeric → alpha): currency `978` → EUR, `840` → USD, `826` → GBP, `756` → CHF; country `250` → FR, `276` → DE, `380` → IT… (full ISO tables). Unknown code → record rejected (DQ-06).

**T-02 · Transaction type**
| Legacy | API |
|---|---|
| 05 | PURCHASE |
| 06 | REFUND |
| 07 | CASH |
| other | rejected |

**T-03 · Entry mode**
| Legacy | API |
|---|---|
| 05 | CHIP |
| 07 | CONTACTLESS |
| 81 | ECOM |
| 90 | MAGSTRIPE |
| 01 | MANUAL |
| other | rejected |

### 5 · Data quality rules
| ID | Dimension | Rule | Threshold | On failure | Owner |
|---|---|---|---|---|---|
| DQ-01 | Uniqueness | One clearing record per ARN | 100% | Reject the duplicate to the acquirer | Clearing operations |
| DQ-02 | Validity | Acquirer and merchant ids exist in the member referential | 100% | Reject | Member referential |
| DQ-03 | Validity | MCC exists in the MCC referential | 100% | Reject | Clearing operations |
| DQ-04 | Validity | **No clear PAN** in any field (search for Luhn-valid 16-digit strings) | 100% | Reject the file, alert security | Security |
| DQ-05 | Validity | Amount is a positive integer in minor units | 100% | Reject | Clearing operations |
| DQ-06 | Validity | Currency and country translate with T-01 | 100% | Reject | Clearing operations |
| DQ-07 | Timeliness | Transaction date ≤ 30 days before clearing, not in the future | 99.5% | Accept, flag late presentment | Clearing operations |
| DQ-08 | Validity | Type and entry mode translate with T-02 / T-03 | 100% | Reject | Clearing operations |
| DQ-09 | Consistency | ECI present when entry mode is ECOM | 98% | Accept, flag | LCLF (fraud) |
| DQ-10 | Consistency | Each purchase matches one approved authorisation | 99% | Accept, report unmatched | Clearing operations |

**Mapping check** (`check_mapping.py clearing-mapping.csv --key arn --rules dq-rules.csv`):
- ❌ `auth_code` referred to **DQ-11**, which doesn't exist: corrected to **DQ-10** (matching) above.
- ⚠️ 11 mandatory fields have no default, so records with an empty source are **rejected**. That's intended for a clearing record: a partial record can't be billed. Rejections go back to the acquirer in the daily reject report.

### 6 · Reconciliation & checks
checks.sql
```sql
-- Row counts (the difference must equal the reject report)
SELECT (SELECT COUNT(*) FROM acq_legacy_record) AS source_rows, (SELECT COUNT(*) FROM clr_api_record) AS target_rows;

-- Key reconciliation on ARN (generated; the key is trimmed, so trim the source too)
SELECT 'missing in target' AS check_name, COUNT(*) AS failing FROM acq_legacy_record s
  WHERE NOT EXISTS (SELECT 1 FROM clr_api_record t WHERE t.arn = TRIM(s.arn_23))
UNION ALL
SELECT 'duplicate key in target', COUNT(*) - COUNT(DISTINCT arn) FROM clr_api_record;

-- Data quality checks (4 of the 27 generated)
SELECT check_name, rule, failing FROM (
  SELECT 'auth_code mandatory' AS check_name, 'DQ-10' AS rule, SUM(CASE WHEN auth_code IS NULL OR TRIM(CAST(auth_code AS VARCHAR(4000))) = '' THEN 1 ELSE 0 END) AS failing FROM clr_api_record
UNION ALL
  SELECT 'currency not in allowed values', 'DQ-06', SUM(CASE WHEN currency IS NOT NULL AND currency NOT IN ('EUR', 'USD', 'GBP', 'CHF') THEN 1 ELSE 0 END) FROM clr_api_record
UNION ALL
  SELECT 'transaction_type not in allowed values', 'DQ-08', SUM(CASE WHEN transaction_type IS NOT NULL AND transaction_type NOT IN ('PURCHASE', 'REFUND', 'CASH') THEN 1 ELSE 0 END) FROM clr_api_record
UNION ALL
  SELECT 'entry_mode not in allowed values', 'DQ-08', SUM(CASE WHEN entry_mode IS NOT NULL AND entry_mode NOT IN ('CHIP', 'CONTACTLESS', 'ECOM', 'MAGSTRIPE', 'MANUAL') THEN 1 ELSE 0 END) FROM clr_api_record
) c ORDER BY failing DESC;

-- DQ-10 · Purchases with no matching approved authorisation (written by hand, PostgreSQL)
SELECT c.acquirer_id, c.arn, c.amount_minor, c.mcc
FROM clr_api_record c
LEFT JOIN authorisation a
  ON a.pan_token = c.pan_token
 AND a.auth_code = c.auth_code
 AND a.approved
 AND a.auth_date BETWEEN c.transaction_date - 30 AND c.transaction_date
 AND c.amount_minor <= a.amount_minor * CASE WHEN c.mcc IN ('5812', '5814') THEN 1.20 ELSE 1.00 END
WHERE c.transaction_type = 'PURCHASE'
  AND a.auth_id IS NULL;
```

The matching query was checked on test data: a restaurant clearing 20% above its authorisation matches; the same amount at a supermarket doesn't; a clearing on a declined authorisation doesn't; refunds are ignored.

### 7 · Migration test approach
1. **Parallel run per acquirer:** for 2 weeks, the acquirer sends both the legacy file and API calls; we convert the legacy file and compare it field by field with the API records (same ARN). Target: 100% identical on mandatory fields.
2. **Daily checks** above, plus the DQ-10 matching rate per acquirer (target ≥ 99%).
3. **Totals:** sum of `amount_minor` per acquirer, currency and day = total of the legacy file trailer record.
4. **Switch acquirer by acquirer**, starting with the smallest; the legacy file stays accepted for 30 days as fallback.

### 8 · Open points
| Question | Owner |
|---|---|
| One authorisation for several clearing records (split shipments): allowed, and up to which total? | Clearing rules |
| Matching tolerance for other MCCs (hotels, car rental) | Clearing rules |
| Are refunds matched to the original purchase (by ARN)? | Clearing operations |
| Retention of the staging tables after migration | DPO |
