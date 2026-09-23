# Credentialing Automation

A portfolio demonstration of a document-credentialing workflow built with Google Apps Script, Google Sheets, Google Drive, AppSheet integration and Gemini-based document analysis.

## What this project demonstrates

- Workflow automation around a spreadsheet-based process
- Document-type mapping and normalization
- Google Drive file discovery
- Gemini API integration for document analysis
- Retry handling for transient API errors
- Automated status and activity-card updates
- HTTP entry point for manual re-analysis
- Shared analysis logic for permanent and temporary credentialing flows
- Configuration through Script Properties instead of hard-coded secrets

## Architecture

```text
AppSheet / Web Request
          |
          v
   Apps Script Entry Point
          |
          v
 Document Analysis Engine
      /          \
     v            v
Google Sheets   Google Drive
                     |
                     v
                 Document
                     |
                     v
                Gemini API
                     |
                     v
             APPROVED / REJECTED
                     |
                     v
              Workflow Status
```

## Portfolio version

This repository intentionally uses synthetic identifiers and generic resource names.

It does **not** contain:

- corporate spreadsheet IDs
- corporate Drive folder IDs
- employee/candidate data
- production API keys
- internal URLs
- private documents

Real resource identifiers should be supplied through Apps Script Script Properties in a private/demo environment.

## Script Properties

Configure the following properties in the Apps Script project when running the demonstration:

```text
DEMO_SPREADSHEET_ID_PERMANENT
DEMO_SPREADSHEET_ID_TEMPORARY
DEMO_IMAGES_FOLDER_ID
DEMO_FILES_FOLDER_ID
GEMINI_API_KEY
```

## Repository structure

```text
credentialing-automation/
├── apps-script/
│   ├── config.gs
│   ├── document-analysis.gs
│   └── web-app.gs
└── README.md
```

## Notes

The repository is a public portfolio demonstration rather than a direct export of a production Google Workspace project. The implementation keeps the core workflow patterns visible while replacing production identifiers and data with generic/demo configuration.
