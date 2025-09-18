const express = require('express');
const bodyParser = require('body-parser');
const { matchSOP } = require('./sopMap');
const { sendSlackMessage } = require('./slack');
const { getSOPData } = require('./sheets');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Log queries to a file
function logQuery(query, matchedSOP) {
    const logEntry = {
        timestamp: new Date().toISOString(),
        query,
        matchedSOP
    };
    fs.appendFileSync('slack-bot/logs/query_log.json', JSON.stringify(logEntry) + '\n');
}

// Slack Events endpoint
app.post('/slack/events', async (req, res) => {
    // Slack URL verification
    if (req.body.type === 'url_verification') {
        return res.status(200).send({ challenge: req.body.challenge });
    }

    // Handle slash command query
    const query = req.body.text || '';
    const matchedSOP = matchSOP(query);

    if (matchedSOP) {
        try {
            const data = await getSOPData(matchedSOP);
            const preview = data ? data.slice(0, 3).map(row => row.join(' | ')).join('\n') : 'No data found.';
            const responseText = `Matched SOP: *${matchedSOP}*\nSample Data:\n${preview}`;
            await sendSlackMessage(req.body.channel_id, responseText);
        } catch (error) {
            await sendSlackMessage(req.body.channel_id, `Matched SOP: *${matchedSOP}*\nError fetching data.`);
        }
    } else {
        await sendSlackMessage(req.body.channel_id, "Sorry, I couldn't find a matching SOP.");
    }

    logQuery(query, matchedSOP);
    res.status(200).send();
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Slack bot server running on port ${PORT}`);
});

