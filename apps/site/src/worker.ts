// Worker entry: Astro's fetch handler plus EmDash's scheduled() handler, which
// the Cron Trigger in wrangler.jsonc drives. PluginBridge is the sandbox
// Durable Object, re-exported so its binding resolves (unused while we have no
// sandboxed plugins, but harmless).
export { default, PluginBridge } from "@emdash-cms/cloudflare/worker";
