require('dotenv-safe').load({ allowEmptyValues: true });

const { TelegramBot } = require('./bot');
const RouteCommand = require('./commands/route-command');
const WeatherCommand = require('./commands/weather-command');

const token = process.env.TG_BOT_TOKEN;
const bot = process.env.HEROKU ?
    TelegramBot.createWithWebHook(token, process.env.APP_URL, process.env.HOST, process.env.PORT) :
    TelegramBot.createWithPolling(token);

bot.register('route', RouteCommand);
bot.register('weather', WeatherCommand);

// show more detailed errors for unhandled promise exceptions
process.on('unhandledRejection', r => console.error(r));
