/**
 * Copies kept before stray clock-reset bursts were recognised still hold them,
 * and the library lists such a copy as years long. It is cut down and stored
 * again the first time it is read for use.
 */

import { analyze } from '../data/analytics';
import { dropStrays, plausibleSpan } from '../data/parse/order';
import { packDataset, unpackDataset } from '../data/worker/protocol';
import type { BackupEntry } from './archive';
import { decodeExport, encodeExport, sourceFromExport } from './codec';
import { putExport } from './db';

export async function repairKept(entry: BackupEntry, timeZone: string): Promise<BackupEntry> {
	// Only the timeline is inflated to find out.
	const { time } = sourceFromExport(entry.record, entry.blobs);
	const { from, to } = plausibleSpan(time.length, (i) => time[i]);
	if (from === 0 && to === time.length) return entry;

	const dataset = dropStrays(unpackDataset(decodeExport(entry.record, entry.blobs)));
	const derived = analyze(dataset, timeZone);
	const { record, blobs } = await encodeExport(
		packDataset(dataset).packed,
		derived,
		entry.record.isDemo
	);
	record.keptAt = entry.record.keptAt;
	// Failing to store the repair only means doing it again next time.
	await putExport(record, blobs).catch(() => {});
	return { record, blobs };
}
