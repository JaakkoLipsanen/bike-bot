export interface LatLng {
	lat: string | number;
	lng: string | number;
}

export interface Error {
	success: false;
	error: { message: string; type?: string };
}

export interface Success<T> {
	success: true;
	payload: T;
}

export type Response<T> = Success<T> | Error;
export type AsyncResponse<T> = Promise<Response<T>>;

export type Location = string | LatLng;
export type LatLngEle = LatLng & { ele?: number };

export interface Size {
	width: number;
	height: number;
}

export const FN_NOT_IMPLEMENTED = (...args: any[]): any => {
	throw new Error("Not implemented");
};

export const NOOP = (...args: any[]): any => {};
