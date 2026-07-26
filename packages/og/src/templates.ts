/**
 * Built-in scene templates.
 *
 * These ship with the code so a site always has something to render before the
 * client saves any of their own. Everything is expressed through `{{bindings}}`
 * and `@colour` tokens, so a template follows whatever the site's content and
 * brand palette happen to be.
 */
import { DEFAULT_HEIGHT, DEFAULT_WIDTH, withAlpha, type OgScene } from "./scene.js";

export interface OgTemplate {
	id: string;
	name: string;
	description: string;
	scene: OgScene;
}

/**
 * The hero card — a 1200x630 restatement of the site hero. Layer-for-layer
 * equivalent to the original hard-coded card, so switching to the scene model
 * is a no-op visually.
 */
export function heroTemplate(night: string): OgTemplate {
	// The veil ramp mirrors Hero.astro so the card reads as the same image.
	const veil = `linear-gradient(180deg, ${withAlpha(night, 0.45)} 0%, ${withAlpha(
		night,
		0.62,
	)} 30%, ${withAlpha(night, 0.82)} 60%, ${withAlpha(night, 0.96)} 85%, ${night} 100%)`;

	return {
		id: "hero",
		name: "Hero",
		description: "The site hero: cover photo, night veil, eyebrow, two-tone title and subhead.",
		scene: {
			width: DEFAULT_WIDTH,
			height: DEFAULT_HEIGHT,
			background: "@night",
			layers: [
				{
					id: "photo",
					name: "Hero photo",
					type: "image",
					src: "{{hero.image}}",
					fit: "cover",
					x: 0,
					y: 0,
					w: DEFAULT_WIDTH,
					h: DEFAULT_HEIGHT,
				},
				{
					id: "veil",
					name: "Night veil",
					type: "shape",
					fill: veil,
					x: 0,
					y: 0,
					w: DEFAULT_WIDTH,
					h: DEFAULT_HEIGHT,
				},
				{
					id: "eyebrow",
					name: "Eyebrow",
					type: "text",
					text: "{{hero.eyebrow}}",
					font: "accent",
					size: 24,
					weight: 600,
					letterSpacing: 9,
					color: "@amber",
					uppercase: true,
					align: "center",
					x: 100,
					y: 118,
					w: DEFAULT_WIDTH - 200,
					h: 34,
				},
				{
					id: "title1",
					name: "Title line 1",
					type: "text",
					text: "{{hero.titleLine1}}",
					font: "display",
					size: 108,
					color: "@moon",
					align: "center",
					x: 100,
					y: 178,
					w: DEFAULT_WIDTH - 200,
					h: 120,
				},
				{
					id: "title2",
					name: "Title line 2",
					type: "text",
					text: "{{hero.titleLine2}}",
					font: "display",
					size: 108,
					color: "@amber",
					align: "center",
					x: 100,
					y: 288,
					w: DEFAULT_WIDTH - 200,
					h: 120,
				},
				{
					id: "rule",
					name: "Divider",
					type: "shape",
					fill: "@amber",
					x: (DEFAULT_WIDTH - 90) / 2,
					y: 430,
					w: 90,
					h: 1,
				},
				{
					id: "subhead",
					name: "Subhead",
					type: "text",
					text: "{{hero.subhead}}",
					font: "display",
					italic: true,
					size: 34,
					lineHeight: 1.35,
					color: "@moon",
					align: "center",
					x: 160,
					y: 462,
					w: DEFAULT_WIDTH - 320,
					h: 90,
				},
			],
		},
	};
}

/** Every built-in template, for the picker. */
export function builtInTemplates(night: string): OgTemplate[] {
	return [heroTemplate(night)];
}
