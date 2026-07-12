import { describe, expect, it } from "vitest";

import { checkBccRateLimit } from "../src/services/rate-limit.js";
import { createTestDb } from "./harness.js";

describe("rate limiter", () => {
	it("allows up to the max, then blocks within the window", async () => {
		const db = await createTestDb();
		const ip = "203.0.113.7";
		const results = [];
		for (let i = 0; i < 4; i++) {
			results.push(await checkBccRateLimit(db, ip, "enquiries", 3, 600));
		}
		expect(results.map((r) => r.allowed)).toEqual([true, true, true, false]);
		expect(results[3]?.count).toBe(4);
	});

	it("fails open when there is no client IP", async () => {
		const db = await createTestDb();
		const r = await checkBccRateLimit(db, null, "enquiries", 1, 600);
		expect(r.allowed).toBe(true);
	});

	it("keys are namespaced per endpoint", async () => {
		const db = await createTestDb();
		const ip = "203.0.113.8";
		await checkBccRateLimit(db, ip, "enquiries", 1, 600);
		// A different endpoint has its own counter.
		const other = await checkBccRateLimit(db, ip, "other", 1, 600);
		expect(other.allowed).toBe(true);
	});
});
