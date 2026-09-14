/**
 * Cutting one trip or charging session out of a month.
 *
 * A share has to stand on its own: opened by someone with no export, no
 * account and no idea what a VIN is, it must still draw the same charts. So it
 * carries its own samples — the seconds the trip actually covers, plus a
 * little on each side so the traces do not begin mid-manoeuvre — in exactly
 * the format everything else here reads.
 *
 * What it does not carry is the rest of the month. A trip is a couple of
 * thousand samples against a month's three and a half million, which is the
 * difference between a link and an upload.
 */

import { compress, decompress, exactBuffer, TIME_BLOB } from '../history/codec';
import type { ColumnSpec } from '../data/schema/columns';
import { isNullRaw, searchTime, type Column, type Dataset } from '../data/store/columnar';
import { viewFor } from '../data/worker/protocol';

/** Seconds of context on either side, so a trace does not start mid-corner. */
export const PADDING_SECONDS = 30;

export interface ShareBlob {
	name: string;
	bytes: ArrayBuffer;
}

export interface Slice {
	/** Epoch seconds, as the dataset holds them. */
	time: Uint32Array;
	columns: Map<string, Column>;
	vmodel: string;
}

/** Recomputed rather than inherited: a slice's range is its own, not the month's. */
function summarise(spec: ColumnSpec, data: Column['data']): Column {
	let nonNull = 0;
	let min = Infinity;
	let max = -Infinity;

	for (let i = 0; i < data.length; i++) {
		const raw = data[i];
		if (isNullRaw(raw, spec.dtype)) continue;
		nonNull++;
		if (raw < min) min = raw;
		if (raw > max) max = raw;
	}

	return {
		spec,
		data,
		nonNull,
		min: nonNull > 0 ? min * spec.scale + spec.offset : NaN,
		max: nonNull > 0 ? max * spec.scale + spec.offset : NaN
	};
}

function bytesOf(view: { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }) {
	return exactBuffer(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
}

/**
 * The samples between two instants, with padding, as a dataset in its own
 * right. Signals the car never reported are left out: an empty column is
 * nothing to publish and nothing to draw.
 */
export function sliceDataset(
	dataset: Dataset,
	startTime: number,
	endTime: number,
	padding = PADDING_SECONDS
): Slice {
	// `searchTime` gives the last sample at or before an instant, and -1 when
	// the instant is earlier than anything recorded — so the lower bound is
	// clamped, and the upper one nudged past its hit to stay inclusive.
	const from = Math.max(0, searchTime(dataset.time, startTime - padding));
	const to = Math.min(dataset.time.length, searchTime(dataset.time, endTime + padding) + 1);

	const columns = new Map<string, Column>();
	for (const [key, column] of dataset.columns) {
		if (column.nonNull === 0) continue;
		const data = column.data.slice(from, to) as Column['data'];
		const summarised = summarise(column.spec, data);
		if (summarised.nonNull === 0) continue;
		columns.set(key, summarised);
	}

	return { time: dataset.time.slice(from, to), columns, vmodel: dataset.vmodel };
}

/** Every buffer of a slice, gzipped the way kept exports are. */
export async function encodeSlice(slice: Slice): Promise<ShareBlob[]> {
	const blobs: ShareBlob[] = [
		{ name: TIME_BLOB, bytes: exactBuffer(await compress(bytesOf(slice.time))) }
	];

	for (const [key, column] of slice.columns) {
		blobs.push({ name: key, bytes: exactBuffer(await compress(bytesOf(column.data))) });
	}

	return blobs;
}

/** What a share page needs to read its own columns, without the registry. */
export interface SliceManifest {
	rows: number;
	columns: Array<{ key: string; spec: ColumnSpec; nonNull: number; min: number; max: number }>;
}

export function manifestOf(slice: Slice): SliceManifest {
	return {
		rows: slice.time.length,
		columns: [...slice.columns.values()].map((column) => ({
			key: column.spec.key,
			spec: column.spec,
			nonNull: column.nonNull,
			// JSON has no NaN; a column with no readings never gets this far.
			min: Number.isFinite(column.min) ? column.min : 0,
			max: Number.isFinite(column.max) ? column.max : 0
		}))
	};
}

/** Rebuilds a slice from a manifest and the buffers it names. */
export function decodeSlice(
	manifest: SliceManifest,
	vmodel: string,
	blobs: Map<string, ArrayBuffer>
): Slice {
	const timeBytes = blobs.get(TIME_BLOB);
	if (!timeBytes) throw new Error('This share is missing its timeline.');

	const columns = new Map<string, Column>();
	for (const stored of manifest.columns) {
		const bytes = blobs.get(stored.key);
		if (!bytes) continue;
		columns.set(stored.key, {
			spec: stored.spec,
			data: viewFor(stored.spec, decompress(bytes)),
			nonNull: stored.nonNull,
			min: stored.min,
			max: stored.max
		});
	}

	return { time: new Uint32Array(decompress(timeBytes)), columns, vmodel };
}
