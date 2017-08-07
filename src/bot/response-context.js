const HideKeyboardOpts = {
	reply_markup:
		JSON.stringify({
			hide_keyboard: true
		})
};

class ResponseContext {
	constructor(bot, chat) {
		this.bot = bot;
		this.chat = chat;
		this._messageWaitQueue = [];
		this._callbackQueryWaitQueue = [];
	}

	sendMessage(text, opts = HideKeyboardOpts) {
		return this.sendText(text, opts);
	}

	sendText(text, opts = HideKeyboardOpts) {
		return this.bot.sendMessage(this.chat.id, text, opts);
	}

	sendPhoto(image, opts = HideKeyboardOpts) {
		return this.bot.sendPhoto(this.chat.id, image, opts);
	}

	sendAudio(audio, opts = HideKeyboardOpts) {
		return this.bot.sendAudio(this.chat.id, audio, opts);
	}

	sendDocument(doc, opts = HideKeyboardOpts, fileOpts = { }) {
		return this.bot.sendDocument(this.chat.id, doc, opts, fileOpts);
	}

	sendSticker(sticker, opts = HideKeyboardOpts) {
		return this.bot.sendSticker(this.chat.id, sticker, opts);
	}

	sendVideo(video, opts = HideKeyboardOpts) {
		return this.bot.sendVideo(this.chat.id, video, opts);
	}

	sendVoice(voice, opts = HideKeyboardOpts) {
		return this.bot.sendVoice(this.chat.id, voice, opts);
	}

	sendChatAction(action, opts = HideKeyboardOpts) {
		this.bot.sendChatAction(this.chat.id, action, opts);
	}

	sendLocation(action, opts = HideKeyboardOpts) {
		this.bot.sendChatAction(this.chat.id, action, opts);
	}

	sendVenue(action, opts = HideKeyboardOpts) {
		this.bot.sendChatAction(this.chat.id, action, opts);
	}

	sendContact(action, opts = HideKeyboardOpts) {
		this.bot.sendChatAction(this.chat.id, action, opts);
	}

	sendGame(gameShortName, opts = HideKeyboardOpts) {
		this.bot.sendGame(this.chat.id, gameShortName, opts);
	}

	editMessageText(message, newText, opts = { }) {
		return this.bot.editMessageText(
			newText,
			{ chat_id: message.chat.id, message_id: message.message_id, ...opts }
		);
	}

	async getFileLink(document) {
		return await this.bot.getFileLink(document.file_id)
	}

	waitForMessage() {
		return new Promise(resolve => {
			this._messageWaitQueue.push({ resolve: resolve });
		});
	}

	async listenForMessages(callback) {
		return new Promise(resolve => {
			const listener = (msg) => {
				const stopCallback = () => { resolve(); this._messageListener = null; };
				callback(msg, stopCallback);
			};

			this._messageListener = listener;
		})
	}

	// TODO: callbacks should probably be global? so that even if new commandInfo
	// is started, the old callback buttons would work. although, that causes
	// memory leak since all old commands would just wait :/ well whatever,
	// I think it should be fine that it isn't global
	// TODO: but at very least, this should only work for inline buttons made
	// by the command that owns this response-context. so the inline button
	// creation should probably be wrapped into here?
	waitForCallbackQuery() {
		return new Promise(resolve => {
			this._callbackQueryWaitQueue.push({ resolve: resolve });
		});
	}

	async askForMessage(initialMessage = "Please enter message", { keyboardMarkup = HideKeyboardOpts, accept = async () => true } = {}) {
		let messageToShow = initialMessage;

		const REJECT_VAL = Symbol();
		const rejectCallback = (rejectionMessage) => { messageToShow = rejectionMessage; return REJECT_VAL; };

		while(true) {
			this.sendText(messageToShow, { reply_markup: keyboardMarkup });

			const msg = await this.waitForMessage();
			const value = await accept(msg, rejectCallback);

			if(value !== REJECT_VAL) {
				return { value: value, msg: msg };
			}
		}
	}

	_onNewMessage(msg) {
		if(this._messageWaitQueue.length !== 0) {
			const response = this._messageWaitQueue.shift();
			response.resolve(msg);
		}
		else if(this._messageListener) {
			this._messageListener(msg);
		}
		else {
			// TODO: show command name on the error message?
			console.error("A new message was received but command didn't respond");
			this.sendText("A new message was received but command didn't respond");
		}
	}

	_onNewCallbackQuery(query) {
		if(this._callbackQueryWaitQueue.length === 0) {
			// TODO: show command name on the error message?
			console.error("A new callback query was received but command didn't respond");
			return;
		}

		const response = this._callbackQueryWaitQueue.shift();
		response.resolve(query);
	}
}

module.exports = ResponseContext;
