/**
 * Credentialing Automation - Document Analysis Engine
 *
 * Portfolio/demo implementation based on the supplied workflow.
 *
 * Responsibilities:
 * - Normalize document names
 * - Map document types to sheet columns
 * - Locate uploaded files in Google Drive
 * - Send document content to Gemini
 * - Apply retry handling for transient API errors
 * - Write analysis results and workflow cards to Google Sheets
 *
 * No production identifiers, employee data or corporate URLs belong here.
 */

const DOCUMENTS = {
  permanent: [
    { name: "Photo", aliases: ["PHOTO", "PHOTO FILE"], file: 32, url: 33, result: 34, status: 16, type: "photo" },
    { name: "ID Document", aliases: ["ID", "ID DOCUMENT", "RG", "CNH"], file: 35, url: 36, result: 37, status: 18, type: "id" },
    { name: "Proof of Address", aliases: ["PROOF OF ADDRESS", "ADDRESS PROOF"], file: 38, url: 39, result: 40, status: 19, type: "proof_of_address" },
    { name: "Security Certificate A", aliases: ["CERTIFICATE A"], file: 41, url: 42, result: 43, status: 20, type: "certificate_a" },
    { name: "Background Check A", aliases: ["BACKGROUND CHECK A"], file: 44, url: 45, result: 46, status: 21, type: "background_check_a" },
    { name: "Regional Certificate", aliases: ["REGIONAL CERTIFICATE"], file: 47, url: 48, result: 49, status: 22, type: "regional_certificate" },
    { name: "Responsibility Form", aliases: ["RESPONSIBILITY FORM"], file: 50, url: 51, result: 52, status: 23, type: "responsibility_form" },
    { name: "Security Training A", aliases: ["SECURITY TRAINING A"], file: 53, url: 54, result: 55, status: 24, type: "training_a" },
    { name: "Safety Training A", aliases: ["SAFETY TRAINING A"], file: 56, url: 57, result: 58, status: 24, type: "training_b" },
    { name: "Course Certificate", aliases: ["COURSE CERTIFICATE"], file: 59, url: 60, result: 61, status: 24, type: "course_certificate" },
    { name: "Employment Document", aliases: ["EMPLOYMENT DOCUMENT"], file: 62, url: 63, result: 64, status: 25, type: "employment_document" },
    { name: "Credentialing Form", aliases: ["CREDENTIALING FORM", "FORM"], file: 65, url: 66, result: 67, status: 26, type: "credentialing_form" }
  ],

  temporary: [
    { name: "Photo", aliases: ["PHOTO", "PHOTO FILE"], file: 20, url: 21, result: 22, type: "photo" },
    { name: "ID Document", aliases: ["ID", "ID DOCUMENT", "RG", "CNH"], file: 23, url: 24, result: 25, type: "id" },
    { name: "Security Certificate A", aliases: ["CERTIFICATE A"], file: 26, url: 27, result: 28, type: "certificate_a" },
    { name: "Credentialing Form", aliases: ["CREDENTIALING FORM", "FORM"], file: 29, url: 30, result: 31, type: "credentialing_form" }
  ]
};

function normalizeKey(text) {
  return String(text || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .trim();
}

function getDocument(mode, documentName) {
  const list = DOCUMENTS[String(mode || "permanent").toLowerCase()];
  if (!list) {
    throw new Error("Unsupported mode: " + mode);
  }

  const target = normalizeKey(documentName);
  if (!target) return null;

  return list.find(function (document) {
    if (normalizeKey(document.name) === target) return true;

    return (document.aliases || []).some(function (alias) {
      return normalizeKey(alias) === target;
    });
  }) || null;
}

function getPrompt(documentType) {
  const prompts = {
    photo:
      "Review this image for an access badge workflow. Return only APPROVED or REJECTED. Approve when a person is visible, the face is sufficiently clear, and the image is usable. Reject when there is no person, the face is hidden/too blurred/dark, or the image is otherwise unusable.",

    id:
      "Review this identity document. Return only APPROVED or REJECTED. Approve when it appears to be a valid identity document and the main identification fields are sufficiently visible and legible. Reject when it is clearly not an identity document or is materially incomplete/illegible.",

    proof_of_address:
      "Review this proof-of-address document. Return only APPROVED or REJECTED. Approve when it appears to contain an address and the relevant information is sufficiently legible. Reject when it is not a proof-of-address document or is materially illegible.",

    credentialing_form:
      "Review this credentialing form. Return only APPROVED or REJECTED. Approve when the form appears complete and legible. Reject when it is materially incomplete, illegible, or incompatible with the expected form.",

    certificate_a:
      "Review this certificate. Return only APPROVED or REJECTED. Approve when the expected certificate appears complete and legible. Reject when it is incomplete, illegible, or incompatible.",

    background_check_a:
      "Review this background-check document. Return only APPROVED or REJECTED. Approve when the expected document is complete and legible. Reject when it is incomplete, illegible, or incompatible.",

    regional_certificate:
      "Review this regional certificate. Return only APPROVED or REJECTED. Approve when the expected document is complete and legible. Reject when it is incomplete, illegible, or incompatible.",

    responsibility_form:
      "Review this responsibility form. Return only APPROVED or REJECTED. Approve when the document is complete and legible. Reject when it is incomplete, illegible, or incompatible.",

    training_a:
      "Review this training certificate. Return only APPROVED or REJECTED. Approve when the certificate is complete and legible. Reject when it is incomplete, illegible, or incompatible.",

    training_b:
      "Review this safety-training certificate. Return only APPROVED or REJECTED. Approve when the certificate is complete and legible. Reject when it is incomplete, illegible, or incompatible.",

    course_certificate:
      "Review this course certificate. Return only APPROVED or REJECTED. Approve when the certificate is complete and legible. Reject when it is incomplete, illegible, or incompatible.",

    employment_document:
      "Review this employment document. Return only APPROVED or REJECTED. Approve when it is the expected document and the relevant information is sufficiently legible. Reject when it is incomplete, illegible, or incompatible."
  };

  return prompts[documentType] ||
    "Review this document. Return only APPROVED or REJECTED. Approve when complete and legible; otherwise reject.";
}

function findFileInDrive(pathValue, mode) {
  const original = String(pathValue || "").trim();
  if (!original) return null;

  let fileName = original.split("/").pop().trim();

  const filenameMarker = fileName.toLowerCase().indexOf("#filename=");
  if (filenameMarker !== -1) {
    fileName = fileName.substring(filenameMarker + "#filename=".length);
  }

  fileName = fileName.replace(/^filename=/i, "");

  try {
    fileName = decodeURIComponent(fileName);
  } catch (error) {
    // Keep the original value when decoding fails.
  }

  fileName = fileName.trim();

  if (String(mode).toLowerCase() === "permanent") {
    const imagesFolderId = getScriptProperty(CONFIG.drive.imagesFolderPropertyKey);
    const filesFolderId = getScriptProperty(CONFIG.drive.filesFolderPropertyKey);

    let folderId = "";

    if (original.indexOf("CREDENTIALS_IMAGES/") === 0) {
      folderId = imagesFolderId;
    } else if (original.indexOf("CREDENTIALS_FILES/") === 0) {
      folderId = filesFolderId;
    }

    if (folderId) {
      const folder = DriveApp.getFolderById(folderId);
      const files = folder.getFiles();

      while (files.hasNext()) {
        const file = files.next();

        if (file.getName().toLowerCase().startsWith(fileName.toLowerCase())) {
          return file;
        }
      }
    }
  }

  // Generic fallback used by the supplied temporary workflow:
  // search by file name without relying on a real internal folder.
  let filesByName = DriveApp.getFilesByName(fileName);
  if (filesByName.hasNext()) return filesByName.next();

  const safeName = fileName.replace(/'/g, "\\'");
  filesByName = DriveApp.searchFiles(
    "title = '" + safeName + "' and trashed = false"
  );

  if (filesByName.hasNext()) return filesByName.next();

  const prefix = fileName.split(".")[0];

  if (prefix) {
    filesByName = DriveApp.searchFiles(
      "title contains '" + prefix + "' and trashed = false"
    );

    while (filesByName.hasNext()) {
      const candidate = filesByName.next();

      if (
        candidate.getName().trim().toLowerCase() ===
        fileName.toLowerCase()
      ) {
        return candidate;
      }
    }
  }

  return null;
}

function callGemini(payload) {
  const apiKey = getGeminiApiKey();
  const url =
    CONFIG.gemini.endpoint +
    "?key=" +
    encodeURIComponent(apiKey);

  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = UrlFetchApp.fetch(url, {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    });

    const httpCode = response.getResponseCode();
    const body = response.getContentText();

    if (httpCode === 200) {
      const json = JSON.parse(body);

      if (json.candidates && json.candidates.length > 0) {
        const candidate = json.candidates[0];

        if (
          candidate.content &&
          candidate.content.parts &&
          candidate.content.parts.length > 0
        ) {
          const text = candidate.content.parts
            .filter(function (part) {
              return part.text;
            })
            .map(function (part) {
              return part.text;
            })
            .join(" ")
            .trim();

          if (text) return text.toUpperCase();
        }

        throw new Error(
          "Gemini returned no text. Reason: " +
          (candidate.finishReason || "not provided")
        );
      }

      throw new Error(
        "Unexpected Gemini response: " + body.substring(0, 500)
      );
    }

    if (httpCode === 429) {
      Utilities.sleep(5000 * attempt);
      continue;
    }

    if (httpCode === 500 || httpCode === 503) {
      Utilities.sleep(5000 * attempt);
      continue;
    }

    throw new Error(
      "Gemini returned HTTP " +
      httpCode +
      ": " +
      body
    );
  }

  throw new Error("Gemini request failed after 3 attempts.");
}

function executeDocumentAnalysis(mode, bp, documentName) {
  try {
    const normalizedMode = String(mode || "permanent").toLowerCase();

    if (!bp) return "Error: record ID not provided.";
    if (!documentName) return "Error: document not provided.";

    const sheetConfig = getModeConfig(normalizedMode);
    const spreadsheet = SpreadsheetApp.openById(
      getSpreadsheetId(normalizedMode)
    );
    const sheet = spreadsheet.getSheetByName(sheetConfig.sheetName);

    if (!sheet) {
      return "Error: sheet " + sheetConfig.sheetName + " not found.";
    }

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return "Error: no records found.";

    const bpValues = sheet
      .getRange(1, sheetConfig.bpColumn, lastRow, 1)
      .getValues();

    let physicalRow = -1;

    for (let index = 0; index < bpValues.length; index++) {
      if (
        String(bpValues[index][0] || "").trim() ===
        String(bp).trim()
      ) {
        physicalRow = index + 1;
        break;
      }
    }

    if (physicalRow === -1) {
      return "Error: record not found.";
    }

    const document = getDocument(normalizedMode, documentName);

    if (!document) {
      return "Error: document not found in mapping.";
    }

    analyzeSingleDocument(
      normalizedMode,
      sheet,
      physicalRow,
      document
    );

    SpreadsheetApp.flush();

    if (document.status) {
      const result = String(
        sheet
          .getRange(physicalRow, document.result)
          .getValue() || ""
      );

      if (result) {
        sheet
          .getRange(physicalRow, document.status)
          .setValue("Pending Review");
      }
    }

    return "Success: analysis completed.";
  } catch (error) {
    Logger.log("Main analysis error: " + error.message);
    return "Error: " + error.message;
  }
}

function analyzeSingleDocument(mode, sheet, row, document) {
  const timestamp = new Date();
  let filePath = "";

  try {
    filePath = String(
      sheet.getRange(row, document.file).getValue() || ""
    ).trim();

    if (!filePath) {
      updateActivityCard(
        mode,
        sheet,
        row,
        document.name,
        "PENDING",
        "",
        timestamp,
        "File not provided."
      );
      return;
    }

    const file = findFileInDrive(filePath, mode);

    if (!file) {
      sheet.getRange(row, document.url).setValue("");
      sheet
        .getRange(row, document.result)
        .setValue(
          "ERROR - FILE NOT FOUND - " +
          formatTimestamp(timestamp)
        );

      updateActivityCard(
        mode,
        sheet,
        row,
        document.name,
        "ERROR",
        filePath,
        timestamp,
        "File not found in Google Drive."
      );

      return;
    }

    const driveUrl =
      "https://drive.google.com/file/d/" +
      file.getId() +
      "/view";

    sheet
      .getRange(row, document.url)
      .setValue(driveUrl);

    const blob = file.getBlob();
    const base64 = Utilities.base64Encode(
      blob.getBytes()
    );

    const payload = {
      contents: [
        {
          parts: [
            {
              text: getPrompt(document.type)
            },
            {
              inlineData: {
                mimeType: blob.getContentType(),
                data: base64
              }
            }
          ]
        }
      ],
      safetySettings: [
        {
          category: "HARM_CATEGORY_HARASSMENT",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_HATE_SPEECH",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
          threshold: "BLOCK_ONLY_HIGH"
        },
        {
          category: "HARM_CATEGORY_DANGEROUS_CONTENT",
          threshold: "BLOCK_ONLY_HIGH"
        }
      ],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: 10
      }
    };

    const responseText = callGemini(payload);
    let result;

    if (responseText.includes("APPROVED")) {
      result = "APPROVED";
    } else if (responseText.includes("REJECTED")) {
      result = "REJECTED";
    } else {
      throw new Error(
        "Unexpected model response: " + responseText
      );
    }

    sheet
      .getRange(row, document.result)
      .setValue(
        result + " - " + formatTimestamp(timestamp)
      );

    const reason =
      result === "APPROVED"
        ? "Document approved by automated analysis."
        : "Document rejected. Verify completeness and legibility.";

    updateActivityCard(
      mode,
      sheet,
      row,
      document.name,
      result,
      filePath,
      timestamp,
      reason
    );
  } catch (error) {
    Logger.log(
      "Document analysis error: " + error.message
    );

    sheet
      .getRange(row, document.result)
      .setValue(
        "ERROR - " +
        error.message +
        " - " +
        formatTimestamp(timestamp)
      );

    updateActivityCard(
      mode,
      sheet,
      row,
      document.name,
      "ERROR",
      filePath,
      timestamp,
      "Script error: " + error.message
    );
  }
}

function updateActivityCard(
  mode,
  sheet,
  row,
  document,
  status,
  path,
  timestamp,
  reason
) {
  const settings = getModeConfig(mode);
  const date = timestamp instanceof Date ? timestamp : new Date();

  try {
    sheet
      .getRange(row, settings.card.date)
      .setValue(date)
      .setNumberFormat("dd/mm/yyyy hh:mm:ss");

    sheet
      .getRange(row, settings.card.document)
      .setValue(document);

    sheet
      .getRange(row, settings.card.status)
      .setValue(status);

    sheet
      .getRange(row, settings.card.file)
      .setValue(path || "");

    sheet
      .getRange(row, settings.card.reason)
      .setValue(reason || "");
  } catch (error) {
    Logger.log(
      "Card update error: " + error.message
    );
  }
}

function formatTimestamp(date) {
  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone() || "America/Sao_Paulo",
    "dd/MM/yyyy HH:mm:ss"
  );
}

function executeAnalysisFromAppSheet(bp, documentName) {
  return executeDocumentAnalysis(
    "permanent",
    bp,
    documentName
  );
}

function executeTemporaryAnalysisFromAppSheet(bp, documentName) {
  return executeDocumentAnalysis(
    "temporary",
    bp,
    documentName
  );
}

// Synthetic demo identifiers only. These are not production records.
const DEMO_RECORD_ID = "DEMO-0001";

function testPhotoDemo() {
  Logger.log(
    executeDocumentAnalysis(
      "permanent",
      DEMO_RECORD_ID,
      "Photo"
    )
  );
}

function testTemporaryPhotoDemo() {
  Logger.log(
    executeDocumentAnalysis(
      "temporary",
      DEMO_RECORD_ID,
      "Photo"
    )
  );
}
