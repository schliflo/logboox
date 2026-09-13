/**
 * Who gets reminded, and when.
 *
 * The whole feature turns on one judgement: overdue is measured from where the
 * newest export stops, not from when it was imported. Someone who uploads a
 * month-old export is already out of time, and a reminder a fortnight later
 * would be about a window that had closed.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ExportRecord } from '$lib/history/codec';
import { migratedDb, type TestDb } from '../testing/sqlite-d1';
import { now, one, run } from '../db';
import { findOrCreateUser, updateSettings } from '../auth/users';
import { beginExport, markComplete } from '../exports/repo';
import type { Mailer, Message } from '../mail/mailer';
import { REPEAT_AFTER_SECONDS, findDue, sendReminders } from './run';

let db: TestDb;

const DAY = 86400;

function record(endTime: number, overrides: Partial<ExportRecord> = {}): ExportRecord {
	return {
		id: 'DA0001',
		version: 1,
		exportId: 'DA0001',
		vin: 'L1NTEST00000000001',
		vmodel: 'F30b',
		keptAt: Date.now(),
		isDemo: false,
		startTime: endTime - 29 * DAY,
		endTime,
		rows: 1000,
		days: 30,
		distanceKm: 1200,
		trips: 40,
		storedBytes: 8 * 1024 * 1024,
		columns: [],
		available: { status: true, operation: true, power: true },
		duplicateRows: 0,
		unsortedStreams: [],
		emptyColumns: [],
		rowsParsed: 1000,
		bytesParsed: 1_000_000,
		aligned: true,
		coverage: [],
		...overrides
	} as unknown as ExportRecord;
}

function summary(endTime: number) {
	return {
		trips: [],
		charging: [],
		vehicle: {
			vin: 'L1NTEST00000000001',
			vmodel: 'F30b',
			lastSampleTime: endTime,
			odometerKm: 41207,
			soc: 60,
			rangeKm: 300
		}
	};
}

async function accountWithExport(
	email: string,
	endTime: number,
	options: { id?: string; isDemo?: boolean } = {}
) {
	const { user } = await findOrCreateUser(db, email);
	const id = options.id ?? 'DA0001';
	await beginExport(
		db,
		user.id,
		id,
		record(endTime, { id, exportId: id }),
		summary(endTime),
		options.isDemo ?? false
	);
	await markComplete(db, user.id, id);
	return user;
}

function collector(): Mailer & { sent: Message[] } {
	const sent: Message[] = [];
	return {
		sent,
		async send(message) {
			sent.push(message);
		}
	};
}

beforeEach(() => {
	db = migratedDb();
});

afterEach(() => {
	db.close();
});

describe('who is due', () => {
	it('nobody, when the newest export is recent', async () => {
		await accountWithExport('fresh@example.com', now() - 3 * DAY);
		expect(await findDue(db)).toHaveLength(0);
	});

	it('someone whose newest export stopped more than their threshold ago', async () => {
		await accountWithExport('stale@example.com', now() - 26 * DAY);
		const due = await findDue(db);

		expect(due).toHaveLength(1);
		expect(due[0].email).toBe('stale@example.com');
	});

	it('measures from where the export stops, not from when it arrived', async () => {
		// Imported a minute ago, but it speaks for a month that ended long since.
		await accountWithExport('backdated@example.com', now() - 40 * DAY);
		expect(await findDue(db)).toHaveLength(1);
	});

	it('respects a threshold the reader chose', async () => {
		// Past the default of 25 days, but not past a reader who waits until 29.
		const user = await accountWithExport('patient@example.com', now() - 26 * DAY);
		expect(await findDue(db)).toHaveLength(1);

		await updateSettings(db, user.id, { reminderAfterDays: 29 });
		expect(await findDue(db)).toHaveLength(0);
	});

	it('leaves alone anyone who turned reminders off', async () => {
		const user = await accountWithExport('quiet@example.com', now() - 40 * DAY);
		await updateSettings(db, user.id, { reminderEnabled: false });
		expect(await findDue(db)).toHaveLength(0);
	});

	it('has nothing to say to an account with no exports in it', async () => {
		await findOrCreateUser(db, 'empty@example.com');
		expect(await findDue(db)).toHaveLength(0);
	});

	it('does not count the demonstration month as a real export', async () => {
		await accountWithExport('demo@example.com', now() - 3 * DAY, {
			id: 'DEMO1',
			isDemo: true
		});
		expect(await findDue(db)).toHaveLength(0);
	});
});

describe('sending', () => {
	it('writes one message, and does not write it again the next day', async () => {
		await accountWithExport('stale@example.com', now() - 40 * DAY);
		const mailer = collector();

		const first = await sendReminders(db, mailer, 'https://logboox.app');
		expect(first.sent).toBe(1);
		expect(mailer.sent[0].subject).toContain('export');
		// The message says how much is already unaccounted for.
		expect(mailer.sent[0].text).toContain('40 days ago');

		const second = await sendReminders(db, mailer, 'https://logboox.app');
		expect(second.sent).toBe(0);
	});

	it('carries an unsubscribe link that works once and is replaced', async () => {
		await accountWithExport('stale@example.com', now() - 40 * DAY);
		const mailer = collector();
		await sendReminders(db, mailer, 'https://logboox.app');

		const first = /unsubscribe\?token=([^\s)]+)/.exec(mailer.sent[0].text)?.[1];
		expect(first).toBeTruthy();

		// A week on, the reader is due again and gets a different link.
		await run(db, 'UPDATE users SET reminded_at = ?', now() - REPEAT_AFTER_SECONDS - DAY);
		await sendReminders(db, mailer, 'https://logboox.app');

		const second = /unsubscribe\?token=([^\s)]+)/.exec(mailer.sent[1].text)?.[1];
		expect(second).toBeTruthy();
		expect(second).not.toBe(first);
	});

	it('speaks again once a week for someone who never acts on it', async () => {
		await accountWithExport('stale@example.com', now() - 40 * DAY);
		const mailer = collector();
		await sendReminders(db, mailer, 'https://logboox.app');

		await run(db, 'UPDATE users SET reminded_at = ?', now() - 3 * DAY);
		expect((await sendReminders(db, mailer, 'https://logboox.app')).sent).toBe(0);

		await run(db, 'UPDATE users SET reminded_at = ?', now() - REPEAT_AFTER_SECONDS - 1);
		expect((await sendReminders(db, mailer, 'https://logboox.app')).sent).toBe(1);
	});

	it('stops once a fresh export arrives, without being told to', async () => {
		const user = await accountWithExport('stale@example.com', now() - 40 * DAY);
		const mailer = collector();
		await sendReminders(db, mailer, 'https://logboox.app');

		// The reader did what the message asked. Nothing else has to happen:
		// the newest export is recent again, so the condition simply stops
		// being met, this week and every week after.
		const endTime = now() - DAY;
		await beginExport(
			db,
			user.id,
			'DA0002',
			record(endTime, { id: 'DA0002', exportId: 'DA0002' }),
			summary(endTime),
			false
		);
		await markComplete(db, user.id, 'DA0002');
		await run(db, 'UPDATE users SET reminded_at = ?', now() - REPEAT_AFTER_SECONDS - DAY);

		expect(await findDue(db)).toHaveLength(0);
		expect((await sendReminders(db, mailer, 'https://logboox.app')).sent).toBe(0);
	});

	it('marks the reader as reminded before the message goes, so a retry cannot repeat it', async () => {
		await accountWithExport('stale@example.com', now() - 40 * DAY);
		const angry: Mailer = {
			async send() {
				throw new Error('the mail server said no');
			}
		};

		const report = await sendReminders(db, angry, 'https://logboox.app');
		expect(report.failed).toBe(1);

		const row = await one<{ reminded_at: number | null }>(db, 'SELECT reminded_at FROM users');
		expect(row?.reminded_at).not.toBeNull();
		expect((await sendReminders(db, collector(), 'https://logboox.app')).sent).toBe(0);
	});

	it('sweeps up an upload that was begun and abandoned', async () => {
		const { user } = await findOrCreateUser(db, 'interrupted@example.com');
		const endTime = now() - 3 * DAY;
		await beginExport(
			db,
			user.id,
			'DA0009',
			record(endTime, { id: 'DA0009', exportId: 'DA0009' }),
			summary(endTime),
			false
		);
		await run(db, 'UPDATE exports SET uploaded_at = ? WHERE id = ?', now() - 2 * DAY, 'DA0009');

		const report = await sendReminders(db, collector(), 'https://logboox.app');
		expect(report.sweptUploads).toBe(1);

		const left = await one<{ n: number }>(db, 'SELECT COUNT(*) AS n FROM exports');
		expect(left?.n).toBe(0);
	});
});
