/**
 * Mint emdash Personal Access Tokens (`ec_pat_*`) so an agent can drive the
 * REST API + MCP with a Bearer token and no browser session.
 *
 * We replicate emdash's token format with Web Crypto instead of importing
 * `@emdash-cms/auth` directly — that package's bundling pulls a dependency that
 * fails to load under workerd when bundled into an app route (the handler 404s).
 * Format must match emdash's `hashPrefixedToken` so core's `resolveApiToken`
 * accepts the token: raw = `ec_pat_<base64url(32 random bytes)>`,
 * token_hash = base64url(SHA-256(utf8(raw))), both base64url with no padding.
 */
import { ulid } from "ulidx";

import type { AuthDb } from "../db/types.js";

const TOKEN_BYTES = 32;

/** Full-access admin scopes (mirrors emdash's dev-bypass token). */
export const ADMIN_SCOPES = [
	"content:read",
	"content:write",
	"media:read",
	"media:write",
	"schema:read",
	"schema:write",
	"admin",
];

function base64UrlNoPad(bytes: Uint8Array): string {
	let bin = "";
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Base64Url(input: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
	return base64UrlNoPad(new Uint8Array(digest));
}

/** Generate a PAT + its stored hash, matching emdash's format. */
async function generatePat(): Promise<{ raw: string; hash: string; prefix: string }> {
	const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
	const raw = `ec_pat_${base64UrlNoPad(bytes)}`;
	const hash = await sha256Base64Url(raw);
	return { raw, hash, prefix: raw.slice(0, "ec_pat_".length + 4) };
}

/** Constant-time string comparison (for the agent-token secret gate). */
export function secretsEqual(a: string, b: string): boolean {
	const ea = new TextEncoder().encode(a);
	const eb = new TextEncoder().encode(b);
	if (ea.length !== eb.length) return false;
	let diff = 0;
	for (let i = 0; i < ea.length; i++) diff |= ea[i]! ^ eb[i]!;
	return diff === 0;
}

export interface IssuedToken {
	token: string;
	tokenId: string;
	userId: string;
	scopes: string[];
}

/** Create a PAT for a user. Returns the raw token (shown once). */
export async function createApiToken(
	db: AuthDb,
	userId: string,
	name: string,
	scopes: string[] = ADMIN_SCOPES,
): Promise<IssuedToken> {
	const { raw, hash, prefix } = await generatePat();
	const id = ulid();
	await db
		.insertInto("_emdash_api_tokens")
		.values({
			id,
			name,
			token_hash: hash,
			prefix,
			user_id: userId,
			scopes: JSON.stringify(scopes),
			expires_at: null,
		})
		.execute();
	return { token: raw, tokenId: id, userId, scopes };
}

/** Drop any existing tokens with this name for a user (idempotent re-mint). */
export async function deleteApiTokensByName(db: AuthDb, userId: string, name: string): Promise<void> {
	await db
		.deleteFrom("_emdash_api_tokens")
		.where("user_id", "=", userId)
		.where("name", "=", name)
		.execute();
}
