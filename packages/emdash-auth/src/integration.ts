/**
 * `passwordAuth()` — the drop-in Astro integration.
 *
 * Adds email+password sign-in, WordPress-style first-admin bootstrap, and a
 * secret-gated agent API-token endpoint to any emdash + Astro site. It:
 *   1. injects the JSON endpoints (login / set-password / bootstrap / agent-token)
 *   2. injects the `/login` and `/account/password` pages
 *   3. registers the agent-secret env vars as optional server secrets
 *   4. exposes the resolved config to those routes via `virtual:emdash-auth/config`
 *
 * emdash's passwordless flows (passkey / magic-link / OAuth) keep working; this
 * only layers passwords + agent tokens on top. Pair with an emdash plugin or a
 * core patch if you also want the first-run wizard to redirect to `/login`.
 */
import type { AstroIntegration } from "astro";
import { envField } from "astro/config";

import { resolveOptions, type PasswordAuthOptions, type ResolvedAuthConfig } from "./options.js";

const VIRTUAL_ID = "virtual:emdash-auth/config";
const RESOLVED_VIRTUAL_ID = `\0${VIRTUAL_ID}`;

export function passwordAuth(options: PasswordAuthOptions = {}): AstroIntegration {
	const config = resolveOptions(options);

	return {
		name: "emdash-auth",
		hooks: {
			"astro:config:setup": ({ injectRoute, updateConfig }) => {
				// Endpoints (JSON + no-JS form POST).
				injectRoute({ pattern: config.loginApiPath, entrypoint: "emdash-auth/routes/login", prerender: false });
				injectRoute({
					pattern: config.setPasswordApiPath,
					entrypoint: "emdash-auth/routes/set-password",
					prerender: false,
				});
				injectRoute({
					pattern: config.bootstrapApiPath,
					entrypoint: "emdash-auth/routes/bootstrap",
					prerender: false,
				});
				if (config.agentTokens) {
					injectRoute({
						pattern: config.agentTokenApiPath,
						entrypoint: "emdash-auth/routes/agent-token",
						prerender: false,
					});
				}

				// Pages (skip when the host app ships its own at these paths).
				if (config.pages) {
					injectRoute({ pattern: config.loginPath, entrypoint: "emdash-auth/pages/login", prerender: false });
					injectRoute({
						pattern: config.accountPasswordPath,
						entrypoint: "emdash-auth/pages/account-password",
						prerender: false,
					});
				}

				// Register the agent-token secrets so getSecret() resolves portably
				// (Node + Cloudflare). Optional: the endpoint self-disables when unset.
				updateConfig({
					env: {
						schema: {
							[config.secretEnv]: envField.string({ context: "server", access: "secret", optional: true }),
							[config.agentEmailEnv]: envField.string({ context: "server", access: "secret", optional: true }),
						},
					},
					vite: { plugins: [virtualConfigPlugin(config)] },
				});
			},
		},
	};
}

/** Vite plugin serving `virtual:emdash-auth/config` with the resolved options. */
function virtualConfigPlugin(config: ResolvedAuthConfig) {
	const source = `export const config = ${JSON.stringify(config)};\n`;
	return {
		name: "emdash-auth:virtual-config",
		resolveId(id: string) {
			return id === VIRTUAL_ID ? RESOLVED_VIRTUAL_ID : null;
		},
		load(id: string) {
			return id === RESOLVED_VIRTUAL_ID ? source : null;
		},
	};
}
