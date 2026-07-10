/**
 * Server-side entrypoints for the host Astro app (`@bcc/plugin/server`).
 *
 * For flows where a page must call BCC-domain logic in-process rather than over
 * HTTP — a Worker cannot fetch() its own route on the same zone, so the contact
 * page's no-JS POST fallback goes through here.
 */
import { createEnquiry, toEnquiryDTO, type EnquiryDTO } from "./db/repos/enquiries.repo.js";
import { getBccDb } from "./routes/helpers.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SubmitEnquiryResult = { ok: true; id: string; enquiry: EnquiryDTO } | { ok: false; message: string };

/**
 * Validate + store a contact enquiry. Mirrors the public route's checks. NOTE:
 * the route's per-IP rate limit does not apply on this in-process path —
 * callers should keep the honeypot (and Turnstile, when added) in front of it.
 */
export async function submitEnquiry(input: {
	name: unknown;
	email: unknown;
	message: unknown;
	subject?: unknown;
	source?: unknown;
	ip?: unknown;
	userAgent?: unknown;
}): Promise<SubmitEnquiryResult> {
	const name = typeof input.name === "string" ? input.name.trim() : "";
	const email = typeof input.email === "string" ? input.email.trim() : "";
	const message = typeof input.message === "string" ? input.message.trim() : "";
	const subject = typeof input.subject === "string" && input.subject ? input.subject.trim() : null;
	const source = typeof input.source === "string" && input.source ? input.source.trim() : null;
	const ip = typeof input.ip === "string" && input.ip ? input.ip : null;
	const userAgent = typeof input.userAgent === "string" && input.userAgent ? input.userAgent : null;

	if (!name || !email || !message) {
		return { ok: false, message: "Please fill in your name, email, and message." };
	}
	if (name.length > 200 || message.length > 5000 || email.length > 320) {
		return { ok: false, message: "One of the fields is too long." };
	}
	if (!EMAIL_PATTERN.test(email)) {
		return { ok: false, message: "Please enter a valid email address." };
	}

	const db = await getBccDb();
	const row = await createEnquiry(db, { name, email, message, subject, source, ip, userAgent });
	return { ok: true, id: row.id, enquiry: toEnquiryDTO(row) };
}
