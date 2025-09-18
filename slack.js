const { WebClient } = require('@slack/web-api');
require('dotenv').config();

const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

async function sendSlackMessage(channel, text) {
    await slackClient.chat.postMessage({ channel, text });
}

module.exports = { sendSlackMessage };
