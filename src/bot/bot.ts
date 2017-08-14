const Tgfancy = require('tgfancy');

import Command, { CommandConstructor } from './command';
import ResponseContext from './response-context';
import { Message, CallbackQuery, Chat } from './index';

type CommandInfo = { name: string, params: string[], paramsRaw: string };

export default class TelegramBot {
	private _currentCommand: Command | null;
	private _registeredCommands: Map<string, CommandConstructor>;
	public readonly tg: any;

	constructor(apiToken: string, opts: object) {
		this._currentCommand = null;
		this._registeredCommands = new Map<string, CommandConstructor>();
		this.tg = new Tgfancy(apiToken, opts);

		this.subscribeToNewMessages();
	}

	static createWithWebHook(apiToken: string, appUrl: string, host: string, port: string | number) {
		console.log("Creating TelegramBot with web hooks");

		const opts = { webHook: { host: host, port: port } };
		const bot = new TelegramBot(apiToken, opts);

		bot.tg.setWebHook(`${appUrl}/bot${apiToken}`);
		return bot;
	}

	static createWithPolling(apiToken: string) {
		console.log("Creating TelegramBot with polling");

		const opts = { polling: { autoStart: true } };
		return new TelegramBot(apiToken, opts);
	}

	// command must inherit from Command
	register(commandName: string, command: CommandConstructor) {
		this._registeredCommands.set(commandName, command);
	}

	private subscribeToNewMessages() {
		this.tg.on('message', (msg: Message) => {
			if(msg.text) {
				msg.text = msg.text.trim();

				// if is text message and matches command format (= '/test yy zz' etc)
				if(this.isCommand(msg.text)) {
				   const commandInfo = this.getCommandInfoFrom(msg.text);
				   this.startCommand(msg.chat, commandInfo);

				   return;
			   }
			}

			if(this._currentCommand !== null) {
				this._currentCommand.onNewMessage(msg);
			}
		});

		this.tg.on('callback_query', (query: CallbackQuery) => {
			if(this._currentCommand !== null) {
				this._currentCommand.onNewCallbackQuery(query);
			}
		});
	}

	private async startCommand(chat: Chat, commandInfo: CommandInfo) {
		const NewCommandType = this._registeredCommands.get(commandInfo.name);
		if(!NewCommandType) {
			this.tg.sendMessage(chat.id, `Unknown command '${commandInfo.name}'`);
			return;
		}

		// abort currently running command
		if(this._currentCommand !== null) {
			// TODO: maybe abort() can return 'force keep open'?
			this._currentCommand.onAbort();
		}

		const context = new ResponseContext(this.tg, chat);
		const params = commandInfo.params;
		const paramsRaw = commandInfo.paramsRaw;

		const createdCommand = new NewCommandType(context);
		this._currentCommand = createdCommand;

		// run and wait until the execution has ended
		try {
			await this._currentCommand.run(context, params, paramsRaw);
		}
		catch(err) {
			context.sendText(`Uncaught error:\n${err}`);
			console.error(err);
		}

		if(this._currentCommand === createdCommand) {
			this._currentCommand = null;
		}
	}

	private isCommand(text: string) {
		// Matches "/command [params]"
		const matchCommandRegex = /\/([^\s\\]+)\s*(.*)/;
		return matchCommandRegex.test(text);
	}

	// commandText == '/test param1 param2' etc
	private getCommandInfoFrom(commandText: string): CommandInfo {
		if(!this.isCommand(commandText)) {
			throw new Error(`'${commandText}' is not a command`);
		}

		// on '/command param1 "param2 more"',
		// matches == ['command', param1, "param2 more"]
		// TODO: one possible problem: if param starts with /, the / is ignored
		const matchCommandRegex = /([^\/\s"']+)|"([^"]*)"|'([^']*)'/g;
		const match = commandText.match(matchCommandRegex);
		if(!match) {
			throw new Error(`'${commandText}' is not a command`);
		}

		const name = match[0];

		// remove the command name and possible quotes around the parameters
		const params = match.splice(1).map(p => p.replace(/"/g, ''));
		const paramsRaw = commandText.slice(name.length + 1).trim();
		return { name, params, paramsRaw };
	}
}
