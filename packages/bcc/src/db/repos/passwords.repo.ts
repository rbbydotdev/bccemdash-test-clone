/** Password-credential storage (one row per emdash user). */
import type { BccDb } from "../types.js";

export async function getPasswordHash(db: BccDb, userId: string): Promise<string | null> {
	const row = await db
		.selectFrom("bcc_user_passwords")
		.select("password_hash")
		.where("user_id", "=", userId)
		.executeTakeFirst();
	return row?.password_hash ?? null;
}

export async function upsertPassword(db: BccDb, userId: string, hash: string): Promise<void> {
	await db
		.insertInto("bcc_user_passwords")
		.values({ user_id: userId, password_hash: hash })
		.onConflict((oc) =>
			oc.column("user_id").doUpdateSet({ password_hash: hash, updated_at: new Date().toISOString() }),
		)
		.execute();
}

export async function deletePassword(db: BccDb, userId: string): Promise<void> {
	await db.deleteFrom("bcc_user_passwords").where("user_id", "=", userId).execute();
}
