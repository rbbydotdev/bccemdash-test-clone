/**
 * Server helpers for the public site: emdash collection reads (sorted by the
 * `order` field) and media-id -> URL resolution.
 */
import { MediaRepository, getEmDashCollection } from "emdash";
import { getDb } from "emdash/runtime";

export interface Entry {
	id: string;
	slug?: string | null;
	data: Record<string, unknown>;
}

const fileUrl = (key: string): string => `/_emdash/api/media/file/${key}`;

/**
 * Resolve a media field value to a servable URL (null when missing).
 * Accepts either a plain media-id string (how the settings bag stores images)
 * or a resolved MediaValue object (how emdash's content API stores `image`
 * collection fields: `{ id, filename, meta: { storageKey }, ... }`).
 */
export async function mediaUrl(value: unknown): Promise<string | null> {
	if (!value) return null;

	// Already a resolved MediaValue object (emdash `image` field on collections).
	if (typeof value === "object") {
		const v = value as { id?: unknown; storageKey?: unknown; meta?: { storageKey?: unknown } };
		const key = v.meta?.storageKey ?? v.storageKey;
		if (typeof key === "string" && key.length > 0) return fileUrl(key);
		if (typeof v.id === "string" && v.id.length > 0) return mediaUrl(v.id);
		return null;
	}

	// A media-id string (settings imagery) — look up its storage key.
	if (typeof value !== "string" || value.length === 0) return null;
	try {
		const db = await getDb();
		const item = await new MediaRepository(db).findById(value);
		if (!item) return null;
		return fileUrl(item.storageKey ?? item.id);
	} catch {
		return null;
	}
}

/** Resolve many media ids at once (preserves order; drops missing). */
export async function mediaUrls(ids: unknown[]): Promise<Array<{ id: string; url: string }>> {
	const out: Array<{ id: string; url: string }> = [];
	for (const id of ids) {
		const url = await mediaUrl(id);
		if (typeof id === "string" && url) out.push({ id, url });
	}
	return out;
}

const orderOf = (e: Entry): number => {
	const o = e.data.order;
	return typeof o === "number" ? o : Number.parseFloat(String(o ?? 0)) || 0;
};

/** Published entries of a collection, sorted by the `order` field (asc). */
export async function publishedEntries(collection: string): Promise<Entry[]> {
	try {
		const res = await getEmDashCollection(collection, { status: "published", limit: 200 });
		const entries = (res.entries ?? []) as Entry[];
		return entries.slice().sort((a, b) => orderOf(a) - orderOf(b));
	} catch {
		return [];
	}
}

export function str(data: Record<string, unknown>, key: string): string {
	const v = data[key];
	return typeof v === "string" ? v : "";
}
export function num(data: Record<string, unknown>, key: string): number | null {
	const v = data[key];
	if (typeof v === "number") return v;
	const n = Number.parseFloat(String(v));
	return Number.isFinite(n) ? n : null;
}
export function bool(data: Record<string, unknown>, key: string): boolean {
	return Boolean(data[key]);
}
