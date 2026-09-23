/**
 * Credentialing Automation - Portfolio Configuration
 *
 * Public/demo configuration only.
 *
 * Real Google resource IDs and API keys are intentionally NOT stored
 * in source code. Configure them through Apps Script > Project Settings
 * > Script Properties when running a private/demo copy.
 */

const CONFIG = {
  sheets: {
    permanent: {
      propertyKey: "DEMO_SPREADSHEET_ID_PERMANENT",
      sheetName: "PERMANENT_CREDENTIALS",
      bpColumn: 1,
      card: {
        date: 68,
        document: 69,
        status: 70,
        file: 71,
        reason: 72
      }
    },
    temporary: {
      propertyKey: "DEMO_SPREADSHEET_ID_TEMPORARY",
      sheetName: "TEMPORARY_CREDENTIALS",
      bpColumn: 1,
      card: {
        date: 32,
        document: 33,
        status: 34,
        file: 35,
        reason: 36
      }
    }
  },

  drive: {
    imagesFolderPropertyKey: "DEMO_IMAGES_FOLDER_ID",
    filesFolderPropertyKey: "DEMO_FILES_FOLDER_ID"
  },

  gemini: {
    apiKeyPropertyKey: "GEMINI_API_KEY",
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent"
  }
};

function getScriptProperty(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function getSpreadsheetId(mode) {
  const settings = getModeConfig(mode);
  const id = getScriptProperty(settings.propertyKey);

  if (!id) {
    throw new Error(
      "Missing Script Property: " + settings.propertyKey
    );
  }

  return id;
}

function getModeConfig(mode) {
  const normalized = String(mode || "permanent").toLowerCase();

  if (!CONFIG.sheets[normalized]) {
    throw new Error("Unsupported credentialing mode: " + mode);
  }

  return CONFIG.sheets[normalized];
}

function getGeminiApiKey() {
  const key = getScriptProperty(CONFIG.gemini.apiKeyPropertyKey);

  if (!key) {
    throw new Error(
      "Missing Script Property: " +
      CONFIG.gemini.apiKeyPropertyKey
    );
  }

  return key;
}
