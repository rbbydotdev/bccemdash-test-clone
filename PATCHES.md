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

The vendored `vendor/emdash` was seeded from the vetted copy used in the prior emdash conversion, so
it already carries two source patches (marked with `HANNIES PATCH` comments in the vendored files). We
rely on both; keep them across any future `git subtree pull`.

- **0001 — stale revision keys from deleted fields.** After a field is removed from a collection,
  entries with older draft/live revisions became uneditable/unpublishable. The fix filters
  revision-derived keys against the collection's *current* fields.
  Files: `vendor/emdash/packages/core/src/emdash-runtime.ts` (`hydrateDraftData`),
  `vendor/emdash/packages/core/src/database/repositories/content.ts` (`syncDataColumns`).

- **0002 — plugin admin pages `group?`.** Adds an optional `group` to `PluginAdminPage` so grouped
  pages render as their own top-level sidebar section. **The BCC plugin depends on this**: its admin
  pages declare `group: "Bat City"` (`packages/bcc/src/index.ts`), which lifts "Site Content" and
  "Enquiries" into a top-level "Bat City" section instead of the bottom "Plugins" area.
  Files: `vendor/emdash/packages/core/src/plugins/types.ts`,
  `vendor/emdash/packages/core/src/astro/integration/runtime.ts`,
  `vendor/emdash/packages/admin/src/components/Sidebar.tsx`.

### BCC-specific patches

- **0003 — first-run setup routes to the email+password screen.** emdash is passkey-first: its setup
  middleware redirects an unconfigured `/_emdash/admin` to the passkey wizard at `/_emdash/admin/setup`.
  The client wants a WordPress-style email+password admin, so we redirect first-run setup to our own
  `/login` screen instead (which shows the first-admin bootstrap form when no user exists). The passkey
  wizard is untouched and still reachable directly at `/_emdash/admin/setup` for anyone who prefers it.
  File: `vendor/emdash/packages/core/src/astro/middleware/setup.ts` (three `context.redirect` targets).
  Rebuild `emdash` after applying (`pnpm --filter emdash build`). See `patches/0003-*.patch`.

Add new entries here (and export `patches/NNNN-*.patch`) as needed.
