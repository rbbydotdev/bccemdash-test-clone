import { describe, expect, it } from "vitest";

import { hashPassword, passwordProblem, verifyPassword } from "../src/services/password.js";

describe("password hashing", () => {
	it("round-trips a correct password", async () => {
		const hash = await hashPassword("batcity-nightsky-2026");
		expect(hash.startsWith("pbkdf2$sha256$")).toBe(true);
		expect(await verifyPassword("batcity-nightsky-2026", hash)).toBe(true);
	});

	it("rejects a wrong password", async () => {
		const hash = await hashPassword("correct horse battery staple");
		expect(await verifyPassword("wrong password", hash)).toBe(false);
	});

	it("produces a distinct hash each time (random salt)", async () => {
		const a = await hashPassword("same-password-123");
		const b = await hashPassword("same-password-123");
		expect(a).not.toEqual(b);
		expect(await verifyPassword("same-password-123", a)).toBe(true);
		expect(await verifyPassword("same-password-123", b)).toBe(true);
	});

	it("rejects malformed stored hashes", async () => {
		expect(await verifyPassword("x", "not-a-hash")).toBe(false);
		expect(await verifyPassword("x", "")).toBe(false);
	});

	it("enforces a minimum length", () => {
		expect(passwordProblem("short")).toMatch(/10 characters/);
		expect(passwordProblem("this-is-long-enough")).toBeNull();
		expect(passwordProblem(123)).toMatch(/required/);
	});
});
