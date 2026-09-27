import { defineConfig } from "tsdown";

export default defineConfig([
	// CLI binary: `emdash-plugin`. Bundled to a single .mjs.
	{
		entry: ["src/index.ts"],
		format: ["esm"],
		outExtensions: () => ({ js: ".mjs" }),
		// dts on both builds: rolldown's wasm binding never finishes the second build of an array config that mixes dts and
		// non-dts builds (node 24 with NAPI_RS_FORCE_WASI, tsdown 0.20.3, rolldown 1.0.0-rc.3). The native binding is unaffected.
		dts: true,
		clean: true,
		platform: "node",
		target: "node22",
		shims: false,
	},
	// Programmatic API entry. With tsdown's ESM defaults this emits
	// `.mjs` + `.d.mts` (matching the `exports` field in package.json).
	{
		entry: ["src/api.ts"],
		format: ["esm"],
		dts: true,
		clean: false,
		platform: "node",
		target: "node22",
		external: [
			"@atcute/client",
			"@atcute/identity-resolver",
			"@atcute/lexicons",
			"@atcute/multibase",
			"@atcute/oauth-node-client",
			"@emdash-cms/plugin-types",
			"@emdash-cms/registry-client",
			"@emdash-cms/registry-lexicons",
			"@oslojs/crypto",
			"chokidar",
			"citty",
			"consola",
			"image-size",
			"jsonc-parser",
			"modern-tar",
			"picocolors",
			"tsdown",
			"zod",
		],
	},
]);
