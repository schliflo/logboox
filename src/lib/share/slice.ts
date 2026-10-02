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

import { compress, exactBuffer, inflateExactly, TIME_BLOB } from '../history/codec';
import { DTYPE_CTOR, type ColumnSpec } from '../data/schema/columns';
import {
	firstAtOrAfter,
	searchTime,
	summarise,
	type Column,
	type Dataset
} from '../data/store/columnar';
import { viewFor } from '../data/worker/protocol';

/** Seconds of context on either side, so a trace does not start mid-corner. */
export const PADDING_SECONDS = 30;

export type SliceKind = 'trip' | 'charging';

/**
 * The columns a share carries, per kind. THIS LIST IS THE PRIVACY BOUNDARY:
 * whatever is named here is publicly readable under the share's id, and a
 * dataset holds far more — the absolute odometer, doors, windows, tailgate.
 * Extend it deliberately, when the public page or the card starts drawing
 * something new, and never to "everything the trip touched".
 *
 * Each entry is where it is read:
 * - trip: speed (TripDetail, and the card), battery voltage and current
 *   (TripDetail's power panel, via `instantPowerKw`), displayed charge,
 *   accelerator and brake pedals, steering angle (all TripDetail).
 * - charging: power at the plug (SessionDetail, and the card) and displayed
 *   charge (SessionDetail).
 *
 * Distance is not read from a column at all: the page prints `meta.distanceKm`,
 * which the dashboard works out from the odometer without publishing it.
 */
export const SHARED_COLUMNS: Record<SliceKind, readonly string[]> = {
	trip: [
		'esp_vehspd',
		'bms_battvolt',
		'bms_battcurr',
		'ldcu_bms_soc_disp',
		'ldcu_accpedalsig',
		'ldcu_brkpedalst',
		'eps_steeringangle'
	],
	charging: ['ldcu_chrgpwr', 'ldcu_bms_soc_disp']
};

/** About eleven days at a sample a second; the card's server-side bound too. */
export const MAX_SLICE_ROWS = 1_000_000;

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

function bytesOf(view: { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }) {
	return exactBuffer(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
}

/**
 * The samples between two instants, with padding, as a dataset in its own
 * right. Only the columns `SHARED_COLUMNS` allows for this kind are cut, and
 * of those the ones the car never reported are left out: an empty column is
 * nothing to publish and nothing to draw.
 */
export function sliceDataset(
	dataset: Dataset,
	kind: SliceKind,
	startTime: number,
	endTime: number,
	padding = PADDING_SECONDS
): Slice {
	// The lower bound is the first sample inside the padding, not the last one
	// before it: after the car slept, that one is hours old and would be
	// published with its timestamp. The upper bound is the last sample at or
	// before its instant, nudged past its hit to stay inclusive.
	const from = firstAtOrAfter(dataset.time, startTime - padding);
	const to = Math.max(
		from,
		Math.min(dataset.time.length, searchTime(dataset.time, endTime + padding) + 1)
	);

	const columns = new Map<string, Column>();
	for (const key of SHARED_COLUMNS[kind]) {
		const column = dataset.columns.get(key);
		if (!column || column.nonNull === 0) continue;
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
	const { rows } = manifest;
	if (!Number.isSafeInteger(rows) || rows < 0 || rows > MAX_SLICE_ROWS) {
		throw new Error('This share is larger than a trip could be.');
	}

	const timeBytes = blobs.get(TIME_BLOB);
	if (!timeBytes) throw new Error('This share is missing its timeline.');

	const columns = new Map<string, Column>();
	for (const stored of manifest.columns) {
		const bytes = blobs.get(stored.key);
		if (!bytes) continue;
		if (!Object.hasOwn(DTYPE_CTOR, stored.spec.dtype)) {
			throw new Error(`This share's ${stored.key} is not readable.`);
		}
		const width = new DTYPE_CTOR[stored.spec.dtype](0).BYTES_PER_ELEMENT;
		columns.set(stored.key, {
			spec: stored.spec,
			data: viewFor(stored.spec, inflateExactly(bytes, rows * width, `This share's ${stored.key}`)),
			nonNull: stored.nonNull,
			min: stored.min,
			max: stored.max
		});
	}

	return {
		time: new Uint32Array(inflateExactly(timeBytes, rows * 4, "This share's timeline")),
		columns,
		vmodel
	};
}
