const Tgfancy = require('tgfancy');

const Command = require('./command');
const ResponseContext = require('./response-context');

class TelegramBot {
	constructor({ apiToken }) {
		this._currentCommand = null;
		this._registeredCommands = { }; // hash-map of commands { string: Command }
		this.bot = new Tgfancy(apiToken, {
			polling: { autoStart: false }
		});

		this._subscribeToNewMessages();
	}

	start() {
		this.bot.startPolling();
	}

	// command must inherit from Command
	register(commandName, command) {
		const commandConstructor = this._getConstructor(command);

		// TODO: display warning/log if command with name commandName exists
		// and this would override it?
		this._registeredCommands[commandName] = commandConstructor;
	}

	_getConstructor(command) {
		if(command.prototype instanceof Command) {
			// command is already a constructor that extends from Command
			return command;
		}

		throw Error(
			"Unknown value supplied to register. Command must be a " +
			"constructor that extends from Command");
	}

	_subscribeToNewMessages () {
		this.bot.on('message', (msg) => {

			// if is text message and matches command format (= '/test yy zz' etc)
			if(msg.text && this._isCommand(msg.text)) {
				const commandInfo = this._getCommandInfoFrom(msg.text);
				this._startCommand(msg.chat, commandInfo);
			}
			else if(this._currentCommand !== null) {
				this._currentCommand.onNewMessage(msg);
			}
		});

		this.bot.on('callback_query', (query) => {
			if(this._currentCommand !== null) {
				this._currentCommand.onNewCallbackQuery(query);
			}
		});
	}

	async _startCommand(chat, commandInfo) {
		const NewCommandType = this._registeredCommands[commandInfo.name];
		if(!NewCommandType) {
			this.bot.sendMessage(chat.id, `Unknown command '${commandInfo.name}'`);
			return;
		}

		// abort currently running command
		if(this._currentCommand !== null) {
			// TODO: maybe abort() can return 'force keep open'?
			this._currentCommand.onAbort();
		}

		const context = new ResponseContext(this.bot, chat);
		const params = commandInfo.params;

		const createdCommand = new NewCommandType({ context: context });
		this._currentCommand = createdCommand;

		// run and wait until the execution has ended
		await this._currentCommand.run(context, params, { /* TODO: smth?? */ });
		if(this._currentCommand === createdCommand) {
			this._currentCommand = null;
		}
	}

	_isCommand(text) {
		// Matches "/command [params]"
		const matchCommandRegex = /\/([^\s\\]+)\s*(.*)/;
		return matchCommandRegex.test(text);
	}

	// commandText == '/test param1 param2' etc
	_getCommandInfoFrom(commandText) {
		if(!this._isCommand(commandText)) {
			console.error(`'${commandText}' is not a command`);
			return null;
		}

		// on '/command param1 "param2 more"',
		// matches == ['command', param1, "param2 more"]
		// TODO: one possible problem: if param starts with /, the / is ignored
		const matchCommandRegex = /([^\/\s"']+)|"([^"]*)"|'([^']*)'/g;
		const match = commandText.match(matchCommandRegex);

		const name = match[0];

		// remove the command name and possible quotes around the parameters
		const params = match.splice(1).map(p => p.replace(/"/g, ''));
		return { name: name, params: params };
	}
}

module.exports = TelegramBot;
