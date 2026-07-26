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
import {
	GRADIENT_PRESETS,
	buildStopColor,
	formatGradient,
	isGradientValue,
	parseGradient,
	stopColor,
	type LinearGradient,
} from "./gradient.js";
import { Muted, NumberField, Row, Section, Swatch, T, fieldStyle } from "./ui.js";

const TOKENS = [
	{ label: "Amber", value: "@amber" },
	{ label: "Moon", value: "@moon" },
	{ label: "Night", value: "@night" },
	{ label: "Deep", value: "@deep" },
	{ label: "Amber light", value: "@amberLight" },
	{ label: "Silver", value: "@silver" },
];

/**
 * The site's palette, always on hand.
 *
 * Kept as its own component so every colour control in the editor offers it —
 * solid fills, text, and each gradient stop — rather than only the places that
 * happened to be built first.
 */
function PaletteRow({
	colors,
	value,
	onPick,
}: {
	colors: SceneColors;
	value?: string;
	onPick: (token: string) => void;
}) {
	return (
		<div>
			<div style={{ fontSize: 10, color: T.subtle, marginBottom: 4 }}>Site palette</div>
			<div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
				{TOKENS.map((token) => (
					<Swatch
						key={token.value}
						title={token.label}
						color={colors[token.value.slice(1)] ?? "#000"}
						active={value === token.value}
						onClick={() => onPick(token.value)}
					/>
				))}
			</div>
		</div>
	);
}

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
			<PaletteRow colors={colors} value={value} onPick={onChange} />
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


/**
 * Structured editing for a gradient fill.
 *
 * Stops are listed as chips and edited one at a time, so the site palette and
 * the free picker both stay available for whichever stop is selected rather
 * than being crammed into every row.
 */
function GradientControl({
	value,
	colors,
	onChange,
}: {
	value: string;
	colors: SceneColors;
	onChange: (value: string) => void;
}) {
	const gradient = parseGradient(value);
	const [active, setActive] = React.useState(0);

	if (!gradient) {
		return (
			<>
				<Muted>
					This gradient uses a form the editor cannot break apart. Choose a preset below to replace it.
				</Muted>
				<PresetPicker colors={colors} onChange={onChange} />
			</>
		);
	}

	const index = Math.min(active, gradient.stops.length - 1);
	const stop = gradient.stops[index]!;
	const { hex, alpha } = stopColor(stop.color, colors);

	const write = (next: LinearGradient) => onChange(formatGradient(next));
	const patchStop = (patch: Partial<typeof stop>) =>
		write({ ...gradient, stops: gradient.stops.map((s, i) => (i === index ? { ...s, ...patch } : s)) });

	return (
		<>
			<PresetPicker colors={colors} onChange={onChange} />

			<Row label="Angle">
				<NumberField
					min={0}
					max={360}
					value={gradient.angle}
					suffix="°"
					onChange={(angle) => write({ ...gradient, angle: ((angle % 360) + 360) % 360 })}
				/>
			</Row>

			<div>
				<div style={{ fontSize: 10, color: T.subtle, marginBottom: 4 }}>Stops</div>
				{/* A live strip of the gradient itself, so the stop chips read in context. */}
				<div
					style={{
						height: 14,
						borderRadius: 4,
						marginBottom: 6,
						border: `1px solid ${T.line}`,
						backgroundImage: formatGradient({ ...gradient, angle: 90 }).replace(
							/@([A-Za-z]\w*)/g,
							(whole, name: string) => colors[name] ?? whole,
						),
					}}
				/>
				<div style={{ display: "flex", flexWrap: "wrap", gap: 5, alignItems: "center" }}>
					{gradient.stops.map((s, i) => (
						<Swatch
							key={i}
							title={`Stop ${i + 1} at ${Math.round(s.at)}%`}
							color={stopColor(s.color, colors).hex}
							active={i === index}
							onClick={() => setActive(i)}
						/>
					))}
					<button
						type="button"
						title="Add a stop"
						aria-label="Add a stop"
						onClick={() => {
							const last = gradient.stops[gradient.stops.length - 1]!;
							write({ ...gradient, stops: [...gradient.stops, { color: last.color, at: 100 }] });
							setActive(gradient.stops.length);
						}}
						style={{
							width: 22,
							height: 22,
							borderRadius: 5,
							cursor: "pointer",
							color: T.subtle,
							background: "transparent",
							border: `1px dashed ${T.line}`,
							padding: 0,
						}}
					>
						+
					</button>
				</div>
			</div>

			<Row label="Position">
				<NumberField min={0} max={100} value={stop.at} suffix="%" onChange={(at) => patchStop({ at })} />
			</Row>
			<Row label="Opacity">
				<NumberField
					min={0}
					max={1}
					step={0.05}
					value={alpha}
					onChange={(a) => patchStop({ color: buildStopColor(hex, a) })}
				/>
			</Row>

			<PaletteRow
				colors={colors}
				value={stop.color}
				onPick={(token) => patchStop({ color: alpha >= 1 ? token : buildStopColor(colors[token.slice(1)] ?? hex, alpha) })}
			/>
			<div style={{ display: "flex", alignItems: "center", gap: 6 }}>
				<input
					type="color"
					aria-label="Stop colour"
					value={hex}
					onChange={(e) => patchStop({ color: buildStopColor(e.target.value, alpha) })}
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
				{gradient.stops.length > 2 && (
					<button
						type="button"
						onClick={() => {
							write({ ...gradient, stops: gradient.stops.filter((_, i) => i !== index) });
							setActive(Math.max(0, index - 1));
						}}
						style={{ ...fieldStyle, cursor: "pointer", color: T.subtle }}
					>
						Remove stop
					</button>
				)}
			</div>
			<Muted>
				{stop.color.trim().startsWith("@")
					? "This stop follows the site palette."
					: alpha < 1
						? "A see-through stop is a fixed colour, since a palette colour carries no transparency."
						: "A fixed colour. Pick a palette swatch to follow the site's brand instead."}
			</Muted>
		</>
	);
}

function PresetPicker({ colors, onChange }: { colors: SceneColors; onChange: (value: string) => void }) {
	return (
		<Select
			size="sm"
			label="Preset"
			placeholder="Choose a gradient"
			value={""}
			onValueChange={(id) => {
				const preset = GRADIENT_PRESETS.find((p) => p.id === id);
				if (preset) onChange(preset.build(colors));
			}}
			items={GRADIENT_PRESETS.map((p) => ({ label: p.name, value: p.id }))}
		/>
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
					<NumberField
						min={-180}
						max={180}
						value={layer.rotation ?? 0}
						onChange={(rotation) => set({ rotation })}
						suffix="°"
					/>
				</Row>
				<Row label="Opacity">
					<NumberField
						min={0}
						max={1}
						step={0.05}
						value={layer.opacity ?? 1}
						onChange={(opacity) => set({ opacity })}
					/>
				</Row>
				<Row label="Corner">
					<NumberField min={0} max={200} value={layer.radius ?? 0} onChange={(radius) => set({ radius })} />
				</Row>
				<Row label="Blur">
					<NumberField min={0} max={40} value={layer.blur ?? 0} onChange={(blur) => set({ blur })} />
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
							<NumberField
								min={8}
								max={220}
								value={layer.size}
								onChange={(size) => set({ size } as Partial<OgLayer>)}
							/>
						</Row>
						<Row label="Weight">
							<NumberField
								min={100}
								max={900}
								step={100}
								value={layer.weight ?? (layer.font === "accent" ? 600 : 300)}
								onChange={(weight) => set({ weight } as Partial<OgLayer>)}
							/>
						</Row>
						<Row label="Tracking">
							<NumberField
								min={-10}
								max={40}
								step={0.5}
								value={layer.letterSpacing ?? 0}
								onChange={(letterSpacing) => set({ letterSpacing } as Partial<OgLayer>)}
							/>
						</Row>
						<Row label="Leading">
							<NumberField
								min={0.8}
								max={2.5}
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
					<Select
						size="sm"
						label="Type"
						value={isGradientValue(layer.fill) ? "gradient" : "solid"}
						onValueChange={(kind) => {
							if (kind === "gradient" && !isGradientValue(layer.fill)) {
								set({ fill: GRADIENT_PRESETS[0]!.build(colors) } as Partial<OgLayer>);
							} else if (kind === "solid" && isGradientValue(layer.fill)) {
								// Keep the gradient's first stop, so switching back is not a reset.
								const first = parseGradient(layer.fill)?.stops[0]?.color;
								set({ fill: first ?? "@amber" } as Partial<OgLayer>);
							}
						}}
						items={[
							{ label: "Solid colour", value: "solid" },
							{ label: "Gradient", value: "gradient" },
						]}
					/>
					{isGradientValue(layer.fill) ? (
						<GradientControl
							value={layer.fill}
							colors={colors}
							onChange={(fill) => set({ fill } as Partial<OgLayer>)}
						/>
					) : (
						<ColorControl
							value={layer.fill}
							colors={colors}
							onChange={(fill) => set({ fill } as Partial<OgLayer>)}
						/>
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
