/**
 * Strict Content-Security-Policy for /_emdash routes (admin + API).
 *
 * Applied via middleware header rather than Astro's built-in CSP because
 * Astro's auto-hashing defeats 'unsafe-inline' (CSP3 ignores 'unsafe-inline'
 * when hashes are present), which would break user-facing pages.
 *
 * img-src allows any HTTPS origin because the admin renders user content that
 * may reference external images (migrations, external hosting, embeds).
 * Plugin security does not rely on img-src -- plugins run in V8 isolates with
 * no DOM access. connect-src stays at 'self' unless the experimental registry
 * and/or the configured storage endpoint (for direct-to-S3 signed uploads)
 * are configured, in which case those origins are allowed too.
 */
import type { RegistryConfigInput } from "../../registry/types.js";
import type { StorageDescriptor } from "../storage/types.js";

/**
 * Extra CSP sources contributed by the host app (`emdash({ csp })`) for
 * admin-rendered content that needs external resources — e.g. a native field
 * widget that embeds a map (tile host in `connect-src`, `blob:` in `worker-src`).
 * Each list is appended to its directive; directives absent from the base policy
 * (`worker-src`, `font-src`, `frame-src`) are added, seeded with `'self'`.
 *
 * @example
 * ```ts
 * emdash({ csp: { connectSrc: ["https://tiles.example.com"], workerSrc: ["blob:"] } })
 * ```
 */
export interface EmDashCspConfig {
	/** Appended to `connect-src` (fetch / XHR / WebSocket) — e.g. a tile host. */
	connectSrc?: string[];
	/** Appended to `worker-src` — e.g. `"blob:"` for Web Workers. */
	workerSrc?: string[];
	/** Appended to `script-src`. */
	scriptSrc?: string[];
	/** Appended to `style-src`. */
	styleSrc?: string[];
	/** Appended to `img-src`. */
	imgSrc?: string[];
	/** Appended to `font-src`. */
	fontSrc?: string[];
	/** Appended to `frame-src`. */
	frameSrc?: string[];
}

/** Entrypoint constant used by the `s3()` adapter (see `astro/storage/adapters.ts`). */
const S3_ADAPTER_ENTRYPOINT = "emdash/storage/s3";

/**
 * Storage entrypoints are free to shape their config however they like, so
 * `endpoint` isn't a known field on `StorageDescriptor["config"]` -- only
 * S3-compatible adapters (R2, S3, Minio, ...) set it. Anything else (e.g.
 * local filesystem storage) simply has no `endpoint` to allow.
 *
 * The `s3()` adapter resolves any field omitted from its config -- including
 * `endpoint` -- from the matching `S3_*` env var at runtime (see
 * `storage/s3.ts`'s `resolveS3Config`). A site configured as `s3({ ... })`
 * with only `S3_ENDPOINT` set has no `endpoint` in the descriptor's config,
 * so fall back to that env var for S3-adapter storage before giving up.
 */
export function getConfiguredStorageEndpoint(
	storage: StorageDescriptor | undefined,
): string | undefined {
	const config = storage?.config;
	if (typeof config === "object" && config !== null && "endpoint" in config) {
		const endpoint = config.endpoint;
		if (typeof endpoint === "string") return endpoint;
	}

	if (storage?.entrypoint === S3_ADAPTER_ENTRYPOINT) {
		const envEndpoint =
			typeof process !== "undefined" && process.env ? process.env.S3_ENDPOINT : undefined;
		if (envEndpoint) return envEndpoint;
	}

	return undefined;
}

function getRegistryAggregatorOrigin(
	registry: RegistryConfigInput | undefined,
): string | undefined {
	const aggregatorUrl = typeof registry === "string" ? registry : registry?.aggregatorUrl;
	if (!aggregatorUrl) return undefined;

	try {
		const url = new URL(aggregatorUrl);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		return url.origin;
	} catch {
		return undefined;
	}
}

function getHttpOrigin(rawUrl: string | undefined): string | undefined {
	if (!rawUrl) return undefined;

	try {
		const url = new URL(rawUrl);
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
		return url.origin;
	} catch {
		return undefined;
	}
}

const CSP_EXTRA_DIRECTIVES: Array<[keyof EmDashCspConfig, string]> = [
	["connectSrc", "connect-src"],
	["workerSrc", "worker-src"],
	["scriptSrc", "script-src"],
	["styleSrc", "style-src"],
	["imgSrc", "img-src"],
	["fontSrc", "font-src"],
	["frameSrc", "frame-src"],
];

/** Merge host-provided extra sources into the built directive list (deduped). */
function mergeCspExtras(directives: string[], extra: EmDashCspConfig): string {
	const byName = new Map<string, string[]>();
	for (const directive of directives) {
		const [name, ...sources] = directive.split(" ");
		if (name) byName.set(name, sources);
	}
	for (const [key, name] of CSP_EXTRA_DIRECTIVES) {
		const additions = extra[key];
		if (!additions?.length) continue;
		const sources = byName.get(name) ?? ["'self'"];
		for (const src of additions) {
			if (!sources.includes(src)) sources.push(src);
		}
		byName.set(name, sources);
	}
	return Array.from(byName, ([name, sources]) => `${name} ${sources.join(" ")}`).join("; ");
}

export function buildEmDashCsp(
	registry?: RegistryConfigInput,
	storageEndpoint?: string,
	extra?: EmDashCspConfig,
): string {
	const connectSrc = ["connect-src 'self'"];
	const origins = new Set<string>();
	const registryAggregatorOrigin = getRegistryAggregatorOrigin(registry);
	if (registryAggregatorOrigin) origins.add(registryAggregatorOrigin);
	const storageOrigin = getHttpOrigin(storageEndpoint);
	if (storageOrigin) origins.add(storageOrigin);
	connectSrc.push(...origins);

	const directives = [
		"default-src 'self'",
		"script-src 'self' 'unsafe-inline'",
		"style-src 'self' 'unsafe-inline'",
		connectSrc.join(" "),
		"form-action 'self'",
		"frame-ancestors 'none'",
		"img-src 'self' https: data: blob:",
		"object-src 'none'",
		"base-uri 'self'",
	];

	return extra ? mergeCspExtras(directives, extra) : directives.join("; ");
}
