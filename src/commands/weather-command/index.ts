import { Command, ResponseContext } from "../../bot";
import * as helpers from "../../helpers";
import * as weatherFetcher from "./weather-fetcher";

/* Displays the elevation graph and length between two or more points.
   If > 2 points, then the middle ones are just 'waypoints' */
// TODO: atm waypoints (over 2 points) is supported only if the locations are given
// along with the command, like "/route place1 place2 place3"
export default class WeatherCommand extends Command {
	constructor(ctx: ResponseContext, ...args: any[]) {
		super(ctx, ...args);
	}

	async run(ctx: ResponseContext, params: string[], paramsRaw: string) {
		const location = await this.getLocation(ctx, paramsRaw);
		while (true) {
			const weatherResult = await weatherFetcher.generateReport(location);
			if (!weatherResult.success) {
				ctx.sendText(`*Error*\n${weatherResult.error.message}`);

				return;
			}

			ctx.sendText(weatherResult.payload.report);

			// TODO: support "find weather X kilometers to Y direction" commands
			break;
		}
	}

	private async getLocation(ctx: ResponseContext, parametersRaw: string) {
		let askLocationText = "Send location";

		if (parametersRaw) {
			const geocodeResult = await helpers.geocodeLocation(parametersRaw);
			if (geocodeResult.success) {
				return geocodeResult.payload.results[0];
			}

			askLocationText = "Invalid location. Please send another location";
		}

		return await helpers.askForLocation(ctx, askLocationText);
	}
}
