/**
 * Kysely types for emdash-auth. We own `_auth_user_passwords`; the rest are
 * read/write slices of emdash-owned tables (`users`, `_emdash_api_tokens`,
 * `_emdash_rate_limits`, `options`).
 */
import type { ColumnType, Kysely } from "kysely";

type Timestamp = ColumnType<string, string | undefined, string | undefined>;

export interface UserPasswordsTable {
	user_id: string;
	password_hash: string;
	created_at: Timestamp;
	updated_at: Timestamp;
}

export interface AuthMigrationsTable {
	name: string;
	executed_at: Timestamp;
}

/** Slice of emdash's users table. */
export interface UsersTable {
	id: string;
	email: string;
	name: string | null;
	role: number;
	disabled: ColumnType<number, number | undefined, number> | null;
}

/** emdash's API-token table (migration 016). We only INSERT/DELETE PATs. */
export interface ApiTokensTable {
	id: string;
	name: string;
	token_hash: string;
	prefix: string;
	user_id: string;
	scopes: string;
	expires_at: string | null;
	last_used_at: string | null;
	created_at: Timestamp;
}

/** emdash's fixed-window rate-limit table. */
export interface RateLimitsTable {
	key: string;
	window: string;
	count: ColumnType<number, number | undefined, number>;
}

export interface AuthDatabase {
	_auth_user_passwords: UserPasswordsTable;
	_emdash_auth_migrations: AuthMigrationsTable;
	users: UsersTable;
	_emdash_api_tokens: ApiTokensTable;
	_emdash_rate_limits: RateLimitsTable;
}

export type AuthDb = Kysely<AuthDatabase>;
