import { Response } from "node-fetch";
import { Message, CallbackQuery, Document } from "../index";
export interface SendOpts {
	reply_markup?: object;
	parse_mode?: string;
}

export type AcceptCallback<T> = (msg: Message, reject: (str: string) => any) => Promise<T>;
export type AskForMessageOpts<T> = { accept: AcceptCallback<T>; messageSendOpts?: SendOpts };
export type UpdateResponseContext =
	| { type: "message"; msg: Message }
	| { type: "query"; query: CallbackQuery };

export default interface ResponseContext {
	sendMessage(text: string, opts?: SendOpts): Message;
	sendText(text: string, opts?: SendOpts): Message;
	sendPhoto(image: Buffer | string, opts?: SendOpts): Message;
	sendDocument(doc: Buffer, opts?: SendOpts, fileOpts?: object): Message;
	sendSticker(sticker: string, opts?: SendOpts): Message;
	sendVideo(video: Buffer, opts?: SendOpts): Message;
	sendChatAction(action: never, opts?: SendOpts): Message;
	sendLocation(location: never, opts?: SendOpts): Message;
	editMessageText(message: Message, newText: string, opts?: SendOpts): any;
	getFileLink(document: Document): Promise<any>;
	downloadDocument(document: Document): Promise<Response>;
	waitForMessage(): Promise<Message>;
	listenForMessages(callback: (msg: Message, stopCallback: () => void) => void): Promise<void>;
	waitForCallbackQuery(): Promise<CallbackQuery>;
	askForMessage<T>(
		initialMessage: string,
		opts: AskForMessageOpts<T>,
		messageUpdateType?: "new" | "edit"
	): Promise<{ value: T; msg: Message }>;
	update(update: UpdateResponseContext): void;
}
