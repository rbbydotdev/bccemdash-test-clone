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

export interface UserPasswordsTable {
	user_id: string;
	password_hash: string;
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

/** Core's API-token table (migration 016). We only INSERT PATs for agents. */
export interface ApiTokensTable {
	id: string;
	name: string;
	token_hash: string;
	prefix: string;
	user_id: string;
	scopes: string; // JSON array
	expires_at: string | null;
	last_used_at: string | null;
	created_at: Timestamp;
}

// ── Database ────────────────────────────────────────────────────────

/** Read-only slice of emdash's `users` table (owned by emdash). */
export interface UsersTable {
	id: string;
	email: string;
	name: string | null;
	role: number;
	disabled: ColumnType<number, number | undefined, number> | null;
}

export interface BccDatabase {
	enquiries: EnquiriesTable;
	bcc_user_passwords: UserPasswordsTable;
	_bcc_migrations: BccMigrationsTable;
	_emdash_rate_limits: RateLimitsTable;
	_emdash_api_tokens: ApiTokensTable;
	users: UsersTable;
}

export type BccDb = Kysely<BccDatabase>;
