# emdash-auth

Drop-in **email + password sign-in**, **WordPress-style first-admin bootstrap**, and a **secret-gated agent API-token** endpoint for any [emdash](https://github.com/emdash-cms/emdash) + Astro site.

emdash is passwordless by design (passkeys / magic-link / OAuth). This package layers a password credential on top — stored in its own `_auth_user_passwords` table and verified against emdash's existing `users` — without removing any of the passwordless flows. It's one Astro integration: add it to `astro.config`, done.

## Why

- **First run should just work.** On a brand-new deploy there's no admin yet. `/login` becomes a "create the first admin" screen (email + password, no passkey required), exactly like WordPress's install screen. It's strictly gated on *no users exist*, so it can never take over a configured site.
- **Password sign-in for humans.** Anyone who prefers a password over a passkey can set one at `/account/password` and sign in at `/login`.
- **Zero-touch access for agents.** Set one secret and an automation agent can `POST` for a full-access admin API token (`ec_pat_*`) and drive the REST API + MCP with `Authorization: Bearer …` — no browser, no passkey.

## Install

This is a workspace package (`"emdash-auth": "workspace:*"`). Then:

```js
// astro.config.mjs
import { defineConfig } from "astro/config";
import emdash from "emdash/astro";
import { passwordAuth } from "emdash-auth";

export default defineConfig({
  output: "server",
  integrations: [
    emdash({ database, storage, plugins: [/* ... */] }),
    passwordAuth({ siteName: "My Site" }),
  ],
});
```

That's it — the integration injects the routes, the pages, and the DB migration runs lazily on first use. It also registers the agent-token secret env vars, so `getSecret()` resolves portably on both the Node and Cloudflare adapters (`Astro.locals.runtime.env` was removed in Astro v6 and throws on workerd).

## What it adds

| Path | What |
| --- | --- |
| `GET /login` | Sign-in form; first-admin bootstrap when no user exists yet |
| `GET /account/password` | Authed "set / change my password" page |
| `POST /api/auth/login` | Verify email + password, set the session |
| `POST /api/auth/set-password` | Set the signed-in user's password |
| `POST /api/auth/bootstrap` | Create the first admin (gated on zero users) |
| `POST /api/auth/agent-token` | Mint an agent API token (secret-gated) |

All endpoints accept JSON (fetch) **and** a form POST (no-JS fallback).

## Options

```ts
passwordAuth({
  siteName: "My Site",                 // page titles + default emdash site_title on bootstrap
  loginPath: "/login",                 // sign-in / first-run page
  accountPasswordPath: "/account/password",
  loginRedirect: "/_emdash/admin",     // where to go after login/bootstrap
  apiBase: "/api/auth",                // base for the JSON endpoints
  pages: true,                         // inject built-in pages; false if you ship your own
  agentTokens: true,                   // inject the agent-token endpoint
  secretEnv: "EMDASH_AGENT_SECRET",    // env var gating agent-token issuance
  agentEmailEnv: "EMDASH_AGENT_EMAIL", // env var for the default agent email
  defaultAgentEmail: "agent@localhost",
  accent: "#4f46e5",                   // accent color for the built-in pages
});
```

The built-in pages are intentionally minimal and self-contained (no host-layout dependency). To match your theme, ship your own page at `loginPath` / `accountPasswordPath` and set `pages: false` so the generic ones aren't injected (two routes at the same path collide). The JSON endpoints and server helpers are what matter; the pages are just a convenience.

## Agent tokens

Set the secret (unset = endpoint disabled):

```bash
# local: .env  ·  Cloudflare: wrangler secret put EMDASH_AGENT_SECRET
EMDASH_AGENT_SECRET=some-long-random-string
```

Mint a token:

```bash
curl -X POST https://your-site/api/auth/agent-token \
  -H "content-type: application/json" \
  -H "x-agent-secret: some-long-random-string" \
  -d '{"email":"agent@your-site"}'
# → { "data": { "token": "ec_pat_…", "scopes": [...], "usage": { "rest": "...", "mcp": "…/_emdash/api/mcp" } } }
```

Then drive the site:

```bash
curl https://your-site/_emdash/api/content/... -H "Authorization: Bearer ec_pat_…"
```

On a fresh site the first call also creates the admin user and marks emdash setup complete, so an agent can stand up a site end-to-end. Re-minting is idempotent (the prior `agent-token` row is replaced).

## Server helpers

For custom routes, import from `emdash-auth/server`: `verifyLogin`, `saveUserPassword`, `needsBootstrap`, `bootstrapAdmin`, `issueAgentToken`, `issueTokenFor`, `secretsMatch`, `markSetupComplete`, `passwordProblem`. All resolve the DB via emdash's runtime `getDb()` (works on the anonymous fast path where `locals.emdash.db` is unset).

## First-run redirect (optional)

To send first-time visitors of the emdash admin to `/login` instead of the built-in setup wizard, either apply a one-line patch to emdash core's setup middleware (redirect `/_emdash/admin/setup` → `/login`) or add your own middleware. This package deliberately doesn't patch core — `/login` works standalone; the redirect is a nicety.

## Storage

- `_auth_user_passwords` — one row per user (`user_id`, `password_hash`), owned by this package.
- `_auth_user_passwords` migration tracked in `_emdash_auth_migrations`, run lazily (D1-safe, no interactive transactions).
- Passwords hashed with PBKDF2-HMAC-SHA256 (210k iterations) via Web Crypto — identical on Node and Workers.
- Agent tokens use emdash's own `_emdash_api_tokens` format (`ec_pat_…`, `base64url(SHA-256(raw))`), so core's `resolveApiToken` accepts them.
