// defines tg bot opts for (non-inline) keyboard layout with location request
const LocationKeyboardMarkup =
	JSON.stringify({
		resize_keyboard: true,
		one_time_keyboard: true,
		keyboard: [
			[{ text: "Current Location", request_location: true }]
		]
	});

module.exports = {
	// returns { latitude, longitude } or string containing the location
	async askForLocation(context, initialMessage = "Enter location") {

		let messageToShow = initialMessage;
		while(true) {
			const opts = { reply_markup: LocationKeyboardMarkup };
			context.sendText(messageToShow, opts);

			const msg = await context.waitForResponse();
			if(msg.location) {
				return msg.location; // { latitude, longitude }
			}
			else if(msg.text) { // location like "Helsinki"
				return msg.text;
			}
			else {
				messageToShow = "Invalid location. Please send location again";
			}
		}
	}
};
