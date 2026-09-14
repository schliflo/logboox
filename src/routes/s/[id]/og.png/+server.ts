/**
 * The card a shared link previews as.
 *
 * A shared trip or charging session never changes — that is the point of it —
 * so the picture of one is worth drawing once. The first request renders it and
 * writes it to R2 under the share's own prefix, which means the existing revoke
 * path removes it along with everything else; later requests read it back. It
 * is served with a day of cache, because nothing behind it can move.
 *
 * A whole-export share is the exception and gets the static card. A month is
 * three and a half million samples across sixty-odd columns, and decoding the
 * one worth drawing would mean pulling tens of megabytes into a Worker to make
 * a picture 1200 pixels wide.
 *
 * `json()` from `$lib/server/response` is deliberately not used here: it forces
 * `private, no-store`, which is right for everything else on this server and
 * exactly wrong for a picture meant to be cached by strangers.
 */

import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getShare } from '$lib/server/shares/repo';
import { sharePrefix } from '$lib/server/exports/r2';
import { maybeDb, maybeStorage } from '$lib/server/context';
import { decodeSlice, type SliceManifest } from '$lib/share/slice';
import { decodeRange } from '$lib/data/store/columnar';
import { TIME_BLOB } from '$lib/history/codec';
import { shareFigures, shareHeading, shareSummary } from '$lib/share/describe';
import { shareCard } from '$lib/server/og/card';
import { decimate, toPath } from '$lib/server/og/series';
import { renderPng } from '$lib/server/og/rasterize';
import { OG_IMAGE } from '$lib/seo';

export const prerender = false;

/** Nothing behind a share can change, so the picture of one need not either. */
const MAX_AGE = 86400;

/** The one signal each kind is worth drawing. */
const SIGNAL = { trip: 'esp_vehspd', charging: 'ldcu_chrgpwr' } as const;

function stored(id: string): string {
	// Beside the share's buffers rather than under a key of its own, so that
	// revoking a link deletes the card with the rest of it.
	return `${sharePrefix(id)}og.png`;
}

function png(body: BodyInit, length?: number): Response {
	return new Response(body, {
		headers: {
			'content-type': 'image/png',
			'cache-control': `public, max-age=${MAX_AGE}`,
			...(length === undefined ? {} : { 'content-length': String(length) })
		}
	});
}

/**
 * The curve, when the share carries one.
 *
 * Only the timeline and the single charted column are fetched — a slice holds
 * every signal the trip touched, and reading sixty of them to draw one would
 * be paid for on every cold render.
 */
async function curve(
	storage: R2Bucket,
	id: string,
	kind: 'trip' | 'charging',
	model: string
): Promise<{ line: string; area: string } | undefined> {
	const key = SIGNAL[kind];

	// The manifest travels as a buffer like the rest, but it is plain JSON; the
	// `.gz` in its key is the naming convention, not a claim about its contents.
	const manifestObject = await storage.get(`${sharePrefix(id)}_manifest.gz`);
	if (!manifestObject) return undefined;
	const manifest = JSON.parse(await manifestObject.text()) as SliceManifest;
	if (!manifest.columns?.some((column) => column.key === key)) return undefined;

	const [time, column] = await Promise.all([
		storage.get(`${sharePrefix(id)}${TIME_BLOB}.gz`),
		storage.get(`${sharePrefix(id)}${key}.gz`)
	]);
	if (!time || !column) return undefined;

	const blobs = new Map<string, ArrayBuffer>([
		[TIME_BLOB, await time.arrayBuffer()],
		[key, await column.arrayBuffer()]
	]);

	const slice = decodeSlice(manifest, model, blobs);
	const values = slice.columns.get(key);
	if (!values) return undefined;

	return toPath(decimate(slice.time, decodeRange(values)));
}

export const GET: RequestHandler = async (event) => {
	const db = maybeDb(event);
	if (!db) error(503, 'Shared links live at logboox.app.');

	const share = await getShare(db, event.params.id);
	if (!share) error(404, 'That link is no longer available.');

	// A month has no single curve to draw, and far too much data to look for one.
	if (share.kind === 'export') redirect(302, OG_IMAGE);

	const storage = maybeStorage(event);
	if (!storage) error(503, 'Shared links live at logboox.app.');

	const key = stored(share.id);
	const existing = await storage.get(key);
	if (existing) return png(existing.body, existing.size);

	const thing = {
		kind: share.kind,
		model: share.vmodel,
		title: share.title,
		meta: JSON.parse(share.meta_json) as Record<string, unknown>
	};

	// A share whose buffers never finished uploading still gets a card, without
	// the curve: a missing picture is worse than a plain one.
	let series: { line: string; area: string } | undefined;
	try {
		series = await curve(storage, share.id, share.kind, share.vmodel);
	} catch {
		series = undefined;
	}

	const body = await renderPng(
		shareCard({
			heading: shareHeading(thing),
			subtitle: shareSummary(thing),
			stats: shareFigures(thing),
			series
		})
	);

	// Written behind the response: the reader has their picture either way, and
	// a scraper should not wait on an object store to get it.
	event.platform?.ctx?.waitUntil(storage.put(key, body));

	return png(body, body.byteLength);
};
