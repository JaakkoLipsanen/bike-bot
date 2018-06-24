import ResponseContext from "./bot/response-context";
import { LatLng, AsyncResponse } from "./common";
import { Message } from "./bot/index";
import * as googleMaps from "@google/maps";

// defines tg bot opts for (non-inline) keyboard layout with location request
const LocationMessageSendOpts = {
	reply_markup: {
		resize_keyboard: true,
		one_time_keyboard: true,
		keyboard: [[{ text: "Current Location", request_location: true }]]
	}
};

export const gmapsClient = googleMaps.createClient({
	key: process.env.GMAPS_API_KEY,
	Promise: Promise
});

export const askForLocation = async (context: ResponseContext, initialMessage = "Enter location") => {
	const { value } = await context.askForMessage<LatLng>(initialMessage, {
		messageSendOpts: LocationMessageSendOpts,
		accept: async (msg: Message, reject) => {
			if (msg.location) {
				const { latitude, longitude } = msg.location;
				return { lat: latitude, lng: longitude };
			} else if (msg.text) {
				// location like "Helsinki"
				// TODO: this doesn't really need to be geocoded.
				// gmaps directions api works with strings as well.
				// but with geocoding, the invalid address is found immediately
				// (and there is options to select if many results!!!)
				const result = await geocodeLocation(msg.text);
				if (result.success) {
					// TODO: if there is more than one result, then show an inline
					// button with all the choices instead of defaulting to the first one
					return result.payload.results[0];
				}

				return reject(result.error.message);
			}

			return reject("Invalid message. Please send location or address");
		}
	});

	return value;
};

export const geocodeLocation = async (query: string): AsyncResponse<{ results: LatLng[] }> => {
	const response = await gmapsClient
		.geocode({
			address: query
			//	TODO: set region or language? maybe based on info from
			//	tg.chat or based on start point or based on previous queries?
		})
		.asPromise();

	const payload = response.json;
	if (response.status != 200) {
		// TODO: .error_message is long and bloated, maybe make a inline
		// button which whem clicked shows the error message?
		return {
			success: false,
			error: {
				message: `Something went wrong: ${payload.error_message}` + "\n\nPlease try again"
			}
		};
	}

	const results: { geometry: { location: LatLng } }[] = payload.results;
	if (payload.status === "ZERO_RESULTS" || results.length === 0) {
		return {
			success: false,
			error: { message: "No results found for that address. Try another one" }
		};
	} else if (payload.status !== "OK") {
		return {
			success: false,
			error: { message: `Something went wrong with status '${payload.status}'` }
		};
	}

	// TODO: should this return other info as well?
	// for example, .geometry has formatted_location, bounds etc
	return { success: true, payload: { results: results.map(r => r.geometry.location) } };
};

export const calculateDistance = (_from: LatLng, _to: LatLng) => {
	const ToRadMultiplier = 0.0174532925;

	const from = { lat: Number(_from.lat), lng: Number(_from.lng) };
	const to = { lat: Number(_to.lat), lng: Number(_to.lng) };

	// haversine formula
	const dLng = (to.lng - from.lng) * ToRadMultiplier;
	const dLat = (to.lat - from.lat) * ToRadMultiplier;

	const a =
		Math.pow(Math.sin(dLat / 2), 2) +
		Math.cos(from.lat * ToRadMultiplier) *
			Math.cos(to.lat * ToRadMultiplier) *
			Math.pow(Math.sin(dLng / 2), 2);

	const c = 2 * Math.asin(Math.sqrt(a));
	const radius = 6371; // earth radius in km

	return radius * c;
};

export const calculateDirection = (_from: LatLng, _to: LatLng): string => {
	const ToRadMultiplier = 0.0174532925;
	const rad = (deg: number) => deg * ToRadMultiplier;
	const deg = (rad: number) => rad / ToRadMultiplier;

	const from = { lat: Number(_from.lat), lng: Number(_from.lng) };
	const to = { lat: Number(_to.lat), lng: Number(_to.lng) };

	const dLng = rad(to.lng - from.lng);
	const x = Math.sin(dLng) * Math.cos(rad(to.lat));
	const y =
		Math.cos(rad(from.lat)) * Math.sin(rad(to.lat)) -
		Math.sin(rad(from.lat)) * Math.cos(rad(to.lat)) * Math.cos(dLng);

	const initialBearing = deg(Math.atan2(x, y));
	const compassBearing = (360 + initialBearing) % 360;

	const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW", "N"];
	const index = Math.round(compassBearing / 45);
	return directions[index];
};
