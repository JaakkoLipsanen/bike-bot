import * as dotenv from 'dotenv-safe';
const useDotEnv = !process.env.NO_DOT_ENV;
if(useDotEnv) {
    dotenv.load({ allowEmptyValues: true });
}

import { TelegramBot } from './bot';
import RouteCommand from './commands/route-command';
import WeatherCommand from './commands/weather-command';
import GpsCommand from './commands/gps-command';

const token = process.env.TG_BOT_TOKEN!;
const bot = process.env.HEROKU ?
    TelegramBot.createWithWebHook(token, process.env.APP_URL!, process.env.HOST!, process.env.PORT!) :
    TelegramBot.createWithPolling(token);

bot.register('route', RouteCommand);
bot.register('weather', WeatherCommand);
bot.register('gps', GpsCommand);

// show more detailed errors for unhandled promise exceptions
process.on('unhandledRejection', r => console.error(r));
