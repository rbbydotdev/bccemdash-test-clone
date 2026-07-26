/**
 * Properties panel for the selected layer — the right-hand dock's Design tab.
 *
 * Exposes only what the card model supports, so nothing here can produce a
 * scene the renderer cannot draw.
 *
 * Colour has two modes on purpose. Brand tokens (`@amber`) come first and are
 * the default, because a card built from tokens re-tints itself when the site's
 * palette changes. A free picker sits beside them for what a palette cannot
 * cover, and stores a plain hex.
 *
 * Styling is inline rather than Tailwind — see the note in ui.tsx.
 */
import { Select } from "@cloudflare/kumo";
import * as React from "react";

import type { OgLayer, SceneColors } from "@myemdash/og/scene";

import type { MediaItem } from "../lib.js";
import { BRAND_FONTS, GOOGLE_FONTS, ensureWebFonts, preloadCatalogue } from "./fonts.js";
import { Muted, NumberField, Row, Section, Swatch, T, fieldStyle } from "./ui.js";

const TOKENS = [
	{ label: "Amber", value: "@amber" },
	{ label: "Moon", value: "@moon" },
	{ label: "Night", value: "@night" },
	{ label: "Deep", value: "@deep" },
	{ label: "Amber light", value: "@amberLight" },
	{ label: "Silver", value: "@silver" },
];

/** Brand swatches plus a free picker, sharing one value. */
function ColorControl({
	value,
	colors,
	onChange,
}: {
	value: string;
	colors: SceneColors;
	onChange: (value: string) => void;
}) {
	const isToken = value.startsWith("@");
	const isGradient = value.includes("gradient(");
	// A gradient has no single colour to seed the picker with, so start from the
	// brand amber rather than showing the picker as black.
	const hex = isToken ? (colors[value.slice(1)] ?? colors.amber) : isGradient ? colors.amber : value;

	return (
		<>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
				{TOKENS.map((token) => (
					<Swatch
						key={token.value}
						title={token.label}
						color={colors[token.value.slice(1)] ?? "#000"}
						active={value === token.value}
						onClick={() => onChange(token.value)}
					/>
				))}
			</div>
			<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
				<input
					type="color"
					aria-label="Custom colour"
					value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000"}
					onChange={(e) => onChange(e.target.value)}
					style={{
						width: 30,
						height: 24,
						padding: 2,
						flexShrink: 0,
						cursor: "pointer",
						background: "transparent",
						border: `1px solid ${T.line}`,
						borderRadius: 6,
					}}
				/>
				<input
					type="text"
					aria-label="Hex value"
					value={isToken ? "" : value}
					placeholder={isToken ? (colors[value.slice(1)] ?? "#000000") : "#000000"}
					onChange={(e) => onChange(e.target.value)}
					style={{ ...fieldStyle, flex: 1, fontFamily: "ui-monospace, monospace" }}
				/>
			</div>
			<Muted>
				{isToken
					? "Follows the site palette, so it updates if the brand colours change."
					: "A fixed colour. Pick a swatch to follow the site palette instead."}
			</Muted>
		</>
	);
}

export function Inspector({
	layer,
	media,
	colors,
	onChange,
}: {
	layer: OgLayer | null;
	media: MediaItem[];
	colors: SceneColors;
	onChange: (layer: OgLayer) => void;
}) {
	// Load the catalogue once so the font menu and the canvas both have faces to
	// draw with, rather than falling back until a selection is made.
	React.useEffect(() => preloadCatalogue(), []);

	if (!layer) {
		return (
			<div style={{ padding: 16 }}>
				<Muted>
					Nothing selected. Click a layer on the canvas to edit it, double-click text to retype it, or press
					⌘K for commands.
				</Muted>
			</div>
		);
	}

	const set = (patch: Partial<OgLayer>) => onChange({ ...layer, ...patch } as OgLayer);

	// One control covers both font mechanisms: the brand faces are stored as
	// `font`, everything else as a `fontFamily` the renderer fetches.
	const fontValue = layer.type === "text" ? layer.fontFamily || (layer.font === "accent" ? "@accent" : "") : "";
	const setFont = (value: string) => {
		if (value === "" || value === "@accent") {
			set({ font: value === "@accent" ? "accent" : "display", fontFamily: undefined } as Partial<OgLayer>);
			return;
		}
		ensureWebFonts([value]);
		set({ fontFamily: value } as Partial<OgLayer>);
	};

	return (
		<div style={{ overflowY: "auto", minWidth: 0 }}>
			<Section title="Position & size">
				<Row label="X">
					<NumberField value={layer.x} onChange={(x) => set({ x })} />
				</Row>
				<Row label="Y">
					<NumberField value={layer.y} onChange={(y) => set({ y })} />
				</Row>
				<Row label="Width">
					<NumberField value={layer.w} onChange={(w) => set({ w })} />
				</Row>
				<Row label="Height">
					<NumberField value={layer.h} onChange={(h) => set({ h })} />
				</Row>
				<Row label="Rotate">
					<NumberField value={layer.rotation ?? 0} onChange={(rotation) => set({ rotation })} suffix="°" />
				</Row>
				<Row label="Opacity">
					<NumberField
						step={0.05}
						value={layer.opacity ?? 1}
						onChange={(o) => set({ opacity: Math.min(1, Math.max(0, o)) })}
					/>
				</Row>
				<Row label="Corner">
					<NumberField value={layer.radius ?? 0} onChange={(radius) => set({ radius })} />
				</Row>
				<Row label="Blur">
					<NumberField value={layer.blur ?? 0} onChange={(blur) => set({ blur })} />
				</Row>
			</Section>

			{layer.type === "text" && (
				<>
					<Section title="Text">
						<textarea
							value={layer.text}
							rows={2}
							onChange={(e) => set({ text: e.target.value } as Partial<OgLayer>)}
							style={{ ...fieldStyle, width: "100%", resize: "vertical", fontSize: 12 }}
						/>
						<Muted>Use {"{{hero.titleLine1}}"} to pull live content.</Muted>
						<Select
							size="sm"
							label="Font"
							value={fontValue}
							onValueChange={(v) => setFont(v ?? "")}
							items={[...BRAND_FONTS, ...GOOGLE_FONTS]}
						/>
						<Row label="Size">
							<NumberField value={layer.size} onChange={(size) => set({ size } as Partial<OgLayer>)} />
						</Row>
						<Row label="Weight">
							<NumberField
								step={100}
								value={layer.weight ?? (layer.font === "accent" ? 600 : 300)}
								onChange={(w) =>
									set({ weight: Math.min(900, Math.max(100, Math.round(w / 100) * 100)) } as Partial<OgLayer>)
								}
							/>
						</Row>
						<Row label="Tracking">
							<NumberField
								value={layer.letterSpacing ?? 0}
								onChange={(letterSpacing) => set({ letterSpacing } as Partial<OgLayer>)}
							/>
						</Row>
						<Row label="Leading">
							<NumberField
								step={0.05}
								value={layer.lineHeight ?? 1.1}
								onChange={(lineHeight) => set({ lineHeight } as Partial<OgLayer>)}
							/>
						</Row>
						<Select
							size="sm"
							label="Align"
							value={layer.align ?? "center"}
							onValueChange={(v) =>
								set({ align: (v ?? "center") as "left" | "center" | "right" } as Partial<OgLayer>)
							}
							items={[
								{ label: "Left", value: "left" },
								{ label: "Center", value: "center" },
								{ label: "Right", value: "right" },
							]}
						/>
						<div style={{ display: "flex", gap: 14, fontSize: 11, color: T.text }}>
							<label style={{ display: "flex", alignItems: "center", gap: 5 }}>
								<input
									type="checkbox"
									checked={Boolean(layer.italic)}
									onChange={(e) => set({ italic: e.target.checked } as Partial<OgLayer>)}
								/>
								Italic
							</label>
							<label style={{ display: "flex", alignItems: "center", gap: 5 }}>
								<input
									type="checkbox"
									checked={Boolean(layer.uppercase)}
									onChange={(e) => set({ uppercase: e.target.checked } as Partial<OgLayer>)}
								/>
								Uppercase
							</label>
						</div>
					</Section>
					<Section title="Colour">
						<ColorControl
							value={layer.color ?? "@moon"}
							colors={colors}
							onChange={(color) => set({ color } as Partial<OgLayer>)}
						/>
					</Section>
				</>
			)}

			{layer.type === "shape" && (
				<Section title="Fill">
					<ColorControl
						value={layer.fill}
						colors={colors}
						onChange={(fill) => set({ fill } as Partial<OgLayer>)}
					/>
					{layer.fill.includes("gradient(") && (
						<Muted>This layer is a gradient. Choosing a colour replaces it with a solid fill.</Muted>
					)}
				</Section>
			)}

			{layer.type === "image" && (
				<Section title="Image">
					<Select
						size="sm"
						label="Source"
						value={layer.src}
						onValueChange={(v) => set({ src: v ?? "" } as Partial<OgLayer>)}
						items={[
							{ label: "Follow hero image", value: "{{hero.image}}" },
							{ label: "Follow entry image", value: "{{entry.image}}" },
							...media.slice(0, 40).map((m) => ({ label: m.filename, value: m.id })),
						]}
					/>
					<Select
						size="sm"
						label="Fit"
						value={layer.fit ?? "cover"}
						onValueChange={(v) => set({ fit: (v ?? "cover") as "cover" | "contain" } as Partial<OgLayer>)}
						items={[
							{ label: "Cover (fill, may crop)", value: "cover" },
							{ label: "Contain (fit inside)", value: "contain" },
						]}
					/>
				</Section>
			)}
		</div>
	);
}
