const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { WebClient } = require('@slack/web-api');
const fuzz = require('fuzzball'); // For fuzzy matching

const app = express();
app.use(bodyParser.json());

const slackToken = process.env.SLACK_BOT_TOKEN;
const slackClient = new WebClient(slackToken);

const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
const spreadsheetId = 'YOUR_SPREADSHEET_ID'; // Replace with your actual ID

// Define query types and keywords
const queryMap = {
  'jobs_today': ['jobs due today', 'today\'s jobs', 'due today'],
  'jobs_tomorrow': ['jobs due tomorrow', 'tomorrow\'s jobs', 'due tomorrow'],
  'assignments_by_job': ['assignments for', 'who is assigned to', 'job assignments'],
  'assignments_by_week': ['assignments this week', 'weekly assignments'],
  'purchase_orders': ['approved purchase orders', 'POs approved', 'purchase orders this week']
};

// Match query to type
function matchQuery(text) {
  let bestMatch = { type: null, score: 0 };
  for (const [type, phrases] of Object.entries(queryMap)) {
    for (const phrase of phrases) {
      const score = fuzz.token_set_ratio(text.toLowerCase(), phrase.toLowerCase());
      if (score > bestMatch.score && score > 70) {
        bestMatch = { type, score };
      }
    }
  }
  return bestMatch.type;
}

// Fetch data from Google Sheets
async function fetchSheetData(type) {
  switch (type) {
    case 'jobs_today':
      return await getJobsByDate('today');
    case 'jobs_tomorrow':
      return await getJobsByDate('tomorrow');
    case 'assignments_by_job':
      return await getAssignments('job');
    case 'assignments_by_week':
      return await getAssignments('week');
    case 'purchase_orders':
      return await getPurchaseOrders();
    default:
      return 'Sorry, I couldn’t find anything relevant.';
  }
}

// Example: Get jobs by date
async function getJobsByDate(day) {
  const range = 'Jobs List!A2:G'; // Adjust range as needed
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values;
  const today = new Date();
  const targetDate = new Date(today);
  if (day === 'tomorrow') targetDate.setDate(today.getDate() + 1);

  const filtered = rows.filter(row => {
    const jobDate = new Date(row[5]); // Assuming column F is the date
    return jobDate.toDateString() === targetDate.toDateString();
  });

  if (filtered.length === 0) return 'No jobs found for ' + day;
  return filtered.map(row => `• ${row[0]} - ${row[1]} (${row[5]})`).join('\n');
}

// Example: Get assignments
async function getAssignments(scope) {
  const range = 'Trades!A2:E'; // Adjust range
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values;

  if (scope === 'job') {
    return rows.map(row => `• ${row[0]}: ${row[1]} assigned to ${row[2]}`).join('\n');
  } else {
    return rows.map(row => `• ${row[0]}: ${row[1]} this week`).join('\n');
  }
}

// Example: Get purchase orders
async function getPurchaseOrders() {
  const range = 'Purchase Orders!A2:E';
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values;

  const thisWeek = new Date();
  const startOfWeek = new Date(thisWeek.setDate(thisWeek.getDate() - thisWeek.getDay()));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const filtered = rows.filter(row => {
    const date = new Date(row[3]); // Assuming column D is approval date
    return date >= startOfWeek && date <= endOfWeek;
  });

  if (filtered.length === 0) return 'No approved purchase orders this week.';
  return filtered.map(row => `• PO#${row[0]} - ${row[1]} - \$${row[2]}`).join('\n');
}

// Slack event listener
app.post('/slack/events', async (req, res) => {
  const { text, user_id, channel_id } = req.body.event;

  const queryType = matchQuery(text);
  const response = await fetchSheetData(queryType);

  await slackClient.chat.postMessage({
    channel: channel_id,
    text: response
  });

  res.status(200).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
