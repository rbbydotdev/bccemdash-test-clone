// workerd backend: the WASM renderer. "@takumi-rs/wasm/auto" resolves (via its
// own "workerd" condition) to a module that default-exports the compiled
// WebAssembly.Module — wrangler and the Cloudflare vite plugin both import
// .wasm natively. init() is guarded, so repeat calls are cheap.
import init from "@takumi-rs/wasm";
import autoModule from "@takumi-rs/wasm/auto";

export async function loadBackend() {
	await init({ module_or_path: autoModule as never });
	return import("@takumi-rs/wasm");
}
