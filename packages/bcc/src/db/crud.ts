/**
 * List-query concepts ported from skill-studio's crud.ts onto Kysely:
 *
 * - allowlisted sort columns (the ONLY identifiers ever placed in ORDER BY,
 *   via `sql.ref` after allowlist validation)
 * - composable filters — an array of parameterized `RawBuilder<SqlBool>`
 *   fragments joined with AND (values always bound, never interpolated)
 * - clamped limit (1–100, default 25) and non-negative offset
 * - `{ data, total }` envelope (COUNT(*) with the same WHERE)
 * - JSON / boolean hydration helpers
 */
import { sql, type Kysely, type RawBuilder, type SqlBool } from "kysely";

import type { BccDatabase } from "./types.js";

export const MAX_LIMIT = 100;
export const DEFAULT_LIMIT = 25;

/** A parameterized boolean SQL fragment, e.g. sql<SqlBool>`status = ${s}`. */
export type Filter = RawBuilder<SqlBool>;

export interface ListOptions {
	where?: Filter[];
	sort?: string | undefined;
	order?: string | undefined; // anything not "asc" (case-insensitive) becomes "desc"
	limit?: number | undefined;
	offset?: number | undefined;
}

export interface ListResult<T> {
	data: T[];
	total: number;
}

export function clampLimit(value: unknown): number {
	const n = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
	if (!Number.isFinite(n)) return DEFAULT_LIMIT;
	return Math.min(Math.max(Math.trunc(n), 1), MAX_LIMIT);
}

export function clampOffset(value: unknown): number {
	const n = typeof value === "string" ? Number.parseInt(value, 10) : Number(value);
	if (!Number.isFinite(n)) return 0;
	return Math.max(Math.trunc(n), 0);
}

/** Validate a sort column against the allowlist, falling back to the default. */
export function pickSort(
	sort: string | undefined,
	allowed: readonly string[],
	fallback: string,
): string {
	return sort !== undefined && allowed.includes(sort) ? sort : fallback;
}

export function pickOrder(order: string | undefined): "asc" | "desc" {
	return order?.toLowerCase() === "asc" ? "asc" : "desc";
}

/** Escape LIKE wildcards so user search input matches literally (ESCAPE '\'). */
export function escapeLike(input: string): string {
	return input.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Parse a TEXT-JSON column; returns fallback when null/invalid. */
export function parseJsonColumn<T>(value: unknown, fallback: T): T {
	if (typeof value !== "string" || value.length === 0) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

/** Coerce an INTEGER 0|1 column to boolean. */
export function toBool(value: unknown): boolean {
	return Boolean(value);
}

export interface ListQueryConfig<Row, T> {
	table: keyof BccDatabase & string;
	allowedSorts: readonly string[];
	defaultSort: string;
	hydrate: (row: Row) => T;
}

/**
 * Run a `{ data, total }` list query: COUNT(*) with the composed WHERE,
 * then SELECT * with allowlisted ORDER BY and bound LIMIT/OFFSET.
 */
export async function listRows<Row, T>(
	db: Kysely<BccDatabase>,
	opts: ListOptions,
	config: ListQueryConfig<Row, T>,
): Promise<ListResult<T>> {
	const where = opts.where ?? [];
	const sort = pickSort(opts.sort, config.allowedSorts, config.defaultSort);
	const order = pickOrder(opts.order);
	const limit = clampLimit(opts.limit ?? DEFAULT_LIMIT);
	const offset = clampOffset(opts.offset ?? 0);

	let countQuery = db.selectFrom(config.table).select(sql<number>`count(*)`.as("total"));
	for (const filter of where) countQuery = countQuery.where(filter);
	const countRow = await countQuery.executeTakeFirst();
	const total = Number(countRow?.total ?? 0);

	let query = db
		.selectFrom(config.table)
		.selectAll()
		// `sort` has been validated against the allowlist above — the only
		// identifier ever placed in ORDER BY.
		.orderBy(sql.ref(sort), order)
		.limit(limit)
		.offset(offset);
	for (const filter of where) query = query.where(filter);

	const rows = (await query.execute()) as Row[];
	return { data: rows.map(config.hydrate), total };
}
