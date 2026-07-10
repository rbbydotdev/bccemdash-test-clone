/**
 * WordPress -> emdash content migration (repeatable).
 *
 * Sources curated content (src/content.ts, extracted from the prod dump) and
 * media originals (../bcc-wp/app/wp-content/uploads), and pushes them into the
 * running emdash dev server via REST. Idempotent: media skip-if-filename,
 * content skip-if-slug. Run with the dev server up:
 *
 *   cd apps/site && corepack pnpm dev            # in one shell
 *   cd scripts/migrate-wp && corepack pnpm migrate
 */
import { readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import {
	createEntry,
	listAllContent,
	listAllMedia,
	login,
	publishEntry,
	updateBccSettings,
	updateMediaMeta,
	updateSiteSettings,
	uploadMedia,
} from "./emdash.ts";
import {
	BUSINESS_DONORS,
	DEVOTE_URL,
	EXPERIENCES,
	MEDIA,
	PARTNERS,
	PROGRAMS,
	TIERS,
	type Entry,
} from "./content.ts";

const UPLOADS_ROOT = resolve(
	process.env.WP_UPLOADS ?? "../../../bcc-wp/app/wp-content/uploads",
);

function mimeFor(file: string): string {
	if (file.endsWith(".png")) return "image/png";
	if (file.endsWith(".webp")) return "image/webp";
	return "image/jpeg";
}

/** Upload all MEDIA (skip-if-filename); returns logical-name -> media id. */
async function migrateMedia(): Promise<Map<string, string>> {
	console.log("• Media");
	const existing = new Map((await listAllMedia()).map((m) => [m.filename, m.id]));
	const map = new Map<string, string>();
	for (const [name, spec] of Object.entries(MEDIA)) {
		const path = resolve(UPLOADS_ROOT, spec.file);
		const filename = basename(spec.file);
		const existingId = existing.get(filename);
		if (existingId) {
			map.set(name, existingId);
			console.log(`  = ${name} (${filename}) already uploaded`);
			continue;
		}
		try {
			const bytes = new Uint8Array(await readFile(path));
			const item = await uploadMedia(bytes, filename, mimeFor(filename), spec.alt);
			await updateMediaMeta(item.id, { alt: spec.alt });
			map.set(name, item.id);
			console.log(`  + ${name} -> ${item.id} (${filename})`);
		} catch (error) {
			console.warn(`  ! ${name} failed (${path}): ${error instanceof Error ? error.message : error}`);
		}
	}
	return map;
}

/** Create + publish a collection's entries (skip-if-slug). */
async function migrateCollection(
	collection: string,
	entries: Entry[],
	media: Map<string, string>,
): Promise<void> {
	console.log(`• ${collection}`);
	const existing = new Set((await listAllContent(collection)).map((c) => c.slug));
	for (const entry of entries) {
		if (existing.has(entry.slug)) {
			console.log(`  = ${entry.slug} exists`);
			continue;
		}
		const data = { ...entry.data };
		if (entry.imageKey && entry.imageField) {
			const id = media.get(entry.imageKey);
			if (id) data[entry.imageField] = id;
		}
		const item = await createEntry(collection, { slug: entry.slug, data });
		if (entry.status === "published") await publishEntry(collection, item.id);
		console.log(`  + ${entry.slug} (${entry.status})`);
	}
}

async function migrateSettings(media: Map<string, string>): Promise<void> {
	console.log("• Settings");
	// emdash SiteSettings (identity)
	await updateSiteSettings({
		title: "Bat City Council",
		tagline: "Connecting culture, commerce and conservation.",
	});
	// BCC "Site Content" bag: wire imagery + integrations (copy defaults already correct).
	const patch: Record<string, unknown> = {
		integrations: { devoteUrl: DEVOTE_URL },
		footer: {
			copyright: "© 2026 Bat City Council. Austin, Texas. 501c3 nonprofit, EIN 42-2391354",
			caption: "Guardians of Austin's Night Sky.",
			tagline: "Culture · Commerce · Conservation",
		},
	};
	const hero = media.get("hero");
	const story = media.get("story");
	const founder = media.get("founder");
	if (hero) {
		patch.hero = { image: hero };
		patch.closing = { image: hero };
		patch.footer = { ...(patch.footer as object), image: hero };
	}
	if (story) patch.story = { image: story };
	if (founder) patch.founder = { image: founder };
	await updateBccSettings(patch);
	console.log("  + site settings + BCC chrome updated");
}

async function main(): Promise<void> {
	console.log(`Migrating WP content into emdash at ${process.env.EMDASH_URL ?? "http://localhost:4321"}`);
	await login();
	const media = await migrateMedia();
	await migrateCollection("tiers", TIERS, media);
	await migrateCollection("experiences", EXPERIENCES, media);
	await migrateCollection("partners", PARTNERS, media);
	await migrateCollection("business_donors", BUSINESS_DONORS, media);
	await migrateCollection("programs", PROGRAMS, media);
	await migrateSettings(media);
	console.log("Done.");
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
