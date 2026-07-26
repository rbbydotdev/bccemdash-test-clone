/**
 * Properties panel for the selected layer.
 *
 * Exposes only what the card model actually supports, so nothing here can
 * produce a scene the renderer cannot draw.
 *
 * Colour has two modes on purpose. Brand tokens (`@amber`) are offered first
 * and are the default, because a card built from tokens re-tints itself when
 * the site's palette changes. A free picker sits beside them for the cases a
 * palette cannot cover, and stores a plain hex.
 *
 * Layout note: Kumo's Input carries an intrinsic min-width, so a naive
 * two-column grid overflows a narrow aside. Numeric fields therefore use a
 * plain input styled to match, laid out as label-left/field-right, which keeps
 * eight of them readable in a 288px column.
 */
import { Button, Input, Select } from "@cloudflare/kumo";
import * as React from "react";

import type { OgLayer, SceneColors } from "@myemdash/og/scene";

import type { MediaItem } from "../lib.js";
import { BRAND_FONTS, GOOGLE_FONTS, ensureWebFonts, preloadCatalogue } from "./fonts.js";

const TOKENS = [
	{ label: "Amber", value: "@amber" },
	{ label: "Moon", value: "@moon" },
	{ label: "Night", value: "@night" },
	{ label: "Deep", value: "@deep" },
	{ label: "Amber light", value: "@amberLight" },
	{ label: "Silver", value: "@silver" },
];

/** Compact numeric row: label left, field right, never wider than its column. */
function NumField({
	label,
	value,
	onChange,
	step = 1,
}: {
	label: string;
	value: number;
	onChange: (n: number) => void;
	step?: number;
}) {
	return (
		<label className="flex items-center justify-between gap-2">
			<span className="text-kumo-subtle shrink-0 text-xs">{label}</span>
			<input
				type="number"
				step={step}
				value={String(value)}
				onChange={(e) => {
					const n = Number.parseFloat(e.target.value);
					onChange(Number.isFinite(n) ? n : value);
				}}
				className="border-kumo-line bg-kumo-base focus:border-kumo-brand w-20 min-w-0 rounded border px-2 py-1 text-right text-xs outline-none"
			/>
		</label>
	);
}

/**
 * Brand swatches plus a free picker.
 *
 * The swatch row shows the palette's real colours, so a choice is made by eye
 * rather than by name. The picker below writes a literal hex, which detaches
 * that layer from the palette — worth saying out loud, since the consequence
 * only shows up later when the brand colours are changed.
 */
function ColorField({
	label,
	value,
	colors,
	onChange,
}: {
	label: string;
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
		<div className="space-y-1.5">
			<p className="text-kumo-subtle text-[0.65rem] font-medium uppercase">{label}</p>
			<div className="flex flex-wrap gap-1.5">
				{TOKENS.map((token) => (
					<button
						key={token.value}
						type="button"
						title={token.label}
						aria-label={token.label}
						onClick={() => onChange(token.value)}
						className={`h-6 w-6 rounded border ${
							value === token.value ? "border-kumo-brand ring-kumo-brand ring-2" : "border-kumo-line"
						}`}
						style={{ backgroundColor: colors[token.value.slice(1)] ?? "#000" }}
					/>
				))}
			</div>
			<div className="flex items-center gap-2">
				<input
					type="color"
					value={/^#[0-9a-f]{6}$/i.test(hex) ? hex : "#000000"}
					onChange={(e) => onChange(e.target.value)}
					className="border-kumo-line h-7 w-9 shrink-0 cursor-pointer rounded border bg-transparent p-0.5"
					aria-label={`${label}: custom colour`}
				/>
				<input
					type="text"
					value={isToken ? "" : value}
					placeholder={isToken ? colors[value.slice(1)] : "#000000"}
					onChange={(e) => onChange(e.target.value)}
					className="border-kumo-line bg-kumo-base focus:border-kumo-brand w-full min-w-0 rounded border px-2 py-1 font-mono text-xs outline-none"
					aria-label={`${label}: hex value`}
				/>
			</div>
			<p className="text-kumo-subtle text-[0.65rem] leading-snug">
				{isToken
					? "Follows the site palette, so it updates if the brand colours change."
					: "A fixed colour. Pick a swatch above to follow the site palette instead."}
			</p>
		</div>
	);
}

export function Inspector({
	layer,
	media,
	colors,
	onChange,
	onDelete,
}: {
	layer: OgLayer | null;
	media: MediaItem[];
	colors: SceneColors;
	onChange: (layer: OgLayer) => void;
	onDelete: () => void;
}) {
	// Load the catalogue once so the font menu and the canvas both have faces to
	// draw with, rather than falling back until a selection is made.
	React.useEffect(() => preloadCatalogue(), []);

	if (!layer) {
		return (
			<aside className="border-kumo-line text-kumo-subtle w-72 shrink-0 rounded-lg border p-4 text-sm">
				<p className="font-medium">Nothing selected</p>
				<p className="mt-2 text-xs">
					Click a layer to edit it, double-click text to retype it, or press ⌘K for commands.
				</p>
			</aside>
		);
	}

	const set = (patch: Partial<OgLayer>) => onChange({ ...layer, ...patch } as OgLayer);

	// One control covers both font mechanisms: the brand faces are stored as
	// `font`, everything else as a `fontFamily` the renderer fetches.
	const fontValue = layer.type === "text" ? (layer.fontFamily || (layer.font === "accent" ? "@accent" : "")) : "";
	const setFont = (value: string) => {
		if (value === "" || value === "@accent") {
			set({ font: value === "@accent" ? "accent" : "display", fontFamily: undefined } as Partial<OgLayer>);
			return;
		}
		ensureWebFonts([value]);
		set({ fontFamily: value } as Partial<OgLayer>);
	};

	return (
		<aside className="border-kumo-line w-72 shrink-0 space-y-4 rounded-lg border p-4">
			<div className="flex items-center justify-between gap-2">
				<p className="truncate text-sm font-medium">{layer.name ?? layer.type}</p>
				<Button size="sm" variant="ghost" onClick={onDelete}>
					Delete
				</Button>
			</div>

			<section className="space-y-1.5">
				<p className="text-kumo-subtle text-[0.65rem] font-medium uppercase">Position &amp; size</p>
				<div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
					<NumField label="X" value={layer.x} onChange={(x) => set({ x })} />
					<NumField label="Y" value={layer.y} onChange={(y) => set({ y })} />
					<NumField label="W" value={layer.w} onChange={(w) => set({ w })} />
					<NumField label="H" value={layer.h} onChange={(h) => set({ h })} />
					<NumField label="Rotate" value={layer.rotation ?? 0} onChange={(rotation) => set({ rotation })} />
					<NumField
						label="Opacity"
						step={0.05}
						value={layer.opacity ?? 1}
						onChange={(o) => set({ opacity: Math.min(1, Math.max(0, o)) })}
					/>
					<NumField label="Radius" value={layer.radius ?? 0} onChange={(radius) => set({ radius })} />
					<NumField label="Blur" value={layer.blur ?? 0} onChange={(blur) => set({ blur })} />
				</div>
			</section>

			{layer.type === "text" && (
				<section className="space-y-2">
					<p className="text-kumo-subtle text-[0.65rem] font-medium uppercase">Text</p>
					<Input
						className="w-full"
						size="sm"
						value={layer.text}
						onChange={(e) => set({ text: e.target.value } as Partial<OgLayer>)}
					/>
					<p className="text-kumo-subtle text-[0.65rem] leading-snug">
						Use {"{{hero.titleLine1}}"} to pull live content.
					</p>
					<div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
						<NumField label="Size" value={layer.size} onChange={(size) => set({ size } as Partial<OgLayer>)} />
						<NumField
							label="Weight"
							step={100}
							value={layer.weight ?? (layer.font === "accent" ? 600 : 300)}
							onChange={(w) =>
								set({ weight: Math.min(900, Math.max(100, Math.round(w / 100) * 100)) } as Partial<OgLayer>)
							}
						/>
						<NumField
							label="Track"
							value={layer.letterSpacing ?? 0}
							onChange={(letterSpacing) => set({ letterSpacing } as Partial<OgLayer>)}
						/>
						<NumField
							label="Leading"
							step={0.05}
							value={layer.lineHeight ?? 1.1}
							onChange={(lineHeight) => set({ lineHeight } as Partial<OgLayer>)}
						/>
					</div>
					<Select
						className="w-full"
						size="sm"
						label="Font"
						value={fontValue}
						onValueChange={(v) => setFont(v ?? "")}
						items={[...BRAND_FONTS, ...GOOGLE_FONTS]}
					/>
					<Select
						className="w-full"
						size="sm"
						label="Align"
						value={layer.align ?? "center"}
						onValueChange={(v) => set({ align: (v ?? "center") as "left" | "center" | "right" } as Partial<OgLayer>)}
						items={[
							{ label: "Left", value: "left" },
							{ label: "Center", value: "center" },
							{ label: "Right", value: "right" },
						]}
					/>
					<ColorField
						label="Colour"
						value={layer.color ?? "@moon"}
						colors={colors}
						onChange={(color) => set({ color } as Partial<OgLayer>)}
					/>
					<div className="flex gap-4 pt-1 text-xs">
						<label className="flex items-center gap-1.5">
							<input
								type="checkbox"
								checked={Boolean(layer.italic)}
								onChange={(e) => set({ italic: e.target.checked } as Partial<OgLayer>)}
							/>
							Italic
						</label>
						<label className="flex items-center gap-1.5">
							<input
								type="checkbox"
								checked={Boolean(layer.uppercase)}
								onChange={(e) => set({ uppercase: e.target.checked } as Partial<OgLayer>)}
							/>
							Uppercase
						</label>
					</div>
				</section>
			)}

			{layer.type === "shape" && (
				<section className="space-y-2">
					<ColorField
						label="Fill"
						value={layer.fill}
						colors={colors}
						onChange={(fill) => set({ fill } as Partial<OgLayer>)}
					/>
					{layer.fill.includes("gradient(") && (
						<p className="text-kumo-subtle text-[0.65rem] leading-snug">
							This layer is a gradient. Choosing a colour replaces it with a solid fill.
						</p>
					)}
				</section>
			)}

			{layer.type === "image" && (
				<section className="space-y-2">
					<p className="text-kumo-subtle text-[0.65rem] font-medium uppercase">Image</p>
					<Select
						className="w-full"
						size="sm"
						value={layer.src}
						onValueChange={(v) => set({ src: v ?? "" } as Partial<OgLayer>)}
						items={[
							{ label: "Follow hero image", value: "{{hero.image}}" },
							{ label: "Follow entry image", value: "{{entry.image}}" },
							...media.slice(0, 40).map((m) => ({ label: m.filename, value: m.id })),
						]}
					/>
					<Select
						className="w-full"
						size="sm"
						label="Fit"
						value={layer.fit ?? "cover"}
						onValueChange={(v) => set({ fit: (v ?? "cover") as "cover" | "contain" } as Partial<OgLayer>)}
						items={[
							{ label: "Cover (fill, may crop)", value: "cover" },
							{ label: "Contain (fit inside)", value: "contain" },
						]}
					/>
				</section>
			)}
		</aside>
	);
}
