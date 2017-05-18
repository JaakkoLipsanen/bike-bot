const Bot = require('./bot');

const token = process.env.TG_BOT_TOKEN;
const bot = new Bot(token);
bot.register('test', (bot, params) => bot.sendMessage('Plaa'));

bot.start();
