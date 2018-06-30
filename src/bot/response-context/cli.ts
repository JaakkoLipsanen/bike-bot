import { Message } from "../index";
import ResponseContext, { SendOpts, AskForMessageOpts } from "./index";
import { FN_NOT_IMPLEMENTED, NOOP } from "../../common";

const readline = require("readline").createInterface({
	input: process.stdin,
	output: process.stdout
});

const createMessage = (msg: Partial<Message>) => {
	return {
		chat: { id: "1" },
		message_id: "1",
		...msg
	};
};

export default class CliResponseContext implements ResponseContext {
	sendMessage(text: string, opts?: SendOpts): Message {
		return this.sendText(text, opts);
	}

	sendText(text: string, opts?: SendOpts): Message {
		console.log(text);
		return createMessage({ text });
	}

	// CLI doesn't support message editing, just resend the message instead
	editMessageText(message: Message, newText: string, opts?: SendOpts) {
		this.sendMessage(newText);
	}

	waitForMessage(): Promise<Message> {
		return new Promise<Message>((resolve, reject) => {
			readline.question("", (answer: string) => {
				const msg = createMessage({ text: answer });
				resolve(msg);
			});
		});
	}

	async askForMessage<T>(
		initialMessage = "Please enter message",
		opts: AskForMessageOpts<T>,
		messageUpdateType: "new" | "edit" = "new"
	): Promise<{ value: T; msg: Message }> {
		const accept = opts.accept;
		const messageSendOpts = opts.messageSendOpts;
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

	sendPhoto = FN_NOT_IMPLEMENTED;
	sendDocument = FN_NOT_IMPLEMENTED;
	sendSticker = FN_NOT_IMPLEMENTED;
	sendVideo = FN_NOT_IMPLEMENTED;
	sendChatAction = FN_NOT_IMPLEMENTED;
	sendLocation = FN_NOT_IMPLEMENTED;
	getFileLink = FN_NOT_IMPLEMENTED;
	downloadDocument = FN_NOT_IMPLEMENTED;
	listenForMessages = FN_NOT_IMPLEMENTED;
	waitForCallbackQuery = FN_NOT_IMPLEMENTED;
	update = NOOP;
}
