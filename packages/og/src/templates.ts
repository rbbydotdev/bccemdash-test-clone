/**
 * Built-in scene templates.
 *
 * These ship with the code so a site always has something to render before the
 * client saves their own, and they double as starting points in the editor
 * ("New card" from a template). Everything is expressed through `{{bindings}}`
 * and `@colour` tokens, so a template follows whatever the site's content and
 * brand palette happen to be — including per-entry content later, since the
 * same binding syntax resolves against any context.
 */
import { DEFAULT_HEIGHT as H, DEFAULT_WIDTH as W, withAlpha, type OgLayer, type OgScene } from "./scene.js";

export interface OgTemplate {
	id: string;
	name: string;
	description: string;
	scene: OgScene;
}

// ── shared pieces ───────────────────────────────────────────────────

/** Full-bleed photo layer bound to a content field. */
const photo = (src = "{{hero.image}}"): OgLayer => ({
	id: "photo",
	name: "Photo",
	type: "image",
	src,
	fit: "cover",
	x: 0,
	y: 0,
	w: W,
	h: H,
});

/** The hero's night ramp — keeps text legible over any photo. */
const veil = (night: string, strength = 1): OgLayer => ({
	id: "veil",
	name: "Night veil",
	type: "shape",
	fill: `linear-gradient(180deg, ${withAlpha(night, 0.45 * strength)} 0%, ${withAlpha(
		night,
		0.62 * strength,
	)} 30%, ${withAlpha(night, 0.82 * strength)} 60%, ${withAlpha(night, 0.96 * strength)} 85%, ${night} 100%)`,
	x: 0,
	y: 0,
	w: W,
	h: H,
});

/** A flat wash, for templates that don't use a photo. */
const wash = (from: string, to: string): OgLayer => ({
	id: "wash",
	name: "Background",
	type: "shape",
	fill: `linear-gradient(160deg, ${from} 0%, ${to} 100%)`,
	x: 0,
	y: 0,
	w: W,
	h: H,
});

const eyebrow = (text: string, y = 118): OgLayer => ({
	id: "eyebrow",
	name: "Eyebrow",
	type: "text",
	text,
	font: "accent",
	size: 24,
	weight: 600,
	letterSpacing: 9,
	color: "@amber",
	uppercase: true,
	align: "center",
	x: 100,
	y,
	w: W - 200,
	h: 34,
});

const rule = (y: number): OgLayer => ({
	id: "rule",
	name: "Divider",
	type: "shape",
	fill: "@amber",
	x: (W - 90) / 2,
	y,
	w: 90,
	h: 1,
});

const title = (
	id: string,
	text: string,
	y: number,
	color: string,
	size = 108,
): OgLayer => ({
	id,
	name: `Title ${id.slice(-1)}`,
	type: "text",
	text,
	font: "display",
	size,
	color,
	align: "center",
	x: 100,
	y,
	w: W - 200,
	h: size * 1.12,
});

const subhead = (text: string, y: number): OgLayer => ({
	id: "subhead",
	name: "Subhead",
	type: "text",
	text,
	font: "display",
	italic: true,
	size: 34,
	lineHeight: 1.35,
	color: "@moon",
	align: "center",
	x: 160,
	y,
	w: W - 320,
	h: 90,
});

// ── templates ───────────────────────────────────────────────────────

/**
 * The hero card. Layer-for-layer equivalent to the original hard-coded card,
 * so adopting the scene model was a no-op visually.
 */
export function heroTemplate(night: string): OgTemplate {
	return {
		id: "hero",
		name: "Hero",
		description: "The site hero: cover photo, night veil, eyebrow, two-tone title and subhead.",
		scene: {
			width: W,
			height: H,
			background: "@night",
			layers: [
				photo(),
				veil(night),
				eyebrow("{{hero.eyebrow}}"),
				title("title1", "{{hero.titleLine1}}", 178, "@moon"),
				title("title2", "{{hero.titleLine2}}", 288, "@amber"),
				rule(430),
				subhead("{{hero.subhead}}", 462),
			],
		},
	};
}

export function builtInTemplates(night: string): OgTemplate[] {
	return [
		heroTemplate(night),

		{
			id: "quote",
			name: "Quote",
			description: "A pull quote over the hero photo — good for sharing the mission line.",
			scene: {
				width: W,
				height: H,
				background: "@night",
				layers: [
					photo(),
					veil(night, 1.05),
					{ ...eyebrow("{{mission.eyebrow}}", 110) },
					{
						id: "quote",
						name: "Quote",
						type: "text",
						text: "{{mission.quote}}",
						font: "display",
						italic: true,
						size: 58,
						lineHeight: 1.28,
						color: "@moon",
						align: "center",
						x: 130,
						y: 190,
						w: W - 260,
						h: 250,
					},
					rule(470),
					{
						id: "attrib",
						name: "Attribution",
						type: "text",
						text: "{{footer.tagline}}",
						font: "accent",
						size: 20,
						letterSpacing: 6,
						uppercase: true,
						color: "@amber",
						align: "center",
						x: 160,
						y: 500,
						w: W - 320,
						h: 30,
					},
				],
			},
		},

		{
			id: "stat",
			name: "Statistic",
			description: "One big number over the photo — for impact figures.",
			scene: {
				width: W,
				height: H,
				background: "@night",
				layers: [
					photo(),
					veil(night, 1.1),
					eyebrow("{{story.eyebrow}}", 130),
					title("stat", "1.5M", 190, "@amber", 170),
					{
						id: "statLabel",
						name: "Label",
						type: "text",
						text: "Bats in the colony",
						font: "accent",
						size: 26,
						letterSpacing: 7,
						uppercase: true,
						color: "@moon",
						align: "center",
						x: 160,
						y: 400,
						w: W - 320,
						h: 40,
					},
					rule(470),
					subhead("{{footer.caption}}", 496),
				],
			},
		},

		{
			id: "wordmark",
			name: "Wordmark",
			description: "Minimal: brand name on the night gradient, no photo.",
			scene: {
				width: W,
				height: H,
				background: "@night",
				layers: [
					wash("@deep", "@night"),
					eyebrow("{{hero.eyebrow}}", 200),
					title("title1", "{{hero.titleLine1}}", 258, "@moon"),
					title("title2", "{{hero.titleLine2}}", 368, "@amber"),
					rule(500),
				],
			},
		},

		{
			id: "announcement",
			name: "Announcement",
			description: "Headline plus a call to action band — for news and events.",
			scene: {
				width: W,
				height: H,
				background: "@night",
				layers: [
					photo(),
					veil(night, 1.05),
					eyebrow("Announcement", 120),
					title("title1", "{{hero.titleLine1}}", 180, "@moon", 92),
					subhead("{{hero.subhead}}", 320),
					{
						id: "ctaBand",
						name: "CTA band",
						type: "shape",
						fill: "@amber",
						radius: 6,
						x: (W - 380) / 2,
						y: 450,
						w: 380,
						h: 72,
					},
					{
						id: "ctaText",
						name: "CTA label",
						type: "text",
						text: "{{hero.ctaPrimary}}",
						font: "accent",
						size: 24,
						letterSpacing: 6,
						uppercase: true,
						color: "@night",
						align: "center",
						x: (W - 380) / 2,
						y: 450,
						w: 380,
						h: 72,
					},
				],
			},
		},

		{
			id: "experience",
			name: "Experience",
			description: "Photo-led with the title low — designed for a single experience.",
			scene: {
				width: W,
				height: H,
				background: "@night",
				layers: [
					photo("{{entry.image}}"),
					veil(night),
					eyebrow("{{experiences.eyebrow}}", 330),
					title("title1", "{{entry.title}}", 380, "@moon", 76),
					subhead("{{entry.description}}", 490),
				],
			},
		},

		{
			id: "programs",
			name: "Programs",
			description: "The programs framing, for the /programs page and its entries.",
			scene: {
				width: W,
				height: H,
				background: "@night",
				layers: [
					wash("@deep", "@night"),
					eyebrow("{{programs.eyebrow}}", 170),
					title("title1", "{{programs.heading}}", 230, "@moon", 88),
					title("title2", "{{programs.headingAccent}}", 330, "@amber", 88),
					rule(470),
					subhead("{{footer.tagline}}", 496),
				],
			},
		},

		{
			id: "founder",
			name: "Founder",
			description: "Portrait on one side, name and title on the other.",
			scene: {
				width: W,
				height: H,
				background: "@night",
				layers: [
					wash("@deep", "@night"),
					{
						id: "portrait",
						name: "Portrait",
						type: "image",
						src: "{{founder.image}}",
						fit: "cover",
						x: 0,
						y: 0,
						w: 470,
						h: H,
					},
					{
						id: "eyebrow",
						name: "Eyebrow",
						type: "text",
						text: "{{founder.eyebrow}}",
						font: "accent",
						size: 22,
						letterSpacing: 8,
						uppercase: true,
						color: "@amber",
						align: "left",
						x: 540,
						y: 200,
						w: 590,
						h: 30,
					},
					{
						id: "name",
						name: "Name",
						type: "text",
						text: "{{founder.name}}",
						font: "display",
						size: 84,
						color: "@moon",
						align: "left",
						x: 540,
						y: 250,
						w: 590,
						h: 100,
					},
					{
						id: "role",
						name: "Role",
						type: "text",
						text: "{{founder.title}}",
						font: "display",
						italic: true,
						size: 32,
						color: "@amber",
						align: "left",
						x: 540,
						y: 360,
						w: 590,
						h: 50,
					},
				],
			},
		},

		{
			id: "devotions",
			name: "Devotions",
			description: "The giving ask, with the devote call to action.",
			scene: {
				width: W,
				height: H,
				background: "@night",
				layers: [
					photo(),
					veil(night, 1.08),
					eyebrow("{{devotions.eyebrow}}", 140),
					title("title1", "{{devotions.heading}}", 200, "@moon", 84),
					title("title2", "{{devotions.headingAccent}}", 296, "@amber", 84),
					rule(430),
					subhead("{{devotions.lede}}", 460),
				],
			},
		},

		{
			id: "closing",
			name: "Closing",
			description: "The site's closing band, restated as a card.",
			scene: {
				width: W,
				height: H,
				background: "@night",
				layers: [
					photo("{{closing.image}}"),
					veil(night, 1.1),
					title("title1", "{{closing.line1}}", 200, "@moon", 96),
					title("title2", "{{closing.line1Accent}}", 306, "@amber", 96),
					rule(450),
					subhead("{{closing.line2}}", 480),
				],
			},
		},
	];
}
