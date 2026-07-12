/**
 * Email + password sign-in. emdash is passwordless (passkey / magic-link /
 * OAuth); this adds an optional password login. On success we set the Astro
 * session the exact same way every built-in emdash login route does
 * (`session.set("user", { id })`), so the user is a normal admin afterward.
 *
 * Accepts a JSON body (fetch) or a form POST (no-JS). Errors are generic so we
 * never reveal whether an email exists.
 */
import type { APIRoute } from "astro";
import { checkLoginRateLimit, verifyLogin } from "emdash-auth/server";
import { config } from "virtual:emdash-auth/config";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
	const { request, session, redirect, clientAddress } = ctx;
	if (!session) {
		return fail(ctx, "Sign-in is not available right now.", 500);
	}

	const { email, password, wantsJson } = await readCredentials(request);

	if (!(await checkLoginRateLimit(clientAddress ?? null))) {
		return fail(ctx, "Too many attempts. Please wait a few minutes and try again.", 429, wantsJson);
	}

	const user = await verifyLogin(email, password);
	if (!user) {
		return fail(ctx, "Invalid email or password.", 401, wantsJson);
	}

	session.set("user", { id: user.id });

	if (wantsJson) {
		return new Response(JSON.stringify({ data: { ok: true } }), {
			headers: { "content-type": "application/json" },
		});
	}
	return redirect(config.loginRedirect, 303);
};

async function readCredentials(
	request: Request,
): Promise<{ email: string; password: string; wantsJson: boolean }> {
	const ct = request.headers.get("content-type") ?? "";
	if (ct.includes("application/json")) {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		return {
			email: String(body.email ?? ""),
			password: String(body.password ?? ""),
			wantsJson: true,
		};
	}
	const form = await request.formData();
	return {
		email: String(form.get("email") ?? ""),
		password: String(form.get("password") ?? ""),
		wantsJson: false,
	};
}

function fail(
	ctx: Parameters<APIRoute>[0],
	message: string,
	status: number,
	wantsJson = true,
): Response {
	if (wantsJson) {
		return new Response(JSON.stringify({ error: { message } }), {
			status,
			headers: { "content-type": "application/json" },
		});
	}
	return ctx.redirect(`${config.loginPath}?error=${encodeURIComponent(message)}`, 303);
}
