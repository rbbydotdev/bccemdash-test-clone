/**
 * 002_passwords — optional email+password sign-in credentials.
 *
 * emdash is passwordless by design; this stores a PBKDF2 hash per emdash user
 * so the site can offer an email+password login in addition to passkeys. One
 * row per user (`user_id` references emdash's `users.id`).
 */
import { sql, type Kysely } from "kysely";

export const name = "002_passwords";

export async function up(db: Kysely<unknown>): Promise<void> {
	await db.schema
		.createTable("bcc_user_passwords")
		.ifNotExists()
		.addColumn("user_id", "text", (c) => c.primaryKey())
		.addColumn("password_hash", "text", (c) => c.notNull())
		.addColumn("created_at", "text", (c) => c.notNull().defaultTo(sql`(datetime('now'))`))
		.addColumn("updated_at", "text", (c) => c.notNull().defaultTo(sql`(datetime('now'))`))
		.execute();
}
