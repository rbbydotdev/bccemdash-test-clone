/**
 * Agent access: POST here with the shared secret to receive a full-access admin
 * API token (`ec_pat_*`), no browser/passkey needed. Use it as
 * `Authorization: Bearer <token>` against the REST API (/_emdash/api/*) and MCP
 * (/_emdash/api/mcp). Lets an automation agent set up and drive a fresh (or
 * existing) site.
 *
 * Disabled unless the configured secret env var (default `EMDASH_AGENT_SECRET`)
 * is set (a Cloudflare secret / env var); the caller presents the same value via
 * the `x-agent-secret` header or a `secret` field. Returns the raw token once.
 */
import type { APIRoute } from "astro";
import { getSecret } from "astro:env/server";
import { issueAgentToken, secretsMatch } from "emdash-auth/server";
import { config } from "virtual:emdash-auth/config";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	// getSecret() reads env/secrets portably across the Node and Cloudflare
	// adapters (locals.runtime.env was removed in Astro v6 and throws on workerd).
	const configured = getSecret(config.secretEnv);
	if (!configured) {
		return json({ error: { message: "Agent token issuance is not enabled." } }, 403);
	}

	let body: Record<string, unknown> = {};
	if ((request.headers.get("content-type") ?? "").includes("application/json")) {
		body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	}
	// Accept the modern header and the legacy `x-bootstrap-secret` for compatibility.
	const presented =
		request.headers.get("x-agent-secret") ??
		request.headers.get("x-bootstrap-secret") ??
		String(body.secret ?? "");
	if (!presented || !secretsMatch(presented, configured)) {
		return json({ error: { message: "Forbidden." } }, 403);
	}

	const email =
		(typeof body.email === "string" && body.email ? body.email : undefined) ??
		getSecret(config.agentEmailEnv) ??
		config.defaultAgentEmail;

	const issued = await issueAgentToken({
		email,
		name: typeof body.name === "string" ? body.name : undefined,
		origin: new URL(request.url).origin,
		siteName: config.siteName,
	});

	return json({
		data: {
			token: issued.token,
			userId: issued.userId,
			scopes: issued.scopes,
			usage: {
				rest: "Authorization: Bearer <token> against /_emdash/api/*",
				mcp: `${new URL(request.url).origin}/_emdash/api/mcp`,
			},
		},
	});
};

function json(payload: unknown, status = 200): Response {
	return new Response(JSON.stringify(payload), {
		status,
		headers: { "content-type": "application/json" },
	});
}
