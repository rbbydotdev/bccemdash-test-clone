/**
 * Cloudflare Turnstile verification.
 *
 * The secret lives in the TURNSTILE_SECRET_KEY server secret, never in the
 * client-editable settings bag (only the public site key belongs there).
 * When no secret is configured (local dev) verification is skipped so the
 * form still works.
 */
import { readEnvSecret } from "./env.js";

const SITEVERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Verify a Turnstile token against Cloudflare. Returns true when the token is
 * valid, or when no secret is configured. Never throws — a network failure
 * fails closed (false) so a broken siteverify can't wave bots through.
 */
export async function verifyTurnstile(
	token: string | undefined,
	secret: string | undefined,
	ip: string | null,
): Promise<boolean> {
	if (!secret) return true; // not configured (dev) → skip
	if (!token) return false;
	try {
		const body = new FormData();
		body.append("secret", secret);
		body.append("response", token);
		if (ip) body.append("remoteip", ip);
		const res = await fetch(SITEVERIFY_URL, { method: "POST", body });
		const data = (await res.json()) as { success?: boolean };
		return data.success === true;
	} catch {
		return false;
	}
}

/** Verify a token, resolving the secret from the environment itself. */
export async function verifyTurnstileToken(
	token: string | undefined,
	ip: string | null,
): Promise<boolean> {
	const secret = await readEnvSecret("TURNSTILE_SECRET_KEY");
	return verifyTurnstile(token, secret, ip);
}
