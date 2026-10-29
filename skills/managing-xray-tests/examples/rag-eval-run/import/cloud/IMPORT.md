# Import guide · Xray Cloud · project LUM

## 1. Execution results (18 tests) · `results.json`

Statuses use the Xray Cloud vocabulary (PASSED, FAILED, TODO, EXECUTING). Tests without a key are created by this import.

```bash
# get a token (valid 24 h)
export XRAY_TOKEN=$(curl -s -H "Content-Type: application/json" -X POST --data '{"client_id":"'$XRAY_CLIENT_ID'","client_secret":"'$XRAY_CLIENT_SECRET'"}' https://xray.cloud.getxray.app/api/v2/authenticate | tr -d '"')
curl -H "Content-Type: application/json" -H "Authorization: Bearer $XRAY_TOKEN" --data @results.json "https://xray.cloud.getxray.app/api/v2/import/execution"
```

Then check the Test Execution in Jira: every test listed, statuses right, defects linked.

No API access? Open the Test Execution › **Import Execution Results** › Xray JSON.

## Before importing

- Requirement keys and project `LUM` exist and you can create Test issues in it.
- Try with 2 or 3 tests first, check them in Jira, then import the rest.
- Never paste a token or secret into a file you share: use environment variables as above.
