# Fork Notes

This is a fork of [emdash](https://github.com/emdash-cms/emdash) maintained at
**[rbbydotdev/emdash](https://github.com/rbbydotdev/emdash)** so customizations can be
shared across projects that vendor emdash.

Every intentional divergence from upstream is logged here — what changed, why, which
files, whether it's covered by tests, and whether it's a candidate to upstream or
fork-only. Keep this list exhaustive: anything not listed here should match upstream.

**Rebuilding:** the built `dist/` is gitignored and produced by `tsdown`. After editing
source, rebuild the affected package(s): `pnpm --filter @emdash-cms/plugin-types build`
then `pnpm --filter emdash build`.

---

## Changes

### 1. Host- and plugin-configurable admin CSP

**Why.** emdash serves a strict Content-Security-Policy on all `/_emdash` routes and
offers no way for a host app *or* a plugin to allow additional sources. Admin UI that
embeds external resources is therefore blocked — e.g. a native field widget that renders
a MapLibre map can't reach its tile host (`connect-src 'self'`) or spawn its web worker
(`blob:`, blocked via the `script-src` fallback). Upstream has no CSP hook, capability,
or config; it hardcodes each need (registry, storage) into `buildEmDashCsp` case-by-case
(see issues #205/#415/#1343 and PR #1979 — the maintainers have resisted a general
mechanism, so this is likely fork-only pending a Discussion).

Two complementary entry points, both additive (with neither, output is **byte-identical**
to upstream):

**(a) `csp` integration option** — an app-level escape hatch:
```ts
emdash({ csp: { connectSrc: ["https://tiles.example.com"], workerSrc: ["blob:"] } })
```

**(b) `csp:sources` plugin hook** — the clean path: a plugin declares its *own* CSP needs
(gated by the new `hooks.csp:register` capability), so the map field and its CSP travel
together:
```ts
definePlugin({
  capabilities: ["hooks.csp:register"],
  hooks: { "csp:sources": () => ({ connectSrc: ["https://tiles.example.com"], workerSrc: ["blob:"] }) },
})
```

**How.** `buildEmDashCsp(registry, storageEndpoint, extra?)` gained a third arg that merges
per-directive sources (appends to existing directives; adds `worker-src`/`font-src`/
`frame-src` when absent, seeded with `'self'`; de-duplicates). The auth middleware collects
every active plugin's `csp:sources` contribution via `HookPipeline.runCspSources()`, merges
it with the app-level `csp` config (`mergeCspConfigs`), and passes the result to
`buildEmDashCsp`. The hook runs only when a plugin registers it (`hasHooks` guard), so the
common case is near-zero cost.

**Files.**
- `packages/plugin-types/src/index.ts` — `hooks.csp:register` capability + `DeclaredAccess.csp` + both `declaredAccess`↔capabilities conversions.
- `packages/core/src/plugins/types.ts` — `EmDashCspConfig` type (home), `CspSourcesHandler`, `PluginHooks["csp:sources"]`, `ResolvedPluginHooks["csp:sources"]`.
- `packages/core/src/plugin-types.ts` — `HookHandlers["csp:sources"]`.
- `packages/core/src/plugins/hooks.ts` — `HookNameV2`/`HookHandlerMap` entries, hook→capability map, `runCspSources()`.
- `packages/core/src/plugins/manifest-schema.ts` — capability + hook-name enums.
- `packages/core/src/plugins/define-plugin.ts` — capability allowlist.
- `packages/core/src/astro/middleware/csp.ts` — `mergeCspExtras`, `mergeCspConfigs`, third `extra` param on `buildEmDashCsp`; re-exports `EmDashCspConfig`.
- `packages/core/src/astro/integration/runtime.ts` — `EmDashConfig.csp` + re-export.
- `packages/core/src/astro/integration/index.ts` — serializes `csp` into the config virtual module.
- `packages/core/src/astro/middleware/auth.ts` — `resolveAdminCsp()` (config + hook merge) at both CSP call sites.
- `packages/core/tests/unit/middleware/csp.test.ts` — merge + baseline-unchanged tests.

**Tests.** `pnpm --filter emdash exec vitest run tests/unit/middleware/csp.test.ts`.

**Upstream status.** Net-new; a general mechanism upstream needs a maintainer Discussion
(reference #205/#415/#1343/#1979). Nothing project-specific lives in the fork — consumers
declare their own sources via the option or the hook.

---

## Provenance / to reconcile on upstream sync

Seeded from a vetted emdash subtree (~v0.28.1). When syncing with upstream, re-apply the
change(s) above. Project history also references earlier experiments — verify their status
before assuming:
- A first-run setup → email/password redirect patch — **reverted** to stock (`/_emdash/admin/setup`); not present.
- An admin-sidebar-group tweak (referenced by the consuming plugin) — confirm against
  upstream whether it's a real divergence and, if so, log it above.
