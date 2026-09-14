/**
 * Being offered a place, and taking it.
 *
 * The line that matters here is the one between the two tables: detecting a
 * candidate must publish nothing at all, and only a claim may. Most of what
 * follows is about the ways a place is *not* offered — a month that has shut,
 * a trip worse than the one already held, a board someone has already turned
 * down.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExportSummary } from '$lib/data/analytics/summary';
import { sessionSummary, tripSummary } from '$lib/leaderboard/testing';
import { GRACE_DAYS, locksAt } from '$lib/leaderboard/periods';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { all, one, run } from '../db';
import { findOrCreateUser } from '../auth/users';
import {
	ClaimRefused,
	claim,
	detectCandidates,
	dismiss,
	listOwn,
	listPending,
	markSeen,
	monthBoards,
	removeEntry,
	yearBoards
} from './repo';
import { UsernameInvalid, UsernameTaken, UsernameTooSoon, setUsername } from './username';

const ZONE = 'Europe/Berlin';
/** Mid-September 2026, comfortably inside the month. */
const SEPTEMBER = Math.floor(Date.UTC(2026, 8, 14, 9, 0) / 1000);
const SOON = Math.floor(Date.UTC(2026, 8, 20, 9, 0) / 1000);

let db: TestDb;
let userId: string;

function summary(overrides: Partial<ExportSummary> = {}): ExportSummary {
	return {
		trips: [],
		charging: [],
		vehicle: {
			vin: 'L1NTEST00000000001',
			vmodel: 'F30b',
			lastSampleTime: SEPTEMBER,
			odometerKm: 41000,
			soc: 60,
			rangeKm: 300
		},
		...overrides
	};
}

/**
 * A drive long enough for the distance board and nothing else.
 *
 * Thirsty on purpose: at the default consumption it would also be a candidate
 * for the efficiency board, and a test that says "the candidate" should get
 * the one it means.
 */
function longDrive(startTime: number, km: number) {
	return tripSummary({
		startTime,
		endTime: startTime + Math.round((km / 90) * 3600),
		distanceKm: km,
		odoStart: 41000,
		odoEnd: 41000 + km,
		consumption: 24
	});
}

/**
 * Trips as an upload leaves them, which is where the month boards read from.
 *
 * The real path writes these in `beginExport`; a month total has to come off
 * the table rather than off the upload in hand, so a test of one has to put
 * them there.
 */
async function store(trips: ReturnType<typeof tripSummary>[], exportId = 'e1') {
	for (const trip of trips) {
		await run(
			db,
			`INSERT INTO trips (user_id, vin, start_time, end_time, export_id, odo_start, odo_end, distance_km, summary_json)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT (user_id, vin, start_time) DO UPDATE SET distance_km = excluded.distance_km`,
			userId,
			'L1NTEST00000000001',
			trip.startTime,
			trip.endTime,
			exportId,
			trip.odoStart,
			trip.odoEnd,
			trip.distanceKm,
			JSON.stringify(trip)
		);
	}
}

/** The offer standing on one particular board. */
async function pendingOn(id: string, board: string, now = SOON) {
	const found = (await listPending(db, id, now)).filter((c) => c.board === board);
	if (found.length !== 1) throw new Error(`expected one ${board} candidate, got ${found.length}`);
	return found[0];
}

async function account(email: string, name?: string): Promise<string> {
	const id = (await findOrCreateUser(db, email)).user.id;
	if (name) await setUsername(db, id, name, SEPTEMBER);
	return id;
}

beforeEach(async () => {
	db = migratedDb();
	userId = await account('reader@example.com');
});

afterEach(() => {
	db.close();
});

describe('spotting a place', () => {
	it('offers the best trip of the month, and only the best', async () => {
		const found = await detectCandidates(
			db,
			userId,
			summary({ trips: [longDrive(SEPTEMBER, 220), longDrive(SEPTEMBER + 86400, 340)] }),
			ZONE,
			SOON
		);

		const distance = found.filter((c) => c.board === 'longest-drive');
		expect(distance).toHaveLength(1);
		expect(distance[0].value).toBe(340);
		expect(distance[0].rank).toBe(1);
		expect(distance[0].month).toBe('2026-09');
	});

	it('publishes nothing by itself', async () => {
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 340)] }), ZONE, SOON);
		expect(await all(db, 'SELECT * FROM board_entries')).toHaveLength(0);
		expect(await monthBoards(db, '2026-09')).toEqual([]);
	});

	it('says nothing about a trip too ordinary for any board', async () => {
		const found = await detectCandidates(
			db,
			userId,
			summary({ trips: [tripSummary()] }),
			ZONE,
			SOON
		);
		expect(found).toEqual([]);
	});

	it('keeps months apart, in the driver’s own zone', async () => {
		// 23:30 Berlin on the last of September is already October there.
		const october = Math.floor(Date.UTC(2026, 8, 30, 22, 30) / 1000);
		const found = await detectCandidates(
			db,
			userId,
			summary({ trips: [longDrive(SEPTEMBER, 200), longDrive(october, 210)] }),
			ZONE,
			october + 86400
		);

		const months = found.filter((c) => c.board === 'longest-drive').map((c) => c.month);
		expect(months.sort()).toEqual(['2026-09', '2026-10']);
	});

	it('ignores a month that has already closed', async () => {
		const august = Math.floor(Date.UTC(2026, 7, 14, 9, 0) / 1000);
		const found = await detectCandidates(
			db,
			userId,
			summary({ trips: [longDrive(august, 340)] }),
			ZONE,
			locksAt('2026-08') + 1
		);
		expect(found).toEqual([]);
	});

	it('still offers a place during the fortnight of grace', async () => {
		const august = Math.floor(Date.UTC(2026, 7, 14, 9, 0) / 1000);
		const found = await detectCandidates(
			db,
			userId,
			summary({ trips: [longDrive(august, 340)] }),
			ZONE,
			locksAt('2026-08') - 86400
		);
		expect(found.map((c) => c.month)).toContain('2026-08');
	});

	it('does not offer the same trip twice', async () => {
		const month = summary({ trips: [longDrive(SEPTEMBER, 340)] });
		expect(await detectCandidates(db, userId, month, ZONE, SOON)).not.toHaveLength(0);
		expect(await detectCandidates(db, userId, month, ZONE, SOON)).toEqual([]);
	});

	it('speaks up again when a better trip arrives', async () => {
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 220)] }), ZONE, SOON);
		const better = await detectCandidates(
			db,
			userId,
			summary({ trips: [longDrive(SEPTEMBER, 400)] }),
			ZONE,
			SOON
		);
		expect(better.filter((c) => c.board === 'longest-drive')[0]?.value).toBe(400);
		expect(
			await all(db, "SELECT * FROM board_candidates WHERE board = 'longest-drive'")
		).toHaveLength(1);
	});

	it('forgets it was seen once a better trip replaces it', async () => {
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 220)] }), ZONE, SOON);
		const pending = await listPending(db, userId, SOON);
		await markSeen(
			db,
			userId,
			pending.map((c) => c.id)
		);
		expect((await listPending(db, userId, SOON))[0].seen).toBe(true);

		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 400)] }), ZONE, SOON);
		expect((await listPending(db, userId, SOON))[0].seen).toBe(false);
	});

	it('offers a rapid charge, and ignores one at home', async () => {
		const found = await detectCandidates(
			db,
			userId,
			summary({
				charging: [
					sessionSummary({ startTime: SEPTEMBER, maxKw: 152 }),
					sessionSummary({ startTime: SEPTEMBER + 86400, maxKw: 10.6, isDc: false })
				]
			}),
			ZONE,
			SOON
		);

		const peak = found.filter((c) => c.board === 'peak-charge');
		expect(peak).toHaveLength(1);
		expect(peak[0].value).toBe(152);
	});

	it('says nothing when the place they already hold is better', async () => {
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 400)] }), ZONE, SOON);
		await setUsername(db, userId, 'flo', SEPTEMBER);
		await claim(db, userId, (await pendingOn(userId, 'longest-drive')).id, null, SOON);

		const worse = await detectCandidates(
			db,
			userId,
			summary({ trips: [longDrive(SEPTEMBER, 250)] }),
			ZONE,
			SOON
		);
		expect(worse.filter((c) => c.board === 'longest-drive')).toEqual([]);
	});

	it('says nothing to someone who would not make the table', async () => {
		// Twenty-five other people, every one of them further than the newcomer.
		for (let i = 0; i < 25; i++) {
			const other = await account(`rival${i}@example.com`, `rival${i}`);
			await run(
				db,
				`INSERT INTO board_entries (id, board, month, user_id, kind, vin, start_time, value,
					score, detail_json, vmodel, claimed_at)
				 VALUES (?, 'longest-drive', '2026-09', ?, 'trip', 'VIN', ?, ?, ?, '{}', 'F30b', ?)`,
				`entry-${i}`,
				other,
				SEPTEMBER + i,
				900 + i,
				900 + i,
				SEPTEMBER
			);
		}

		const found = await detectCandidates(
			db,
			userId,
			summary({ trips: [longDrive(SEPTEMBER, 340)] }),
			ZONE,
			SOON
		);
		expect(found.filter((c) => c.board === 'longest-drive')).toEqual([]);
	});
});

describe('a month on the board', () => {
	/** A day's driving: several trips rather than one long one. */
	function day(offset: number, km: number) {
		return longDrive(SEPTEMBER + offset * 86400, km);
	}

	it('adds up every kilometre of the month, not just the best trip', async () => {
		const trips = [day(0, 210), day(1, 180), day(2, 240)];
		await store(trips);

		const found = await detectCandidates(db, userId, summary({ trips }), ZONE, SOON);
		const month = found.filter((c) => c.board === 'monthly-distance');

		expect(month).toHaveLength(1);
		expect(month[0].value).toBe(630);
		expect(month[0].month).toBe('2026-09');
		expect(month[0].detail.trips).toBe(3);
	});

	it('adds up a month that arrived in two separate exports', async () => {
		// The point of reading the table rather than the upload: XPeng hands out
		// a file at a time, and a month does not respect their boundaries.
		const first = [day(0, 300)];
		const second = [day(10, 400)];
		await store(first, 'e1');
		await store(second, 'e2');

		const found = await detectCandidates(db, userId, summary({ trips: second }), ZONE, SOON);
		expect(found.find((c) => c.board === 'monthly-distance')?.value).toBe(700);
	});

	it('counts a re-uploaded month once', async () => {
		const trips = [day(0, 300), day(1, 400)];
		await store(trips, 'e1');
		await store(trips, 'e2');

		const found = await detectCandidates(db, userId, summary({ trips }), ZONE, SOON);
		expect(found.find((c) => c.board === 'monthly-distance')?.value).toBe(700);
	});

	it('leaves a quiet month off', async () => {
		const trips = [day(0, 120), day(1, 140)];
		await store(trips);

		const found = await detectCandidates(db, userId, summary({ trips }), ZONE, SOON);
		expect(found.find((c) => c.board === 'monthly-distance')).toBeUndefined();
	});

	it('settles which month a late-night drive belongs to in the driver’s zone', async () => {
		// 23:30 on the last day of September in Berlin is already October in UTC.
		const lastNight = Math.floor(Date.UTC(2026, 8, 30, 21, 30) / 1000);
		const trips = [longDrive(lastNight, 600)];
		await store(trips);

		const found = await detectCandidates(db, userId, summary({ trips }), ZONE, SOON);
		const month = found.find((c) => c.board === 'monthly-distance');
		expect(month?.month).toBe('2026-09');
		expect(month?.value).toBe(600);
	});

	it('counts a month the car mostly slept through', async () => {
		// Distance is the odometer at each end, so a trip too sparsely sampled
		// to be ranked for efficiency still says truthfully how far it went.
		const trips = [
			tripSummary({ ...day(0, 300), coverage: 0.2 }),
			tripSummary({ ...day(1, 400), coverage: 0.1 })
		];
		await store(trips);

		const found = await detectCandidates(db, userId, summary({ trips }), ZONE, SOON);
		expect(found.find((c) => c.board === 'monthly-distance')?.value).toBe(700);
		// …and is still not ranked on anything computed per kilometre.
		expect(found.find((c) => c.board === 'efficient-drive')).toBeUndefined();
	});

	it('ignores an odometer that jumped', async () => {
		const trips = [day(0, 600), tripSummary({ ...day(1, 9000), endTime: SEPTEMBER + 86400 + 600 })];
		await store(trips);

		const found = await detectCandidates(db, userId, summary({ trips }), ZONE, SOON);
		expect(found.find((c) => c.board === 'monthly-distance')?.value).toBe(600);
	});

	it('says nothing about a month that has closed', async () => {
		const trips = [day(0, 900)];
		await store(trips);

		const afterLock = locksAt('2026-09') + 60;
		const found = await detectCandidates(db, userId, summary({ trips }), ZONE, afterLock);
		expect(found.find((c) => c.board === 'monthly-distance')).toBeUndefined();
	});

	it('can be claimed, and appears with the rest', async () => {
		const named = await account('driver@example.com', 'nordlicht');
		const trips = [day(0, 400), day(1, 500)];
		for (const trip of trips) {
			await run(
				db,
				`INSERT INTO trips (user_id, vin, start_time, end_time, export_id, odo_start, odo_end, distance_km, summary_json)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				named,
				'L1NTEST00000000002',
				trip.startTime,
				trip.endTime,
				'e1',
				trip.odoStart,
				trip.odoEnd,
				trip.distanceKm,
				JSON.stringify(trip)
			);
		}

		const found = await detectCandidates(
			db,
			named,
			{ ...summary({ trips }), vehicle: { ...summary().vehicle, vin: 'L1NTEST00000000002' } },
			ZONE,
			SOON
		);
		const candidate = found.find((c) => c.board === 'monthly-distance')!;
		await claim(db, named, candidate.id, null, SOON);

		const listings = await monthBoards(db, '2026-09');
		const board = listings.find((listing) => listing.board === 'monthly-distance');
		expect(board?.entries[0]).toMatchObject({ username: 'nordlicht', value: 900, rank: 1 });
	});
});

describe('turning a place down', () => {
	it('takes it off the list and leaves it off', async () => {
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 240)] }), ZONE, SOON);
		const pending = await pendingOn(userId, 'longest-drive');

		expect(await dismiss(db, userId, pending.id)).toBe(true);
		expect(await listPending(db, userId, SOON)).toEqual([]);
	});

	it('stays turned down when a slightly better trip arrives', async () => {
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 240)] }), ZONE, SOON);
		await dismiss(db, userId, (await pendingOn(userId, 'longest-drive')).id);

		// Still nowhere near the top three, so it is the same proposition.
		for (let i = 0; i < 3; i++) {
			const other = await account(`fast${i}@example.com`, `fast${i}`);
			await run(
				db,
				`INSERT INTO board_entries (id, board, month, user_id, kind, vin, start_time, value,
					score, detail_json, vmodel, claimed_at)
				 VALUES (?, 'longest-drive', '2026-09', ?, 'trip', 'VIN', ?, 999, 999, '{}', 'F30b', ?)`,
				`fast-${i}`,
				other,
				SEPTEMBER + i,
				SEPTEMBER
			);
		}
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 260)] }), ZONE, SOON);
		expect(await listPending(db, userId, SOON)).toEqual([]);
	});

	it('comes back when the new one would win the board outright', async () => {
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 240)] }), ZONE, SOON);
		await dismiss(db, userId, (await pendingOn(userId, 'longest-drive')).id);

		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 600)] }), ZONE, SOON);
		expect(await pendingOn(userId, 'longest-drive')).toBeTruthy();
	});

	it('stops offering a place once the month locks', async () => {
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 340)] }), ZONE, SOON);
		expect(await listPending(db, userId, locksAt('2026-09') + 1)).toEqual([]);
	});
});

describe('claiming a place', () => {
	async function offered(): Promise<string> {
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 340)] }), ZONE, SOON);
		return (await pendingOn(userId, 'longest-drive')).id;
	}

	it('refuses until there is a name to publish it under', async () => {
		const id = await offered();
		await expect(claim(db, userId, id, null, SOON)).rejects.toMatchObject({
			reason: 'username-required'
		});
	});

	it('publishes a row once there is', async () => {
		const id = await offered();
		await setUsername(db, userId, 'Flo', SEPTEMBER);
		const { entry, rank } = await claim(db, userId, id, null, SOON);

		expect(rank).toBe(1);
		expect(entry.value).toBe(340);

		const [board] = await monthBoards(db, '2026-09');
		expect(board.board).toBe('longest-drive');
		expect(board.entries[0]).toMatchObject({ rank: 1, username: 'Flo', value: 340 });
	});

	it('never publishes the car or the moment', async () => {
		const id = await offered();
		await setUsername(db, userId, 'Flo', SEPTEMBER);
		await claim(db, userId, id, null, SOON);

		const [board] = await monthBoards(db, '2026-09');
		const row = JSON.stringify(board.entries[0]);
		expect(row).not.toContain('L1NTEST00000000001');
		expect(row).not.toContain(String(SEPTEMBER));
	});

	it('refuses once the month has closed', async () => {
		const id = await offered();
		await setUsername(db, userId, 'Flo', SEPTEMBER);
		await expect(claim(db, userId, id, null, locksAt('2026-09') + 1)).rejects.toBeInstanceOf(
			ClaimRefused
		);
	});

	it('refuses a link that belongs to another trip', async () => {
		const id = await offered();
		await setUsername(db, userId, 'Flo', SEPTEMBER);
		await run(
			db,
			`INSERT INTO shares (id, user_id, kind, vmodel, start_time, end_time, time_zone,
				meta_json, created_at)
			 VALUES ('share1', ?, 'trip', 'F30b', ?, ?, ?, '{}', ?)`,
			userId,
			SEPTEMBER + 99999,
			SEPTEMBER + 99999,
			ZONE,
			SEPTEMBER
		);
		await expect(claim(db, userId, id, 'share1', SOON)).rejects.toMatchObject({ reason: 'share' });
	});

	it('marks the candidate as answered', async () => {
		const id = await offered();
		await setUsername(db, userId, 'Flo', SEPTEMBER);
		await claim(db, userId, id, null, SOON);
		expect((await listPending(db, userId, SOON)).map((c) => c.board)).not.toContain(
			'longest-drive'
		);
	});

	it('lists it among the places the account holds', async () => {
		const id = await offered();
		await setUsername(db, userId, 'Flo', SEPTEMBER);
		await claim(db, userId, id, null, SOON);

		const own = await listOwn(db, userId, SOON);
		expect(own).toHaveLength(1);
		expect(own[0]).toMatchObject({ board: 'longest-drive', month: '2026-09', rank: 1 });
		expect(own[0].locked).toBe(false);
		expect(own[0].value).toBe(340);
	});
});

describe('taking a place back down', () => {
	async function published(): Promise<string> {
		await detectCandidates(db, userId, summary({ trips: [longDrive(SEPTEMBER, 340)] }), ZONE, SOON);
		await setUsername(db, userId, 'Flo', SEPTEMBER);
		const pending = await pendingOn(userId, 'longest-drive');
		const { entry } = await claim(db, userId, pending.id, null, SOON);
		return entry.id;
	}

	it('removes it from the public board', async () => {
		const entryId = await published();
		expect(await removeEntry(db, userId, entryId)).toBe(true);
		expect(await monthBoards(db, '2026-09')).toEqual([]);
	});

	it('works after the month has locked, which is the point', async () => {
		const entryId = await published();
		expect(await removeEntry(db, userId, entryId)).toBe(true);
	});

	it('refuses to remove somebody else’s', async () => {
		const entryId = await published();
		const stranger = await account('stranger@example.com', 'stranger');
		expect(await removeEntry(db, stranger, entryId)).toBe(false);
	});

	it('does not come back as a fresh offer afterwards', async () => {
		const entryId = await published();
		await removeEntry(db, userId, entryId);
		expect((await listPending(db, userId, SOON)).map((c) => c.board)).not.toContain(
			'longest-drive'
		);
	});
});

describe('a board with several people on it', () => {
	async function place(email: string, name: string, km: number, month = SEPTEMBER) {
		const id = await account(email, name);
		await detectCandidates(db, id, summary({ trips: [longDrive(month, km)] }), ZONE, SOON);
		await claim(db, id, (await pendingOn(id, 'longest-drive')).id, null, SOON);
		return id;
	}

	it('orders them, and marks the reader’s own row', async () => {
		const second = await place('b@example.com', 'bea', 300);
		await place('a@example.com', 'ant', 500);

		const [board] = await monthBoards(db, '2026-09', second);
		expect(board.entries.map((e) => e.username)).toEqual(['ant', 'bea']);
		expect(board.entries[0].mine).toBeUndefined();
		expect(board.entries[1].mine).toBe(true);
	});

	it('leaves out anyone who has not chosen a name', async () => {
		await place('a@example.com', 'ant', 500);
		// A row written straight into the table by an account with no name.
		await run(
			db,
			`INSERT INTO board_entries (id, board, month, user_id, kind, vin, start_time, value,
				score, detail_json, vmodel, claimed_at)
			 VALUES ('nameless', ?, 'longest-drive', '2026-09', 'trip', 'VIN', ?, 9999, 9999, '{}', 'F30b', ?)`.replace(
				'(id, board, month, user_id,',
				'(id, user_id, board, month,'
			),
			userId,
			SEPTEMBER,
			SEPTEMBER
		);

		const [board] = await monthBoards(db, '2026-09');
		expect(board.entries.every((e) => e.username !== null)).toBe(true);
		expect(board.entries).toHaveLength(1);
	});
});

describe('the year', () => {
	it('gathers the months into one table, one place per person', async () => {
		const flo = await account('flo@example.com', 'flo');
		for (const [month, km] of [
			[Math.floor(Date.UTC(2026, 0, 14) / 1000), 300],
			[Math.floor(Date.UTC(2026, 1, 14) / 1000), 500]
		] as const) {
			await detectCandidates(db, flo, summary({ trips: [longDrive(month, km)] }), ZONE, month + 1);
			const pending = await pendingOn(flo, 'longest-drive', month + 1);
			await claim(db, flo, pending.id, null, month + 1);
		}

		const year = await yearBoards(db, 2026);
		const distance = year.boards.find((b) => b.board === 'longest-drive');
		expect(distance?.entries).toHaveLength(1);
		expect(distance?.entries[0].value).toBe(500);
		expect(distance?.winners).toHaveLength(2);
		expect(year.totals.people).toBe(1);
		expect(year.podiums[0]).toMatchObject({ username: 'flo', wins: 2 });
	});

	it('is empty for a year nobody entered', async () => {
		expect((await yearBoards(db, 2025)).boards).toEqual([]);
	});
});

describe('choosing a name', () => {
	it('takes an ordinary one and shows it as typed', async () => {
		expect(await setUsername(db, userId, 'Flo_S', SEPTEMBER)).toBe('Flo_S');
		const row = await one<{ username: string }>(
			db,
			'SELECT username FROM users WHERE id = ?',
			userId
		);
		expect(row?.username).toBe('Flo_S');
	});

	it('refuses one already taken, in any case', async () => {
		await setUsername(db, userId, 'Flo', SEPTEMBER);
		const other = await account('other@example.com');
		await expect(setUsername(db, other, 'flo', SEPTEMBER)).rejects.toBeInstanceOf(UsernameTaken);
	});

	it('refuses the shapes that could impersonate, and the reserved words', async () => {
		const refused = ['ab', 'a'.repeat(25), 'with space', 'admin', 'LogbooX', 'aa..bb', '_lead'];
		for (const name of refused) {
			await expect(setUsername(db, userId, name, SEPTEMBER)).rejects.toBeInstanceOf(
				UsernameInvalid
			);
		}
	});

	it('allows a change only once a day', async () => {
		await setUsername(db, userId, 'first', SEPTEMBER);
		await expect(setUsername(db, userId, 'second', SEPTEMBER + 3600)).rejects.toBeInstanceOf(
			UsernameTooSoon
		);
		expect(await setUsername(db, userId, 'second', SEPTEMBER + 86401)).toBe('second');
	});

	it('lets someone fix the capitals without spending the day', async () => {
		await setUsername(db, userId, 'flo', SEPTEMBER);
		expect(await setUsername(db, userId, 'Flo', SEPTEMBER + 60)).toBe('Flo');
	});
});
