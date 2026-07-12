/**
 * emdash-auth migrator: creates `_auth_user_passwords`. Own forward-only
 * history in `_emdash_auth_migrations`, memoized per process (globalThis
 * Symbol), no interactive transactions (D1-safe). Ensured lazily before the
 * first auth DB op.
 */
import { sql, type Generated, type Kysely } from "kysely";

async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_auth_user_passwords")
		.ifNotExists()
		.addColumn("user_id", "text", (c) => c.primaryKey())
		.addColumn("password_hash", "text", (c) => c.notNull())
		.addColumn("created_at", "text", (c) => c.notNull().defaultTo(sql`(datetime('now'))`))
		.addColumn("updated_at", "text", (c) => c.notNull().defaultTo(sql`(datetime('now'))`))
		.execute();
}

const MIGRATIONS: Array<{ name: string; up: (db: Kysely<unknown>) => Promise<void> }> = [
	{ name: "001_user_passwords", up },
];

interface HistoryDb {
	_emdash_auth_migrations: { name: string; executed_at: Generated<string> };
}

export async function runAuthMigrations(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("_emdash_auth_migrations")
		.ifNotExists()
		.addColumn("name", "text", (c) => c.primaryKey())
		.addColumn("executed_at", "text", (c) => c.notNull().defaultTo(sql`(datetime('now'))`))
		.execute();
	const hdb = db as Kysely<HistoryDb>;
	const applied = new Set((await hdb.selectFrom("_emdash_auth_migrations").select("name").execute()).map((r) => r.name));
	for (const m of MIGRATIONS) {
		if (applied.has(m.name)) continue;
		await m.up(db);
		await hdb
			.insertInto("_emdash_auth_migrations")
			.values({ name: m.name })
			.onConflict((oc) => oc.column("name").doNothing())
			.execute();
	}
}

const KEY = Symbol.for("emdash-auth:migrations");

export function ensureAuthMigrations(db: Kysely<unknown>): Promise<void> {
	const g = globalThis as Record<symbol, unknown>;
	const existing = g[KEY] as Promise<void> | undefined;
	if (existing) return existing;
	const run = runAuthMigrations(db).then(
		() => undefined,
		(e) => {
			delete g[KEY];
			throw e;
		},
	);
	g[KEY] = run;
	return run;
}
