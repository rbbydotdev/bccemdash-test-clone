/**
 * BCC site settings — the client-editable "Site Content" bag.
 *
 * Stored as a single `bcc_site` option (JSON) via emdash's OptionsRepository,
 * so it is one row, one read. `getBccSettings()` deep-merges the stored bag
 * over BCC_DEFAULTS, so components always render correct copy even before any
 * edit or migration. Edited through the plugin's admin/settings route.
 *
 * Copy defaults come from the design brief
 * (../bcc-wp/src/themes/bat-city-council/DESIGN.md) and the prod content dump.
 * CLIENT RULE: no em dashes anywhere in user-facing copy.
 *
 * Images are emdash media ids (resolved to URLs at render time).
 */
import { OptionsRepository } from "emdash";
import { getDb } from "emdash/runtime";
import type { Kysely } from "kysely";

export const DEFAULT_DEVOTE_URL = "https://www.zeffy.com/en-US/ticketing/bat-city-council";

export interface StatItem {
	value: string;
	label: string;
}
export interface CycleNode {
	title: string;
	body: string;
}

export interface BccSettings {
	integrations: {
		devoteUrl: string;
		heroVideoUrl: string;
		notificationEmail: string;
		turnstileSiteKey: string;
	};
	header: {
		ctaLabel: string;
		transparentOnHome: boolean;
	};
	hero: {
		eyebrow: string;
		titleLine1: string;
		titleLine2: string;
		subhead: string;
		body: string;
		ctaPrimary: string;
		ctaSecondary: string;
		image: string;
	};
	story: {
		eyebrow: string;
		heading: string;
		headingAccent: string;
		paragraphs: string[];
		stats: StatItem[];
		image: string;
	};
	mission: {
		eyebrow: string;
		heading: string;
		headingAccent: string;
		headingTail: string;
		lede: string;
		nodes: CycleNode[];
		caption: string;
		recipientLabel: string;
		recipientName: string;
		recipientDetail: string;
	};
	devotions: {
		eyebrow: string;
		heading: string;
		headingAccent: string;
		lede: string;
		businessLabel: string;
		individualLabel: string;
		closer: string;
		note: string;
	};
	experiences: {
		eyebrow: string;
		heading: string;
		headingAccent: string;
		lede: string;
		outro: string;
	};
	founder: {
		eyebrow: string;
		name: string;
		title: string;
		bio: string[];
		image: string;
	};
	trust: {
		heading: string;
	};
	closing: {
		line1: string;
		line1Accent: string;
		line2: string;
		line3: string;
		cta: string;
		image: string;
	};
	footer: {
		caption: string;
		tagline: string;
		copyright: string;
		foundBatUrl: string;
		image: string;
	};
	social: {
		instagram: string;
		twitter: string;
		facebook: string;
	};
}

export const BCC_DEFAULTS: BccSettings = {
	integrations: {
		devoteUrl: DEFAULT_DEVOTE_URL,
		heroVideoUrl: "",
		notificationEmail: "",
		turnstileSiteKey: "",
	},
	header: {
		ctaLabel: "Devote Now",
		transparentOnHome: true,
	},
	hero: {
		eyebrow: "Est. 2026 · Austin, Texas",
		titleLine1: "Bat City",
		titleLine2: "Council",
		subhead: "Guardians of Austin's Night Sky",
		body: "Every dusk, 1.5 million bats take flight from the heart of Austin. They are the soul of Bat City. And they need your devotion.",
		ctaPrimary: "Make a Devotion",
		ctaSecondary: "Explore the Mission",
		image: "",
	},
	story: {
		eyebrow: "The Story",
		heading: "Austin Is Bat City.",
		headingAccent: "This Is Why.",
		paragraphs: [
			"Beneath the Congress Avenue Bridge lives the largest urban bat colony on Earth: 1.5 million Brazilian free-tailed bats. Every evening from April through September, they erupt into the Austin sky in a spectacle that draws over 140,000 visitors each year just for the bats alone.",
			"But Austin welcomes 60 million tourists annually. Most have never witnessed the flight. Bat City Council exists to change that, and to ensure the colony thrives for generations.",
		],
		stats: [
			{ value: "1.5M", label: "Bats in the Colony" },
			{ value: "140K+", label: "Annual Bat Tourists" },
			{ value: "60M", label: "Austin Visitors We Can Reach" },
		],
		image: "",
	},
	mission: {
		eyebrow: "The Mission",
		heading: "Connecting Commerce &",
		headingAccent: "Conservation",
		headingTail: "in Bat City",
		lede: "Bat City Council is the bridge between Austin's thriving economy and the living ecosystem that makes this city legendary. Through business partnerships, individual devotions, and unforgettable bat experiences, we fund conservation directly, protecting the bats that protect Austin's identity.",
		nodes: [
			{ title: "Commerce", body: "Businesses and individuals make devotions to the colony's future." },
			{ title: "Conservation", body: "Funds support Austin Bat Refuge, radar research, education, and local bat care." },
			{ title: "Culture", body: "Enhanced bat tourism strengthens Austin's identity and economy." },
		],
		caption: "The cycle repeats. Conservation fuels commerce. Commerce funds conservation.",
		recipientLabel: "Key Recipient",
		recipientName: "Austin Bat Refuge",
		recipientDetail: "Radar data collection · Educational outreach · Local bat care",
	},
	devotions: {
		eyebrow: "Devotions",
		heading: "Devote to the",
		headingAccent: "Night",
		lede: "Your devotion sustains Austin's night guardians. Choose your place in the colony.",
		businessLabel: "Business Devotions",
		individualLabel: "Individual Devotions",
		closer: "Every devotion, at every level, keeps Austin's night guardians in flight.",
		note: "On the devotion page you'll find an option to devote any amount.",
	},
	experiences: {
		eyebrow: "Experiences",
		heading: "Experience the",
		headingAccent: "Night",
		lede: "Austin's bats are waiting. The best time to visit is April through September, but we facilitate bat activities year-round.",
		outro: "Interested in a bat experience? Get in touch.",
	},
	founder: {
		eyebrow: "The Founder",
		name: "Teresa Nichta",
		title: "Founder, Bat City Council",
		bio: [
			"Teresa Nichta has led conservation expeditions across four continents, from Egypt and Cuba to Zambia and Ecuador. She has scaled organizations from the ground up, grown audiences from 300 to 75,000+, and produced exhibitions for the Onassis Foundation and the Smithsonian.",
			"She is a trusted advisor to Austin Bat Refuge and holds the rare combination of scientific field experience, creative media innovation, major donor fundraising, and executive strategy in one leader.",
			"A decade-plus network spanning donors, scientists, artists, cultural institutions, and global conservation partners. Purpose-built for this mission.",
		],
		image: "",
	},
	trust: {
		heading: "Supported by leaders across Austin's business, tourism, and conservation communities.",
	},
	closing: {
		line1: "Every flight begins with",
		line1Accent: "devotion.",
		line2: "Join the Bat City Council.",
		line3: "Protect what makes Austin legendary.",
		cta: "Make Your Devotion",
		image: "",
	},
	footer: {
		caption: "Guardians of Austin's Night Sky.",
		tagline: "Culture · Commerce · Conservation",
		copyright: "© 2026 Bat City Council. Austin, Texas. 501c3 nonprofit, EIN 42-2391354",
		foundBatUrl: "https://austinbatrefuge.org/found-a-bat/",
		image: "",
	},
	social: {
		instagram: "",
		twitter: "",
		facebook: "",
	},
};

const OPTION_KEY = "bcc_site";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

/** Deep-merge `patch` over `base` (arrays and scalars replace, objects merge). */
function deepMerge<T>(base: T, patch: DeepPartial<T> | undefined): T {
	if (!patch) return base;
	if (Array.isArray(base)) return (patch as unknown as T) ?? base;
	if (typeof base !== "object" || base === null) return (patch as T) ?? base;
	const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
	for (const [k, v] of Object.entries(patch as Record<string, unknown>)) {
		if (v === undefined) continue;
		const bv = (base as Record<string, unknown>)[k];
		out[k] =
			bv && typeof bv === "object" && !Array.isArray(bv) && v && typeof v === "object" && !Array.isArray(v)
				? deepMerge(bv, v as DeepPartial<typeof bv>)
				: v;
	}
	return out as T;
}

async function options(): Promise<OptionsRepository> {
	const db = (await getDb()) as unknown as Kysely<never>;
	return new OptionsRepository(db as never);
}

/** Read the BCC site settings bag (defaults deep-merged under stored overrides). */
export async function getBccSettings(): Promise<BccSettings> {
	try {
		const repo = await options();
		const stored = await repo.get<DeepPartial<BccSettings>>(OPTION_KEY);
		return deepMerge(BCC_DEFAULTS, stored ?? undefined);
	} catch {
		return BCC_DEFAULTS;
	}
}

/** Merge a partial update into the stored bag and return the merged result. */
export async function setBccSettings(patch: DeepPartial<BccSettings>): Promise<BccSettings> {
	const repo = await options();
	const stored = (await repo.get<DeepPartial<BccSettings>>(OPTION_KEY)) ?? {};
	const merged = deepMerge(stored as BccSettings, patch);
	await repo.set(OPTION_KEY, merged);
	return deepMerge(BCC_DEFAULTS, merged as DeepPartial<BccSettings>);
}
