# Backlog

The v1 rebuild is complete and verified (public site, admin editability, migration, tests, builds).
Deferred / polish items, roughly by priority:

## Content / editorial
- **Individual tiers are drafts** (faithful to current prod). Publish Bat Ally / Bat Steward / Bat
  Guardian / Night Council in the admin when the client is ready; the Devotions section renders them
  automatically once published.
- **Search** (`/search`) via emdash FTS over tiers/experiences/programs/posts — not built yet.
- **Comments on blog posts** — the `posts` collection has `commentsEnabled`; wire emdash's comments
  component into `/blog/[slug]`.
- **Program feed on the home page** (the WP theme appended a small program feed) + a `programs feed
  count` setting.

## Design / editability
- **Font switching**: only the three default fonts are preloaded via Astro font providers. Picking an
  alternate in Site Content → Design sets the CSS var but the webfont is not loaded. Add the alternate
  Google fonts (or a dynamic loader) to make font switching fully live. Colors already work live.
- **Donor map controls**: v1 uses a fixed dark/hybrid style. The WP block exposed marker style / theme /
  density / visible layers. Expose a `bcc_site.map` group + wire it into `DonorMap` if wanted.
- **Media picker**: Site Content imagery fields take a media id with a live thumbnail. A full
  media-library modal picker would be friendlier (emdash has a media browser to reuse).
- Minor: a few React "key" warnings surface in the admin dev console (emdash internals / list maps).

## Platform
- **OG images**: v1 ships a static site-default OG. Dynamic per-entry cards (Takumi/Satori) were
  deferred (WASM pushes the bundle over the Cloudflare free limit → Workers Paid). See
  `../emdashtv/packages/og` for the prior implementation if revived.
- **Turnstile**: the enquiry route verifies a token when `TURNSTILE_SECRET_KEY` is set; add the Turnstile
  widget to the contact form when `bcc_site.integrations.turnstileSiteKey` is set.
- **Redirect map**: if the domain moves, populate emdash's redirects table (old WP URLs → new).
- **Deploy to Cloudflare**: runbook in `ops/DEPLOY.md`. Not deployed — awaiting an explicit go-ahead.
