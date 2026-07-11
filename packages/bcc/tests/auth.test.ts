import { describe, expect, it } from "vitest";

import { ADMIN_SCOPES, createApiToken } from "../src/services/api-token.js";
import {
	ROLE_ADMIN,
	createAdminUser,
	countUsers,
	createFirstAdmin,
	setUserPassword,
	verifyUserPassword,
} from "../src/services/auth.js";
import { createTestDb } from "./harness.js";

describe("first-admin bootstrap", () => {
	it("creates the first admin with an email+password, then blocks a second", async () => {
		const db = await createTestDb();
		expect(await countUsers(db)).toBe(0);

		const admin = await createFirstAdmin(db, {
			email: "Admin@BatCity.org",
			password: "guardians-of-the-night-2026",
			name: "Teresa",
		});
		expect(admin).not.toBeNull();
		expect(admin?.role).toBe(ROLE_ADMIN);
		expect(admin?.email).toBe("admin@batcity.org"); // normalized

		// The credential works via the normal login path.
		const login = await verifyUserPassword(db, "admin@batcity.org", "guardians-of-the-night-2026");
		expect(login?.id).toBe(admin?.id);

		// Bootstrap is one-shot: a second attempt returns null (site configured).
		const second = await createFirstAdmin(db, {
			email: "someone@else.com",
			password: "another-strong-password",
		});
		expect(second).toBeNull();
		expect(await countUsers(db)).toBe(1);
	});

	it("mints an ec_pat_ admin API token for an agent", async () => {
		const db = await createTestDb();
		const admin = await createAdminUser(db, { email: "agent@bcc.local", name: "Agent" });
		const issued = await createApiToken(db, admin.id, "agent-token");
		expect(issued.token.startsWith("ec_pat_")).toBe(true);
		expect(issued.scopes).toEqual(ADMIN_SCOPES);

		// Row is stored with a hash, not the raw token.
		const row = await db
			.selectFrom("_emdash_api_tokens")
			.selectAll()
			.where("id", "=", issued.tokenId)
			.executeTakeFirst();
		expect(row?.user_id).toBe(admin.id);
		expect(row?.token_hash).toBeTruthy();
		expect(row?.token_hash).not.toEqual(issued.token);
	});

	it("verifies against an existing user without a password set", async () => {
		const db = await createTestDb();
		const admin = await createFirstAdmin(db, { email: "a@b.com", password: "the-first-password-1" });
		expect(admin).not.toBeNull();
		// changing the password still verifies
		await setUserPassword(db, admin!.id, "the-second-password-2");
		expect(await verifyUserPassword(db, "a@b.com", "the-first-password-1")).toBeNull();
		expect(await verifyUserPassword(db, "a@b.com", "the-second-password-2")).not.toBeNull();
	});
});
