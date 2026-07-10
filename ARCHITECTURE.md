# Bat City Council — Architecture

Companion to [PLAN.md](PLAN.md). File references like `vendor/emdash/packages/core/...` point into the
vendored emdash subtree; the emdash build patterns are captured in
[`research/emdash-reference.md`](research/emdash-reference.md).

## 1. Topology

```
                    ┌──────────────────────────────────────────────┐
                    │  apps/site — ONE Astro app / ONE Worker      │
  visitors ──────▶  │  src/pages/**        public site (Astro +    │
                    │                      React islands, shadcn)  │
  staff ─────────▶  │  /_emdash/admin/**   admin SPA (React 19 +   │
                    │                      TanStack Router/Query)  │
  API/forms ─────▶  │  /_emdash/api/**     REST + plugin routes    │
                    └───────┬──────────────────────┬───────────────┘
                            │ Kysely               │ Storage
              ┌─────────────┴───────────┐   ┌──────┴─────────┐
   local dev: │ better-sqlite3 (data/)  │   │ local uploads/ │
   Cloudflare:│ D1 (session:"auto")     │   │ R2 (MEDIA)     │
              └─────────────────────────┘   └────────────────┘
```

- **Local dev:** `astro dev` with `@astrojs/node` + `sqlite()` + `local()` storage. No Cloudflare account.
- **Prod:** `@astrojs/cloudflare`; `src/worker.ts` re-exports `@emdash-cms/cloudflare/worker` (fetch +
  `scheduled()` cron). Bindings: `DB` (D1), `MEDIA` (R2), `SESSION` (KV), `IMAGES`, cron `* * * * *`.
  **No `worker_loaders`** — the bcc plugin is native/in-process, so the free plan works.
- Core migrations + seed schema auto-apply on first request; the bcc plugin's `enquiries` table migrates
  from its boot/install hook with an independent `_bcc_migrations` history.

## 2. Workspace

pnpm workspaces; `apps/*`, `packages/*`, `vendor/emdash/packages/*` (+ `.../plugins/*`). Catalog +
`allowBuilds` (better-sqlite3, sharp, esbuild, workerd) + supply-chain settings copied verbatim from
`vendor/emdash/pnpm-workspace.yaml`. Node ≥ 22.18. Our packages depend on `emdash`,
`@emdash-cms/cloudflare`, `@emdash-cms/plugin-field-kit` via `workspace:*`. Vendored packages build with
tsdown before the site: `pnpm run build:vendor`.

## 3. Content model (emdash collections — free CRUD admin, REST, revisions, drafts, FTS)

Defined in `apps/site/seed/seed.json` (idempotent, version-controlled; schema auto-applies on first boot
via `package.json#emdash.seed`). Every `ec_*` table carries system columns (`id` ULID, `slug`, `status`
draft|published|scheduled, `locale`, `deleted_at`, `version`, …). **Rule: every custom query on `ec_*`
filters `locale='en'` and `deleted_at is null`.** All collections `supports: ["drafts", ...]` →
publish/unpublish for the client.

### `tiers` (parity with WP `bcc_tier`)
| field | type | notes |
|---|---|---|
| title | string, required, searchable | |
| statement | text, searchable | the card blurb (WP body) |
| amount | number | e.g. 2500 |
| amount_label | string | "/yr", "$25K to $50K", "Bat Friend" |
| tier_type | select (individual/business) | business renders first |
| devote_url | url | overrides site-wide Zeffy link |
| menu_order | integer | sort within group (from WP `menu_order`) |

### `experiences` (parity with WP `bcc_experience`)
title (string, req), description (text), image (image), is_signature (boolean), cta_text (string),
menu_order (integer). Signature → gold badge.

### `partners` (parity with WP `bcc_partner`)
title (string, req), logo (image), partner_url (url), menu_order (integer). No logo ⇒ text fallback in the
marquee.

### `business_donors` (parity with WP `bcc_business_donor`)
title (string, req), logo (image), business_url (url), lat (number), lng (number, `bcc:location` widget →
address resolver), menu_order (integer). Plotted on the MapLibre map.

### `programs` (parity with WP `bcc_program`)
title (string, req, searchable), excerpt (text), body (portableText), image (image), menu_order (integer).
Blog-roll style feed.

### `posts`, `pages`
Seeded like emdash's blog template (title, excerpt, body portableText, featured image; category/tag
taxonomies on posts; `commentsEnabled` on posts). Comments = emdash built-in (Turnstile, moderation inbox).

### Home section copy
Hero / story / mission / founder / closing copy strings + the three story stats live as **site options**
(editable in CMS) with sensible defaults seeded from the WP copy (see `research/content-inventory.md` and
`../bcc-wp/.../DESIGN.md`). Images referenced by the imagery settings (hero, story, founder, closing,
footer).

## 4. Transactional model (plugin table — NOT a collection)

Owned by `@bcc/plugin`, migrated by our own Kysely `Migrator` (`_bcc_migrations`) invoked from plugin
`plugin:install`/`plugin:activate` (idempotent, memoized on `globalThis[Symbol.for("bcc:migrations")]`);
repository follows emdash's `content.ts` idioms + skill-studio crud.ts concepts.

```sql
enquiries (
  id TEXT PK,                 -- ULID
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  subject TEXT,               -- experience/tier interest, optional
  source TEXT,                -- which CTA/section (e.g. 'experience:refuge', 'contact')
  status TEXT NOT NULL DEFAULT 'new',   -- new|replied|closed|spam
  ip TEXT, user_agent TEXT,             -- for spam triage
  created_at TEXT, updated_at TEXT
)  -- index: (status, created_at)
```

**Write path (no interactive tx on D1):** single parameterized `INSERT`. Public POST runs
`requireMethod → requireCsrfHeader (X-EmDash-Request) → rate limit (core _emdash_rate_limits, e.g. 5/10min
per IP) → Turnstile verify (prod) → validate → insert → email notify`. Works identically on better-sqlite3
and D1. No transactions.

## 5. The bcc plugin (`packages/bcc`, native — in-process, no sandbox)

```ts
// registered in astro.config.mjs: plugins: [bccPlugin(), fieldKitPlugin()]
definePlugin({
  id: "bcc", version: "0.1.0",
  capabilities: ["content:read", "email:send"],
  admin: {
    entry: "@bcc/plugin/admin",
    pages:  [{ path: "/enquiries", label: "Enquiries", icon: "envelope", group: "Bat City" }],
    widgets:[{ id: "recent-enquiries", title: "Recent Enquiries", size: "half" }],
    fieldWidgets: [{ name: "location", label: "Map Location", fieldTypes: ["json"] }],  // bcc:location
  },
  hooks: {
    "plugin:install":  runBccMigrations,
    "plugin:activate": runBccMigrations,
    "email:beforeSend": brandEmailTemplates,
  },
  routes: {
    "enquiries":            { public: true, handler: publicEnquiryHandler },  // POST create (Turnstile+rate)
    "admin/enquiries":      { handler: adminEnquiriesHandler },               // GET list
    "admin/enquiries/item": { handler: adminEnquiryItemHandler },            // GET/PATCH one
    "admin/geocode":        { handler: adminGeocodeHandler },                // address → lat/lng (donor field)
  },
  admin: { settingsSchema: { devote_url, map_style, map_center, turnstile_site_key, notification_email } },
})
```

- Admin pages use **Kumo** components + `apiFetch`/`usePagedList` (`emdash/plugin-utils`) — native inside
  emdash's admin. Route guards: admin/* require session + perms from the core dispatcher.
- Public site never imports the plugin's server code directly; Astro pages call
  `getEmDashCollection("tiers", …)` etc. for content and the plugin's public route for enquiry POSTs
  (island fetch, with a `src/server.ts` `submitEnquiry()` in-process fallback for a no-JS `<form>` POST).
- Emails: enquiry-received (admin) through emdash email hooks — `send_email` in prod, console/Mailpit dev.
- The `bcc:location` field widget renders a small map + address search (geocode via `admin/geocode`) so the
  client sets a business donor's pin without typing coordinates.

## 6. Public site (`apps/site/src/pages`)

Astro pages + React/vanilla islands (shadcn/Tailwind v4), tokens from `@bcc/theme` (WP `app.css` `@theme`
ported verbatim — night `#0A0E1A`, deep `#111833`, amber `#D4A03C`, amber-light `#E8C060`, moon `#C8D0E0`,
silver `#8892A8`; Cormorant Garamond headings, EB Garamond body (20px baseline), Josefin Sans tracked
labels; `cubic-bezier(0.16,1,0.3,1)` motion; fluid `clamp()` section spacing; film-grain overlay).

| Route | Content | Notes |
|---|---|---|
| `/` | the eight scenes | hero, story (+3 stats), mission (cycle), devotions (business-first tiers + individual accordion), experiences (hover cards), founder, trust (partner marquee + optional donor map), closing CTA; all copy CMS-editable |
| `/programs`, `/programs/[slug]` | `programs` collection | editorial feed; also a small feed block on home |
| `/blog`, `/blog/[slug]` | `posts` collection | comments enabled |
| `/about`, `/privacy` | `pages` | |
| `/contact` | enquiry form | also inline via footer / experience CTAs |
| `/search` | emdash FTS (programs + posts + experiences) | |
| 404 | net-new from tokens | |

**Interactive islands / scripts:** starfield canvas, preloader, reveal-on-scroll (IntersectionObserver +
stagger), count-up stats, trust marquee (CSS), hero parallax, tier accordion, mobile menu + sticky header,
business-donor MapLibre map, enquiry form (fetch + no-JS fallback). Everything gated on
`prefers-reduced-motion`. Section anchors (`#story`, `#mission`, …) drive smooth-scroll nav.

## 7. Verification

- Repo-level vitest for the enquiries repo + rate-limit (both SQLite and D1 dialects via Kysely).
- Playwright e2e: contact/enquiry submission → admin inbox; effects smoke (starfield present, reveals fire).
- Visual: side-by-side of `/` against `../bcc/index.html` and prod at 1440/390.
- `wrangler deploy` from CI (GitHub Actions), D1/R2 auto-provision; **only on explicit go-ahead**.

## 8. What changes vs the emdashtv reference

Lighter transactional layer (no bookings/availability/clients — just enquiries), heavier front-end effects
(cinematic single-page vs multi-page travel site). Business donors + programs are content collections
unique to BCC. Payment is external (Zeffy) so there is no checkout/payment ADR. Same emdash foundation,
same dual-target Astro config, same native-plugin + Kysely-migrator + Kumo-admin patterns.
