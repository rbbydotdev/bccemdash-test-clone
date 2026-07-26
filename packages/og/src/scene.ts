/**
 * The OG scene model — one document, two renderers.
 *
 * A scene is a flat list of absolutely-positioned layers in a fixed frame
 * (1200x630 by default). It is deliberately plain JSON so it can be:
 *   - rendered to PNG by Takumi (the worker), and
 *   - rendered to DOM by the browser editor,
 * from the same source of truth. Both consume CSS, so what you drag in the
 * editor is what comes out of the renderer. A capability probe confirmed Takumi
 * handles border-radius, opacity, transform/rotate, box-shadow, blur and
 * gradients, so layers can use them freely.
 *
 * Two indirections keep templates reusable rather than one-offs:
 *   - colour TOKENS  `@amber` resolve from the site's brand palette, so a
 *     retint updates every template.
 *   - BINDINGS       `{{hero.titleLine1}}` resolve from a content context, so
 *     one template can render the site card or any collection entry.
 */

export const DEFAULT_WIDTH = 1200;
export const DEFAULT_HEIGHT = 630;

/** Brand palette a scene's `@token` colours resolve against. */
export interface SceneColors {
	night: string;
	deep: string;
	amber: string;
	moon: string;
	[key: string]: string;
}

/** Values `{{bindings}}` resolve against (dotted paths, e.g. `hero.subhead`). */
export type SceneContext = Record<string, unknown>;

export interface BaseLayer {
	id: string;
	/** Shown in the editor's layer list. */
	name?: string;
	/** Frame coordinates in px, top-left origin. */
	x: number;
	y: number;
	w: number;
	h: number;
	/** Degrees, clockwise, about the layer's centre. */
	rotation?: number;
	opacity?: number;
	radius?: number;
	shadow?: string;
	blur?: number;
	hidden?: boolean;
	/** Editor-only: prevents selection/drag. Ignored when rendering. */
	locked?: boolean;
}

export interface TextLayer extends BaseLayer {
	type: "text";
	/** May contain `{{bindings}}`. */
	text: string;
	/** Registered family: the display serif or the accent sans. */
	font?: "display" | "accent";
	size: number;
	weight?: number;
	italic?: boolean;
	/** Hex, or an `@token` from the brand palette. */
	color?: string;
	align?: "left" | "center" | "right";
	lineHeight?: number;
	letterSpacing?: number;
	uppercase?: boolean;
}

export interface ImageLayer extends BaseLayer {
	type: "image";
	/** Media id, or a `{{binding}}` that resolves to one. */
	src: string;
	fit?: "cover" | "contain";
}

export interface ShapeLayer extends BaseLayer {
	type: "shape";
	/** Hex, `@token`, or any CSS gradient. */
	fill: string;
}

export type OgLayer = TextLayer | ImageLayer | ShapeLayer;

export interface OgScene {
	width?: number;
	height?: number;
	/** Painted behind every layer. Hex, `@token`, or a CSS gradient. */
	background?: string;
	layers: OgLayer[];
}

// ── Resolution ──────────────────────────────────────────────────────

/** Look up a dotted path in the context (`hero.titleLine1`). */
function lookup(context: SceneContext, path: string): string {
	const value = path
		.split(".")
		.reduce<unknown>((acc, key) => (acc == null ? undefined : (acc as Record<string, unknown>)[key]), context);
	return value == null ? "" : String(value);
}

/** Substitute every `{{path}}` in a string. Unknown paths become empty. */
export function resolveBindings(input: string, context: SceneContext): string {
	return input.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, path: string) => lookup(context, path));
}

/** Resolve an `@token` colour against the palette; pass anything else through. */
export function resolveColor(value: string | undefined, colors: SceneColors): string | undefined {
	if (!value) return undefined;
	if (!value.startsWith("@")) return value;
	return colors[value.slice(1)] ?? undefined;
}

/** Media ids a scene needs, so the caller can fetch bytes before rendering. */
export function collectMediaRefs(scene: OgScene, context: SceneContext): string[] {
	const refs = new Set<string>();
	for (const layer of scene.layers) {
		if (layer.hidden || layer.type !== "image") continue;
		const id = resolveBindings(layer.src, context).trim();
		if (id) refs.add(id);
	}
	return [...refs];
}

// ── Styling ─────────────────────────────────────────────────────────

/** `#rrggbb` + alpha → `rgba(...)`. Falls back to the input when unparseable. */
export function withAlpha(hex: string, alpha: number): string {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return hex;
	const n = Number.parseInt(m[1]!, 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/**
 * CSS for a layer's frame — shared by both renderers so the editor's DOM and
 * Takumi's output agree on geometry.
 */
export function layerFrameStyle(layer: OgLayer): Record<string, unknown> {
	const style: Record<string, unknown> = {
		position: "absolute",
		left: layer.x,
		top: layer.y,
		width: layer.w,
		height: layer.h,
	};
	if (layer.rotation) style.transform = `rotate(${layer.rotation}deg)`;
	if (layer.opacity !== undefined && layer.opacity < 1) style.opacity = layer.opacity;
	if (layer.radius) style.borderRadius = layer.radius;
	if (layer.shadow) style.boxShadow = layer.shadow;
	if (layer.blur) style.filter = `blur(${layer.blur}px)`;
	return style;
}

/** Font family names as registered with the renderer. */
export const FONT_FAMILY = {
	display: "Cormorant Garamond",
	displayItalic: "Cormorant Garamond Italic",
	accent: "Josefin Sans",
} as const;

/** CSS for a text layer's typography. */
export function textStyle(layer: TextLayer, colors: SceneColors): Record<string, unknown> {
	const family =
		layer.font === "accent"
			? FONT_FAMILY.accent
			: layer.italic
				? FONT_FAMILY.displayItalic
				: FONT_FAMILY.display;
	return {
		fontFamily: family,
		fontSize: layer.size,
		fontWeight: layer.weight ?? (layer.font === "accent" ? 600 : 300),
		lineHeight: layer.lineHeight ?? 1.1,
		letterSpacing: layer.letterSpacing ?? 0,
		color: resolveColor(layer.color, colors) ?? colors.moon,
		textAlign: layer.align ?? "center",
	};
}

/** The visible text of a layer, bindings resolved and casing applied. */
export function layerText(layer: TextLayer, context: SceneContext): string {
	const value = resolveBindings(layer.text, context).replace(/\s+/g, " ").trim();
	return layer.uppercase ? value.toUpperCase() : value;
}
