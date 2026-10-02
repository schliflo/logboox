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
 */

/** Epoch seconds. Nothing before the car existed counts as a real timestamp. */
export const EARLIEST_PLAUSIBLE = Date.UTC(2015, 0, 1) / 1000;

export interface RowOrder {
	/** Row indices to keep, ascending in time and free of repeats. */
	keep: Uint32Array;
	/** Rows dropped because another row already covered that second. */
	duplicates: number;
	/** Rows dropped because their time is before EARLIEST_PLAUSIBLE. */
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

	return {
		keep: keep.subarray(0, kept),
		duplicates: length - kept - undated,
		undated,
		wasUnsorted: !sorted
	};
}
