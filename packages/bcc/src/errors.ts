/**
 * Bat City Council domain errors.
 *
 * Services/repos throw `BccError` with a stable code; the route layer converts
 * these to `PluginRouteError` so the core plugin dispatcher returns
 * `{ error: { code, message } }` with the mapped HTTP status.
 *
 * Kept free of any `emdash` import so services/repos stay unit-testable
 * without loading the CMS runtime.
 */

/** Contract error code → HTTP status. Codes not listed map to 400. */
const ERROR_STATUS: Record<string, number> = {
	enquiry_not_found: 404,
	geocode_failed: 502,
	rate_limited: 429,
};

export class BccError extends Error {
	readonly code: string;
	readonly status: number;

	constructor(code: string, message: string) {
		super(message);
		this.name = "BccError";
		this.code = code;
		this.status = ERROR_STATUS[code] ?? 400;
	}
}

/** Throw a BccError — convenience with a `never` return type. */
export function fail(code: string, message: string): never {
	throw new BccError(code, message);
}
