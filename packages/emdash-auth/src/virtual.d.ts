/**
 * Ambient types for the injected routes/pages. These modules are provided by
 * the host app's Astro build (`astro:env/server`) or by the `passwordAuth()`
 * integration (`virtual:emdash-auth/config`); we declare them here so the
 * package typechecks in isolation.
 */
declare module "virtual:emdash-auth/config" {
	import type { ResolvedAuthConfig } from "emdash-auth";
	export const config: ResolvedAuthConfig;
}

declare module "astro:env/server" {
	export function getSecret(key: string): string | undefined;
}

// emdash augments App.Locals.user in the host app; declare the slice we read.
declare namespace App {
	interface Locals {
		user?: { id?: string; email?: string; name?: string };
	}
}
