/**
 * Runtime server helpers used by the injected Astro auth routes (`emdash-auth/server`).
 *
 * All DB access goes through emdash's runtime `getDb()` (not `locals.emdash.db`):
 * anonymous, non-`/_emdash` routes — like the login POST — hit emdash's
 * "anonymous fast path" which never populates `locals.emdash.db`. `getDb()` is
 * the same ALS-backed handle the public site uses. The login/bootstrap helpers
 * only VERIFY/CREATE the credential and return the user; the route sets the
 * Astro session (`session.set("user", { id })`) exactly like every built-in
 * emdash login route.
 */
import { OptionsRepository } from "emdash";
import { getDb } from "emdash/runtime";
import type { Kysely } from "kysely";

import { ensureAuthMigrations } from "./db/migrator.js";
import type { AuthDatabase, AuthDb } from "./db/types.js";
import {
	createApiToken,
	deleteApiTokensByName,
	secretsEqual,
	type IssuedToken,
} from "./services/api-token.js";
import {
	countUsers,
	createAdminUser,
	createFirstAdmin,
	setUserPassword,
	verifyUserPassword,
	type AuthedUser,
} from "./services/auth.js";
import { checkAuthRateLimit } from "./services/rate-limit.js";

export type { IssuedToken, AuthedUser };
export { passwordProblem } from "./services/password.js";

/** Get the site's Kysely handle, with emdash-auth migrations ensured. */
export async function getAuthDb(): Promise<AuthDb> {
	const db = (await getDb()) as unknown as Kysely<AuthDatabase>;
	await ensureAuthMigrations(db as Kysely<unknown>);
	return db;
}

/** Verify an email+password credential. Returns the user or null. */
export async function verifyLogin(email: unknown, password: unknown): Promise<AuthedUser | null> {
	return verifyUserPassword(await getAuthDb(), email, password);
}

/** Set (or replace) a user's password. */
export async function saveUserPassword(userId: string, password: string): Promise<void> {
	await setUserPassword(await getAuthDb(), userId, password);
}

/** Rate-limit login attempts (default 10 per 10 minutes per IP). Fail-open. */
export async function checkLoginRateLimit(ip: string | null, max = 10, windowSeconds = 600): Promise<boolean> {
	const r = await checkAuthRateLimit(await getAuthDb(), ip, "login", max, windowSeconds);
	return r.allowed;
}

/** True when no user exists yet — the first-admin bootstrap is available. */
export async function needsBootstrap(): Promise<boolean> {
	try {
		return (await countUsers(await getAuthDb())) === 0;
	} catch {
		return false;
	}
}

export interface SetupContext {
	origin?: string;
	siteName?: string;
}

/**
 * First-admin bootstrap: create the first admin with an email+password (no
 * passkey needed) and mark setup complete. Returns null if a user already
 * exists (the site is already configured). The caller sets the session.
 */
export async function bootstrapAdmin(
	input: { email: string; password: string; name?: string | null },
	ctx: SetupContext = {},
): Promise<AuthedUser | null> {
	const user = await createFirstAdmin(await getAuthDb(), input);
	if (!user) return null;
	await markSetupComplete(ctx);
	return user;
}

/** Mark the emdash site as set up (skips the built-in setup wizard). */
export async function markSetupComplete(ctx: SetupContext = {}): Promise<void> {
	const options = new OptionsRepository((await getDb()) as never);
	await options.set("emdash:setup_complete", true);
	if (ctx.origin) await options.set("emdash:site_url", ctx.origin);
	if (ctx.siteName && !(await options.get("emdash:site_title"))) {
		await options.set("emdash:site_title", ctx.siteName);
	}
}

export interface IssueAgentTokenOptions extends SetupContext {
	email?: string;
	name?: string;
}

/**
 * Agent access: mint a full-access admin API token (`ec_pat_*`) with no browser
 * session. Finds or creates an admin user, marks setup complete if the site was
 * fresh, and returns a Bearer token for the REST API and MCP (`/_emdash/api/mcp`).
 * The CALLER must gate this on a shared secret.
 */
export async function issueAgentToken(opts: IssueAgentTokenOptions = {}): Promise<IssuedToken> {
	const db = await getAuthDb();
	const email = (opts.email || "agent@localhost").trim();
	const wasFresh = (await countUsers(db)) === 0;
	const user = await createAdminUser(db, { email, name: opts.name ?? "Automation Agent" });
	if (wasFresh) await markSetupComplete(opts);
	// Idempotent: replace any prior agent token so we never accumulate rows.
	await deleteApiTokensByName(db, user.id, "agent-token");
	return createApiToken(db, user.id, "agent-token");
}

/** Optionally mint a token for a freshly-bootstrapped admin. */
export async function issueTokenFor(userId: string, name = "bootstrap-token"): Promise<IssuedToken> {
	const db = await getAuthDb();
	await deleteApiTokensByName(db, userId, name);
	return createApiToken(db, userId, name);
}

/** Constant-time secret comparison (for the agent-token endpoint gate). */
export function secretsMatch(a: string, b: string): boolean {
	return secretsEqual(a, b);
}
