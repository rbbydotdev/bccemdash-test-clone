/**
 * The OG card layout — a 1200x630 restatement of the site hero.
 *
 * Deliberately hard-coded rather than template-driven: the client never edits
 * this, it just reflects whatever hero copy, hero image and brand colours are
 * set in Site Content. Mirrors Hero.astro's composition — cover image, night
 * gradient veil, amber eyebrow, light display title with an amber second line,
 * hairline divider, italic subhead.
 */
import { container, text, type Node } from "@takumi-rs/helpers";

import { FONT_ACCENT, FONT_DISPLAY } from "./renderer.js";

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Background image src the card references; resolve its bytes before render. */
export const BG_SRC = "bcc://hero";

export interface CardColors {
	night: string;
	deep: string;
	amber: string;
	moon: string;
}

export interface CardContent {
	eyebrow: string;
	titleLine1: string;
	titleLine2: string;
	subhead: string;
	/** Whether hero image bytes will be supplied for {@link BG_SRC}. */
	hasImage: boolean;
	colors: CardColors;
}

/** Trim overlong copy so the card never overflows its 1200x630 frame. */
function clamp(value: string, max: number): string {
	const clean = value.replace(/\s+/g, " ").trim();
	return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

export function buildCard(content: CardContent): Node {
	const { colors } = content;
	const children: Node[] = [];

	// Layer 1 — cover image, or a deep→night wash when none is set.
	children.push(
		content.hasImage
			? container({
					style: {
						position: "absolute",
						inset: 0,
						width: OG_WIDTH,
						height: OG_HEIGHT,
						backgroundImage: `url(${BG_SRC})`,
						backgroundSize: "cover",
						backgroundPosition: "center",
					},
				})
			: container({
					style: {
						position: "absolute",
						inset: 0,
						width: OG_WIDTH,
						height: OG_HEIGHT,
						backgroundImage: `linear-gradient(180deg, ${colors.deep} 0%, ${colors.night} 100%)`,
					},
				}),
	);

	// Layer 2 — the night veil. Same ramp as the hero so text stays legible over
	// any photo: light at the top, near-opaque by the bottom.
	children.push(
		container({
			style: {
				position: "absolute",
				inset: 0,
				width: OG_WIDTH,
				height: OG_HEIGHT,
				// Same ramp as Hero.astro so the card reads as the same image.
				backgroundImage: `linear-gradient(180deg, ${rgba(colors.night, 0.45)} 0%, ${rgba(
					colors.night,
					0.62,
				)} 30%, ${rgba(colors.night, 0.82)} 60%, ${rgba(colors.night, 0.96)} 85%, ${
					colors.night
				} 100%)`,
			},
		}),
	);

	// Layer 3 — the copy stack, centred.
	const stack: Node[] = [];

	if (content.eyebrow) {
		stack.push(
			text(clamp(content.eyebrow, 48).toUpperCase(), {
				fontFamily: FONT_ACCENT,
				fontSize: 24,
				fontWeight: 600,
				letterSpacing: 9,
				color: colors.amber,
			}),
		);
	}

	stack.push(
		text(clamp(content.titleLine1, 30), {
			fontFamily: FONT_DISPLAY,
			fontSize: 108,
			fontWeight: 300,
			lineHeight: 1.02,
			color: colors.moon,
			marginTop: 26,
		}),
	);

	if (content.titleLine2) {
		stack.push(
			text(clamp(content.titleLine2, 30), {
				fontFamily: FONT_DISPLAY,
				fontSize: 108,
				fontWeight: 300,
				lineHeight: 1.02,
				color: colors.amber,
			}),
		);
	}

	// Hairline divider, echoing .divider-amber.
	stack.push(
		container({
			style: {
				width: 90,
				height: 1,
				backgroundColor: colors.amber,
				marginTop: 34,
				marginBottom: 30,
			},
		}),
	);

	if (content.subhead) {
		stack.push(
			text(clamp(content.subhead, 96), {
				fontFamily: `${FONT_DISPLAY} Italic`,
				fontSize: 34,
				fontWeight: 300,
				lineHeight: 1.35,
				color: colors.moon,
				textAlign: "center",
				maxWidth: 880,
			}),
		);
	}

	children.push(
		container({
			style: {
				position: "absolute",
				inset: 0,
				width: OG_WIDTH,
				height: OG_HEIGHT,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				paddingLeft: 90,
				paddingRight: 90,
				textAlign: "center",
			},
			children: stack,
		}),
	);

	return container({
		style: {
			width: OG_WIDTH,
			height: OG_HEIGHT,
			display: "flex",
			position: "relative",
			backgroundColor: colors.night,
		},
		children,
	});
}

/** `#rrggbb` + alpha → `rgba(...)`, so the veil works with client-set colours. */
function rgba(hex: string, alpha: number): string {
	const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
	if (!m) return `rgba(10, 14, 26, ${alpha})`;
	const n = Number.parseInt(m[1]!, 16);
	return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
