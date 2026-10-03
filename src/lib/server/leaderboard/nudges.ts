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
import { failureStreak, logSendFailure, type FailureStreak } from '../mail/batch';
import type { Mailer } from '../mail/mailer';
import { awardMail, boardNudgeMail, yearRoundupMail, type BadgeFacts } from '../mail/templates';
import { unsubscribeLinks } from '../mail/unsubscribe';
import { yearBoards } from './repo';
import { boardById, formatValue, type BoardId } from '#lib/leaderboard/boards.js';
import { badgeAlt, badgePath, medalFor, periodLabel, type Medal } from '#lib/leaderboard/medals.js';
import {
	isYearFinal,
	locksAt,
	monthLabel,
	monthOf,
	monthsOfYear,
	previousMonth
} from '#lib/leaderboard/periods.js';

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

/**
 * How long after a month locks its medals are still news. Past this a first
 * deploy or an outage stays quiet rather than mailing about old months.
 */
export const AWARD_WINDOW_SECONDS = 14 * 86400;

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
 * the same reason: a run that dies halfway through must not mail anyone twice.
 * A failed send keeps its marks, so an address that is refused for good does
 * not head the queue every day, and three in a row end the batch; see
 * mail/batch.ts. The offers it was about are never mailed again — only offers
 * not yet mailed are picked up — though the app still shows them. The
 * `streak` is shared with the rest of the daily run when there is one.
 */
export async function sendBoardNudges(
	db: Db,
	mailer: Mailer,
	origin: string,
	mailSecret: string,
	now = currentTime(),
	streak: FailureStreak = failureStreak()
): Promise<NudgeReport> {
	const rows = await findUnseen(db, now);

	const byUser = new Map<string, PendingRow[]>();
	for (const row of rows) {
		byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
	}

	let sent = 0;
	let failed = 0;

	for (const [userId, offers] of byUser) {
		if (streak.stopped) break;
		await run(db, 'UPDATE users SET board_mailed_at = ? WHERE id = ?', now, userId);
		for (const offer of offers) {
			await run(db, 'UPDATE board_candidates SET mailed_at = ? WHERE id = ?', now, offer.id);
		}

		// Its own kind: turning these off must never touch the way out of the
		// export reminders.
		const links = await unsubscribeLinks(origin, mailSecret, userId, 'leaderboard');

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
					...links
				})
			);
			sent++;
			streak.succeeded();
		} catch (error) {
			logSendFailure('board nudge', userId, error);
			failed++;
			streak.failed();
		}
	}

	return { considered: byUser.size, sent, failed };
}

/** A medal as a mail shows it, with the badge's own address. */
function badgeFacts(
	origin: string,
	period: string,
	boardId: string,
	username: string,
	medal: Medal,
	value: number
): BadgeFacts {
	const board = boardById(boardId);
	return {
		medal,
		board: board?.label ?? boardId,
		reading: board ? `${formatValue(board, value)} ${board.unit}` : String(value),
		period: periodLabel(period),
		imageUrl: `${origin}${badgePath(period, boardId, username, 2)}`,
		alt: badgeAlt({ period, board: boardId as BoardId, medal }, username)
	};
}

/** The latest month that has locked by `now`. */
export function lastLockedMonth(now: number): string {
	let month = monthOf(now, 'UTC');
	while (locksAt(month) > now) month = previousMonth(month);
	return month;
}

interface AwardRow {
	user_id: string;
	email: string;
	username: string;
	board: string;
	value: number;
	rank: number;
}

/**
 * Tells the top three of each board that they won something, once the month
 * has locked and the podium cannot change under them.
 *
 * Only the latest locked month, and only for a fortnight after it locks. The
 * same discipline as the nudges: marked before sending, the mark kept when a
 * send fails, and one message per person however many medals.
 */
export async function sendAwardMails(
	db: Db,
	mailer: Mailer,
	origin: string,
	mailSecret: string,
	now = currentTime(),
	streak: FailureStreak = failureStreak()
): Promise<NudgeReport> {
	const month = lastLockedMonth(now);
	if (streak.stopped || now >= locksAt(month) + AWARD_WINDOW_SECONDS) {
		return { considered: 0, sent: 0, failed: 0 };
	}

	const rows = await all<AwardRow>(
		db,
		`SELECT r.user_id, u.email, u.username, r.board, r.value, r.rank FROM (
			SELECT e.user_id AS user_id, e.board AS board, e.value AS value,
				RANK() OVER (PARTITION BY e.board ORDER BY e.score DESC) AS rank
			FROM board_entries e
			JOIN users u ON u.id = e.user_id
			WHERE e.month = ?1 AND e.removed_at IS NULL AND u.username IS NOT NULL
		) r
		JOIN users u ON u.id = r.user_id
		WHERE r.rank <= 3 AND u.board_notify = 1
			AND (u.award_mailed_month IS NULL OR u.award_mailed_month < ?1)
		ORDER BY r.user_id, r.rank`,
		month
	);

	const byUser = new Map<string, AwardRow[]>();
	for (const row of rows) {
		if (!boardById(row.board)) continue;
		if (!byUser.has(row.user_id) && byUser.size >= BATCH) continue;
		byUser.set(row.user_id, [...(byUser.get(row.user_id) ?? []), row]);
	}

	let sent = 0;
	let failed = 0;

	for (const [userId, medals] of byUser) {
		if (streak.stopped) break;
		// Conditional, so two runs that overlap cannot both claim the same person.
		const marked = await run(
			db,
			`UPDATE users SET award_mailed_month = ?1 WHERE id = ?2
			 AND (award_mailed_month IS NULL OR award_mailed_month < ?1)`,
			month,
			userId
		);
		if (marked === 0) continue;
		const links = await unsubscribeLinks(origin, mailSecret, userId, 'leaderboard');
		const { email, username } = medals[0];

		try {
			await mailer.send(
				awardMail(email, {
					month: monthLabel(month),
					badges: medals.map((row) =>
						badgeFacts(origin, month, row.board, username, medalFor(row.rank)!, row.value)
					),
					boardUrl: `${origin}/leaderboard/${month}`,
					embedUrl: `${origin}/account#leaderboard`,
					...links
				})
			);
			sent++;
			streak.succeeded();
		} catch (error) {
			logSendFailure('award', userId, error);
			failed++;
			streak.failed();
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
 *
 * A failed send keeps its mark like the other two, which here means the
 * message is not retried at all. Putting it back would let three refused
 * addresses stop the batch every day, and a year in review is not worth that.
 */
export async function sendYearRoundups(
	db: Db,
	mailer: Mailer,
	origin: string,
	mailSecret: string,
	now = currentTime(),
	streak: FailureStreak = failureStreak()
): Promise<NudgeReport> {
	const year = new Date(now * 1000).getUTCFullYear() - 1;
	if (streak.stopped || !isYearFinal(year, now)) return { considered: 0, sent: 0, failed: 0 };

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

	// The year's own podium, read once for the whole run and matched by name.
	const medals = new Map<string, BadgeFacts[]>();
	if (rows.length > 0) {
		for (const listing of (await yearBoards(db, year)).boards) {
			for (const entry of listing.entries) {
				const medal = medalFor(entry.rank);
				if (!medal) continue;
				const key = entry.username.toLowerCase();
				medals.set(key, [
					...(medals.get(key) ?? []),
					badgeFacts(origin, String(year), listing.board, entry.username, medal, entry.value)
				]);
			}
		}
	}

	let sent = 0;
	let failed = 0;

	for (const row of rows) {
		if (streak.stopped) break;
		await run(db, 'UPDATE users SET roundup_mailed_year = ? WHERE id = ?', year, row.user_id);
		const links = await unsubscribeLinks(origin, mailSecret, row.user_id, 'leaderboard');

		try {
			await mailer.send(
				yearRoundupMail(row.email, {
					year,
					places: row.places,
					wins: row.wins,
					url: `${origin}/leaderboard/${year}`,
					badges: row.username ? (medals.get(row.username.toLowerCase()) ?? []) : [],
					embedUrl: `${origin}/account#leaderboard`,
					...links
				})
			);
			sent++;
			streak.succeeded();
		} catch (error) {
			logSendFailure('year roundup', row.user_id, error);
			failed++;
			streak.failed();
		}
	}

	return { considered: rows.length, sent, failed };
}
