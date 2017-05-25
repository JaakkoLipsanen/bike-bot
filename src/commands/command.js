
// not sure how useful class this is
class Command {
	constructor({ context }) {
		this._context = context;
	}

	run({ context, parameters }) { }
	abort() { } // TODO: command name as well?
	onAbort() { this.bot.sendText("Command aborted"); }

	onNewMessage(msg) {
		this._context._onNewMessage(msg);
	}
}

module.exports = Command;
