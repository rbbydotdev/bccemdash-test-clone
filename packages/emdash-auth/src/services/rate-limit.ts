/**
 * Fixed-window rate limiting for the auth POST routes.
 *
 * Reuses core's `_emdash_rate_limits` table with the same atomic-upsert counter
 * core's own limiter uses — one statement, D1-safe. Keys are namespaced
 * `{ip}:auth:{endpoint}`.
 *
 * Fail-open: no trusted IP or a missing table (core migrations not yet run)
 * allows the request rather than blocking real users.
 */
import { sql, type Kysely } from "kysely";

export interface RateLimitResult {
	allowed: boolean;
	count: number;
	limit: number;
}

export async function checkAuthRateLimit<DB>(
	db: Kysely<DB>,
	ip: string | null,
	endpoint: string,
	maxRequests: number,
	windowSeconds: number,
): Promise<RateLimitResult> {
	if (!ip) return { allowed: true, count: 0, limit: maxRequests };

	const windowStart = new Date(
		Math.floor(Date.now() / (windowSeconds * 1000)) * windowSeconds * 1000,
	).toISOString();
	const key = `${ip}:auth:${endpoint}`;

	try {
		const result = await sql<{ count: number }>`
			INSERT INTO _emdash_rate_limits (key, "window", count)
			VALUES (${key}, ${windowStart}, 1)
			ON CONFLICT (key, "window")
			DO UPDATE SET count = _emdash_rate_limits.count + 1
			RETURNING count
		`.execute(db);
		const count = Number(result.rows[0]?.count ?? 1);
		return { allowed: count <= maxRequests, count, limit: maxRequests };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		if (/no such table|does not exist/i.test(message)) {
			return { allowed: true, count: 0, limit: maxRequests };
		}
		throw error;
	}
}
