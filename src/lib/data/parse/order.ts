/**
 * Putting a stream in order.
 *
 * The export is *mostly* sorted by time, but not reliably: it is assembled from
 * warehouse partitions, and a real export was found to contain one block of an
 * earlier day emitted after a later one. It also repeats rows, because the
 * delivery pipeline replays batches it is unsure about.
 *
 * Rather than assume, we check. An already-sorted stream takes a single pass;
 * a jumbled one is sorted first (rows without a believable time do not count
 * towards that). Either way the result is ascending and unique.
 *
 * Rows without a believable time are left out: a real export held two samples
 * stamped 2010 (the car's clock had reset) and an empty timer reads as 1970.
 * Kept, either would stretch the whole dashboard back across the gap.
 *
 * A reset clock does not always land before 2015: another export opened with
 * two minutes stamped 2022, from a 2026 car parked in 2026. Those are caught by
 * shape instead — a short burst at either end, years from everything else.
 */

import { restrictDataset, type Dataset } from '../store/columnar';

/** Epoch seconds. Nothing before the car existed counts as a real timestamp. */
export const EARLIEST_PLAUSIBLE = Date.UTC(2015, 0, 1) / 1000;

/** No export spans this: XPeng hands out thirty days at a time. */
export const STRAY_GAP = 180 * 86400;

/** At most this many rows past such a gap are taken for a clock fault rather than data. */
export const STRAY_ROWS = 3600;

/**
 * The part of an ascending timeline worth keeping: `[from, to)` without the
 * stray bursts at either end. `at(i)` reads the i-th time. A burst is only
 * stray while it is the smaller side of its gap.
 */
export function plausibleSpan(
	length: number,
	at: (i: number) => number
): { from: number; to: number } {
	let from = 0;
	let to = length;
	for (let i = 1; i <= STRAY_ROWS && i < length - i; i++) {
		if (at(i) - at(i - 1) > STRAY_GAP) from = i;
	}
	for (let i = length - 1; length - i <= STRAY_ROWS && length - i < i - from; i--) {
		if (at(i) - at(i - 1) > STRAY_GAP) to = i;
	}
	return { from, to };
}

/** The dataset without its stray bursts, or the same dataset when it has none. */
export function dropStrays(dataset: Dataset): Dataset {
	const { time } = dataset;
	const { from, to } = plausibleSpan(time.length, (i) => time[i]);
	if (from === 0 && to === time.length) return dataset;
	const kept = restrictDataset(dataset, time[from], time[to - 1] + 1);
	kept.undatedRows += time.length - (to - from);
	return kept;
}

export interface RowOrder {
	/** Row indices to keep, ascending in time and free of repeats. */
	keep: Uint32Array;
	/** Rows dropped because another row already covered that second. */
	duplicates: number;
	/** Rows dropped because their time is before EARLIEST_PLAUSIBLE or stray. */
	undated: number;
	/** True when the source needed reordering. */
	wasUnsorted: boolean;
}

export function orderRows(time: Uint32Array, length: number): RowOrder {
	// Undated rows are dropped below whatever their place, so one stamped 2010
	// in the middle of a sorted file is not disorder: only dated rows are compared.
	let sorted = true;
	let before = -1;
	for (let i = 0; i < length; i++) {
		const t = time[i];
		if (t < EARLIEST_PLAUSIBLE) continue;
		if (t < before) {
			sorted = false;
			break;
		}
		before = t;
	}

	let sequence: Uint32Array;
	if (sorted) {
		sequence = null as unknown as Uint32Array;
	} else {
		sequence = new Uint32Array(length);
		for (let i = 0; i < length; i++) sequence[i] = i;
		// Tie-break on the original position so the result is deterministic
		// regardless of whether the engine's typed-array sort is stable.
		sequence.sort((a, b) => time[a] - time[b] || a - b);
	}

	const keep = new Uint32Array(length);
	let kept = 0;
	let undated = 0;
	let previous = -1;
	for (let i = 0; i < length; i++) {
		const index = sorted ? i : sequence[i];
		const t = time[index];
		if (t < EARLIEST_PLAUSIBLE) {
			undated++;
			continue;
		}
		if (t === previous) continue;
		keep[kept++] = index;
		previous = t;
	}

	const duplicates = length - kept - undated;
	const { from, to } = plausibleSpan(kept, (i) => time[keep[i]]);

	return {
		keep: keep.subarray(from, to),
		duplicates,
		undated: undated + kept - (to - from),
		wasUnsorted: !sorted
	};
}
