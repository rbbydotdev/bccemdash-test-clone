/**
 * In-memory test DB: a fresh better-sqlite3 Kysely per test with the
 * emdash-auth migration applied (`_auth_user_passwords`) plus the emdash-owned
 * tables the auth services read/write in production (`users`,
 * `_emdash_api_tokens`, `_emdash_rate_limits`).
 */
import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect, sql } from "kysely";

import { runAuthMigrations } from "../src/db/migrator.js";
import type { AuthDatabase, AuthDb } from "../src/db/types.js";

export async function createTestDb(): Promise<AuthDb> {
	const db = new Kysely<AuthDatabase>({
		dialect: new SqliteDialect({ database: new SQLite(":memory:") }),
	});
	await runAuthMigrations(db as Kysely<unknown>);
	await sql`CREATE TABLE _emdash_rate_limits (
		key TEXT NOT NULL,
		"window" TEXT NOT NULL,
		count INTEGER NOT NULL DEFAULT 1,
		PRIMARY KEY (key, "window")
	)`.execute(db);
	await sql`CREATE TABLE users (
		id TEXT PRIMARY KEY,
		email TEXT NOT NULL UNIQUE,
		name TEXT,
		role INTEGER NOT NULL DEFAULT 10,
		email_verified INTEGER NOT NULL DEFAULT 0,
		data TEXT,
		created_at TEXT,
		updated_at TEXT,
		disabled INTEGER
	)`.execute(db);
	await sql`CREATE TABLE _emdash_api_tokens (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		token_hash TEXT NOT NULL UNIQUE,
		prefix TEXT NOT NULL,
		user_id TEXT NOT NULL,
		scopes TEXT NOT NULL,
		expires_at TEXT,
		last_used_at TEXT,
		created_at TEXT
	)`.execute(db);
	return db;
}
