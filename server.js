const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
const stringSimilarity = require('string-similarity');

const app = express();
app.use(express.json());

// Environment variables
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');

// Google Sheets setup
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: GOOGLE_CLIENT_EMAIL,
    private_key: GOOGLE_PRIVATE_KEY,
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const spreadsheetId = '1xqBWQlN6Y9vJ4gtAf2R0qGw6iwV3ZLjFK7UXWDCVpLY';
const range = 'SOPs!A2:C';

async function fetchSOPs() {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });

  const rows = res.data.values;
  const sopDefinitions = {};

  rows.forEach(([title, summary, keywords]) => {
    sopDefinitions[title] = {
      summary,
      keywords: keywords.split(',').map(k => k.trim().toLowerCase()),
    };
  });

  return sopDefinitions;
}

function matchSOP(query, sopDefinitions) {
  const normalizedQuery = query.toLowerCase();
  let bestMatch = null;
  let highestScore = 0;

  for (const [title, data] of Object.entries(sopDefinitions)) {
    const match = stringSimilarity.findBestMatch(normalizedQuery, data.keywords);
    if (match.bestMatch.rating > highestScore) {
      highestScore = match.bestMatch.rating;
      bestMatch = { title, summary: data.summary };
    }
  }

  return highestScore > 0.5 ? bestMatch : null;
}

async function sendToSlack(text) {
  if (!SLACK_WEBHOOK_URL) return;
  await axios.post(SLACK_WEBHOOK_URL, { text });
}

app.post('/slack/events', async (req, res) => {
  const query = req.body.text;

  // Step 1: Respond immediately with loading emoji
  await sendToSlack(':hourglass_flowing_sand: Thinking about your SOP query...');
  res.status(200).send(); // Acknowledge Slack

  // Step 2: Random delay between 1.5 and 2.5 seconds
  const delay = Math.floor(Math.random() * 1000) + 1500;

  setTimeout(async () => {
    const sopDefinitions = await fetchSOPs();
    const result = matchSOP(query, sopDefinitions);

    const responseText = result
      ? `✅ *${result.title}*\n${result.summary}`
      : `❌ No matching SOP found. Try rephrasing your query.`;

    await sendToSlack(responseText);
  }, delay);
});

app.listen(3000, () => {
  console.log('SOP bot server running on port 3000');
});
