/**
 * Agent access: POST here with the shared bootstrap secret to receive a
 * full-access admin API token (`ec_pat_*`), with no browser/passkey needed. Use
 * it as `Authorization: Bearer <token>` against the REST API (/_emdash/api/*)
 * and MCP (/_emdash/api/mcp). Lets an automation agent set up and drive a fresh
 * (or existing) site.
 *
 * Disabled unless `BCC_BOOTSTRAP_SECRET` is set (a Cloudflare secret / env var);
 * the caller must present the same value via the `x-bootstrap-secret` header or
 * a `secret` field. Returns the raw token once — store it.
 */
import type { APIRoute } from "astro";
import { issueAgentToken, secretsMatch } from "@bcc/plugin/server";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
	const configured = typeof process !== "undefined" ? process.env?.BCC_BOOTSTRAP_SECRET : undefined;
	if (!configured) {
		return json({ error: { message: "Agent token issuance is not enabled." } }, 403);
	}

	let body: Record<string, unknown> = {};
	if ((request.headers.get("content-type") ?? "").includes("application/json")) {
		body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
	}
	const presented = request.headers.get("x-bootstrap-secret") ?? String(body.secret ?? "");
	if (!presented || !secretsMatch(presented, configured)) {
		return json({ error: { message: "Forbidden." } }, 403);
	}

	const issued = await issueAgentToken({
		email: typeof body.email === "string" ? body.email : undefined,
		name: typeof body.name === "string" ? body.name : undefined,
		origin: new URL(request.url).origin,
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
