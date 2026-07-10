# WP customizability → emdash editability mapping

The Bat City Council client is non-technical and must keep the ability to edit everything they could
in the WordPress theme. This maps every WP editable surface (exhaustive audit of
`../bcc-wp/src/themes/bat-city-council/`) to its emdash equivalent, and notes what the rebuild must
provide. Legend for WP storage: **post_content** (block attrs), **CPT** (post+meta), **options**
(wp_options), **theme_mod** (Customizer).

## Custom Gutenberg blocks → emdash equivalent

| WP block | What it edited | emdash equivalent |
|---|---|---|
| `bcc/stat-counter` (inline PlainText: number "1.5M" + label) | 3 story stats | `bcc_site.story.stats[]` (value+label) in the Site Content settings; count-up baked into the Story component |
| `bcc/cycle-node` (inline label/desc + Lucide icon picker) | 3 mission cycle nodes | `bcc_site.mission.nodes[]` (title+body); icons fixed per node in the Mission component |
| `bcc/tier-grid` (CPT placeholder) | devotion tiers from CPT | `tiers` collection (CRUD admin); Devotions component renders business-first |
| `bcc/experience-grid` (CPT placeholder) | experience cards | `experiences` collection; Experiences component |
| `bcc/partner-strip` (CPT placeholder) | partner marquee | `partners` collection; Trust component marquee |
| `bcc/program-feed` (SSR + count RangeControl) | program blog-roll | `programs` collection; feed component (count = `bcc_site` setting) |
| `bcc/business-donor-map` (rich sidebar: marker/theme/density/categories/viewport/zoom + URL resolver) | donor map | `business_donors` collection + `bcc:location` map-picker field (address→lat/lng); DonorMap island. Map marker/theme = `bcc_site.map.*` settings (v1 default dark/hybrid) |

## Block patterns (authored section copy) → emdash equivalent

The WP front page stored the 8 section patterns' copy as editable blocks. In emdash the homepage is a
coded route; **all authored copy moves to the `bcc_site` settings bag** (one "Site Content" surface —
which matches the client's stated preference over scattered editing). Each section's eyebrow, headings,
ledes, CTAs, and body live under `bcc_site.<section>.*` with defaults = the WP copy (see
`packages/bcc/src/settings.ts`). Tiers/experiences/partners/donors/programs are collections.

## Block styles / effects → emdash equivalent

WP let authors toggle per-block: bat separators (3), dusk-veil covers (3), animate/reveal variants (11),
reveal-stagger. **Tradeoff (accepted):** the cinematic effects (starfield, film grain, scroll reveals +
stagger, amber dividers, bat separators, hover, count-up, marquee, parallax) are **baked into the coded
sections** rather than author-toggled per block. The non-technical client edits copy + content + design
tokens; they cannot misplace or break effects. This aligns with "consistency through tokens."

## Site Content admin page (options) → `bcc_site` settings bag + Settings admin page

Every WP `bcc_*` option maps to a `bcc_site` key (edited via the plugin's `admin/settings` route + a
**Settings admin page** the client uses):

| WP option | bcc_site key |
|---|---|
| `bcc_header_cta_label` | `header.ctaLabel` |
| `bcc_header_cta_url` / `bcc_stripe_url` | `integrations.devoteUrl` |
| `bcc_header_sticky` / `bcc_header_transparent` | `header.transparentOnHome` (sticky always on) |
| `bcc_footer_hero_caption` | `footer.caption` |
| `bcc_footer_tagline` | `footer.tagline` |
| `bcc_footer_copyright` | `footer.copyright` |
| `bcc_footer_found_bat_url` | `footer.foundBatUrl` |
| `bcc_social_{instagram,twitter,facebook}` | `social.{instagram,twitter,facebook}` |
| `bcc_hero_image` / `bcc_story_image` / `bcc_founder_image` / `bcc_closing_image` / `bcc_footer_image` | `hero.image` / `story.image` / `founder.image` / `closing.image` / `footer.image` |
| `bcc_hero_video_url` | `integrations.heroVideoUrl` |

## Customizer (colors + fonts) → design settings + CSS custom properties

The 6 brand colors (`bcc_color_*`) and 3 font roles (`bcc_font_*`) map to `bcc_site.design.{colors,fonts}`
(TODO: add this group), emitted as `:root { --bcc-<name>: … }` in Base.astro. The theme tokens already
read those hooks (`var(--bcc-amber, #d4a03c)` etc.), so setting them retint the site live. Font choices
match the WP select lists (display: Cormorant Garamond / Playfair Display / DM Serif Display / Fraunces /
Libre Baskerville; body: EB Garamond / Lora / Libre Baskerville / Source Serif 4; accent: Josefin Sans /
Montserrat / DM Sans / Work Sans). Editing fonts needs those Google fonts loaded (Astro font providers).

## CPT meta, nav, site title

- 6 CPTs → 5 collections (tiers, experiences, partners, business_donors, programs) + built-in posts/pages.
  Meta keys map to fields (see ARCHITECTURE §3). `menu_order` → `order` integer field. Publish/unpublish
  via emdash drafts. Featured image → `image`/`logo` field.
- Nav menu `primary_navigation` → emdash `primary` + `footer` menus (admin → menus).
- Site title `blogname` → emdash SiteSettings.title.

## Rebuild TODO for full parity (folded into Phases 3/4/6)

1. `bcc_site.design` (colors 6 + fonts 3) + emit `:root` custom properties in Base.astro. [Phase 4]
2. Render `social.*` icons in the footer; wire `integrations.heroVideoUrl` (optional hero bg video). [Phase 4]
3. `bcc_site.map` (markerStyle, theme) + program feed `count`. [Phase 4, defaults ok]
4. **Settings admin page** (`@bcc/plugin/admin`) editing the whole `bcc_site` bag grouped like the WP
   Site Content page (chrome, section copy, imagery, design, integrations) + media pickers. [Phase 6]
5. Confirm collections expose publish/unpublish + ordering in emdash admin. [Phase 6]
