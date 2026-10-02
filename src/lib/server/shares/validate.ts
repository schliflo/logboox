/**
 * What a share may be made of.
 *
 * Everything in a share is served publicly from this domain, so whatever an
 * owner sends is checked against what the app itself would send — the same
 * shapes, roughly the same sizes — before anyone else gets to read it.
 */

import { TIME_BLOB } from '#lib/history/codec.js';
import { DTYPE_CTOR } from '#lib/data/schema/columns.js';
import { isValidTimeZone } from '#lib/leaderboard/periods.js';
import type { SliceManifest } from '#lib/share/slice.js';
import { isSafeBlobName } from '../exports/r2';
import {
	MAX_SHARE_BLOBS,
	MAX_SHARE_MANIFEST_BYTES,
	MAX_SHARE_META_BYTES,
	SHARE_UPLOAD_WINDOW_SECONDS,
	type NewShare,
	type ShareKind
} from './repo';

/** Uploaded as a buffer like the rest, but plain JSON despite its `.gz` key. */
export const MANIFEST_BLOB = '_manifest';

const KINDS: ShareKind[] = ['trip', 'charging', 'export'];

/** A model name as the car reports it; empty when the export never said. */
const VMODEL = /^[A-Za-z0-9 ._-]{0,64}$/;

export type Checked<T> = { ok: true; value: T } | { ok: false; status: number; error: string };

function refuse(status: number, error: string): { ok: false; status: number; error: string } {
	return { ok: false, status, error };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
	const proto = Object.getPrototypeOf(value);
	return proto === Object.prototype || proto === null;
}

/** The figures a share page prints: flat, numeric and small. */
export function checkMeta(meta: unknown): Record<string, number | boolean | null> | null {
	if (!isPlainObject(meta)) return null;
	for (const value of Object.values(meta)) {
		if (value !== null && typeof value !== 'boolean' && typeof value !== 'number') return null;
	}
	if (new TextEncoder().encode(JSON.stringify(meta)).byteLength > MAX_SHARE_META_BYTES) return null;
	return meta as Record<string, number | boolean | null>;
}

/** Stored meta as the page reads it; rows from before the checks may hold anything. */
export function storedMeta(json: string): Record<string, unknown> {
	try {
		const meta: unknown = JSON.parse(json);
		return isPlainObject(meta) ? meta : {};
	} catch {
		return {};
	}
}

export function checkNewShare(body: Record<string, unknown> | null): Checked<NewShare> {
	if (!body || !KINDS.includes(body.kind as ShareKind)) return refuse(400, 'Not a kind of share.');
	const kind = body.kind as ShareKind;

	// `typeof NaN` is 'number', and the columns these land in are NOT NULL.
	const { startTime, endTime } = body;
	if (
		typeof startTime !== 'number' ||
		typeof endTime !== 'number' ||
		!Number.isFinite(startTime) ||
		!Number.isFinite(endTime) ||
		endTime < startTime
	) {
		return refuse(400, 'A share has to say what period it covers.');
	}

	const vmodel = body.vmodel ?? '';
	if (typeof vmodel !== 'string' || !VMODEL.test(vmodel)) return refuse(400, 'Not a model name.');

	const timeZone = body.timeZone ?? 'UTC';
	if (!isValidTimeZone(timeZone)) return refuse(400, 'Not a time zone.');

	const meta = checkMeta(body.meta ?? {});
	if (!meta) return refuse(400, 'The figures for that share are not ones the app sends.');

	if (kind === 'export' && typeof body.exportId !== 'string') {
		return refuse(400, 'Say which export to share.');
	}

	return {
		ok: true,
		value: {
			kind,
			vmodel,
			title: typeof body.title === 'string' ? body.title : undefined,
			description: typeof body.description === 'string' ? body.description : undefined,
			startTime: Math.floor(startTime),
			endTime: Math.floor(endTime),
			timeZone,
			exportId: kind === 'export' ? (body.exportId as string) : undefined,
			meta
		}
	};
}

function isFiniteNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value);
}

/** A manifest as `manifestOf` writes it, or null. */
export function parseManifest(text: string): SliceManifest | null {
	if (new TextEncoder().encode(text).byteLength > MAX_SHARE_MANIFEST_BYTES) return null;

	let manifest: unknown;
	try {
		manifest = JSON.parse(text);
	} catch {
		return null;
	}
	if (!isPlainObject(manifest)) return null;

	const { rows, columns } = manifest;
	if (!Number.isSafeInteger(rows) || (rows as number) < 0) return null;
	// The timeline and the manifest itself take two of the share's objects.
	if (!Array.isArray(columns) || columns.length > MAX_SHARE_BLOBS - 2) return null;

	const seen = new Set<string>();
	for (const column of columns) {
		if (!isPlainObject(column) || !isPlainObject(column.spec)) return null;
		const { key, spec } = column;
		if (typeof key !== 'string' || !isSafeBlobName(key)) return null;
		if (key === TIME_BLOB || key === MANIFEST_BLOB || seen.has(key)) return null;
		if (spec.key !== key || !Object.hasOwn(DTYPE_CTOR, spec.dtype as string)) return null;
		if (!isFiniteNumber(spec.scale) || !isFiniteNumber(spec.offset)) return null;
		if (![column.nonNull, column.min, column.max].every(isFiniteNumber)) return null;
		seen.add(key);
	}

	return manifest as unknown as SliceManifest;
}

/** Every buffer of a slice is a gzip member, and nothing else is accepted. */
export function isGzip(bytes: Uint8Array): boolean {
	return bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/** A Content-Length that is really one, or null. */
export function declaredLength(header: string | null): number | null {
	if (header === null || !/^\d{1,12}$/.test(header)) return null;
	return Number(header);
}

export interface BlobUpload {
	name: string;
	bytes: Uint8Array;
	/** The share's `created_at`, and now, in epoch seconds. */
	createdAt: number;
	now: number;
	/** The manifest already stored for this share, if any. */
	manifest: SliceManifest | null;
}

/**
 * Whether one buffer is the kind a share may hold. The manifest goes first and
 * nothing outside it is accepted after, so a share holds a slice and nothing
 * else. That the manifest comes once, and the caps on count and size, are
 * held by the share row itself; see shares/blobs.ts.
 */
export function checkBlobUpload(upload: BlobUpload): Checked<'manifest' | 'buffer'> {
	const { name, bytes } = upload;

	if (upload.now > upload.createdAt + SHARE_UPLOAD_WINDOW_SECONDS) {
		return refuse(409, 'That link is finished; make a new one instead.');
	}
	if (bytes.byteLength === 0) return refuse(400, 'That buffer is empty.');

	if (name === MANIFEST_BLOB) {
		if (!parseManifest(new TextDecoder().decode(bytes))) {
			return refuse(400, 'That is not a manifest the app would write.');
		}
		return { ok: true, value: 'manifest' };
	}

	if (!upload.manifest) return refuse(409, 'Send the manifest before the buffers.');
	const listed = name === TIME_BLOB || upload.manifest.columns.some((c) => c.key === name);
	if (!listed) return refuse(400, 'That buffer is not one the manifest accounts for.');
	if (!isGzip(bytes)) {
		return refuse(400, 'That buffer is not compressed the way this format requires.');
	}
	return { ok: true, value: 'buffer' };
}

/**
 * The body, read no further than `limit`: a declared length is a claim, and
 * `arrayBuffer()` would buffer whatever actually arrives.
 */
export async function readAtMost(request: Request, limit: number): Promise<Uint8Array | null> {
	if (!request.body) return new Uint8Array(0);
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > limit) {
			await reader.cancel();
			return null;
		}
		chunks.push(value);
	}

	const out = new Uint8Array(total);
	let at = 0;
	for (const chunk of chunks) {
		out.set(chunk, at);
		at += chunk.byteLength;
	}
	return out;
}
