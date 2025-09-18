const express = require('express');
const axios = require('axios');
const { google } = require('googleapis');
const stringSimilarity = require('string-similarity');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const spreadsheetId = process.env.GOOGLE_SHEET_ID;

async function fetchSheet(sheetName, range) {
  const client = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: client });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${sheetName}!${range}`,
  });
  return res.data.values;
}

function formatBlocks(title, items) {
  const blocks = [
    {
      type: 'header',
      text: { type: 'plain_text', text: title },
    },
  ];
  for (const item of items) {
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: item },
    });
    blocks.push({ type: 'divider' });
  }
  return blocks;
}

async function handleQuery(query) {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('sop') || lowerQuery.includes('procedure')) {
    const rows = await fetchSheet('AI CHATBOT', 'A2:C');
    const sopMap = {};
    for (const [title, summary, keywords] of rows) {
      sopMap[title] = {
        summary,
        keywords: keywords.split(',').map(k => k.trim().toLowerCase()),
      };
    }

    const allKeywords = Object.entries(sopMap).flatMap(([title, data]) =>
      data.keywords.map(keyword => ({ title, keyword }))
    );

    const keywordList = allKeywords.map(k => k.keyword);
    const match = stringSimilarity.findBestMatch(query.toLowerCase(), keywordList).bestMatch;
    const matchedTitle = allKeywords.find(k => k.keyword === match.target)?.title;

    if (matchedTitle) {
      return formatBlocks('SOP Match', [
        `*${matchedTitle}*\n${sopMap[matchedTitle].summary}`,
      ]);
    } else {
      return formatBlocks('SOP Match', ['No matching SOP found.']);
    }
  }

  if (lowerQuery.includes('trades')) {
    const rows = await fetchSheet('Trades', 'A2:D');
    const items = rows.map(([company, division, , contact]) =>
      `*${company}* — ${division}\nContact: ${contact}`
    );
    return formatBlocks('Trades', items.slice(0, 10));
  }

  if (lowerQuery.includes('completed jobs')) {
    const rows = await fetchSheet('Completed Jobs', 'A2:H');
    const items = rows.map(([job, title, , , , phase, start, end]) =>
      `*${job}* — ${title} (${phase})\nStart: ${start}, End: ${end}`
    );
    return formatBlocks('Completed Jobs', items.slice(0, 10));
  }

  if (lowerQuery.includes('jobs list')) {
    const rows = await fetchSheet('Jobs List', 'A2:H');
    const items = rows.map(([job, title, , , , phase, start, end]) =>
      `*${job}* — ${title} (${phase})\nStart: ${start}, End: ${end}`
    );
    return formatBlocks('Jobs List', items.slice(0, 10));
  }

  if (lowerQuery.includes('purchase orders') || lowerQuery.includes('po')) {
    const rows = await fetchSheet('Purchase Orders', 'B2:F');
    const items = rows.map(([po, job, approver, price, link]) =>
      `*${po}* — ${job}\nApproved by: ${approver}, Price: ${price}\n<${link}|View PO>`
    );
    return formatBlocks('Purchase Orders', items.slice(0, 10));
  }

  if (lowerQuery.includes('change orders')) {
    const rows = await fetchSheet('Change Orders', 'B2:F');
    const items = rows.map(([job, title, price, status, approval]) =>
      `*${job}* — ${title}\nPrice: ${price}, Status: ${status}, Approval: ${approval}`
    );
    return formatBlocks('Change Orders', items.slice(0, 10));
  }

  return formatBlocks('Help', [
    'Try queries like `sop`, `trades`, `completed jobs`, `jobs list`, `purchase orders`, or `change orders`.',
  ]);
}

app.post('/slack/events', async (req, res) => {
  const query = req.body.text || '';
  const blocks = await handleQuery(query);

  res.json({
    response_type: 'in_channel',
    blocks,
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SOP bot server running on port ${PORT}`);
});
