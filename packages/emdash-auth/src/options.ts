/**
 * Options for the `passwordAuth()` Astro integration and the resolved config
 * the injected routes/pages read at runtime (via the `virtual:emdash-auth/config`
 * module the integration provides).
 */

export interface PasswordAuthOptions {
	/** Shown in page titles + used as the default `emdash:site_title` on bootstrap. */
	siteName?: string;
	/** Public sign-in / first-run page. Default `/login`. */
	loginPath?: string;
	/** Authed "set / change password" page. Default `/account/password`. */
	accountPasswordPath?: string;
	/** Where to send the user after a successful login/bootstrap. Default `/_emdash/admin`. */
	loginRedirect?: string;
	/** Base path for the JSON endpoints. Default `/api/auth`. */
	apiBase?: string;
	/**
	 * Inject the built-in `/login` + `/account/password` pages. Default `true`.
	 * Set `false` when your app ships its own pages at those paths (otherwise the
	 * two collide) — the JSON endpoints and server helpers still work.
	 */
	pages?: boolean;
	/** Inject the secret-gated agent-token endpoint. Default `true`. */
	agentTokens?: boolean;
	/**
	 * Env var (server secret) holding the shared secret that gates agent-token
	 * issuance. When unset/empty in the environment, the endpoint is disabled.
	 * Default `EMDASH_AGENT_SECRET`.
	 */
	secretEnv?: string;
	/** Env var (server secret) for the default agent email. Default `EMDASH_AGENT_EMAIL`. */
	agentEmailEnv?: string;
	/** Fallback agent email when `agentEmailEnv` is unset. Default `agent@localhost`. */
	defaultAgentEmail?: string;
	/** Accent color used on the login/account pages. Default `#4f46e5`. */
	accent?: string;
}

export interface ResolvedAuthConfig {
	siteName: string;
	loginPath: string;
	accountPasswordPath: string;
	loginRedirect: string;
	apiBase: string;
	pages: boolean;
	agentTokens: boolean;
	secretEnv: string;
	agentEmailEnv: string;
	defaultAgentEmail: string;
	accent: string;
	loginApiPath: string;
	setPasswordApiPath: string;
	bootstrapApiPath: string;
	agentTokenApiPath: string;
}

export function resolveOptions(options: PasswordAuthOptions = {}): ResolvedAuthConfig {
	const apiBase = normalizePath(options.apiBase ?? "/api/auth");
	return {
		siteName: options.siteName ?? "emdash",
		loginPath: normalizePath(options.loginPath ?? "/login"),
		accountPasswordPath: normalizePath(options.accountPasswordPath ?? "/account/password"),
		loginRedirect: normalizePath(options.loginRedirect ?? "/_emdash/admin"),
		apiBase,
		pages: options.pages ?? true,
		agentTokens: options.agentTokens ?? true,
		secretEnv: options.secretEnv ?? "EMDASH_AGENT_SECRET",
		agentEmailEnv: options.agentEmailEnv ?? "EMDASH_AGENT_EMAIL",
		defaultAgentEmail: options.defaultAgentEmail ?? "agent@localhost",
		accent: options.accent ?? "#4f46e5",
		loginApiPath: `${apiBase}/login`,
		setPasswordApiPath: `${apiBase}/set-password`,
		bootstrapApiPath: `${apiBase}/bootstrap`,
		agentTokenApiPath: `${apiBase}/agent-token`,
	};
}

/** Ensure a leading slash and no trailing slash (except root). */
function normalizePath(p: string): string {
	let out = p.startsWith("/") ? p : `/${p}`;
	if (out.length > 1 && out.endsWith("/")) out = out.slice(0, -1);
	return out;
}
