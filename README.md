# Bat City Council

Civic/cultural site + back-office for Bat City Council ("Guardians of Austin's Night Sky"), rebuilt
Cloudflare-native from WordPress.
**Astro + emdash CMS (vendored) · TypeScript · Tailwind v4 · D1/R2/Workers in prod, Node + SQLite locally.**

- `PLAN.md` — scope, 15 architecture decisions, build phases
- `ARCHITECTURE.md` — topology, entity schemas, plugin design, enquiry write path
- `research/` — source analysis (content inventory, design system + effects, emdash reference, directives)
- `ops/DEPLOY.md` — Cloudflare deployment runbook (do not deploy without a go-ahead)

## Layout

```
apps/site/          Astro app: public site + emdash admin + API (one Worker)
packages/bcc/       @bcc/plugin — native emdash plugin: enquiries inbox, contact form,
                    donor map coordinate resolver, site/design settings
packages/theme/     @bcc/theme — "Ritualistic Dusk" design tokens (ported from the WP theme)
vendor/emdash/      git subtree of emdash-cms/emdash — local patches tracked in PATCHES.md
scripts/migrate-wp/ repeatable WordPress → emdash content migration
```

## Development

Node **≥ 22.18** (see `.node-version`), pnpm via corepack.

```sh
corepack pnpm install
corepack pnpm build:vendor        # build vendored emdash packages (once, and after subtree pulls)
corepack pnpm dev                 # Node + SQLite at http://localhost:4321
```

Dev admin login (dev-only): `GET /_emdash/api/setup/dev-bypass?redirect=/_emdash/admin`.
Content lives in `apps/site/data/site.db`; repopulate with `cd scripts/migrate-wp && corepack pnpm migrate`
(reads the latest prod DB dump under `../bcc-wp/backups/` + media from `../bcc-wp/app/wp-content/uploads`).

```sh
corepack pnpm --filter @bcc/plugin test     # domain tests
corepack pnpm --filter @bcc/site typecheck
corepack pnpm --filter @bcc/site preview:cf # build + workerd smoke test (local D1/R2)
corepack pnpm deploy                        # build for Cloudflare + wrangler deploy (ONLY on go-ahead)
```

## How it fits together

Content entities (tiers, experiences, partners, business_donors, programs, posts, pages) are **emdash
collections** seeded from `apps/site/seed/seed.json` — CRUD admin, REST, revisions, drafts
(publish/unpublish), and FTS for free. The one transactional entity (enquiries) is a **plugin table** owned
by `@bcc/plugin` with an independent Kysely migration history and raw parameterized SQL (no ORM). The public
homepage is one immersive, cinematic page (eight scenes with a starfield, film grain, scroll reveals, a
partner marquee, and a business-donor map); all copy and imagery are CMS-editable. Devotions link out to
Zeffy. Admin screens for the back-office mount inside emdash's admin (React 19 + TanStack Router + Kumo).

**Client rules:** no em dashes in user-facing copy; "devotions" not "donations"; business tiers before
individual; publish/unpublish on everything.

## Sign-in options

emdash is passkey-first; this app adds **email + password** on top (no vendored auth changes beyond one
setup-redirect patch):

- **First run (fresh deploy):** visiting `/_emdash/admin` redirects to **`/login`**, which shows a
  WordPress-style "create the first admin" form (email + password, no passkey needed). Passkey setup is
  still available at `/_emdash/admin/setup`.
- **After setup:** sign in at `/login` (email + password) or `/_emdash/admin` (passkey). Any signed-in
  admin can set/replace a password at `/account/password`.

## Agent / API access (no browser)

An automation agent (or CI) can drive the whole site over the API + MCP with a Bearer token, no
passkey/session:

```sh
# 1. set a shared secret (once), then mint an admin token
wrangler secret put BCC_BOOTSTRAP_SECRET          # in apps/site
TOKEN=$(curl -s -X POST -H "x-bootstrap-secret: $SECRET" \
  https://<site>/api/agent-token | jq -r .data.token)

# 2. use it for REST + MCP
curl -H "Authorization: Bearer $TOKEN" https://<site>/_emdash/api/content/tiers
#   MCP endpoint: https://<site>/_emdash/api/mcp  (Authorization: Bearer $TOKEN)

# 3. content migration can use it directly
EMDASH_TOKEN=$TOKEN EMDASH_URL=https://<site> corepack pnpm --dir scripts/migrate-wp migrate
```

`/api/agent-token` is disabled unless `BCC_BOOTSTRAP_SECRET` is set; it creates/uses an admin user
(`agent@…`, override with `BCC_AGENT_EMAIL`) and returns a full-access `ec_pat_*` token. On a fresh site it
also completes setup, so an agent can bootstrap and populate everything unattended.
