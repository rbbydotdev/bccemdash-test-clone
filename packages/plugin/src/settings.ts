/**
 * BCC site settings — the client-editable "Site Content" bag.
 *
 * Stored as a single `bcc_site` option (JSON) via emdash's OptionsRepository,
 * so it is one row, one read. `getBccSettings()` deep-merges the stored bag
 * over BCC_DEFAULTS, so components always render correct copy even before any
 * edit or migration. Edited through the plugin's admin/settings route.
 *
 * Copy defaults come from the original design brief captured in
 * research/design-system.md and research/content-inventory.md.
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
export interface Recipient {
	name: string;
	detail: string;
}

export interface BccSettings {
	integrations: {
		devoteUrl: string;
		heroVideoUrl: string;
		notificationEmail: string;
		turnstileSiteKey: string;
		/**
		 * Resend API key for outgoing mail. Server-side only — never rendered
		 * into a page. Takes precedence over the RESEND_API_KEY env var/secret,
		 * so it can be rotated from the admin without a redeploy.
		 */
		resendApiKey: string;
		/** Sender address. Blank uses Resend's shared onboarding@resend.dev. */
		resendFrom: string;
		/**
		 * Base URL of the OG card Worker (apps/og), e.g.
		 * "https://bat-city-council-og.<sub>.workers.dev". Blank serves the card
		 * from this origin under /og instead.
		 */
		ogWorkerUrl: string;
	};
	/**
	 * Analytics / third-party tags, injected into the PUBLIC site's <head> only
	 * (never the admin). Leave blank to inject nothing.
	 */
	analytics: {
		/** GA4 measurement id, e.g. "G-XXXXXXXXXX". We render the gtag snippet. */
		googleAnalyticsId: string;
		/** Raw <head> markup for any other tag (Meta pixel, Plausible, ...). */
		headSnippet: string;
	};
	header: {
		ctaLabel: string;
		transparentOnHome: boolean;
		/** Logo shown beside the org name (emdash media id). Blank = the bat mark. */
		logo: string;
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
		challengeHeading: string;
		challengeBody: string;
		stats: StatItem[];
		image: string;
	};
	mission: {
		eyebrow: string;
		heading: string;
		headingAccent: string;
		headingTail: string;
		lede: string;
		quote: string;
		nodes: CycleNode[];
		caption: string;
		recipientsLabel: string;
		recipients: Recipient[];
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
	contact: {
		eyebrow: string;
		heading: string;
		headingAccent: string;
		lede: string;
		nameLabel: string;
		emailLabel: string;
		messageLabel: string;
		sendLabel: string;
	};
	footer: {
		caption: string;
		tagline: string;
		copyright: string;
		contactEmail: string;
		navHeading: string;
		connectHeading: string;
		foundBatLabel: string;
		foundBatUrl: string;
		image: string;
	};
	/** Small reusable UI labels (badges, units) shown across sections. */
	labels: {
		signatureBadge: string;
		flagshipBadge: string;
		perYear: string;
	};
	/** Standalone route copy: 404, blog index, programs index. */
	notFound: {
		eyebrow: string;
		heading: string;
		headingAccent: string;
		body: string;
		cta: string;
	};
	blog: {
		eyebrow: string;
		heading: string;
		headingAccent: string;
		empty: string;
	};
	programs: {
		eyebrow: string;
		heading: string;
		headingAccent: string;
		empty: string;
	};
	social: {
		instagram: string;
		twitter: string;
		facebook: string;
	};
	/** Design knobs (the WP Customizer equivalent). Emitted as :root --bcc-* vars. */
	design: {
		/** Browser tab icon (emdash media id). Blank = no favicon emitted. */
		favicon: string;
		colors: {
			night: string;
			deep: string;
			amber: string;
			amberLight: string;
			moon: string;
			silver: string;
		};
		fonts: {
			display: string;
			body: string;
			accent: string;
		};
	};
}

export const BCC_DEFAULTS: BccSettings = {
	integrations: {
		devoteUrl: DEFAULT_DEVOTE_URL,
		heroVideoUrl: "",
		notificationEmail: "",
		turnstileSiteKey: "",
		resendApiKey: "",
		resendFrom: "",
		ogWorkerUrl: "",
	},
	analytics: {
		googleAnalyticsId: "",
		headSnippet: "",
	},
	header: {
		ctaLabel: "Devote Now",
		transparentOnHome: true,
		logo: "",
	},
	hero: {
		eyebrow: "Est. 2026 · Austin, Texas",
		titleLine1: "Bat City",
		titleLine2: "Council",
		subhead: "Connecting culture, commerce and conservation.",
		body: "In Bats We Trust - become a Certified Bat Business with your Devotion. Bats are the soul of Bat City. They need your devotion.",
		ctaPrimary: "Make a Devotion",
		ctaSecondary: "Explore the Mission",
		image: "",
	},
	story: {
		eyebrow: "The Story",
		heading: "Austin Is Bat City.",
		headingAccent: "This Is Why.",
		paragraphs: [
			"Beneath the Congress Avenue Bridge lives the largest urban bat colony on Earth: 1.5 million Brazilian free-tailed bats. They emerge into the Austin sky in a spectacle that draws over 140,000 visitors each year just for the bats alone.",
			"But Austin welcomes 60 million tourists annually and most have never witnessed the flight. Bat City Council exists to share bat experiences with everyone and share the culture of living safely and harmoniously together with wildlife.",
		],
		challengeHeading: "The Challenge We Face",
		challengeBody:
			"Businesses benefit from bat tourism, but conservation funding is fragmented and under-supported. Sustainable tourism depends on healthy bat populations, yet the resources to protect them haven't kept pace with the economic impact they generate.",
		stats: [
			{ value: "1.5M", label: "Bats in the Colony" },
			{ value: "140K+", label: "Annual Bat Tourists" },
			{ value: "60M", label: "Austin Visitors We Can Reach" },
		],
		image: "",
	},
	mission: {
		eyebrow: "The Mission",
		heading: "Connecting Culture, Commerce &",
		headingAccent: "Conservation",
		headingTail: "",
		lede: "Bat City Council is the bridge between Austin's thriving economy and the living ecosystem that makes this city legendary. Through business partnerships, individual support, and unforgettable bat experiences, we fund and foster conservation directly, protecting the bats that are the hallmark of Austin's identity.",
		quote: "You don't have to become a bat expert. You just have to care.",
		nodes: [
			{ title: "Commerce", body: "Businesses and individuals make devotions to the colony's future." },
			{ title: "Conservation", body: "Funds support Austin Bat Refuge, radar research, education, and bat care." },
			{ title: "Culture", body: "Enhanced bat tourism strengthens Austin's identity and economy." },
		],
		caption: "The sacred cycle: Conservation fuels commerce. Commerce funds conservation.",
		recipientsLabel: "Key Recipients",
		recipients: [
			{ name: "Austin Bat Refuge", detail: "Radar data collection · Educational outreach · Local bat care" },
			{ name: "Bat City Films", detail: "Media resources · Educational support" },
			{ name: "EchoVision", detail: "XR Experience" },
			{ name: "Proyecto CUBABAT", detail: "Ecotourism and Conservation in Cuba" },
			{ name: "BatThai", detail: "Ecotourism and Conservation in Thailand" },
		],
	},
	devotions: {
		eyebrow: "Devotions",
		heading: "Devote to the",
		headingAccent: "Night",
		lede: "Your devotion sustains Austin's night guardians through ecotourism. Choose your place in the colony.",
		businessLabel: "For Business",
		individualLabel: "For Individuals",
		closer: "Every devotion, at every level, keeps Austin's night guardians in flight.",
		note: "On the devotion page you'll find an option to devote any amount.",
	},
	experiences: {
		eyebrow: "Experiences",
		heading: "Experience the",
		headingAccent: "Night",
		lede: "Austin's bats are waiting. The best time to visit the bats is mid-March to mid-April and late July, continuing through August when the baby bats have learned to fly - but we facilitate bat experiences year-round.",
		outro: "Interested in a batty experience? Get in touch.",
	},
	founder: {
		eyebrow: "The Founder",
		name: "Teresa Nichta",
		title: "Founder, Bat City Council",
		bio: [
			"Teresa Nichta is a conservation leader, producer, and bridge-builder who has spent over 12 years connecting science, art, technology, and community in service of a more regenerative future. She champions human-wildlife coexistence, meaningful collaboration, and innovative approaches to conservation and social impact.",
			"Drawing from experience in nonprofit leadership, conservation, media production, and fundraising, Teresa has helped grow organizations from the ground up, led conservation initiatives across four continents, and produced projects with internationally recognized cultural institutions. She is passionate about bringing together scientists, artists, technologists, donors, and communities to transform bold ideas into lasting impact - creating experiences and partnerships that deepen our connection to the natural world and inspire positive action and change.",
		],
		image: "",
	},
	trust: {
		heading: "Supported by leaders across Austin's business, tourism, and conservation communities.",
	},
	closing: {
		line1: "Every flight begins with",
		line1Accent: "devotion.",
		line2: "Support Bat City Council.",
		line3: "Protect what makes Austin legendary.",
		cta: "Make Your Devotion",
		image: "",
	},
	contact: {
		eyebrow: "Get in Touch",
		heading: "Join the",
		headingAccent: "colony.",
		lede: "Questions about a devotion, a bat experience, or a partnership? Send a note and we will be in touch.",
		nameLabel: "Name",
		emailLabel: "Email",
		messageLabel: "Message",
		sendLabel: "Send",
	},
	footer: {
		caption: "Guardians of Austin's Night Sky.",
		tagline: "Culture · Commerce · Conservation",
		copyright: "© 2026 Bat City Council. Austin, Texas. 501c3 nonprofit, EIN 42-2391354",
		contactEmail: "hello@batcitycouncil.org",
		navHeading: "Navigate",
		connectHeading: "Connect",
		foundBatLabel: "Found a bat?",
		foundBatUrl: "https://austinbatrefuge.org/found-a-bat/",
		image: "",
	},
	labels: {
		signatureBadge: "Signature Experience",
		flagshipBadge: "Flagship",
		perYear: "Per Year",
	},
	notFound: {
		eyebrow: "Error 404",
		heading: "Lost in the",
		headingAccent: "Night",
		body: "This page has taken flight. Let us guide you back to the colony.",
		cta: "Return Home",
	},
	blog: {
		eyebrow: "Journal",
		heading: "From the",
		headingAccent: "Colony",
		empty: "Stories are coming soon.",
	},
	programs: {
		eyebrow: "Programs",
		heading: "What Your Devotion",
		headingAccent: "Sustains",
		empty: "Programs are coming soon.",
	},
	social: {
		instagram: "",
		twitter: "",
		facebook: "",
	},
	design: {
		favicon: "",
		colors: {
			night: "#0A0E1A",
			deep: "#111833",
			amber: "#D4A03C",
			amberLight: "#E8C060",
			moon: "#C8D0E0",
			silver: "#8892A8",
		},
		fonts: {
			display: "Cormorant Garamond",
			body: "EB Garamond",
			accent: "Josefin Sans",
		},
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
