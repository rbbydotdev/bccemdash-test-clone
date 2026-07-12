/**
 * Email+password auth service, layered on emdash's `users` table.
 *
 * These take a Kysely handle (resolved via emdash's runtime `getDb()`) so they
 * run inside an Astro route where the session lives. Login only VERIFIES the
 * credential and returns the user id; the caller does `session.set("user", …)`
 * exactly like every built-in emdash login route. Password storage lives in our
 * own `_auth_user_passwords` table (repo functions inlined below).
 */
import { ulid } from "ulidx";

import type { AuthDb } from "../db/types.js";
import { hashPassword, verifyPassword } from "./password.js";

export const ROLE_ADMIN = 50;

export interface AuthedUser {
	id: string;
	email: string;
	role: number;
}

// --- password-credential storage (one row per emdash user) -------------------

async function getPasswordHash(db: AuthDb, userId: string): Promise<string | null> {
	const row = await db
		.selectFrom("_auth_user_passwords")
		.select("password_hash")
		.where("user_id", "=", userId)
		.executeTakeFirst();
	return row?.password_hash ?? null;
}

async function upsertPassword(db: AuthDb, userId: string, hash: string): Promise<void> {
	await db
		.insertInto("_auth_user_passwords")
		.values({ user_id: userId, password_hash: hash })
		.onConflict((oc) =>
			oc.column("user_id").doUpdateSet({ password_hash: hash, updated_at: new Date().toISOString() }),
		)
		.execute();
}

export async function deletePassword(db: AuthDb, userId: string): Promise<void> {
	await db.deleteFrom("_auth_user_passwords").where("user_id", "=", userId).execute();
}

// --- users -------------------------------------------------------------------

/** Count existing users — bootstrap (first-admin) is only allowed when zero. */
export async function countUsers(db: AuthDb): Promise<number> {
	const row = await db
		.selectFrom("users")
		.select((eb) => eb.fn.countAll<number>().as("n"))
		.executeTakeFirst();
	return Number(row?.n ?? 0);
}

/** Create an admin user (no gating). Reuses an existing row for the email. */
export async function createAdminUser(
	db: AuthDb,
	input: { email: string; name?: string | null },
): Promise<AuthedUser> {
	const email = input.email.trim().toLowerCase();
	const existing = await findUserByEmail(db, email);
	if (existing) return existing;

	const id = ulid();
	const now = new Date().toISOString();
	await db
		.insertInto("users")
		.values({
			id,
			email,
			name: input.name?.trim() || null,
			role: ROLE_ADMIN,
			// email_verified/created_at/updated_at exist on the emdash users table;
			// cast through the read-only slice type which omits them.
			...({ email_verified: 1, created_at: now, updated_at: now } as Record<string, unknown>),
		} as never)
		.execute();
	return { id, email, role: ROLE_ADMIN };
}

/**
 * Create the first admin user with an email+password credential. Guards on
 * "no users exist" so it can never take over an already-configured site.
 * Returns null if a user already exists.
 */
export async function createFirstAdmin(
	db: AuthDb,
	input: { email: string; password: string; name?: string | null },
): Promise<AuthedUser | null> {
	if ((await countUsers(db)) > 0) return null;
	const user = await createAdminUser(db, { email: input.email, name: input.name });
	await upsertPassword(db, user.id, await hashPassword(input.password));
	return user;
}

export async function findUserByEmail(db: AuthDb, email: string): Promise<AuthedUser | null> {
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
	db: AuthDb,
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
export async function setUserPassword(db: AuthDb, userId: string, password: string): Promise<void> {
	await upsertPassword(db, userId, await hashPassword(password));
}
