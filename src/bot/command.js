
// not sure how useful class this is
class Command {
	constructor({ context }) {
		this._context = context;
	}

	run(ctx, params) { }
	onAbort() { /* this.bot.sendText("Command aborted"); */ } // TODO: command name as well?

	onNewMessage(msg) {
		this._context._onNewMessage(msg);
	}

	onNewCallbackQuery(query) {
		this._context._onNewCallbackQuery(query);
	}
}

module.exports = Command;
