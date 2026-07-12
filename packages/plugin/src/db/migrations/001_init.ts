/**
 * 001_init — the enquiries table (contact-form submissions).
 *
 * Every DDL statement is `.ifNotExists()` and standalone (no transaction) so
 * the same code runs on better-sqlite3 and D1.
 */
import { sql, type Kysely } from "kysely";

export const name = "001_init";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("enquiries")
		.ifNotExists()
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("name", "text", (c) => c.notNull())
		.addColumn("email", "text", (c) => c.notNull())
		.addColumn("message", "text", (c) => c.notNull())
		.addColumn("subject", "text")
		.addColumn("source", "text")
		.addColumn("status", "text", (c) => c.notNull().defaultTo("new"))
		.addColumn("ip", "text")
		.addColumn("user_agent", "text")
		.addColumn("created_at", "text", (c) => c.notNull().defaultTo(sql`(datetime('now'))`))
		.addColumn("updated_at", "text", (c) => c.notNull().defaultTo(sql`(datetime('now'))`))
		.execute();

	await db.schema
		.createIndex("idx_enquiries_status_created")
		.ifNotExists()
		.on("enquiries")
		.columns(["status", "created_at"])
		.execute();
}
