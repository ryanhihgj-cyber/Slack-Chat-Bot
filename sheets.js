const { google } = require('googleapis');

const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });

async function getSheetData(sheetId, range) {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: range
    });

    return response.data.values || [];
  } catch (error) {
    console.error(`Error fetching sheet data: ${error.message}`);
    return [];
  }
}

module.exports = { getSheetData };
