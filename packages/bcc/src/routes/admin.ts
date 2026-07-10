/**
 * Admin routes (core dispatcher enforces session + perms + CSRF).
 *
 * - admin/enquiries       GET list (status/search filters, paging)
 * - admin/enquiries/item  GET one (?id=) / PATCH status ({ id, status })
 * - admin/stats           GET dashboard rollup (counts by status + recent)
 * - admin/geocode         GET address → { lat, lng } (donor location field)
 */
import type { RouteContext } from "emdash";

import {
	ENQUIRY_STATUSES,
	countEnquiriesByStatus,
	getEnquiryById,
	listEnquiries,
	recentEnquiries,
	toEnquiryDTO,
	updateEnquiryStatus,
	type EnquiryStatus,
} from "../db/repos/enquiries.repo.js";
import { fail } from "../errors.js";
import { asRecord, getBccDb, queryParams, readString, requireMethod } from "./helpers.js";

export async function adminEnquiriesHandler(ctx: RouteContext): Promise<unknown> {
	requireMethod(ctx, "GET");
	const params = queryParams(ctx);
	const db = await getBccDb();
	return listEnquiries(db, {
		status: params.get("status") ?? undefined,
		search: params.get("search") ?? undefined,
		sort: params.get("sort") ?? undefined,
		order: params.get("order") ?? undefined,
		limit: params.get("limit") ? Number(params.get("limit")) : undefined,
		offset: params.get("offset") ? Number(params.get("offset")) : undefined,
	});
}

export async function adminEnquiryItemHandler(ctx: RouteContext): Promise<unknown> {
	const method = requireMethod(ctx, "GET", "PATCH");
	const db = await getBccDb();

	if (method === "GET") {
		const id = queryParams(ctx).get("id");
		if (!id) fail("validation_error", "id is required");
		const row = await getEnquiryById(db, id);
		if (!row) fail("enquiry_not_found", "Enquiry not found");
		return toEnquiryDTO(row);
	}

	// PATCH — update status
	const body = asRecord(ctx.input);
	const id = readString(body, "id", { required: true })!;
	const status = readString(body, "status", { required: true })! as EnquiryStatus;
	if (!ENQUIRY_STATUSES.includes(status)) {
		fail("validation_error", `status must be one of ${ENQUIRY_STATUSES.join(", ")}`);
	}
	const updated = await updateEnquiryStatus(db, id, status);
	if (!updated) fail("enquiry_not_found", "Enquiry not found");
	return toEnquiryDTO(updated);
}

export async function adminStatsHandler(ctx: RouteContext): Promise<unknown> {
	requireMethod(ctx, "GET");
	const db = await getBccDb();
	const [byStatus, recent] = await Promise.all([
		countEnquiriesByStatus(db),
		recentEnquiries(db, 5),
	]);
	return { byStatus, recent };
}

/**
 * Geocode an address to coordinates via OpenStreetMap Nominatim (free, no key).
 * Used by the business-donor location field so the client never types lat/lng.
 */
export async function adminGeocodeHandler(ctx: RouteContext): Promise<unknown> {
	requireMethod(ctx, "GET");
	const q = queryParams(ctx).get("q");
	if (!q || q.trim().length < 3) fail("validation_error", "q must be at least 3 characters");

	const url = new URL("https://nominatim.openstreetmap.org/search");
	url.searchParams.set("q", q.trim());
	url.searchParams.set("format", "json");
	url.searchParams.set("limit", "5");

	try {
		const res = await fetch(url, {
			headers: { "User-Agent": "BatCityCouncil/1.0 (batcitycouncil.org)", Accept: "application/json" },
		});
		if (!res.ok) fail("geocode_failed", `Geocoder returned ${res.status}`);
		const rows = (await res.json()) as Array<{
			lat: string;
			lon: string;
			display_name: string;
		}>;
		return {
			results: rows.map((r) => ({
				lat: Number(r.lat),
				lng: Number(r.lon),
				label: r.display_name,
			})),
		};
	} catch (error) {
		if (error instanceof Error && error.name === "BccError") throw error;
		fail("geocode_failed", "Could not reach the geocoding service");
	}
}
