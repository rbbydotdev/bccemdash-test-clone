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
 * A numeric field that also scrubs: dragging left/right changes the value, the
 * way every design tool's number inputs behave. Typing still works.
 */
export function NumberField({
	value,
	onChange,
	step = 1,
	width = 62,
	suffix,
}: {
	value: number;
	onChange: (n: number) => void;
	step?: number;
	width?: number;
	suffix?: string;
}) {
	const [draft, setDraft] = React.useState<string | null>(null);
	const scrub = React.useRef<{ x: number; start: number } | null>(null);

	React.useEffect(() => {
		if (!scrub.current) return;
		const move = (e: PointerEvent) => {
			const s = scrub.current;
			if (!s) return;
			onChange(round(s.start + (e.clientX - s.x) * step));
		};
		const up = () => {
			scrub.current = null;
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		return () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
	}, [onChange, step, draft]);

	const round = (n: number) => (step < 1 ? Math.round(n * 100) / 100 : Math.round(n));

	return (
		<div style={{ display: "flex", alignItems: "center", gap: 2 }}>
			<input
				type="text"
				inputMode="decimal"
				value={draft ?? String(value)}
				onChange={(e) => setDraft(e.target.value)}
				onBlur={() => {
					if (draft !== null) {
						const n = Number.parseFloat(draft);
						if (Number.isFinite(n)) onChange(round(n));
						setDraft(null);
					}
				}}
				onKeyDown={(e) => {
					if (e.key === "Enter") (e.target as HTMLInputElement).blur();
					if (e.key === "Escape") setDraft(null);
					// Arrow keys step, as they do in every inspector.
					if (e.key === "ArrowUp" || e.key === "ArrowDown") {
						e.preventDefault();
						const d = (e.key === "ArrowUp" ? 1 : -1) * (e.shiftKey ? 10 : 1) * step;
						onChange(round(value + d));
					}
				}}
				onPointerDown={(e) => {
					// Scrub only from a drag that starts outside the caret, so a plain
					// click still focuses the field for typing.
					if (e.detail > 1) return;
					scrub.current = { x: e.clientX, start: value };
					setDraft(null);
				}}
				style={{ ...controlStyle, width, textAlign: "right", cursor: "ew-resize" }}
			/>
			{suffix && <span style={{ fontSize: 10, color: T.subtle }}>{suffix}</span>}
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
