/**
 * Kysely table types for the BCC plugin's own tables plus the minimal
 * read-only slices of core tables we touch.
 *
 * The `enquiries` table is owned by this plugin and migrated by
 * `runBccMigrations` (see ./migrator.ts). Core's `_emdash_rate_limits` is
 * owned by emdash — we only INSERT/UPDATE counters there, mirroring core's
 * own rate limiter.
 */
import type { ColumnType, Kysely } from "kysely";

/** TEXT timestamp column defaulting to datetime('now'); optional on insert. */
type Timestamp = ColumnType<string, string | undefined, string | undefined>;

// ── Plugin-owned tables ─────────────────────────────────────────────

export interface EnquiriesTable {
	id: string;
	name: string;
	email: string;
	message: string;
	subject: string | null;
	source: string | null;
	status: ColumnType<string, string | undefined, string>;
	ip: string | null;
	user_agent: string | null;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface BccMigrationsTable {
	name: string;
	executed_at: Timestamp;
}

// ── Core tables we touch ────────────────────────────────────────────

/** Core's fixed-window rate-limit table. */
export interface RateLimitsTable {
	key: string;
	window: string;
	count: ColumnType<number, number | undefined, number>;
}

// ── Database ────────────────────────────────────────────────────────

export interface BccDatabase {
	enquiries: EnquiriesTable;
	_bcc_migrations: BccMigrationsTable;
	_emdash_rate_limits: RateLimitsTable;
}

export type BccDb = Kysely<BccDatabase>;
