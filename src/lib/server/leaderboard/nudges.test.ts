/**
 * When a place is worth an e-mail, which is rarely.
 *
 * Every test here is a reason not to send one. The message only exists for
 * somebody who imported an export and closed the tab, and the cost of getting
 * that wrong — mailing people about a game twice — is far worse than the cost
 * of a place quietly expiring.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { run } from '../db';
import { findOrCreateUser } from '../auth/users';
import type { Mailer, Message } from '../mail/mailer';
import {
	MIN_REMAINING_SECONDS,
	QUIET_SECONDS,
	REPEAT_AFTER_SECONDS,
	sendBoardNudges,
	sendYearRoundups
} from './nudges';
import { locksAt } from '$lib/leaderboard/periods';

const SEPTEMBER = Math.floor(Date.UTC(2026, 8, 14, 9, 0) / 1000);
const LOCKS = locksAt('2026-09');
/** Long after the offer was made, and long before the month shuts. */
const LATER = SEPTEMBER + QUIET_SECONDS + 3600;

let db: TestDb;
let userId: string;

function collector(): Mailer & { sent: Message[] } {
	const sent: Message[] = [];
	return {
		sent,
		async send(message) {
			sent.push(message);
		}
	};
}

async function offer(overrides: Record<string, unknown> = {}): Promise<string> {
	const id = `cand-${Math.random().toString(36).slice(2)}`;
	const row = {
		id,
		user_id: userId,
		board: 'longest-drive',
		month: '2026-09',
		locks_at: LOCKS,
		kind: 'trip',
		vin: 'VIN',
		start_time: SEPTEMBER,
		value: 340,
		score: 340,
		detail_json: '{}',
		vmodel: 'F30b',
		rank_at_detection: 1,
		created_at: SEPTEMBER,
		seen_at: null,
		mailed_at: null,
		dismissed_at: null,
		entry_id: null,
		...overrides
	};

	await run(
		db,
		`INSERT INTO board_candidates (id, user_id, board, month, locks_at, kind, vin, start_time,
			value, score, detail_json, vmodel, rank_at_detection, created_at, seen_at, mailed_at,
			dismissed_at, entry_id)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		row.id,
		row.user_id,
		row.board,
		row.month,
		row.locks_at,
		row.kind,
		row.vin,
		row.start_time,
		row.value,
		row.score,
		row.detail_json,
		row.vmodel,
		row.rank_at_detection,
		row.created_at,
		row.seen_at,
		row.mailed_at,
		row.dismissed_at,
		row.entry_id
	);
	return id;
}

beforeEach(async () => {
	db = migratedDb();
	userId = (await findOrCreateUser(db, 'reader@example.com')).user.id;
});

afterEach(() => {
	db.close();
});

describe('telling someone what is waiting', () => {
	it('writes once the offer has sat unseen for two days', async () => {
		await offer();
		const mailer = collector();
		const report = await sendBoardNudges(db, mailer, 'https://logboox.app', LATER);

		expect(report.sent).toBe(1);
		expect(mailer.sent[0].subject).toContain('#1');
		expect(mailer.sent[0].text).toContain('Nothing has been published');
	});

	it('says nothing while it is still fresh', async () => {
		await offer();
		const mailer = collector();
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', SEPTEMBER + 60)).sent).toBe(0);
	});

	it('says nothing about one already seen in the app', async () => {
		await offer({ seen_at: SEPTEMBER + 30 });
		const mailer = collector();
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', LATER)).sent).toBe(0);
	});

	it('says nothing about one already claimed, or turned down', async () => {
		await offer({ entry_id: 'entry-1' });
		await offer({ dismissed_at: SEPTEMBER + 30, board: 'peak-charge' });
		const mailer = collector();
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', LATER)).sent).toBe(0);
	});

	it('never writes twice about the same offer', async () => {
		await offer();
		const mailer = collector();
		await sendBoardNudges(db, mailer, 'https://logboox.app', LATER);
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', LATER + 86400)).sent).toBe(0);
	});

	it('gathers several boards into one message', async () => {
		await offer({ board: 'longest-drive' });
		await offer({ board: 'peak-charge' });
		await offer({ board: 'biggest-charge' });

		const mailer = collector();
		const report = await sendBoardNudges(db, mailer, 'https://logboox.app', LATER);

		expect(report.sent).toBe(1);
		expect(mailer.sent).toHaveLength(1);
		// Named by the count of places rather than of trips: a month's mileage is
		// a place too, and it is not a trip.
		expect(mailer.sent[0].subject).toContain('3 places');
		expect(mailer.sent[0].subject).not.toMatch(/trip/i);
	});

	it('keeps a week between messages, however much turns up', async () => {
		await offer();
		const mailer = collector();
		await sendBoardNudges(db, mailer, 'https://logboox.app', LATER);

		await offer({ board: 'peak-charge', created_at: LATER });
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', LATER + 86400)).sent).toBe(0);
		expect(
			(await sendBoardNudges(db, mailer, 'https://logboox.app', LATER + REPEAT_AFTER_SECONDS + 60))
				.sent
		).toBe(1);
	});

	it('does not point at a board that shuts tomorrow', async () => {
		await offer();
		const mailer = collector();
		const tooLate = LOCKS - MIN_REMAINING_SECONDS + 60;
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', tooLate)).sent).toBe(0);
	});

	it('respects the switch', async () => {
		await offer();
		await run(db, 'UPDATE users SET board_notify = 0 WHERE id = ?', userId);
		const mailer = collector();
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', LATER)).sent).toBe(0);
	});

	it('carries a way out that is not the reminder link', async () => {
		await offer();
		const mailer = collector();
		await sendBoardNudges(db, mailer, 'https://logboox.app', LATER);
		expect(mailer.sent[0].text).toContain('kind=leaderboard');
	});
});

describe('the year in review', () => {
	async function heldAPlace(month: string) {
		await run(
			db,
			`INSERT INTO board_entries (id, user_id, board, month, kind, vin, start_time, value,
				score, detail_json, vmodel, claimed_at)
			 VALUES (?, ?, 'longest-drive', ?, 'trip', 'VIN', ?, 340, 340, '{}', 'F30b', ?)`,
			`entry-${month}`,
			userId,
			month,
			SEPTEMBER,
			SEPTEMBER
		);
	}

	it('writes once the last month of the year has closed', async () => {
		await heldAPlace('2026-09');
		const mailer = collector();
		const report = await sendYearRoundups(
			db,
			mailer,
			'https://logboox.app',
			locksAt('2026-12') + 60
		);

		expect(report.sent).toBe(1);
		expect(mailer.sent[0].subject).toContain('2026');
	});

	it('says nothing while the year is still running', async () => {
		await heldAPlace('2026-09');
		const mailer = collector();
		expect((await sendYearRoundups(db, mailer, 'https://logboox.app', LATER)).sent).toBe(0);
	});

	it('writes once, not every day afterwards', async () => {
		await heldAPlace('2026-09');
		const mailer = collector();
		const after = locksAt('2026-12') + 60;
		await sendYearRoundups(db, mailer, 'https://logboox.app', after);
		expect((await sendYearRoundups(db, mailer, 'https://logboox.app', after + 86400)).sent).toBe(0);
	});

	it('says nothing to somebody who never entered', async () => {
		const mailer = collector();
		expect(
			(await sendYearRoundups(db, mailer, 'https://logboox.app', locksAt('2026-12') + 60)).sent
		).toBe(0);
	});
});
