/**
 * Editor chrome primitives.
 *
 * These use inline styles rather than Tailwind classes, deliberately.
 *
 * The admin's stylesheet is compiled inside `vendor/emdash/packages/admin`,
 * where Tailwind scans only that package and Kumo's dist. This plugin's source
 * is never scanned, so a utility class here only works if emdash or Kumo
 * happens to use the same one. That failure is silent: `w-72` and
 * `text-[0.65rem]` produced no CSS at all, which is what collapsed the
 * inspector panel and let the canvas slide underneath it. Rather than restrict
 * ourselves to a guessed subset, the editor styles itself.
 *
 * Colours come from Kumo's CSS custom properties, which are defined on the
 * document and use `light-dark()`, so this still tracks the admin theme.
 */
import * as React from "react";

export const T = {
	base: "var(--color-kumo-base)",
	canvas: "var(--color-kumo-canvas)",
	elevated: "var(--color-kumo-elevated)",
	control: "var(--color-kumo-control)",
	line: "var(--color-kumo-line)",
	hairline: "var(--color-kumo-hairline)",
	fill: "var(--color-kumo-fill)",
	interact: "var(--color-kumo-interact)",
	brand: "var(--color-kumo-brand)",
	text: "var(--color-kumo-contrast)",
	subtle: "var(--text-color-kumo-subtle, var(--color-kumo-neutral-750))",
} as const;

/** A docked panel edge, e.g. the tool rail or the right-hand dock. */
export function Dock({
	side,
	width,
	children,
	style,
}: {
	side: "left" | "right";
	width: number;
	children: React.ReactNode;
	style?: React.CSSProperties;
}) {
	return (
		<div
			style={{
				width,
				flex: `0 0 ${width}px`,
				minWidth: 0,
				display: "flex",
				flexDirection: "column",
				background: T.base,
				[side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${T.line}`,
				overflow: "hidden",
				...style,
			}}
		>
			{children}
		</div>
	);
}

/** A titled group inside a panel. */
export function Section({ title, children }: { title?: string; children: React.ReactNode }) {
	return (
		<div style={{ padding: "10px 12px", borderBottom: `1px solid ${T.hairline}` }}>
			{title && (
				<div
					style={{
						fontSize: 10,
						letterSpacing: 0.6,
						textTransform: "uppercase",
						color: T.subtle,
						marginBottom: 8,
						fontWeight: 600,
					}}
				>
					{title}
				</div>
			)}
			<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>{children}</div>
		</div>
	);
}

/** Label on the left, control on the right — the standard inspector row. */
export function Row({ label, children }: { label: string; children: React.ReactNode }) {
	return (
		<label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
			<span style={{ fontSize: 11, color: T.subtle, flexShrink: 0 }}>{label}</span>
			<div style={{ display: "flex", alignItems: "center", gap: 4, minWidth: 0 }}>{children}</div>
		</label>
	);
}

export function Muted({ children }: { children: React.ReactNode }) {
	return <p style={{ fontSize: 11, lineHeight: 1.4, color: T.subtle, margin: 0 }}>{children}</p>;
}

const controlStyle: React.CSSProperties = {
	background: T.control,
	color: T.text,
	border: `1px solid ${T.line}`,
	borderRadius: 6,
	padding: "4px 6px",
	fontSize: 11,
	outline: "none",
	minWidth: 0,
};

/**
 * A vertical slider that floats beside its field.
 *
 * Perpendicular to the row and offset to the left, so it never covers the
 * number it is driving — you can watch the value change as you drag. Fixed
 * positioning is enough to escape the dock's `overflow: hidden`, since no
 * ancestor sets a transform, so this needs no portal.
 */
function SliderPopover({
	anchor,
	value,
	min,
	max,
	step,
	onChange,
	onClose,
}: {
	anchor: React.RefObject<HTMLDivElement | null>;
	value: number;
	min: number;
	max: number;
	step: number;
	onChange: (n: number) => void;
	onClose: () => void;
}) {
	const PANEL_W = 34;
	const PANEL_H = 132;
	const self = React.useRef<HTMLDivElement>(null);
	const [box, setBox] = React.useState<{ left: number; top: number } | null>(null);

	React.useLayoutEffect(() => {
		const place = () => {
			const rect = anchor.current?.getBoundingClientRect();
			if (!rect) return;
			setBox({
				// To the left of the field, clamped so it stays on screen.
				left: Math.max(8, rect.left - PANEL_W - 8),
				top: Math.min(
					window.innerHeight - PANEL_H - 8,
					Math.max(8, rect.top + rect.height / 2 - PANEL_H / 2),
				),
			});
		};
		place();
		window.addEventListener("resize", place);
		// The dock scrolls, so the field moves out from under a placed panel.
		window.addEventListener("scroll", place, true);
		return () => {
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", place, true);
		};
	}, [anchor]);

	React.useEffect(() => {
		const onDown = (e: PointerEvent) => {
			const target = e.target as Node;
			if (!self.current?.contains(target) && !anchor.current?.contains(target)) onClose();
		};
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("pointerdown", onDown);
		window.addEventListener("keydown", onKey);
		return () => {
			window.removeEventListener("pointerdown", onDown);
			window.removeEventListener("keydown", onKey);
		};
	}, [anchor, onClose]);

	if (!box) return null;

	return (
		<div
			ref={self}
			style={{
				position: "fixed",
				left: box.left,
				top: box.top,
				width: PANEL_W,
				height: PANEL_H,
				zIndex: 70,
				display: "grid",
				placeItems: "center",
				borderRadius: 8,
				background: T.elevated,
				border: `1px solid ${T.line}`,
				boxShadow: "0 10px 30px rgb(0 0 0 / 0.35)",
			}}
		>
			<input
				type="range"
				aria-label="Slider"
				autoFocus
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={(e) => onChange(Number.parseFloat(e.target.value))}
				style={{
					// `vertical-lr` + `rtl` is the standard way to stand a range up;
					// rtl puts the maximum at the top, so dragging up increases.
					writingMode: "vertical-lr",
					direction: "rtl",
					width: 18,
					height: PANEL_H - 20,
					accentColor: T.brand,
					cursor: "pointer",
				}}
			/>
		</div>
	);
}

/**
 * A numeric field. Type a value, step it with the arrow keys, or open a slider
 * beside it when the value has a natural range.
 *
 * The field used to change value when dragged sideways, the way some design
 * tools scrub. That went: besides being unexpected, the drag listeners were
 * attached from an effect that only re-ran on an unrelated state change, so
 * they could bind a frame late and then follow the pointer with no button held.
 * A slider you open deliberately shows its own limits and cannot surprise you.
 */
export function NumberField({
	value,
	onChange,
	step = 1,
	width = 62,
	suffix,
	min,
	max,
}: {
	value: number;
	onChange: (n: number) => void;
	step?: number;
	width?: number;
	suffix?: string;
	min?: number;
	max?: number;
}) {
	const [draft, setDraft] = React.useState<string | null>(null);
	const [sliderOpen, setSliderOpen] = React.useState(false);
	const anchor = React.useRef<HTMLDivElement>(null);
	const ranged = min !== undefined && max !== undefined;

	const clamp = (n: number) => {
		const rounded = step < 1 ? Math.round(n / step) * step : Math.round(n);
		const bounded = Math.min(max ?? Infinity, Math.max(min ?? -Infinity, rounded));
		// Binary floating point leaves 0.1 steps looking like 0.30000000000000004.
		return Math.round(bounded * 1000) / 1000;
	};

	return (
		<div ref={anchor} style={{ display: "flex", alignItems: "center", gap: 3 }}>
			{ranged && (
				<button
					type="button"
					aria-label="Open slider"
					aria-expanded={sliderOpen}
					title="Drag on a slider"
					onClick={() => setSliderOpen((open) => !open)}
					style={{
						width: 14,
						height: 20,
						padding: 0,
						flexShrink: 0,
						cursor: "pointer",
						borderRadius: 4,
						border: "none",
						background: sliderOpen ? T.fill : "transparent",
						color: sliderOpen ? T.brand : T.subtle,
						fontSize: 11,
						lineHeight: 1,
					}}
				>
					⇕
				</button>
			)}
			<input
				type="text"
				inputMode="decimal"
				value={draft ?? String(value)}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={(e) => {
					if (draft === null) return;
					const n = Number.parseFloat(e.target.value);
					if (Number.isFinite(n)) onChange(clamp(n));
					setDraft(null);
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter") return void (e.target as HTMLInputElement).blur();
					if (e.key === "Escape") return void setDraft(null);
					if (e.key === "ArrowUp" || e.key === "ArrowDown") {
						e.preventDefault();
						const direction = e.key === "ArrowUp" ? 1 : -1;
						onChange(clamp(value + direction * (e.shiftKey ? 10 : 1) * step));
						setDraft(null);
					}
				}}
				style={{ ...controlStyle, width, textAlign: "right" }}
			/>
			{suffix && <span style={{ fontSize: 10, color: T.subtle }}>{suffix}</span>}
			{sliderOpen && ranged && (
				<SliderPopover
					anchor={anchor}
					value={value}
					min={min}
					max={max}
					step={step}
					onChange={(n) => onChange(clamp(n))}
					onClose={() => setSliderOpen(false)}
				/>
			)}
		</div>
	);
}

/** A square colour swatch used in the palette row. */
export function Swatch({
	color,
	title,
	active,
	onClick,
}: {
	color: string;
	title: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			title={title}
			aria-label={title}
			aria-pressed={active}
			onClick={onClick}
			style={{
				width: 22,
				height: 22,
				borderRadius: 5,
				background: color,
				cursor: "pointer",
				border: active ? `2px solid ${T.brand}` : `1px solid ${T.line}`,
				boxShadow: active ? `0 0 0 1px ${T.brand}` : undefined,
				padding: 0,
			}}
		/>
	);
}

/** An icon button for the tool rail. */
export function ToolButton({
	label,
	shortcut,
	active,
	onClick,
	children,
}: {
	label: string;
	shortcut?: string;
	active?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	const [hover, setHover] = React.useState(false);
	return (
		<button
			type="button"
			title={shortcut ? `${label} (${shortcut})` : label}
			aria-label={label}
			onClick={onClick}
			onPointerEnter={() => setHover(true)}
			onPointerLeave={() => setHover(false)}
			style={{
				width: 34,
				height: 34,
				display: "grid",
				placeItems: "center",
				borderRadius: 7,
				border: "none",
				cursor: "pointer",
				color: active ? T.brand : T.text,
				background: active ? T.fill : hover ? T.interact : "transparent",
			}}
		>
			{children}
		</button>
	);
}

/** A plain text/select control styled to match the numeric fields. */
export const fieldStyle = controlStyle;
