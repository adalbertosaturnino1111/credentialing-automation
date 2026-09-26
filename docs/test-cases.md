# Test Cases

| ID | Scenario | Expected result |
|---|---|---|
| TC-01 | Valid record + valid document | Analysis completes and result is written |
| TC-02 | Missing record identifier | Request is rejected before file/API lookup |
| TC-03 | Missing document type | Request is rejected before analysis |
| TC-04 | Unknown document type | Mapping error is returned |
| TC-05 | Missing file path | Workflow item becomes `PENDING` |
| TC-06 | File cannot be found | Workflow records an explicit file-not-found error |
| TC-07 | Gemini HTTP 429 | Request waits and retries |
| TC-08 | Gemini HTTP 500/503 | Request retries before failing |
| TC-09 | Unexpected Gemini response | Workflow records an explicit analysis error |
| TC-10 | Successful result | Sheet result, timestamp and activity card are updated |
