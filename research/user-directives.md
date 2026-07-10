# User directives & preferences (carry forward into the BCC rebuild)

From the prior BCC WordPress build (`../bcc-wp` memory + AGENT_NOTES/notes) and the emdashtv rebuild
(`../emdashtv` memory). These are standing rules — honor them here.

## Client-facing rules (Bat City Council)
- **No em dashes** in any user-facing copy. Hard client rule. (WP had `App\scrub_dashes()`.) Use commas,
  periods, or restructure. Applies to all seeded copy and CMS-editable defaults.
- **Language**: "Devotions" not "donations"; "Guardians/Stewards/Allies" not "donors/members"; "Night
  Guardians" = the bats. Tone: ritualistic, cinematic, proud. Brief; every line earns its place.
- **Tier order**: business tiers render BEFORE individual tiers.
- **Payment = Zeffy** (`https://www.zeffy.com/en-US/ticketing/bat-city-council`), not Stripe. Every tier
  "Devote Now" uses the site-wide devote URL unless it has its own.
- **Publish/unpublish must be available for all entities** (from notes). emdash `drafts` support = this.
- Footer legal: "© 2026 Bat City Council. Austin, Texas. 501c3 nonprofit, EIN 42-2391354". Footer caption
  "Guardians of Austin's Night Sky." (client wanted this editable — was hardcoded before).

## Editability (client is non-technical)
- **Chrome (site-wide strings/URLs/images)** → one predictable settings surface (in emdash: options /
  plugin settings schema), NOT scattered. WP used a "Site Content" admin page over the Customizer because
  the Customizer was "colocating and confusing for my client."
- **Design knobs (colors, fonts)** → separate, token-based (never raw hex to the client).
- **Structured lists** (tiers/experiences/partners/business_donors/programs) → collections/CPTs with CRUD.
- **Page-level copy** → editable where it lives (section copy editable; not buried).
- Custom editors must be **obviously editable** (inline, visual searchable pickers, theme color tokens,
  dark editor canvas matching prod). Applies to any custom admin field widgets (e.g. donor map picker).

## Process
- **Never deploy to prod/Cloudflare without an explicit go-ahead.** Build + verify locally, then wait for
  "go". (User once had a render change 500 prod mid-session; sensitive here.) Outward-facing anyway.
- **Verify the actual rendered front-end**, not just that code compiles or the editor works.
- **Repo pattern over ORM** (raw parameterized SQL + CRUD factory); never introduce Drizzle/Prisma unasked.
- **Fix vendored-emdash bugs as tracked patches** (source edit + PATCHES.md + patches/*.patch), never
  data-only workarounds.
- **Use the frontend-design and impeccable skills** for UI work; cloudflare/react/shadcn skills for
  platform/UI. High design quality bar (clone the cinematic look faithfully).
- **Mine interrupted subagent transcripts** before re-planning recovery.
- When work is independent, **parallelize with subagents**.
