/**
 * Render a scene to PNG with Takumi.
 *
 * Pure: it takes a scene, a content context, the brand palette and any image
 * bytes the caller already fetched (a Worker cannot fetch its own origin, so
 * media is always read from storage upstream and handed in here).
 */
import { container, googleFonts, text, type Node } from "@takumi-rs/helpers";

/** Google's css2 `ital` axis, as Takumi types it. */
type FontStyle = "normal" | "italic";
import { render } from "takumi-js";

import { getOgRenderer } from "./renderer.js";
import {
	DEFAULT_HEIGHT,
	DEFAULT_WIDTH,
	layerFrameStyle,
	layerText,
	resolveBindings,
	resolveColor,
	textStyle,
	type OgScene,
	type SceneColors,
	type SceneContext,
} from "./scene.js";

/** Bytes for a media id the scene referenced. */
export interface SceneImage {
	id: string;
	data: Uint8Array | ArrayBuffer;
}

export interface RenderSceneOptions {
	scene: OgScene;
	context?: SceneContext;
	colors: SceneColors;
	images?: SceneImage[];
}

/** Takumi resolves image layers against these synthetic srcs. */
const imageSrc = (id: string) => `media://${id}`;

/**
 * Google Font families a scene asks for, with the weights and styles it uses.
 *
 * The two brand faces stay embedded (they are the default and must render with
 * no network at all), but anything else is fetched at render time, so the whole
 * Google catalogue is available without growing the Worker bundle. Takumi
 * caches the css2 metadata process-wide and skips font files it has already
 * loaded, and our own renders are content-addressed and cached, so the fetch
 * cost lands on the rare miss rather than on every request.
 */
function googleFontRequests(scene: OgScene): Array<{ name: string; weight: number[]; style: FontStyle[] }> {
	const byFamily = new Map<string, { weights: Set<number>; styles: Set<FontStyle> }>();
	for (const layer of scene.layers) {
		if (layer.hidden || layer.type !== "text") continue;
		const name = layer.fontFamily?.trim();
		if (!name) continue;
		let entry = byFamily.get(name);
		if (!entry) byFamily.set(name, (entry = { weights: new Set(), styles: new Set() }));
		entry.weights.add(layer.weight ?? 400);
		entry.styles.add(layer.italic ? "italic" : "normal");
	}
	return [...byFamily].map(([name, { weights, styles }]) => ({
		name,
		weight: [...weights],
		style: [...styles],
	}));
}

/**
 * Fetch the scene's custom faces. A font that fails to load must not fail the
 * card: Takumi falls back to a registered family, which still reads.
 */
async function loadSceneFonts(scene: OgScene) {
	const families = googleFontRequests(scene);
	if (!families.length) return undefined;
	try {
		return await googleFonts(families);
	} catch (error) {
		console.warn("[og] custom fonts unavailable, falling back to the brand faces:", error);
		return undefined;
	}
}

export function sceneToNode(
	scene: OgScene,
	context: SceneContext,
	colors: SceneColors,
	available: ReadonlySet<string>,
): Node {
	const width = scene.width ?? DEFAULT_WIDTH;
	const height = scene.height ?? DEFAULT_HEIGHT;
	const children: Node[] = [];

	for (const layer of scene.layers) {
		if (layer.hidden) continue;
		const frame = layerFrameStyle(layer);

		if (layer.type === "text") {
			const value = layerText(layer, context);
			if (!value) continue;
			children.push(
				container({
					style: {
						...frame,
						display: "flex",
						alignItems: "center",
						justifyContent:
							layer.align === "left" ? "flex-start" : layer.align === "right" ? "flex-end" : "center",
					},
					children: [text(value, { ...textStyle(layer, colors), width: layer.w } as never)],
				}),
			);
			continue;
		}

		if (layer.type === "image") {
			const id = resolveBindings(layer.src, context).trim();
			// Skip silently when the media is missing — a card with a hole is worse
			// than one without the decoration.
			if (!id || !available.has(id)) continue;
			children.push(
				container({
					style: {
						...frame,
						backgroundImage: `url(${imageSrc(id)})`,
						backgroundSize: layer.fit === "contain" ? "contain" : "cover",
						backgroundPosition: "center",
					},
				}),
			);
			continue;
		}

		children.push(
			container({
				style: { ...frame, backgroundImage: shapeFill(layer.fill, colors) },
			}),
		);
	}

	return container({
		style: {
			width,
			height,
			display: "flex",
			position: "relative",
			backgroundColor: resolveColor(scene.background, colors) ?? colors.night,
			...(isGradient(scene.background) ? { backgroundImage: scene.background } : {}),
		},
		children,
	});
}

export async function renderScene(options: RenderSceneOptions): Promise<Uint8Array> {
	const { scene, colors } = options;
	const context = options.context ?? {};
	const images = options.images ?? [];
	const available = new Set(images.map((i) => i.id));

	const node = sceneToNode(scene, context, colors, available);
	const [renderer, fonts] = await Promise.all([getOgRenderer(), loadSceneFonts(scene)]);

	const bytes = await render(node as never, {
		renderer: renderer as never,
		width: scene.width ?? DEFAULT_WIDTH,
		height: scene.height ?? DEFAULT_HEIGHT,
		format: "png",
		...(fonts ? { fonts } : {}),
		images: images.map((image) => ({ src: imageSrc(image.id), data: image.data })),
	} as never);

	return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
}

function isGradient(value: string | undefined): boolean {
	return Boolean(value && value.includes("gradient("));
}

/** Shapes paint through background-image so gradients and solids share a path. */
function shapeFill(fill: string, colors: SceneColors): string {
	if (isGradient(fill)) return fill;
	const solid = resolveColor(fill, colors) ?? fill;
	return `linear-gradient(0deg, ${solid} 0%, ${solid} 100%)`;
}
