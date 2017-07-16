const { Command } = require('../../bot');
const helpers = require('../../helpers');
const weatherFetcher = require('./weather-fetcher');

/* Displays the elevation graph and length between two or more points.
   If > 2 points, then the middle ones are just 'waypoints' */
// TODO: atm waypoints (over 2 points) is supported only if the locations are given
// along with the command, like "/route place1 place2 place3"
class WeatherCommand extends Command {
	constructor(...args) {
		super(...args);
	}

	async run(ctx, params, { paramsRaw }) {
        const location = await this.getLocation(ctx, paramsRaw);
        while(true) {
			console.log(location);
            const weatherResult = await weatherFetcher.generateReport(location);
            if(!weatherResult.success) {
                ctx.sendText(
                    `*Error*\n${weatherResult.error.message}`,
                    { parse_mode: "markdown" });

                return;
            }

            ctx.sendText(
                weatherResult.payload.report,
                { parse_mode: "markdown" });

            break;
        }
	}

	async getLocation(ctx, parametersRaw) {
		let askLocationText = "Send location";

		if(parametersRaw) {
			const geocodeResult = await helpers.geocodeLocation(parametersRaw);
			if(geocodeResult.success) {
				return geocodeResult.payload.results[0];
			}

			askLocationText = "Invalid location. Please send another location";
		}

        return await helpers.askForLocation(ctx, askLocationText);
	}
}

module.exports = WeatherCommand;
