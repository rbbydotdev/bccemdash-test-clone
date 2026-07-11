/**
 * First-admin bootstrap: create the very first admin with an email + password
 * on a fresh install (no users yet), no passkey required. Strictly gated on
 * "no users exist" so it can never take over a configured site. On success we
 * set the Astro session exactly like every emdash login.
 */
import type { APIRoute } from "astro";
import { bootstrapAdmin, needsBootstrap, passwordProblem } from "@bcc/plugin/server";

export const prerender = false;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST: APIRoute = async (ctx) => {
	const { request, session } = ctx;
	if (!session) return fail(ctx, "Setup is not available right now.", 500);

	const ct = request.headers.get("content-type") ?? "";
	const wantsJson = ct.includes("application/json");

	// Someone raced us to setup, or the site is already configured.
	if (!(await needsBootstrap())) {
		return fail(ctx, "Setup is already complete. Please sign in.", 409, wantsJson, "/login");
	}

	let email: string, password: string, name: string;
	if (wantsJson) {
		const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		email = String(b.email ?? "");
		password = String(b.password ?? "");
		name = String(b.name ?? "");
	} else {
		const form = await request.formData();
		email = String(form.get("email") ?? "");
		password = String(form.get("password") ?? "");
		name = String(form.get("name") ?? "");
	}

	if (!EMAIL_RE.test(email.trim())) return fail(ctx, "Enter a valid email address.", 400, wantsJson);
	const problem = passwordProblem(password);
	if (problem) return fail(ctx, problem, 400, wantsJson);

	const origin = new URL(request.url).origin;
	const user = await bootstrapAdmin({ email, password, name }, origin);
	if (!user) {
		return fail(ctx, "Setup is already complete. Please sign in.", 409, wantsJson, "/login");
	}

	session.set("user", { id: user.id });

	if (wantsJson) {
		return new Response(JSON.stringify({ data: { ok: true } }), {
			headers: { "content-type": "application/json" },
		});
	}
	return ctx.redirect("/_emdash/admin", 303);
};

function fail(
	ctx: Parameters<APIRoute>[0],
	message: string,
	status: number,
	wantsJson = true,
	to = "/login",
): Response {
	if (wantsJson) {
		return new Response(JSON.stringify({ error: { message } }), {
			status,
			headers: { "content-type": "application/json" },
		});
	}
	return ctx.redirect(`${to}?error=${encodeURIComponent(message)}`, 303);
}
