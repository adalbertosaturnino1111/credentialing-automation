/**
 * Credentialing Automation - Web App Endpoint
 *
 * Simple HTTP entry point for manual re-analysis requests.
 *
 * Example demo request:
 *   ?action=REANALYZE_DOCUMENT&record=DEMO-0001&document=Photo
 */

function doGet(e) {
  const action = String(
    (e && e.parameter && (e.parameter.action || e.parameter.acao)) || ""
  )
    .trim()
    .toUpperCase();

  const recordId = String(
    (e && e.parameter && (e.parameter.record || e.parameter.bp)) || ""
  ).trim();

  const documentName = String(
    (e && e.parameter && e.parameter.document) || ""
  ).trim();

  if (action === "REANALYZE_DOCUMENT") {
    if (!recordId) {
      return textResponse("Error: record ID not provided.");
    }

    if (!documentName) {
      return textResponse("Error: document not provided.");
    }

    return textResponse(
      executeDocumentAnalysis(
        "permanent",
        recordId,
        documentName
      )
    );
  }

  return textResponse(
    "Invalid or missing action."
  );
}

function textResponse(message) {
  return ContentService
    .createTextOutput(message)
    .setMimeType(ContentService.MimeType.TEXT);
}
