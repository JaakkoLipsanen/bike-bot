const util = require("util");
const S3_Client = require("aws-sdk/clients/s3");

const s3 = {
    client: new S3_Client({
    	apiVersion: "2006-03-01",
    	params: {
    		Bucket: "flai"
    	}
    })
};

s3.api = {
    getObject: util.promisify(s3.client.getObject.bind(s3.client)),
    headObject: util.promisify(s3.client.headObject.bind(s3.client)),
    listObjectsV2: util.promisify(s3.client.listObjectsV2.bind(s3.client)),
    upload: util.promisify(s3.client.upload.bind(s3.client))
}

module.exports = {
    async loadTextFile(key) {
        try {
            const file = await s3.api.getObject({ Key: key });
            return file.Body.toString();
        }
        catch(err) {
            throw new Error(`Error loading ${key} from AWS (${err.code}):\n${err.message}`);
        }
    },

    async loadJson(key) {
        const text = await this.loadTextFile(key);
        return JSON.parse(text);
    },

    // TODO: could just load it and check if error is NoSuchKey
    async loadJsonOrEmpty(key) {
        if(await this.fileExists(key)) {
            return await this.loadJson(key);
        }

        return { };
    },

    async uploadFile(key, stream) {
        try {
            await s3.api.upload({ Key: key, Body: stream });
        }
        catch(err) {
            throw new Error(`Error uploading ${key} to AWS (${err.code}):\n${err.message}`);
        }
    },

    async fileExists(key) {
        try {
            await s3.api.headObject({ Key: key });
            return true;
        }
        catch(err) {
            return false;
        }
    },

    async listFiles(prefix) {
        try {
            const result = await s3.api.listObjectsV2({ Prefix: prefix });
            return result.Contents.map(c => ({ key: c.Key, size: c.Size }));
        }
        catch(err) {
            throw new Error(
                `Error listing files with '${prefix}' prefix in AWS (${err.code}):\n${err.message}`);
        }
    },

    async getCurrentTour() {
        const tourData = await this.loadJson("cycle/tours.json");
        const currentTour = tourData.tours[tourData.currentTour];
        return {
            ...currentTour,
            routeJsonKey: this.getTourRouteFolder(currentTour) + "/route.json",
            routeTxtKey: this.getTourRouteFolder(currentTour) + "/route.txt",
            routeGpsFolderKey: this.getTourRouteFolder(currentTour) + "/days/",
        };
    },

    getTourRouteFolder(tour) {
        return `cycle/routes/${tour.directoryName}`;
    }
};
