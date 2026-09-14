/**
 * The second chance to hear about a place.
 *
 * The app says so the moment an upload finishes, which is no use to somebody
 * who imported an export and closed the tab. This is the fallback, and it is
 * deliberately reluctant: only offers nobody has looked at, only after two
 * days, only while the month will still be open when the message arrives, and
 * at most one message a week however many boards are involved.
 *
 * A place expiring unclaimed is a small loss. Being mailed about it twice is a
 * larger one.
 */

import { all, now as currentTime, run, type Db } from '../db';
import type { Mailer } from '../mail/mailer';
import { boardNudgeMail, yearRoundupMail } from '../mail/templates';
import { rotateUnsubscribeToken } from '../auth/users';
import { boardById, formatValue } from '$lib/leaderboard/boards';
import { isYearFinal, monthLabel, monthsOfYear } from '$lib/leaderboard/periods';

/** How long an offer sits unseen before it is worth a message. */
export const QUIET_SECONDS = 2 * 86400;

/** However many boards, one message a week. */
export const REPEAT_AFTER_SECONDS = 7 * 86400;

/**
 * How much of the month must be left for a message to be worth sending.
 *
 * A mail that arrives pointing at a board which shuts tomorrow is worse than
 * no mail: it is an invitation to something that will be refused.
 */
export const MIN_REMAINING_SECONDS = 2 * 86400;

/** One run's worth, well inside a Worker's budget. */
export const BATCH = 100;

interface PendingRow {
	id: string;
	user_id: string;
	email: string;
	board: string;
	month: string;
	value: number;
	rank_at_detection: number;
}

/**
 * Offers nobody has looked at, belonging to people who want to hear about them.
 *
 * Ordered oldest first, so a run that hits the batch limit works through the
 * backlog rather than favouring whoever uploaded most recently.
 */
export function findUnseen(db: Db, now: number, limit = BATCH): Promise<PendingRow[]> {
	return all<PendingRow>(
		db,
		`SELECT c.id, c.user_id, u.email, c.board, c.month, c.value, c.rank_at_detection
		 FROM board_candidates c
		 JOIN users u ON u.id = c.user_id
		 WHERE c.seen_at IS NULL AND c.mailed_at IS NULL
			AND c.entry_id IS NULL AND c.dismissed_at IS NULL
			AND c.created_at < ?1 - ?2
			AND c.locks_at > ?1 + ?3
			AND u.board_notify = 1
			AND (u.board_mailed_at IS NULL OR u.board_mailed_at < ?1 - ?4)
		 ORDER BY c.created_at
		 LIMIT ?5`,
		now,
		QUIET_SECONDS,
		MIN_REMAINING_SECONDS,
		REPEAT_AFTER_SECONDS,
		limit
	);
}

export interface NudgeReport {
	considered: number;
	sent: number;
	failed: number;
}

/**
 * Tells people what is waiting for them, one message per person.
 *
 * Marked as mailed before the message goes, as the reminder run does and for
 * the same reason: a run that dies halfway through must not mail anyone twice,
 * and the cost of that order is the occasional offer lost to a failed send.
 */
export async function sendBoardNudges(
	db: Db,
	mailer: Mailer,
	origin: string,
	now = currentTime()
): Promise<NudgeReport> {
	const rows = await findUnseen(db, now);

	const byUser = new Map<string, PendingRow[]>();
	for (const row of rows) {
		byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
	}

	let sent = 0;
	let failed = 0;

	for (const [userId, offers] of byUser) {
		await run(db, 'UPDATE users SET board_mailed_at = ? WHERE id = ?', now, userId);
		for (const offer of offers) {
			await run(db, 'UPDATE board_candidates SET mailed_at = ? WHERE id = ?', now, offer.id);
		}

		// Its own token, minted per message: turning these off must never touch
		// the way out of the export reminders.
		const token = await rotateUnsubscribeToken(db, userId, 'leaderboard');

		try {
			await mailer.send(
				boardNudgeMail(offers[0].email, {
					places: offers.map((offer) => {
						const board = boardById(offer.board);
						return {
							board: board?.label ?? offer.board,
							reading: board
								? `${formatValue(board, offer.value)} ${board.unit}`
								: String(offer.value),
							rank: offer.rank_at_detection,
							month: monthLabel(offer.month)
						};
					}),
					claimUrl: `${origin}/account#leaderboard`,
					unsubscribeUrl: `${origin}/unsubscribe?kind=leaderboard&token=${encodeURIComponent(token)}`
				})
			);
			sent++;
		} catch {
			failed++;
		}
	}

	return { considered: byUser.size, sent, failed };
}

interface RoundupRow {
	user_id: string;
	email: string;
	username: string | null;
	places: number;
	wins: number;
}

/**
 * One message at the end of a year, to the people who were in it.
 *
 * Sent once the last month has closed, so the numbers in it are final, and
 * only to people who actually put their name to something — a year in review
 * for somebody who never entered is just post.
 */
export async function sendYearRoundups(
	db: Db,
	mailer: Mailer,
	origin: string,
	now = currentTime()
): Promise<NudgeReport> {
	const year = new Date(now * 1000).getUTCFullYear() - 1;
	if (!isYearFinal(year, now)) return { considered: 0, sent: 0, failed: 0 };

	const months = monthsOfYear(year);
	const rows = await all<RoundupRow>(
		db,
		`SELECT e.user_id, u.email, u.username, COUNT(*) AS places,
			SUM(CASE WHEN e.score >= (
				SELECT MAX(b.score) FROM board_entries b
				WHERE b.board = e.board AND b.month = e.month AND b.removed_at IS NULL
			) THEN 1 ELSE 0 END) AS wins
		 FROM board_entries e
		 JOIN users u ON u.id = e.user_id
		 WHERE e.month >= ?1 AND e.month <= ?2 AND e.removed_at IS NULL
			AND u.board_notify = 1
			AND (u.roundup_mailed_year IS NULL OR u.roundup_mailed_year < ?3)
		 GROUP BY e.user_id
		 LIMIT ?4`,
		months[0],
		months[11],
		year,
		BATCH
	);

	let sent = 0;
	let failed = 0;

	for (const row of rows) {
		await run(db, 'UPDATE users SET roundup_mailed_year = ? WHERE id = ?', year, row.user_id);
		const token = await rotateUnsubscribeToken(db, row.user_id, 'leaderboard');

		try {
			await mailer.send(
				yearRoundupMail(row.email, {
					year,
					places: row.places,
					wins: row.wins,
					url: `${origin}/leaderboard/${year}`,
					unsubscribeUrl: `${origin}/unsubscribe?kind=leaderboard&token=${encodeURIComponent(token)}`
				})
			);
			sent++;
		} catch {
			failed++;
		}
	}

	return { considered: rows.length, sent, failed };
}
