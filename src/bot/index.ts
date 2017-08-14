export interface Chat {
    id: string;
}

export interface Document {
    file_name: string;
    file_id: string;
}

export interface Message {
    text?: string;
    location?: { latitude: number, longitude: number };
    document?: Document;

    chat: Chat;
    message_id: string;
}

export interface CallbackQuery {
	data: string;
}

export { default as TelegramBot } from './bot';
export { default as Command } from './command';
export { default as ResponseContext } from './response-context';
