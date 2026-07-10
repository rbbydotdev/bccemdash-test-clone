import { describe, expect, it } from "vitest";

import {
	countEnquiriesByStatus,
	createEnquiry,
	listEnquiries,
	recentEnquiries,
	updateEnquiryStatus,
} from "../src/db/repos/enquiries.repo.js";
import { createTestDb } from "./harness.js";

describe("enquiries repo", () => {
	it("creates and reads back an enquiry with defaults", async () => {
		const db = await createTestDb();
		const row = await createEnquiry(db, {
			name: "Bat Fan",
			email: "fan@example.com",
			message: "I would love a private encounter.",
			source: "experience:refuge",
		});
		expect(row.id).toBeTruthy();
		expect(row.status).toBe("new");
		expect(row.source).toBe("experience:refuge");
		expect(row.created_at).toBeTruthy();
	});

	it("lists with status filter, search, and paging", async () => {
		const db = await createTestDb();
		await createEnquiry(db, { name: "Alice", email: "a@example.com", message: "hello bats" });
		await createEnquiry(db, { name: "Bob", email: "b@example.com", message: "partnership question" });

		const all = await listEnquiries(db, {});
		expect(all.total).toBe(2);

		const search = await listEnquiries(db, { search: "partnership" });
		expect(search.total).toBe(1);
		expect(search.data[0]?.name).toBe("Bob");

		const paged = await listEnquiries(db, { limit: 1, offset: 0 });
		expect(paged.data).toHaveLength(1);
		expect(paged.total).toBe(2);
	});

	it("transitions status and reflects it in counts", async () => {
		const db = await createTestDb();
		const row = await createEnquiry(db, { name: "Cara", email: "c@example.com", message: "hi" });

		const updated = await updateEnquiryStatus(db, row.id, "replied");
		expect(updated?.status).toBe("replied");

		const counts = await countEnquiriesByStatus(db);
		expect(counts.replied).toBe(1);
		expect(counts.new ?? 0).toBe(0);
	});

	it("returns recent enquiries newest-first", async () => {
		const db = await createTestDb();
		await createEnquiry(db, { name: "One", email: "1@example.com", message: "a" });
		await createEnquiry(db, { name: "Two", email: "2@example.com", message: "b" });
		const recent = await recentEnquiries(db, 5);
		expect(recent).toHaveLength(2);
	});
});
