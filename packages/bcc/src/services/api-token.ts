/**
 * Mint emdash Personal Access Tokens (`ec_pat_*`) so an agent can drive the
 * REST API + MCP with a Bearer token and no browser session. Matches emdash's
 * own token format (generatePrefixedToken + the `_emdash_api_tokens` row shape)
 * so core's Bearer auth (`resolveApiToken`) accepts them.
 */
import { generatePrefixedToken } from "@emdash-cms/auth";
import { ulid } from "ulidx";

import type { BccDb } from "../db/types.js";

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

export interface IssuedToken {
	token: string;
	tokenId: string;
	userId: string;
	scopes: string[];
}

/** Create a PAT for a user. Returns the raw token (shown once). */
export async function createApiToken(
	db: BccDb,
	userId: string,
	name: string,
	scopes: string[] = ADMIN_SCOPES,
): Promise<IssuedToken> {
	const { raw, hash, prefix } = generatePrefixedToken("ec_pat_");
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
export async function deleteApiTokensByName(db: BccDb, userId: string, name: string): Promise<void> {
	await db
		.deleteFrom("_emdash_api_tokens")
		.where("user_id", "=", userId)
		.where("name", "=", name)
		.execute();
}
