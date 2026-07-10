/**
 * Public routes (no session; POSTs self-check CSRF header + rate limit).
 *
 * `enquiries` — the contact form. Guards, in order: method → CSRF header →
 * rate limit → honeypot → optional Turnstile → validate → insert → best-effort
 * notify. Returns `{ id }`.
 */
import { getSiteSettings, type RouteContext } from "emdash";

import { createEnquiry, toEnquiryDTO } from "../db/repos/enquiries.repo.js";
import { sendEnquiryNotification, type EmailCapableCtx } from "../services/emails.js";
import {
	asRecord,
	enforceRateLimit,
	getBccDb,
	readEmail,
	readString,
	requireCsrfHeader,
	requireMethod,
} from "./helpers.js";

/** Verify a Cloudflare Turnstile token when a secret is configured. */
async function verifyTurnstile(token: string | undefined, secret: string | undefined, ip: string | null): Promise<boolean> {
	if (!secret) return true; // not configured (dev) → skip
	if (!token) return false;
	try {
		const body = new FormData();
		body.append("secret", secret);
		body.append("response", token);
		if (ip) body.append("remoteip", ip);
		const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
			method: "POST",
			body,
		});
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch {
		return false;
	}
}

async function readSettings(): Promise<Record<string, unknown>> {
	try {
		return ((await getSiteSettings()) as Record<string, unknown>) ?? {};
	} catch {
		return {};
	}
}

export async function publicEnquiryHandler(ctx: RouteContext): Promise<unknown> {
	requireMethod(ctx, "POST");
	requireCsrfHeader(ctx);
	await enforceRateLimit(ctx, "enquiries");

	const body = asRecord(ctx.input);

	// Honeypot: a hidden field bots fill in. Silently accept (200) to avoid
	// signalling the trap, but store nothing.
	const trap = readString(body, "website");
	if (trap) return { id: "ok" };

	const settings = await readSettings();
	const turnstileSecret =
		(settings.bcc_turnstile_secret as string | undefined) ||
		(typeof process !== "undefined" ? process.env?.TURNSTILE_SECRET_KEY : undefined);
	const token = readString(body, "turnstileToken");
	const ip = ctx.requestMeta?.ip ?? null;
	if (!(await verifyTurnstile(token, turnstileSecret, ip))) {
		return { error: { code: "turnstile_failed", message: "Verification failed. Please try again." } };
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

	const notifyTo = (settings.bcc_notification_email as string | undefined) ?? null;
	await sendEnquiryNotification(ctx as unknown as EmailCapableCtx, toEnquiryDTO(enquiry), notifyTo);

	return { id: enquiry.id };
}
