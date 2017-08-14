import * as S3_Client from "aws-sdk/clients/s3";

const s3 = new S3_Client({
    apiVersion: "2006-03-01"
});

// Bucket could be given when creating the client, but the type definitions  for API calls
// demand Bucket property to exist :/// but yea otherwise this is not needed
const DefaultParams = { Bucket: "flai" };

interface BaseTourInfo {
    name: string;
    directoryName: string;
    year: number;
    startDate: string; // "DD.MM.YYYY"
    description: string;
}

export interface TourInfo extends BaseTourInfo {
    aws: {
        routeJsonKey: string;
        routeTxtKey: string;
        routeGpsFolderKey: string;
    }
}

export const loadTextFile = async (key: string) => {
    try {
        const file = await s3.getObject({ ...DefaultParams, Key: key }).promise();
        return (file.Body || "").toString();
    }
    catch(err) {
        throw new Error(`Error loading ${key} from AWS (${err.code}):\n${err.message}`);
    }
};

export const loadJson = async (key: string) => {
    const text = await loadTextFile(key);
    return JSON.parse(text);
};

// TODO: could just load it and check if error is NoSuchKey
export const loadJsonOrEmpty = async (key: string) => {
    if(await fileExists(key)) {
        return await loadJson(key);
    }

    return { };
};

export const uploadFile = async (key: string, stream: string) => {
    try {
        await s3.upload({ ...DefaultParams, Key: key, Body: stream }).promise();
    }
    catch(err) {
        throw new Error(`Error uploading ${key} to AWS (${err.code}):\n${err.message}`);
    }
};

export const fileExists = async (key: string) => {
    try {
        await s3.headObject({ ...DefaultParams, Key: key }).promise();
        return true;
    }
    catch(err) {
        return false;
    }
};

export const listFiles = async (prefix: string) => {
    try {
        const result = await s3.listObjectsV2({ ...DefaultParams, Prefix: prefix }).promise();
        return result.Contents!.map(c => ({ key: c.Key, size: c.Size }));
    }
    catch(err) {
        throw new Error(
            `Error listing files with '${prefix}' prefix in AWS (${err.code}):\n${err.message}`);
    }
};

export const getCurrentTour = async (): Promise<TourInfo> => {
    const tourData = await loadJson("cycle/tours.json");
    const currentTour: BaseTourInfo = tourData.tours[tourData.currentTour];
    return {
        ...currentTour,
        aws: {
            routeJsonKey: getTourRouteFolder(currentTour) + "/route.json",
            routeTxtKey: getTourRouteFolder(currentTour) + "/route.txt",
            routeGpsFolderKey: getTourRouteFolder(currentTour) + "/days/",
        }
    };
};

export const getTourRouteFolder = (tour: BaseTourInfo) => {
    return `cycle/routes/${tour.directoryName}`;
};