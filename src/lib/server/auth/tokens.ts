/**
 * Secrets: how they are made, and how they are stored.
 *
 * Nothing that grants access is ever written down. A session token, a sign-in
 * link and an API token are all random bytes handed to the holder once; the
 * database keeps only their SHA-256, so a copy of it opens nothing. They are
 * long enough that guessing is not a threat model, which is why a plain hash
 * is right here and a password hash would not be: there is no low-entropy
 * secret to slow an attacker down on.
 */

/** Enough entropy that the hash needs no salt and no work factor. */
const TOKEN_BYTES = 32;

/** Marks a LogbooX API token wherever one turns up — a log, a config file. */
export const API_TOKEN_PREFIX = 'lbx_';

function base64url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** A fresh secret: 256 bits, URL-safe, safe to put in a link. */
export function randomToken(): string {
	return base64url(crypto.getRandomValues(new Uint8Array(TOKEN_BYTES)));
}

/** How a token is stored and looked up. Hex, so it compares as plain text. */
export async function hashToken(token: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
	return Array.from(new Uint8Array(digest))
		.map((byte) => byte.toString(16).padStart(2, '0'))
		.join('');
}

export function formatApiToken(secret: string): string {
	return `${API_TOKEN_PREFIX}${secret}`;
}

/** The secret inside a presented API token, or null if it is not one of ours. */
export function parseApiToken(value: string): string | null {
	if (!value.startsWith(API_TOKEN_PREFIX)) return null;
	const secret = value.slice(API_TOKEN_PREFIX.length);
	return secret.length > 0 ? secret : null;
}

/** The tail of a token, shown in the list so one can be told from another. */
export function tokenHint(secret: string): string {
	return secret.slice(-4);
}

/** The `Authorization: Bearer …` value, or null. */
export function bearer(header: string | null): string | null {
	if (!header) return null;
	const match = /^Bearer\s+(.+)$/i.exec(header.trim());
	return match ? match[1].trim() : null;
}

/**
 * Compares two secrets in time that does not depend on where they differ.
 * Only used for the cron secret, which is compared directly rather than by
 * hash lookup.
 */
export function timingSafeEqual(a: string, b: string): boolean {
	if (a.length !== b.length) return false;
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
