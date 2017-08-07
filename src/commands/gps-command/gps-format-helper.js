const path = require("path");
const moment = require("moment");

module.exports = {
    isValidGpsFilename(filename) {
        const parsed = path.parse(filename);
        const isValidDate = moment(parsed.name, "YYYYMMDD", true).isValid();
        const isValidExtension = parsed.ext === ".txt";

        return isValidDate && isValidExtension;
    },

    isValidGpsDate(text) {
        return moment(text, "YYYYMMDD", true).isValid();
    },

    parseDateFromGpsFilename(filename) {
        const parsed = path.parse(filename);
        return parsed.name;
    },
    
    validateGpsFormat(text) {
        const lines = text.split("\n").map(line => line.trim());

        const isCoordinates = (str) =>
            str.split(' ').length === 2 &&
            str.split(' ').every(coord => !isNaN(coord));

        return lines.every(line => line.length === 0 || isCoordinates(line));
    }
}
