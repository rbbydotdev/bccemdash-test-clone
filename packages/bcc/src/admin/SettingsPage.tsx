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

import type { BccSettings, CycleNode, StatItem } from "../settings.js";
import { ErrorNotice, PageHeader, pluginGet, pluginSend } from "./lib.js";

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
	{ value: "footer", label: "Footer" },
	{ value: "social", label: "Social" },
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

/** Two-column responsive grid for short inputs. */
function FieldGrid({ children }: { children: React.ReactNode }) {
	return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** Imagery field: a media id text input plus a live thumbnail preview. */
function MediaField({
	label,
	value,
	onChange,
}: {
	label: string;
	value: string;
	onChange: (v: string) => void;
}) {
	const [broken, setBroken] = React.useState(false);
	React.useEffect(() => setBroken(false), [value]);
	const id = value.trim();
	const src = id ? `/_emdash/api/media/file/${id}` : "";
	return (
		<div className="space-y-2">
			<Input
				className="w-full"
				label={label}
				description="Paste a media id from the Media library. Leave blank to use the default."
				placeholder="media id"
				value={value}
				onChange={(e) => onChange(e.target.value)}
			/>
			{src && !broken ? (
				<img
					src={src}
					alt=""
					onError={() => setBroken(true)}
					className="border-kumo-line h-32 w-auto rounded-lg border object-cover"
				/>
			) : id && broken ? (
				<p className="text-kumo-subtle text-xs">No preview for this id yet. It will resolve once saved.</p>
			) : null}
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
	value: string;
	onChange: (v: string) => void;
}) {
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
					</FieldGrid>
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
						label="Caption"
						rows={2}
						value={s.mission.caption}
						onChange={(e) => patchSection("mission", { caption: e.target.value })}
					/>
					<FieldGrid>
						<Input
							className="w-full"
							label="Recipient label"
							value={s.mission.recipientLabel}
							onChange={(e) => patchSection("mission", { recipientLabel: e.target.value })}
						/>
						<Input
							className="w-full"
							label="Recipient name"
							value={s.mission.recipientName}
							onChange={(e) => patchSection("mission", { recipientName: e.target.value })}
						/>
					</FieldGrid>
					<Input
						className="w-full"
						label="Recipient detail"
						value={s.mission.recipientDetail}
						onChange={(e) => patchSection("mission", { recipientDetail: e.target.value })}
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

			{active === "design" && (
				<SectionCard
					title="Design"
					description="Brand colors and fonts. Changes retint and reset the whole site."
				>
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
