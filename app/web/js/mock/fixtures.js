// Fixtures of the fictional Harbor Bank (Visa, EN) and Banque Lumière (CB, FR) mock card API. Owner C.
// Single source of truth for the in-page mock (bank.js) AND the local server mock (app/server/tools/mock_bank.py
// reads this file: everything after "export default" must stay strict JSON - no comments, no trailing commas).
// Specs: research/demo-api/harbor-bank-openapi.yaml + tokens-and-disputes-openapi.yaml.
// PANs: Luhn-valid numbers in the 400000 test prefix, corrected per research/09 decision 12 (the YAML's
// 4000000000001014... fail Luhn). The mock refuses any PAN that is not listed here (rule A1).
export default {
  "today": "2026-11-08",
  "legacy_pans": {
    "4000000000001014": "4000000000001018", "4000000000001023": "4000000000001026",
    "4000000000001032": "4000000000001034", "4000000000001041": "4000000000001042",
    "4000000000001050": "4000000000001059", "4000000000001069": "4000000000001067",
    "4000000000001078": "4000000000001075", "4000000000001087": "4000000000001083",
    "4000000000002013": "4000000000002016", "4000000000002022": "4000000000002024",
    "4000000000002031": "4000000000002032"
  },
  "brands": {
    "harbor": {
      "issuer": "Harbor Bank", "brand": "VISA", "lang": "en", "problem_base": "https://harbor.example/problems/",
      "keys": { "hb_test_demo_key": "all", "hb_test_readonly": "read" },
      "token_prefix": "TRF-HB-", "par_offset": 0, "arn_prefix": "74000002305",
      "cards": [
        { "card_id": "crd_hb_001", "pan": "4000000000001018", "expiry": "2029-04", "product": "debit", "status": "active", "available_minor": 250000, "currency": "EUR",
          "wallet_tokens": [ { "token_id": "tok_hb_001_a", "wallet": "mobile", "status": "active" } ], "expect": "00" },
        { "card_id": "crd_hb_002", "pan": "4000000000001026", "expiry": "2028-06", "product": "debit", "status": "active", "available_minor": 1500, "currency": "EUR", "wallet_tokens": [], "expect": "51" },
        { "card_id": "crd_hb_003", "pan": "4000000000001034", "expiry": "2026-09", "product": "credit", "status": "expired", "available_minor": 40000, "currency": "EUR", "wallet_tokens": [], "expect": "54" },
        { "card_id": "crd_hb_004", "pan": "4000000000001042", "expiry": "2028-11", "product": "debit", "status": "blocked", "available_minor": 92000, "currency": "EUR",
          "block": { "reason": "lost", "blocked_at": "2026-11-02T09:14:00Z", "channel": "app", "exception_file": "listed", "unblock_allowed_until": "2026-11-03T09:14:00Z" },
          "wallet_tokens": [ { "token_id": "tok_hb_004_a", "wallet": "mobile", "status": "suspended" } ], "expect": "41" },
        { "card_id": "crd_hb_005", "pan": "4000000000001059", "expiry": "2029-01", "product": "credit", "status": "blocked", "available_minor": 300000, "currency": "EUR",
          "block": { "reason": "stolen", "blocked_at": "2026-10-31T08:05:00Z", "channel": "call_centre", "exception_file": "listed", "unblock_allowed_until": null },
          "wallet_tokens": [ { "token_id": "tok_hb_005_a", "wallet": "mobile", "status": "suspended" } ], "expect": "43" },
        { "card_id": "crd_hb_006", "pan": "4000000000001067", "expiry": "2029-02", "product": "credit", "status": "active", "available_minor": 300000, "currency": "EUR", "fraud_watch": true, "wallet_tokens": [], "expect": "59 on ecom, 00 on pos" },
        { "card_id": "crd_hb_007", "pan": "4000000000001075", "expiry": "2029-03", "product": "debit", "status": "active", "available_minor": 120000, "currency": "EUR", "issuer_host": "down", "stand_in": true, "stip_limit_minor": 10000, "wallet_tokens": [], "expect": "00 in stand-in up to 100 EUR, 05 above" },
        { "card_id": "crd_hb_008", "pan": "4000000000001083", "expiry": "2029-05", "product": "debit", "status": "active", "available_minor": 80000, "currency": "EUR",
          "wallet_tokens": [ { "token_id": "tok_hb_008_a", "wallet": "mobile", "status": "active" } ], "expect": "00 (spare card for block / unblock tests)" }
      ],
      "transactions": [
        { "transaction_id": "74000002305000000001187", "card_id": "crd_hb_005", "date": "2026-10-05", "amount_minor": 8990, "currency": "EUR", "channel": "ecom", "approved": true, "merchant": "M-011 QuickGift Codes (demo)" },
        { "transaction_id": "74000002305000000002265", "card_id": "crd_hb_001", "date": "2026-07-11", "amount_minor": 5400, "currency": "EUR", "channel": "ecom", "approved": true, "merchant": "M-007 Atlas Home (demo)", "note": "day 120 on 2026-11-08" },
        { "transaction_id": "74000002305000000003349", "card_id": "crd_hb_001", "date": "2026-07-10", "amount_minor": 3200, "currency": "EUR", "channel": "pos", "approved": true, "merchant": "M-003 Harbour Books (demo)", "note": "day 121" },
        { "transaction_id": "74000002305000000004418", "card_id": "crd_hb_005", "date": "2026-10-06", "amount_minor": 12990, "currency": "EUR", "channel": "ecom", "approved": true, "merchant": "M-011 QuickGift Codes (demo)" },
        { "transaction_id": "74000002305000000005502", "card_id": "crd_hb_002", "date": "2026-10-20", "amount_minor": 8000, "currency": "EUR", "channel": "pos", "approved": false, "response_code": "51", "merchant": "M-001 Bay Coffee (demo)" }
      ],
      "fraud_reports": [
        { "fraud_report_id": "FR-2026-1182", "transaction_id": "74000002305000000001187", "card_id": "crd_hb_005", "fraud_type": "6", "case_id": "CASE-2026-0398", "status": "accepted", "amount_minor": 8990, "currency": "EUR", "reported_at": "2026-10-11T09:00:00Z" },
        { "fraud_report_id": "FR-2026-1301", "payment_id": "pay_0004", "card_id": "crd_hb_005", "fraud_type": "6", "case_id": "CASE-2026-0420", "status": "sent", "amount_minor": 34900, "currency": "EUR", "reported_at": "2026-11-03T15:30:00Z" }
      ],
      "disputes": [
        { "dispute_id": "DSP-2026-0007", "transaction_id": "74000002305000000001187", "condition_code": "10.4", "amount_minor": 8990, "currency": "EUR", "status": "acquirer_responded", "fraud_report_id": "FR-2026-1182",
          "opened_at": "2026-10-12T08:00:00Z", "respond_by": "2026-11-11", "history": [ { "at": "2026-10-12T08:00:00Z", "status": "submitted" }, { "at": "2026-10-30T14:12:00Z", "status": "acquirer_responded" } ] }
      ],
      "payments": [
        { "payment_id": "pay_0001", "card_id": "crd_hb_001", "amount_minor": 12000, "currency": "EUR", "status": "captured", "authorised_at": "2026-11-01T10:00:00Z", "captured_at": "2026-11-02T02:00:00Z", "three_ds": "authenticated", "channel": "ecom", "merchant": "M-004 Northwind Shoes (demo)" },
        { "payment_id": "pay_0002", "card_id": "crd_hb_001", "amount_minor": 8900, "currency": "EUR", "status": "captured", "authorised_at": "2026-10-11T18:20:00Z", "captured_at": "2026-10-12T02:00:00Z", "three_ds": "none", "channel": "ecom", "merchant": "M-007 Atlas Home (demo)", "expected_delivery_date": "2026-10-20" },
        { "payment_id": "pay_0003", "card_id": "crd_hb_008", "amount_minor": 6500, "currency": "EUR", "status": "authorised", "authorised_at": "2026-11-07T21:05:00Z", "captured_at": null, "three_ds": "none", "channel": "pos", "merchant": "M-002 Harbour Hotel (demo)" },
        { "payment_id": "pay_0004", "card_id": "crd_hb_005", "amount_minor": 34900, "currency": "EUR", "status": "captured", "authorised_at": "2026-10-30T13:02:00Z", "captured_at": "2026-10-30T23:00:00Z", "three_ds": "none", "channel": "ecom", "merchant": "M-011 QuickGift Codes (demo)", "note": "after the theft; fraud report FR-2026-1301" },
        { "payment_id": "pay_0005", "card_id": "crd_hb_005", "amount_minor": 21900, "currency": "EUR", "status": "captured", "authorised_at": "2026-10-30T13:09:00Z", "captured_at": "2026-10-30T23:00:00Z", "three_ds": "authenticated", "channel": "ecom", "merchant": "M-011 QuickGift Codes (demo)" }
      ]
    },
    "lumiere": {
      "issuer": "Banque Lumière", "brand": "CB", "lang": "fr", "problem_base": "https://lumiere.example/problems/",
      "keys": { "bl_test_demo_key": "all", "bl_test_readonly": "read" },
      "token_prefix": "TRF-BL-", "par_offset": 100, "arn_prefix": "74000002306",
      "cards": [
        { "card_id": "crd_bl_001", "pan": "4000000000002016", "expiry": "2029-04", "product": "debit", "status": "active", "available_minor": 180000, "currency": "EUR",
          "wallet_tokens": [ { "token_id": "tok_bl_001_a", "wallet": "mobile", "status": "active" } ], "expect": "00" },
        { "card_id": "crd_bl_002", "pan": "4000000000002024", "expiry": "2028-12", "product": "debit", "status": "blocked", "available_minor": 60000, "currency": "EUR",
          "block": { "reason": "used_without_permission", "blocked_at": "2026-11-03T11:20:00Z", "channel": "app", "exception_file": "listed", "unblock_allowed_until": null }, "wallet_tokens": [], "expect": "05" },
        { "card_id": "crd_bl_003", "pan": "4000000000002032", "expiry": "2029-06", "product": "debit", "status": "active", "available_minor": 90000, "currency": "EUR", "issuer_host": "down", "stand_in": false, "wallet_tokens": [], "expect": "91" },
        { "card_id": "crd_bl_004", "pan": "4000000000002040", "expiry": "2028-11", "product": "debit", "status": "blocked", "available_minor": 92000, "currency": "EUR",
          "block": { "reason": "lost", "blocked_at": "2026-11-02T09:14:00Z", "channel": "app", "exception_file": "listed", "unblock_allowed_until": "2026-11-03T09:14:00Z" }, "wallet_tokens": [], "expect": "41" },
        { "card_id": "crd_bl_005", "pan": "4000000000002057", "expiry": "2029-01", "product": "credit", "status": "blocked", "available_minor": 300000, "currency": "EUR",
          "block": { "reason": "stolen", "blocked_at": "2026-11-02T07:30:00Z", "channel": "app", "exception_file": "listed", "unblock_allowed_until": null },
          "wallet_tokens": [ { "token_id": "tok_bl_005_a", "wallet": "mobile", "status": "suspended" } ], "expect": "43" },
        { "card_id": "crd_bl_006", "pan": "4000000000002065", "expiry": "2028-06", "product": "debit", "status": "active", "available_minor": 1500, "currency": "EUR", "wallet_tokens": [], "expect": "51" },
        { "card_id": "crd_bl_007", "pan": "4000000000002073", "expiry": "2026-09", "product": "debit", "status": "expired", "available_minor": 40000, "currency": "EUR", "wallet_tokens": [], "expect": "54" },
        { "card_id": "crd_bl_008", "pan": "4000000000002081", "expiry": "2029-05", "product": "debit", "status": "active", "available_minor": 80000, "currency": "EUR",
          "wallet_tokens": [ { "token_id": "tok_bl_008_a", "wallet": "mobile", "status": "active" } ], "expect": "00 (carte de réserve pour les tests d'opposition)" },
        { "card_id": "crd_bl_009", "pan": "4000000000002099", "expiry": "2029-02", "product": "credit", "status": "active", "available_minor": 300000, "currency": "EUR", "fraud_watch": true, "wallet_tokens": [], "expect": "59 en ligne, 00 en proximité" }
      ],
      "transactions": [
        { "transaction_id": "74000002306000000001187", "card_id": "crd_bl_005", "date": "2026-10-05", "amount_minor": 8990, "currency": "EUR", "channel": "ecom", "approved": true, "merchant": "M-111 CadeauxExpress (démo)" },
        { "transaction_id": "74000002306000000002265", "card_id": "crd_bl_001", "date": "2026-07-11", "amount_minor": 5400, "currency": "EUR", "channel": "ecom", "approved": true, "merchant": "M-107 Maison Atlas (démo)", "note": "jour 120 le 2026-11-08" },
        { "transaction_id": "74000002306000000003349", "card_id": "crd_bl_001", "date": "2026-07-10", "amount_minor": 3200, "currency": "EUR", "channel": "pos", "approved": true, "merchant": "M-103 Librairie du Port (démo)", "note": "jour 121" },
        { "transaction_id": "74000002306000000004418", "card_id": "crd_bl_005", "date": "2026-10-06", "amount_minor": 12990, "currency": "EUR", "channel": "ecom", "approved": true, "merchant": "M-111 CadeauxExpress (démo)" },
        { "transaction_id": "74000002306000000005502", "card_id": "crd_bl_006", "date": "2026-10-20", "amount_minor": 8000, "currency": "EUR", "channel": "pos", "approved": false, "response_code": "51", "merchant": "M-101 Boulangerie Lumière (démo)" }
      ],
      "fraud_reports": [
        { "fraud_report_id": "FR-2026-2182", "transaction_id": "74000002306000000001187", "card_id": "crd_bl_005", "fraud_type": "6", "case_id": "DOS-2026-0398", "status": "accepted", "amount_minor": 8990, "currency": "EUR", "reported_at": "2026-10-11T09:00:00Z" },
        { "fraud_report_id": "FR-2026-2301", "payment_id": "pay_0004", "card_id": "crd_bl_005", "fraud_type": "6", "case_id": "DOS-2026-0420", "status": "sent", "amount_minor": 6000, "currency": "EUR", "reported_at": "2026-11-03T15:30:00Z" }
      ],
      "disputes": [
        { "dispute_id": "DSP-2026-0007", "transaction_id": "74000002306000000001187", "condition_code": "10.4", "amount_minor": 8990, "currency": "EUR", "status": "acquirer_responded", "fraud_report_id": "FR-2026-2182",
          "opened_at": "2026-10-12T08:00:00Z", "respond_by": "2026-11-11", "history": [ { "at": "2026-10-12T08:00:00Z", "status": "submitted" }, { "at": "2026-10-30T14:12:00Z", "status": "acquirer_responded" } ] }
      ],
      "payments": [
        { "payment_id": "pay_0001", "card_id": "crd_bl_001", "amount_minor": 7900, "currency": "EUR", "status": "captured", "authorised_at": "2026-11-01T10:00:00Z", "captured_at": "2026-11-02T02:00:00Z", "three_ds": "authenticated", "channel": "ecom", "merchant": "M-104 Boutique Rivoli (démo)" },
        { "payment_id": "pay_0002", "card_id": "crd_bl_001", "amount_minor": 8900, "currency": "EUR", "status": "captured", "authorised_at": "2026-10-11T18:20:00Z", "captured_at": "2026-10-12T02:00:00Z", "three_ds": "none", "channel": "ecom", "merchant": "M-107 Maison Atlas (démo)", "expected_delivery_date": "2026-10-20" },
        { "payment_id": "pay_0003", "card_id": "crd_bl_008", "amount_minor": 1240, "currency": "EUR", "status": "authorised", "authorised_at": "2026-11-08T07:45:00Z", "captured_at": null, "three_ds": "none", "channel": "pos", "merchant": "M-101 Boulangerie Lumière (démo)" },
        { "payment_id": "pay_0004", "card_id": "crd_bl_005", "amount_minor": 6000, "currency": "EUR", "status": "captured", "authorised_at": "2026-11-01T20:02:00Z", "captured_at": "2026-11-01T23:00:00Z", "three_ds": "none", "channel": "ecom", "merchant": "M-111 CadeauxExpress (démo)", "note": "après le vol ; déclaration FR-2026-2301" },
        { "payment_id": "pay_0005", "card_id": "crd_bl_005", "amount_minor": 14000, "currency": "EUR", "status": "captured", "authorised_at": "2026-11-01T20:09:00Z", "captured_at": "2026-11-01T23:00:00Z", "three_ds": "authenticated", "channel": "ecom", "merchant": "M-111 CadeauxExpress (démo)" }
      ]
    }
  },
  "token_requestors": [
    { "token_requestor_id": "40010030273", "name": "Apple Pay (demo TRID)", "type": "wallet", "device_bound": true },
    { "token_requestor_id": "40010075001", "name": "Google Pay (demo TRID)", "type": "wallet", "device_bound": true },
    { "token_requestor_id": "40010099001", "name": "QuickGift Codes card-on-file (demo)", "type": "merchant", "device_bound": false }
  ],
  "conditions": {
    "10.1": "EMV liability shift counterfeit fraud", "10.2": "EMV liability shift non-counterfeit fraud", "10.3": "Other fraud, card present",
    "10.4": "Other fraud, card absent", "10.5": "Visa fraud monitoring programme",
    "11.1": "Card recovery bulletin", "11.2": "Declined authorisation", "11.3": "No authorisation",
    "12.1": "Late presentment", "12.2": "Incorrect transaction code", "12.3": "Incorrect currency", "12.4": "Incorrect account number",
    "12.5": "Incorrect amount", "12.6": "Duplicate processing or paid by other means", "12.7": "Invalid data",
    "13.1": "Merchandise or services not received", "13.2": "Cancelled recurring", "13.3": "Not as described or defective",
    "13.4": "Counterfeit merchandise", "13.5": "Misrepresentation", "13.6": "Credit not processed", "13.7": "Cancelled merchandise or services",
    "13.8": "Original credit not accepted", "13.9": "Non-receipt of cash at ATM"
  },
  "arbitration_fee_minor": 60000
}
