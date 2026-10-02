/**
 * The way out of a message, which has to work for as long as the message does.
 *
 * A token is the user id and an HMAC of it under a secret that never leaves
 * the server, so nothing is stored and nothing needs rotating: the link in
 * every mail ever sent keeps working, whatever was sent after it. The kind is
 * part of what is signed, which keeps a link for one kind of message from
 * switching off another.
 *
 * The cost is that the secret cannot change without killing every link already
 * out there, and that a link cannot be revoked. It opens one switch that the
 * person can flip back from their account, so neither is a loss worth a table.
 */

import type { MailKind } from '../auth/users';

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** The bytes of a base64url string, or null when it is not one. */
function fromBase64Url(value: string): Uint8Array<ArrayBuffer> | null {
	if (!/^[A-Za-z0-9_-]*$/.test(value)) return null;
	try {
		const binary = atob(value.replace(/-/g, '+').replace(/_/g, '/'));
		return Uint8Array.from(binary, (char) => char.charCodeAt(0));
	} catch {
		return null;
	}
}

function hmacKey(secret: string, usage: 'sign' | 'verify'): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		encoder.encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		[usage]
	);
}

export async function signUnsubscribe(
	secret: string,
	userId: string,
	kind: MailKind
): Promise<string> {
	const signature = await crypto.subtle.sign(
		'HMAC',
		await hmacKey(secret, 'sign'),
		encoder.encode(`${kind}:${userId}`)
	);
	return `${toBase64Url(encoder.encode(userId))}.${toBase64Url(new Uint8Array(signature))}`;
}

/** The user id a token was issued for, or null when it is not one of ours. */
export async function verifyUnsubscribe(
	secret: string,
	token: string,
	kind: MailKind
): Promise<string | null> {
	const [encodedId, encodedSignature, ...rest] = token.split('.');
	if (!encodedId || !encodedSignature || rest.length > 0) return null;

	const idBytes = fromBase64Url(encodedId);
	const signature = fromBase64Url(encodedSignature);
	if (!idBytes || !signature) return null;

	const userId = new TextDecoder().decode(idBytes);
	// `verify` compares in constant time, which a string `===` on the encoded
	// signatures would not.
	const valid = await crypto.subtle.verify(
		'HMAC',
		await hmacKey(secret, 'verify'),
		signature,
		encoder.encode(`${kind}:${userId}`)
	);
	return valid ? userId : null;
}

export interface UnsubscribeLinks {
	/** The page with the confirm button: the link in the body and in `List-Unsubscribe`. */
	unsubscribeUrl: string;
}

export async function unsubscribeLinks(
	origin: string,
	secret: string,
	userId: string,
	kind: MailKind
): Promise<UnsubscribeLinks> {
	const query = `token=${encodeURIComponent(await signUnsubscribe(secret, userId, kind))}&kind=${kind}`;
	return { unsubscribeUrl: `${origin}/unsubscribe?${query}` };
}
