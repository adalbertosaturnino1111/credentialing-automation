# Architecture

## Components

| Component | Responsibility |
|---|---|
| AppSheet | User-facing workflow and request initiation |
| Apps Script | Orchestration, validation, integration and status updates |
| Google Sheets | Operational record and workflow state |
| Google Drive | Uploaded document storage |
| Gemini API | Automated document analysis |
| Web App endpoint | Manual re-analysis entry point |

## Request lifecycle

1. AppSheet or a web request supplies a record identifier and document type.
2. Apps Script resolves the target sheet configuration.
3. The engine locates the corresponding record.
4. The document type is normalized and mapped to its configured columns.
5. The uploaded file is retrieved from Google Drive.
6. The file is converted to a payload for Gemini.
7. The model response is validated against the allowed outcomes.
8. The result and timestamp are written to the operational sheet.
9. The activity card is updated with the latest execution state.

## Configuration boundary

Environment-specific values live in Script Properties rather than source code. This allows the same codebase to be reused across a demo environment and a private deployment without changing application logic.

## Failure paths

- **No record:** return a structured error without calling Gemini.
- **No document:** mark the workflow item as pending.
- **File not found:** clear the file URL and record an error.
- **HTTP 429:** back off and retry.
- **HTTP 500/503:** retry because the failure may be transient.
- **Unexpected model response:** raise an explicit error rather than treating unknown text as a valid approval.
