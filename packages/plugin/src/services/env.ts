/**
 * Read a server secret from wherever the current runtime keeps it.
 *
 * Plugin routes and hooks run without Astro request context, so secrets cannot
 * come from `Astro.locals.runtime.env` (removed in Astro v6 and throws on
 * workerd). On Workers, `cloudflare:workers` exposes the same env to any
 * bundled code; on Node we fall back to `process.env`. Returns undefined when
 * unset so callers can degrade gracefully.
 */
export async function readEnvSecret(name: string): Promise<string | undefined> {
	try {
		// @ts-ignore - virtual module, only resolvable on the Workers runtime
		const mod = await import(/* @vite-ignore */ "cloudflare:workers");
		const env = (mod as { env?: Record<string, unknown> }).env;
		const value = env?.[name];
		if (typeof value === "string" && value) return value;
	} catch {
		// Not on workerd — fall through to process.env (Node / local dev).
	}
	const fromProcess = typeof process !== "undefined" ? process.env?.[name] : undefined;
	return fromProcess || undefined;
}
