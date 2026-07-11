/**
 * Tiny test harness: a fresh in-memory better-sqlite3 Kysely database per test,
 * with the BCC migrations applied plus the core `_emdash_rate_limits` table the
 * rate limiter upserts into (owned by emdash in production).
 */
import SQLite from "better-sqlite3";
import { Kysely, SqliteDialect, sql } from "kysely";

import { runBccMigrations } from "../src/db/migrator.js";
import type { BccDatabase, BccDb } from "../src/db/types.js";

export async function createTestDb(): Promise<BccDb> {
	const db = new Kysely<BccDatabase>({
		dialect: new SqliteDialect({ database: new SQLite(":memory:") }),
	});
	await runBccMigrations(db as Kysely<unknown>);
	await sql`CREATE TABLE _emdash_rate_limits (
		key TEXT NOT NULL,
		"window" TEXT NOT NULL,
		count INTEGER NOT NULL DEFAULT 1,
		PRIMARY KEY (key, "window")
	)`.execute(db);
	// Minimal slice of emdash's users table (owned by emdash in production).
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
