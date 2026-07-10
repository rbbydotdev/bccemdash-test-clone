# Bat City Council — content inventory (migration source of truth)

Extracted from the latest prod DB dump `../bcc-wp/backups/prod-20260710-183605Z-b39a09e.sql.gz`
(site: batcitycouncil.org, WordPress). Media originals live in
`../bcc-wp/app/wp-content/uploads/2026/**`. Statuses are preserved on migration.

> The hand-built visual reference `../bcc/index.html` has DIFFERENT (older) tier prices and
> perk copy. **The WP dump is authoritative for content**; `../bcc/index.html` is authoritative
> for *visual/effects*. Where they disagree on copy, WP wins.

## CPTs → emdash collections

### Tiers (`bcc_tier` → `tiers`)
Fields: `amount` (number), `amount_label` (string, e.g. "/yr"), `tier_type` (individual|business),
`devote_url` (url), body/content (the tier statement). Ordered by `menu_order`, grouped by type.
**Business renders BEFORE individual** (client rule).

| id | title | status | order | type | amount | amount_label | body |
|----|-------|--------|-------|------|--------|--------------|------|
| 65 | Business Ally | publish | 1 | business | 2500 | /yr | Bat City Council Certified seal (digital + storefront), directory listing, social media recognition, annual impact report. |
| 66 | Business Steward | publish | 2 | business | 10000 | /yr | Everything in Ally, plus featured placement, co-branded PR, premium decal and plaque, inclusion in Bat-Friendly Austin tourism offerings. |
| 67 | Anchor Partner | publish | 3 | business | 25000 | "$25K to $50K" | Everything in Steward, plus press partnership, logo on major campaigns, VIP bat experience, and category exclusivity. |
| 68 | Bat Ally | draft | 1 | individual | 500 | /yr | Digital badge, directory listing, annual impact report, social recognition. |
| 69 | Bat Steward | draft | 2 | individual | 2500 | /yr | Everything in Ally, plus exclusive decal, featured listing, and seasonal events. |
| 70 | Bat Guardian | draft | 3 | individual | 5000 | /yr | Everything in Steward, plus private bat experiences. |
| 71 | Night Council | trash | 4 | individual | 25000 | "$25K+" | The inner circle. Legacy recognition, private expeditions, category exclusivity. |
| 83 | Individual support of any amount. | publish | 0 | individual | 150 | "Bat Friend" | (no body) |

`devote_url` (all set to the Zeffy link): 65,66,67,83 → `https://www.zeffy.com/en-US/ticketing/bat-city-council`.
Tiers without their own `devote_url` fall back to the site-wide devote URL.

### Experiences (`bcc_experience` → `experiences`)
Fields: `is_signature` (boolean), `cta_text` (string), featured image (thumbnail), body (description).
All 4 published, `menu_order` 1-4.

| id | title | thumb | is_signature | cta_text |
|----|-------|-------|--------------|----------|
| 25 | The Congress Avenue Bridge | 6 (exp-bridge) | – | Plan your visit |
| 26 | Austin Bat Refuge: Private Encounter | 7 (exp-refuge-a) | ✓ | Request access |
| 27 | Beyond the Bridge | 4 (exp-beyond-a) | – | Get in touch |
| 28 | Year-Round Bat Activities | 9 (exp-year-round) | – | Get in touch |

Bodies (verbatim):
- 25: "The iconic experience. Watch 1.5 million Brazilian free-tailed bats emerge from the Congress Avenue Bridge at dusk. Beautiful and unforgettable when viewed from the bridge itself, the trail below, or by boat or kayak on Lady Bird Lake."
- 26: "An exclusive, intimate experience. Meet rescued bats face to face at Austin Bat Refuge, the devoted stewards of Austin's mascot mammal and staple of Bat City culture. Available for devotees of Bat City Council."
- 27: "Explore lesser-known bat roosts and bridges just outside Austin. For the curious and the devoted. Guided by Teresa Nichta."
- 28: "Educational programs, group tours, private events, and conservation experiences, available any time of year. Austin is beautiful year-round. The bats at the bridge may not always be in full capacity, but there are always bats in town!"

### Partners (`bcc_partner` → `partners`)
Fields: `partner_url` (url), featured image (logo, none set yet → text fallback), `menu_order`.

| id | title | status | order |
|----|-------|--------|-------|
| 29 | Visit Austin | publish | 1 |
| 30 | Austin Bat Refuge | publish | 2 |
| 31 | SXSW | publish | 3 |
| 32 | City of Austin | publish | 4 |
| 33 | Austin Convention Bureau | draft | 5 |

### Business Donors (`bcc_business_donor` → `business_donors`)
Fields: `business_donor_url` (url), `business_donor_lat` (number), `business_donor_lng` (number),
featured image (thumbnail). Rendered on a MapLibre map.

| id | title | status | url | lat | lng | thumb |
|----|-------|--------|-----|-----|-----|-------|
| 86 | torchys tacos | publish | https://www.facebook.com/TorchysTacos/ | 30.2454642 | -97.7515802 | 87 (screenshot) |

### Programs (`bcc_program` → `programs`)
Blog-feed-like CPT (title, editor, thumbnail, excerpt). 1 published:
- id 89, "Conservation Media Resources · Rehabilitation Internships · Artist Residencies · Educational Outreach · Strategic Development · Unique Ecotourism Experiences · Inclusive Events", body: "Devotions to Bat City Council support robust culture and harmonious future for bats and humans."

### Pages / Posts
- Pages: Sample Page (publish, default WP), Privacy Policy (draft, default). Home is built from
  block patterns, not a stored page. → In emdash, home is a coded route; keep About/Privacy as pages.
- Posts: only "Hello world!" (default WP). Blog is effectively empty; `programs` is the editorial CPT.

## Site settings (options)
- `blogname` = "Bat City Council"
- `blogdescription` = "Connecting culture, commerce and conservation."
- `bcc_hero_image` = 11 (hero-bridge), `bcc_story_image` = 12 (story-austin),
  `bcc_founder_image` = 10 (founder-teresa), `bcc_closing_image` = 11, `bcc_footer_image` = 11
- `bcc_header_cta_url` = `bcc_stripe_url` = `https://www.zeffy.com/en-US/ticketing/bat-city-council` (Zeffy, NOT Stripe)
- `bcc_footer_copyright` = "© 2026 Bat City Council. Austin, Texas. 501c3 nonprofit, EIN 42-2391354"
- colors/fonts: not overridden → defaults from `config/theme.php` (see design-system.md)

## Media (attachments) — originals available locally
`../bcc-wp/app/wp-content/uploads/2026/04/`: `hero-bridge.jpg`, `story-austin.jpg`,
`founder-teresa.jpg`, `exp-bridge.jpg`, `exp-refuge-a.png`, `exp-refuge-b.jpg`, `exp-beyond-a.jpg`,
`exp-beyond-b.jpg`, `exp-year-round.jpg` (+ WP-generated size variants).
`2026/06/` & `2026/07/`: Bat City Council circle logos. `2026/05`: Torchy's screenshot (donor thumb),
Teresa River Kwai photo.

## Copy note
**No em dashes** in any user-facing copy (hard client rule). The WP theme had an `App\scrub_dashes()`
helper; replicate as a build/lint guard or content rule in the rebuild.
