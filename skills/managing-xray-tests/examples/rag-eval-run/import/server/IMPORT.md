# Import guide · Xray Server / Data Center · project LUM

## 1. Execution results (18 tests) · `results.json`

Statuses use the Xray Server / Data Center vocabulary (PASS, FAIL, TODO, EXECUTING). Tests without a key are created by this import.

```bash
# JIRA_PAT = a Jira personal access token (Profile › Personal Access Tokens)
curl -H "Content-Type: application/json" -H "Authorization: Bearer $JIRA_PAT" --data @results.json "https://YOUR-JIRA/rest/raven/2.0/import/execution"
```

Then check the Test Execution in Jira: every test listed, statuses right, defects linked.

No API access? Open the Test Execution › **Import Execution Results** › Xray JSON.

## Before importing

- Requirement keys and project `LUM` exist and you can create Test issues in it.
- Try with 2 or 3 tests first, check them in Jira, then import the rest.
- Never paste a token or secret into a file you share: use environment variables as above.
