/**
 * Email+password auth service, layered on emdash's `users` table.
 *
 * These take a Kysely handle (the host app passes `locals.emdash.db`) so they
 * run inside an Astro route where the session lives. Login only VERIFIES the
 * credential and returns the user id; the caller does `session.set("user", …)`
 * exactly like every built-in emdash login route.
 */
import type { BccDb } from "../db/types.js";
import { getPasswordHash, upsertPassword } from "../db/repos/passwords.repo.js";
import { hashPassword, verifyPassword } from "./password.js";

export interface AuthedUser {
	id: string;
	email: string;
	role: number;
}

export async function findUserByEmail(db: BccDb, email: string): Promise<AuthedUser | null> {
	const row = await db
		.selectFrom("users")
		.select(["id", "email", "role", "disabled"])
		.where("email", "=", email.trim().toLowerCase())
		.executeTakeFirst();
	if (!row || row.disabled) return null;
	return { id: row.id, email: row.email, role: row.role };
}

/**
 * Verify an email+password credential. Returns the user on success, null on any
 * failure (unknown email, no password set, wrong password, disabled) — the
 * caller returns a single generic error so the two cases are indistinguishable.
 */
export async function verifyUserPassword(
	db: BccDb,
	email: unknown,
	password: unknown,
): Promise<AuthedUser | null> {
	if (typeof email !== "string" || typeof password !== "string" || !email || !password) return null;
	const user = await findUserByEmail(db, email);
	if (!user) return null;
	const stored = await getPasswordHash(db, user.id);
	if (!stored) return null;
	return (await verifyPassword(password, stored)) ? user : null;
}

/** Set (or replace) a user's password. */
export async function setUserPassword(db: BccDb, userId: string, password: string): Promise<void> {
	await upsertPassword(db, userId, await hashPassword(password));
}
