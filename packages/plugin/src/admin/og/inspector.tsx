/**
 * Properties panel for the selected layer.
 *
 * Exposes only what the card model actually supports, so nothing here can
 * produce a scene the renderer cannot draw. Colours are offered as brand tokens
 * (`@amber`) rather than a free colour picker, so cards keep following the
 * site's palette when it is retinted.
 */
import { Button, Input, Select } from "@cloudflare/kumo";

import type { OgLayer } from "@myemdash/og/scene";

import type { MediaItem } from "../lib.js";

const TOKENS = [
	{ label: "Amber", value: "@amber" },
	{ label: "Moon", value: "@moon" },
	{ label: "Night", value: "@night" },
	{ label: "Deep", value: "@deep" },
	{ label: "Amber light", value: "@amberLight" },
	{ label: "Silver", value: "@silver" },
];

export function Inspector({
	layer,
	media,
	onChange,
	onDelete,
}: {
	layer: OgLayer | null;
	media: MediaItem[];
	onChange: (layer: OgLayer) => void;
	onDelete: () => void;
}) {
	if (!layer) {
		return (
			<aside className="border-kumo-line text-kumo-subtle w-64 shrink-0 rounded-lg border p-4 text-sm">
				<p className="font-medium">Nothing selected</p>
				<p className="mt-2 text-xs">
					Click a layer to edit it, double-click text to retype it, or press ⌘K for commands.
				</p>
			</aside>
		);
	}

	const set = (patch: Partial<OgLayer>) => onChange({ ...layer, ...patch } as OgLayer);
	const num = (v: string, fallback: number) => {
		const n = Number.parseFloat(v);
		return Number.isFinite(n) ? n : fallback;
	};

	return (
		<aside className="border-kumo-line w-64 shrink-0 space-y-3 rounded-lg border p-4">
			<div className="flex items-center justify-between">
				<p className="text-sm font-medium">{layer.name ?? layer.type}</p>
				<Button size="sm" variant="ghost" onClick={onDelete}>
					Delete
				</Button>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<Input size="sm" label="X" value={String(layer.x)} onChange={(e) => set({ x: num(e.target.value, layer.x) })} />
				<Input size="sm" label="Y" value={String(layer.y)} onChange={(e) => set({ y: num(e.target.value, layer.y) })} />
				<Input size="sm" label="W" value={String(layer.w)} onChange={(e) => set({ w: num(e.target.value, layer.w) })} />
				<Input size="sm" label="H" value={String(layer.h)} onChange={(e) => set({ h: num(e.target.value, layer.h) })} />
				<Input
					size="sm"
					label="Rotation"
					value={String(layer.rotation ?? 0)}
					onChange={(e) => set({ rotation: num(e.target.value, 0) })}
				/>
				<Input
					size="sm"
					label="Opacity"
					value={String(layer.opacity ?? 1)}
					onChange={(e) => set({ opacity: Math.min(1, Math.max(0, num(e.target.value, 1))) })}
				/>
				<Input
					size="sm"
					label="Radius"
					value={String(layer.radius ?? 0)}
					onChange={(e) => set({ radius: num(e.target.value, 0) })}
				/>
				<Input
					size="sm"
					label="Blur"
					value={String(layer.blur ?? 0)}
					onChange={(e) => set({ blur: num(e.target.value, 0) })}
				/>
			</div>

			{layer.type === "text" && (
				<div className="space-y-2">
					<Input
						size="sm"
						label="Text"
						description="Use {{hero.titleLine1}} to pull live content."
						value={layer.text}
						onChange={(e) => set({ text: e.target.value } as Partial<OgLayer>)}
					/>
					<div className="grid grid-cols-2 gap-2">
						<Input
							size="sm"
							label="Size"
							value={String(layer.size)}
							onChange={(e) => set({ size: num(e.target.value, layer.size) } as Partial<OgLayer>)}
						/>
						<Input
							size="sm"
							label="Tracking"
							value={String(layer.letterSpacing ?? 0)}
							onChange={(e) => set({ letterSpacing: num(e.target.value, 0) } as Partial<OgLayer>)}
						/>
					</div>
					<Select
						size="sm"
						label="Font"
						value={layer.font ?? "display"}
						onValueChange={(v) => set({ font: (v ?? "display") as "display" | "accent" } as Partial<OgLayer>)}
						items={[
							{ label: "Display serif", value: "display" },
							{ label: "Accent sans", value: "accent" },
						]}
					/>
					<Select
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
					<Select
						size="sm"
						label="Colour"
						value={layer.color ?? "@moon"}
						onValueChange={(v) => set({ color: v ?? "@moon" } as Partial<OgLayer>)}
						items={TOKENS}
					/>
					<div className="flex gap-3 text-xs">
						<label className="flex items-center gap-1">
							<input
								type="checkbox"
								checked={Boolean(layer.italic)}
								onChange={(e) => set({ italic: e.target.checked } as Partial<OgLayer>)}
							/>
							Italic
						</label>
						<label className="flex items-center gap-1">
							<input
								type="checkbox"
								checked={Boolean(layer.uppercase)}
								onChange={(e) => set({ uppercase: e.target.checked } as Partial<OgLayer>)}
							/>
							Uppercase
						</label>
					</div>
				</div>
			)}

			{layer.type === "shape" && (
				<Select
					size="sm"
					label="Fill"
					value={layer.fill.startsWith("@") ? layer.fill : "@amber"}
					onValueChange={(v) => set({ fill: v ?? "@amber" } as Partial<OgLayer>)}
					items={TOKENS}
				/>
			)}

			{layer.type === "image" && (
				<Select
					size="sm"
					label="Image"
					description="Or type {{hero.image}} to follow the hero."
					value={layer.src}
					onValueChange={(v) => set({ src: v ?? "" } as Partial<OgLayer>)}
					items={[
						{ label: "Follow hero image", value: "{{hero.image}}" },
						...media.slice(0, 40).map((m) => ({ label: m.filename, value: m.id })),
					]}
				/>
			)}
		</aside>
	);
}
