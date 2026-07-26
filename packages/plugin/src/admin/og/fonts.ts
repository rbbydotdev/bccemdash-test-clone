/**
 * Fonts available to a card.
 *
 * The two brand faces are embedded in the render Worker and need no network.
 * Everything else is a Google family, fetched by Takumi at render time and by
 * the browser here, so the editor shows the same face the PNG will use.
 *
 * The catalogue is a short curated list rather than the whole Google directory:
 * a non-technical editor wants a handful of good pairings, not 1,800 names. A
 * family typed by hand still works, since the scene stores a plain family name.
 */

export interface FontChoice {
	/** What the scene stores in `fontFamily` (empty means a brand face). */
	value: string;
	label: string;
}

/** Brand faces, selected via `font` rather than `fontFamily`. */
export const BRAND_FONTS: FontChoice[] = [
	{ value: "", label: "Display serif (brand)" },
	{ value: "@accent", label: "Accent sans (brand)" },
];

/** Curated Google families, grouped so the picker reads as a type menu. */
export const GOOGLE_FONTS: FontChoice[] = [
	{ value: "Playfair Display", label: "Playfair Display — serif" },
	{ value: "Libre Baskerville", label: "Libre Baskerville — serif" },
	{ value: "Lora", label: "Lora — serif" },
	{ value: "Cormorant Garamond", label: "Cormorant Garamond — serif" },
	{ value: "EB Garamond", label: "EB Garamond — serif" },
	{ value: "Bodoni Moda", label: "Bodoni Moda — high contrast" },
	{ value: "DM Serif Display", label: "DM Serif Display — headline" },
	{ value: "Inter", label: "Inter — sans" },
	{ value: "Work Sans", label: "Work Sans — sans" },
	{ value: "Josefin Sans", label: "Josefin Sans — geometric sans" },
	{ value: "Montserrat", label: "Montserrat — sans" },
	{ value: "Oswald", label: "Oswald — condensed" },
	{ value: "Bebas Neue", label: "Bebas Neue — condensed caps" },
	{ value: "Space Grotesk", label: "Space Grotesk — modern sans" },
	{ value: "Archivo Black", label: "Archivo Black — heavy" },
	{ value: "JetBrains Mono", label: "JetBrains Mono — mono" },
];

/**
 * Load Google families into the admin document so the canvas previews them.
 *
 * Idempotent and additive: families are batched into one stylesheet request and
 * kept for the page's life. Removing them on unmount would re-fetch on every
 * selection change, and a stylesheet link is cheap to leave in place.
 *
 * The request asks for each family bare, without a `wght`/`ital` axis. css2
 * rejects the whole request with a 400 if any family lacks a requested axis
 * value (Bebas Neue has no italic, for instance), which would silently drop
 * every font in the batch. The browser synthesises weight and slant instead,
 * which is close enough for a layout preview; the PNG itself is rendered by
 * Takumi, which requests the exact weights the scene uses.
 */
const injected = new Set<string>();

export function ensureWebFonts(families: readonly string[]): void {
	if (typeof document === "undefined") return;
	const wanted = families.map((f) => f.trim()).filter((f) => f && !injected.has(f));
	if (!wanted.length) return;
	for (const family of wanted) injected.add(family);

	const query = wanted
		.map((family) => `family=${encodeURIComponent(family).replace(/%20/g, "+")}`)
		.join("&");
	const link = document.createElement("link");
	link.rel = "stylesheet";
	link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
	link.crossOrigin = "anonymous";
	document.head.appendChild(link);
}

/** Preload every catalogue family so the picker's own labels are legible. */
export function preloadCatalogue(): void {
	ensureWebFonts(GOOGLE_FONTS.map((f) => f.value));
}
