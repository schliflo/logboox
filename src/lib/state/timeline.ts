/**
 * Acting on a stretch of a car's timeline rather than on whole exports:
 * opening the weeks behind a range that is not loaded, downloading what is on
 * screen as one file, and sharing it. See docs/plan-weekly-blocks.md.
 */

import { toast } from 'svelte-sonner';
import { api } from '../api/client';
import { packDataset } from '../data/worker/protocol';
import type { TimeRange } from '../data/range';
import { encodeExport } from '../history/codec';
import { backupFileName, writeBackup } from '../history/archive';
import { downloadBlob } from '../utils/download';
import { m } from '../i18n/index.svelte';
import { account } from './account.svelte';
import { data } from './dataset.svelte';
import { history } from './history.svelte';
import { settings } from './settings.svelte';

/** The same month cap as the server's `MAX_RANGE_SECONDS`. */
const MAX_SHARE_SECONDS = 32 * 86400;

/** What is on screen, as `[from, to)` epoch seconds. */
function viewSpan(): { from: number; to: number } | null {
	if (data.range) return { from: data.range.from, to: data.range.to };
	const derived = data.derived;
	return derived ? { from: derived.startTime, to: derived.endTime + 1 } : null;
}

/**
 * The open exports holding some of `span`: all the server needs to cut it out.
 * One not listed here or in the account is kept, so the blocker below sees it.
 */
function sourcesIn(span: { from: number; to: number }): string[] {
	const byId = new Map(
		[...history.entries, ...history.remote].map((entry) => [entry.id, entry] as const)
	);
	return data.source.ids.filter((id) => {
		const entry = byId.get(id);
		return !entry || (entry.endTime >= span.from && entry.startTime < span.to);
	});
}

/** Opens the car's weeks that overlap `range`, fetching any only in the account, and shows it. */
export async function openRange(vin: string, range: TimeRange): Promise<void> {
	const ids = (history.groups.find((group) => group.vin === vin)?.entries ?? [])
		.filter((entry) => entry.endTime >= range.from && entry.startTime < range.to)
		.map((entry) => entry.id);
	const missing = ids.filter((id) => !history.openable([id]));
	if (missing.length > 0 && (await history.pull(missing)).failed.length > 0) return;
	await data.open(ids, location.pathname);
	if (data.status === 'ready') await data.setRange(range);
}

/** What is on screen, as one export in a backup ZIP that opens anywhere here. */
export async function downloadView(): Promise<void> {
	const { dataset, derived } = data;
	const span = viewSpan();
	if (!dataset || !derived || !span) return;
	try {
		const id = `range-${span.from}-${span.to}`;
		const { record, blobs } = await encodeExport(
			packDataset({ ...dataset, exportId: id }).packed,
			derived,
			data.isDemo
		);
		downloadBlob(
			backupFileName(1),
			new Blob(writeBackup([{ record, blobs }]) as Uint8Array<ArrayBuffer>[])
		);
	} catch (error) {
		toast(m.range.downloadFailed, {
			description: error instanceof Error ? error.message : undefined,
			closeButton: true
		});
	}
}

/** Why what is on screen cannot be shared, or null when it can. */
export function shareBlocker(): string | null {
	const span = viewSpan();
	if (!span || !account.signedIn || data.isDemo || data.source.kind === 'shared') return '';
	if (span.to - span.from > MAX_SHARE_SECONDS) return m.range.shareTooLong;
	const remote = new Set(history.remote.map((entry) => entry.id));
	if (!sourcesIn(span).every((id) => remote.has(id))) return m.range.shareNotInAccount;
	return null;
}

/** A link to what is on screen. The server cuts it out of the account and freezes it. */
export async function shareView(): Promise<void> {
	const span = viewSpan();
	const derived = data.derived;
	if (!span || !derived || shareBlocker() !== null) return;
	try {
		const created = await api<{ url: string }>('/api/v1/shares', {
			method: 'POST',
			body: {
				kind: 'export',
				vmodel: data.dataset?.vmodel ?? '',
				sources: sourcesIn(span),
				startTime: span.from,
				endTime: span.to,
				timeZone: settings.timeZone,
				meta: {
					days: derived.recordedDays,
					distanceKm: derived.days.reduce((sum, day) => sum + day.distanceKm, 0),
					trips: derived.trips.length
				}
			}
		});
		await navigator.clipboard.writeText(created.url).catch(() => {});
		toast(m.range.linkCopied, { description: m.range.linkCopiedDetail, duration: 8000 });
	} catch (error) {
		toast(m.range.linkFailed, {
			description: error instanceof Error ? error.message : undefined,
			closeButton: true
		});
	}
}
