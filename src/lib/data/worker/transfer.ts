/**
 * Moving a kept export between this browser and an account.
 *
 * It runs in the data worker because that is where the compressed buffers
 * already are: the bytes uploaded are exactly the bytes IndexedDB holds, so
 * nothing is inflated, re-compressed or copied onto the main thread on the way
 * past. An upload of a month is thirty-odd requests of a few hundred kilobytes
 * each, which is also why it happens off the interface thread.
 *
 * The one thing that has to be computed is the summary — trips, charging and
 * the car's last known state — because a server cannot derive it. Doing so
 * means decoding the export and analysing it again, the same work as opening
 * it, which is a fair price for the API being answerable without it.
 */

import { analyze } from '../analytics';
import { summarize } from '../analytics/summary';
import { decodeExport } from '../../history/codec';
import { getExport, putExport } from '../../history/db';
import type { ExportRecord, StoredBlob } from '../../history/codec';
import type { Dataset } from '../store/columnar';
import { unpackDataset } from './protocol';

/** Several at once, because these are small and latency dominates. */
const CONCURRENCY = 4;

const TIME_BLOB = '_time';

export class TransferError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'TransferError';
	}
}

async function expectOk(response: Response, what: string): Promise<unknown> {
	if (response.ok) return response.status === 204 ? null : response.json().catch(() => null);

	const detail = (await response.json().catch(() => null)) as { error?: string } | null;
	throw new TransferError(detail?.error ?? `${what} failed (${response.status}).`);
}

/** Runs `work` over everything, a few at a time, in order of completion. */
async function pool<T>(items: T[], work: (item: T) => Promise<void>): Promise<void> {
	let next = 0;
	const runners = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
		for (;;) {
			const index = next++;
			if (index >= items.length) return;
			await work(items[index]);
		}
	});
	await Promise.all(runners);
}

export interface TransferProgress {
	(loaded: number, total: number): void;
}

/**
 * A place the account could take on a public board, offered by the server once
 * an upload is complete. Nothing is published by its existence.
 */
export interface BoardCandidate {
	id: string;
	board: string;
	month: string;
	kind: 'trip' | 'charging';
	value: number;
	rank: number;
	locksAt: number;
	startTime: number;
	vin: string;
	detail: Record<string, number | boolean | null>;
	createdAt: number;
	seen: boolean;
}

/**
 * Copies one kept export into the account: the record and its summary first,
 * then every buffer, then the acknowledgement that turns it into a listed
 * export. Until that last step it is invisible, so a failure halfway leaves
 * nothing to clean up by hand.
 */
export async function uploadExport(
	id: string,
	timeZone: string,
	onProgress?: TransferProgress
): Promise<BoardCandidate[]> {
	const entry = await getExport(id);
	if (!entry) throw new TransferError('That export is no longer kept in this browser.');

	const dataset = unpackDataset(decodeExport(entry.record, entry.blobs));
	const derived = analyze(dataset, timeZone);
	const summary = summarize(dataset, derived);

	await expectOk(
		await fetch(`/api/v1/exports/${encodeURIComponent(id)}`, {
			method: 'PUT',
			credentials: 'same-origin',
			headers: { 'content-type': 'application/json' },
			// The zone travels with the export: which month a drive belongs to
			// depends on where it was driven, and only this side knows that.
			body: JSON.stringify({
				record: entry.record,
				summary,
				isDemo: entry.record.isDemo,
				timeZone
			})
		}),
		'Opening the upload'
	);

	let done = 0;
	onProgress?.(0, entry.blobs.length);

	await pool(entry.blobs, async (blob) => {
		await expectOk(
			await fetch(
				`/api/v1/exports/${encodeURIComponent(id)}/blobs/${encodeURIComponent(blob.name)}`,
				{
					method: 'PUT',
					credentials: 'same-origin',
					headers: { 'content-type': 'application/octet-stream' },
					body: blob.bytes
				}
			),
			`Uploading ${blob.name}`
		);
		onProgress?.(++done, entry.blobs.length);
	});

	// Finishing is also when the server works out whether any of this would
	// stand on a board, and says so in its reply.
	const finished = (await expectOk(
		await fetch(`/api/v1/exports/${encodeURIComponent(id)}/complete`, {
			method: 'POST',
			credentials: 'same-origin'
		}),
		'Finishing the upload'
	)) as { candidates?: BoardCandidate[] } | null;

	return finished?.candidates ?? [];
}

/**
 * The record names every buffer to ask for, so it comes first and on its own.
 * The listing does not carry it: listing an account should not mean shipping a
 * column registry per export.
 */
async function fetchRecord(id: string): Promise<ExportRecord> {
	const response = await fetch(`/api/v1/exports/${encodeURIComponent(id)}/record`, {
		credentials: 'same-origin'
	});
	return (await expectOk(response, 'Reading the export record')) as ExportRecord;
}

/**
 * Brings an export back down into this browser, where everything that reads it
 * expects to find it. Once here it is an ordinary kept export, indistinguishable
 * from one that was dropped in.
 */
export async function downloadExport(id: string, onProgress?: TransferProgress): Promise<void> {
	const record = await fetchRecord(id);
	const names = [TIME_BLOB, ...record.columns.map((column) => column.key)];

	const blobs: StoredBlob[] = [];
	let done = 0;
	onProgress?.(0, names.length);

	await pool(names, async (name) => {
		const response = await fetch(
			`/api/v1/exports/${encodeURIComponent(id)}/blobs/${encodeURIComponent(name)}`,
			{ credentials: 'same-origin' }
		);
		if (!response.ok) throw new TransferError(`The account is missing ${name}.`);
		blobs.push({ id, name, bytes: await response.arrayBuffer() });
		onProgress?.(++done, names.length);
	});

	await putExport(record, blobs);
}

/**
 * Opens an export someone published, without keeping it.
 *
 * The same buffers and the same decoder as a kept export, but it never reaches
 * storage: a month that arrived through a link belongs to whoever sent it, and
 * filling a reader's browser with it because they clicked once would be a
 * peculiar thing to do. It lives as long as the tab.
 */
export async function openSharedExport(
	shareId: string,
	onProgress?: TransferProgress
): Promise<Dataset> {
	const response = await fetch(`/api/v1/shares/${encodeURIComponent(shareId)}/record`);
	const record = (await expectOk(response, 'Reading the shared export')) as ExportRecord;

	const names = [TIME_BLOB, ...record.columns.map((column) => column.key)];
	const blobs: StoredBlob[] = [];
	let done = 0;
	onProgress?.(0, names.length);

	await pool(names, async (name) => {
		const part = await fetch(
			`/api/v1/shares/${encodeURIComponent(shareId)}/blobs/${encodeURIComponent(name)}`
		);
		if (!part.ok) throw new TransferError(`The shared export is missing ${name}.`);
		blobs.push({ id: record.id, name, bytes: await part.arrayBuffer() });
		onProgress?.(++done, names.length);
	});

	return unpackDataset(decodeExport(record, blobs));
}
