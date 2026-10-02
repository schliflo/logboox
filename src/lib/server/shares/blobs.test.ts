/**
 * Storing a share's slice, against the share row's own counters: the caps
 * have to hold for uploads that arrive all at once, not only one at a time.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { SliceManifest } from '#lib/share/slice.js';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { memoryBucket, type MemoryBucket } from '../testing/memory-bucket';
import { one } from '../db';
import { findOrCreateUser } from '../auth/users';
import { shareBlobKey } from '../exports/r2';
import {
	MAX_SHARE_BLOBS,
	MAX_SHARE_BLOB_BYTES,
	MAX_SHARE_BYTES,
	SHARE_UPLOAD_WINDOW_SECONDS,
	createShare,
	type ShareRow
} from './repo';
import { MANIFEST_BLOB } from './validate';
import { storeShareBlob } from './blobs';

let db: TestDb;
let bucket: MemoryBucket;
let share: ShareRow;

function manifest(keys = ['esp_vehspd']): SliceManifest {
	return {
		rows: 3600,
		columns: keys.map((key) => ({
			key,
			spec: { key, dtype: 'u16', scale: 0.1, offset: 0 } as never,
			nonNull: 3600,
			min: 0,
			max: 131
		}))
	};
}

function gz(size: number): Uint8Array {
	const bytes = new Uint8Array(size);
	bytes[0] = 0x1f;
	bytes[1] = 0x8b;
	return bytes;
}

function put(name: string, bytes: Uint8Array, at = share.created_at + 5) {
	return storeShareBlob(db, bucket, share, name, bytes, at);
}

function putManifest(keys?: string[]) {
	return put(MANIFEST_BLOB, new TextEncoder().encode(JSON.stringify(manifest(keys))));
}

async function counters() {
	return one<{ blob_bytes: number; blob_count: number; manifest_at: number | null }>(
		db,
		'SELECT blob_bytes, blob_count, manifest_at FROM shares WHERE id = ?',
		share.id
	);
}

beforeEach(async () => {
	db = migratedDb();
	bucket = memoryBucket();
	const userId = (await findOrCreateUser(db, 'sharer@example.com')).user.id;
	share = await createShare(db, userId, {
		kind: 'trip',
		vmodel: 'F30b',
		startTime: 1_780_000_000,
		endTime: 1_780_003_600,
		timeZone: 'Europe/Berlin',
		meta: {}
	});
});

afterEach(() => {
	db.close();
});

describe('the manifest', () => {
	it('is claimed once, even when two arrive together', async () => {
		const [a, b] = await Promise.all([putManifest(), putManifest()]);
		expect([a.ok, b.ok].sort()).toEqual([false, true]);
		expect([a, b].find((r) => !r.ok)).toMatchObject({ status: 409 });
		expect((await counters())?.manifest_at).not.toBeNull();
		expect((await counters())?.blob_count).toBe(1);
	});

	it('comes before any buffer', async () => {
		expect(await put('_time', gz(10))).toMatchObject({ ok: false, status: 409 });
		expect(bucket.sizes.size).toBe(0);
	});
});

describe('a buffer', () => {
	it('is stored when the manifest names it, and counted', async () => {
		await putManifest();
		expect(await put('esp_vehspd', gz(100))).toEqual({ ok: true, value: 'buffer' });
		expect(await put('_time', gz(50))).toEqual({ ok: true, value: 'buffer' });

		expect(bucket.sizes.get(shareBlobKey(share.id, 'esp_vehspd'))).toBe(100);
		expect(await counters()).toMatchObject({ blob_count: 3 });
	});

	it('is refused when the manifest does not name it', async () => {
		await putManifest();
		expect(await put('payload', gz(10))).toMatchObject({ ok: false, status: 400 });
		expect(bucket.sizes.has(shareBlobKey(share.id, 'payload'))).toBe(false);
	});

	it('is refused when it is not gzip', async () => {
		await putManifest();
		const html = new TextEncoder().encode('<html>');
		expect(await put('esp_vehspd', html)).toMatchObject({ ok: false, status: 400 });
		expect((await counters())?.blob_count).toBe(1);
	});

	it('is refused once the link is more than a few minutes old', async () => {
		await putManifest();
		const late = share.created_at + SHARE_UPLOAD_WINDOW_SECONDS + 1;
		expect(await put('_time', gz(10), late)).toMatchObject({ ok: false, status: 409 });
		expect(await put('_time', gz(10), late - 1)).toMatchObject({ ok: true });
	});
});

describe('the caps', () => {
	it('hold a share to its total when buffers arrive all at once', async () => {
		await putManifest();
		const attempts = Array.from({ length: 40 }, () => put('_time', gz(MAX_SHARE_BLOB_BYTES)));
		const results = await Promise.all(attempts);

		const taken = results.filter((r) => r.ok).length;
		expect(taken).toBe(Math.floor(MAX_SHARE_BYTES / MAX_SHARE_BLOB_BYTES) - 1);
		expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.status === 413)).toBe(true);
		expect((await counters())!.blob_bytes).toBeLessThanOrEqual(MAX_SHARE_BYTES);
	});

	it('hold a share to a number of objects, a retry counted again', async () => {
		await putManifest();
		for (let i = 1; i < MAX_SHARE_BLOBS; i++) {
			expect(await put('_time', gz(10))).toMatchObject({ ok: true });
		}
		expect(await put('_time', gz(10))).toMatchObject({ ok: false, status: 413 });
		expect((await counters())?.blob_count).toBe(MAX_SHARE_BLOBS);
	});
});
