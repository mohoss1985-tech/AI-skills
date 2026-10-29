# Import guide · Xray Cloud · project LUM

## 1. Manual tests (2) · `tests.csv`

Jira › Xray › **Test Case Importer** › CSV. Delimiter `,`, encoding UTF-8. Tick **Create folders** if the repository folders don't exist yet.

| CSV column | Map to |
|---|---|
| Test ID | Test Case Identifier (groups the step rows of one test) |
| Summary | Summary |
| Description | Description |
| Test Type | Test Type |
| Priority | Priority |
| Test Repository Path | Test Repository Path |
| Requirement (each column) | Link "Tests" |
| Labels (each column) | Labels |
| Action · Data · Expected Result | Action · Data · Expected Result |

Save the mapping as a configuration file at the end: next imports take one click.

## 2. Cucumber tests (3 in 2 files) · `features/`

Each `.feature` file is tagged with its requirement key, so Xray links the tests to the story. A `Background` becomes a Precondition. Scenarios tagged with an existing test key update that test.

```bash
# get a token (valid 24 h)
export XRAY_TOKEN=$(curl -s -H "Content-Type: application/json" -X POST --data '{"client_id":"'$XRAY_CLIENT_ID'","client_secret":"'$XRAY_CLIENT_SECRET'"}' https://xray.cloud.getxray.app/api/v2/authenticate | tr -d '"')
curl -H "Content-Type: multipart/form-data" -H "Authorization: Bearer $XRAY_TOKEN" -F "file=@features/<file>.feature" "https://xray.cloud.getxray.app/api/v2/import/feature?projectKey=LUM"
```

No API access? Zip the `features` folder and use **Import Cucumber Tests** in the Xray menu (Test Repository or the Xray project page).

## 3. Execution results (6 tests) · `results.json`

Statuses use the Xray Cloud vocabulary (PASSED, FAILED, TODO, EXECUTING). Tests without a key are created by this import.

> ⚠️ **Avoid duplicates.** CARD-T01, CARD-T02, CARD-T03, CARD-T04, CARD-T05 are also in the files above but have no Jira key yet. Pick one route: **(A)** import the tests first, copy the keys Xray gives them into the spec (`"key": "LUM-…"`), rebuild, then import `results.json`; or **(B)** skip the steps above and let `results.json` create the tests with their results in one go.

```bash
curl -H "Content-Type: application/json" -H "Authorization: Bearer $XRAY_TOKEN" --data @results.json "https://xray.cloud.getxray.app/api/v2/import/execution"
```

Then check the Test Execution in Jira: every test listed, statuses right, defects linked.

No API access? Open the Test Execution › **Import Execution Results** › Xray JSON.

## Before importing

- Requirement keys and project `LUM` exist and you can create Test issues in it.
- Try with 2 or 3 tests first, check them in Jira, then import the rest.
- Never paste a token or secret into a file you share: use environment variables as above.
