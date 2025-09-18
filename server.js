require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { WebClient } = require('@slack/web-api');
const fuzz = require('fuzzball');
const axios = require('axios');
const {
  getSheetData,
  appendRow,
  updateCell,
  findRowsByDate,
  findRowsByKeyword
} = require('./sheets');

const app = express();
app.use(bodyParser.json());

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);
const spreadsheetId = process.env.SPREADSHEET_ID;

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

// 📊 Data fetchers
async function getJobsByDate(day) {
  const range = 'Jobs List!A2:G';
  const today = new Date();
  const targetDate = new Date(today);
  if (day === 'tomorrow') targetDate.setDate(today.getDate() + 1);

  const rows = await findRowsByDate(spreadsheetId, range, 5, targetDate); // Column F = index 5

  if (rows.length === 0) return `No jobs found for ${day}.`;
  return rows.map(row => `• ${row[0]} - ${row[1]} (${row[5]})`).join('\n');
}

async function getAssignments(scope) {
  const range = 'Trades!A2:E';
  const rows = await getSheetData(spreadsheetId, range);

  if (scope === 'job') {
    return rows.map(row => `• ${row[0]}: ${row[1]} assigned to ${row[2]}`).join('\n');
  } else {
    return rows.map(row => `• ${row[0]}: ${row[1]} this week`).join('\n');
  }
}

async function getPurchaseOrders() {
  const range = 'Purchase Orders!A2:E';
  const rows = await getSheetData(spreadsheetId, range);

  const today = new Date();
  const startOfWeek = new Date(today.setDate(today.getDate() - today.getDay()));
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);

  const filtered = rows.filter(row => {
    const date = new Date(row[3]); // Assuming column D is approval date
    return date >= startOfWeek && date <= endOfWeek;
  });

  if (filtered.length === 0) return 'No approved purchase orders this week.';
  return filtered.map(row => `• PO#${row[0]} - ${row[1]} - \$${row[2]}`).join('\n');
}

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
  console.log('Incoming Slack event:', JSON.stringify(req.body, null, 2));

  const body = req.body;

  if (body.type === 'url_verification') {
    return res.status(200).send(body.challenge);
  }

  if (body.type === 'event_callback') {
    const event = body.event;

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

  res.status(200).send();
});

// 🔍 Test endpoint
app.get('/test', (req, res) => {
  res.send('Slack bot is live!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Smart Slack bot running on port ${PORT}`));
