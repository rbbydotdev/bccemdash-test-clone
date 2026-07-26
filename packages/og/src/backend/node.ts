// Node backend: the native napi renderer (multithreaded). Selected by the
// "node" condition of the "#backend" entry in package.json — mirrors how
// takumi-js itself picks backends.
export async function loadBackend() {
	return import("@takumi-rs/core");
}
