/**
 * "Update now": the owner asks for today's data instead of waiting for the
 * hourly run. Runs in the import Worker (it holds our XPeng credentials),
 * called by the app over a service binding.
 *
 * XPeng takes minutes to build an export, so one call never waits for it: it
 * submits, or asks about the task already running, and imports the file as
 * soon as XPeng has it. The browser calls again until it is done.
 */

import { all, now, type Db } from '../db';
import {
	MANUAL_EVERY,
	POLL_EVERY,
	fetchStep,
	findLink,
	type XpengApp,
	type XpengDownload,
	type XpengMessage
} from './fetch';
import { importOne, MAX_ATTEMPTS } from './import';

export type UpdateResult =
	| { kind: 'imported' }
	| { kind: 'exporting' }
	/** Not yet: `until` is when the next request is allowed (epoch seconds). */
	| { kind: 'wait'; until: number }
	/** Someone else is writing the timeline right now; ask again in a moment. */
	| { kind: 'busy' }
	| { kind: 'failed'; message: XpengMessage | null }
	| { kind: 'reauth' }
	| { kind: 'unlinked' };

/** What the app sees of the import Worker. */
export interface ImportService {
	update(userId: string): Promise<UpdateResult>;
}

export async function updateNow(
	db: Db,
	storage: R2Bucket,
	xpeng: XpengApp,
	userId: string,
	fetchImpl: typeof fetch = globalThis.fetch
): Promise<UpdateResult> {
	const link = await findLink(db, userId);
	if (!link) return { kind: 'unlinked' };
	if (link.state === 'reauth') return { kind: 'reauth' };

	const allowed =
		link.state === 'exporting'
			? (link.checked_at ?? 0) + POLL_EVERY
			: (link.submitted_at ?? 0) + MANUAL_EVERY;
	const ask = now() >= allowed;
	if (ask) {
		const outcome = await fetchStep(db, storage, xpeng, link, fetchImpl);
		if (outcome === 'exporting') return { kind: 'exporting' };
		if (outcome === 'reauth') return { kind: 'reauth' };
	}

	// Whatever is waiting, the file just fetched included. Not limited: it costs XPeng nothing.
	const downloads = await all<XpengDownload>(
		db,
		'SELECT * FROM xpeng_downloads WHERE user_id = ? AND attempts < ? ORDER BY created_at',
		userId,
		MAX_ATTEMPTS
	);
	let imported = false;
	for (const download of downloads) {
		const result = await importOne(db, storage, download);
		if (result === 'busy') return { kind: 'busy' };
		if (result === 'imported') imported = true;
	}
	if (imported) return { kind: 'imported' };
	if (!ask) return { kind: 'wait', until: allowed };
	return { kind: 'failed', message: (await findLink(db, userId))?.message ?? null };
}
