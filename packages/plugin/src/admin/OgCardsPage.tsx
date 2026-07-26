/**
 * /social-cards — the visual editor for Open Graph share cards.
 *
 * A card is a scene document (see @myemdash/og/scene): absolutely-positioned
 * text/image/shape layers. The canvas renders it as DOM with the same style
 * helpers the Takumi renderer uses, so what is dragged here is what comes out
 * of the PNG. The authoritative render is one click away ("True preview"),
 * because DOM is fast but Takumi is the truth.
 *
 * Everything the client needs is on one screen: templates on the left, canvas
 * in the middle, properties on the right, and a ⌘K palette for actions.
 */
import { Button, Input, Loader } from "@cloudflare/kumo";
import * as React from "react";

import {
	DEFAULT_HEIGHT,
	DEFAULT_WIDTH,
	collectFontFamilies,
	type OgLayer,
	type OgScene,
	type SceneColors,
} from "@myemdash/og/scene";
import { builtInTemplates } from "@myemdash/og/templates";

import { Canvas } from "./og/canvas.js";
import { ensureWebFonts } from "./og/fonts.js";
import { CommandPalette, type Command } from "./og/palette.js";
import { Inspector } from "./og/inspector.js";
import {
	ErrorNotice,
	PageHeader,
	fetchMediaList,
	pluginGet,
	pluginSend,
	type MediaItem,
} from "./lib.js";
import type { BccSettings } from "../settings.js";

interface TemplateDTO {
	id: string;
	name: string;
	scene: OgScene;
	isActive: boolean;
	updatedAt: string;
}

/** Undo history depth — enough to feel safe, small enough to stay cheap. */
const HISTORY_LIMIT = 50;

export function OgCardsPage() {
	const [templates, setTemplates] = React.useState<TemplateDTO[]>([]);
	const [settings, setSettings] = React.useState<BccSettings | null>(null);
	const [media, setMedia] = React.useState<MediaItem[]>([]);
	const [currentId, setCurrentId] = React.useState<string | null>(null);
	const [name, setName] = React.useState("");
	const [scene, setScene] = React.useState<OgScene>({ layers: [] });
	const [selection, setSelection] = React.useState<string[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState<string | null>(null);
	const [paletteOpen, setPaletteOpen] = React.useState(false);
	const [truePreview, setTruePreview] = React.useState<string | null>(null);
	const [dirty, setDirty] = React.useState(false);

	// Undo/redo. Snapshots are whole scenes: they are small JSON documents, and
	// storing them wholesale avoids an error-prone patch/inverse-patch layer.
	const past = React.useRef<OgScene[]>([]);
	const future = React.useRef<OgScene[]>([]);

	const colors: SceneColors = React.useMemo(() => {
		const c = settings?.design.colors;
		return {
			night: c?.night ?? "#0A0E1A",
			deep: c?.deep ?? "#111833",
			amber: c?.amber ?? "#D4A03C",
			moon: c?.moon ?? "#C8D0E0",
			amberLight: c?.amberLight ?? "#E8C060",
			silver: c?.silver ?? "#8892A8",
		};
	}, [settings]);

	/** Bindings the templates can reference. */
	const context = React.useMemo(
		() => ({ hero: settings?.hero ?? {}, footer: settings?.footer ?? {}, contact: settings?.contact ?? {} }),
		[settings],
	);

	/** Built-in starting points, tinted with the site's current palette. */
	const starters = React.useMemo(() => builtInTemplates(colors.night), [colors.night]);

	const startFrom = React.useCallback(
		(templateId: string) => {
			const template = starters.find((s) => s.id === templateId);
			if (!template) return;
			past.current = [];
			future.current = [];
			setCurrentId(null);
			setName(template.name);
			// Deep-copy so editing a new card never mutates the shared built-in.
			setScene(JSON.parse(JSON.stringify(template.scene)) as OgScene);
			setSelection([]);
			setDirty(true);
			setTruePreview(null);
		},
		[starters],
	);

	// Make sure the browser has every face the scene names, so the canvas draws
	// what the renderer will. Loading a card built elsewhere is the case that
	// matters: its fonts were never picked in this session.
	React.useEffect(() => {
		ensureWebFonts(collectFontFamilies(scene));
	}, [scene]);

	const mediaUrls = React.useMemo(() => {
		const map: Record<string, string> = {};
		for (const m of media) map[m.id] = m.url;
		return map;
	}, [media]);

	React.useEffect(() => {
		let alive = true;
		void (async () => {
			try {
				const [list, s, m] = await Promise.all([
					pluginGet<{ items: TemplateDTO[] }>("admin/og/templates"),
					pluginGet<BccSettings>("admin/settings"),
					fetchMediaList(),
				]);
				if (!alive) return;
				setTemplates(list.items ?? []);
				setSettings(s);
				setMedia(m);
				const first = list.items?.find((t) => t.isActive) ?? list.items?.[0];
				if (first) {
					setCurrentId(first.id);
					setName(first.name);
					setScene(first.scene);
				}
			} catch (err) {
				if (alive) setError(err instanceof Error ? err.message : "Failed to load");
			} finally {
				if (alive) setLoading(false);
			}
		})();
		return () => {
			alive = false;
		};
	}, []);

	/** Commit a scene change, pushing the previous one onto the undo stack. */
	const commit = React.useCallback((next: OgScene) => {
		setScene((prev) => {
			past.current = [...past.current.slice(-HISTORY_LIMIT), prev];
			future.current = [];
			return next;
		});
		setDirty(true);
		setTruePreview(null);
	}, []);

	/** Replace the given layers by id (the canvas hands back edited copies). */
	const patchLayers = React.useCallback(
		(changed: OgLayer[]) => {
			const byId = new Map(changed.map((l) => [l.id, l]));
			commit({ ...scene, layers: scene.layers.map((l) => byId.get(l.id) ?? l) });
		},
		[commit, scene],
	);

	const undo = React.useCallback(() => {
		const prev = past.current.pop();
		if (!prev) return;
		setScene((cur) => {
			future.current = [...future.current, cur];
			return prev;
		});
		setDirty(true);
	}, []);

	const redo = React.useCallback(() => {
		const next = future.current.pop();
		if (!next) return;
		setScene((cur) => {
			past.current = [...past.current, cur];
			return next;
		});
		setDirty(true);
	}, []);

	const addLayer = React.useCallback(
		(layer: OgLayer) => {
			commit({ ...scene, layers: [...scene.layers, layer] });
			setSelection([layer.id]);
		},
		[commit, scene],
	);

	const removeSelected = React.useCallback(() => {
		if (selection.length === 0) return;
		commit({ ...scene, layers: scene.layers.filter((l) => !selection.includes(l.id)) });
		setSelection([]);
	}, [commit, scene, selection]);

	const duplicateSelected = React.useCallback(() => {
		const copies = scene.layers
			.filter((l) => selection.includes(l.id))
			.map((l) => ({ ...l, id: `${l.type}-${Date.now()}-${Math.round(Math.random() * 1e4)}`, x: l.x + 20, y: l.y + 20 }));
		if (copies.length === 0) return;
		commit({ ...scene, layers: [...scene.layers, ...copies] });
		setSelection(copies.map((c) => c.id));
	}, [commit, scene, selection]);

	/** Move selected layers in the paint order (z-order is array order). */
	const reorder = React.useCallback(
		(direction: "front" | "back") => {
			if (selection.length === 0) return;
			const picked = scene.layers.filter((l) => selection.includes(l.id));
			const rest = scene.layers.filter((l) => !selection.includes(l.id));
			commit({ ...scene, layers: direction === "front" ? [...rest, ...picked] : [...picked, ...rest] });
		},
		[commit, scene, selection],
	);

	const saveCard = React.useCallback(async (): Promise<string | null> => {
		setBusy(true);
		setError(null);
		try {
			const saved = await pluginSend<TemplateDTO>("admin/og/templates", "POST", {
				action: "save",
				id: currentId ?? undefined,
				name: name || "Untitled card",
				scene,
			});
			setCurrentId(saved.id);
			setDirty(false);
			const list = await pluginGet<{ items: TemplateDTO[] }>("admin/og/templates");
			setTemplates(list.items ?? []);
			return saved.id;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
			return null;
		} finally {
			setBusy(false);
		}
	}, [currentId, name, scene]);

	const save = saveCard;

	const makeActive = React.useCallback(async () => {
		if (!currentId) return;
		setBusy(true);
		try {
			await pluginSend("admin/og/templates", "POST", { action: "active", id: currentId });
			const list = await pluginGet<{ items: TemplateDTO[] }>("admin/og/templates");
			setTemplates(list.items ?? []);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to set active");
		} finally {
			setBusy(false);
		}
	}, [currentId]);

	const openTemplate = (t: TemplateDTO) => {
		past.current = [];
		future.current = [];
		setCurrentId(t.id);
		setName(t.name);
		setScene(t.scene);
		setSelection([]);
		setDirty(false);
		setTruePreview(null);
	};

	/**
	 * Render THIS card through Takumi and show the result. The canvas is a close
	 * DOM approximation; this is the actual PNG, so fonts and wrapping are exact.
	 * Saves first when needed, because the renderer reads the card from the
	 * server rather than from the browser.
	 */
	const showTruePreview = React.useCallback(async () => {
		let id = currentId;
		if (!id || dirty) {
			const saved = await saveCard();
			if (!saved) return;
			id = saved;
		}
		const base = (settings?.integrations.ogWorkerUrl ?? "").trim().replace(/\/$/, "");
		setTruePreview(`${base || "/og"}/site.png?template=${id}&t=${Date.now()}`);
	}, [currentId, dirty, saveCard, settings]);

	const commands: Command[] = React.useMemo(
		() => [
			{ id: "text", label: "Add text", hint: "T", run: () => addLayer(newText()) },
			{ id: "shape", label: "Add shape", hint: "R", run: () => addLayer(newShape()) },
			{ id: "image", label: "Add image", run: () => addLayer(newImage(media[0]?.id ?? "")) },
			{ id: "dup", label: "Duplicate selection", hint: "⌘D", run: duplicateSelected },
			{ id: "del", label: "Delete selection", hint: "⌫", run: removeSelected },
			{ id: "front", label: "Bring to front", run: () => reorder("front") },
			{ id: "back", label: "Send to back", run: () => reorder("back") },
			{ id: "undo", label: "Undo", hint: "⌘Z", run: undo },
			{ id: "redo", label: "Redo", hint: "⇧⌘Z", run: redo },
			{ id: "save", label: "Save card", hint: "⌘S", run: () => void save() },
			{ id: "true", label: "Preview PNG (render this card for real)", run: () => void showTruePreview() },
			...starters.map((s) => ({
				id: `tpl-${s.id}`,
				label: `Start from: ${s.name}`,
				run: () => startFrom(s.id),
			})),
			{ id: "active", label: "Use as the site card", run: () => void makeActive() },
		],
		[addLayer, colors, duplicateSelected, makeActive, media, redo, removeSelected, reorder, save, showTruePreview, startFrom, starters, undo],
	);

	// Keyboard shortcuts. Ignored while typing so text editing keeps its keys.
	React.useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const el = e.target as HTMLElement | null;
			if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
			const mod = e.metaKey || e.ctrlKey;
			if (mod && e.key.toLowerCase() === "k") return void (e.preventDefault(), setPaletteOpen(true));
			if (mod && e.key.toLowerCase() === "s") return void (e.preventDefault(), save());
			if (mod && e.key.toLowerCase() === "d") return void (e.preventDefault(), duplicateSelected());
			if (mod && e.key.toLowerCase() === "z") {
				e.preventDefault();
				return void (e.shiftKey ? redo() : undo());
			}
			if (e.key === "Delete" || e.key === "Backspace") return void removeSelected();
			if (e.key === "Escape") return void setSelection([]);
			// Arrow-key nudge, 10px with Shift.
			if (e.key.startsWith("Arrow") && selection.length > 0) {
				e.preventDefault();
				const step = e.shiftKey ? 10 : 1;
				const dx = e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
				const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
				patchLayers(
					scene.layers
						.filter((l) => selection.includes(l.id))
						.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy })),
				);
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [duplicateSelected, patchLayers, redo, removeSelected, save, scene, selection, undo]);

	if (loading) {
		return (
			<div className="flex justify-center py-16">
				<Loader />
			</div>
		);
	}

	const selectedLayer = scene.layers.find((l) => selection.length === 1 && l.id === selection[0]) ?? null;

	return (
		<div className="space-y-4">
			<PageHeader
				title="Social Cards"
				subtitle="The image shown when the site is shared. Drag to arrange, double-click text to edit, ⌘K for commands."
			/>

			{error && <ErrorNotice message={error} />}

			<div className="flex flex-wrap items-center gap-2">
				<Input
					className="w-56"
					size="sm"
					label=""
					placeholder="Card name"
					value={name}
					onChange={(e) => {
						setName(e.target.value);
						setDirty(true);
					}}
				/>
				<Button size="sm" disabled={busy || !dirty} onClick={() => void save()}>
					{dirty ? "Save" : "Saved"}
				</Button>
				<Button size="sm" variant="secondary" disabled={busy || !currentId} onClick={() => void makeActive()}>
					Use as site card
				</Button>
				<Button size="sm" variant="secondary" disabled={busy} onClick={() => void showTruePreview()}>
					Preview PNG
				</Button>
				<Button size="sm" variant="ghost" onClick={() => setPaletteOpen(true)}>
					Commands ⌘K
				</Button>
			</div>

			<div className="flex items-start gap-4">
				{/* Templates */}
				<div className="w-52 shrink-0 space-y-1">
					<p className="text-kumo-subtle text-xs font-medium uppercase">Cards</p>
					{templates.length === 0 && <p className="text-kumo-subtle text-xs">No saved cards yet.</p>}
					{templates.map((t) => (
						<button
							key={t.id}
							type="button"
							onClick={() => openTemplate(t)}
							className={`hover:bg-kumo-muted flex w-full items-center justify-between rounded p-2 text-left text-sm ${
								t.id === currentId ? "bg-kumo-muted" : ""
							}`}
						>
							<span className="truncate">{t.name}</span>
							{t.isActive && <span className="text-kumo-subtle text-[0.6rem] uppercase">live</span>}
						</button>
					))}
					<div className="pt-3">
						<p className="text-kumo-subtle text-xs font-medium uppercase">Start from</p>
						<p className="text-kumo-subtle mt-1 mb-1 text-[0.65rem] leading-snug">
							Templates follow your live content and brand colours.
						</p>
						{starters.map((s) => (
							<button
								key={s.id}
								type="button"
								title={s.description}
								onClick={() => startFrom(s.id)}
								className="hover:bg-kumo-muted block w-full truncate rounded p-1.5 text-left text-sm"
							>
								{s.name}
							</button>
						))}
						<button
							type="button"
							onClick={() => {
								past.current = [];
								future.current = [];
								setCurrentId(null);
								setName("New card");
								setScene({ width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT, background: "@night", layers: [] });
								setSelection([]);
								setDirty(true);
							}}
							className="hover:bg-kumo-muted text-kumo-subtle block w-full rounded p-1.5 text-left text-sm"
						>
							Blank card
						</button>
					</div>
				</div>

				{/* Canvas */}
				<div className="min-w-0 flex-1">
					{truePreview ? (
						<div className="space-y-2">
							<p className="text-kumo-subtle text-xs">
								The real PNG for this card, rendered by the image service. Saved automatically.
							</p>
							<img src={truePreview} alt="Rendered card" className="border-kumo-line w-full rounded-lg border" />
							<Button size="sm" variant="ghost" onClick={() => setTruePreview(null)}>
								Back to editing
							</Button>
						</div>
					) : (
						<Canvas
							scene={scene}
							context={context}
							colors={colors}
							mediaUrls={mediaUrls}
							selection={selection}
							onSelectionChange={setSelection}
							onChange={patchLayers}
							scale={0.62}
						/>
					)}
				</div>

				{/* Inspector */}
				<Inspector
					layer={selectedLayer}
					media={media}
					colors={colors}
					onChange={(l) => patchLayers([l])}
					onDelete={removeSelected}
				/>
			</div>

			<CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
		</div>
	);
}

// ── layer factories ─────────────────────────────────────────────────

const uid = (p: string) => `${p}-${Date.now()}-${Math.round(Math.random() * 1e4)}`;

function newText(): OgLayer {
	return {
		id: uid("text"),
		name: "Text",
		type: "text",
		text: "New text",
		font: "display",
		size: 64,
		color: "@moon",
		align: "center",
		x: 300,
		y: 260,
		w: 600,
		h: 90,
	};
}

function newShape(): OgLayer {
	return { id: uid("shape"), name: "Shape", type: "shape", fill: "@amber", x: 480, y: 290, w: 240, h: 60 };
}

function newImage(mediaId: string): OgLayer {
	return { id: uid("image"), name: "Image", type: "image", src: mediaId, fit: "cover", x: 380, y: 165, w: 440, h: 300 };
}
