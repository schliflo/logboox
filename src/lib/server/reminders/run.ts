/**
 * The daily nudge.
 *
 * XPeng hands out a rolling thirty days, on request. Nobody notices the window
 * closing, and a month nobody asked for cannot be recovered afterwards — it is
 * simply gone. That is the entire justification for this app sending mail at
 * all, and the reason the message says how many days are already unaccounted
 * for rather than asking anyone to come back and engage with something.
 *
 * It can only speak for exports kept in an account: an export that lives in a
 * browser is invisible here, by design.
 */

import { all, now, run, type Db } from '../db';
import type { Mailer } from '../mail/mailer';
import { reminderMail } from '../mail/templates';
import { pruneMagicLinks } from '../auth/magic';
import { pruneSessions } from '../auth/session';
import { rotateUnsubscribeToken } from '../auth/users';
import { deleteExport, staleUploads } from '../exports/repo';
import { deletePrefix, exportPrefix } from '../exports/r2';

/** Once a week at most, however far past due someone is. */
export const REPEAT_AFTER_SECONDS = 7 * 86400;

/** One run's worth. Well inside a Worker's subrequest budget. */
export const BATCH = 100;

export const REQUEST_URL = 'https://www.xpeng.com/data-act';

interface DueRow {
	id: string;
	email: string;
	reminder_after_days: number;
	newest: number;
	vehicles: number;
}

/**
 * Who is overdue.
 *
 * Counted from where the newest export *stops*, not from when it was imported:
 * someone who uploads a month-old export is already nearly out of time, and
 * saying so a fortnight later would be useless.
 *
 * There is no condition for "a new export arrived". There does not need to be:
 * importing one moves `newest` forward, and the window closes on its own.
 */
export function findDue(db: Db, limit = BATCH): Promise<DueRow[]> {
	return all<DueRow>(
		db,
		`SELECT u.id, u.email, u.reminder_after_days,
			MAX(e.end_time) AS newest, COUNT(DISTINCT e.vin) AS vehicles
		 FROM users u
		 JOIN exports e ON e.user_id = u.id AND e.complete = 1 AND e.is_demo = 0
		 WHERE u.reminder_enabled = 1
		 GROUP BY u.id
		 HAVING newest < ?2 - (u.reminder_after_days * 86400)
			AND (u.reminded_at IS NULL OR u.reminded_at < ?2 - ?3)
		 ORDER BY newest
		 LIMIT ?1`,
		limit,
		now(),
		REPEAT_AFTER_SECONDS
	);
}

export interface ReminderReport {
	considered: number;
	sent: number;
	failed: number;
	sweptUploads: number;
	prunedLinks: number;
	prunedSessions: number;
}

/**
 * Sends what is due and tidies up behind it.
 *
 * `reminded_at` is written *before* the message goes, so a run that dies
 * halfway through, or is retried, does not mail anyone twice. The cost of that
 * order is a reminder occasionally lost to a failed send, which is plainly the
 * better of the two mistakes.
 */
export async function sendReminders(
	db: Db,
	mailer: Mailer,
	origin: string,
	storage?: R2Bucket
): Promise<ReminderReport> {
	const due = await findDue(db);
	let sent = 0;
	let failed = 0;

	for (const user of due) {
		await run(db, 'UPDATE users SET reminded_at = ? WHERE id = ?', now(), user.id);

		// Minted per message: the table keeps only a hash, so the link in the
		// mail has to be made at the moment the mail is.
		const token = await rotateUnsubscribeToken(db, user.id);

		try {
			await mailer.send(
				reminderMail(user.email, {
					staleDays: Math.floor((now() - user.newest) / 86400),
					vehicles: user.vehicles,
					requestUrl: REQUEST_URL,
					appUrl: origin,
					unsubscribeUrl: `${origin}/unsubscribe?token=${encodeURIComponent(token)}`
				})
			);
			sent++;
		} catch {
			failed++;
		}
	}

	return {
		considered: due.length,
		sent,
		failed,
		...(await sweep(db, storage))
	};
}

/**
 * Everything with a natural end: uploads that were begun and abandoned, spent
 * sign-in links, and sessions nobody will present again.
 */
async function sweep(
	db: Db,
	storage?: R2Bucket
): Promise<{ sweptUploads: number; prunedLinks: number; prunedSessions: number }> {
	const abandoned = (await staleUploads(db)) as unknown as Array<{ id: string; user_id: string }>;
	for (const row of abandoned) {
		await deleteExport(db, row.user_id, row.id);
		if (storage) await deletePrefix(storage, exportPrefix(row.user_id, row.id));
	}

	return {
		sweptUploads: abandoned.length,
		prunedLinks: await pruneMagicLinks(db),
		prunedSessions: await pruneSessions(db)
	};
}
