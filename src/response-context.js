
class ResponseContext {
	constructor(bot, chat) {
		this.bot = bot;
		this.chat = chat;
		this._responseWaitQueue = [];
	}

	sendText(text, ...params) {
		this.bot.sendMessage(this.chat.id, text, ...params);
	}

	waitForResponse() {
		return new Promise(resolve => {
			this._responseWaitQueue.push({ resolve: resolve });
		});
	}

	_onNewMessage(msg) {
		if(this._responseWaitQueue.length === 0) {
			console.error("A new message was received but command didn't respond");
			return;
		}

		const response = this._responseWaitQueue.shift();
		response.resolve(msg);
	}
}

module.exports = ResponseContext;
