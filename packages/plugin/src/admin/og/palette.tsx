/**
 * ⌘K command palette for the card editor.
 *
 * Deliberately small and self-contained rather than wired to a component
 * library's palette: it needs only filter, arrow-key navigation and Enter, and
 * keeping it here means no API surface to track and no extra dependency.
 */
import * as React from "react";

import { T } from "./ui.js";

export interface Command {
	id: string;
	label: string;
	/** Shortcut shown on the right, e.g. "⌘D". */
	hint?: string;
	run: () => void;
}

export function CommandPalette({
	open,
	onClose,
	commands,
}: {
	open: boolean;
	onClose: () => void;
	commands: Command[];
}) {
	const [query, setQuery] = React.useState("");
	const [active, setActive] = React.useState(0);
	const inputRef = React.useRef<HTMLInputElement>(null);

	// Reset each time it opens so it never reopens mid-search.
	React.useEffect(() => {
		if (!open) return;
		setQuery("");
		setActive(0);
		const id = requestAnimationFrame(() => inputRef.current?.focus());
		return () => cancelAnimationFrame(id);
	}, [open]);

	const filtered = React.useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return commands;
		// Subsequence match, so "adtx" finds "Add text".
		return commands.filter((c) => {
			const label = c.label.toLowerCase();
			let i = 0;
			for (const ch of q) {
				i = label.indexOf(ch, i);
				if (i === -1) return false;
				i += 1;
			}
			return true;
		});
	}, [commands, query]);

	if (!open) return null;

	const choose = (index: number) => {
		const command = filtered[index];
		if (!command) return;
		onClose();
		command.run();
	};

	return (
		<div
			role="presentation"
			onPointerDown={onClose}
			style={{
				position: "fixed",
				inset: 0,
				background: "rgba(0,0,0,0.45)",
				display: "flex",
				alignItems: "flex-start",
				justifyContent: "center",
				paddingTop: "12vh",
				zIndex: 60,
			}}
		>
			<div
				role="dialog"
				aria-label="Commands"
				onPointerDown={(e) => e.stopPropagation()}
				style={{
					width: "100%",
					maxWidth: 440,
					overflow: "hidden",
					borderRadius: 10,
					border: `1px solid ${T.line}`,
					background: T.base,
					boxShadow: "0 20px 50px rgb(0 0 0 / 0.45)",
				}}
			>
				<input
					ref={inputRef}
					value={query}
					placeholder="Type a command..."
					onChange={(e) => {
						setQuery(e.target.value);
						setActive(0);
					}}
					onKeyDown={(e) => {
						if (e.key === "Escape") return onClose();
						if (e.key === "ArrowDown") {
							e.preventDefault();
							setActive((a) => Math.min(a + 1, filtered.length - 1));
						}
						if (e.key === "ArrowUp") {
							e.preventDefault();
							setActive((a) => Math.max(a - 1, 0));
						}
						if (e.key === "Enter") {
							e.preventDefault();
							choose(active);
						}
					}}
					style={{
						width: "100%",
						padding: "11px 15px",
						fontSize: 14,
						color: T.text,
						background: "transparent",
						border: "none",
						borderBottom: `1px solid ${T.line}`,
						outline: "none",
					}}
				/>
				<ul style={{ maxHeight: 300, overflowY: "auto", padding: "4px 0", margin: 0, listStyle: "none" }}>
					{filtered.length === 0 && (
						<li style={{ padding: "11px 15px", fontSize: 13, color: T.subtle }}>No matching command.</li>
					)}
					{filtered.map((c, i) => (
						<li key={c.id}>
							<button
								type="button"
								onMouseEnter={() => setActive(i)}
								onClick={() => choose(i)}
								style={{
									display: "flex",
									width: "100%",
									alignItems: "center",
									justifyContent: "space-between",
									gap: 10,
									padding: "7px 15px",
									border: "none",
									cursor: "pointer",
									textAlign: "left",
									fontSize: 13,
									color: T.text,
									background: i === active ? T.fill : "transparent",
								}}
							>
								<span>{c.label}</span>
									{c.hint && <span style={{ fontSize: 11, color: T.subtle }}>{c.hint}</span>}
							</button>
						</li>
					))}
				</ul>
			</div>
		</div>
	);
}
