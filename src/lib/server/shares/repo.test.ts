/**
 * Public links: what revoking takes with it, and what deleting an account has
 * to find before the rows that point at it are gone.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { now, one, run } from '../db';
import { findOrCreateUser } from '../auth/users';
import { createShare, getShare, listShareIds, revokeShare, type NewShare } from './repo';

let db: TestDb;
let userId: string;

function share(overrides: Partial<NewShare> = {}): NewShare {
	return {
		kind: 'trip',
		vmodel: 'F30b',
		startTime: 1_780_000_000,
		endTime: 1_780_003_600,
		timeZone: 'Europe/Berlin',
		meta: { distanceKm: 42 },
		...overrides
	};
}

async function boardEntry(shareId: string | null, board = 'peak-charge'): Promise<string> {
	const id = crypto.randomUUID();
	await run(
		db,
		`INSERT INTO board_entries (id, board, month, user_id, kind, vin, start_time, value, score,
			detail_json, vmodel, share_id, claimed_at, removed_at)
		 VALUES (?, ?, '2026-09', ?, 'charging', 'L1NTEST00000000001', 0, 181, 181,
			'{}', 'F30b', ?, ?, NULL)`,
		id,
		board,
		userId,
		shareId,
		now()
	);
	return id;
}

async function linkOf(entryId: string): Promise<string | null> {
	const row = await one<{ share_id: string | null }>(
		db,
		'SELECT share_id FROM board_entries WHERE id = ?',
		entryId
	);
	return row!.share_id;
}

beforeEach(async () => {
	db = migratedDb();
	userId = (await findOrCreateUser(db, 'sharer@example.com')).user.id;
});

afterEach(() => {
	db.close();
});

describe('revoking a share', () => {
	it('takes the leaderboard link to it down too', async () => {
		const linked = await createShare(db, userId, share());
		const other = await createShare(db, userId, share());
		const entry = await boardEntry(linked.id);
		const untouched = await boardEntry(other.id, 'efficiency');

		expect(await revokeShare(db, userId, linked.id)).toBe(true);

		expect(await getShare(db, linked.id)).toBeNull();
		expect(await linkOf(entry)).toBeNull();
		expect(await linkOf(untouched)).toBe(other.id);
	});

	it('touches nothing when the share is not the caller’s', async () => {
		const linked = await createShare(db, userId, share());
		const entry = await boardEntry(linked.id);
		const stranger = (await findOrCreateUser(db, 'stranger@example.com')).user.id;

		expect(await revokeShare(db, stranger, linked.id)).toBe(false);
		expect(await linkOf(entry)).toBe(linked.id);
	});
});

describe('listing a user’s share ids', () => {
	it('includes revoked shares, whose objects may have outlived them', async () => {
		const live = await createShare(db, userId, share());
		const revoked = await createShare(db, userId, share({ kind: 'charging' }));
		await revokeShare(db, userId, revoked.id);

		expect(new Set(await listShareIds(db, userId))).toEqual(new Set([live.id, revoked.id]));
	});

	it('leaves out whole-export shares, which hold no objects of their own', async () => {
		await createShare(db, userId, share({ kind: 'export', exportId: 'DA0001' }));
		expect(await listShareIds(db, userId)).toEqual([]);
	});

	it('is the user’s own and nobody else’s', async () => {
		const stranger = (await findOrCreateUser(db, 'stranger@example.com')).user.id;
		await createShare(db, stranger, share());
		expect(await listShareIds(db, userId)).toEqual([]);
	});
});
