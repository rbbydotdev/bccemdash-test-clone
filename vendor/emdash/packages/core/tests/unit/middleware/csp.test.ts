import { afterEach, describe, it, expect, vi } from "vitest";

import {
	buildEmDashCsp,
	getConfiguredStorageEndpoint,
	mergeCspConfigs,
} from "../../../src/astro/middleware/csp.js";

describe("buildEmDashCsp", () => {
	it("includes https: in img-src to allow external images", () => {
		const csp = buildEmDashCsp();
		const imgSrc = csp.split("; ").find((d) => d.startsWith("img-src"));
		expect(imgSrc).toContain("https:");
	});

	it("still includes self, data:, and blob: in img-src", () => {
		const csp = buildEmDashCsp();
		const imgSrc = csp.split("; ").find((d) => d.startsWith("img-src"));
		expect(imgSrc).toContain("'self'");
		expect(imgSrc).toContain("data:");
		expect(imgSrc).toContain("blob:");
	});

	it("keeps connect-src restricted to self", () => {
		const csp = buildEmDashCsp();
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe("connect-src 'self'");
	});

	it("allows the configured registry aggregator origin in connect-src", () => {
		const csp = buildEmDashCsp({ aggregatorUrl: "https://registry.emdashcms.com/xrpc" });
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe("connect-src 'self' https://registry.emdashcms.com");
	});

	it("allows shorthand registry URLs in connect-src", () => {
		const csp = buildEmDashCsp("https://registry.emdashcms.com");
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe("connect-src 'self' https://registry.emdashcms.com");
	});

	it("allows the configured storage endpoint origin in connect-src", () => {
		const csp = buildEmDashCsp(undefined, "https://xxx.r2.cloudflarestorage.com");
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe("connect-src 'self' https://xxx.r2.cloudflarestorage.com");
	});

	it("ignores a storage endpoint that isn't http(s)", () => {
		const csp = buildEmDashCsp(undefined, "file:///tmp/uploads");
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe("connect-src 'self'");
	});

	it("ignores a malformed storage endpoint", () => {
		const csp = buildEmDashCsp(undefined, "not a url");
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe("connect-src 'self'");
	});

	it("allows both the registry and storage endpoint origins together", () => {
		const csp = buildEmDashCsp(
			"https://registry.emdashcms.com",
			"https://xxx.r2.cloudflarestorage.com",
		);
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe(
			"connect-src 'self' https://registry.emdashcms.com https://xxx.r2.cloudflarestorage.com",
		);
	});

	it("does not duplicate the origin when storage endpoint and registry share it", () => {
		const csp = buildEmDashCsp("https://shared.example.com", "https://shared.example.com/bucket");
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe("connect-src 'self' https://shared.example.com");
	});

	it("blocks framing with frame-ancestors none", () => {
		const csp = buildEmDashCsp();
		expect(csp).toContain("frame-ancestors 'none'");
	});

	it("leaves the policy unchanged for an empty extra-sources config", () => {
		expect(buildEmDashCsp(undefined, undefined, {})).toBe(buildEmDashCsp());
	});

	it("appends host-provided sources to connect-src", () => {
		const csp = buildEmDashCsp(undefined, undefined, {
			connectSrc: ["https://tiles.openfreemap.org"],
		});
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe("connect-src 'self' https://tiles.openfreemap.org");
	});

	it("adds a worker-src directive (seeded with self) when configured", () => {
		const csp = buildEmDashCsp(undefined, undefined, { workerSrc: ["blob:"] });
		const workerSrc = csp.split("; ").find((d) => d.startsWith("worker-src"));
		expect(workerSrc).toBe("worker-src 'self' blob:");
	});

	it("merges extra sources on top of registry + storage origins without duplicating", () => {
		const csp = buildEmDashCsp("https://registry.emdashcms.com", undefined, {
			connectSrc: ["https://registry.emdashcms.com", "https://tiles.openfreemap.org"],
		});
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe(
			"connect-src 'self' https://registry.emdashcms.com https://tiles.openfreemap.org",
		);
	});

	it("preserves the base directives when adding extras", () => {
		const csp = buildEmDashCsp(undefined, undefined, { workerSrc: ["blob:"] });
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toContain("img-src 'self' https: data: blob:");
	});
});

describe("mergeCspConfigs", () => {
	it("returns undefined when nothing is contributed", () => {
		expect(mergeCspConfigs(undefined, null, {})).toBeUndefined();
	});

	it("concatenates sources per directive across configs", () => {
		const merged = mergeCspConfigs(
			{ connectSrc: ["https://a.example"] },
			{ connectSrc: ["https://b.example"], workerSrc: ["blob:"] },
		);
		expect(merged).toEqual({
			connectSrc: ["https://a.example", "https://b.example"],
			workerSrc: ["blob:"],
		});
	});

	it("skips nullish configs and empty source lists", () => {
		expect(mergeCspConfigs(undefined, { connectSrc: [] }, { workerSrc: ["blob:"] })).toEqual({
			workerSrc: ["blob:"],
		});
	});

	it("feeds buildEmDashCsp so plugin + app sources both land, deduped", () => {
		const extra = mergeCspConfigs(
			{ connectSrc: ["https://tiles.example"] },
			{ connectSrc: ["https://tiles.example"], workerSrc: ["blob:"] },
		);
		const csp = buildEmDashCsp(undefined, undefined, extra);
		const connectSrc = csp.split("; ").find((d) => d.startsWith("connect-src"));
		expect(connectSrc).toBe("connect-src 'self' https://tiles.example");
		expect(csp.split("; ").find((d) => d.startsWith("worker-src"))).toBe("worker-src 'self' blob:");
	});
});

describe("getConfiguredStorageEndpoint", () => {
	afterEach(() => {
		vi.unstubAllEnvs();
	});

	it("returns undefined for undefined storage", () => {
		expect(getConfiguredStorageEndpoint(undefined)).toBeUndefined();
	});

	it("returns undefined for storage config without an endpoint field", () => {
		expect(
			getConfiguredStorageEndpoint({
				entrypoint: "emdash/storage/local",
				config: { directory: "./uploads" },
			}),
		).toBeUndefined();
	});

	it("returns the explicit endpoint from config when present", () => {
		expect(
			getConfiguredStorageEndpoint({
				entrypoint: "emdash/storage/s3",
				config: { endpoint: "https://xxx.r2.cloudflarestorage.com" },
			}),
		).toBe("https://xxx.r2.cloudflarestorage.com");
	});

	it("falls back to S3_ENDPOINT when the s3 adapter's config omits endpoint", () => {
		vi.stubEnv("S3_ENDPOINT", "https://from-env.example.com");
		expect(getConfiguredStorageEndpoint({ entrypoint: "emdash/storage/s3", config: {} })).toBe(
			"https://from-env.example.com",
		);
	});

	it("explicit config endpoint wins over S3_ENDPOINT", () => {
		vi.stubEnv("S3_ENDPOINT", "https://from-env.example.com");
		expect(
			getConfiguredStorageEndpoint({
				entrypoint: "emdash/storage/s3",
				config: { endpoint: "https://from-config.example.com" },
			}),
		).toBe("https://from-config.example.com");
	});

	it("does not fall back to S3_ENDPOINT for a non-s3 adapter", () => {
		vi.stubEnv("S3_ENDPOINT", "https://from-env.example.com");
		expect(
			getConfiguredStorageEndpoint({ entrypoint: "emdash/storage/local", config: {} }),
		).toBeUndefined();
	});

	it("returns undefined when S3_ENDPOINT is unset and config has no endpoint", () => {
		expect(
			getConfiguredStorageEndpoint({ entrypoint: "emdash/storage/s3", config: {} }),
		).toBeUndefined();
	});
});
