/**
 * Gunzip with a ceiling.
 *
 * fflate sizes its output from the gzip trailer, which is four bytes the
 * uploader wrote: a buffer of a few dozen bytes can claim four gigabytes and
 * get them allocated. So the claim is checked first, and the output buffer is
 * handed in, which fflate fills and never grows — a trailer that understates
 * the size gets a truncated result rather than a larger one.
 */

import { gunzipSync } from 'fflate';
import { exactBuffer } from '#lib/history/codec.js';

/** The inflated bytes, or null when they would be more than `limit`. */
export function inflateAtMost(bytes: ArrayBuffer, limit: number): ArrayBuffer | null {
	// Ten bytes of header and eight of trailer is the least a gzip member is.
	if (bytes.byteLength < 18) return null;
	const view = new Uint8Array(bytes);
	if (view[0] !== 0x1f || view[1] !== 0x8b) return null;

	const size = new DataView(bytes).getUint32(bytes.byteLength - 4, true);
	if (size > limit) return null;

	return exactBuffer(gunzipSync(view, { out: new Uint8Array(size) }));
}
