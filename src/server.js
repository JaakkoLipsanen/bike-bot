require('dotenv-safe').load({ allowEmptyValues: true });

const { TelegramBot } = require('./bot');
const RouteCommand = require('./commands/route-command');

const token = process.env.TG_BOT_TOKEN;
const bot = new TelegramBot({ apiToken: token });

bot.register('route', RouteCommand);
bot.start();

// show more detailed errors for unhandled promise exceptions
process.on('unhandledRejection', r => console.error(r));
