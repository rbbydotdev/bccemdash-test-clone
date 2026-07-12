/**
 * emdash-auth — drop-in email+password sign-in, first-admin bootstrap, and
 * secret-gated agent API tokens for any emdash + Astro site.
 *
 *   import { passwordAuth } from "emdash-auth";
 *   // astro.config: integrations: [ emdash({...}), passwordAuth({ siteName: "My Site" }) ]
 *
 * Server helpers (for custom routes) live at "emdash-auth/server".
 */
export { passwordAuth } from "./integration.js";
export { resolveOptions } from "./options.js";
export type { PasswordAuthOptions, ResolvedAuthConfig } from "./options.js";
