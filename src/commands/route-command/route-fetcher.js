const { gmapsClient } = require('../../helpers');

module.exports = {
	async getRouteFrom(waypoints) {
	//	assert(waypoints.length >= 2);

		// TODO: if the origin/destination are in a country that doesn't support
		// mode: "bicycling", then ZERO_RESULTS status is returned along with
		// available_travel_modes: [DRIVING, WALKING etc]. TODO MUST FIX !!!
		const query = {
			origin: waypoints[0],
			destination: waypoints[waypoints.length - 1],
			waypoints: waypoints.slice(1, waypoints.length - 1),
			mode: "bicycling",
			alternatives: true, // can return more than one path
			avoid: ["highways"],
			units: "metric",
		};

		const response = await gmapsClient.directions(query).asPromise();
		const payload = response.json;

		if(response.status != 200) {
			// TODO: .error_message is long and bloated, maybe make a inline
			// button which whem clicked shows the error message?
			return {
				success: false,
				error: {
					message:
						`Something went wrong: ${payload.error_message}` +
						"\n\nPlease try again"
				}
			};
		}

		const results = payload.routes;
		if(payload.status === 'ZERO_RESULTS' || results.length === 0) {
			return {
				success: false,
				error: { message: "No results found" }
			};
		}
		else if(payload.status !== 'OK') {
			return {
				success: false,
				error: { message: `Something went wrong with status '${payload.status}'` }
			};
		}

		// TODO: should this return other info as well?
		// for example, .geometry has formatted_location, bounds etc
		return { success: true, payload: { routes: await this._createRoutes(results) } };
	},

	async _createRoutes(results) {
		let routes = [];
		for(const r of results) {
			routes.push(await this._createRoute(r));
		}

		return routes;
	},

	async _createRoute(result) {
		const points = [];
		let totalDistance = 0; // in meters

		for(const leg of result.legs) {
			let tempTotalDistance = totalDistance;
			for(const step of leg.steps) {
				const location = step.end_location || step.start_location;
				const point = { distance: tempTotalDistance, location: location };

				points.push(point);
				tempTotalDistance += step.distance.value;
			}

			// don't use tempTotalDistance, since there will be some rounding
			// errors. Not that it really matters :P
			totalDistance += leg.distance.value;
		}

		return {
			distance: totalDistance,
			points: points,
			elevationData: await this._getElevationDataFrom(points.map(p => p.location))
		};
	},

	async _getElevationDataFrom(points) {
		const elevationResponse = await gmapsClient.elevationAlongPath({
			path: points,
			samples: 512,
		}).asPromise();

		const payload = elevationResponse.json;
		if(elevationResponse.status != 200 || payload.status !== 'OK') {
			console.error(`Something went wrong with getElevationDataFrom ${payload && payload.error_message}`);
			return [];
		}

		// array of { elevation, location: { lat, lon } }
		return payload.results;
	}
};
