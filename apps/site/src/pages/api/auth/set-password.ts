/**
 * Set (or change) the current user's password. Requires an authenticated
 * session (you sign in with your passkey first, then set a password here).
 * Accepts JSON (fetch) or a form POST (no-JS).
 */
import type { APIRoute } from "astro";
import { passwordProblem, saveUserPassword } from "@bcc/plugin/server";

export const prerender = false;

export const POST: APIRoute = async (ctx) => {
	const { request, locals } = ctx;
	const user = locals.user as { id?: string } | undefined;

	const ct = request.headers.get("content-type") ?? "";
	const wantsJson = ct.includes("application/json");

	if (!user?.id) return fail(ctx, "You must be signed in to set a password.", 401, wantsJson);

	let password: string;
	if (wantsJson) {
		const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
		password = String(body.password ?? "");
	} else {
		const form = await request.formData();
		password = String(form.get("password") ?? "");
	}

	const problem = passwordProblem(password);
	if (problem) return fail(ctx, problem, 400, wantsJson);

	await saveUserPassword(user.id, password);

	if (wantsJson) {
		return new Response(JSON.stringify({ data: { ok: true } }), {
			headers: { "content-type": "application/json" },
		});
	}
	return ctx.redirect("/account/password?ok=1", 303);
};

function fail(
	ctx: Parameters<APIRoute>[0],
	message: string,
	status: number,
	wantsJson: boolean,
): Response {
	if (wantsJson) {
		return new Response(JSON.stringify({ error: { message } }), {
			status,
			headers: { "content-type": "application/json" },
		});
	}
	return ctx.redirect(`/account/password?error=${encodeURIComponent(message)}`, 303);
}
