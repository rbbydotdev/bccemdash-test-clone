/**
 * Route-layer plumbing: DB access (+ lazy migrations), BccError →
 * PluginRouteError conversion, method/CSRF guards, rate-limit enforcement, and
 * manual input validation helpers.
 *
 * Note on GET inputs: the plugin dispatcher only parses JSON bodies into
 * `ctx.input`; query strings are read from `ctx.request.url` here.
 */
import { PluginRouteError, type RouteContext } from "emdash";
import { getDb } from "emdash/runtime";
import type { Kysely } from "kysely";

import { ensureBccMigrations } from "../db/migrator.js";
import type { BccDatabase, BccDb } from "../db/types.js";
import { BccError, fail } from "../errors.js";
import { checkBccRateLimit } from "../services/rate-limit.js";

/** Get the site's Kysely handle, with BCC migrations ensured. */
export async function getBccDb(): Promise<BccDb> {
	const db = (await getDb()) as unknown as Kysely<BccDatabase>;
	await ensureBccMigrations(db as Kysely<unknown>);
	return db;
}

type Handler = (ctx: RouteContext) => Promise<unknown>;

/** Convert domain BccErrors into structured plugin route errors. */
export function wrap(handler: Handler): Handler {
	return async (ctx) => {
		try {
			return await handler(ctx);
		} catch (error) {
			if (error instanceof BccError) {
				throw new PluginRouteError(error.code, error.message, error.status);
			}
			throw error;
		}
	};
}

/** 405 unless the request method is in the allowed set. */
export function requireMethod(ctx: RouteContext, ...methods: string[]): string {
	const method = ctx.request.method.toUpperCase();
	if (!methods.includes(method)) {
		throw new PluginRouteError(
			"METHOD_NOT_ALLOWED",
			`Use ${methods.join(" or ")} for this route`,
			405,
		);
	}
	return method;
}

/**
 * CSRF header check for the PUBLIC state-changing routes. (Private routes get
 * this from the core dispatcher; public routes skip it there.)
 */
export function requireCsrfHeader(ctx: RouteContext): void {
	if (ctx.request.headers.get("X-EmDash-Request") !== "1") {
		throw new PluginRouteError("CSRF_REJECTED", "Missing required header", 403);
	}
}

/** Per-IP fixed-window rate limit; throws `rate_limited` when exceeded. */
export async function enforceRateLimit(
	ctx: RouteContext,
	endpoint: string,
	max = 5,
	windowSeconds = 600,
): Promise<void> {
	const db = (await getDb()) as unknown as Kysely<BccDatabase>;
	const ip = ctx.requestMeta?.ip ?? null;
	const result = await checkBccRateLimit(db, ip, endpoint, max, windowSeconds);
	if (!result.allowed) {
		fail("rate_limited", "Too many requests. Please try again later.");
	}
}

export function queryParams(ctx: RouteContext): URLSearchParams {
	return new URL(ctx.request.url).searchParams;
}

// ── Body/input validation ───────────────────────────────────────────

export function asRecord(value: unknown, label = "body"): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		fail("validation_error", `${label} must be a JSON object`);
	}
	return value as Record<string, unknown>;
}

export function readString(
	obj: Record<string, unknown>,
	key: string,
	opts: { required?: boolean; maxLength?: number } = {},
): string | undefined {
	const value = obj[key];
	if (value === undefined || value === null || value === "") {
		if (opts.required) fail("validation_error", `${key} is required`);
		return undefined;
	}
	if (typeof value !== "string") fail("validation_error", `${key} must be a string`);
	const trimmed = value.trim();
	if (opts.required && trimmed.length === 0) fail("validation_error", `${key} is required`);
	if (opts.maxLength && trimmed.length > opts.maxLength) {
		fail("validation_error", `${key} exceeds ${opts.maxLength} characters`);
	}
	return trimmed;
}

/** `readString` + a pragmatic email shape check. */
export function readEmail(
	obj: Record<string, unknown>,
	key: string,
	opts: { required?: boolean; maxLength?: number } = {},
): string | undefined {
	const value = readString(obj, key, opts);
	if (value === undefined) return undefined;
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
		fail("validation_error", `${key} must be a valid email address`);
	}
	return value;
}

export function readNumber(
	obj: Record<string, unknown>,
	key: string,
	opts: { required?: boolean; min?: number; max?: number } = {},
): number | undefined {
	const value = obj[key];
	if (value === undefined || value === null || value === "") {
		if (opts.required) fail("validation_error", `${key} is required`);
		return undefined;
	}
	const n = typeof value === "string" ? Number(value) : value;
	if (typeof n !== "number" || !Number.isFinite(n)) {
		fail("validation_error", `${key} must be a number`);
	}
	if (opts.min !== undefined && n < opts.min) fail("validation_error", `${key} must be >= ${opts.min}`);
	if (opts.max !== undefined && n > opts.max) fail("validation_error", `${key} must be <= ${opts.max}`);
	return n;
}
