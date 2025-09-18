const express = require('express');
const bodyParser = require('body-parser');
const { matchSOP } = require('./sopMap'); // ✅ Import from sopMap.js
const { sendSlackMessage } = require('./slack');
const { getSOPData } = require('./sheets');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

function logQuery(query, matchedSOP) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        query,
        matchedSOP
    };
    fs.appendFileSync('slack-bot/logs/query_log.json', JSON.stringify(logEntry) + '\n');
}

app.post('/slack/events', async (req, res) => {
    const query = req.body.text || '';
    const matchedSOP = matchSOP(query);

    if (matchedSOP) {
        const data = await getSOPData(matchedSOP);
        const responseText = data ? `Matched SOP: ${matchedSOP}\nSample Data:\n${JSON.stringify(data.slice(0, 3))}` : `Matched SOP: ${matchedSOP}, but no data found.`;
        await sendSlackMessage(req.body.channel_id, responseText);
    } else {
        await sendSlackMessage(req.body.channel_id, "Sorry, I couldn't find a matching SOP.");
    }

    logQuery(query, matchedSOP);
    res.status(200).send();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Slack bot server running on port ${PORT}`);
});
