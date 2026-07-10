/**
 * Bat City Council plugin for EmDash CMS (native, in-process).
 *
 * Owns the one transactional entity — enquiries (contact-form submissions) —
 * plus the business-donor geocoder and the site/design settings schema.
 * Content entities (tiers, experiences, partners, business_donors, programs,
 * posts, pages) are EmDash collections defined in apps/site/seed/seed.json.
 *
 * Two pieces in one file, per the native-plugin contract:
 *  - `bccPlugin()`   — build-time descriptor, imported by astro.config.mjs
 *  - `createPlugin()` — runtime, loaded through `entrypoint` by the plugin
 *    manager (native format imports the named `createPlugin` export)
 *
 * Routes mount at /_emdash/api/plugins/bcc/*. The `enquiries` table migrates
 * via our own `_bcc_migrations` history: on plugin:install / plugin:activate
 * and lazily (memoized) before the first route query of each process.
 */
import type { PluginDescriptor } from "emdash";
import { definePlugin } from "emdash";
import { getDb } from "emdash/runtime";
import type { Kysely } from "kysely";

import { ensureBccMigrations } from "./db/migrator.js";
import {
	adminEnquiriesHandler,
	adminEnquiryItemHandler,
	adminGeocodeHandler,
	adminStatsHandler,
} from "./routes/admin.js";
import { wrap } from "./routes/helpers.js";
import { publicEnquiryHandler } from "./routes/public.js";

export type BccOptions = Record<string, unknown>;

/**
 * Admin UI surface. `group` lifts these into a top-level "Bat City" sidebar
 * section (vendored Sidebar patch, PATCHES.md 0002) instead of the bottom
 * "Plugins" area. Page paths / widget ids / field names must match the maps
 * exported from src/admin/index.tsx.
 */
const ADMIN_PAGES = [
	{ path: "/enquiries", label: "Enquiries", icon: "chat-circle-text", group: "Bat City" },
];

const ADMIN_WIDGETS = [{ id: "recent-enquiries", title: "Recent enquiries", size: "half" as const }];

/** Custom field editors. Fields opt in with `widget: "bcc:<name>"`. */
const FIELD_WIDGETS = [
	{ name: "location", label: "Map location", fieldTypes: ["json" as const] },
];

export function bccPlugin(options: BccOptions = {}): PluginDescriptor {
	return {
		id: "bcc",
		version: "0.1.0",
		format: "native",
		entrypoint: "@bcc/plugin",
		adminEntry: "@bcc/plugin/admin",
		adminPages: ADMIN_PAGES,
		adminWidgets: ADMIN_WIDGETS,
		options,
	};
}

async function runMigrations(
	phase: string,
	log: { info(message: string, data?: unknown): void },
): Promise<void> {
	const db = (await getDb()) as unknown as Kysely<unknown>;
	await ensureBccMigrations(db);
	log.info(`[bcc] migrations ensured (${phase})`);
}

export function createPlugin(_options: BccOptions = {}) {
	return definePlugin({
		id: "bcc",
		version: "0.1.0",

		// Native/trusted: capabilities document intent and select which ctx
		// accessors the context factory builds (content read, email send).
		capabilities: ["content:read", "email:send"],

		admin: {
			entry: "@bcc/plugin/admin",
			pages: ADMIN_PAGES,
			widgets: ADMIN_WIDGETS,
			fieldWidgets: FIELD_WIDGETS,
		},

		hooks: {
			"plugin:install": async (_event, ctx) => {
				await runMigrations("install", ctx.log);
			},
			"plugin:activate": async (_event, ctx) => {
				await runMigrations("activate", ctx.log);
			},
		},

		routes: {
			// ── Public (no auth; POST checks CSRF header + rate limit) ──
			enquiries: { public: true, handler: wrap(publicEnquiryHandler) },

			// ── Admin (core dispatcher: session + perms + CSRF) ──
			"admin/enquiries": { handler: wrap(adminEnquiriesHandler) },
			"admin/enquiries/item": { handler: wrap(adminEnquiryItemHandler) },
			"admin/stats": { handler: wrap(adminStatsHandler) },
			"admin/geocode": { handler: wrap(adminGeocodeHandler) },
		},
	});
}

export default createPlugin;
