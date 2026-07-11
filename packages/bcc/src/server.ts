/**
 * Server-side entrypoints for the host Astro app (`@bcc/plugin/server`).
 *
 * For flows where a page must call BCC-domain logic in-process rather than over
 * HTTP — a Worker cannot fetch() its own route on the same zone, so the contact
 * page's no-JS POST fallback goes through here.
 */
import { createEnquiry, toEnquiryDTO, type EnquiryDTO } from "./db/repos/enquiries.repo.js";
import { getBccDb } from "./routes/helpers.js";
import { setUserPassword, verifyUserPassword, type AuthedUser } from "./services/auth.js";
import { checkBccRateLimit } from "./services/rate-limit.js";

export { passwordProblem } from "./services/password.js";
export type { AuthedUser };

/**
 * Email+password helpers for the host app's Astro auth routes.
 *
 * These resolve the db via emdash's `getDb()` (through `getBccDb`) rather than
 * `locals.emdash.db`, because anonymous, non-`/_emdash` routes (like the login
 * POST) hit emdash's "anonymous fast path" which never populates
 * `locals.emdash.db`. `getDb()` works there — it is the same ALS-backed handle
 * the public site uses to read content. `verifyLogin` only checks the
 * credential; the route sets the Astro session.
 */
export async function verifyLogin(email: unknown, password: unknown): Promise<AuthedUser | null> {
	const db = await getBccDb();
	return verifyUserPassword(db, email, password);
}

export async function saveUserPassword(userId: string, password: string): Promise<void> {
	const db = await getBccDb();
	await setUserPassword(db, userId, password);
}

/** Rate-limit login attempts (default 10 per 10 minutes per IP). Fail-open. */
export async function checkLoginRateLimit(ip: string | null): Promise<boolean> {
	const db = await getBccDb();
	const r = await checkBccRateLimit(db, ip, "auth-login", 10, 600);
	return r.allowed;
}

// Re-export settings helpers so the host Astro app reads/writes the
// client-editable "Site Content" bag in-process (server-side only).
export {
	getBccSettings,
	setBccSettings,
	BCC_DEFAULTS,
	DEFAULT_DEVOTE_URL,
	type BccSettings,
} from "./settings.js";

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
