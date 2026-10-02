/**
 * What a share may be made of. Everything here ends up served publicly from
 * this domain, so the cases that matter are the ones the app would never send.
 */

import { describe, expect, it } from 'vitest';
import type { SliceManifest } from '#lib/share/slice.js';
import { MAX_SHARE_BLOBS, MAX_SHARE_MANIFEST_BYTES, SHARE_UPLOAD_WINDOW_SECONDS } from './repo';
import {
	MANIFEST_BLOB,
	checkBlobUpload,
	checkMeta,
	checkNewShare,
	declaredLength,
	parseManifest,
	readAtMost,
	storedMeta,
	type BlobUpload
} from './validate';

const TRIP = {
	kind: 'trip',
	vmodel: 'F30b',
	title: 'The long way home',
	startTime: 1_780_000_000,
	endTime: 1_780_003_600,
	timeZone: 'Europe/Berlin',
	meta: { distanceKm: 42.1, maxSpeed: 131, regenShare: null, isDc: false }
};

describe('checkNewShare', () => {
	it('accepts what the share button sends', () => {
		const checked = checkNewShare(TRIP);
		expect(checked.ok && checked.value).toMatchObject({ kind: 'trip', vmodel: 'F30b' });
	});

	it('refuses times that are not finite, or run backwards', () => {
		for (const times of [
			{ startTime: Number.NaN },
			{ endTime: Number.POSITIVE_INFINITY },
			{ startTime: '1780000000' },
			{ endTime: TRIP.startTime - 1 }
		]) {
			expect(checkNewShare({ ...TRIP, ...times }).ok).toBe(false);
		}
	});

	it('takes a model name and nothing that only looks like one', () => {
		expect(checkNewShare({ ...TRIP, vmodel: 'G6 2024.1_x-y' }).ok).toBe(true);
		// Exports that never named the car still share.
		expect(checkNewShare({ ...TRIP, vmodel: '' }).ok).toBe(true);
		expect(checkNewShare({ ...TRIP, vmodel: '<script>' }).ok).toBe(false);
		expect(checkNewShare({ ...TRIP, vmodel: 'x'.repeat(65) }).ok).toBe(false);
	});

	it('takes a real time zone, and UTC when none is given', () => {
		expect(checkNewShare({ ...TRIP, timeZone: 'Mars/Olympus' }).ok).toBe(false);
		const checked = checkNewShare({ ...TRIP, timeZone: undefined });
		expect(checked.ok && checked.value.timeZone).toBe('UTC');
	});

	it('wants an export id for a whole-export share', () => {
		expect(checkNewShare({ ...TRIP, kind: 'export' }).ok).toBe(false);
		expect(checkNewShare({ ...TRIP, kind: 'export', exportId: 'DA0001' }).ok).toBe(true);
	});

	it('refuses something that is not a share at all', () => {
		expect(checkNewShare(null).ok).toBe(false);
		expect(checkNewShare({ ...TRIP, kind: 'month' }).ok).toBe(false);
	});
});

describe('checkMeta', () => {
	it('takes a flat object of figures', () => {
		expect(checkMeta(TRIP.meta)).toEqual(TRIP.meta);
	});

	it('refuses anything else, and anything large', () => {
		expect(checkMeta([1, 2])).toBeNull();
		expect(checkMeta('text')).toBeNull();
		expect(checkMeta({ nested: { a: 1 } })).toBeNull();
		expect(checkMeta({ note: 'free text served publicly' })).toBeNull();
		const wide = Object.fromEntries(Array.from({ length: 400 }, (_, i) => [`k${i}`, i]));
		expect(checkMeta(wide)).toBeNull();
	});

	it('reads back stored meta of any vintage as an object', () => {
		expect(storedMeta('{"a":1}')).toEqual({ a: 1 });
		expect(storedMeta('[1]')).toEqual({});
		expect(storedMeta('nonsense')).toEqual({});
	});
});

function manifest(keys = ['esp_vehspd'], rows = 3600): SliceManifest {
	return {
		rows,
		columns: keys.map((key) => ({
			key,
			spec: { key, dtype: 'u16', scale: 0.1, offset: 0 } as never,
			nonNull: rows,
			min: 0,
			max: 131
		}))
	};
}

describe('parseManifest', () => {
	it('reads what manifestOf writes', () => {
		expect(parseManifest(JSON.stringify(manifest()))).toEqual(manifest());
	});

	it('refuses what it does not', () => {
		const bad = (change: (m: Record<string, unknown>) => void) => {
			const m = JSON.parse(JSON.stringify(manifest())) as Record<string, unknown>;
			change(m);
			return parseManifest(JSON.stringify(m));
		};
		expect(parseManifest('not json')).toBeNull();
		expect(parseManifest('[]')).toBeNull();
		expect(bad((m) => (m.rows = -1))).toBeNull();
		expect(bad((m) => ((m.columns as { key: string }[])[0].key = '../x'))).toBeNull();
		expect(bad((m) => ((m.columns as { key: string }[])[0].key = '_time'))).toBeNull();
		expect(
			bad((m) => ((m.columns as { spec: { dtype: string } }[])[0].spec.dtype = 'f64'))
		).toBeNull();
		expect(parseManifest(JSON.stringify(manifest(['a', 'a'])))).toBeNull();
		const many = Array.from({ length: MAX_SHARE_BLOBS }, (_, i) => `c${i}`);
		expect(parseManifest(JSON.stringify(manifest(many)))).toBeNull();
	});

	it('refuses one larger than any slice needs', () => {
		const padded = JSON.stringify({ ...manifest(), pad: 'x'.repeat(MAX_SHARE_MANIFEST_BYTES) });
		expect(parseManifest(padded)).toBeNull();
	});
});

const GZ = new Uint8Array([0x1f, 0x8b, 8, 0, 0, 0, 0, 0]);
const CREATED = 1_780_000_000;

function upload(overrides: Partial<BlobUpload> = {}): BlobUpload {
	return {
		name: 'esp_vehspd',
		bytes: GZ,
		createdAt: CREATED,
		now: CREATED + 5,
		manifest: manifest(),
		...overrides
	};
}

function status(input: BlobUpload): number {
	const checked = checkBlobUpload(input);
	return checked.ok ? 200 : checked.status;
}

describe('checkBlobUpload', () => {
	it('takes the manifest first, then the buffers it names', () => {
		const text = new TextEncoder().encode(JSON.stringify(manifest()));
		expect(status(upload({ name: MANIFEST_BLOB, bytes: text, manifest: null }))).toBe(200);
		expect(status(upload())).toBe(200);
		expect(status(upload({ name: '_time' }))).toBe(200);
	});

	it('takes nothing before the manifest, and nothing it does not name', () => {
		expect(status(upload({ manifest: null }))).toBe(409);
		expect(status(upload({ name: 'payload' }))).toBe(400);
	});

	it('refuses a manifest that is not one', () => {
		const text = new TextEncoder().encode('<html>');
		expect(status(upload({ name: MANIFEST_BLOB, bytes: text, manifest: null }))).toBe(400);
	});

	it('takes gzip and nothing else', () => {
		expect(status(upload({ bytes: new TextEncoder().encode('<html>') }))).toBe(400);
		expect(status(upload({ bytes: new Uint8Array(0) }))).toBe(400);
	});

	it('closes once the link is a few minutes old', () => {
		expect(status(upload({ now: CREATED + SHARE_UPLOAD_WINDOW_SECONDS }))).toBe(200);
		expect(status(upload({ now: CREATED + SHARE_UPLOAD_WINDOW_SECONDS + 1 }))).toBe(409);
	});
});

describe('declaredLength', () => {
	it('takes a plain count and nothing else', () => {
		expect(declaredLength('1024')).toBe(1024);
		expect(declaredLength(null)).toBeNull();
		expect(declaredLength('-1')).toBeNull();
		expect(declaredLength('1e9')).toBeNull();
		expect(declaredLength('')).toBeNull();
	});
});

describe('readAtMost', () => {
	const body = (n: number) =>
		new Request('https://x.test', { method: 'PUT', body: new Uint8Array(n) });

	it('reads a body within its limit', async () => {
		expect((await readAtMost(body(100), 100))?.byteLength).toBe(100);
	});

	it('stops reading one that goes past it', async () => {
		expect(await readAtMost(body(101), 100)).toBeNull();
	});
});
