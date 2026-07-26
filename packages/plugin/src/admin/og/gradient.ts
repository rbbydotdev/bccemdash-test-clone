/**
 * Reading and writing the gradient strings a shape layer's `fill` holds.
 *
 * A scene stores a plain CSS gradient, because that is what both renderers
 * consume. The editor needs it as structure — an angle and a list of stops — so
 * it can offer real controls instead of a text box. Parsing round-trips: a
 * gradient this module writes parses back to the same thing.
 *
 * Stops keep `@tokens` where they can, so a gradient built from the site
 * palette re-tints with it. Transparency forces a literal `rgba()`, since a
 * token carries no alpha; the inspector says so when it happens.
 */
import { withAlpha, type SceneColors } from "@myemdash/og/scene";

export interface GradientStop {
	/** Hex, `rgba()`, or an `@token`. */
	color: string;
	/** Position along the axis, 0-100. */
	at: number;
}

export interface LinearGradient {
	/** Degrees, 0 = upward, 180 = downward (CSS convention). */
	angle: number;
	stops: GradientStop[];
}

export function isGradientValue(value: string): boolean {
	return value.includes("gradient(");
}

/** Split on commas that are not inside parentheses, so `rgba(...)` survives. */
function splitTopLevel(input: string): string[] {
	const parts: string[] = [];
	let depth = 0;
	let current = "";
	for (const char of input) {
		if (char === "(") depth++;
		if (char === ")") depth--;
		if (char === "," && depth === 0) {
			parts.push(current.trim());
			current = "";
			continue;
		}
		current += char;
	}
	if (current.trim()) parts.push(current.trim());
	return parts;
}

/** Structure for a `linear-gradient(...)`, or null if it is not one we edit. */
export function parseGradient(value: string): LinearGradient | null {
	const match = /^linear-gradient\((.*)\)$/s.exec(value.trim());
	if (!match?.[1]) return null;

	const parts = splitTopLevel(match[1]);
	if (parts.length === 0) return null;

	let angle = 180;
	let first = 0;
	const head = parts[0]!;
	const deg = /^(-?[\d.]+)deg$/.exec(head);
	if (deg) {
		angle = Number.parseFloat(deg[1]!);
		first = 1;
	} else if (/^to\s/.test(head)) {
		// The keyword forms the built-ins never emit, mapped so they still edit.
		const keywords: Record<string, number> = {
			"to top": 0,
			"to right": 90,
			"to bottom": 180,
			"to left": 270,
		};
		angle = keywords[head.trim()] ?? 180;
		first = 1;
	}

	const stops: GradientStop[] = [];
	const rest = parts.slice(first);
	rest.forEach((part, index) => {
		const position = /\s(-?[\d.]+)%$/.exec(part);
		const color = (position ? part.slice(0, position.index) : part).trim();
		if (!color) return;
		stops.push({
			color,
			// Space evenly when a stop has no explicit position, which is what CSS does.
			at: position ? Number.parseFloat(position[1]!) : (index / Math.max(1, rest.length - 1)) * 100,
		});
	});

	return stops.length >= 2 ? { angle, stops } : null;
}

export function formatGradient(gradient: LinearGradient): string {
	const stops = [...gradient.stops]
		.sort((a, b) => a.at - b.at)
		.map((stop) => `${stop.color} ${round(stop.at)}%`)
		.join(", ");
	return `linear-gradient(${round(gradient.angle)}deg, ${stops})`;
}

const round = (n: number) => Math.round(n * 100) / 100;

// ── stop colours ────────────────────────────────────────────────────

/** A stop's colour as a hex + alpha pair the pickers can drive. */
export function stopColor(color: string, colors: SceneColors): { hex: string; alpha: number } {
	const trimmed = color.trim();
	if (trimmed.startsWith("@")) return { hex: colors[trimmed.slice(1)] ?? "#000000", alpha: 1 };

	const rgba = /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)$/i.exec(trimmed);
	if (rgba) {
		const hex = `#${[rgba[1], rgba[2], rgba[3]]
			.map((v) => Math.max(0, Math.min(255, Math.round(Number.parseFloat(v!)))).toString(16).padStart(2, "0"))
			.join("")}`;
		return { hex, alpha: rgba[4] === undefined ? 1 : Number.parseFloat(rgba[4]) };
	}

	return { hex: /^#[0-9a-f]{6}$/i.test(trimmed) ? trimmed : "#000000", alpha: 1 };
}

/** Build a stop colour, keeping it opaque-hex unless transparency is needed. */
export function buildStopColor(hex: string, alpha: number): string {
	return alpha >= 1 ? hex : withAlpha(hex, round(alpha));
}

// ── presets ─────────────────────────────────────────────────────────

export interface GradientPreset {
	id: string;
	name: string;
	description: string;
	build: (colors: SceneColors) => string;
}

/**
 * Starting points, expressed against the site palette.
 *
 * "Night veil" is the one the built-in templates use to keep text legible over
 * a photo — the layer that is easy to delete and, until now, impossible to
 * bring back.
 */
export const GRADIENT_PRESETS: GradientPreset[] = [
	{
		id: "veil",
		name: "Night veil",
		description: "Darkens a photo from the top down so text stays readable. Used by the built-in cards.",
		build: (c) =>
			`linear-gradient(180deg, ${withAlpha(c.night, 0.45)} 0%, ${withAlpha(c.night, 0.62)} 30%, ${withAlpha(
				c.night,
				0.82,
			)} 60%, ${withAlpha(c.night, 0.96)} 85%, ${c.night} 100%)`,
	},
	{
		id: "wash",
		name: "Brand wash",
		description: "A soft diagonal sweep between two brand colours, for cards without a photo.",
		build: () => "linear-gradient(160deg, @deep 0%, @night 100%)",
	},
	{
		id: "fade-up",
		name: "Fade from the bottom",
		description: "Clear at the top, solid at the bottom. Good under a headline sitting low.",
		build: (c) => `linear-gradient(180deg, ${withAlpha(c.night, 0)} 0%, ${c.night} 100%)`,
	},
	{
		id: "amber-glow",
		name: "Amber glow",
		description: "A warm accent sweep, for a highlight band or an accent panel.",
		build: (c) => `linear-gradient(120deg, ${c.amber} 0%, ${withAlpha(c.amber, 0)} 100%)`,
	},
];
