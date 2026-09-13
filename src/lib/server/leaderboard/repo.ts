/**
 * Spotting, claiming and publishing places on a board.
 *
 * Two tables and a hard line between them. A candidate is the app noticing
 * that one of your trips would rank; it is private to your account and it
 * publishes nothing. An entry is you having said yes, and that is the table
 * strangers read. Nothing crosses from one to the other without a request from
 * the person it belongs to.
 *
 * Everything is ranked on `score` rather than `value`, which is the value
 * turned so that larger always wins. One index and one comparison then serve
 * seven boards, including the one where using less is better.
 */

import type { ExportSummary, SessionSummary, TripSummary } from '$lib/data/analytics/summary';
import {
	BOARDS,
	TOP_N,
	boardById,
	scoreOf,
	valueFor,
	type Board,
	type BoardEntryDetail,
	type BoardId,
	type BoardKind
} from '$lib/leaderboard/boards';
import { isMonthOpen, locksAt, monthOf, monthKey } from '$lib/leaderboard/periods';
import { all, now as currentTime, one, rowId, run, type Db, type Statement } from '../db';

export interface CandidateRow {
	id: string;
	user_id: string;
	board: string;
	month: string;
	locks_at: number;
	kind: string;
	vin: string;
	start_time: number;
	value: number;
	score: number;
	detail_json: string;
	vmodel: string;
	rank_at_detection: number;
	created_at: number;
	seen_at: number | null;
	mailed_at: number | null;
	dismissed_at: number | null;
	entry_id: string | null;
}

export interface EntryRow {
	id: string;
	board: string;
	month: string;
	user_id: string;
	kind: string;
	vin: string;
	start_time: number;
	value: number;
	score: number;
	detail_json: string;
	vmodel: string;
	share_id: string | null;
	claimed_at: number;
	removed_at: number | null;
}

/** A candidate as the account sees it. */
export interface Candidate {
	id: string;
	board: BoardId;
	month: string;
	kind: BoardKind;
	value: number;
	rank: number;
	locksAt: number;
	startTime: number;
	vin: string;
	detail: BoardEntryDetail;
	createdAt: number;
	seen: boolean;
}

/** One row of a public board. Nothing here names a car or an owner. */
export interface PublicEntry {
	rank: number;
	username: string;
	vmodel: string;
	value: number;
	detail: BoardEntryDetail;
	shareId: string | null;
	claimedAt: number;
	/** Set only for the signed-in reader's own rows. */
	mine?: true;
}

export interface BoardListing {
	board: BoardId;
	entries: PublicEntry[];
}

export class ClaimRefused extends Error {
	constructor(
		message: string,
		readonly reason: 'gone' | 'closed' | 'username-required' | 'share' | 'outranked'
	) {
		super(message);
		this.name = 'ClaimRefused';
	}
}

function detailOf(row: { detail_json: string }): BoardEntryDetail {
	try {
		return JSON.parse(row.detail_json) as BoardEntryDetail;
	} catch {
		return {};
	}
}

function toCandidate(row: CandidateRow): Candidate {
	return {
		id: row.id,
		board: row.board as BoardId,
		month: row.month,
		kind: row.kind as BoardKind,
		value: row.value,
		rank: row.rank_at_detection,
		locksAt: row.locks_at,
		startTime: row.start_time,
		vin: row.vin,
		detail: detailOf(row),
		createdAt: row.created_at,
		seen: row.seen_at !== null
	};
}

/** The best item this export offers each board, per month it is still open for. */
function bestPerBoard(
	summary: ExportSummary,
	timeZone: string,
	now: number
): Array<{ board: Board; month: string; item: TripSummary | SessionSummary; value: number }> {
	const best = new Map<
		string,
		{ board: Board; month: string; item: TripSummary | SessionSummary; value: number }
	>();

	for (const board of BOARDS) {
		const items: Array<TripSummary | SessionSummary> =
			board.kind === 'trip' ? summary.trips : summary.charging;

		for (const item of items) {
			const month = monthOf(item.startTime, timeZone);
			if (!isMonthOpen(month, now)) continue;

			const value = valueFor(board, item);
			if (value === null) continue;

			const key = `${board.id}|${month}`;
			const found = best.get(key);
			if (!found || scoreOf(board, value) > scoreOf(board, found.value)) {
				best.set(key, { board, month, item, value });
			}
		}
	}

	return [...best.values()];
}

/**
 * Looks at what an upload just added and records anything that would rank.
 *
 * Runs once per completed upload. At most one candidate per board per month
 * survives, because being told seven times about seven trips to the same board
 * is how someone decides to turn the whole thing off.
 */
export async function detectCandidates(
	db: Db,
	userId: string,
	summary: ExportSummary,
	timeZone: string,
	now = currentTime()
): Promise<Candidate[]> {
	const vin = summary.vehicle.vin;
	const vmodel = summary.vehicle.vmodel;
	const wanted: Array<{ row: CandidateRow; statement: Statement }> = [];

	for (const found of bestPerBoard(summary, timeZone, now)) {
		const { board, month, item, value } = found;
		const score = scoreOf(board, value);

		// Nothing to say when they already hold this place with something better.
		const mine = await one<{ score: number }>(
			db,
			`SELECT score FROM board_entries
			 WHERE board = ? AND month = ? AND user_id = ? AND removed_at IS NULL`,
			board.id,
			month,
			userId
		);
		if (mine && mine.score >= score) continue;

		const better = await one<{ n: number }>(
			db,
			`SELECT COUNT(*) AS n FROM board_entries
			 WHERE board = ? AND month = ? AND removed_at IS NULL AND user_id != ? AND score > ?`,
			board.id,
			month,
			userId,
			score
		);
		const rank = (better?.n ?? 0) + 1;
		if (rank > TOP_N) continue;

		const row: CandidateRow = {
			id: rowId(),
			user_id: userId,
			board: board.id,
			month,
			locks_at: locksAt(month),
			kind: board.kind,
			vin,
			start_time: item.startTime,
			value,
			score,
			detail_json: JSON.stringify(board.detail(item)),
			vmodel,
			rank_at_detection: rank,
			created_at: now,
			seen_at: null,
			mailed_at: null,
			dismissed_at: null,
			entry_id: null
		};

		wanted.push({
			row,
			statement: db
				.prepare(
					`INSERT INTO board_candidates (id, user_id, board, month, locks_at, kind, vin,
						start_time, value, score, detail_json, vmodel, rank_at_detection, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
					 ON CONFLICT (user_id, board, month) DO UPDATE SET
						locks_at = excluded.locks_at, kind = excluded.kind, vin = excluded.vin,
						start_time = excluded.start_time, value = excluded.value, score = excluded.score,
						detail_json = excluded.detail_json, vmodel = excluded.vmodel,
						rank_at_detection = excluded.rank_at_detection, created_at = excluded.created_at,
						seen_at = NULL, mailed_at = NULL, entry_id = NULL,
						-- A place they turned down stays turned down, unless the new one
						-- is good enough to be a different proposition altogether.
						dismissed_at = CASE WHEN excluded.rank_at_detection <= 3 THEN NULL
							ELSE board_candidates.dismissed_at END
					 WHERE excluded.score > board_candidates.score`
				)
				.bind(
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
					row.created_at
				)
		});
	}

	if (wanted.length === 0) return [];

	const results = (await db.batch(wanted.map((entry) => entry.statement))) as Array<{
		meta?: { changes?: number };
	}>;

	// Only the rows the upsert actually took: an export re-uploaded unchanged
	// must not announce the same trip a second time.
	return wanted
		.filter((_, index) => (results[index]?.meta?.changes ?? 0) > 0)
		.map((entry) => toCandidate(entry.row));
}

/** Candidates still waiting on an answer, newest first. */
export async function listPending(
	db: Db,
	userId: string,
	now = currentTime()
): Promise<Candidate[]> {
	const rows = await all<CandidateRow>(
		db,
		`SELECT * FROM board_candidates
		 WHERE user_id = ? AND entry_id IS NULL AND dismissed_at IS NULL AND locks_at > ?
		 ORDER BY created_at DESC, board`,
		userId,
		now
	);
	return rows.map(toCandidate);
}

export async function markSeen(db: Db, userId: string, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	const marks = ids.map((id) =>
		db
			.prepare(
				'UPDATE board_candidates SET seen_at = ? WHERE id = ? AND user_id = ? AND seen_at IS NULL'
			)
			.bind(currentTime(), id, userId)
	);
	await db.batch(marks);
}

export async function dismiss(db: Db, userId: string, id: string): Promise<boolean> {
	const changed = await run(
		db,
		'UPDATE board_candidates SET dismissed_at = ? WHERE id = ? AND user_id = ? AND dismissed_at IS NULL',
		currentTime(),
		id,
		userId
	);
	return changed > 0;
}

export function getCandidate(db: Db, userId: string, id: string): Promise<CandidateRow | null> {
	return one<CandidateRow>(
		db,
		'SELECT * FROM board_candidates WHERE id = ? AND user_id = ?',
		id,
		userId
	);
}

/**
 * Takes the place, publishing a row under the account's name.
 *
 * The month is checked again here rather than trusted from the candidate: a
 * fortnight of grace is long enough for one to have been sitting in somebody's
 * inbox while it ran out.
 */
export async function claim(
	db: Db,
	userId: string,
	candidateId: string,
	shareId: string | null,
	now = currentTime()
): Promise<{ entry: EntryRow; rank: number }> {
	const candidate = await getCandidate(db, userId, candidateId);
	if (!candidate) throw new ClaimRefused('That place is no longer on offer.', 'gone');
	if (candidate.locks_at <= now) {
		throw new ClaimRefused('That month has closed.', 'closed');
	}

	const user = await one<{ username: string | null }>(
		db,
		'SELECT username FROM users WHERE id = ?',
		userId
	);
	if (!user?.username) {
		throw new ClaimRefused('Choose a name to appear under first.', 'username-required');
	}

	if (shareId) {
		const share = await one<{ id: string; kind: string; start_time: number }>(
			db,
			'SELECT id, kind, start_time FROM shares WHERE id = ? AND user_id = ? AND revoked_at IS NULL',
			shareId,
			userId
		);
		if (!share || share.kind !== candidate.kind || share.start_time !== candidate.start_time) {
			throw new ClaimRefused('That link is not for this trip.', 'share');
		}
	}

	const changed = await run(
		db,
		`INSERT INTO board_entries (id, board, month, user_id, kind, vin, start_time, value, score,
			detail_json, vmodel, share_id, claimed_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (board, month, user_id) DO UPDATE SET
			kind = excluded.kind, vin = excluded.vin, start_time = excluded.start_time,
			value = excluded.value, score = excluded.score, detail_json = excluded.detail_json,
			vmodel = excluded.vmodel, share_id = excluded.share_id, claimed_at = excluded.claimed_at,
			removed_at = NULL
		 WHERE excluded.score > board_entries.score OR board_entries.removed_at IS NOT NULL`,
		rowId(),
		candidate.board,
		candidate.month,
		userId,
		candidate.kind,
		candidate.vin,
		candidate.start_time,
		candidate.value,
		candidate.score,
		candidate.detail_json,
		candidate.vmodel,
		shareId,
		now
	);

	const entry = await one<EntryRow>(
		db,
		'SELECT * FROM board_entries WHERE board = ? AND month = ? AND user_id = ?',
		candidate.board,
		candidate.month,
		userId
	);
	if (!entry) throw new ClaimRefused('That place could not be taken.', 'gone');
	if (changed === 0 && entry.score > candidate.score) {
		throw new ClaimRefused('You already hold a better place on that board.', 'outranked');
	}

	await run(
		db,
		'UPDATE board_candidates SET entry_id = ?, seen_at = COALESCE(seen_at, ?) WHERE id = ?',
		entry.id,
		now,
		candidate.id
	);

	return { entry, rank: await rankOf(db, entry) };
}

/** Where an entry stands right now, counting only the places still standing. */
export async function rankOf(db: Db, entry: EntryRow): Promise<number> {
	const better = await one<{ n: number }>(
		db,
		`SELECT COUNT(*) AS n FROM board_entries
		 WHERE board = ? AND month = ? AND removed_at IS NULL AND score > ?`,
		entry.board,
		entry.month,
		entry.score
	);
	return (better?.n ?? 0) + 1;
}

/**
 * Takes a published row down.
 *
 * Works after the month has locked, which is the one thing that has to: a
 * board freezing is no reason for somebody to lose the ability to withdraw
 * something they published about themselves.
 */
export async function removeEntry(db: Db, userId: string, id: string): Promise<boolean> {
	const changed = await run(
		db,
		'UPDATE board_entries SET removed_at = ? WHERE id = ? AND user_id = ? AND removed_at IS NULL',
		currentTime(),
		id,
		userId
	);
	if (changed === 0) return false;

	// The candidate behind it goes quiet rather than coming back as a fresh
	// offer: they have just said no by taking it down.
	await run(
		db,
		'UPDATE board_candidates SET entry_id = NULL, dismissed_at = ? WHERE entry_id = ? AND user_id = ?',
		currentTime(),
		id,
		userId
	);
	return true;
}

export interface OwnEntry {
	id: string;
	board: BoardId;
	month: string;
	value: number;
	rank: number;
	shareId: string | null;
	claimedAt: number;
	startTime: number;
	vin: string;
	locked: boolean;
}

/** Every place this account holds, newest first. */
export async function listOwn(db: Db, userId: string, now = currentTime()): Promise<OwnEntry[]> {
	const rows = await all<EntryRow>(
		db,
		'SELECT * FROM board_entries WHERE user_id = ? AND removed_at IS NULL ORDER BY month DESC, board',
		userId
	);

	const out: OwnEntry[] = [];
	for (const row of rows) {
		out.push({
			id: row.id,
			board: row.board as BoardId,
			month: row.month,
			value: row.value,
			rank: await rankOf(db, row),
			shareId: row.share_id,
			claimedAt: row.claimed_at,
			startTime: row.start_time,
			vin: row.vin,
			locked: !isMonthOpen(row.month, now)
		});
	}
	return out;
}

interface RankedRow {
	board: string;
	month: string;
	username: string;
	vmodel: string;
	value: number;
	score: number;
	detail_json: string;
	share_id: string | null;
	claimed_at: number;
	user_id: string;
	rank: number;
}

/**
 * A month's boards, ranked.
 *
 * One query for the whole page: the window function ranks within each board,
 * and the outer filter throws away everything past the places on offer. The
 * columns are listed out rather than taken wholesale, so the vehicle and the
 * moment it happened cannot leave by accident.
 */
export async function monthBoards(
	db: Db,
	month: string,
	viewerId?: string
): Promise<BoardListing[]> {
	const rows = await all<RankedRow>(
		db,
		`SELECT board, month, username, vmodel, value, score, detail_json, share_id, claimed_at,
			user_id, rank FROM (
			SELECT e.board AS board, e.month AS month, u.username AS username, e.vmodel AS vmodel,
				e.value AS value, e.score AS score, e.detail_json AS detail_json,
				e.share_id AS share_id, e.claimed_at AS claimed_at, e.user_id AS user_id,
				RANK() OVER (PARTITION BY e.board ORDER BY e.score DESC) AS rank
			FROM board_entries e
			JOIN users u ON u.id = e.user_id
			WHERE e.month = ? AND e.removed_at IS NULL AND u.username IS NOT NULL
		) WHERE rank <= ?
		ORDER BY board, rank, claimed_at`,
		month,
		TOP_N
	);

	return listingsFrom(rows, viewerId);
}

function listingsFrom(rows: RankedRow[], viewerId?: string): BoardListing[] {
	const byBoard = new Map<string, PublicEntry[]>();
	for (const row of rows) {
		if (!boardById(row.board)) continue;
		const entries = byBoard.get(row.board) ?? [];
		entries.push({
			rank: row.rank,
			username: row.username,
			vmodel: row.vmodel,
			value: row.value,
			detail: detailOf(row),
			shareId: row.share_id,
			claimedAt: row.claimed_at,
			...(viewerId && row.user_id === viewerId ? { mine: true as const } : {})
		});
		byBoard.set(row.board, entries);
	}

	return BOARDS.filter((board) => byBoard.has(board.id)).map((board) => ({
		board: board.id,
		entries: byBoard.get(board.id) ?? []
	}));
}

export interface YearBoard {
	board: BoardId;
	/** The year's best, one place per person. */
	entries: PublicEntry[];
	/** Who won each month that had a winner. */
	winners: Array<{ month: string; username: string; value: number; vmodel: string }>;
}

export interface YearSummary {
	year: number;
	boards: YearBoard[];
	/** Most monthly top-three finishes, across every board. */
	podiums: Array<{ username: string; podiums: number; wins: number }>;
	totals: { entries: number; people: number; months: number };
}

/**
 * The year, from the twelve months it is made of.
 *
 * Ranked per month in SQL and folded together here: a year has at most a few
 * thousand rows behind it, which is cheaper to read once than to maintain as a
 * second copy that could disagree with the months it came from.
 */
export async function yearBoards(db: Db, year: number, viewerId?: string): Promise<YearSummary> {
	const rows = await all<RankedRow>(
		db,
		`SELECT board, month, username, vmodel, value, score, detail_json, share_id, claimed_at,
			user_id, rank FROM (
			SELECT e.board AS board, e.month AS month, u.username AS username, e.vmodel AS vmodel,
				e.value AS value, e.score AS score, e.detail_json AS detail_json,
				e.share_id AS share_id, e.claimed_at AS claimed_at, e.user_id AS user_id,
				RANK() OVER (PARTITION BY e.board, e.month ORDER BY e.score DESC) AS rank
			FROM board_entries e
			JOIN users u ON u.id = e.user_id
			WHERE e.month >= ? AND e.month <= ? AND e.removed_at IS NULL AND u.username IS NOT NULL
		) WHERE rank <= ?
		ORDER BY board, month, rank`,
		monthKey(year, 1),
		monthKey(year, 12),
		TOP_N
	);

	const boards: YearBoard[] = [];
	const podiums = new Map<string, { podiums: number; wins: number }>();
	const people = new Set<string>();
	const months = new Set<string>();

	for (const row of rows) {
		people.add(row.user_id);
		months.add(row.month);
		if (row.rank <= 3) {
			const tally = podiums.get(row.username) ?? { podiums: 0, wins: 0 };
			tally.podiums++;
			if (row.rank === 1) tally.wins++;
			podiums.set(row.username, tally);
		}
	}

	for (const board of BOARDS) {
		const mine = rows.filter((row) => row.board === board.id);
		if (mine.length === 0) continue;

		// One place per person across the year, best first.
		const bestPerUser = new Map<string, RankedRow>();
		for (const row of mine) {
			const found = bestPerUser.get(row.user_id);
			if (!found || row.score > found.score) bestPerUser.set(row.user_id, row);
		}

		const ranked = [...bestPerUser.values()].sort(
			(a, b) => b.score - a.score || a.claimed_at - b.claimed_at
		);

		boards.push({
			board: board.id,
			entries: ranked.slice(0, TOP_N).map((row, index) => ({
				rank: index + 1,
				username: row.username,
				vmodel: row.vmodel,
				value: row.value,
				detail: detailOf(row),
				shareId: row.share_id,
				claimedAt: row.claimed_at,
				...(viewerId && row.user_id === viewerId ? { mine: true as const } : {})
			})),
			winners: mine
				.filter((row) => row.rank === 1)
				.map((row) => ({
					month: row.month,
					username: row.username,
					value: row.value,
					vmodel: row.vmodel
				}))
		});
	}

	return {
		year,
		boards,
		podiums: [...podiums.entries()]
			.map(([username, tally]) => ({ username, ...tally }))
			.sort((a, b) => b.podiums - a.podiums || b.wins - a.wins)
			.slice(0, 10),
		totals: { entries: rows.length, people: people.size, months: months.size }
	};
}
