/**
 * Curated Bat City Council content, extracted from the latest prod DB dump
 * (../bcc-wp/backups/prod-20260710-183605Z-b39a09e.sql.gz) — see
 * research/content-inventory.md. Statuses, order, amounts, and Zeffy links are
 * preserved faithfully. Media originals live in ../bcc-wp/app/wp-content/uploads.
 *
 * CLIENT RULE: no em dashes in user-facing copy.
 */

export const DEVOTE_URL = "https://www.zeffy.com/en-US/ticketing/bat-city-council";

/** Logical name -> { source path (relative to bcc-wp uploads), alt }. */
export const MEDIA: Record<string, { file: string; alt: string }> = {
	hero: { file: "2026/04/hero-bridge.jpg", alt: "Congress Avenue Bridge at dusk" },
	story: { file: "2026/04/story-austin.jpg", alt: "Austin skyline as bats take flight" },
	founder: { file: "2026/04/founder-teresa.jpg", alt: "Teresa Nichta, Founder of Bat City Council" },
	"exp-bridge": { file: "2026/04/exp-bridge.jpg", alt: "Bats emerging from the Congress Avenue Bridge" },
	"exp-refuge": { file: "2026/04/exp-refuge-a.png", alt: "Austin Bat Refuge" },
	"exp-beyond": { file: "2026/04/exp-beyond-a.jpg", alt: "Bat roosts beyond Austin" },
	"exp-year-round": { file: "2026/04/exp-year-round.jpg", alt: "Year-round bat activities in Austin" },
};

export interface Entry {
	slug: string;
	status: "published" | "draft";
	data: Record<string, unknown>;
	/** logical media name for the entry's image field, if any */
	imageKey?: string;
	imageField?: string;
}

export const TIERS: Entry[] = [
	// Business (published) — rendered first.
	{
		slug: "business-ally",
		status: "published",
		data: {
			title: "Business Ally",
			statement:
				"Bat City Council Certified seal (digital and storefront), directory listing, social media recognition, annual impact report.",
			amount: 2500,
			amount_label: "/yr",
			tier_type: "business",
			devote_url: DEVOTE_URL,
			order: 1,
		},
	},
	{
		slug: "business-steward",
		status: "published",
		data: {
			title: "Business Steward",
			statement:
				"Everything in Ally, plus featured placement, co-branded PR, premium decal and plaque, inclusion in Bat-Friendly Austin tourism offerings.",
			amount: 10000,
			amount_label: "/yr",
			tier_type: "business",
			devote_url: DEVOTE_URL,
			order: 2,
		},
	},
	{
		slug: "anchor-partner",
		status: "published",
		data: {
			title: "Anchor Partner",
			statement:
				"Everything in Steward, plus press partnership, logo on major campaigns, VIP bat experience, and category exclusivity.",
			amount: 25000,
			amount_label: "$25K to $50K",
			tier_type: "business",
			devote_url: DEVOTE_URL,
			order: 3,
		},
	},
	// Individual (draft in prod — client can publish).
	{
		slug: "bat-ally",
		status: "draft",
		data: {
			title: "Bat Ally",
			statement: "Digital badge, directory listing, annual impact report, social recognition.",
			amount: 500,
			amount_label: "/yr",
			tier_type: "individual",
			devote_url: DEVOTE_URL,
			order: 1,
		},
	},
	{
		slug: "bat-steward",
		status: "draft",
		data: {
			title: "Bat Steward",
			statement: "Everything in Ally, plus exclusive decal, featured listing, and seasonal events.",
			amount: 2500,
			amount_label: "/yr",
			tier_type: "individual",
			devote_url: DEVOTE_URL,
			order: 2,
		},
	},
	{
		slug: "bat-guardian",
		status: "draft",
		data: {
			title: "Bat Guardian",
			statement: "Everything in Steward, plus private bat experiences.",
			amount: 5000,
			amount_label: "/yr",
			tier_type: "individual",
			devote_url: DEVOTE_URL,
			order: 3,
		},
	},
	{
		slug: "night-council",
		status: "draft",
		data: {
			title: "Night Council",
			statement: "The inner circle. Legacy recognition, private expeditions, category exclusivity.",
			amount: 25000,
			amount_label: "$25K+",
			tier_type: "individual",
			devote_url: DEVOTE_URL,
			order: 4,
		},
	},
	// The published "give any amount" catch-all.
	{
		slug: "individual-support-any-amount",
		status: "published",
		data: {
			title: "Individual support of any amount.",
			statement: "",
			amount: 150,
			amount_label: "Bat Friend",
			tier_type: "individual",
			devote_url: DEVOTE_URL,
			order: 0,
		},
	},
];

export const EXPERIENCES: Entry[] = [
	{
		slug: "congress-avenue-bridge",
		status: "published",
		imageKey: "exp-bridge",
		imageField: "image",
		data: {
			title: "The Congress Avenue Bridge",
			description:
				"The iconic experience. Watch 1.5 million Brazilian free-tailed bats emerge from the Congress Avenue Bridge at dusk. Beautiful and unforgettable when viewed from the bridge itself, the trail below, or by boat or kayak on Lady Bird Lake.",
			is_signature: false,
			cta_text: "Plan your visit",
			order: 1,
		},
	},
	{
		slug: "austin-bat-refuge-private-encounter",
		status: "published",
		imageKey: "exp-refuge",
		imageField: "image",
		data: {
			title: "Austin Bat Refuge: Private Encounter",
			description:
				"An exclusive, intimate experience. Meet rescued bats face to face at Austin Bat Refuge, the devoted stewards of Austin's mascot mammal and staple of Bat City culture. Available for devotees of Bat City Council.",
			is_signature: true,
			cta_text: "Request access",
			order: 2,
		},
	},
	{
		slug: "beyond-the-bridge",
		status: "published",
		imageKey: "exp-beyond",
		imageField: "image",
		data: {
			title: "Beyond the Bridge",
			description:
				"Explore lesser-known bat roosts and bridges just outside Austin. For the curious and the devoted. Guided by Teresa Nichta.",
			is_signature: false,
			cta_text: "Get in touch",
			order: 3,
		},
	},
	{
		slug: "year-round-bat-activities",
		status: "published",
		imageKey: "exp-year-round",
		imageField: "image",
		data: {
			title: "Year-Round Bat Activities",
			description:
				"Educational programs, group tours, private events, and conservation experiences, available any time of year. Austin is beautiful year-round. The bats at the bridge may not always be in full capacity, but there are always bats in town!",
			is_signature: false,
			cta_text: "Get in touch",
			order: 4,
		},
	},
];

export const PARTNERS: Entry[] = [
	{ slug: "visit-austin", status: "published", data: { title: "Visit Austin", order: 1 } },
	{ slug: "austin-bat-refuge", status: "published", data: { title: "Austin Bat Refuge", order: 2 } },
	{ slug: "sxsw", status: "published", data: { title: "SXSW", order: 3 } },
	{ slug: "city-of-austin", status: "published", data: { title: "City of Austin", order: 4 } },
	{ slug: "austin-convention-bureau", status: "draft", data: { title: "Austin Convention Bureau", order: 5 } },
];

export const BUSINESS_DONORS: Entry[] = [
	{
		slug: "torchys-tacos",
		status: "published",
		data: {
			title: "Torchy's Tacos",
			business_url: "https://www.facebook.com/TorchysTacos/",
			location: { lat: 30.2454642, lng: -97.7515802, address: "Torchy's Tacos, Austin, TX" },
			order: 0,
		},
	},
];

function pt(text: string): unknown[] {
	return [
		{
			_type: "block",
			_key: "b1",
			style: "normal",
			markDefs: [],
			children: [{ _type: "span", _key: "s1", text, marks: [] }],
		},
	];
}

export const PROGRAMS: Entry[] = [
	{
		slug: "programs-overview",
		status: "published",
		data: {
			title:
				"Conservation Media Resources · Rehabilitation Internships · Artist Residencies · Educational Outreach · Strategic Development · Unique Ecotourism Experiences · Inclusive Events",
			excerpt:
				"Devotions to Bat City Council support robust culture and a harmonious future for bats and humans.",
			body: pt(
				"Devotions to Bat City Council support robust culture and a harmonious future for bats and humans.",
			),
			order: 0,
		},
	},
];
