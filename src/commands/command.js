
// not sure how useful class this is
class Command {
	constructor({ context }) {
		this._context = context;
	}

	run({ context, parameters }) { }
	abort() { this.bot.sendText("Command aborted"); } // TODO: command name as well?

	onNewMessage(msg) {
		this._context._onNewMessage(msg);
	}
}

module.exports = Command;
