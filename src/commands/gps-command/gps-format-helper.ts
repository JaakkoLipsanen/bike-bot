import * as path from "path";
import * as moment from "moment";

export const isValidGpsFilename = (filename: string) => {
	const parsed = path.parse(filename);
	const isValidDate = moment(parsed.name, "YYYYMMDD", true).isValid();
	const isValidExtension = parsed.ext === ".txt";

	return isValidDate && isValidExtension;
};

export const isValidGpsDate = (text: string) => {
	return moment(text, "YYYYMMDD", true).isValid();
};

export const parseDateFromGpsFilename = (filename: string) => {
	const parsed = path.parse(filename);
	return parsed.name;
};

export const validateGpsFormat = (text: string) => {
	const lines = text.split("\n").map(line => line.trim());

	const isCoordinates = (str: string) =>
		str.split(" ").length === 2 &&
		str
			.split(" ")
			.map(str => str.replace(",", "."))
			.every(coord => !isNaN(Number(coord)));

	return lines.every(line => line.length === 0 || isCoordinates(line));
};
