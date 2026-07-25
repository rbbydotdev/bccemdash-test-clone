/**
 * Public routes (no session; POSTs self-check CSRF header + rate limit).
 *
 * `enquiries` — the contact form. Guards, in order: method → CSRF header →
 * rate limit → honeypot → optional Turnstile → validate → insert → best-effort
 * notify. Returns `{ id }`.
 */
import type { RouteContext } from "emdash";

import { createEnquiry, toEnquiryDTO } from "../db/repos/enquiries.repo.js";
import { fail } from "../errors.js";
import { sendEnquiryNotification, type EmailCapableCtx } from "../services/emails.js";
import { verifyTurnstileToken } from "../services/turnstile.js";
import { getBccSettings } from "../settings.js";
import {
	asRecord,
	enforceRateLimit,
	getBccDb,
	readEmail,
	readString,
	requireCsrfHeader,
	requireMethod,
} from "./helpers.js";

export async function publicEnquiryHandler(ctx: RouteContext): Promise<unknown> {
	requireMethod(ctx, "POST");
	requireCsrfHeader(ctx);
	await enforceRateLimit(ctx, "enquiries");

	const body = asRecord(ctx.input);

	// Honeypot: a hidden field bots fill in. Silently accept (200) to avoid
	// signalling the trap, but store nothing.
	const trap = readString(body, "website");
	if (trap) return { id: "ok" };

	const settings = await getBccSettings();
	const token = readString(body, "turnstileToken");
	const ip = ctx.requestMeta?.ip ?? null;
	if (!(await verifyTurnstileToken(token, ip))) {
		fail("turnstile_failed", "Verification failed. Please try again.");
	}

	const name = readString(body, "name", { required: true, maxLength: 200 })!;
	const email = readEmail(body, "email", { required: true, maxLength: 320 })!;
	const message = readString(body, "message", { required: true, maxLength: 5000 })!;
	const subject = readString(body, "subject", { maxLength: 200 }) ?? null;
	const source = readString(body, "source", { maxLength: 120 }) ?? null;

	const db = await getBccDb();
	const enquiry = await createEnquiry(db, {
		name,
		email,
		message,
		subject,
		source,
		ip,
		userAgent: ctx.request.headers.get("user-agent"),
	});

	const notifyTo = settings.integrations.notificationEmail || null;
	await sendEnquiryNotification(ctx as unknown as EmailCapableCtx, toEnquiryDTO(enquiry), notifyTo);

	return { id: enquiry.id };
}
