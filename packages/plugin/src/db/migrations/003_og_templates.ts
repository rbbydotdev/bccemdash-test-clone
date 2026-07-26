/**
 * 003_og_templates — saved social-card scenes.
 *
 * One row per card design. `scene` is the JSON document the editor edits and
 * the OG worker renders; `is_active` marks the one used for the site card
 * (enforced in the repo, since SQLite has no partial-unique across updates).
 */
import { sql, type Kysely } from "kysely";

export const name = "003_og_templates";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("og_templates")
		.ifNotExists()
		.addColumn("id", "text", (c) => c.primaryKey())
		.addColumn("name", "text", (c) => c.notNull())
		.addColumn("scene", "text", (c) => c.notNull())
		.addColumn("is_active", "integer", (c) => c.notNull().defaultTo(0))
		.addColumn("created_at", "text", (c) => c.notNull().defaultTo(sql`(datetime('now'))`))
		.addColumn("updated_at", "text", (c) => c.notNull().defaultTo(sql`(datetime('now'))`))
		.execute();

	await db.schema
		.createIndex("idx_og_templates_active")
		.ifNotExists()
		.on("og_templates")
		.column("is_active")
		.execute();
}
