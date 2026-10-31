{"client": "Harbor Bank (sample)", "skill": "mapping-data", "lang": "en", "title": "Data mapping: fraud cases to Visa fraud reports"}
===INPUT===
Fraud ops confirm fraud in their case tool; today they re-key it into the processor portal to report it to Visa. We want a daily file generated from the case tool. Need the mapping, data quality rules and checks.

Case tool tables: fraud_case (case_no, card_token, fraud_reason 'LOST','STOLEN','NOT_RECEIVED','APPLICATION','COUNTERFEIT','CNP','OTHER', confirmed_at), fraud_case_txn (case_no, arn, txn_date, amount decimal, currency, pos_entry '05','07','81','90','01').
Target record: fraud_report (transaction_id = ARN, pan_token, fraud_type, transaction_date, fraud_reported_date, amount_minor, currency, entry_mode, case_id). About 900 reports a month.
===OUTPUT===
## Data mapping · Fraud cases → Visa fraud reports

### 1 · Scope
| | |
|---|---|
| **Source** | Fraud case tool: `fraud_case`, `fraud_case_txn` |
| **Target** | Daily fraud report file to the processor, record `fraud_report` |
| **Volume** | ~900 reports a month |
| **Key** | `fraud_case_txn.arn` → `fraud_report.transaction_id` (one report per transaction) |

### 2 · Source → target mapping
fraud-report-mapping.csv
```csv
target_table,target_field,type,mandatory,source_table,source_field,transformation,default,rule,allowed
fraud_report,transaction_id,varchar(23),Y,fraud_case_txn,arn,TRIM(src.arn),,DQ-01,
fraud_report,pan_token,varchar(19),Y,fraud_case,card_token,src.card_token (never the PAN),,DQ-02,
fraud_report,fraud_type,varchar(2),Y,fraud_case,fraud_reason,translation table T-01,,DQ-03,0|1|2|3|4|5|6
fraud_report,transaction_date,date,Y,fraud_case_txn,txn_date,src.txn_date,,DQ-04,
fraud_report,fraud_reported_date,date,Y,fraud_case,confirmed_at,CAST(src.confirmed_at AS DATE),,DQ-04,
fraud_report,amount_minor,bigint,Y,fraud_case_txn,amount,"ROUND(src.amount * 100)",,DQ-05,
fraud_report,currency,varchar(3),Y,fraud_case_txn,currency,UPPER(src.currency),,DQ-05,EUR|USD|GBP
fraud_report,entry_mode,varchar(12),N,fraud_case_txn,pos_entry,translation table T-02,,DQ-03,CHIP|CONTACTLESS|ECOM|MAGSTRIPE|MANUAL
fraud_report,case_id,varchar(12),Y,fraud_case,case_no,src.case_no,,DQ-01,
```

### 3 · Value translation tables
**T-01 · Fraud type** (`fraud_reason` → `fraud_type`)
| Case tool | Visa fraud type |
|---|---|
| LOST | 0 · Lost |
| STOLEN | 1 · Stolen |
| NOT_RECEIVED | 2 · Card not received as issued |
| APPLICATION | 3 · Fraudulent application |
| COUNTERFEIT | 4 · Counterfeit |
| OTHER | 5 · Miscellaneous |
| CNP | 6 · Fraudulent use of account number (card not present) |

*Codes to confirm against the current Visa fraud reporting specification before go-live.*

**T-02 · Entry mode** (`pos_entry` → `entry_mode`): 05 → CHIP · 07 → CONTACTLESS · 81 → ECOM · 90 → MAGSTRIPE · 01 → MANUAL; other → held for the analyst.

### 4 · Data quality rules
| ID | Dimension | Rule | Threshold | On failure | Owner |
|---|---|---|---|---|---|
| DQ-01 | Uniqueness | One fraud report per transaction | 100% | Don't send the duplicate | Fraud ops |
| DQ-02 | Validity | **No clear PAN** in any field (search for Luhn-valid 16-digit strings) | 100% | Block the file, alert security | Security |
| DQ-03 | Validity | Fraud type and entry mode translate with T-01 / T-02 | 100% | Hold for the analyst | Fraud ops |
| DQ-04 | Consistency | Fraud reported date ≥ transaction date | 100% | Hold for the analyst | Fraud ops |
| DQ-05 | Validity | Positive amount, ISO currency | 100% | Hold | Fraud ops |
| DQ-06 | Timeliness | Reported within the Visa deadline after confirmation *(deadline to confirm)* | 99% | Escalate | Fraud ops |

**Mapping check** (`check_mapping.py fraud-report-mapping.csv --key transaction_id --rules dq-rules.csv`): 0 errors; 8 warnings because mandatory fields have no default. That's intended: an incomplete fraud report is held, not sent with invented values.

### 5 · Checks before sending the file
checks.sql
```sql
-- Duplicates (DQ-01): must return 0 (generated)
SELECT COUNT(*) - COUNT(DISTINCT transaction_id) AS duplicate_reports FROM fraud_report;

-- Fraud type outside T-01 (DQ-03, generated)
SELECT COUNT(*) AS failing FROM fraud_report
WHERE fraud_type IS NOT NULL AND fraud_type NOT IN ('0','1','2','3','4','5','6');

-- Reported before the transaction (DQ-04, written by hand)
SELECT transaction_id, transaction_date, fraud_reported_date
FROM fraud_report
WHERE fraud_reported_date < transaction_date;

-- Possible clear PAN (DQ-02, written by hand): 16 digits in a field that should hold a token
SELECT case_id FROM fraud_report WHERE pan_token ~ '^[0-9]{16}$';
```

The duplicate check catches the defect seen in UAT (CARD-310: fraud declaration sent twice).

### 6 · Test approach
1. Generate the file from 1 month of confirmed cases and compare with what fraud ops re-keyed in the portal (same ARNs, same fraud types).
2. Send to the processor's test environment; every rejection goes back to the mapping.
3. Run in parallel with re-keying for 2 weeks, then stop re-keying.

### 7 · Open points
| Question | Owner |
|---|---|
| Visa fraud type codes and reporting deadline (current spec) | Fraud ops |
| Reports for pending authorisations: wait for clearing? (SFD RG-05) | Fraud ops |
| Corrections: how is a wrong fraud type amended? | Processor |
