/**
 * /settings — "Site Content": the one surface where the non-technical client
 * edits all site chrome, section copy, imagery, design tokens, and
 * integrations (the emdash equivalent of the WordPress Site Content page).
 *
 * On mount it GETs the merged `bcc_site` bag (defaults under stored overrides),
 * edits it in local state grouped into Kumo tabs, and POSTs the FULL object
 * back on Save. The server deep-merges partials, so sending the whole bag is
 * safe. Imagery fields hold emdash media ids with a live thumbnail preview.
 *
 * CLIENT RULE: no em dashes in any user-facing label or help text.
 */
import { Button, Input, Loader, Select, Switch, Tabs, Textarea, type TabsItem } from "@cloudflare/kumo";
import { FloppyDisk, Plus, Trash } from "@phosphor-icons/react";
import * as React from "react";

import type { BccSettings, CycleNode, Recipient, StatItem } from "../settings.js";
import {
	ErrorNotice,
	PageHeader,
	fetchMediaList,
	uploadMedia,
	pluginGet,
	pluginSend,
	type MediaItem,
} from "./lib.js";

// Font choices mirror the WP Customizer select lists exactly.
const DISPLAY_FONTS = [
	"Cormorant Garamond",
	"Playfair Display",
	"DM Serif Display",
	"Fraunces",
	"Libre Baskerville",
];
const BODY_FONTS = ["EB Garamond", "Lora", "Libre Baskerville", "Source Serif 4"];
const ACCENT_FONTS = ["Josefin Sans", "Montserrat", "DM Sans", "Work Sans"];

const fontItems = (fonts: string[]) => fonts.map((f) => ({ label: f, value: f }));

const TABS: TabsItem[] = [
	{ value: "integrations", label: "Integrations" },
	{ value: "header", label: "Header" },
	{ value: "hero", label: "Hero" },
	{ value: "story", label: "Story" },
	{ value: "mission", label: "Mission" },
	{ value: "devotions", label: "Devotions" },
	{ value: "experiences", label: "Experiences" },
	{ value: "founder", label: "Founder" },
	{ value: "trust", label: "Trust" },
	{ value: "closing", label: "Closing" },
	{ value: "contact", label: "Contact" },
	{ value: "footer", label: "Footer" },
	{ value: "social", label: "Social" },
	{ value: "pages", label: "Other Pages" },
	{ value: "design", label: "Design" },
];

// ── Reusable field pieces ───────────────────────────────────────────

function SectionCard({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="border-kumo-line bg-kumo-base space-y-4 rounded-lg border p-6">
			<div>
				<h2 className="text-lg font-semibold">{title}</h2>
				{description && <p className="text-kumo-subtle mt-1 text-sm">{description}</p>}
			</div>
			{children}
		</div>
	);
}

/**
 * Live preview of the generated social card (the image shown when the site is
 * shared on Twitter/Facebook/iMessage/Slack). It restates the hero, so it lives
 * on this tab — edit the hero, save, then Refresh to see the new card.
 *
 * The card is rendered by a separate Worker. `ogWorkerUrl` points at it; blank
 * means same-origin /og, which only exists when something proxies it locally.
 */
function SocialCardPreview({ ogWorkerUrl }: { ogWorkerUrl: string | undefined }) {
	// Bust the browser cache on demand — the card itself is served `immutable`.
	const [nonce, setNonce] = React.useState(() => Date.now());
	const [failed, setFailed] = React.useState(false);

	const base = (ogWorkerUrl ?? "").trim().replace(/\/$/, "");
	const src = `${base || "/og"}/site.png?preview=${nonce}`;

	const refresh = () => {
		setFailed(false);
		setNonce(Date.now());
	};

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between gap-3">
				<span className="text-sm font-medium">Social card preview</span>
				<Button size="sm" variant="secondary" onClick={refresh}>
					Refresh
				</Button>
			</div>
			<p className="text-kumo-subtle text-xs">
				What people see when the site is shared. Save your hero edits, then Refresh.
			</p>

			{failed ? (
				<div className="border-kumo-line text-kumo-subtle rounded-lg border border-dashed p-6 text-center text-sm">
					<p>Could not load the card from {base || "/og"}.</p>
					<p className="mt-1 text-xs">
						The card is rendered by a separate service. Set its address under Integrations
						("OG worker URL"), and in local development start it with{" "}
						<code>pnpm --filter @myemdash/og-worker dev</code>.
					</p>
				</div>
			) : (
				<img
					src={src}
					alt="Preview of the social sharing card"
					width={1200}
					height={630}
					onError={() => setFailed(true)}
					className="border-kumo-line w-full rounded-lg border"
				/>
			)}

			<p className="text-kumo-subtle truncate text-xs">
				<a href={src} target="_blank" rel="noreferrer" className="underline">
					Open full size
				</a>
			</p>
		</div>
	);
}

/** Two-column responsive grid for short inputs. */
function FieldGrid({ children }: { children: React.ReactNode }) {
	return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** Imagery field: a media id text input plus a live thumbnail preview. */
/** Searchable media picker: browse/search the library, click to select. */
function MediaField({
	label,
	value,
	onChange,
}: {
	label: string;
	/** Tolerates undefined: a settings bag written before this field existed. */
	value: string | undefined;
	onChange: (v: string) => void;
}) {
	const current = value ?? "";
	const [items, setItems] = React.useState<MediaItem[]>([]);
	const [loading, setLoading] = React.useState(true);
	const [query, setQuery] = React.useState("");
	const [open, setOpen] = React.useState(false);
	const [uploading, setUploading] = React.useState(false);
	const [uploadError, setUploadError] = React.useState<string | null>(null);
	const boxRef = React.useRef<HTMLDivElement>(null);
	const fileRef = React.useRef<HTMLInputElement>(null);

	/** Upload a new file, then select it immediately. */
	const doUpload = async (file: File) => {
		setUploading(true);
		setUploadError(null);
		try {
			const id = await uploadMedia(file);
			const fresh = await fetchMediaList(true);
			setItems(fresh);
			onChange(id);
			setOpen(false);
		} catch (err) {
			setUploadError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setUploading(false);
		}
	};

	React.useEffect(() => {
		let alive = true;
		fetchMediaList()
			.then((m) => alive && (setItems(m), setLoading(false)))
			.catch(() => alive && setLoading(false));
		return () => {
			alive = false;
		};
	}, []);

	React.useEffect(() => {
		const onDoc = (e: MouseEvent) => {
			if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		return () => document.removeEventListener("mousedown", onDoc);
	}, []);

	const selected = items.find((i) => i.id === current.trim()) ?? null;
	const q = query.trim().toLowerCase();
	const filtered = (
		q ? items.filter((i) => `${i.filename} ${i.alt ?? ""}`.toLowerCase().includes(q)) : items
	).slice(0, 24);

	const pick = (it: MediaItem) => {
		onChange(it.id);
		setOpen(false);
		setQuery("");
	};

	return (
		<div className="space-y-1.5" ref={boxRef}>
			<span className="text-sm font-medium">{label}</span>
			<div className="relative">
				<div className="border-kumo-line flex items-center gap-3 rounded-lg border p-2">
					{selected ? (
						<img src={selected.url} alt="" className="h-12 w-12 shrink-0 rounded object-cover" />
					) : (
						<div className="bg-kumo-muted text-kumo-subtle flex h-12 w-12 shrink-0 items-center justify-center rounded text-[0.65rem]">
							none
						</div>
					)}
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm">{selected ? selected.filename : "No image selected"}</p>
						<p className="text-kumo-subtle truncate text-xs">
							{selected ? (selected.alt ?? "") : "Search the media library"}
						</p>
					</div>
					<Button size="sm" variant="secondary" disabled={uploading} onClick={() => setOpen((o) => !o)}>
						{selected ? "Change" : "Choose"}
					</Button>
					<Button
						size="sm"
						variant="secondary"
						disabled={uploading}
						onClick={() => fileRef.current?.click()}
					>
						{uploading ? "Uploading..." : "Upload"}
					</Button>
					{selected && (
						<Button size="sm" variant="ghost" disabled={uploading} onClick={() => onChange("")}>
							Clear
						</Button>
					)}
					{/* Hidden native picker — the Upload button proxies to it. */}
					<input
						ref={fileRef}
						type="file"
						accept="image/*,.ico,.svg"
						className="hidden"
						onChange={(e) => {
							const file = e.target.files?.[0];
							e.target.value = ""; // allow re-picking the same file
							if (file) void doUpload(file);
						}}
					/>
				</div>

				{uploadError && <p className="text-xs text-red-500">{uploadError}</p>}

				{open && (
					<div className="border-kumo-line bg-kumo-base absolute z-20 mt-1 w-full rounded-lg border p-2 shadow-lg">
						<Input
							autoFocus
							size="sm"
							placeholder="Search images by name..."
							value={query}
							onChange={(e) => setQuery(e.target.value)}
						/>
						{loading ? (
							<div className="flex justify-center py-6">
								<Loader />
							</div>
						) : (
							<ul className="mt-2 max-h-64 space-y-1 overflow-y-auto">
								{filtered.length === 0 && (
									<li className="text-kumo-subtle px-2 py-3 text-sm">No matching images.</li>
								)}
								{filtered.map((it) => (
									<li key={it.id}>
										<button
											type="button"
											onClick={() => pick(it)}
											className="hover:bg-kumo-muted flex w-full items-center gap-3 rounded p-1.5 text-left"
										>
											<img src={it.url} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm">{it.filename}</span>
												{it.alt && <span className="text-kumo-subtle block truncate text-xs">{it.alt}</span>}
											</span>
										</button>
									</li>
								))}
							</ul>
						)}
					</div>
				)}
			</div>
		</div>
	);
}

/** Color token: a swatch picker kept in sync with a hex text input. */
function ColorField({
	label,
	value,
	onChange,
}: {
	label: string;
	/** Tolerates undefined: a settings bag written before this field existed. */
	value: string | undefined;
	onChange: (v: string) => void;
}) {
	const current = value ?? "";
	return (
		<div className="flex items-end gap-2">
			<Input
				type="color"
				aria-label={`${label} swatch`}
				className="h-9 w-12 shrink-0 p-1"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
			<Input
				className="w-full"
				label={label}
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
		</div>
	);
}

/** Repeatable list of multi-line strings (paragraphs, bio). */
function StringListEditor({
	label,
	description,
	values,
	onChange,
	addLabel,
}: {
	label: string;
	description?: string;
	values: string[];
	onChange: (next: string[]) => void;
	addLabel: string;
}) {
	return (
		<div className="space-y-2">
			<div className="text-sm font-medium">{label}</div>
			{description && <p className="text-kumo-subtle text-xs">{description}</p>}
			{values.map((v, i) => (
				<div key={i} className="flex items-start gap-2">
					<Textarea
						className="w-full"
						rows={3}
						value={v}
						onChange={(e) => onChange(values.map((x, idx) => (idx === i ? e.target.value : x)))}
					/>
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						aria-label="Remove"
						onClick={() => onChange(values.filter((_, idx) => idx !== i))}
					>
						<Trash className="h-4 w-4" />
					</Button>
				</div>
			))}
			<Button variant="secondary" size="sm" onClick={() => onChange([...values, ""])}>
				<Plus className="mr-1 h-4 w-4" /> {addLabel}
			</Button>
		</div>
	);
}

/** Repeatable rows of paired value/label inputs (story stats). */
function StatListEditor({
	values,
	onChange,
}: {
	values: StatItem[];
	onChange: (next: StatItem[]) => void;
}) {
	const patch = (i: number, part: Partial<StatItem>) =>
		onChange(values.map((s, idx) => (idx === i ? { ...s, ...part } : s)));
	return (
		<div className="space-y-2">
			<div className="text-sm font-medium">Stats</div>
			{values.map((s, i) => (
				<div key={i} className="flex items-end gap-2">
					<Input
						className="w-full"
						label="Value"
						value={s.value}
						onChange={(e) => patch(i, { value: e.target.value })}
					/>
					<Input
						className="w-full"
						label="Label"
						value={s.label}
						onChange={(e) => patch(i, { label: e.target.value })}
					/>
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						aria-label="Remove stat"
						onClick={() => onChange(values.filter((_, idx) => idx !== i))}
					>
						<Trash className="h-4 w-4" />
					</Button>
				</div>
			))}
			<Button
				variant="secondary"
				size="sm"
				onClick={() => onChange([...values, { value: "", label: "" }])}
			>
				<Plus className="mr-1 h-4 w-4" /> Add stat
			</Button>
		</div>
	);
}

/** Repeatable rows of title + body (mission cycle nodes). */
function NodeListEditor({
	values,
	onChange,
}: {
	values: CycleNode[];
	onChange: (next: CycleNode[]) => void;
}) {
	const patch = (i: number, part: Partial<CycleNode>) =>
		onChange(values.map((n, idx) => (idx === i ? { ...n, ...part } : n)));
	return (
		<div className="space-y-3">
			<div className="text-sm font-medium">Cycle nodes</div>
			{values.map((n, i) => (
				<div key={i} className="border-kumo-line space-y-2 rounded-lg border p-3">
					<div className="flex items-end gap-2">
						<Input
							className="w-full"
							label="Title"
							value={n.title}
							onChange={(e) => patch(i, { title: e.target.value })}
						/>
						<Button
							variant="ghost"
							shape="square"
							size="sm"
							aria-label="Remove node"
							onClick={() => onChange(values.filter((_, idx) => idx !== i))}
						>
							<Trash className="h-4 w-4" />
						</Button>
					</div>
					<Textarea
						className="w-full"
						label="Body"
						rows={2}
						value={n.body}
						onChange={(e) => patch(i, { body: e.target.value })}
					/>
				</div>
			))}
			<Button
				variant="secondary"
				size="sm"
				onClick={() => onChange([...values, { title: "", body: "" }])}
			>
				<Plus className="mr-1 h-4 w-4" /> Add node
			</Button>
		</div>
	);
}

/** Repeatable rows of name + detail (mission key recipients). */
function RecipientListEditor({
	values,
	onChange,
}: {
	values: Recipient[];
	onChange: (next: Recipient[]) => void;
}) {
	const patch = (i: number, part: Partial<Recipient>) =>
		onChange(values.map((n, idx) => (idx === i ? { ...n, ...part } : n)));
	return (
		<div className="space-y-3">
			<div className="text-sm font-medium">Key recipients</div>
			{values.map((n, i) => (
				<div key={i} className="border-kumo-line space-y-2 rounded-lg border p-3">
					<div className="flex items-end gap-2">
						<Input
							className="w-full"
							label="Name"
							value={n.name}
							onChange={(e) => patch(i, { name: e.target.value })}
						/>
						<Button
							variant="ghost"
							shape="square"
							size="sm"
							aria-label="Remove recipient"
							onClick={() => onChange(values.filter((_, idx) => idx !== i))}
						>
							<Trash className="h-4 w-4" />
						</Button>
					</div>
					<Input
						className="w-full"
						label="Detail"
						value={n.detail}
						onChange={(e) => patch(i, { detail: e.target.value })}
					/>
				</div>
			))}
			<Button
				variant="secondary"
				size="sm"
				onClick={() => onChange([...values, { name: "", detail: "" }])}
			>
				<Plus className="mr-1 h-4 w-4" /> Add recipient
			</Button>
		</div>
	);
}

// ── Page ────────────────────────────────────────────────────────────

export function SettingsPage() {
	const [settings, setSettings] = React.useState<BccSettings | null>(null);
	const [loading, setLoading] = React.useState(true);
	const [loadError, setLoadError] = React.useState<string | null>(null);
	const [active, setActive] = React.useState("integrations");
	const [saving, setSaving] = React.useState(false);
	const [saveMsg, setSaveMsg] = React.useState<{ kind: "ok" | "err"; text: string } | null>(null);

	React.useEffect(() => {
		let cancelled = false;
		setLoading(true);
		setLoadError(null);
		void (async () => {
			try {
				const data = await pluginGet<BccSettings>("admin/settings");
				if (!cancelled) setSettings(data);
			} catch (err) {
				if (!cancelled) setLoadError(err instanceof Error ? err.message : "Failed to load settings");
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	/** Merge a partial into one top-level section. */
	const patchSection = <K extends keyof BccSettings>(key: K, part: Partial<BccSettings[K]>) =>
		setSettings((prev) => (prev ? ({ ...prev, [key]: { ...prev[key], ...part } } as BccSettings) : prev));

	const patchColors = (part: Partial<BccSettings["design"]["colors"]>) =>
		setSettings((prev) =>
			prev
				? { ...prev, design: { ...prev.design, colors: { ...prev.design.colors, ...part } } }
				: prev,
		);

	const patchFonts = (part: Partial<BccSettings["design"]["fonts"]>) =>
		setSettings((prev) =>
			prev ? { ...prev, design: { ...prev.design, fonts: { ...prev.design.fonts, ...part } } } : prev,
		);

	const save = async () => {
		if (!settings) return;
		setSaving(true);
		setSaveMsg(null);
		try {
			const updated = await pluginSend<BccSettings>("admin/settings", "POST", settings);
			setSettings(updated);
			setSaveMsg({ kind: "ok", text: "Saved. Your changes are live." });
		} catch (err) {
			setSaveMsg({ kind: "err", text: err instanceof Error ? err.message : "Save failed" });
		} finally {
			setSaving(false);
		}
	};

	if (loading) {
		return (
			<div className="flex justify-center py-12">
				<Loader />
			</div>
		);
	}

	if (loadError || !settings) {
		return (
			<div className="space-y-6">
				<PageHeader title="Site Content" />
				<ErrorNotice message={loadError ?? "Settings could not be loaded."} />
			</div>
		);
	}

	const s = settings;

	return (
		<div className="space-y-6">
			<PageHeader
				title="Site Content"
				subtitle="Edit every part of the website: chrome, section copy, imagery, colors, fonts, and integrations."
				actions={
					<div className="flex items-center gap-3">
						{saveMsg && (
							<span
								className={saveMsg.kind === "ok" ? "text-kumo-success text-sm" : "text-kumo-danger text-sm"}
							>
								{saveMsg.text}
							</span>
						)}
						<Button onClick={() => void save()} disabled={saving}>
							{saving ? <Loader size="sm" /> : <FloppyDisk className="mr-1 h-4 w-4" />}
							Save changes
						</Button>
					</div>
				}
			/>

			<Tabs tabs={TABS} value={active} onValueChange={setActive} />

			{active === "integrations" && (
				<SectionCard
					title="Integrations"
					description="Links and keys that connect the site to outside services."
				>
					<FieldGrid>
						<Input
							className="w-full"
							label="Devote link (donation URL)"
							description="Where every Devote button sends visitors."
							value={s.integrations.devoteUrl}
							onChange={(e) => patchSection("integrations", { devoteUrl: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Hero background video URL"
							description="Optional. Plays behind the hero when set."
							value={s.integrations.heroVideoUrl}
							onChange={(e) => patchSection("integrations", { heroVideoUrl: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Notification email"
							description="Where new contact enquiries are sent."
							value={s.integrations.notificationEmail}
							onChange={(e) => patchSection("integrations", { notificationEmail: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Turnstile site key"
							description="Cloudflare Turnstile key for the contact form."
							value={s.integrations.turnstileSiteKey}
							onChange={(e) => patchSection("integrations", { turnstileSiteKey: e.target.value })}
						/>
						<Input
							className="w-full"
							type="password"
							autoComplete="off"
							label="Resend API key"
							description="From resend.com → API Keys. Used to send enquiry notifications. Overrides the server secret, so you can paste a new key here anytime."
							value={s.integrations.resendApiKey}
							onChange={(e) => patchSection("integrations", { resendApiKey: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Send from address"
							description="Leave blank to use Resend's shared onboarding@resend.dev (only delivers to your own Resend account address). Set to an address on a domain you have verified in Resend to email anyone."
							value={s.integrations.resendFrom}
							onChange={(e) => patchSection("integrations", { resendFrom: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Google Analytics ID"
							description='GA4 measurement id, e.g. "G-XXXXXXXXXX". Leave blank to disable.'
							value={s.analytics.googleAnalyticsId}
							onChange={(e) => patchSection("analytics", { googleAnalyticsId: e.target.value })}
						/>
					</FieldGrid>
					<Textarea
						className="w-full"
						label="Extra head code"
						description="Advanced. Raw HTML added to every public page's <head> (other analytics, pixels, verification tags). Not added to the admin."
						rows={4}
						value={s.analytics.headSnippet}
						onChange={(e) => patchSection("analytics", { headSnippet: e.target.value })}
					/>
				</SectionCard>
			)}

			{active === "header" && (
				<SectionCard title="Header" description="The top navigation bar.">
					<FieldGrid>
						<Input
							className="w-full"
							label="Call to action label"
							value={s.header.ctaLabel}
							onChange={(e) => patchSection("header", { ctaLabel: e.target.value })}
						/>
					</FieldGrid>
					<Switch
						label="Transparent over the homepage hero"
						checked={s.header.transparentOnHome}
						onCheckedChange={(checked) => patchSection("header", { transparentOnHome: checked })}
					/>
				</SectionCard>
			)}

			{active === "hero" && (
				<SectionCard title="Hero" description="The first thing visitors see.">
					<FieldGrid>
						<Input
							className="w-full"
							label="Eyebrow"
							value={s.hero.eyebrow}
							onChange={(e) => patchSection("hero", { eyebrow: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Subhead"
							value={s.hero.subhead}
							onChange={(e) => patchSection("hero", { subhead: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Title line 1"
							value={s.hero.titleLine1}
							onChange={(e) => patchSection("hero", { titleLine1: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Title line 2"
							value={s.hero.titleLine2}
							onChange={(e) => patchSection("hero", { titleLine2: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Primary button"
							value={s.hero.ctaPrimary}
							onChange={(e) => patchSection("hero", { ctaPrimary: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Secondary button"
							value={s.hero.ctaSecondary}
							onChange={(e) => patchSection("hero", { ctaSecondary: e.target.value })}
						/>
					</FieldGrid>
					<Textarea
						className="w-full"
						label="Body"
						rows={3}
						value={s.hero.body}
						onChange={(e) => patchSection("hero", { body: e.target.value })}
					/>
					<MediaField
						label="Hero image (media id)"
						value={s.hero.image}
						onChange={(v) => patchSection("hero", { image: v })}
					/>
					<SocialCardPreview ogWorkerUrl={s.integrations.ogWorkerUrl} />
				</SectionCard>
			)}

			{active === "story" && (
				<SectionCard title="Story" description="The narrative section about Austin and the colony.">
					<FieldGrid>
						<Input
							className="w-full"
							label="Eyebrow"
							value={s.story.eyebrow}
							onChange={(e) => patchSection("story", { eyebrow: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading"
							value={s.story.heading}
							onChange={(e) => patchSection("story", { heading: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading accent"
							value={s.story.headingAccent}
							onChange={(e) => patchSection("story", { headingAccent: e.target.value })}
						/>
					</FieldGrid>
					<StringListEditor
						label="Paragraphs"
						values={s.story.paragraphs}
						onChange={(v) => patchSection("story", { paragraphs: v })}
						addLabel="Add paragraph"
					/>
					<Input
						className="w-full"
						label="Challenge heading"
						value={s.story.challengeHeading}
						onChange={(e) => patchSection("story", { challengeHeading: e.target.value })}
					/>
					<Textarea
						className="w-full"
						label="Challenge body"
						rows={3}
						value={s.story.challengeBody}
						onChange={(e) => patchSection("story", { challengeBody: e.target.value })}
					/>
					<StatListEditor
						values={s.story.stats}
						onChange={(v) => patchSection("story", { stats: v })}
					/>
					<MediaField
						label="Story image (media id)"
						value={s.story.image}
						onChange={(v) => patchSection("story", { image: v })}
					/>
				</SectionCard>
			)}

			{active === "mission" && (
				<SectionCard title="Mission" description="Commerce, conservation, and culture.">
					<FieldGrid>
						<Input
							className="w-full"
							label="Eyebrow"
							value={s.mission.eyebrow}
							onChange={(e) => patchSection("mission", { eyebrow: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading"
							value={s.mission.heading}
							onChange={(e) => patchSection("mission", { heading: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading accent"
							value={s.mission.headingAccent}
							onChange={(e) => patchSection("mission", { headingAccent: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading tail"
							value={s.mission.headingTail}
							onChange={(e) => patchSection("mission", { headingTail: e.target.value })}
						/>
					</FieldGrid>
					<Textarea
						className="w-full"
						label="Lede"
						rows={3}
						value={s.mission.lede}
						onChange={(e) => patchSection("mission", { lede: e.target.value })}
					/>
					<NodeListEditor
						values={s.mission.nodes}
						onChange={(v) => patchSection("mission", { nodes: v })}
					/>
					<Textarea
						className="w-full"
						label="Quote"
						rows={2}
						value={s.mission.quote}
						onChange={(e) => patchSection("mission", { quote: e.target.value })}
					/>
					<Textarea
						className="w-full"
						label="Caption"
						rows={2}
						value={s.mission.caption}
						onChange={(e) => patchSection("mission", { caption: e.target.value })}
					/>
					<Input
						className="w-full"
						label="Recipients label"
						value={s.mission.recipientsLabel}
						onChange={(e) => patchSection("mission", { recipientsLabel: e.target.value })}
					/>
					<RecipientListEditor
						values={s.mission.recipients}
						onChange={(v) => patchSection("mission", { recipients: v })}
					/>
				</SectionCard>
			)}

			{active === "devotions" && (
				<SectionCard title="Devotions" description="The donation tiers section copy.">
					<FieldGrid>
						<Input
							className="w-full"
							label="Eyebrow"
							value={s.devotions.eyebrow}
							onChange={(e) => patchSection("devotions", { eyebrow: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading"
							value={s.devotions.heading}
							onChange={(e) => patchSection("devotions", { heading: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading accent"
							value={s.devotions.headingAccent}
							onChange={(e) => patchSection("devotions", { headingAccent: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Business tiers label"
							value={s.devotions.businessLabel}
							onChange={(e) => patchSection("devotions", { businessLabel: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Individual tiers label"
							value={s.devotions.individualLabel}
							onChange={(e) => patchSection("devotions", { individualLabel: e.target.value })}
						/>
					</FieldGrid>
					<Textarea
						className="w-full"
						label="Lede"
						rows={2}
						value={s.devotions.lede}
						onChange={(e) => patchSection("devotions", { lede: e.target.value })}
					/>
					<Textarea
						className="w-full"
						label="Closer"
						rows={2}
						value={s.devotions.closer}
						onChange={(e) => patchSection("devotions", { closer: e.target.value })}
					/>
					<Textarea
						className="w-full"
						label="Note"
						rows={2}
						value={s.devotions.note}
						onChange={(e) => patchSection("devotions", { note: e.target.value })}
					/>
				</SectionCard>
			)}

			{active === "experiences" && (
				<SectionCard title="Experiences" description="The bat experiences section copy.">
					<FieldGrid>
						<Input
							className="w-full"
							label="Eyebrow"
							value={s.experiences.eyebrow}
							onChange={(e) => patchSection("experiences", { eyebrow: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading"
							value={s.experiences.heading}
							onChange={(e) => patchSection("experiences", { heading: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading accent"
							value={s.experiences.headingAccent}
							onChange={(e) => patchSection("experiences", { headingAccent: e.target.value })}
						/>
					</FieldGrid>
					<Textarea
						className="w-full"
						label="Lede"
						rows={2}
						value={s.experiences.lede}
						onChange={(e) => patchSection("experiences", { lede: e.target.value })}
					/>
					<Textarea
						className="w-full"
						label="Outro"
						rows={2}
						value={s.experiences.outro}
						onChange={(e) => patchSection("experiences", { outro: e.target.value })}
					/>
				</SectionCard>
			)}

			{active === "founder" && (
				<SectionCard title="Founder" description="The founder bio section.">
					<FieldGrid>
						<Input
							className="w-full"
							label="Eyebrow"
							value={s.founder.eyebrow}
							onChange={(e) => patchSection("founder", { eyebrow: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Name"
							value={s.founder.name}
							onChange={(e) => patchSection("founder", { name: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Title"
							value={s.founder.title}
							onChange={(e) => patchSection("founder", { title: e.target.value })}
						/>
					</FieldGrid>
					<StringListEditor
						label="Bio paragraphs"
						values={s.founder.bio}
						onChange={(v) => patchSection("founder", { bio: v })}
						addLabel="Add paragraph"
					/>
					<MediaField
						label="Founder image (media id)"
						value={s.founder.image}
						onChange={(v) => patchSection("founder", { image: v })}
					/>
				</SectionCard>
			)}

			{active === "trust" && (
				<SectionCard title="Trust" description="The supporters strip heading.">
					<Textarea
						className="w-full"
						label="Heading"
						rows={2}
						value={s.trust.heading}
						onChange={(e) => patchSection("trust", { heading: e.target.value })}
					/>
				</SectionCard>
			)}

			{active === "closing" && (
				<SectionCard title="Closing" description="The final call to action band.">
					<FieldGrid>
						<Input
							className="w-full"
							label="Line 1"
							value={s.closing.line1}
							onChange={(e) => patchSection("closing", { line1: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Line 1 accent"
							value={s.closing.line1Accent}
							onChange={(e) => patchSection("closing", { line1Accent: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Line 2"
							value={s.closing.line2}
							onChange={(e) => patchSection("closing", { line2: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Line 3"
							value={s.closing.line3}
							onChange={(e) => patchSection("closing", { line3: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Button"
							value={s.closing.cta}
							onChange={(e) => patchSection("closing", { cta: e.target.value })}
						/>
					</FieldGrid>
					<MediaField
						label="Closing image (media id)"
						value={s.closing.image}
						onChange={(v) => patchSection("closing", { image: v })}
					/>
				</SectionCard>
			)}

			{active === "contact" && (
				<SectionCard
					title="Contact"
					description="The enquiry form section. Submissions land in the Enquiries inbox."
				>
					<FieldGrid>
						<Input
							className="w-full"
							label="Eyebrow"
							value={s.contact.eyebrow}
							onChange={(e) => patchSection("contact", { eyebrow: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading"
							value={s.contact.heading}
							onChange={(e) => patchSection("contact", { heading: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Heading accent (italic amber)"
							value={s.contact.headingAccent}
							onChange={(e) => patchSection("contact", { headingAccent: e.target.value })}
						/>
					</FieldGrid>
					<Textarea
						className="w-full"
						label="Lede"
						rows={2}
						value={s.contact.lede}
						onChange={(e) => patchSection("contact", { lede: e.target.value })}
					/>
					<FieldGrid>
						<Input
							className="w-full"
							label="Name field label"
							value={s.contact.nameLabel}
							onChange={(e) => patchSection("contact", { nameLabel: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Email field label"
							value={s.contact.emailLabel}
							onChange={(e) => patchSection("contact", { emailLabel: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Message field label"
							value={s.contact.messageLabel}
							onChange={(e) => patchSection("contact", { messageLabel: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Submit button"
							value={s.contact.sendLabel}
							onChange={(e) => patchSection("contact", { sendLabel: e.target.value })}
						/>
					</FieldGrid>
				</SectionCard>
			)}

			{active === "footer" && (
				<SectionCard title="Footer" description="The site footer copy and image.">
					<FieldGrid>
						<Input
							className="w-full"
							label="Caption"
							value={s.footer.caption}
							onChange={(e) => patchSection("footer", { caption: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Tagline"
							value={s.footer.tagline}
							onChange={(e) => patchSection("footer", { tagline: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Public contact email"
							value={s.footer.contactEmail}
							onChange={(e) => patchSection("footer", { contactEmail: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Nav column heading"
							value={s.footer.navHeading}
							onChange={(e) => patchSection("footer", { navHeading: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Connect column heading"
							value={s.footer.connectHeading}
							onChange={(e) => patchSection("footer", { connectHeading: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Found a bat label"
							value={s.footer.foundBatLabel}
							onChange={(e) => patchSection("footer", { foundBatLabel: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Found a bat URL"
							value={s.footer.foundBatUrl}
							onChange={(e) => patchSection("footer", { foundBatUrl: e.target.value })}
						/>
					</FieldGrid>
					<Textarea
						className="w-full"
						label="Copyright"
						rows={2}
						value={s.footer.copyright}
						onChange={(e) => patchSection("footer", { copyright: e.target.value })}
					/>
					<MediaField
						label="Footer image (media id)"
						value={s.footer.image}
						onChange={(v) => patchSection("footer", { image: v })}
					/>
				</SectionCard>
			)}

			{active === "social" && (
				<SectionCard title="Social" description="Links to social profiles (leave blank to hide).">
					<FieldGrid>
						<Input
							className="w-full"
							label="Instagram URL"
							value={s.social.instagram}
							onChange={(e) => patchSection("social", { instagram: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Twitter URL"
							value={s.social.twitter}
							onChange={(e) => patchSection("social", { twitter: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Facebook URL"
							value={s.social.facebook}
							onChange={(e) => patchSection("social", { facebook: e.target.value })}
						/>
					</FieldGrid>
				</SectionCard>
			)}

			{active === "pages" && (
				<>
					<SectionCard title="Badges" description="Small labels shown on cards across the site.">
						<FieldGrid>
							<Input
								className="w-full"
								label="Signature experience badge"
								value={s.labels.signatureBadge}
								onChange={(e) => patchSection("labels", { signatureBadge: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Flagship tier badge"
								value={s.labels.flagshipBadge}
								onChange={(e) => patchSection("labels", { flagshipBadge: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Per-year price suffix"
								value={s.labels.perYear}
								onChange={(e) => patchSection("labels", { perYear: e.target.value })}
							/>
						</FieldGrid>
					</SectionCard>

					<SectionCard title="Journal page" description="The /blog listing page.">
						<FieldGrid>
							<Input
								className="w-full"
								label="Eyebrow"
								value={s.blog.eyebrow}
								onChange={(e) => patchSection("blog", { eyebrow: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Heading"
								value={s.blog.heading}
								onChange={(e) => patchSection("blog", { heading: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Heading accent"
								value={s.blog.headingAccent}
								onChange={(e) => patchSection("blog", { headingAccent: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Empty state"
								value={s.blog.empty}
								onChange={(e) => patchSection("blog", { empty: e.target.value })}
							/>
						</FieldGrid>
					</SectionCard>

					<SectionCard title="Programs page" description="The /programs listing page.">
						<FieldGrid>
							<Input
								className="w-full"
								label="Eyebrow"
								value={s.programs.eyebrow}
								onChange={(e) => patchSection("programs", { eyebrow: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Heading"
								value={s.programs.heading}
								onChange={(e) => patchSection("programs", { heading: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Heading accent"
								value={s.programs.headingAccent}
								onChange={(e) => patchSection("programs", { headingAccent: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Empty state"
								value={s.programs.empty}
								onChange={(e) => patchSection("programs", { empty: e.target.value })}
							/>
						</FieldGrid>
					</SectionCard>

					<SectionCard title="404 page" description="Shown when a URL does not exist.">
						<FieldGrid>
							<Input
								className="w-full"
								label="Eyebrow"
								value={s.notFound.eyebrow}
								onChange={(e) => patchSection("notFound", { eyebrow: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Heading"
								value={s.notFound.heading}
								onChange={(e) => patchSection("notFound", { heading: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Heading accent"
								value={s.notFound.headingAccent}
								onChange={(e) => patchSection("notFound", { headingAccent: e.target.value })}
							/>
							<Input
								className="w-full"
								label="Button label"
								value={s.notFound.cta}
								onChange={(e) => patchSection("notFound", { cta: e.target.value })}
							/>
						</FieldGrid>
						<Textarea
							className="w-full"
							label="Body"
							rows={2}
							value={s.notFound.body}
							onChange={(e) => patchSection("notFound", { body: e.target.value })}
						/>
					</SectionCard>
				</>
			)}

			{active === "design" && (
				<SectionCard
					title="Design"
					description="Brand icon, colors and fonts. Changes retint and reset the whole site."
				>
					<MediaField
						label="Favicon (browser tab icon)"
						value={s.design.favicon}
						onChange={(v) => patchSection("design", { favicon: v })}
					/>

					<div>
						<h3 className="mb-3 text-sm font-medium">Colors</h3>
						<FieldGrid>
							<ColorField
								label="Night"
								value={s.design.colors.night}
								onChange={(v) => patchColors({ night: v })}
							/>
							<ColorField
								label="Deep"
								value={s.design.colors.deep}
								onChange={(v) => patchColors({ deep: v })}
							/>
							<ColorField
								label="Amber"
								value={s.design.colors.amber}
								onChange={(v) => patchColors({ amber: v })}
							/>
							<ColorField
								label="Amber light"
								value={s.design.colors.amberLight}
								onChange={(v) => patchColors({ amberLight: v })}
							/>
							<ColorField
								label="Moon"
								value={s.design.colors.moon}
								onChange={(v) => patchColors({ moon: v })}
							/>
							<ColorField
								label="Silver"
								value={s.design.colors.silver}
								onChange={(v) => patchColors({ silver: v })}
							/>
						</FieldGrid>
					</div>
					<div>
						<h3 className="mb-3 text-sm font-medium">Fonts</h3>
						<FieldGrid>
							<Select
								label="Display font"
								value={s.design.fonts.display}
								onValueChange={(v) => patchFonts({ display: v ?? "" })}
								items={fontItems(DISPLAY_FONTS)}
							/>
							<Select
								label="Body font"
								value={s.design.fonts.body}
								onValueChange={(v) => patchFonts({ body: v ?? "" })}
								items={fontItems(BODY_FONTS)}
							/>
							<Select
								label="Accent font"
								value={s.design.fonts.accent}
								onValueChange={(v) => patchFonts({ accent: v ?? "" })}
								items={fontItems(ACCENT_FONTS)}
							/>
						</FieldGrid>
					</div>
				</SectionCard>
			)}

			<div className="flex items-center justify-end gap-3">
				{saveMsg && (
					<span
						className={saveMsg.kind === "ok" ? "text-kumo-success text-sm" : "text-kumo-danger text-sm"}
					>
						{saveMsg.text}
					</span>
				)}
				<Button onClick={() => void save()} disabled={saving}>
					{saving ? <Loader size="sm" /> : <FloppyDisk className="mr-1 h-4 w-4" />}
					Save changes
				</Button>
			</div>
		</div>
	);
}
