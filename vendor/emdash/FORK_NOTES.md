# Fork Notes

This is a fork of [emdash](https://github.com/emdash-cms/emdash) maintained at
**[rbbydotdev/emdash](https://github.com/rbbydotdev/emdash)** so customizations can be
shared across projects that vendor emdash.

Every intentional divergence from upstream is logged here — what changed, why, which
files, whether it's covered by tests, and whether it's a candidate to upstream or
fork-only. Keep this list exhaustive: anything not listed here should match upstream.

**Rebuilding:** the built `dist/` is gitignored and produced by `tsdown`. After editing
source, run `pnpm --filter emdash build`.

---

## Changes

### 1. Host-configurable admin CSP — `csp` integration option

**Why.** emdash serves a strict Content-Security-Policy on all `/_emdash` routes and
offers no way for a host app to allow additional sources. Admin UI that embeds external
resources is therefore blocked — e.g. a native field widget that renders a MapLibre map
can't reach its tile host (`connect-src 'self'`) or spawn its web worker (`blob:`, blocked
via the `script-src` fallback). Upstream hardcodes each need (registry, storage) into
`buildEmDashCsp` case-by-case (issues #205/#415/#1343, PR #1979 — the maintainers have
resisted a general mechanism, so this is likely fork-only pending a Discussion).

**What.** A new optional `csp` option on the `emdash()` integration. `buildEmDashCsp()`
takes a third `extra?: EmDashCspConfig` argument and merges per-directive sources: appends
to an existing directive; adds `worker-src` / `font-src` / `frame-src` when absent (seeded
with `'self'`); de-duplicates. With no `csp` config the output is **byte-identical** to
upstream (early return), so existing behavior is unchanged.

```ts
// astro.config.mjs
emdash({ csp: { connectSrc: ["https://tiles.example.com"], workerSrc: ["blob:"] } });
```

Directive keys: `connectSrc`, `workerSrc`, `scriptSrc`, `styleSrc`, `imgSrc`, `fontSrc`,
`frameSrc`. `EmDashCspConfig` is exported from the package.

**Files.**
- `packages/core/src/astro/middleware/csp.ts` — `EmDashCspConfig` type, `mergeCspExtras()`, third `extra` param on `buildEmDashCsp()`.
- `packages/core/src/astro/integration/runtime.ts` — `EmDashConfig.csp` field + re-export of `EmDashCspConfig`.
- `packages/core/src/astro/integration/index.ts` — serializes `csp` into the config virtual module.
- `packages/core/src/astro/middleware/auth.ts` — passes `config.csp` to `buildEmDashCsp()` at both CSP call sites.
- `packages/core/tests/unit/middleware/csp.test.ts` — merge + baseline-unchanged tests.

**Tests.** `pnpm --filter emdash exec vitest run tests/unit/middleware/csp.test.ts` — 23 pass.

**Upstream status.** Net-new; a general mechanism upstream needs a maintainer Discussion
(reference #205/#415/#1343/#1979). Nothing project-specific lives in the fork — consumers
declare their own sources via the option.

> **Note — plugin `csp:sources` hook (tried, removed):** we prototyped a `csp:sources`
> plugin hook + `hooks.csp:register` capability so a plugin could declare its *own* CSP
> needs. It doesn't work: emdash computes the admin CSP on the `/_emdash/admin` document
> request, which doesn't have plugin hooks loaded, so the hook never contributes. This is
> almost certainly *why* upstream keeps CSP sources in config. The hook was removed; the
> `csp` option is the mechanism.

---

## Provenance / to reconcile on upstream sync

Seeded from a vetted emdash subtree (~v0.28.1). When syncing with upstream, re-apply the
change(s) above. Project history also references earlier experiments — verify their status
before assuming:
- A first-run setup → email/password redirect patch — **reverted** to stock (`/_emdash/admin/setup`); not present.
- An admin-sidebar-group tweak (referenced by the consuming plugin) — confirm against
  upstream whether it's a real divergence and, if so, log it above.
