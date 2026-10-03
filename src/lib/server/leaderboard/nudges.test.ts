/**
 * When a place is worth an e-mail, which is rarely.
 *
 * Every test here is a reason not to send one. The message only exists for
 * somebody who imported an export and closed the tab, and the cost of getting
 * that wrong — mailing people about a game twice — is far worse than the cost
 * of a place quietly expiring.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { one, run } from '../db';
import { findOrCreateUser, findUserByUnsubscribeToken } from '../auth/users';
import type { Mailer, Message } from '../mail/mailer';
import {
	AWARD_WINDOW_SECONDS,
	MIN_REMAINING_SECONDS,
	QUIET_SECONDS,
	REPEAT_AFTER_SECONDS,
	lastLockedMonth,
	sendAwardMails,
	sendBoardNudges,
	sendYearRoundups
} from './nudges';
import { setUsername } from './username';
import { locksAt } from '#lib/leaderboard/periods.js';

const SEPTEMBER = Math.floor(Date.UTC(2026, 8, 14, 9, 0) / 1000);
const LOCKS = locksAt('2026-09');
/** Long after the offer was made, and long before the month shuts. */
const LATER = SEPTEMBER + QUIET_SECONDS + 3600;

const SECRET = 'test-mail-secret';

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
		const report = await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER);

		expect(report.sent).toBe(1);
		expect(mailer.sent[0].subject).toContain('#1');
		expect(mailer.sent[0].text).toContain('Nothing has been published');
	});

	it('says nothing while it is still fresh', async () => {
		await offer();
		const mailer = collector();
		expect(
			(await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, SEPTEMBER + 60)).sent
		).toBe(0);
	});

	it('says nothing about one already seen in the app', async () => {
		await offer({ seen_at: SEPTEMBER + 30 });
		const mailer = collector();
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER)).sent).toBe(0);
	});

	it('says nothing about one already claimed, or turned down', async () => {
		await offer({ entry_id: 'entry-1' });
		await offer({ dismissed_at: SEPTEMBER + 30, board: 'peak-charge' });
		const mailer = collector();
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER)).sent).toBe(0);
	});

	it('never writes twice about the same offer', async () => {
		await offer();
		const mailer = collector();
		await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER);
		expect(
			(await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER + 86400)).sent
		).toBe(0);
	});

	it('gathers several boards into one message', async () => {
		await offer({ board: 'longest-drive' });
		await offer({ board: 'peak-charge' });
		await offer({ board: 'biggest-charge' });

		const mailer = collector();
		const report = await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER);

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
		await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER);

		await offer({ board: 'peak-charge', created_at: LATER });
		expect(
			(await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER + 86400)).sent
		).toBe(0);
		expect(
			(
				await sendBoardNudges(
					db,
					mailer,
					'https://logboox.app',
					SECRET,
					LATER + REPEAT_AFTER_SECONDS + 60
				)
			).sent
		).toBe(1);
	});

	it('does not point at a board that shuts tomorrow', async () => {
		await offer();
		const mailer = collector();
		const tooLate = LOCKS - MIN_REMAINING_SECONDS + 60;
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, tooLate)).sent).toBe(
			0
		);
	});

	it('respects the switch', async () => {
		await offer();
		await run(db, 'UPDATE users SET board_notify = 0 WHERE id = ?', userId);
		const mailer = collector();
		expect((await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER)).sent).toBe(0);
	});

	it('carries a way out that is not the reminder link', async () => {
		await offer();
		const mailer = collector();
		await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER);
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
			SECRET,
			locksAt('2026-12') + 60
		);

		expect(report.sent).toBe(1);
		expect(mailer.sent[0].subject).toContain('2026');
	});

	it('says nothing while the year is still running', async () => {
		await heldAPlace('2026-09');
		const mailer = collector();
		expect((await sendYearRoundups(db, mailer, 'https://logboox.app', SECRET, LATER)).sent).toBe(0);
	});

	it('writes once, not every day afterwards', async () => {
		await heldAPlace('2026-09');
		const mailer = collector();
		const after = locksAt('2026-12') + 60;
		await sendYearRoundups(db, mailer, 'https://logboox.app', SECRET, after);
		expect(
			(await sendYearRoundups(db, mailer, 'https://logboox.app', SECRET, after + 86400)).sent
		).toBe(0);
	});

	it('says nothing to somebody who never entered', async () => {
		const mailer = collector();
		expect(
			(await sendYearRoundups(db, mailer, 'https://logboox.app', SECRET, locksAt('2026-12') + 60))
				.sent
		).toBe(0);
	});
});

describe('telling the podium', () => {
	const LOCKED = locksAt('2026-09') + 60;

	async function placed(email: string, name: string, score: number, board = 'longest-drive') {
		const id = (await findOrCreateUser(db, email)).user.id;
		await setUsername(db, id, name, SEPTEMBER);
		await run(
			db,
			`INSERT INTO board_entries (id, user_id, board, month, kind, vin, start_time, value,
				score, detail_json, vmodel, claimed_at)
			 VALUES (?, ?, ?, '2026-09', 'trip', 'VIN', ?, ?, ?, '{}', 'F30b', ?)`,
			`entry-${id}-${board}`,
			id,
			board,
			SEPTEMBER,
			score,
			score,
			SEPTEMBER
		);
		return id;
	}

	it('knows which month locked last', () => {
		expect(lastLockedMonth(LOCKED)).toBe('2026-09');
		expect(lastLockedMonth(LOCKED - 120)).toBe('2026-08');
	});

	it('writes to the top three once the month locks, with the badge in it', async () => {
		await placed('a@example.com', 'ant', 500);
		await placed('b@example.com', 'bea', 400);
		await placed('c@example.com', 'cat', 300);
		await placed('d@example.com', 'dan', 200);

		const mailer = collector();
		const report = await sendAwardMails(db, mailer, 'https://logboox.app', SECRET, LOCKED);

		expect(report.sent).toBe(3);
		expect(mailer.sent.map((message) => message.to).sort()).toEqual([
			'a@example.com',
			'b@example.com',
			'c@example.com'
		]);
		const gold = mailer.sent.find((message) => message.to === 'a@example.com')!;
		expect(gold.subject).toBe('Gold for longest drive — September 2026');
		expect(gold.html).toContain(
			'src="https://logboox.app/badge/2026-09/longest-drive/ant@2x.png" width="560" height="160"'
		);
		expect(gold.html).toContain('alt="ant — Gold, Longest drive, September 2026 · LogbooX"');
		expect(gold.html).toContain('https://logboox.app/account#leaderboard');
		expect(gold.text).toContain('https://logboox.app/badge/2026-09/longest-drive/ant@2x.png');
		expect(gold.text).toContain('https://logboox.app/leaderboard/2026-09');
		expect(gold.text).toContain('kind=leaderboard');
	});

	it('says nothing while the month is still open', async () => {
		await placed('a@example.com', 'ant', 500);
		const mailer = collector();
		expect((await sendAwardMails(db, mailer, 'https://logboox.app', SECRET, LATER)).sent).toBe(0);
	});

	it('gathers several medals into one message, and writes it once', async () => {
		await placed('a@example.com', 'ant', 500);
		const ant = (await findOrCreateUser(db, 'a@example.com')).user.id;
		await run(
			db,
			`INSERT INTO board_entries (id, user_id, board, month, kind, vin, start_time, value,
				score, detail_json, vmodel, claimed_at)
			 VALUES ('second', ?, 'peak-charge', '2026-09', 'charging', 'VIN', ?, 120, 120, '{}', 'F30b', ?)`,
			ant,
			SEPTEMBER,
			SEPTEMBER
		);

		const mailer = collector();
		await sendAwardMails(db, mailer, 'https://logboox.app', SECRET, LOCKED);
		expect(mailer.sent).toHaveLength(1);
		expect(mailer.sent[0].subject).toBe('2 medals on the September 2026 boards');

		expect(
			(await sendAwardMails(db, mailer, 'https://logboox.app', SECRET, LOCKED + 86400)).sent
		).toBe(0);
	});

	it('respects the switch', async () => {
		const ant = await placed('a@example.com', 'ant', 500);
		await run(db, 'UPDATE users SET board_notify = 0 WHERE id = ?', ant);
		const mailer = collector();
		expect((await sendAwardMails(db, mailer, 'https://logboox.app', SECRET, LOCKED)).sent).toBe(0);
	});

	it('stays quiet about a month that locked more than a fortnight ago', async () => {
		await placed('a@example.com', 'ant', 500);
		const mailer = collector();
		const late = locksAt('2026-09') + AWARD_WINDOW_SECONDS;
		expect((await sendAwardMails(db, mailer, 'https://logboox.app', SECRET, late)).sent).toBe(0);
	});

	it('says nothing about a place taken down before it ran', async () => {
		const ant = await placed('a@example.com', 'ant', 500);
		await run(db, 'UPDATE board_entries SET removed_at = ? WHERE user_id = ?', SEPTEMBER, ant);
		const mailer = collector();
		expect((await sendAwardMails(db, mailer, 'https://logboox.app', SECRET, LOCKED)).sent).toBe(0);
	});

	it('keeps the mark when the send fails', async () => {
		const ant = await placed('a@example.com', 'ant', 500);
		const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
		const down: Mailer = {
			async send() {
				throw new Error('down');
			}
		};
		const report = await sendAwardMails(db, down, 'https://logboox.app', SECRET, LOCKED);
		quiet.mockRestore();

		expect(report).toMatchObject({ sent: 0, failed: 1 });
		const user = await one<{ award_mailed_month: string | null }>(
			db,
			'SELECT award_mailed_month FROM users WHERE id = ?',
			ant
		);
		expect(user?.award_mailed_month).toBe('2026-09');
		expect(
			(await sendAwardMails(db, collector(), 'https://logboox.app', SECRET, LOCKED + 86400))
				.considered
		).toBe(0);
	});

	it('puts the year medals into the roundup', async () => {
		await placed('a@example.com', 'ant', 500);
		await placed('b@example.com', 'bea', 400);
		const mailer = collector();
		await sendYearRoundups(db, mailer, 'https://logboox.app', SECRET, locksAt('2026-12') + 60);

		const ant = mailer.sent.find((message) => message.to === 'a@example.com')!;
		expect(ant.text).toContain('you took gold for longest drive');
		expect(ant.html).toContain('https://logboox.app/badge/2026/longest-drive/ant@2x.png');
		expect(ant.text).toContain('https://logboox.app/account#leaderboard');
		const bea = mailer.sent.find((message) => message.to === 'b@example.com')!;
		expect(bea.html).toContain('/badge/2026/longest-drive/bea@2x.png');
		expect(bea.html).not.toContain('/ant@2x.png');
	});
});

describe('when the sender fails', () => {
	const down: Mailer = {
		async send() {
			throw new Error('sender not verified');
		}
	};

	async function heldAPlace() {
		await run(
			db,
			`INSERT INTO board_entries (id, user_id, board, month, kind, vin, start_time, value,
				score, detail_json, vmodel, claimed_at)
			 VALUES (?, ?, 'longest-drive', '2026-09', 'trip', 'VIN', ?, 340, 340, '{}', 'F30b', ?)`,
			`entry-${Math.random()}`,
			userId,
			SEPTEMBER,
			SEPTEMBER
		);
	}

	it('counts the failure, logs the user id, and keeps the marks', async () => {
		const candidate = await offer();
		const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

		const report = await sendBoardNudges(db, down, 'https://logboox.app', SECRET, LATER);

		const lines = logged.mock.calls.map((call) => call.join(' ')).join('\n');
		logged.mockRestore();
		expect(report).toMatchObject({ sent: 0, failed: 1 });
		expect(lines).toContain(userId);
		expect(lines).not.toContain('reader@example.com');

		const row = await one<{ mailed_at: number | null }>(
			db,
			'SELECT mailed_at FROM board_candidates WHERE id = ?',
			candidate
		);
		const user = await one<{ board_mailed_at: number | null }>(
			db,
			'SELECT board_mailed_at FROM users WHERE id = ?',
			userId
		);
		expect(row?.mailed_at).toBe(LATER);
		expect(user?.board_mailed_at).toBe(LATER);

		// Not tomorrow, but after the week.
		const mailer = collector();
		expect(
			(await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER + 86400)).sent
		).toBe(0);
	});

	it('gives up after three failures in a row and leaves the rest unmarked', async () => {
		for (let i = 0; i < 5; i++) {
			const { user } = await findOrCreateUser(db, `other${i}@example.com`);
			userId = user.id;
			// Oldest offer first, so the order they are tried in is known.
			await offer({ created_at: SEPTEMBER - 100 + i });
		}
		let attempts = 0;
		const counting: Mailer = {
			async send() {
				attempts++;
				throw new Error('down');
			}
		};
		const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});

		const report = await sendBoardNudges(db, counting, 'https://logboox.app', SECRET, LATER);
		quiet.mockRestore();

		expect(attempts).toBe(3);
		expect(report.failed).toBe(3);
		const marked = await one<{ n: number }>(
			db,
			'SELECT COUNT(*) AS n FROM users WHERE board_mailed_at IS NOT NULL'
		);
		expect(marked?.n).toBe(3);
		const candidates = await one<{ n: number }>(
			db,
			'SELECT COUNT(*) AS n FROM board_candidates WHERE mailed_at IS NOT NULL'
		);
		expect(candidates?.n).toBe(3);

		// Tomorrow the two behind them are reached, not the three that failed.
		const mailer = collector();
		const next = await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER + 86400);
		expect(next.sent).toBe(2);
		expect(mailer.sent.map((message) => message.to).sort()).toEqual([
			'other3@example.com',
			'other4@example.com'
		]);
	});

	it('counts a failed roundup and leaves its mark, so it cannot hold up the queue', async () => {
		await heldAPlace();
		const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
		const after = locksAt('2026-12') + 60;

		const report = await sendYearRoundups(db, down, 'https://logboox.app', SECRET, after);
		quiet.mockRestore();

		expect(report).toMatchObject({ sent: 0, failed: 1 });
		const user = await one<{ roundup_mailed_year: number | null }>(
			db,
			'SELECT roundup_mailed_year FROM users WHERE id = ?',
			userId
		);
		expect(user?.roundup_mailed_year).toBe(2026);

		const mailer = collector();
		expect(
			(await sendYearRoundups(db, mailer, 'https://logboox.app', SECRET, after + 86400)).considered
		).toBe(0);
	});
});

describe('the way out', () => {
	it('leaves a link in a nudge alive when a roundup follows it', async () => {
		await offer();
		await run(
			db,
			`INSERT INTO board_entries (id, user_id, board, month, kind, vin, start_time, value,
				score, detail_json, vmodel, claimed_at)
			 VALUES ('entry-1', ?, 'longest-drive', '2026-09', 'trip', 'VIN', ?, 340, 340, '{}', 'F30b', ?)`,
			userId,
			SEPTEMBER,
			SEPTEMBER
		);
		const mailer = collector();
		await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER);
		await sendYearRoundups(db, mailer, 'https://logboox.app', SECRET, locksAt('2026-12') + 60);

		expect(mailer.sent).toHaveLength(2);
		for (const message of mailer.sent) {
			const token = /unsubscribe\?token=([^&\s]+)&kind=leaderboard/.exec(message.text)?.[1];
			expect(token).toBeTruthy();
			const user = await findUserByUnsubscribeToken(
				db,
				SECRET,
				decodeURIComponent(token!),
				'leaderboard'
			);
			expect(user?.id).toBe(userId);
			// Signed for this kind only.
			expect(
				await findUserByUnsubscribeToken(db, SECRET, decodeURIComponent(token!), 'reminders')
			).toBeNull();
			expect(message.headers?.['List-Unsubscribe']).toBe(
				`<https://logboox.app/unsubscribe?token=${token}&kind=leaderboard>`
			);
			expect(message.headers).not.toHaveProperty('List-Unsubscribe-Post');
		}
	});

	it('closes the plain text with the imprint and privacy links', async () => {
		await offer();
		const mailer = collector();
		await sendBoardNudges(db, mailer, 'https://logboox.app', SECRET, LATER);
		expect(mailer.sent[0].text).toContain('https://logboox.app/legal/imprint');
		expect(mailer.sent[0].text).toContain('https://logboox.app/legal/privacy');
	});
});
