const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');

const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
const SHEET_ID = '1cCFifc3gYwmBInkZdfmC7lptHDlmev7NwOoAjMvTVjE'; // your Google Sheet ID
const SHEET_NAME = 'QA'; 

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, '../service-accounts/service-account.json'),
  scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth });

async function getAllQA() {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:B`,
  });

  const rows = res.data.values || [];
  return rows.map(([question, answer], index) => ({
    id: index + 2, // Row number (starting from 2)
    question,
    answer,
  }));
}

async function addQA(question, answer) {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A:B`,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[question, answer]],
    },
  });
}

async function updateQA(rowNumber, question, answer) {
  const range = `${SHEET_NAME}!A${rowNumber}:B${rowNumber}`;
  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range,
    valueInputOption: 'USER_ENTERED',
    resource: {
      values: [[question, answer]],
    },
  });
}

async function deleteQA(rowNumber) {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SHEET_ID,
    resource: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId: 0,
              dimension: 'ROWS',
              startIndex: rowNumber - 1,
              endIndex: rowNumber,
            },
          },
        },
      ],
    },
  });
}

module.exports = {
  getAllQA,
  addQA,
  updateQA,
  deleteQA, 
};
