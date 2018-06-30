import fetch, { Response } from "node-fetch";
import { Message, CallbackQuery, Chat, Document } from "../index";
import ResponseContext, { SendOpts, AskForMessageOpts, UpdateResponseContext } from "./index";

type MessageListener = { (msg: Message): void };
type Resolvable<T> = { resolve: (value: T) => void };

const addDefaultSendOpts = (sendOpts?: SendOpts) => {
	sendOpts = { parse_mode: "markdown", ...sendOpts };
	if (sendOpts.reply_markup) {
		sendOpts.reply_markup = { hide_keyboard: true, ...sendOpts.reply_markup };
	}

	return sendOpts;
};

export default class TelegramResponseContext implements ResponseContext {
	private _messageWaitQueue: Resolvable<Message>[] = [];
	private _callbackQueryWaitQueue: Resolvable<CallbackQuery>[] = [];
	private _messageListener: MessageListener | null = null;

	public readonly bot: any;
	public readonly chat: Chat;

	constructor(bot: any, chat: Chat) {
		this.bot = bot;
		this.chat = chat;
	}

	sendMessage(text: string, opts?: SendOpts): Message {
		return this.sendText(text, addDefaultSendOpts(opts));
	}

	sendText(text: string, opts?: SendOpts): Message {
		return this.bot.sendMessage(this.chat.id, text, addDefaultSendOpts(opts));
	}

	sendPhoto(image: Buffer | string, opts?: SendOpts): Message {
		return this.bot.sendPhoto(this.chat.id, image, addDefaultSendOpts(opts));
	}

	sendDocument(doc: Buffer, opts?: SendOpts, fileOpts?: object): Message {
		return this.bot.sendDocument(this.chat.id, doc, addDefaultSendOpts(opts), fileOpts);
	}

	sendSticker(sticker: string, opts?: SendOpts): Message {
		return this.bot.sendSticker(this.chat.id, sticker, addDefaultSendOpts(opts));
	}

	sendVideo(video: Buffer, opts?: SendOpts): Message {
		return this.bot.sendVideo(this.chat.id, video, addDefaultSendOpts(opts));
	}

	sendChatAction(action: never, opts?: SendOpts): Message {
		return this.bot.sendChatAction(this.chat.id, action, addDefaultSendOpts(opts));
	}

	sendLocation(location: never, opts?: SendOpts): Message {
		return this.bot.sendLocation(this.chat.id, location, addDefaultSendOpts(opts));
	}

	editMessageText(message: Message, newText: string, opts?: SendOpts) {
		return this.bot.editMessageText(newText, {
			chat_id: message.chat.id,
			message_id: message.message_id,
			...addDefaultSendOpts(opts)
		});
	}

	async getFileLink(document: Document) {
		return await this.bot.getFileLink(document.file_id);
	}

	async downloadDocument(document: Document): Promise<Response> {
		const link = await this.getFileLink(document);
		const file = await fetch(link);
		return file;
	}

	waitForMessage(): Promise<Message> {
		return new Promise(resolve => {
			this._messageWaitQueue.push({ resolve: resolve });
		});
	}

	async listenForMessages(callback: (msg: Message, stopCallback: () => void) => void) {
		return new Promise<void>(resolve => {
			const listener = (msg: Message) => {
				const stopCallback = () => {
					resolve();
					this._messageListener = null;
				};
				callback(msg, stopCallback);
			};

			this._messageListener = listener;
		});
	}

	// TODO: callbacks should probably be global? so that even if new commandInfo
	// is started, the old callback buttons would work. although, that causes
	// memory leak since all old commands would just wait :/ well whatever,
	// I think it should be fine that it isn't global
	// TODO: but at very least, this should only work for inline buttons made
	// by the command that owns this response-context. so the inline button
	// creation should probably be wrapped into here?
	waitForCallbackQuery(): Promise<CallbackQuery> {
		return new Promise(resolve => {
			this._callbackQueryWaitQueue.push({ resolve: resolve });
		});
	}

	async askForMessage<T>(
		initialMessage = "Please enter message",
		opts: AskForMessageOpts<T>,
		messageUpdateType: "new" | "edit" = "new"
	): Promise<{ value: T; msg: Message }> {
		const accept = opts.accept;
		const messageSendOpts = addDefaultSendOpts(opts.messageSendOpts);
		let messageToShow = initialMessage;

		const REJECT_VAL = Symbol();
		const rejectCallback = (rejectionMessage: string) => {
			messageToShow = rejectionMessage;
			return REJECT_VAL;
		};

		const firstMessage = await this.sendText(messageToShow, messageSendOpts);
		while (true) {
			const msg = await this.waitForMessage();
			const value: T | symbol = await accept(msg, rejectCallback);

			if (typeof value !== "symbol") {
				return { value: value, msg: msg };
			}

			if (messageUpdateType === "edit") {
				this.editMessageText(firstMessage, messageToShow);
			} else {
				this.sendText(messageToShow, messageSendOpts);
			}
		}
	}

	update(update: UpdateResponseContext) {
		if (update.type === "message") {
			this.addNewMessage(update.msg);
		} else {
			this.addNewCallbackQuery(update.query);
		}
	}

	// must be public for bot.js to call this
	private addNewMessage(msg: Message) {
		if (this._messageWaitQueue.length !== 0) {
			const response = this._messageWaitQueue.shift()!;
			response.resolve(msg);
		} else if (this._messageListener) {
			this._messageListener(msg);
		} else {
			// TODO: show command name on the error message?
			console.error("A new message was received but command didn't respond");
			this.sendText("A new message was received but command didn't respond");
		}
	}

	private addNewCallbackQuery(query: CallbackQuery) {
		if (this._callbackQueryWaitQueue.length === 0) {
			// TODO: show command name on the error message?
			console.error("A new callback query was received but command didn't respond");
			return;
		}

		const response = this._callbackQueryWaitQueue.shift()!;
		response.resolve(query);
	}
}
