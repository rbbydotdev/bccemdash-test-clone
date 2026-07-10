# Bat City Council — deployment runbook

> **Never deploy to production without an explicit go-ahead.** Build and verify locally, then wait
> for a clear "ship it." (Deploy discipline, and deploying is outward-facing.)

Production is a **single Cloudflare Worker** (`bat-city-council`) serving the public site, the emdash
admin/API, the BCC plugin routes, static assets, and cron. Dual-target Astro config:

- **default** (local dev / self-host): Node 22 standalone + better-sqlite3 (`apps/site/data/site.db`) + local `uploads/`.
- **`DEPLOY_TARGET=cloudflare`**: Workers + D1 (`DB`) + R2 (`MEDIA`) + KV (`SESSION`) + Images (`IMAGES`).

## Prerequisites
- Node **≥ 22.18** (`.node-version`; `@cloudflare/vite-plugin` needs `node:module` `registerHooks`).
- `corepack pnpm install` (pnpm 11.9).
- A Cloudflare account with Workers, D1, R2, KV enabled, and `wrangler` authenticated (`wrangler login`).

## Steps
```sh
corepack pnpm install
corepack pnpm build:vendor                       # build vendored emdash dist (once + after subtree pulls)
corepack pnpm --filter @bcc/site preview:cf       # OPTIONAL: local workerd smoke test (D1/R2 emulated)
corepack pnpm deploy                              # = build:vendor + DEPLOY_TARGET=cloudflare astro build && wrangler deploy
```
`astro build` emits `dist/server/` (the Worker) and `dist/client/` (assets), plus a merged
`dist/server/wrangler.json`. The **seed schema is inlined at build time** (`package.json#emdash.seed`) —
seed/schema changes require a rebuild + deploy.

## Provisioning (first deploy)
- **D1 `DB`** and **R2 `MEDIA`** auto-provision by name (`database_id` omitted deliberately in `wrangler.jsonc`).
- **KV `SESSION`** has no name-based auto-provisioning: create once and pin the id in `wrangler.jsonc` before a CI deploy:
  ```sh
  wrangler kv namespace create bat-city-council-session   # then paste the id into wrangler.jsonc kv_namespaces[0].id
  ```
- **Images `IMAGES`** needs no provisioning (billed per unique transform).
- **Cron** `* * * * *` (in `wrangler.jsonc`) drives scheduled publishing + plugin cron via `scheduled()`.

## Secrets (`wrangler secret put` from `apps/site/`)
- `EMDASH_ENCRYPTION_KEY` — set before first boot (`emdash secrets generate`).
- `TURNSTILE_SECRET_KEY` — optional; when set, the public enquiry route verifies the Turnstile token
  (pair with `bcc_site.integrations.turnstileSiteKey` on the front end). Absent = skipped (dev).
- `EMDASH_IP_SALT` — optional.

## First boot
1. First request runs core migrations against fresh D1 and applies the **seed schema only**
   (collections/taxonomies/menus, no content).
2. The BCC plugin migrates its `enquiries` table via `_bcc_migrations` on plugin install/activate.
3. Finish setup in a browser at `/_emdash/admin` (site title, then a WebAuthn passkey for the first admin).
   `dev-bypass` returns 403 in production.
4. **Content** is NOT in the seed. Import it after setup:
   ```sh
   EMDASH_URL=https://<your-domain> cd scripts/migrate-wp && corepack pnpm migrate   # needs an admin session
   ```
   (Locally the migration uses dev-bypass; for prod, run against a running instance with an admin PAT or
   export-seed from the local Node instance and redeploy.)

## Migrations
Two independent forward-only tracks, **neither uses `wrangler d1 migrations`**:
- core `_emdash_migrations` (runtime, first request, under an init lock);
- BCC `_bcc_migrations` (plugin install/activate + lazily memoized before the first plugin route query).

## Bundle / plan
Native, in-process plugin (no `worker_loaders`, no sandbox) → the **free Workers plan works**. The base
bundle is comfortably under the free 3 MB gzip limit. MapLibre GL is a client-side island (not in the
Worker bundle). If dynamic OG image generation (Takumi/Satori) is added later, that pushes the bundle
over the free limit and needs Workers Paid.

## CI (recommended)
GitHub Actions (Workers Builds has a pnpm-monorepo defect). Sketch: checkout → `.node-version` → `corepack
pnpm install --frozen-lockfile` → `corepack pnpm build:vendor` → `DEPLOY_TARGET=cloudflare ... build` →
`cloudflare/wrangler-action@v3` with `workingDirectory: apps/site`, `command: deploy`. Gate the deploy job
on an explicit approval.

## Rollback
`wrangler deployments list` + `wrangler rollback [<version-id>]`. Take a D1 export before risky content
migrations: `wrangler d1 export bat-city-council --output backup.sql`.
