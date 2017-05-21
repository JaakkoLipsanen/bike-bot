require('dotenv').config();

const Bot = require('./bot');
const RouteCommand = require('./commands/route-command');

const token = process.env.TG_BOT_TOKEN;
const bot = new Bot({ apiToken: token });

bot.register('route', RouteCommand);
bot.start();
