const { gmapsClient } = require('../../helpers');
const ELEVATION_SAMPLES = 512; // less samples means less accurate ascent/descent

module.exports = {
	async getRouteFrom(waypoints) {
		let result = await this._queryRoutes(waypoints, "bicycling");
		if(!result.success && result.error.type === "zero-results") {
			result = await this._queryRoutes(waypoints, "walking");
		}

		if(!result.success) {
			return result;
		}

		// TODO: should this return other info as well?
		// for example, .geometry has formatted_location, bounds etc
		return { success: true, payload: { routes: await this._createRoutes(result.payload.routes) } };
	},

	async _queryRoutes(waypoints, mode) {

		// TODO: if the origin/destination are in a country that doesn't support
		// mode: "bicycling", then ZERO_RESULTS status is returned along with
		// available_travel_modes: [DRIVING, WALKING etc]. TODO MUST FIX !!!
		const query = {
			origin: waypoints[0],
			destination: waypoints[waypoints.length - 1],
			waypoints: waypoints.slice(1, waypoints.length - 1),
			mode: mode,
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
					type: "unknown",
					message:
						`Something went wrong: ${payload.error_message}` +
						"\n\nPlease try again"
				}
			};
		}

		const routes = payload.routes;
		if(payload.status === 'ZERO_RESULTS' || routes.length === 0) {
			return {
				success: false,
				error: { type: "zero-results", message: "No results found" }
			};
		}
		else if(payload.status !== 'OK') {
			return {
				success: false,
				error: {
					type: "unknown",
					message: `Something went wrong with status '${payload.status}'`
				}
			};
		}

		return { success: true, payload: { routes: routes } };
	},

	async _createRoutes(results) {
		let routes = [];
		for(const r of results) {
			routes.push(await this._createRoute(r));
		}

		return routes;
	},

	async _createRoute(result) {
		const polyline = result.overview_polyline.points;
		const elevationData = await this._getElevationDataFrom(polyline);
		const distance = result.legs.reduce((total, leg) => total + leg.distance.value, 0) / 1000;

		return {
			distance: distance,
			overviewPolyline: polyline,
			elevationData: elevationData,
			mapImageLink: this._createGmapsImageLink(polyline),
		};
	},

	async _getElevationDataFrom(polyline) {
		const elevationResponse = await gmapsClient.elevationAlongPath({
			path: polyline,
			samples: ELEVATION_SAMPLES,
		}).asPromise();

		const payload = elevationResponse.json;
		if(elevationResponse.status != 200 || payload.status !== 'OK') {
			console.error(`Something went wrong with getElevationDataFrom`, elevationResponse.status);
			return { ascent: 0, descent: 0, points: [] };
		}

		// array of { elevation, location: { lat, lon } }
		const elevationPoints = payload.results;
		const ascentData = this._calculateAscentDescentData(elevationPoints);

		return { points: elevationPoints, ascent: ascentData.ascent, descent: ascentData.descent };
	},

	_createGmapsImageLink(polyline) {
		// TODO: scale=2, causes the image to be double size. Maybe add an "low-quality"/"high-quality" toggle?
		return `https://maps.googleapis.com/maps/api/staticmap?size=640x640&scale=2&path=weight:3%7Cenc:${polyline}`;
	},

	_calculateAscentDescentData(elevationPoints) {
		let ascent = 0;
		let descent = 0;

		for(let i = 1; i < elevationPoints.length; i++) {
			const currPoint = elevationPoints[i];
			const prevPoint = elevationPoints[i - 1];

			if(currPoint.elevation > prevPoint.elevation) {
				ascent += currPoint.elevation - prevPoint.elevation;
			}
			else {
				descent += prevPoint.elevation - currPoint.elevation;
			}

		}

		return { ascent, descent };
	}
};
