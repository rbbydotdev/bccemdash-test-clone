/**
 * Resend email provider plugin (native, in-process).
 *
 * Delivers emdash's emails (enquiry notifications, magic links, invites)
 * through Resend's HTTP API. Registers `email:deliver` as an exclusive hook —
 * as the only provider configured it is auto-selected, so no admin step is
 * needed.
 *
 * Why Resend: it ships a shared sender (`onboarding@resend.dev`) that works
 * with just an API key — no domain, no DNS. Note that the shared sender only
 * delivers to the address on your own Resend account, which is exactly the
 * "notify me" case. Point `from` at your own verified domain later to email
 * anyone (and to stop landing in spam).
 *
 * @example
 * ```ts
 * // astro.config.mjs
 * import { resendEmail } from "@myemdash/plugin/resend";
 * emdash({ plugins: [sitePlugin(), resendEmail()] })
 * ```
 * Set the key as a secret: `wrangler secret put RESEND_API_KEY` (prod) or
 * `RESEND_API_KEY=...` in `.env` / the shell (local dev).
 */
import type { PluginDescriptor, ResolvedPlugin } from "emdash";
import { definePlugin } from "emdash";

import { getBccSettings } from "./settings.js";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Resend's shared sender — usable with no domain of your own. */
export const RESEND_SHARED_SENDER = "onboarding@resend.dev";

export interface ResendEmailConfig {
	/**
	 * Sender address. Defaults to Resend's shared sender, which needs no domain
	 * but only delivers to your own Resend account address. Override once you
	 * have a verified domain.
	 */
	from?: string;
	/** Optional Reply-To (e.g. so replies reach a real inbox). */
	replyTo?: string;
	/** Env var holding the API key. Default `RESEND_API_KEY`. */
	apiKeyEnv?: string;
}

/**
 * Read a secret at delivery time.
 *
 * Hooks run without request context, so this cannot come from
 * `Astro.locals.runtime`. On Workers, `cloudflare:workers` exposes the same env
 * to any bundled code; on Node we fall back to `process.env`.
 */
async function readApiKey(name: string): Promise<string | undefined> {
	try {
		// @ts-ignore - virtual module, only resolvable on the Workers runtime
		const mod = await import(/* @vite-ignore */ "cloudflare:workers");
		const env = (mod as { env?: Record<string, unknown> }).env;
		const value = env?.[name];
		if (typeof value === "string" && value) return value;
	} catch {
		// Not on workerd — fall through to process.env (Node / local dev).
	}
	if (typeof process !== "undefined" && process.env?.[name]) return process.env[name];
	return undefined;
}

/**
 * Build the `email:deliver` handler. Exported for testing — production code
 * should use {@link resendEmail}.
 *
 * @internal
 */
export function createResendDeliver(config: ResendEmailConfig = {}) {
	const apiKeyEnv = config.apiKeyEnv ?? "RESEND_API_KEY";

	return async (
		event: { message: { to: string; subject: string; text: string; html?: string } },
		ctx: { log: { info(m: string, d?: unknown): void } },
	): Promise<void> => {
		// Admin-entered settings win over the env var/secret, so the key and
		// sender can be changed from the dashboard with no redeploy. Settings are
		// read server-side only and never rendered into a page.
		const settings = await getBccSettings().catch(() => null);
		const apiKey = settings?.integrations.resendApiKey?.trim() || (await readApiKey(apiKeyEnv));
		const from = settings?.integrations.resendFrom?.trim() || config.from || RESEND_SHARED_SENDER;

		if (!apiKey) {
			throw new Error(
				`[resend-email] No API key. Add one under Site Content → Integrations → Resend API key, or set the ${apiKeyEnv} secret.`,
			);
		}

		const { message } = event;
		const res = await fetch(RESEND_ENDPOINT, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from,
				to: [message.to],
				subject: message.subject,
				text: message.text,
				...(message.html ? { html: message.html } : {}),
				...(config.replyTo ? { reply_to: config.replyTo } : {}),
			}),
		});

		if (!res.ok) {
			// Resend returns a JSON error body; surface it so misconfiguration
			// (unverified sender, wrong recipient on the shared domain) is obvious.
			const detail = await res.text().catch(() => "");
			throw new Error(`[resend-email] send failed (${res.status}): ${detail.slice(0, 300)}`);
		}

		const body = (await res.json().catch(() => ({}))) as { id?: string };
		ctx.log.info("[resend-email] delivered", { to: message.to, id: body.id });
	};
}

/** Fail fast on an obviously wrong sender rather than at send time. */
function assertValidFrom(config: ResendEmailConfig): void {
	const from = config.from;
	if (from !== undefined && !from.includes("@")) {
		throw new Error(`[resend-email] config.from must be an email address (got "${from}").`);
	}
}

/**
 * Runtime factory, loaded through the descriptor's `entrypoint` by the plugin
 * manager (native format imports the named `createPlugin` export).
 */
export function createPlugin(config: ResendEmailConfig = {}): ResolvedPlugin {
	assertValidFrom(config);
	return definePlugin({
		id: "resend-email",
		version: "1.0.0",
		capabilities: ["hooks.email-transport:register"],
		hooks: {
			"email:deliver": {
				exclusive: true,
				handler: createResendDeliver(config) as never,
			},
		},
	});
}

/**
 * Build-time descriptor for `astro.config.mjs`. Pass it in the emdash()
 * integration's `plugins` array.
 */
export function resendEmail(config: ResendEmailConfig = {}): PluginDescriptor<ResendEmailConfig> {
	assertValidFrom(config);
	return {
		id: "resend-email",
		version: "1.0.0",
		entrypoint: "@myemdash/plugin/resend",
		format: "native",
		options: config,
		capabilities: ["hooks.email-transport:register"],
	};
}

export default resendEmail;
