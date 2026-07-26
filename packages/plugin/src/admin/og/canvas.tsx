/**
 * The editing canvas — renders a scene as DOM and handles direct manipulation.
 *
 * The layers here are styled with the SAME helpers the Takumi renderer uses
 * (`layerFrameStyle`, `textStyle` from @myemdash/og/scene, a dependency-free
 * module), so dragging something here moves it identically in the PNG.
 *
 * Interaction is hand-rolled on pointer events rather than pulled from a
 * library: it is a few hundred lines, adds no dependency, and keeps the DOM
 * exactly the shape the renderer expects. Everything works in scene
 * coordinates (a 1200x630 frame) and is converted to screen pixels through one
 * `scale` factor, so the maths stays in one place.
 */
import * as React from "react";

import {
	layerFrameStyle,
	layerText,
	resolveColor,
	textStyle,
	type OgLayer,
	type OgScene,
	type SceneColors,
	type SceneContext,
} from "@myemdash/og/scene";

/** Snap threshold in scene px — matches the feel of design tools. */
const SNAP = 8;

export interface Guide {
	axis: "x" | "y";
	at: number;
}

type DragMode =
	| { kind: "move"; startX: number; startY: number; origin: OgLayer[] }
	| { kind: "resize"; handle: Handle; startX: number; startY: number; origin: OgLayer }
	| { kind: "rotate"; startAngle: number; origin: OgLayer }
	| null;

type Handle = "nw" | "ne" | "sw" | "se" | "n" | "s" | "e" | "w";

export interface CanvasProps {
	scene: OgScene;
	context: SceneContext;
	colors: SceneColors;
	/** media id -> url, for previewing image layers. */
	mediaUrls: Record<string, string>;
	selection: string[];
	onSelectionChange: (ids: string[]) => void;
	onChange: (layers: OgLayer[]) => void;
	/** Screen px per scene px. */
	scale: number;
}

export function Canvas({
	scene,
	context,
	colors,
	mediaUrls,
	selection,
	onSelectionChange,
	onChange,
	scale,
}: CanvasProps) {
	const width = scene.width ?? 1200;
	const height = scene.height ?? 630;
	const ref = React.useRef<HTMLDivElement>(null);
	const [drag, setDrag] = React.useState<DragMode>(null);
	const [guides, setGuides] = React.useState<Guide[]>([]);
	const [editing, setEditing] = React.useState<string | null>(null);

	const selected = scene.layers.filter((l) => selection.includes(l.id));

	/** Pointer position in scene coordinates. */
	const toScene = React.useCallback(
		(e: PointerEvent | React.PointerEvent) => {
			const rect = ref.current?.getBoundingClientRect();
			if (!rect) return { x: 0, y: 0 };
			return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
		},
		[scale],
	);

	// Drag lifecycle lives on window so a fast pointer that leaves the canvas
	// keeps dragging, and release is never missed.
	React.useEffect(() => {
		if (!drag) return;

		const move = (e: PointerEvent) => {
			const p = toScene(e);

			if (drag.kind === "move") {
				const dx = p.x - drag.startX;
				const dy = p.y - drag.startY;
				const moved = drag.origin.map((o) => ({ ...o, x: Math.round(o.x + dx), y: Math.round(o.y + dy) }));
				const { layers, hits } = applySnapping(moved, scene, width, height);
				setGuides(hits);
				onChange(layers);
				return;
			}

			if (drag.kind === "resize") {
				onChange([resizeLayer(drag.origin, drag.handle, p)]);
				return;
			}

			// rotate — angle from the layer's centre, 15° steps with Shift.
			const o = drag.origin;
			const cx = o.x + o.w / 2;
			const cy = o.y + o.h / 2;
			const angle = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI - drag.startAngle;
			const snapped = e.shiftKey ? Math.round(angle / 15) * 15 : Math.round(angle);
			onChange([{ ...o, rotation: snapped }]);
		};

		const up = () => {
			setDrag(null);
			setGuides([]);
		};

		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		return () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
	}, [drag, onChange, scene, toScene, width, height]);

	const startMove = (e: React.PointerEvent, layer: OgLayer) => {
		if (layer.locked || editing) return;
		e.stopPropagation();
		const additive = e.shiftKey || e.metaKey;
		const ids = additive
			? selection.includes(layer.id)
				? selection.filter((id) => id !== layer.id)
				: [...selection, layer.id]
			: selection.includes(layer.id)
				? selection
				: [layer.id];
		onSelectionChange(ids);
		const p = toScene(e);
		setDrag({
			kind: "move",
			startX: p.x,
			startY: p.y,
			origin: scene.layers.filter((l) => ids.includes(l.id)),
		});
	};

	return (
		<div
			ref={ref}
			onPointerDown={() => !editing && onSelectionChange([])}
			style={{
				position: "relative",
				width: width * scale,
				height: height * scale,
				overflow: "hidden",
				background: resolveColor(scene.background, colors) ?? colors.night,
				backgroundImage: scene.background?.includes("gradient(") ? scene.background : undefined,
			}}
			className="border-kumo-line rounded-lg border shadow-lg"
		>
			{/* Scene-space wrapper: one transform converts the whole document to
			    screen pixels, so every layer keeps its true coordinates. */}
			<div style={{ position: "absolute", inset: 0, width, height, transformOrigin: "top left", transform: `scale(${scale})` }}>
				{scene.layers.map((layer) => (
					<LayerView
						key={layer.id}
						layer={layer}
						context={context}
						colors={colors}
						mediaUrls={mediaUrls}
						selected={selection.includes(layer.id)}
						editing={editing === layer.id}
						onPointerDown={(e) => startMove(e, layer)}
						onDoubleClick={() => layer.type === "text" && !layer.locked && setEditing(layer.id)}
						onTextCommit={(value) => {
							setEditing(null);
							if (layer.type === "text") onChange([{ ...layer, text: value }]);
						}}
					/>
				))}

				{guides.map((g, i) => (
					<div
						key={i}
						style={{
							position: "absolute",
							background: "#22d3ee",
							...(g.axis === "x"
								? { left: g.at, top: 0, width: 1, height }
								: { top: g.at, left: 0, height: 1, width }),
						}}
					/>
				))}

				{selected.length === 1 && selected[0] && !editing && (
					<SelectionFrame
						layer={selected[0]}
						scale={scale}
						onResizeStart={(handle, e) => {
							e.stopPropagation();
							const p = toScene(e);
							setDrag({ kind: "resize", handle, startX: p.x, startY: p.y, origin: selected[0]! });
						}}
						onRotateStart={(e) => {
							e.stopPropagation();
							const o = selected[0]!;
							const p = toScene(e);
							const cx = o.x + o.w / 2;
							const cy = o.y + o.h / 2;
							const start = (Math.atan2(p.y - cy, p.x - cx) * 180) / Math.PI - (o.rotation ?? 0);
							setDrag({ kind: "rotate", startAngle: start, origin: o });
						}}
					/>
				)}
			</div>
		</div>
	);
}

/** One layer, rendered with the same style helpers the PNG renderer uses. */
function LayerView({
	layer,
	context,
	colors,
	mediaUrls,
	selected,
	editing,
	onPointerDown,
	onDoubleClick,
	onTextCommit,
}: {
	layer: OgLayer;
	context: SceneContext;
	colors: SceneColors;
	mediaUrls: Record<string, string>;
	selected: boolean;
	editing: boolean;
	onPointerDown: (e: React.PointerEvent) => void;
	onDoubleClick: () => void;
	onTextCommit: (value: string) => void;
}) {
	if (layer.hidden) return null;
	const frame = layerFrameStyle(layer) as React.CSSProperties;
	const outline = selected ? { outline: "1px solid #22d3ee", outlineOffset: 0 } : undefined;

	if (layer.type === "text") {
		const ts = textStyle(layer, colors) as React.CSSProperties;
		const value = layerText(layer, context);
		return (
			<div
				onPointerDown={onPointerDown}
				onDoubleClick={onDoubleClick}
				style={{
					...frame,
					...outline,
					display: "flex",
					alignItems: "center",
					justifyContent:
						layer.align === "left" ? "flex-start" : layer.align === "right" ? "flex-end" : "center",
					cursor: layer.locked ? "default" : "move",
				}}
			>
				{editing ? (
					<input
						autoFocus
						defaultValue={layer.text}
						onBlur={(e) => onTextCommit(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") (e.target as HTMLInputElement).blur();
							if (e.key === "Escape") onTextCommit(layer.text);
						}}
						style={{ ...ts, width: "100%", background: "rgba(0,0,0,0.4)", border: "1px solid #22d3ee" }}
					/>
				) : (
					<span style={{ ...ts, width: "100%" }}>{value}</span>
				)}
			</div>
		);
	}

	if (layer.type === "image") {
		const id = layer.src.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, p: string) => String(readPath(context, p) ?? ""));
		const url = mediaUrls[id.trim()];
		return (
			<div
				onPointerDown={onPointerDown}
				style={{
					...frame,
					...outline,
					backgroundImage: url ? `url(${url})` : undefined,
					backgroundSize: layer.fit === "contain" ? "contain" : "cover",
					backgroundPosition: "center",
					backgroundColor: url ? undefined : "rgba(255,255,255,0.06)",
					cursor: layer.locked ? "default" : "move",
				}}
			/>
		);
	}

	const fill = layer.fill.includes("gradient(")
		? { backgroundImage: layer.fill }
		: { backgroundColor: resolveColor(layer.fill, colors) ?? layer.fill };
	return (
		<div
			onPointerDown={onPointerDown}
			style={{ ...frame, ...outline, ...fill, cursor: layer.locked ? "default" : "move" }}
		/>
	);
}

const HANDLES: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];

function SelectionFrame({
	layer,
	scale,
	onResizeStart,
	onRotateStart,
}: {
	layer: OgLayer;
	scale: number;
	onResizeStart: (handle: Handle, e: React.PointerEvent) => void;
	onRotateStart: (e: React.PointerEvent) => void;
}) {
	// Handles are drawn in scene space but must look constant on screen, so their
	// size is divided back out by the zoom factor.
	const s = 9 / scale;
	const pos = (h: Handle) => ({
		left: h.includes("w") ? -s / 2 : h.includes("e") ? layer.w - s / 2 : layer.w / 2 - s / 2,
		top: h.includes("n") ? -s / 2 : h.includes("s") ? layer.h - s / 2 : layer.h / 2 - s / 2,
	});

	return (
		<div
			style={{
				position: "absolute",
				left: layer.x,
				top: layer.y,
				width: layer.w,
				height: layer.h,
				transform: layer.rotation ? `rotate(${layer.rotation}deg)` : undefined,
				outline: `${1 / scale}px solid #22d3ee`,
				pointerEvents: "none",
			}}
		>
			{HANDLES.map((h) => (
				<div
					key={h}
					onPointerDown={(e) => onResizeStart(h, e)}
					style={{
						position: "absolute",
						...pos(h),
						width: s,
						height: s,
						background: "#fff",
						border: `${1 / scale}px solid #22d3ee`,
						borderRadius: s / 4,
						pointerEvents: "auto",
						cursor: `${h}-resize`,
					}}
				/>
			))}
			<div
				onPointerDown={onRotateStart}
				title="Rotate (hold Shift for 15° steps)"
				style={{
					position: "absolute",
					left: layer.w / 2 - s / 2,
					top: -28 / scale,
					width: s,
					height: s,
					background: "#22d3ee",
					borderRadius: "50%",
					pointerEvents: "auto",
					cursor: "grab",
				}}
			/>
		</div>
	);
}

// ── geometry ────────────────────────────────────────────────────────

function resizeLayer(origin: OgLayer, handle: Handle, p: { x: number; y: number }): OgLayer {
	let { x, y, w, h } = origin;
	const right = origin.x + origin.w;
	const bottom = origin.y + origin.h;

	if (handle.includes("w")) {
		x = Math.min(Math.round(p.x), right - 8);
		w = right - x;
	}
	if (handle.includes("e")) w = Math.max(8, Math.round(p.x) - origin.x);
	if (handle.includes("n")) {
		y = Math.min(Math.round(p.y), bottom - 8);
		h = bottom - y;
	}
	if (handle.includes("s")) h = Math.max(8, Math.round(p.y) - origin.y);

	return { ...origin, x, y, w, h };
}

/**
 * Nudge a dragged selection onto nearby edges/centres. Only the frame centre and
 * the other layers' edges are considered — enough to feel helpful without the
 * jitter of snapping to everything.
 */
function applySnapping(
	moved: OgLayer[],
	scene: OgScene,
	width: number,
	height: number,
): { layers: OgLayer[]; hits: Guide[] } {
	if (moved.length !== 1 || !moved[0]) return { layers: moved, hits: [] };
	const layer = moved[0];
	const movedIds = new Set(moved.map((m) => m.id));

	const xs = [0, width / 2, width];
	const ys = [0, height / 2, height];
	for (const other of scene.layers) {
		if (movedIds.has(other.id) || other.hidden) continue;
		xs.push(other.x, other.x + other.w / 2, other.x + other.w);
		ys.push(other.y, other.y + other.h / 2, other.y + other.h);
	}

	const hits: Guide[] = [];
	let { x, y } = layer;

	for (const [edge, target] of [
		[x, "start"],
		[x + layer.w / 2, "mid"],
		[x + layer.w, "end"],
	] as const) {
		const near = xs.find((c) => Math.abs(c - edge) <= SNAP);
		if (near === undefined) continue;
		x += near - edge;
		hits.push({ axis: "x", at: near });
		break;
	}
	for (const [edge] of [[y], [y + layer.h / 2], [y + layer.h]] as const) {
		const near = ys.find((c) => Math.abs(c - edge) <= SNAP);
		if (near === undefined) continue;
		y += near - edge;
		hits.push({ axis: "y", at: near });
		break;
	}

	return { layers: [{ ...layer, x: Math.round(x), y: Math.round(y) }], hits };
}

function readPath(context: SceneContext, path: string): unknown {
	return path
		.split(".")
		.reduce<unknown>((acc, k) => (acc == null ? undefined : (acc as Record<string, unknown>)[k]), context);
}
