/**
 * The card a shared link previews as.
 *
 * A shared trip or charging session never changes — that is the point of it —
 * so the picture of one is worth drawing once. The first request renders it and
 * writes it to R2 under the share's own prefix, which means the existing revoke
 * path removes it along with everything else; later requests read it back. A
 * card that cannot be drawn at all is remembered too, so a share that breaks
 * the renderer breaks it once an hour rather than on every request.
 *
 * A whole-export share is the exception and gets the static card. A month is
 * three and a half million samples across sixty-odd columns, and decoding the
 * one worth drawing would mean pulling tens of megabytes into a Worker to make
 * a picture 1200 pixels wide.
 *
 * `json()` from `#lib/server/response.js` is deliberately not used here: it forces
 * `private, no-store`, which is right for everything else on this server and
 * exactly wrong for a picture meant to be cached by strangers.
 */

import { error, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	MAX_SHARE_BLOB_BYTES,
	MAX_SHARE_MANIFEST_BYTES,
	SHARE_UPLOAD_WINDOW_SECONDS,
	getShare
} from '#lib/server/shares/repo.js';
import { parseManifest, storedMeta } from '#lib/server/shares/validate.js';
import { sharePrefix } from '#lib/server/exports/r2.js';
import { maybeDb, maybeStorage } from '#lib/server/context.js';
import { now } from '#lib/server/db.js';
import { decodeRange } from '#lib/data/store/columnar.js';
import { viewFor } from '#lib/data/worker/protocol.js';
import { TIME_BLOB } from '#lib/history/codec.js';
import { shareFigures, shareHeading, shareSummary } from '#lib/share/describe.js';
import { shareCard, type Series } from '#lib/server/og/card.js';
import { inflateAtMost } from '#lib/server/og/inflate.js';
import { decimate, toPath } from '#lib/server/og/series.js';
import { renderPng } from '#lib/server/og/rasterize.js';
import { OG_IMAGE } from '#lib/seo.js';

export const prerender = false;

/** The picture never changes, but revoking a link has to take effect in minutes. */
const MAX_AGE = 300;

/** About eleven days at one sample a second, and four megabytes per buffer inflated. */
const MAX_CURVE_SAMPLES = 1_000_000;

/** How long a card that would not draw is left alone before it is tried again. */
const FAILED_RETRY_MS = 60 * 60 * 1000;

/** The one signal each kind is worth drawing. */
const SIGNAL = { trip: 'esp_vehspd', charging: 'ldcu_chrgpwr' } as const;

// Beside the share's buffers rather than under keys of their own, so that
// revoking a link deletes the card with the rest of it.
function stored(id: string): string {
	return `${sharePrefix(id)}og.png`;
}

function failed(id: string): string {
	return `${sharePrefix(id)}og.failed`;
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
 * be paid for on every cold render. The owner wrote these bytes, so every size
 * is checked before anything is read or inflated.
 */
async function curve(
	storage: R2Bucket,
	id: string,
	kind: 'trip' | 'charging'
): Promise<Series | undefined> {
	const key = SIGNAL[kind];

	// The manifest travels as a buffer like the rest, but it is plain JSON; the
	// `.gz` in its key is the naming convention, not a claim about its contents.
	const manifestObject = await storage.get(`${sharePrefix(id)}_manifest.gz`);
	if (!manifestObject || manifestObject.size > MAX_SHARE_MANIFEST_BYTES) return undefined;
	const manifest = parseManifest(await manifestObject.text());
	const spec = manifest?.columns.find((column) => column.key === key);
	if (!manifest || !spec || manifest.rows > MAX_CURVE_SAMPLES) return undefined;

	const [time, column] = await Promise.all([
		storage.get(`${sharePrefix(id)}${TIME_BLOB}.gz`),
		storage.get(`${sharePrefix(id)}${key}.gz`)
	]);
	if (!time || !column) return undefined;
	if (time.size > MAX_SHARE_BLOB_BYTES || column.size > MAX_SHARE_BLOB_BYTES) return undefined;

	// No dtype is wider than four bytes, so that is all a row may inflate to.
	const limit = manifest.rows * 4;
	const timeBytes = inflateAtMost(await time.arrayBuffer(), limit);
	const columnBytes = inflateAtMost(await column.arrayBuffer(), limit);
	if (!timeBytes || !columnBytes) return undefined;

	const values = decodeRange({
		spec: spec.spec,
		data: viewFor(spec.spec, columnBytes),
		nonNull: spec.nonNull,
		min: spec.min,
		max: spec.max
	});
	return toPath(decimate(new Uint32Array(timeBytes), values));
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

	const marker = await storage.head(failed(share.id));
	if (marker && Date.now() - marker.uploaded.getTime() < FAILED_RETRY_MS) redirect(302, OG_IMAGE);

	const thing = {
		kind: share.kind,
		model: share.vmodel,
		title: share.title,
		meta: storedMeta(share.meta_json)
	};

	// A share whose buffers never finished uploading still gets a card, without
	// the curve: a missing picture is worse than a plain one.
	let series: Series | undefined;
	try {
		series = await curve(storage, share.id, share.kind);
	} catch {
		series = undefined;
	}

	const draw = (drawn: Series | undefined) =>
		renderPng(
			shareCard({
				heading: shareHeading(thing),
				subtitle: shareSummary(thing),
				stats: shareFigures(thing),
				series: drawn
			})
		);

	let body: Uint8Array<ArrayBuffer> | undefined;
	try {
		body = await draw(series);
	} catch {
		if (series) body = await draw(undefined).catch(() => undefined);
	}

	// Writes go behind the response: the reader has their picture either way,
	// and a scraper should not wait on an object store to get it.
	if (!body) {
		event.platform?.ctx?.waitUntil(storage.put(failed(share.id), ''));
		redirect(302, OG_IMAGE);
	}

	// Until the upload window closes, a card without its curve may only mean the
	// buffers are still on their way.
	if (series || now() > share.created_at + SHARE_UPLOAD_WINDOW_SECONDS) {
		event.platform?.ctx?.waitUntil(storage.put(key, body));
	}

	return png(body, body.byteLength);
};
