const Command = require('../command');
const helpers = require('../../helpers');

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

		// TODO: create graph & details (distance etc) and send it
		context.sendText(`From ${waypoints.join(" to ")}`);
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
}

module.exports = RouteCommand;
