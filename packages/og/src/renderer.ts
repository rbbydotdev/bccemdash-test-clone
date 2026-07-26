/**
 * Shared Takumi renderer for OG cards.
 *
 * One renderer per process/isolate (kept on globalThis under a Symbol, since
 * Vite can duplicate modules across SSR chunks) with the brand fonts registered
 * once — renderer reuse keeps the font/image decode caches warm, which is the
 * single biggest Takumi optimization. The backend is runtime-selected via the
 * "#backend" conditional import: native napi on Node, WASM on workerd.
 */
import { loadBackend } from "#backend";

import { fontFiles } from "./fonts/index.js";

/** The surface we use is identical across backends even though the types differ. */
export interface OgRenderer {
	registerFont(font: { name?: string; data: Uint8Array; weight?: number }): Promise<unknown>;
	render(node: unknown, options?: Record<string, unknown>): Promise<Uint8Array>;
}

/** Family names referenced by the card layout. */
export const FONT_DISPLAY = "Cormorant Garamond";
export const FONT_ACCENT = "Josefin Sans";

const FONTS: Array<{ file: string; name: string; weight: number; italic?: boolean }> = [
	{ file: "CormorantGaramond-Light", name: FONT_DISPLAY, weight: 300 },
	{ file: "CormorantGaramond-LightItalic", name: `${FONT_DISPLAY} Italic`, weight: 300, italic: true },
	{ file: "JosefinSans-SemiBold", name: FONT_ACCENT, weight: 600 },
];

const KEY = Symbol.for("bcc.og.renderer");

export function getOgRenderer(): Promise<OgRenderer> {
	const g = globalThis as { [KEY]?: Promise<OgRenderer> };
	g[KEY] ??= (async () => {
		const backend = await loadBackend();
		const renderer = new backend.Renderer() as unknown as OgRenderer;
		for (const font of FONTS) {
			const load = fontFiles[font.file];
			if (!load) throw new Error(`OG font not embedded: ${font.file}`);
			await renderer.registerFont({ name: font.name, data: load(), weight: font.weight });
		}
		return renderer;
	})();
	return g[KEY]!;
}
