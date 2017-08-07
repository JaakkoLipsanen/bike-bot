const path = require("path");
const fetch = require("node-fetch");
const moment = require("moment");
const stableStringify = require('json-stable-stringify');
const awsHelper = require("./aws-helper");
const {
	isValidGpsFilename,
	isValidGpsDate,
	parseDateFromGpsFilename,
	validateGpsFormat
} = require("./gps-format-helper");

const { Command } = require('../../bot');

// TODO:
// - add elevation to gps files with gmaps api
// - send stats of the uploaded days? Distance and total ascent/descent are the most interesting
// - overwrite prompt should be keyboard buttons instead of having to type "y" or "n"
// - right now, multi file uplaods are really really inefficient, loading and
//   saving the route between each file/day
class GpsCommand extends Command {
	constructor(...args) {
		super(...args);
	}

	async run(ctx, params) {
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

	async waitForUploads(ctx, tour) {
		const DoneKeyboardMarkup = {
			parse_mode: "markdown",
			reply_markup: JSON.stringify({
				resize_keyboard: true,
				one_time_keyboard: true,
				keyboard: [
					[{ text: "done" }]
				]
			})
		};

		const lastUploadedDate = await this.getLastUploadedDateOfRoute(tour);
		ctx.sendText(
			"*Upload gps files*\n" +
			(lastUploadedDate ? `_Last uploaded:_ *${lastUploadedDate}\n*` : "") +
			"_Send 'done' when finished_\n" +
			"_Change night type with 'n t' or 'n h'_",
			DoneKeyboardMarkup
		);

		const days = [];
		let currentNightType = "tent";

		const receivedDaysMessage = await ctx.sendText("_No days received yet_", { parse_mode: "markdown" });
		const updateReceivedDaysMessage = () => {
			ctx.editMessageText(
				receivedDaysMessage,
				`*Received:*\n${days.map(d => d.date).join("\n")}`, { parse_mode: "markdown" });
		};

		// on multi-file uploads, often the files come at same time so if we use
		// ctx.waitForMessage's individually, some of the files are skipped
		// because there is no active ctx.waitForMessage ongoing.
		// so lets instead use there this callback based ctx.listenForMessages
		await ctx.listenForMessages(async (msg, stopListeningCallback) => {
			if(msg.document) {
				const file = msg.document;
				if(!isValidGpsFilename(file.file_name)) {
					return ctx.sendText("Invalid filename. Please send a .txt file", DoneKeyboardMarkup);
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

					ctx.sendText("Must upload at least one route", DoneKeyboardMarkup);
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

	createDayObject(date, text, nightType) {
		const path =
			text.split("\n")
			.map(line => line.trim())
			.filter(line => line && !line.startsWith("//") && line.split(" ").length === 2)
			.map(line => {
				const coords = line.split(" ");
				return { lat: coords[0], lon: coords[1] }; // TODO: ele
			});

		return {
			night: nightType,
			path: path,
			date: date,
			rawText: text + "\n" + "night " + nightType,
			toJSON() { return { night: this.night, path: this.path } }
		};
	}

	createEmptyDayObject(date, nightType) {
		return {
			night: nightType,
			path: [],
			date: date,
			rawText: "night " + nightType,
			toJSON() { return { night: this.night, path: this.path } }
		};
	}

	async updateRoute(ctx, tour, day) {
		const route = await awsHelper.loadJsonOrEmpty(tour.routeJsonKey);

		const isOverwrite = route[day.date]; // check if the day exists already
		if(isOverwrite && (await this.askAllowOverwrite(ctx, day.date) === false)) {
			return;
		}

		route[day.date] = day;

		const text = this.generateRouteTxt(tour, route);
		await awsHelper.uploadFile(tour.routeTxtKey, text);
		await awsHelper.uploadFile(tour.routeJsonKey, stableStringify(route));

		ctx.sendText(`Success: ${day.date}`);
	}

	async rebuildTourRouteTxt(tour) {
		const route = await awsHelper.loadJsonOrEmpty(tour.routeJsonKey);
		await awsHelper.uploadFile(tour.routeTxtKey, await this.generateRouteTxt(tour, route));
	}

	generateRouteTxt(tour, route) {
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

	// TODO: create keyboard buttons instead of y/n
	async askAllowOverwrite(ctx, filename) {
		const result =
			await ctx.askForMessage(
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

	async saveRawDayRoute(tour, day) {
		await awsHelper.uploadFile(tour.routeGpsFolderKey + day.date + ".txt", day.rawText);
	}

	pathToString(path) {
		let output = "";
		return path
			.map(coord => `${coord.lat} ${coord.lon} ${coord.ele || ""}`.trim() + "\n")
			.join("");
	}

	async getLastUploadedDateOfRoute(tour) {
		const route = await awsHelper.loadJsonOrEmpty(tour.routeJsonKey);
		const keys = Object.keys(route).sort();
		return keys[keys.length - 1] || "";
	}

	async downloadFile(ctx, document) {
		const link = await ctx.getFileLink(document);
		const file = await fetch(link);
		return await file.text();
	}
}

module.exports = GpsCommand;
