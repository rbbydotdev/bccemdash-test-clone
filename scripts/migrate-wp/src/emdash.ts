/**
 * Thin client for the emdash REST content API (dev server).
 *
 * - Auth: dev-bypass session cookie (GET /_emdash/api/setup/dev-bypass).
 * - CSRF: every state-changing request sends `X-EmDash-Request: 1`.
 * - The dev server may hot-reload mid-run; transient 5xx / connection failures
 *   are retried with backoff.
 */

const BASE_URL = process.env.EMDASH_URL ?? "http://localhost:4321";
const API = `${BASE_URL}/_emdash/api`;

const RETRY_ATTEMPTS = 5;
const RETRY_BASE_DELAY_MS = 400;

let sessionCookie = "";

export interface ApiErrorBody {
	code: string;
	message: string;
}

export class EmdashApiError extends Error {
	readonly code: string;
	readonly status: number;
	constructor(status: number, code: string, message: string) {
		super(`${status} ${code}: ${message}`);
		this.code = code;
		this.status = status;
	}
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
	let lastError: unknown;
	for (let attempt = 0; attempt < RETRY_ATTEMPTS; attempt++) {
		if (attempt > 0) await sleep(RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
		try {
			const response = await fetch(url, init);
			if (response.status >= 500 && attempt < RETRY_ATTEMPTS - 1) {
				console.warn(`  transient ${response.status} on ${url}, retrying...`);
				lastError = new Error(`HTTP ${response.status}`);
				continue;
			}
			return response;
		} catch (error) {
			lastError = error;
			console.warn(`  network error on ${url}, retrying...`);
		}
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

/**
 * Establish an admin session.
 * - Local dev: the dev-bypass endpoint (default).
 * - Production: dev-bypass is disabled, so pass an authenticated session cookie
 *   via `EMDASH_COOKIE` (copy it from an admin browser session).
 */
export async function login(): Promise<void> {
	if (process.env.EMDASH_TOKEN?.trim()) return; // Bearer token: no session needed
	const provided = process.env.EMDASH_COOKIE;
	if (provided && provided.trim()) {
		sessionCookie = provided.trim();
		return;
	}
	const response = await fetchWithRetry(`${API}/setup/dev-bypass?redirect=/_emdash/admin`, {
		redirect: "manual",
	});
	const cookies = response.headers.getSetCookie();
	if (cookies.length === 0) {
		throw new Error(
			`dev-bypass returned no session cookie (status ${response.status}). ` +
				`In production, dev-bypass is disabled — set EMDASH_COOKIE to an admin session cookie. ` +
				`Locally, is the dev server running at ${BASE_URL}? (cd apps/site && corepack pnpm dev)`,
		);
	}
	sessionCookie = cookies.map((cookie) => cookie.split(";")[0]!).join("; ");
}

/** Auth headers: a session cookie (dev-bypass or copied) or a Bearer API token. */
function authHeaders(): Record<string, string> {
	const token = process.env.EMDASH_TOKEN?.trim();
	if (token) return { authorization: `Bearer ${token}` };
	return { cookie: sessionCookie };
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
	const headers: Record<string, string> = { ...authHeaders() };
	if (method !== "GET") headers["X-EmDash-Request"] = "1";
	let payload: string | undefined;
	if (body !== undefined) {
		headers["content-type"] = "application/json";
		payload = JSON.stringify(body);
	}
	const response = await fetchWithRetry(`${API}${path}`, { method, headers, body: payload });
	const text = await response.text();
	let parsed: { data?: T; error?: ApiErrorBody };
	try {
		parsed = JSON.parse(text) as { data?: T; error?: ApiErrorBody };
	} catch {
		throw new EmdashApiError(response.status, "NON_JSON_RESPONSE", text.slice(0, 300));
	}
	if (!response.ok) {
		throw new EmdashApiError(
			response.status,
			parsed.error?.code ?? "UNKNOWN_ERROR",
			parsed.error?.message ?? text.slice(0, 300),
		);
	}
	return parsed.data as T;
}

// ── Content ─────────────────────────────────────────────────────────

export interface ContentItem {
	id: string;
	slug: string | null;
	status: string;
	data: Record<string, unknown>;
	createdAt?: string;
	publishedAt?: string | null;
}

export async function listAllContent(collection: string): Promise<ContentItem[]> {
	const items: ContentItem[] = [];
	let cursor: string | undefined;
	do {
		const qs = new URLSearchParams({ limit: "100" });
		if (cursor) qs.set("cursor", cursor);
		const page = await request<{ items: ContentItem[]; nextCursor?: string }>(
			"GET",
			`/content/${collection}?${qs}`,
		);
		items.push(...page.items);
		cursor = page.nextCursor ?? undefined;
	} while (cursor);
	return items;
}

export interface CreateEntryInput {
	slug: string;
	data: Record<string, unknown>;
	taxonomies?: Record<string, string[]>;
	publishedAt?: string;
	createdAt?: string;
}

export async function createEntry(collection: string, input: CreateEntryInput): Promise<ContentItem> {
	const result = await request<{ item: ContentItem }>("POST", `/content/${collection}`, input);
	return result.item;
}

/** Overwrite an existing entry's data (used to re-sync content on re-runs). */
export async function updateEntry(collection: string, id: string, data: Record<string, unknown>): Promise<void> {
	await request("PUT", `/content/${collection}/${id}`, { data });
}

export async function publishEntry(collection: string, id: string, publishedAt?: string): Promise<void> {
	await request("POST", `/content/${collection}/${id}/publish`, publishedAt ? { publishedAt } : {});
}

// ── Media ───────────────────────────────────────────────────────────

export interface MediaItem {
	id: string;
	filename: string;
	mimeType: string;
	size: number;
	width?: number;
	height?: number;
	url?: string;
}

export async function listAllMedia(): Promise<MediaItem[]> {
	const items: MediaItem[] = [];
	let cursor: string | undefined;
	do {
		const qs = new URLSearchParams({ limit: "100" });
		if (cursor) qs.set("cursor", cursor);
		const page = await request<{ items: MediaItem[]; nextCursor?: string }>("GET", `/media?${qs}`);
		items.push(...page.items);
		cursor = page.nextCursor ?? undefined;
	} while (cursor);
	return items;
}

export async function uploadMedia(
	bytes: Uint8Array,
	filename: string,
	mimeType: string,
	alt?: string,
): Promise<MediaItem> {
	const form = new FormData();
	form.append("file", new Blob([bytes], { type: mimeType }), filename);
	if (alt) form.append("alt", alt);
	const response = await fetchWithRetry(`${API}/media`, {
		method: "POST",
		headers: { ...authHeaders(), "X-EmDash-Request": "1" },
		body: form,
	});
	const text = await response.text();
	if (!response.ok) {
		throw new EmdashApiError(response.status, "MEDIA_UPLOAD_FAILED", text.slice(0, 300));
	}
	const parsed = JSON.parse(text) as { data: { item: MediaItem } };
	return parsed.data.item;
}

export async function updateMediaMeta(id: string, meta: { alt?: string }): Promise<void> {
	await request("PUT", `/media/${id}`, meta);
}

// ── Settings ────────────────────────────────────────────────────────

/** Update emdash's typed SiteSettings (title, tagline, social, seo). */
export async function updateSiteSettings(input: Record<string, unknown>): Promise<void> {
	await request("POST", `/settings`, input);
}

/** Update the BCC "Site Content" bag via the plugin's admin/settings route. */
export async function updateBccSettings(patch: Record<string, unknown>): Promise<void> {
	await request("POST", `/plugins/bcc/admin/settings`, patch);
}
