---
name: mapping-data
description: Produces data mapping and data quality deliverables for interfaces, data flows and migrations - data dictionary, source-to-target mapping with transformation rules and code-value translations, data quality rules by dimension (completeness, validity, uniqueness, consistency, timeliness), reconciliation and quality-check SQL, and a migration test approach. Includes a script that validates a mapping file and generates the reconciliation and data quality SQL. Use when someone mentions data mapping, a mapping file, an interface or flux between applications, a data migration or reprise de données, a data dictionary, data quality rules, reconciliation, or lineage.
---

# Data mapping & quality

You act as a data-minded BA on an integration or migration. The mapping is a contract between the business, the source team and the target team. It must say, for **every target field**, where the value comes from, how it is transformed, and what happens when it is missing or wrong.

## 1. Clarify

Ask only for what's missing: source and target systems, the objects (clearing record, authorisation, merchant, customer…), volumes, the type of flow (one-off migration, batch, real time / API, events), frequency, and the key that identifies a record on both sides.

## 2. Data dictionary

For each object on the target side: **Field · Business definition · Type & length · Mandatory · Allowed values / format · Owner · Sensitivity** (personal, banking secrecy, none). Definitions are in business words ("date the customer signed the account agreement"), not technical ones.

## 3. Source → target mapping

One row per target field: **Target field · Source field(s) · Transformation · Default if missing · Rule ID · Comment**. Write transformations precisely: `UPPER(TRIM(src.last_name))`, `concat(street_1, ' ', street_2)`, "value translation table T-02". Code-value translations get their own table (*source code → target code*), and every source code must be listed, including the unknown ones.

Save the mapping as a CSV (one row per target field) so the script can check it:

```csv
target_table,target_field,type,mandatory,source_table,source_field,transformation,default,rule
clr_api_record,auth_code,varchar(6),Y,acq_legacy_record,auth_cd,UPPER(TRIM(src.auth_cd)),,DQ-10
```

## 4. Data quality rules

`DQ-01`… one rule each, with its **dimension** (completeness, validity, uniqueness, consistency, timeliness, accuracy), a threshold, what happens to failing records (reject, default, fix at source, accept with flag) and who fixes them.

## 5. Check and generate the SQL with the script

```bash
python3 scripts/check_mapping.py mapping.csv --key arn --dialect postgres > checks.sql
```

It reports mapping defects (target field without source or default, mandatory field with a possibly empty source, duplicate targets, unknown rule IDs) and writes: row-count reconciliation per table, key reconciliation (missing / extra records), mandatory-field completeness checks, and value-format checks for the typed fields. Review the SQL before running it; adapt table names to the environments.

## 6. Migration test approach

Dry runs (at least 2) on a copy of production data, reconciliation after each run (counts, keys, amounts and balances for financial objects), sampling of records checked by business users, rejection report, cut-over steps and rollback.

## 7. Guardrails

- Never put real customer data in the mapping examples: use invented values.
- Personal data: state the legal reason to migrate it and the retention; flag fields that should not move at all (minimisation).

## 8. Output contract

1. Scope: systems, objects, volumes, flow type, key · 2. Data dictionary · 3. Mapping table (+ CSV) · 4. Value translation tables · 5. Data quality rules · 6. Reconciliation & checks SQL (from the script) · 7. Migration test approach · 8. Open points

## 9. Quality check

- Every mandatory target field has a source or a default. Every code value is translated. Every DQ rule has a threshold and an owner.
- Hand-off: SQL questions → `generating-sql`; API fields → `testing-apis`; rules in the spec → `writing-functional-specs`; migration test campaign → `running-uat`.
