const express = require('express');
const bodyParser = require('body-parser');
const { google } = require('googleapis');
const { WebClient } = require('@slack/web-api');
const fuzz = require('fuzzball');
const axios = require('axios');

const app = express();
app.use(bodyParser.json());

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const sheets = google.sheets({ version: 'v4', auth: process.env.GOOGLE_API_KEY });
const spreadsheetId = 'YOUR_SPREADSHEET_ID';

// 🔍 Use AI to interpret the query
async function interpretQuery(text) {
  const prompt = `You are a smart assistant for a construction company. Interpret this query and return a single word intent like "jobs_today", "jobs_tomorrow", "assignments_by_job", "assignments_by_week", or "purchase_orders". Query: "${text}"`;

  const response = await axios.post('https://api.openai.com/v1/chat/completions', {
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  }, {
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
    }
  });

  const intent = response.data.choices[0].message.content.trim().toLowerCase();
  return intent;
}

// 🔄 Fallback fuzzy match
function fuzzyMatch(text) {
  const queryMap = {
    'jobs_today': ['today', 'jobs today', 'due today'],
    'jobs_tomorrow': ['tomorrow', 'jobs tomorrow', 'due tomorrow'],
    'assignments_by_job': ['who is assigned', 'job assignments'],
    'assignments_by_week': ['weekly assignments', 'assignments this week'],
    'purchase_orders': ['approved purchase orders', 'POs this week']
  };

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

// 🧠 Smart query handler
async function getIntent(text) {
  try {
    const aiIntent = await interpretQuery(text);
    if (['jobs_today', 'jobs_tomorrow', 'assignments_by_job', 'assignments_by_week', 'purchase_orders'].includes(aiIntent)) {
      return aiIntent;
    }
  } catch (err) {
    console.error('AI intent failed:', err.message);
  }
  return fuzzyMatch(text);
}

// 📊 Data fetchers (same as before)
async function getJobsByDate(day) { /* same as before */ }
async function getAssignments(scope) { /* same as before */ }
async function getPurchaseOrders() { /* same as before */ }

async function fetchSheetData(type) {
  switch (type) {
    case 'jobs_today': return await getJobsByDate('today');
    case 'jobs_tomorrow': return await getJobsByDate('tomorrow');
    case 'assignments_by_job': return await getAssignments('job');
    case 'assignments_by_week': return await getAssignments('week');
    case 'purchase_orders': return await getPurchaseOrders();
    default: return '🤖 I couldn’t find anything relevant, but I’m learning fast!';
  }
}

// 🚀 Slack event listener
app.post('/slack/events', async (req, res) => {
  const body = req.body;

  // Handle Slack URL verification challenge
  if (body.type === 'url_verification') {
    return res.status(200).send(body.challenge);
  }

  // Handle Slack event callbacks
  if (body.type === 'event_callback') {
    const event = body.event;

    // Only respond to message events with text
    if (event && event.type === 'message' && event.text && !event.bot_id) {
      const intent = await getIntent(event.text);
      const response = await fetchSheetData(intent);

      await slackClient.chat.postMessage({
        channel: event.channel,
        text: `Here’s what I found for *${event.text}*:\n\n${response}`
      });

      return res.status(200).send();
    }
  }

  // If nothing matched, just acknowledge
  res.status(200).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Smart Slack bot running on port ${PORT}`));
