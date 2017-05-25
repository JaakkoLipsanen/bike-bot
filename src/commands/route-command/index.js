const Command = require('../command');
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

	async run({ context, parameters }) {
		const waypoints = await this.getWaypoints(context, parameters);

		const routeResult = await this.getRouteFrom(waypoints);
		if(!routeResult.success) {
			context.sendText(routeResult.error.message);
			return;
		}

		const route = routeResult.payload.route;
		const chart = await chartRenderer.renderChart(route);

		context.sendImage(chart);
	}

	async getRouteFrom(waypoints) {
		const result = await routeFetcher.getRouteFrom(waypoints);
		if(result.success) {
			// TODO: display multiple routes? maybe show inline buttons?
			return  { success: true, payload: { route: result.payload.routes[0] } };
		}

		// TODO: this.abort(result.error.message) or something?
		return result;
	}

	// TODO: this doesnt work atm, parameters[0]/[1] should be geolocated
	async getWaypoints(ctx, parameters) {
		if(parameters.length >= 2) {
			return parameters;
		}

		const startLocation = parameters[0] || await helpers.askForLocation(ctx, "From?");
		const endLocation = await helpers.askForLocation(ctx, "To?");

		// TODO: support 'via' commands/more than 2 points
		return [startLocation, endLocation];
	}
}

module.exports = RouteCommand;
