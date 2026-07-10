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

/** Resolve a single media id to a servable URL (null when missing). */
export async function mediaUrl(id: unknown): Promise<string | null> {
	if (typeof id !== "string" || id.length === 0) return null;
	try {
		const db = await getDb();
		const item = await new MediaRepository(db).findById(id);
		if (!item) return null;
		const key = item.storageKey ?? item.id;
		return `/_emdash/api/media/file/${key}`;
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
