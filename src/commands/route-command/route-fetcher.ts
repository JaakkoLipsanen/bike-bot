import { gmapsClient } from "../../helpers";
import { LatLng, Location, AsyncResponse } from "../../common";
const ELEVATION_SAMPLES: 512 = 512; // less samples means less accurate ascent/descent

export interface ElevationData {
	points: { elevation: number; distance: number; location: LatLng }[];
	ascent: number;
	descent: number;
}

export interface Route {
	distance: number;
	overviewPolyline: string;
	elevationData: ElevationData;
	mapImageLink: string;
}

interface GmapsRoute {
	overview_polyline: { points: string };
	legs: { distance: { value: number } }[];
}

interface GmapsDirectionsResponse {
	error_message?: string;
	status: string;
	routes: GmapsRoute[];
}

export const getRouteFrom = async (waypoints: Location[]): AsyncResponse<{ routes: Route[] }> => {
	let result = await queryRoutes(waypoints, "bicycling");
	if (!result.success && result.error.type === "zero-results") {
		result = await queryRoutes(waypoints, "walking");
	}

	if (!result.success) {
		return result;
	}

	// TODO: should this return other info as well?
	// for example, .geometry has formatted_location, bounds etc
	return { success: true, payload: { routes: await createRoutes(result.payload.routes) } };
};

const queryRoutes = async (
	waypoints: Location[],
	mode: "bicycling" | "walking"
): AsyncResponse<{ routes: GmapsRoute[] }> => {
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
		units: "metric"
	};

	const response = await gmapsClient.directions(query).asPromise();
	const payload: GmapsDirectionsResponse = response.json;

	if (response.status != 200) {
		// TODO: .error_message is long and bloated, maybe make a inline
		// button which whem clicked shows the error message?
		return {
			success: false,
			error: {
				type: "unknown",
				message: `Something went wrong: ${payload.error_message}` + "\n\nPlease try again"
			}
		};
	}

	const routes = payload.routes;
	if (payload.status === "ZERO_RESULTS" || routes.length === 0) {
		return {
			success: false,
			error: { type: "zero-results", message: "No results found" }
		};
	} else if (payload.status !== "OK") {
		return {
			success: false,
			error: {
				type: "unknown",
				message: `Something went wrong with status '${payload.status}'`
			}
		};
	}

	return { success: true, payload: { routes } };
};

const createRoutes = async (gmapsRoutes: GmapsRoute[]) => {
	let routes: Route[] = [];
	for (const r of gmapsRoutes) {
		routes.push(await createRoute(r));
	}

	return routes;
};

const createRoute = async (gmapsRoute: GmapsRoute): Promise<Route> => {
	const polyline = gmapsRoute.overview_polyline.points;
	const elevationData = await getElevationDataFrom(polyline);
	const distance = gmapsRoute.legs.reduce((total, leg) => total + leg.distance.value, 0) / 1000;

	return {
		distance: distance,
		overviewPolyline: polyline,
		elevationData: elevationData,
		mapImageLink: createGmapsImageLink(polyline)
	};
};

const getElevationDataFrom = async (polyline: string): Promise<ElevationData> => {
	const elevationResponse = await gmapsClient
		.elevationAlongPath({
			path: polyline,
			samples: ELEVATION_SAMPLES
		})
		.asPromise();

	const payload = elevationResponse.json;
	if (elevationResponse.status != 200 || payload.status !== "OK") {
		console.error(`Something went wrong with getElevationDataFrom`, elevationResponse.status);
		return { ascent: 0, descent: 0, points: [] };
	}

	// array of { elevation, location: { lat, lon } }
	const elevationPoints = payload.results;
	const ascentData = calculateAscentDescentData(elevationPoints);

	return { points: elevationPoints, ...ascentData };
};

const createGmapsImageLink = (polyline: string) =>
	// TODO: scale=2, causes the image to be double size. Maybe add an "low-quality"/"high-quality" toggle?
	`https://maps.googleapis.com/maps/api/staticmap?size=640x640&scale=2&path=weight:3%7Cenc:${polyline}`;

const calculateAscentDescentData = (elevationPoints: { elevation: number }[]) => {
	let ascent = 0;
	let descent = 0;

	for (let i = 1; i < elevationPoints.length; i++) {
		const currPoint = elevationPoints[i];
		const prevPoint = elevationPoints[i - 1];

		if (currPoint.elevation > prevPoint.elevation) {
			ascent += currPoint.elevation - prevPoint.elevation;
		} else {
			descent += prevPoint.elevation - currPoint.elevation;
		}
	}

	return { ascent, descent };
};
