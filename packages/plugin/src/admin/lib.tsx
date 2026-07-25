/**
 * Shared helpers for the BCC plugin admin pages.
 *
 * API access:
 *  - plugin routes mount at /_emdash/api/plugins/bcc/*
 *  - the dispatcher wraps every handler return in `{ data }`, so list
 *    endpoints arrive as `{ data: { data: [...], total } }` on the wire
 *  - ALL plugin routes (even GETs) require the X-EmDash-Request header,
 *    which `apiFetch` from emdash/plugin-utils adds
 */
import { Badge, Empty } from "@cloudflare/kumo";
import { apiFetch, parseApiResponse } from "emdash/plugin-utils";
import * as React from "react";

const PLUGIN_API = "/_emdash/api/plugins/bcc";

// ── Wire types (mirror src/db/repos DTOs) ───────────────────────────

export interface EnquiryDTO {
	id: string;
	name: string;
	email: string;
	message: string;
	subject: string | null;
	source: string | null;
	status: string;
	createdAt: string;
	updatedAt: string;
}

export interface ListResult<T> {
	data: T[];
	total: number;
}

export interface GeocodeResult {
	lat: number;
	lng: number;
	label: string;
}

export interface MediaItem {
	id: string;
	filename: string;
	url: string;
	alt: string | null;
	mimeType?: string;
}

let mediaCache: MediaItem[] | null = null;

/** Load the media library (cached per session) for the picker. */
export async function fetchMediaList(force = false): Promise<MediaItem[]> {
	if (mediaCache && !force) return mediaCache;
	// 100 is the media endpoint's max page size (200 -> 400).
	const res = await apiFetch("/_emdash/api/media?limit=100");
	const data = await parseApiResponse<{ items: MediaItem[] }>(res);
	mediaCache = (data.items ?? []).filter((m) => (m.mimeType ?? "").startsWith("image/") || !m.mimeType);
	return mediaCache;
}

/**
 * Upload a file to the media library and return its new media id.
 *
 * Two paths, mirroring emdash's own admin: prefer the signed-URL flow (ask for
 * an upload URL, PUT the bytes straight to storage, confirm), and fall back to
 * a direct multipart POST when the storage adapter has no signed-URL support —
 * which is the case for the R2 binding this site uses (it answers
 * NOT_SUPPORTED: "Use direct upload"). Invalidates the picker cache on success.
 */
export async function uploadMedia(file: File): Promise<string> {
	const signed = await requestSignedUpload(file);

	if (signed) {
		const put = await fetch(signed.uploadUrl, {
			method: signed.method || "PUT",
			headers: signed.headers ?? { "Content-Type": file.type },
			body: file,
		});
		if (!put.ok) throw new Error(`Upload failed (${put.status})`);

		const confirmRes = await apiFetch(`/_emdash/api/media/${signed.mediaId}/confirm`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ size: file.size }),
		});
		await parseApiResponse<unknown>(confirmRes);
		mediaCache = null;
		return signed.mediaId;
	}

	// Direct multipart upload. No Content-Type header — the browser sets the
	// multipart boundary itself.
	const form = new FormData();
	form.append("file", file);
	const res = await apiFetch("/_emdash/api/media", { method: "POST", body: form });
	const created = await parseApiResponse<{ id?: string; item?: { id: string } }>(res);
	const id = created.id ?? created.item?.id;
	if (!id) throw new Error("Upload succeeded but no media id was returned");

	mediaCache = null; // force the picker to re-fetch so the new file shows up
	return id;
}

/** Ask for a signed upload URL; null when the storage adapter doesn't offer one. */
async function requestSignedUpload(file: File): Promise<{
	uploadUrl: string;
	method: string;
	headers?: Record<string, string>;
	mediaId: string;
} | null> {
	try {
		const res = await apiFetch("/_emdash/api/media/upload-url", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				filename: file.name,
				contentType: file.type || "application/octet-stream",
				size: file.size,
			}),
		});
		if (!res.ok) return null; // NOT_SUPPORTED (R2/local) → direct upload
		return await parseApiResponse<{
			uploadUrl: string;
			method: string;
			headers?: Record<string, string>;
			mediaId: string;
		}>(res);
	} catch {
		return null;
	}
}

// ── API helpers ─────────────────────────────────────────────────────

export async function pluginGet<T>(route: string): Promise<T> {
	const res = await apiFetch(`${PLUGIN_API}/${route}`);
	return parseApiResponse<T>(res);
}

export async function pluginSend<T>(
	route: string,
	method: "POST" | "PATCH",
	body: unknown,
): Promise<T> {
	const res = await apiFetch(`${PLUGIN_API}/${route}`, {
		method,
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(body),
	});
	return parseApiResponse<T>(res);
}

// ── Formatters ──────────────────────────────────────────────────────

function parseDbDate(value: string): Date {
	return new Date(value.includes("T") ? value : value.replace(" ", "T"));
}

export function fmtDateTime(value: string | null): string {
	if (!value) return "";
	const d = parseDbDate(value);
	if (Number.isNaN(d.getTime())) return value;
	return d.toLocaleString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

// ── Status vocabulary + badges ──────────────────────────────────────

export const ENQUIRY_STATUSES = ["new", "replied", "closed", "spam"];

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

const ENQUIRY_STATUS_VARIANTS: Record<string, BadgeVariant> = {
	new: "info",
	replied: "success",
	closed: "neutral",
	spam: "error",
};

export function EnquiryStatusBadge({ status }: { status: string }) {
	return <Badge variant={ENQUIRY_STATUS_VARIANTS[status] ?? "neutral"}>{status}</Badge>;
}

// ── Shared UI bits ──────────────────────────────────────────────────

export function PageHeader({
	title,
	subtitle,
	actions,
}: {
	title: string;
	subtitle?: string;
	actions?: React.ReactNode;
}) {
	return (
		<div className="flex items-center justify-between gap-4">
			<div>
				<h1 className="text-2xl font-bold">{title}</h1>
				{subtitle && <p className="text-kumo-subtle mt-1 text-sm">{subtitle}</p>}
			</div>
			{actions && <div className="flex items-center gap-2">{actions}</div>}
		</div>
	);
}

export function ErrorNotice({ message }: { message: string }) {
	return (
		<div className="border-kumo-line text-kumo-danger rounded-lg border p-3 text-sm">{message}</div>
	);
}

export function NoRows({ title, description }: { title: string; description?: string }) {
	return <Empty size="sm" title={title} description={description} />;
}

export function usePagedList<T>(route: string, params: Record<string, string>, perPage = 25) {
	const [page, setPage] = React.useState(1);
	const [rows, setRows] = React.useState<T[]>([]);
	const [total, setTotal] = React.useState(0);
	const [loading, setLoading] = React.useState(true);
	const [error, setError] = React.useState<string | null>(null);
	const [refreshTick, setRefreshTick] = React.useState(0);

	const paramsKey = JSON.stringify(params);

	React.useEffect(() => {
		setPage(1);
	}, [paramsKey]);

	React.useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setError(null);
		const search = new URLSearchParams(
			Object.fromEntries(Object.entries(params).filter(([, v]) => v !== "")),
		);
		search.set("limit", String(perPage));
		search.set("offset", String((page - 1) * perPage));
		void (async () => {
			try {
				const result = await pluginGet<ListResult<T>>(`${route}?${search.toString()}`);
				if (cancelled) return;
				setRows(result.data);
				setTotal(result.total);
			} catch (err) {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps -- paramsKey stands in for params
	}, [route, paramsKey, page, perPage, refreshTick]);

	const reload = React.useCallback(() => setRefreshTick((t) => t + 1), []);

	return { rows, total, page, setPage, perPage, loading, error, reload };
}
