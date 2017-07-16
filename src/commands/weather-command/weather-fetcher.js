const helpers = require('../../helpers');

const fetch = require("node-fetch");
const fetchWeather = async (location) => {
    const locationStr = `${location.lat},${location.lng}`;
    return await fetch(
        `http://api.wunderground.com/api/${process.env.WUNDERGROUND_API_KEY}` +
        `/conditions/forecast/alert/q/${locationStr}.json`
    );
}

const calculateDistance = (from, to) => {

}

module.exports = {
    async generateReport(location) {
        const response = await fetchWeather(location);
        const json = await response.json();

        if(!response.ok || json.response.error) {
            const error = json.response.error;
            if(error.type === "querynotfound") {
                return {
                    success: false,
                    error: {
                        type: "not-found",
                        message: "Location not found. Please try another one"
                    }
                };
            }

            if(error.type !== "unknownfeature") {
                return { success: false, error: { type: error.type, message: error.desription } };
            }
        }

        const current = json.current_observation;
        if(!current) {
            if(json.response.results && json.response.results.length > 0) {
                return {
                    success: false,
                    error: {
                        type: "multiple-found",
                        message: "Multiple locations found. Please be more specific"
                    }
                };
            }
            else {
                return {
                    success: false,
                    error: {
                        type: "unknown",
                        message: "Weather not founds. Try to be more specific or try another location"
                    }
                };
            }
        }

        const observationLocationCoord = {
            lat: current.observation_location.latitude,
            lng: current.observation_location.longitude
        };

        const distance = helpers.calculateDistance(location, observationLocationCoord);
        const direction = helpers.calculateDirection(location, observationLocationCoord);
        console.log(json.forecast);

        let observationLocation = current.observation_location.full.trim();
        if(observationLocation.endsWith(",")) {
            observationLocation = observationLocation.slice(0, -1);
        }

        const observationTime = current.observation_time.replace(" on ", ": ");
        const feelsLikeStr = (current.temp_c != current.feelslike_c) ?
            `(feels like ${current.feelslike_c}C)` : "";

        let report =
            `*${observationLocation}*\n` +
            `Accuracy: ${distance}km ${direction}\n` +
            `${observationTime}\n` +
            `${current.weather}, ${current.temp_c}C ${feelsLikeStr}\n` +
            `${current.wind_kph}km/h from ${current.wind_dir}, ${current.precip_today_metric}mm today\n\n`;

        const forecast = json.forecast.txt_forecast.forecastday;
        for(let i = 1; i < 8; i++) {
            report +=
                `*${forecast[i].title}:* ${forecast[i].fcttext_metric}\n`+
                `Probability for precipitation: ${forecast[i]['pop']}%\n\n`;
        }

        return { success: true, payload: { report: report } };
    }
}
