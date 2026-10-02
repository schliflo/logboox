/**
 * Merging notes from several devices.
 *
 * The later edit wins, but "later" is the device's own claim, so a clock that
 * runs ahead must not be able to win every merge from then on.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { findOrCreateUser } from '../auth/users';
import { listAnnotations, mergeAnnotations, type AnnotationInput } from './repo';

const VIN = 'L1NTEST00000000001';

let db: TestDb;
let userId: string;

function note(overrides: Partial<AnnotationInput> = {}): AnnotationInput {
	return {
		startTime: 1_783_000_000,
		odoStart: 41000,
		origin: 'Home',
		destination: 'Office',
		purpose: 'commute',
		comment: '',
		updatedAt: Date.now() - 60_000,
		deletedAt: null,
		...overrides
	};
}

beforeEach(async () => {
	db = migratedDb();
	userId = (await findOrCreateUser(db, 'reader@example.com')).user.id;
});

afterEach(() => {
	db.close();
});

describe('merging notes', () => {
	it('says how many rows it actually wrote', async () => {
		const notes = Array.from({ length: 600 }, (_, i) => note({ startTime: 1_783_000_000 + i }));
		expect(await mergeAnnotations(db, userId, VIN, notes)).toBe(600);

		// The same again changes nothing: none of it is newer.
		expect(await mergeAnnotations(db, userId, VIN, notes)).toBe(0);
		expect(await listAnnotations(db, userId, VIN)).toHaveLength(600);
	});

	it('does not let a clock running ahead win every later merge', async () => {
		const before = Date.now();
		await mergeAnnotations(db, userId, VIN, [
			note({ comment: 'from the future', updatedAt: Date.now() + 365 * 86400 * 1000 })
		]);
		const [stored] = await listAnnotations(db, userId, VIN);
		expect(stored.updated_at).toBeLessThanOrEqual(Date.now());
		expect(stored.updated_at).toBeGreaterThanOrEqual(before);

		await new Promise((resolve) => setTimeout(resolve, 5));
		await mergeAnnotations(db, userId, VIN, [note({ comment: 'honest', updatedAt: Date.now() })]);
		const [after] = await listAnnotations(db, userId, VIN);
		expect(after.comment).toBe('honest');
	});

	it('skips an entry that is not one', async () => {
		const written = await mergeAnnotations(db, userId, VIN, [
			null as unknown as AnnotationInput,
			'note' as unknown as AnnotationInput,
			note()
		]);
		expect(written).toBe(1);
	});
});
