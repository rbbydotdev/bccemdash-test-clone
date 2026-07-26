/**
 * Render the OG card to PNG bytes. Framework-free; identical on Node (native
 * napi) and workerd (WASM) via the shared renderer.
 */
import { render } from "takumi-js";

import { BG_SRC, OG_HEIGHT, OG_WIDTH, buildCard, type CardContent } from "./card.js";
import { getOgRenderer } from "./renderer.js";

/** `hasImage` is derived from `imageBytes`, so callers never pass it. */
export interface RenderCardOptions extends Omit<CardContent, "hasImage"> {
	/** Hero image bytes, read from media storage (never a self-fetch). */
	imageBytes?: Uint8Array | ArrayBuffer;
}

export async function renderOgCard(options: RenderCardOptions): Promise<Uint8Array> {
	const { imageBytes, ...content } = options;
	const node = buildCard({ ...content, hasImage: Boolean(imageBytes) });
	const renderer = await getOgRenderer();

	const bytes = await render(node as never, {
		renderer: renderer as never,
		width: OG_WIDTH,
		height: OG_HEIGHT,
		format: "png",
		images: imageBytes ? [{ src: BG_SRC, data: imageBytes }] : [],
	} as never);

	return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes as ArrayBuffer);
}
