const { Command } = require('../../bot');
const helpers = require('../../helpers');

const chartRenderer = require('./chart-renderer');
const routeFetcher = require('./route-fetcher');

/* Displays the elevation graph and length between two or more points.
   If > 2 points, then the middle ones are just 'waypoints' */
// TODO: atm waypoints (over 2 points) is supported only if the locations are given
// along with the command, like "/route place1 place2 place3"
class RouteCommand extends Command {
	constructor(...args) {
		super(...args);
	}

	async run(ctx, params) {
		const waypoints = await this.getWaypoints(ctx, params);
		const routeResult = await this.getRouteFrom(waypoints);

		if(!routeResult.success) {
			ctx.sendText(routeResult.error.message);
			return;
		}

		const payload = routeResult.payload;
		await this.sendRouteInfo(ctx, payload.route, payload.otherRoutes);

		while(true) {
			const query = await ctx.waitForCallbackQuery();
			if(!query.data) continue;

			const index = parseInt(query.data);
			if(index < 0 || index >= payload.otherRoutes.length) continue;

			await this.sendRouteInfo(ctx, payload.otherRoutes[index]);
		}
	}

	async sendRouteInfo(ctx, route, otherRoutes) {
		const chart = await chartRenderer.renderChart(route);

		ctx.sendText(
			`*Distance:* ${route.distance.toFixed(1)}km\n` +
			`*Ascent/Descent:* +${Math.round(route.elevationData.ascent)}m/-${Math.round(route.elevationData.descent)}m`,
			{ parse_mode: "markdown" });

		ctx.sendPhoto(chart);
		ctx.sendPhoto(
			route.mapImageLink,
			otherRoutes ? this.createAlternativeRoutesReplyMarkup(otherRoutes) : undefined);
	}

	async getRouteFrom(waypoints) {
		const result = await routeFetcher.getRouteFrom(waypoints);
		if(result.success) {
			// TODO: display multiple routes? maybe show inline buttons?
			return  {
				success: true,
				payload: {
					route: result.payload.routes[0],
					otherRoutes: result.payload.routes.slice(1)
				}
			};
		}

		// TODO: this.abort(result.error.message) or something?
		return result;
	}

	async getWaypoints(ctx, parameters) {
		if(parameters.length >= 2) {
			return parameters;
		}

		const startLocation = parameters[0] || await helpers.askForLocation(ctx, "From?");
		const endLocation = await helpers.askForLocation(ctx, "To?");

		// TODO: support 'via' commands/more than 2 points
		return [startLocation, endLocation];
	}

	createAlternativeRoutesReplyMarkup(alternativeRoutes) {
		const buttonText = alternativeRoutes.length <= 2 ?
			"Alternative route " :
			(alternativeRoutes.length <= 4 ? "Alt route " : "");

		return {
			reply_markup: {
				inline_keyboard: [
					alternativeRoutes.map((r, i) =>
						({
							text: `${buttonText} ${i+1}`,
							callback_data: i.toString()
						})
					)
				]
			}
		};
	}
}

module.exports = RouteCommand;
