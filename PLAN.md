# Bat City Council — Rebuild Plan

Rebuild of the Bat City Council WordPress site (`../bcc-wp`, a Sage 11 / Blade / Tailwind 4 theme on
Wasmer, live at batcitycouncil.org) as a **Cloudflare-native TypeScript app**: emdash CMS (vendored +
extended) · pnpm workspaces · Astro + Tailwind v4 + shadcn · repo pattern (no ORM) · local dev on Node.js ·
deploy to Cloudflare. This mirrors the prior `../1foobar → ../emdashtv` conversion.

Source analysis lives in [`research/`](research/): content inventory (from the latest prod DB dump),
design system + effects spec, emdash build reference, and user directives.

---

## 1. Vision

A civic/cultural institution site for Bat City Council — "Guardians of Austin's Night Sky." Dark,
cinematic, moonlit, ritualistic: standing on the Congress Avenue Bridge at dusk as 1.5M bats take flight.
An immersive single-page homepage of eight "scenes," plus a real back-office (content CRUD, contact
enquiries, a business-donor map) that WordPress gave clumsily. One deployable Worker, one database,
everything TypeScript.

## 2. v1 Scope

### In (parity with the WP site, plus clean additions)

| Area | Parity source | v1 notes |
|---|---|---|
| Devotion tiers | `bcc_tier` CPT (amount, amount_label, tier_type, devote_url) | collection; business-first; per-tier or site-wide Zeffy link; individual perks accordion |
| Experiences | `bcc_experience` CPT (is_signature, cta_text, image) | collection; signature badge; hover-reveal cards |
| Partners | `bcc_partner` CPT (partner_url, logo) | collection; marquee trust bar, text fallback |
| Business donors | `bcc_business_donor` CPT (url, lat, lng, thumb) | collection; MapLibre map island + coordinate-resolver admin field |
| Programs | `bcc_program` CPT (editor, thumb, excerpt) | collection; blog-roll feed on home + `/programs` |
| Posts / Pages / Comments / Media | WP core | emdash built-ins (Portable Text, revisions, drafts, scheduling, FTS, comments, R2 media) |
| Contact / enquiries | WP "Get in touch" mailto | **plugin table** — form → enquiries inbox + email; Turnstile + rate limit |
| Site chrome | WP "Site Content" admin page (options) | emdash options + plugin settings schema (header CTA, footer copy/socials, imagery, devote URL, hero video) |
| Design (colors/fonts) | WP Customizer "Theme Design" | token-based CMS options (never raw hex to client) |
| Design (look) | exact clone of the cinematic WP theme + `../bcc/index.html` | tokens ported verbatim; all effects reproduced, now respecting `prefers-reduced-motion` |

### Out (v2+)

Recurring-devotion checkout in-app (stays external on Zeffy), member/guardian logins, Takumi OG image
generation (WASM pushes the bundle over the Cloudflare free limit → Workers Paid; deferred, noted), CRM
beyond the enquiries inbox, multi-language.

**Devotions (ADR-7):** v1 is request-to-give — every "Devote Now" links out to Zeffy. No payment processor
in the app. The tier records carry `devote_url` so a tier can override the site-wide link.

## 3. Architecture decisions (ADRs)

1. **Single Worker v1.** One Astro app (`apps/site`) with `emdash()` serves the public site,
   `/_emdash/admin`, and `/_emdash/api`. No second admin app, no split state.
2. **Vendor emdash as a git subtree** at `vendor/emdash`, frozen at a known commit (seeded by copying the
   frozen subtree already vetted in `../emdashtv`); copy its pnpm catalog + `allowBuilds` + supply-chain
   settings verbatim; depend on `emdash`, `@emdash-cms/cloudflare`, `@emdash-cms/plugin-field-kit` via
   `workspace:*`. Local patches recorded in `PATCHES.md`.
3. **Repo pattern on Kysely, no ORM.** The one transactional table (enquiries) uses emdash's
   repository/migrator idioms (Kysely runs on both D1 and better-sqlite3). Port skill-studio crud.ts
   *concepts*: allowlisted sorts, composable where clauses, clamped limits, `{data,total}` envelopes.
4. **Content entities are emdash collections** (tiers, destinations→n/a, experiences, partners,
   business_donors, programs + posts and pages built in) — defined via version-controlled seed JSON; each
   gets free CRUD admin, REST, revisions, drafts (publish/unpublish), FTS. **Transactional entities are
   plugin tables** (enquiries) with our own Kysely migrator (`_bcc_migrations`) from the plugin boot hook.
5. **The site is one immersive page.** `/` renders the eight scenes (hero, story, mission, devotions,
   experiences, founder, trust, closing) against anchor ids, preserving the design essence. Secondary
   routes: `/programs` + `/programs/[slug]`, `/blog` + `/blog/[slug]` (posts), `/about`, `/privacy`,
   `/contact`, `/search`, `404`. Contact also available inline (footer / experiences CTA).
6. **Business donors = collection** (title, logo/thumb, url, lat, lng); a MapLibre island plots them; an
   admin field widget resolves an address → lat/lng so the client never types coordinates.
7. **Devotions are external** (Zeffy). Tiers are content; no payment processor in v1 (ADR-2 scope note).
8. **Design precedence:** public site = WP `app.css` `@theme` ported verbatim ("Ritualistic Dusk" tokens:
   night/deep/amber/moon/silver, Cormorant Garamond / EB Garamond / Josefin Sans). Admin extensions use
   emdash's Kumo design system to look native (dual design system accepted: admin=Kumo, site=shadcn).
9. **Effects are first-class.** Starfield canvas, preloader, per-section film grain, reveal-on-scroll with
   stagger, count-up stats, trust marquee, hero parallax, tier hover/accordion, experience hover, mission
   cycle, sticky/transparent header + mobile overlay, bat separators — all ported and all gated by
   `prefers-reduced-motion` (a gap in the original we fix).
10. **Configurable design & chrome** via emdash options + plugin settings schema: copy strings + images
    editable in CMS; colors/fonts as tokens in one CSS file (parity with WP Customizer's font/color knobs).
11. **Enquiries plugin:** public POST route (Turnstile + rate limit) → enquiries table + admin inbox
    screen; notification email via emdash email hooks (console/Mailpit in Node dev, `send_email` in prod).
    Same plugin owns the settings schema (devote URL, map style/config).
12. **i18n: en-only v1**, but every custom `ec_*` query filters `locale = 'en'` (correctness rule).
13. **No em dashes** in any user-facing copy (hard client rule) — enforced by a content lint/build guard.
14. **Publish/unpublish everywhere** via emdash `drafts` support on every collection (client asked for it).
15. **CI/deploy:** GitHub Actions per-app `wrangler deploy`; D1/R2 auto-provision by name. **Never deploy
    without an explicit user go-ahead** (deploy discipline; outward-facing).

## 4. Monorepo layout

```
bccemdash/
├── pnpm-workspace.yaml        # apps/*, packages/*, vendor/emdash/packages/*(+plugins)
├── PLAN.md  ARCHITECTURE.md  README.md  PATCHES.md
├── vendor/emdash/             # git subtree of emdash-cms/emdash (frozen commit)
├── apps/
│   └── site/                  # Astro + emdash() — public site + admin + API, one Worker
│       ├── astro.config.mjs   # dual-target (Node | Cloudflare) + emdash({ plugins:[bccPlugin(), fieldKit] })
│       ├── wrangler.jsonc     # D1 + R2 + KV(session) + Images + cron
│       ├── seed/seed.json     # collections: tiers, experiences, partners, business_donors, programs, posts, pages
│       └── src/pages/         # index (single page) + programs/blog/about/contact/search/404
├── packages/
│   ├── bcc/                   # @bcc/plugin — native emdash plugin:
│   │   ├── src/index.ts       #   bccPlugin() descriptor + createPlugin() (definePlugin)
│   │   ├── src/db/            #   Kysely migrator + migration + enquiries repo
│   │   ├── src/routes/        #   public enquiry POST, admin enquiries CRUD
│   │   ├── src/admin/         #   Enquiries inbox page + donor coordinate-resolver field
│   │   └── src/services/      #   emails, rate-limit
│   └── theme/                 # @bcc/theme — "Ritualistic Dusk" tokens (@theme CSS)
├── scripts/
│   └── migrate-wp/            # WP dump → emdash content + media import (repeatable)
└── research/                  # source analysis + design + emdash reference + directives
```

## 5. Build phases

1. **Scaffold** — git init, subtree-add emdash (from the vetted `../emdashtv` copy), workspace wiring,
   `apps/site` dual-target, `@bcc/theme` + `@bcc/plugin` skeletons; boots on Node (`astro dev`) and workerd.
2. **Domain** — seed.json collections (with `drafts`); bcc plugin: enquiries migrator + repo + public route
   (Turnstile + rate limit) + admin routes + settings schema; site settings/options.
3. **Theme + public site** — port `app.css` tokens into `@bcc/theme`; build the single-page home (eight
   scenes) + header/nav/footer + all effects; programs/blog/about/contact/search/404; business-donor map.
   Use frontend-design + impeccable skills; mobile-responsive; reduce-motion safe.
4. **Admin** — enquiries inbox, donor coordinate-resolver field, settings screen, confirm publish/unpublish;
   Kumo components.
5. **Migrate content** — transform the latest prod DB dump (tiers/experiences/partners/business_donors/
   programs/posts/pages, preserving statuses + order + meta + Zeffy URLs) and import media from
   `../bcc-wp/app/wp-content/uploads`; wire settings (footer copyright + EIN, images, devote URL).
6. **Verify + deploy** — vitest (enquiries repo), typecheck, build, run locally, visual comparison vs
   `../bcc/index.html` and prod at 1440/390, e2e contact flow. `wrangler deploy` **only on go-ahead**.

## 6. Deliberately deferred / needs confirmation

- Cloudflare plan: free plan OK (native plugin, no `worker_loaders`). OG-via-Takumi would need Paid.
- OG image generation: v1 ships a static site-default OG; dynamic cards deferred (see `../emdashtv/packages/og`).
- WP URL → new URL redirect map (emdash has a redirects table): write during phase 5 if the domain moves.
- In-app recurring devotions (Stripe/checkout): out; stays on Zeffy.
