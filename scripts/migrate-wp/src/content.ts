/**
 * Curated Bat City Council content, captured in research/content-inventory.md.
 * Statuses, order, amounts, and Zeffy links are preserved faithfully. Media
 * originals are vendored in-repo at scripts/migrate-wp/media/.
 *
 * CLIENT RULE: no em dashes in user-facing copy.
 */

export const DEVOTE_URL = "https://www.zeffy.com/en-US/ticketing/bat-city-council";

/**
 * Logical name -> { in-repo media filename, alt }.
 * Source originals are vendored into `scripts/migrate-wp/media/` so this
 * migration is self-contained (no path escaping to a sibling project).
 */
export const MEDIA: Record<string, { file: string; alt: string }> = {
	hero: { file: "hero-bridge.jpg", alt: "Congress Avenue Bridge at dusk" },
	story: { file: "story-austin.jpg", alt: "Austin skyline as bats take flight" },
	founder: { file: "founder-teresa.jpg", alt: "Teresa Nichta, Founder of Bat City Council" },
	"exp-bridge": { file: "exp-bridge.jpg", alt: "Bats emerging from the Congress Avenue Bridge" },
	"exp-refuge": { file: "exp-refuge-a.png", alt: "Austin Bat Refuge" },
	"exp-beyond": { file: "exp-beyond-a.jpg", alt: "Bat roosts beyond Austin" },
	"exp-year-round": { file: "exp-year-round.jpg", alt: "Year-round bat activities in Austin" },
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
				"Bat City Council Certified seal (digital + storefront), directory listing, social media recognition, annual impact report.",
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
	// Night Council ($25K+ individual tier) existed as a draft in an earlier
	// WP snapshot but was permanently deleted from prod since; omitted here to
	// match current WP. Re-add if the client wants it revived.
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

const GET_IN_TOUCH_URL =
	"https://docs.google.com/forms/d/e/1FAIpQLSeFdjXcQ1k1OUb7sdoUccaBtxYnftMQ5ClvWho6Gg3xoCDJRw/viewform";

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
			body: [
				ptLink([
					"Devotees of Bat City Council have access to guided experiences and special offers, ",
					{ text: "get in touch", href: GET_IN_TOUCH_URL },
					" to schedule.",
				]),
			],
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
				"An exclusive, intimate experience. Meet rescued bats face to face at Austin Bat Refuge, the dedicated stewards of Austin's mascot mammal and staple of Bat City culture.",
			is_signature: true,
			cta_text: "Request access",
			body: [
				ptLink([
					"Available for devotees of Bat City Council, ",
					{ text: "get in touch", href: GET_IN_TOUCH_URL },
					" to schedule.",
				]),
			],
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
				"For the curious and the devoted: guided trips to lesser-known bat roosts in Texas, Thailand, and Cuba.",
			is_signature: false,
			cta_text: "Get in touch",
			body: [
				ptLink([
					"TEXAS - Explore lesser-known bat roosts and bridges just outside Austin. Experiences are customizable and vary by season and availability, ",
					{ text: "just ask!", href: GET_IN_TOUCH_URL },
				]),
				ptLink(
					[
						"THAILAND - All are invited to join this ",
						{
							text: "one-of-a-kind field trip to Thailand",
							href: "https://www.teresamaynichta.com/bats-and-beaches",
						},
						".",
					],
					"b2",
				),
				ptLink(
					[
						"CUBA - Amicusesse and ProyectoCUBABAT co-hosted ",
						{
							text: "cultural exchange field trips to Cuba",
							href: "https://www.amicusesse.com/cuba2026",
						},
						".",
					],
					"b3",
				),
			],
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
			body: [
				ptLink([
					"Experiences are customizable and vary by season and availability, ",
					{ text: "get in touch", href: GET_IN_TOUCH_URL },
					" to inquire.",
				]),
			],
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
			// WP stores this as "torchys tacos" (no apostrophe, lowercase) -- a data-entry
			// slip, not intentional styling. Using the real business name here.
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

/** A portable text paragraph built from plain-text and {text, href} link segments. */
function ptLink(segments: Array<string | { text: string; href: string }>, key = "b1"): unknown {
	const markDefs: Array<{ _type: string; _key: string; href: string }> = [];
	const children = segments.map((seg, i) => {
		if (typeof seg === "string") {
			return { _type: "span", _key: `${key}s${i}`, text: seg, marks: [] };
		}
		const markKey = `${key}link${i}`;
		markDefs.push({ _type: "link", _key: markKey, href: seg.href });
		return { _type: "span", _key: `${key}s${i}`, text: seg.text, marks: [markKey] };
	});
	return { _type: "block", _key: key, style: "normal", markDefs, children };
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
