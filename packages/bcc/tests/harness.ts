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
	return db;
}
