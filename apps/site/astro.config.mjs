// Dual-target Astro config.
//   default                   -> Node 22 + better-sqlite3 + local uploads (local dev / self-host)
//   DEPLOY_TARGET=cloudflare  -> Workers + D1 + R2 (wrangler dev / deploy)
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField, fontProviders } from "astro/config";
import emdash, { local } from "emdash/astro";
import { sqlite } from "emdash/db";
import { fieldKitPlugin } from "@emdash-cms/plugin-field-kit";
import { bccPlugin } from "@bcc/plugin";
import { passwordAuth } from "emdash-auth";

const isCloudflare = process.env.DEPLOY_TARGET === "cloudflare";

const platform = isCloudflare
	? await (async () => {
			const { default: cloudflare } = await import("@astrojs/cloudflare");
			const { d1, r2 } = await import("@emdash-cms/cloudflare");
			return {
				adapter: cloudflare(),
				database: d1({ binding: "DB", session: "auto" }),
				storage: r2({ binding: "MEDIA" }),
			};
		})()
	: await (async () => {
			const { default: node } = await import("@astrojs/node");
			return {
				adapter: node({ mode: "standalone" }),
				database: sqlite({ url: "file:./data/site.db" }),
				storage: local({
					directory: "./uploads",
					baseUrl: "/_emdash/api/media/file",
				}),
			};
		})();

export default defineConfig({
	output: "server",
	adapter: platform.adapter,
	image: {
		layout: "constrained",
		responsiveStyles: true,
	},
	vite: {
		plugins: [tailwindcss()],
		optimizeDeps: {
			// Pre-bundle the big client-island dep (business-donor map) so it
			// hydrates without the "Outdated Optimize Dep" 504 retry loop.
			include: ["maplibre-gl"],
		},
		// Dev-only: allow access over Tailscale MagicDNS (*.ts.net) when the dev
		// server is started with --host. Raw Tailscale IPs are allowed already.
		server: {
			allowedHosts: [".ts.net"],
		},
	},
	integrations: [
		react(),
		emdash({
			database: platform.database,
			storage: platform.storage,
			plugins: [bccPlugin(), fieldKitPlugin()],
		}),
		// Email+password sign-in, first-admin bootstrap, and the secret-gated
		// agent-token endpoint — provided by the reusable `emdash-auth` package.
		// It injects the /api/auth/* endpoints + registers BCC_BOOTSTRAP_SECRET /
		// BCC_AGENT_EMAIL as server secrets. The BCC-branded /login and
		// /account/password pages in src/pages take precedence over its generic
		// ones (file routes beat injected routes).
		passwordAuth({
			siteName: "Bat City Council",
			accent: "#f5a623",
			// We ship our own themed /login + /account/password pages.
			pages: false,
			secretEnv: "BCC_BOOTSTRAP_SECRET",
			agentEmailEnv: "BCC_AGENT_EMAIL",
			defaultAgentEmail: "agent@batcitycouncil.local",
		}),
	],
	// Astro-managed webfonts, namespaced (--font-*-webfont) so they don't collide
	// with the @theme tokens in @bcc/theme. app.css bridges them via --bcc-font-*.
	fonts: [
		{
			provider: fontProviders.google(),
			name: "Cormorant Garamond",
			cssVariable: "--font-display-webfont",
			weights: [300, 400, 500, 600, 700],
			styles: ["normal", "italic"],
			fallbacks: ["serif"],
		},
		{
			provider: fontProviders.google(),
			name: "EB Garamond",
			cssVariable: "--font-body-webfont",
			weights: [400, 500, 600],
			styles: ["normal", "italic"],
			fallbacks: ["serif"],
		},
		{
			provider: fontProviders.google(),
			name: "Josefin Sans",
			cssVariable: "--font-accent-webfont",
			weights: [300, 400, 500, 600, 700],
			styles: ["normal"],
			fallbacks: ["sans-serif"],
		},
	],
	// Server secrets read via getSecret() (portable across Node + Cloudflare;
	// locals.runtime.env was removed in Astro v6). BCC_BOOTSTRAP_SECRET and
	// BCC_AGENT_EMAIL are registered by the passwordAuth() integration; only the
	// app-specific ones remain here. All optional.
	env: {
		schema: {
			TURNSTILE_SECRET_KEY: envField.string({ context: "server", access: "secret", optional: true }),
		},
	},
	devToolbar: { enabled: false },
});
