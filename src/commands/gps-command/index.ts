import fetch from "node-fetch";
import * as moment from "moment";
import * as stableStringify from 'json-stable-stringify';
import * as awsHelper from "../../aws-helper";
import {
	isValidGpsFilename,
	isValidGpsDate,
	parseDateFromGpsFilename,
	validateGpsFormat
} from "./gps-format-helper";

import { Command } from '../../bot';
import ResponseContext from '../../bot/response-context';
import { SendOpts } from '../../bot/response-context';
import { LatLng, LatLngEle } from '../../common';
import { TourInfo } from '../../aws-helper';
import { Document } from '../../bot/index';

type NightType = "tent" | "hotel";

interface Day {
	night: NightType,
	path: LatLngEle[],
	date: string,
	rawText: string,
	toJSON?: () => void;
}

interface RouteFile {
	[key: string]: { night: NightType; path: LatLngEle[] };
}

// TODO:
// - add elevation to gps files with gmaps api
// - send stats of the uploaded days? Distance and total ascent/descent are the most interesting
// - overwrite prompt should be keyboard buttons instead of having to type "y" or "n"
// - add /gps get-route or something to download the route.json or route.txt (for debugging)
// - right now, multi file uplaods are really really inefficient, loading and
//   saving the route between each file/day
export default class GpsCommand extends Command {
	constructor(ctx: ResponseContext, ...args: any[]) {
		super(ctx, ...args);
	}

	async run(ctx: ResponseContext, params: string[]) {
		const tour = await awsHelper.getCurrentTour();
		if(params.length > 0) {
			if(params[0] === "rebuild") {
				ctx.sendText(`Rebuilding route.txt...`);
				await this.rebuildTourRouteTxt(tour);
				ctx.sendText("Success!");

				return;
			}

			ctx.sendText("Unrecognized params, only '/gps rebuild' is supported");
		}

		const uploadedDays = await this.waitForUploads(ctx, tour);
		for(const day of uploadedDays) {
			await this.updateRoute(ctx, tour, day);
			await this.saveRawDayRoute(tour, day);
		}

		ctx.sendText("Done!");
	}

	private async waitForUploads(ctx: ResponseContext, tour: TourInfo) {
		const DoneMessageSendOpts: SendOpts = {
			reply_markup: {
				resize_keyboard: true,
				one_time_keyboard: true,
				keyboard: [
					[{ text: "done" }]
				]
			}
		};

		const lastUploadedDate = await this.getLastUploadedDateOfRoute(tour);
		ctx.sendText(
			"*Upload gps files*\n" +
			(lastUploadedDate ? `_Last uploaded:_ *${lastUploadedDate}\n*` : "") +
			"_Send 'done' when finished_\n" +
			"_Change night type with 'n t' or 'n h'_",
			DoneMessageSendOpts
		);

		const days: Day[] = [];
		let currentNightType: NightType = "tent";

		const receivedDaysMessage = await ctx.sendText("_No days received yet_");
		const updateReceivedDaysMessage = () => {
			ctx.editMessageText(
				receivedDaysMessage,
				`*Received:*\n${days.map(d => d.date).join("\n")}`);
		};

		// on multi-file uploads, often the files come at same time so if we use
		// ctx.waitForMessage's individually, some of the files are skipped
		// because there is no active ctx.waitForMessage ongoing.
		// so lets instead use there this callback based ctx.listenForMessages
		await ctx.listenForMessages(async (msg, stopListeningCallback) => {
			if(msg.document) {
				const file = msg.document;
				if(!isValidGpsFilename(file.file_name)) {
					return ctx.sendText("Invalid filename. Please send a .txt file", DoneMessageSendOpts);
				}

				const routeText = await this.downloadFile(ctx, file);
				if(!validateGpsFormat(routeText)) {
					return ctx.sendText(`File '${file.file_name} has invalid format. Make sure file contains only coordinate pairs`);
				}

				const date = parseDateFromGpsFilename(file.file_name);
				days.push(this.createDayObject(date, routeText, currentNightType));

				updateReceivedDaysMessage();
			}
			else if(msg.text) {
				const text = msg.text.toLowerCase();
				if(text.toLowerCase() === "done") {
					if(days.length > 0) {
						return stopListeningCallback();
					}

					ctx.sendText("Must upload at least one route", DoneMessageSendOpts);
				}
				else if(text.startsWith("n ")) {
					const nightType = text.split(" ")[1];
					if(nightType) {
						if(nightType === "h" || nightType === "t") {
							currentNightType = (nightType === "h") ? "hotel" : "tent";
							ctx.sendText(`Night type changed to '${currentNightType}'`);
						}
					}
				}
				// empty night
				else if(isValidGpsDate(text)) {
					days.push(this.createEmptyDayObject(text, currentNightType));
					updateReceivedDaysMessage();
				}
				else {
					ctx.sendText("Unrecognized text");
				}
			}
		});

		return days;
	}

	private async updateRoute(ctx: ResponseContext, tour: TourInfo, day: Day) {
		const route: RouteFile = await awsHelper.loadJsonOrEmpty(tour.aws.routeJsonKey);

		const isOverwrite = Boolean(route[day.date]); // check if the day exists already
		if(isOverwrite && (await this.askAllowOverwrite(ctx, day.date) === false)) {
			return;
		}

		route[day.date] = day;

		const text = this.generateRouteTxt(tour, route);
		await awsHelper.uploadFile(tour.aws.routeTxtKey, text);
		await awsHelper.uploadFile(tour.aws.routeJsonKey, stableStringify(route));

		ctx.sendText(`Success: ${day.date}`);
	}

	private async saveRawDayRoute(tour: TourInfo, day: Day) {
		await awsHelper.uploadFile(tour.aws.routeGpsFolderKey + day.date + ".txt", day.rawText);
	}

	private async rebuildTourRouteTxt(tour: TourInfo) {
		const route = await awsHelper.loadJsonOrEmpty(tour.aws.routeJsonKey);
		await awsHelper.uploadFile(tour.aws.routeTxtKey, await this.generateRouteTxt(tour, route));
	}

	// TODO: create keyboard buttons instead of y/n
	private async askAllowOverwrite(ctx: ResponseContext, filename: string) {
		const result =
			await ctx.askForMessage<"y" | "n">(
				`Day ${filename} exists, overwrite (y/n)?`,
				{
					accept: (msg, reject) => {
						if(msg.text && (msg.text.toLowerCase() === "y" || msg.text.toLowerCase() === "n")) {
							return msg.text.toLowerCase();
						}

						return reject("Send either 'y' or 'n' to continue");
					}
				}
			);

		return result.value === "y";
	}

	private generateRouteTxt(tour: TourInfo, route: RouteFile) {
		const dates = Object.keys(route).sort();
		const startDate = moment(tour.startDate, "DD.MM.YYYY");

		let output = `// route for ${tour.name}, generated from route.json\n`;
		let previousDate = startDate;
		for(const dateKey of dates) {
			const dayObject = route[dateKey];
			const date = moment(dateKey, "YYYYMMDD");

			const daysBetween = date.diff(previousDate, 'days');

			output += "\nnight tent".repeat(Math.max(0, daysBetween - 1));
			output += `\n// ${dateKey}\n`;
			output += this.pathToString(dayObject.path);
			output += `night ${dayObject.night}\n`;

			previousDate = date;
		}

		return output;
	}

	private pathToString(path: LatLngEle[]) {
		return path
			.map(coord => `${coord.lat} ${coord.lng} ${coord.ele || ""}`.trim() + "\n")
			.join("");
	}

	private createDayObject(date: string, text: string, nightType: NightType): Day {
		const path: LatLng[] =
			text.split("\n")
			.map(line => line.trim())
			.filter(line => line && !line.startsWith("//") && line.split(" ").length === 2)
			.map(line => {
				const coords = line.split(" ");
				return { lat: Number(coords[0]), lng: Number(coords[1]) }; // TODO: ele
			});

		return {
			night: nightType,
			path,
			date,
			rawText: text + "\n" + "night " + nightType,
			toJSON: () => ({ night: nightType, path: path })
		};
	}

	private createEmptyDayObject(date: string, nightType: NightType): Day {
		return {
			night: nightType,
			path: [],
			date: date,
			rawText: "night " + nightType,
			toJSON() { return { night: this.night, path: this.path } }
		};
	}

	private async getLastUploadedDateOfRoute(tour: TourInfo) {
		const route = await awsHelper.loadJsonOrEmpty(tour.aws.routeJsonKey);
		const keys = Object.keys(route).sort();
		return keys[keys.length - 1] || "";
	}

	private async downloadFile(ctx: ResponseContext, document: Document) {
		const link = await ctx.getFileLink(document);
		const file = await fetch(link);
		return await file.text();
	}
}