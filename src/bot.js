const TelegramBot = require('node-telegram-bot-api');

class Bot {
	constructor({ apiToken }) {
		this.commands = { }; // hash-map of commands { command: function }
		this.bot = new TelegramBot(apiToken, {
			polling: true /* TODO */,
			autoStart: false,
		});
	}

	start() {
		this.bot.startPolling();
	}

	register(commandName, command) {
		this.commands[commandName] = command;
	}

	_setup() {
		// Matches "/command [params]" and "/command"
		const matchCommandRegex = /\/([^\s\\]+)\s?(.*)/;
		this.bot.onText(matchCommandRegex, (msg, match) => {
			const commandName = match[1];
			const parametersRaw = match[2];
			const parameters = parametersRaw.split(' ');

			const command = this.commands[commandName];
			if(command) {
				command(parameters, parametersRaw);
			}
			else {
				this.bot.sendMessage(msg.chat.id, `Unknown command '${commandName}'`);
			}
		});

		bot.on('message', (msg) => {
			const chatId = msg.chat.id;

			// send a message to the chat acknowledging receipt of their message
			bot.sendMessage(chatId, 'Received your message');
		});
	}
}

module.exports = Bot;
