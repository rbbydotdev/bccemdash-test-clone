/**
 * Enquiry notification email.
 *
 * Sent through emdash's email pipeline (`ctx.email`, `email:send` capability).
 * In dev the built-in console transport delivers to the server log; in prod
 * whichever provider the admin configured. When no provider is configured
 * `ctx.email` is undefined and we log + skip — notifications are best-effort
 * and never fail the enquiry insert.
 */
import type { EnquiryDTO } from "../db/repos/enquiries.repo.js";

/** Structural slice of PluginContext we need (avoids importing emdash). */
export interface EmailCapableCtx {
	email?: { send(message: { to: string; subject: string; text: string }): Promise<void> };
	log: {
		info(message: string, data?: unknown): void;
		warn(message: string, data?: unknown): void;
	};
}

export function buildEnquiryEmail(enquiry: EnquiryDTO): { subject: string; text: string } {
	const lines = [
		`New enquiry from ${enquiry.name} <${enquiry.email}>`,
		enquiry.subject ? `Subject: ${enquiry.subject}` : null,
		enquiry.source ? `Source: ${enquiry.source}` : null,
		"",
		enquiry.message,
		"",
		"— Bat City Council",
	].filter((l): l is string => l !== null);
	return {
		subject: `New enquiry: ${enquiry.subject ?? enquiry.name}`,
		text: lines.join("\n"),
	};
}

/**
 * Notify the agency of a new enquiry; never throws (logged best-effort).
 * `to` is the notification address from plugin settings.
 */
export async function sendEnquiryNotification(
	ctx: EmailCapableCtx,
	enquiry: EnquiryDTO,
	to: string | null,
): Promise<void> {
	if (!to) return;
	if (!ctx.email) {
		ctx.log.info("[bcc] email provider not configured — skipping enquiry notification", {
			id: enquiry.id,
		});
		return;
	}
	try {
		await ctx.email.send({ to, ...buildEnquiryEmail(enquiry) });
	} catch (error) {
		ctx.log.warn("[bcc] failed to send enquiry notification", {
			id: enquiry.id,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}
