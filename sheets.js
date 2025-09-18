const { google } = require('googleapis');

const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });

/**
 * Fetches data from a specific range in a Google Sheet.
 */
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

/**
 * Appends a row to a sheet.
 */
async function appendRow(sheetId, range, rowData) {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [rowData]
      }
    });
    return true;
  } catch (error) {
    console.error(`Error appending row: ${error.message}`);
    return false;
  }
}

/**
 * Updates a specific cell or range.
 */
async function updateCell(sheetId, range, value) {
  try {
    await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: range,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[value]]
      }
    });
    return true;
  } catch (error) {
    console.error(`Error updating cell: ${error.message}`);
    return false;
  }
}

/**
 * Finds rows by date in a specific column.
 */
async function findRowsByDate(sheetId, range, dateColumnIndex, targetDate) {
  const rows = await getSheetData(sheetId, range);
  const formattedTarget = new Date(targetDate).toDateString();

  return rows.filter(row => {
    const cellDate = new Date(row[dateColumnIndex]);
    return cellDate.toDateString() === formattedTarget;
  });
}

/**
 * Finds rows that match a keyword in a specific column.
 */
async function findRowsByKeyword(sheetId, range, columnIndex, keyword) {
  const rows = await getSheetData(sheetId, range);
  return rows.filter(row => row[columnIndex]?.toLowerCase().includes(keyword.toLowerCase()));
}

module.exports = {
  getSheetData,
  appendRow,
  updateCell,
  findRowsByDate,
  findRowsByKeyword
};
