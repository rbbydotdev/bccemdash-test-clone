/**
 * Email+password auth service, layered on emdash's `users` table.
 *
 * These take a Kysely handle (the host app passes `locals.emdash.db`) so they
 * run inside an Astro route where the session lives. Login only VERIFIES the
 * credential and returns the user id; the caller does `session.set("user", …)`
 * exactly like every built-in emdash login route.
 */
import { ulid } from "ulidx";

import type { BccDb } from "../db/types.js";
import { getPasswordHash, upsertPassword } from "../db/repos/passwords.repo.js";
import { hashPassword, verifyPassword } from "./password.js";

export const ROLE_ADMIN = 50;

export interface AuthedUser {
	id: string;
	email: string;
	role: number;
}

/** Count existing users — bootstrap (first-admin) is only allowed when zero. */
export async function countUsers(db: BccDb): Promise<number> {
	const row = await db
		.selectFrom("users")
		.select((eb) => eb.fn.countAll<number>().as("n"))
		.executeTakeFirst();
	return Number(row?.n ?? 0);
}

/** Create an admin user (no gating). Reuses an existing row for the email. */
export async function createAdminUser(
	db: BccDb,
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
	db: BccDb,
	input: { email: string; password: string; name?: string | null },
): Promise<AuthedUser | null> {
	if ((await countUsers(db)) > 0) return null;
	const user = await createAdminUser(db, { email: input.email, name: input.name });
	await upsertPassword(db, user.id, await hashPassword(input.password));
	return user;
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
