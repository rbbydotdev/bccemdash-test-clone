# Vendored emdash patches

`vendor/emdash` is a vendored copy of [emdash-cms/emdash](https://github.com/emdash-cms/emdash),
consumed via `workspace:*`. We extend emdash through native plugins, seed, and the host app —
we patch vendored source only for genuine upstream bugs.

`patch-package` / `pnpm patch` do **not** apply here (emdash resolves via `workspace:*` into the
subtree, not a registry tarball). The subtree itself is the patch layer. Convention:

1. Fix in `vendor/emdash/**` source with a `// BCC PATCH:` comment explaining why.
2. Add a numbered entry below (bug, fix, repro, files).
3. Export the diff for review / upstreaming: `git diff vendor/emdash > patches/NNNN-<slug>.patch`.
4. Rebuild the affected package(s) (`pnpm --filter <pkg> build`) and clear `node_modules/.vite`.
5. Re-apply after any `git subtree pull`.

Candidates known from the prior emdashtv conversion (apply only if hit here):
- **0001 — stale revision keys from deleted fields** break editing/publishing after a field is
  removed. Fix filters revision-derived keys against the collection's current fields.
  Files: `packages/core/src/emdash-runtime.ts`, `packages/core/src/database/repositories/content.ts`.
- **0002 — plugin admin pages `group?`** so grouped pages render as a top-level sidebar section
  (needed for the BCC plugin's `group: "Bat City"`).
  Files: `packages/core/src/plugins/types.ts`, `packages/core/src/astro/integration/runtime.ts`,
  `packages/admin/src/components/Sidebar.tsx`.

## Applied patches

_None yet._
