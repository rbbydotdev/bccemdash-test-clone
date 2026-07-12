/**
 * No-JS contact fallback. The form posts here (form-encoded); we call the
 * plugin's in-process submitEnquiry (a Worker cannot fetch its own route on the
 * same zone) and redirect back to #contact with a status flag. The JS path
 * posts JSON straight to /_emdash/api/plugins/bcc/enquiries instead.
 */
import type { APIRoute } from "astro";
import { submitEnquiry } from "@myemdash/plugin/server";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
	const form = await request.formData();

	// Honeypot: silently redirect as success.
	if (form.get("website")) {
		return redirect("/?enquiry=ok#contact");
	}

	const result = await submitEnquiry({
		name: form.get("name"),
		email: form.get("email"),
		message: form.get("message"),
		subject: form.get("subject"),
		source: form.get("source") ?? "contact",
		ip: clientAddress ?? undefined,
		userAgent: request.headers.get("user-agent") ?? undefined,
	});

	return redirect(result.ok ? "/?enquiry=ok#contact" : "/?enquiry=error#contact");
};

function redirect(location: string): Response {
	return new Response(null, { status: 303, headers: { location } });
}
