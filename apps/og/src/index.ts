/**
 * OG card Worker — renders social images with Takumi (WASM).
 *
 * Split out of the main site Worker so the 3.6 MB WASM binary never weighs on
 * page requests: the site script stays lean and a render can't stall or OOM
 * page serving. It reads the site's data read-only, so there is no coupling to
 * the site's code.
 *
 * Routes:
 *   /site.png                  the site-wide card
 *   /{collection}/{slug}.png   one entry's card (experiences, programs, posts…),
 *                              so every page can share its own image
 *
 * The scene comes from the template marked active in the admin editor, falling
 * back to the built-in hero so a site always renders something.
 *
 * Caching is content-addressed, the way Next.js treats immutable assets: the
 * key is a digest of everything that affects the pixels, so an edit produces a
 * NEW key rather than needing invalidation. Three tiers, each skipped on a hit:
 *   1. Cache API — per-colo edge memory, microseconds
 *   2. R2        — shared across colos, survives deploys
 *   3. render    — Takumi, ~100-400 ms
 */
import {
	collectMediaRefs,
	heroTemplate,
	renderScene,
	type OgScene,
	type SceneColors,
	type SceneContext,
	type SceneImage,
} from "@myemdash/og";

interface Env {
	DB: D1Database;
	MEDIA: R2Bucket;
}

const CACHE_PREFIX = "og-cache/";
const IMMUTABLE = "public, max-age=31536000, s-maxage=31536000, immutable";

/** Renderable collections, so a URL path can never reach an arbitrary table. */
const ALLOWED_COLLECTIONS = new Set(["experiences", "programs", "posts", "pages", "tiers"]);

const DEFAULT_COLORS: SceneColors = {
	night: "#0A0E1A",
	deep: "#111833",
	amber: "#D4A03C",
	moon: "#C8D0E0",
	amberLight: "#E8C060",
	silver: "#8892A8",
};

export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		if (request.method !== "GET" && request.method !== "HEAD") {
			return new Response("Method not allowed", { status: 405 });
		}
		if (!url.pathname.endsWith(".png")) return new Response("Not found", { status: 404 });

		try {
			const target = parsePath(url.pathname);
			if (!target) return new Response("Not found", { status: 404 });

			const settings = await loadSettings(env);
			const colors = mergeColors((settings.design as { colors?: Record<string, unknown> })?.colors);

			const entry = target.kind === "entry" ? await loadEntry(env, target.collection, target.slug) : null;
			if (target.kind === "entry" && !entry) return new Response("Not found", { status: 404 });

			const context: SceneContext = { ...settings, ...(entry ? { entry } : {}) };
			// `?template=<id>` renders one specific saved card — the admin editor
			// uses it to preview the card being edited, rather than whichever one
			// happens to be live.
			const scene = await loadScene(env, colors.night, url.searchParams.get("template"));
			const key = `${CACHE_PREFIX}${await digest(scene, context, colors)}.png`;

			// Tier 1 — edge cache, keyed by the content-addressed name.
			const cache = caches.default;
			const cacheKey = new Request(new URL(`/${key}`, url.origin).toString(), { method: "GET" });
			const edgeHit = await cache.match(cacheKey);
			if (edgeHit) return withCacheStatus(edgeHit, "edge");

			// Tier 2 — R2, shared across colos and surviving deploys.
			const stored = await env.MEDIA.get(key);
			if (stored) {
				const response = png(await stored.arrayBuffer(), "r2");
				ctx.waitUntil(cache.put(cacheKey, response.clone()));
				return response;
			}

			// Tier 3 — render, then populate both caches off the response path.
			const images: SceneImage[] = [];
			for (const id of collectMediaRefs(scene, context)) {
				const data = await loadMediaBytes(env, id);
				if (data) images.push({ id, data });
			}
			const bytes = await renderScene({ scene, context, colors, images });

			const body = new Uint8Array(bytes);
			const response = png(body.buffer as ArrayBuffer, "miss");
			ctx.waitUntil(
				Promise.all([
					env.MEDIA.put(key, body, {
						httpMetadata: { contentType: "image/png", cacheControl: IMMUTABLE },
					}).catch(() => undefined), // a cache write failure must not fail the request
					cache.put(cacheKey, response.clone()),
				]),
			);
			return response;
		} catch (error) {
			console.error("[og] render failed:", error);
			return new Response("OG render failed", { status: 500 });
		}
	},
} satisfies ExportedHandler<Env>;

/** Brand palette with any missing/blank entries falling back to the defaults. */
function mergeColors(overrides: Record<string, unknown> | undefined): SceneColors {
	const out: SceneColors = { ...DEFAULT_COLORS };
	for (const [k, v] of Object.entries(overrides ?? {})) {
		if (typeof v === "string" && v.trim()) out[k] = v;
	}
	return out;
}

type Target = { kind: "site" } | { kind: "entry"; collection: string; slug: string };

/** `/site.png` or `/{collection}/{slug}.png`. */
function parsePath(pathname: string): Target | null {
	const parts = pathname.replace(/^\/+/, "").replace(/\.png$/, "").split("/");
	if (parts.length === 1 && parts[0] === "site") return { kind: "site" };
	if (parts.length === 2 && parts[0] && parts[1]) {
		if (!ALLOWED_COLLECTIONS.has(parts[0])) return null;
		return { kind: "entry", collection: parts[0], slug: parts[1] };
	}
	return null;
}

function png(body: ArrayBuffer, status: string): Response {
	return new Response(body, {
		headers: {
			"Content-Type": "image/png",
			"Content-Length": String(body.byteLength),
			"Cache-Control": IMMUTABLE,
			"X-OG-Cache": status,
		},
	});
}

function withCacheStatus(response: Response, status: string): Response {
	const out = new Response(response.body, response);
	out.headers.set("X-OG-Cache", status);
	return out;
}

/** Everything that affects the pixels, hashed into the cache key. */
async function digest(scene: OgScene, context: SceneContext, colors: SceneColors): Promise<string> {
	const material = JSON.stringify([scene, context, colors]);
	const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(material));
	return [...new Uint8Array(hash).slice(0, 12)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The scene to render: whichever template the client marked active in the
 * editor, else the built-in hero. A malformed saved scene falls back rather
 * than failing the request.
 */
async function loadScene(env: Env, night: string, templateId?: string | null): Promise<OgScene> {
	try {
		const row = templateId
			? await env.DB.prepare("SELECT scene FROM og_templates WHERE id = ? LIMIT 1")
					.bind(templateId)
					.first<{ scene: string }>()
			: await env.DB.prepare("SELECT scene FROM og_templates WHERE is_active = 1 LIMIT 1").first<{
					scene: string;
				}>();
		if (row?.scene) {
			const parsed = JSON.parse(row.scene) as OgScene;
			if (Array.isArray(parsed?.layers)) return parsed;
		}
	} catch (error) {
		console.warn("[og] active template unavailable, using the built-in:", error);
	}
	return heroTemplate(night).scene;
}

/** The site's settings bag — the binding context for `{{hero.*}}` etc. */
async function loadSettings(env: Env): Promise<SceneContext> {
	try {
		const row = await env.DB.prepare("SELECT value FROM options WHERE name = ?")
			.bind("bcc_site")
			.first<{ value: string }>();
		if (row?.value) return JSON.parse(row.value) as SceneContext;
	} catch (error) {
		console.warn("[og] settings unavailable, using defaults:", error);
	}
	return {};
}

/**
 * One published entry, exposed to templates as `{{entry.*}}`. The collection is
 * validated against the allowlist before it reaches the table name.
 */
async function loadEntry(
	env: Env,
	collection: string,
	slug: string,
): Promise<Record<string, unknown> | null> {
	try {
		const row = await env.DB.prepare(
			`SELECT * FROM ec_${collection} WHERE slug = ? AND status = 'published' LIMIT 1`,
		)
			.bind(slug)
			.first<Record<string, unknown>>();
		return row ? normaliseEntry(row) : null;
	} catch (error) {
		console.warn(`[og] entry ${collection}/${slug} unavailable:`, error);
		return null;
	}
}

/**
 * Content columns arrive as raw SQL values: JSON fields are strings, and an
 * image field is a whole resolved media object rather than an id. Templates
 * bind simple values, so parse JSON and collapse media objects to their id —
 * otherwise `{{entry.image}}` would interpolate a blob of JSON.
 */
function normaliseEntry(row: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const [key, value] of Object.entries(row)) {
		if (typeof value !== "string" || !/^[[{]/.test(value.trim())) {
			out[key] = value;
			continue;
		}
		try {
			const parsed = JSON.parse(value) as unknown;
			out[key] =
				parsed && typeof parsed === "object" && typeof (parsed as { id?: unknown }).id === "string"
					? (parsed as { id: string }).id
					: parsed;
		} catch {
			out[key] = value;
		}
	}
	return out;
}

/** Resolve a media id to its bytes. Returns undefined so the layer is skipped. */
async function loadMediaBytes(env: Env, mediaId: string): Promise<Uint8Array | undefined> {
	if (!mediaId.trim()) return undefined;
	try {
		const row = await env.DB.prepare("SELECT storage_key FROM media WHERE id = ?")
			.bind(mediaId.trim())
			.first<{ storage_key: string }>();
		if (!row?.storage_key) return undefined;
		const object = await env.MEDIA.get(row.storage_key);
		if (!object) return undefined;
		return new Uint8Array(await object.arrayBuffer());
	} catch (error) {
		console.warn("[og] media unavailable, skipping layer:", error);
		return undefined;
	}
}
