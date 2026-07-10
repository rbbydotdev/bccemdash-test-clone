# emdash build reference (condensed from the emdashtv conversion)

emdash = Astro-native CMS (npm pkg `emdash` = `vendor/emdash/packages/core`), runs on Node+SQLite
locally and Cloudflare D1/R2/Workers in prod. Vendored as a git subtree, consumed via `workspace:*`.
Reference implementation: `../emdashtv`. Upstream: https://github.com/emdash-cms/emdash.

## Load-bearing patterns to mirror
- **Root**: `package.json` (`build:vendor` before site build), `.node-version` = 22.18.0,
  `pnpm-workspace.yaml` copies emdash's catalog + `allowBuilds` (better-sqlite3, sharp, esbuild, workerd)
  + supply-chain settings verbatim; workspace globs include `vendor/emdash/packages/*` and
  `.../plugins/*`. `.npmrc` as needed.
- **apps/site**: dual-target `astro.config.mjs` — `DEPLOY_TARGET=cloudflare` switches
  `{adapter:cloudflare(), database:d1({binding:"DB",session:"auto"}), storage:r2({binding:"MEDIA"})}`
  vs Node `{adapter:node(), database:sqlite({url:"file:./data/site.db"}), storage:local({directory:"./uploads", baseUrl:"/_emdash/api/media/file"})}`. CF imports lazy (`await import`). Register
  `emdash({ database, storage, plugins:[...] })` integration + `react()` + `@tailwindcss/vite`.
  - `wrangler.jsonc`: `main:"./src/worker.ts"`, `nodejs_compat`, bindings `DB`(d1, no database_id →
    auto-provision), `MEDIA`(r2), `SESSION`(kv, pin id for CI), `IMAGES`; `triggers.crons:["* * * * *"]`.
  - `src/worker.ts`: `export { default, PluginBridge } from "@emdash-cms/cloudflare/worker";`
  - `src/live.config.ts`: single `_emdash: defineLiveCollection({ loader: emdashLoader() })`.
  - `package.json#emdash.seed = "seed/seed.json"` (schema inlined at build; content NOT in seed).
  - `emdash-env.d.ts` regenerated on dev start → types `getEmDashCollection(slug, …)`.
- **Data access** (Astro pages, from `import … from "emdash"`): `getEmDashCollection(slug, {status,
  limit, where, orderBy})` → `{entries, cacheHint}`; `getEmDashEntry(slug, slug)` → `{entry, cacheHint}`;
  `getTaxonomyTerms`, `getTermsForEntries`, `getEntryTerms`; `getSiteSettings`. `PortableText` from
  `emdash/ui`; `EmDashHead/BodyStart/BodyEnd` + `createPublicPageContext` from `emdash/ui`/`emdash/page`.
  Media on json fields via `MediaRepository` + `getDb()` from `emdash/runtime`.

## seed.json format
Top: `$schema`, `version:"1"`, `meta`, `settings:{title,tagline}`, `collections[]`, `taxonomies[]`,
`menus[]`, `content{}` (schema-only in prod — real content migrated separately).
- **collection** = `{slug,label,labelSingular,description,icon, supports[], commentsEnabled?, fields[]}`.
  `supports`: `"drafts"|"revisions"|"search"|"seo"`.
- **field** = `{slug,label,type, required?, searchable?, defaultValue?, validation?, options?, widget?}`.
  - `type` ∈ string | text | portableText | image | json | number | integer | boolean | select |
    multiSelect | url | reference | datetime.
  - `validation` = `{min,max,options:[enum]}`. `options` = `{collection,placeholder}` (reference) |
    `{taxonomy}` (term-select) | `{placeholder,addLabel}` (string-list).
  - `widget` = `"&lt;pluginId&gt;:&lt;name&gt;"` custom editor (e.g. `travel:gallery`, `field-kit:tags`).
- **taxonomy** = `{name,label,labelSingular,hierarchical,collections[],terms?[]}`.
- **menu** = `{name,label,items:[{type:"custom",label,url}]}`.

## Native plugin contract (packages/&lt;plugin&gt;)
Two exports in `src/index.ts`:
- Build-time descriptor `plugin()` → `{id,version,format:"native",entrypoint,adminEntry,adminPages,
  adminWidgets,options}` (imported by astro.config).
- Runtime `createPlugin()` → `definePlugin({id,version, capabilities:["content:read"|"content:write"|
  "email:send"], admin:{entry,pages,widgets,fieldWidgets}, hooks:{"plugin:install","plugin:activate",
  "cron","page:metadata","email:beforeSend"}, routes:{ "&lt;name&gt;":{public?,handler} } })`; `export default`.
  - Routes mount at `/_emdash/api/plugins/&lt;id&gt;/&lt;name&gt;`; exact-match names, item routes take `?id=`/body id.
  - Public POSTs self-check CSRF header `X-EmDash-Request:1` + rate limit; admin routes get session +
    perms + CSRF from core dispatcher. Dispatcher wraps returns in `{data}`.
  - `adminPages` entry `{path,label,icon,group?}` (`group` needs vendored Sidebar patch 0002 for a
    top-level nav section). Admin registry `src/admin/index.tsx` exports `pages/widgets/fields` maps keyed
    to descriptor paths. Admin uses `@cloudflare/kumo` components + `apiFetch`/`usePagedList` from
    `emdash/plugin-utils`.
- **DB**: own Kysely migrator with private `_&lt;plugin&gt;_migrations` history; forward-only append list;
  memoize "ensured" on `globalThis[Symbol.for(...)]`; NO interactive transactions (D1). Repos = Row type +
  camelCase DTO + hydrator; single-statement conditional insert / `ON CONFLICT … DO UPDATE`. Read core
  content via `ec_&lt;collection&gt;` slices, always filter `locale='en' AND deleted_at IS NULL`. Generic
  `crud.ts` list helper (allowlisted sorts, clamped limits, `{data,total}`).

## theme (packages/theme)
Trivial pkg exporting `./tokens.css`. Tailwind 4 `@theme{}` with brand tokens as
`--color-*: var(--&lt;brand&gt;-*, fallback)` runtime hooks (CMS-settable). App's `src/styles/app.css`:
`@import "tailwindcss"; @import "@hannies/theme/tokens.css";` + font-hook bridge + reduce-motion fallbacks.

## Deploy (ops/DEPLOY.md)
One Worker. `pnpm install` → `build:vendor` → `DEPLOY_TARGET=cloudflare astro build && wrangler deploy`.
D1/R2 auto-provision by name; SESSION KV create-once + pin id; secret `EMDASH_ENCRYPTION_KEY` before first
boot. First request runs core migrations + applies seed schema-only; finish setup in browser (passkey; no
dev-bypass in prod). Content migrated via REST/CLI/export-seed, not the seed file. CI = GitHub Actions
(Workers Builds has a pnpm-monorepo bug). Base bundle ~2.4MB gzip (under free 3MB). **Do not deploy without
explicit user go-ahead** (see user-directives.md).

## Patches (PATCHES.md + patches/*.patch)
Fix vendor bugs in `vendor/emdash` source (HANNIES/BCC PATCH comment) + numbered PATCHES.md entry +
`git diff vendor/emdash > patches/NNNN-*.patch`; `patch-package` doesn't apply (workspace subtree).
Known-relevant from emdashtv: 0001 stale-revision-keys (deleted fields break edit/publish), 0002 plugin
admin-page nav groups (`group?` on PluginAdminPage → top-level sidebar section).
