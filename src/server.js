require('dotenv').config();

const { TelegramBot } = require('tg-commands');
const RouteCommand = require('./commands/route-command');

const token = process.env.TG_BOT_TOKEN;
const bot = new TelegramBot({ apiToken: token });

bot.register('route', RouteCommand);
bot.register('test', async (ctx, params) => {
	ctx.sendText("Tell me tales");
	const msg = await ctx.waitForResponse();
	if(msg.text) {
		ctx.sendText("That tale sucked");
	}
	else {
		ctx.sendText("That wasn't a tale :heart:");
	}
});

bot.register('hala', {
	async run(ctx, params) {
		ctx.sendText("Tell me tales");
		const msg = await ctx.askForText("What's your name?");
		if(msg.text) {
			ctx.sendText("That tale sucked");
		}
		else {
			ctx.sendText("That wasn't a tale :heart:");
		}
	},

	abort(ctx) {

	}
});

await ctx.waitForMessage({
	retryLimit: 1,
	accept: (ctx, msg) => {
		if(msg.text) return true;

		ctx.sendText("Please send a text message!");
	}
});

await ctx.helpers.waitForText({
	retryLimit: 1,
	wrongTypeMessage: "Please send a text message"
});

bot.start();

// show more detailed errors for unhandled promise exceptions
process.on('unhandledRejection', r => console.error(r));
