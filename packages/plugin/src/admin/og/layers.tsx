/**
 * The layers panel — the right-hand dock's Layers tab.
 *
 * Ordered the way every design tool orders a layer list: topmost first. The
 * scene stores layers back-to-front (later entries paint over earlier ones), so
 * the list is reversed for display and indices are mapped back on reorder.
 *
 * Styling is inline rather than Tailwind — see the note in ui.tsx.
 */
import { EyeIcon, EyeSlashIcon, LockSimpleIcon, LockSimpleOpenIcon } from "@phosphor-icons/react";
import * as React from "react";

import type { OgLayer, OgScene } from "@myemdash/og/scene";

import { Muted, T } from "./ui.js";

const TYPE_LABEL: Record<OgLayer["type"], string> = { text: "Text", image: "Image", shape: "Shape" };

/** What a layer is called in the list, falling back to its content. */
function displayName(layer: OgLayer): string {
	if (layer.name) return layer.name;
	if (layer.type === "text") return layer.text.slice(0, 28) || "Text";
	return TYPE_LABEL[layer.type];
}

export function LayersPanel({
	scene,
	selection,
	onSelectionChange,
	onChange,
	onReorder,
}: {
	scene: OgScene;
	selection: string[];
	onSelectionChange: (ids: string[]) => void;
	onChange: (layers: OgLayer[]) => void;
	/** Move a layer from one scene index to another. */
	onReorder: (from: number, to: number) => void;
}) {
	const [dragId, setDragId] = React.useState<string | null>(null);

	if (scene.layers.length === 0) {
		return (
			<div style={{ padding: 16 }}>
				<Muted>No layers yet. Add one from the tool rail on the left, or start from a template.</Muted>
			</div>
		);
	}

	// Topmost first, keeping each layer's true index for reordering.
	const rows = scene.layers.map((layer, index) => ({ layer, index })).reverse();

	return (
		<div style={{ overflowY: "auto", padding: 6, minWidth: 0 }}>
			{rows.map(({ layer, index }) => {
				const selected = selection.includes(layer.id);
				return (
					<div
						key={layer.id}
						draggable
						onDragStart={() => setDragId(layer.id)}
						onDragOver={(e) => e.preventDefault()}
						onDrop={() => {
							const from = scene.layers.findIndex((l) => l.id === dragId);
							if (from >= 0 && from !== index) onReorder(from, index);
							setDragId(null);
						}}
						onClick={(e) =>
							onSelectionChange(
								e.shiftKey
									? selected
										? selection.filter((id) => id !== layer.id)
										: [...selection, layer.id]
									: [layer.id],
							)
						}
						style={{
							display: "flex",
							alignItems: "center",
							gap: 6,
							padding: "5px 7px",
							borderRadius: 6,
							cursor: "pointer",
							opacity: layer.hidden ? 0.45 : 1,
							background: selected ? T.fill : "transparent",
						}}
					>
						<span style={{ fontSize: 9, color: T.subtle, width: 34, flexShrink: 0 }}>
							{TYPE_LABEL[layer.type]}
						</span>
						<span
							style={{
								flex: 1,
								minWidth: 0,
								fontSize: 12,
								color: T.text,
								overflow: "hidden",
								textOverflow: "ellipsis",
								whiteSpace: "nowrap",
							}}
						>
							{displayName(layer)}
						</span>
						<IconToggle
							label={layer.hidden ? "Show layer" : "Hide layer"}
							on={!layer.hidden}
							onClick={() => onChange([{ ...layer, hidden: !layer.hidden }])}
						>
							{layer.hidden ? <EyeSlashIcon size={13} /> : <EyeIcon size={13} />}
						</IconToggle>
						<IconToggle
							label={layer.locked ? "Unlock layer" : "Lock layer"}
							on={!layer.locked}
							onClick={() => onChange([{ ...layer, locked: !layer.locked }])}
						>
							{layer.locked ? <LockSimpleIcon size={13} /> : <LockSimpleOpenIcon size={13} />}
						</IconToggle>
					</div>
				);
			})}
		</div>
	);
}

function IconToggle({
	label,
	on,
	onClick,
	children,
}: {
	label: string;
	on: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			onClick={(e) => {
				e.stopPropagation();
				onClick();
			}}
			style={{
				display: "grid",
				placeItems: "center",
				width: 20,
				height: 20,
				flexShrink: 0,
				border: "none",
				borderRadius: 4,
				cursor: "pointer",
				background: "transparent",
				color: on ? T.subtle : T.brand,
			}}
		>
			{children}
		</button>
	);
}
