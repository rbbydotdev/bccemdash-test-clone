/**
 * BCC plugin migrator.
 *
 * Owns its own forward-only migration history in `_bcc_migrations`,
 * independent of emdash's `_emdash_migrations`. Invoked from the plugin's
 * `plugin:install` / `plugin:activate` hooks and lazily (memoized) before the
 * first route query of each process — safe to call on every boot.
 *
 * No interactive transactions: each migration statement runs standalone so the
 * same code works on better-sqlite3 and D1.
 */
import { sql, type ColumnType, type Kysely } from "kysely";

import * as m001 from "./migrations/001_init.js";
import * as m003 from "./migrations/003_og_templates.js";

export interface BccMigration {
	name: string;
	up(db: Kysely<unknown>): Promise<void>;
}

/**
 * Ordered, forward-only migration list. Append-only — never reorder.
 *
 * NOTE: migration number 002 (`002_passwords` / `bcc_user_passwords`) was a
 * retired experiment and is intentionally skipped — never reuse that number.
 * Databases that ran it keep the recorded `002_passwords` history row and the
 * now-unused table; neither is read anymore.
 */
const MIGRATIONS: BccMigration[] = [m001, m003];

interface HistoryDb {
	_bcc_migrations: {
		name: string;
		executed_at: ColumnType<string, string | undefined, string>;
	};
}

/**
 * Run all pending BCC migrations. Idempotent: applied names are recorded in
 * `_bcc_migrations` and skipped on subsequent runs. Returns applied names.
 */
export async function runBccMigrations(db: Kysely<unknown>): Promise<string[]> {
	await db.schema
		.createTable("_bcc_migrations")
		.ifNotExists()
		.addColumn("name", "text", (c) => c.primaryKey())
		.addColumn("executed_at", "text", (c) => c.notNull().defaultTo(sql`(datetime('now'))`))
		.execute();

	const hdb = db as Kysely<HistoryDb>;
	const rows = await hdb.selectFrom("_bcc_migrations").select("name").execute();
	const applied = new Set(rows.map((r) => r.name));

	const ran: string[] = [];
	for (const migration of MIGRATIONS) {
		if (applied.has(migration.name)) continue;
		await migration.up(db);
		// Two racing boots can both attempt the insert; the PK conflict is
		// harmless because every DDL statement above is IF NOT EXISTS.
		await hdb
			.insertInto("_bcc_migrations")
			.values({ name: migration.name })
			.onConflict((oc) => oc.column("name").doNothing())
			.execute();
		ran.push(migration.name);
	}
	return ran;
}

/**
 * Memoized once-per-process wrapper around `runBccMigrations`.
 *
 * Stored on `globalThis` under a Symbol key so Vite's SSR chunk duplication
 * can't create two memo slots. A failed run clears the memo so the next
 * request retries.
 */
const ENSURE_KEY = Symbol.for("bcc:migrations");

export function ensureBccMigrations(db: Kysely<unknown>): Promise<void> {
	const g = globalThis as Record<symbol, unknown>;
	const existing = g[ENSURE_KEY] as Promise<void> | undefined;
	if (existing) return existing;
	const run = runBccMigrations(db).then(
		() => undefined,
		(error) => {
			delete g[ENSURE_KEY];
			throw error;
		},
	);
	g[ENSURE_KEY] = run;
	return run;
}
