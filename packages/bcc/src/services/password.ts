/**
 * Password hashing for the optional email+password sign-in.
 *
 * emdash is passwordless by design (passkeys / magic-link / OAuth); this adds a
 * self-contained password credential stored in our own `bcc_user_passwords`
 * table, verified against emdash's existing `users` rows. PBKDF2-HMAC-SHA256 via
 * Web Crypto works identically on Node and Cloudflare Workers. Format is a
 * PHC-like string: `pbkdf2$sha256$<iterations>$<saltB64>$<hashB64>`.
 */
const ITERATIONS = 210_000;
const KEY_BYTES = 32;
const SALT_BYTES = 16;

function b64(bytes: Uint8Array): string {
	let s = "";
	for (const b of bytes) s += String.fromCharCode(b);
	return btoa(s);
}
function unb64(s: string): Uint8Array {
	const bin = atob(s);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function derive(password: string, salt: Uint8Array, iterations: number, len: number): Promise<Uint8Array> {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);
	const bits = await crypto.subtle.deriveBits(
		{ name: "PBKDF2", salt: salt as unknown as ArrayBuffer, iterations, hash: "SHA-256" },
		key,
		len * 8,
	);
	return new Uint8Array(bits);
}

/** Constant-time byte comparison. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a[i]! ^ b[i]!;
	return diff === 0;
}

export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const hash = await derive(password, salt, ITERATIONS, KEY_BYTES);
	return `pbkdf2$sha256$${ITERATIONS}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
	const parts = stored.split("$");
	if (parts.length !== 5 || parts[0] !== "pbkdf2") return false;
	const iterations = Number.parseInt(parts[2]!, 10);
	if (!Number.isFinite(iterations) || iterations < 1) return false;
	const salt = unb64(parts[3]!);
	const expected = unb64(parts[4]!);
	const actual = await derive(password, salt, iterations, expected.length);
	return timingSafeEqual(actual, expected);
}

/** Basic strength gate (a password only supplements passkeys). */
export function passwordProblem(password: unknown): string | null {
	if (typeof password !== "string") return "Password is required.";
	if (password.length < 10) return "Use at least 10 characters.";
	if (password.length > 200) return "That password is too long.";
	return null;
}
