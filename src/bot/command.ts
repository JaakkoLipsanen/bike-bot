import ResponseContext from "./response-context";
import { Message, CallbackQuery } from "./index";

// not sure how useful class this is
export default abstract class Command {
	private _context: ResponseContext;
	constructor(context: ResponseContext) {
		this._context = context;
	}

	abstract async run(ctx: ResponseContext, params: string[], paramsRaw?: string): Promise<void>;
	onAbort() {
		/* this.bot.sendText("Command aborted"); */
	} // TODO: command name as well?

	onNewMessage(msg: Message) {
		this._context.update({ type: "message", msg });
	}

	onNewCallbackQuery(query: CallbackQuery) {
		this._context.update({ type: "query", query });
	}
}

export interface CommandConstructor {
	new (ctx: ResponseContext): Command;
}
