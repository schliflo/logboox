/**
 * What a shared link says it is.
 *
 * One place, because the same few sentences are now written three times over:
 * as the heading of the page, as the description a crawler reads, and as the
 * text drawn into the image a link preview shows. They were allowed to drift
 * exactly once before this file existed, and a card that disagrees with the
 * page it links to is worse than no card.
 *
 * Pure, and formats through `$lib/og/format` rather than `$lib/utils/format`:
 * the latter reads the viewer's timezone out of a rune, and a card has no
 * viewer. Nothing here touches a time, so nothing here needs one.
 *
 * Every figure comes from the `meta` a share carries, which holds numbers the
 * page prints and no identifiers at all — no odometer, no vehicle
 * identification number, no account.
 */

import { duration, measure, num, shortDuration } from '../og/format';

export type ShareKind = 'trip' | 'charging' | 'export';

export interface SharedThing {
	kind: ShareKind;
	/** The model, which is all the card says about the car. */
	model: string;
	/** What the person who made the link chose to call it, if anything. */
	title?: string | null;
	meta: Record<string, unknown>;
}

export interface Figure {
	label: string;
	value: string;
}

function number(meta: Record<string, unknown>, key: string): number {
	const value = meta[key];
	return typeof value === 'number' ? value : Number.NaN;
}

/** The large line: what this is, in one phrase. */
export function shareHeading(share: SharedThing): string {
	if (share.title) return share.title;
	if (share.kind === 'trip') return `A ${num(number(share.meta, 'distanceKm'), 1)} km drive`;
	if (share.kind === 'charging')
		return `A ${num(number(share.meta, 'kwhDelivered'), 1)} kWh charge`;
	return 'A month of driving';
}

/** The sentence beneath it, and the description a crawler reads. */
export function shareSummary(share: SharedThing): string {
	const car = `from an XPeng ${share.model}`;

	if (share.kind === 'trip') {
		const distance = measure(number(share.meta, 'distanceKm'), 'km', 1);
		return `${distance} in ${duration(number(share.meta, 'duration'))}, second by second, ${car}.`;
	}

	if (share.kind === 'charging') {
		const delivered = measure(number(share.meta, 'kwhDelivered'), 'kWh', 1);
		const peak = measure(number(share.meta, 'maxKw'), 'kW', 1);
		return `${delivered} at up to ${peak}, ${car}.`;
	}

	return `A month of driving ${car}.`;
}

/**
 * The four figures along the foot of the card.
 *
 * Whichever of them the share actually carries: an older link, or one made from
 * a month where a signal was never reported, simply has fewer. A figure reading
 * "—" tells nobody anything and takes a quarter of the card to do it.
 */
export function shareFigures(share: SharedThing): Figure[] {
	const { meta } = share;
	const candidates: Array<Figure & { known: boolean }> =
		share.kind === 'trip'
			? [
					{
						label: 'Distance',
						value: measure(number(meta, 'distanceKm'), 'km', 1),
						known: Number.isFinite(number(meta, 'distanceKm'))
					},
					{
						label: 'Duration',
						value: shortDuration(number(meta, 'duration')),
						known: Number.isFinite(number(meta, 'duration'))
					},
					{
						label: 'Top speed',
						value: measure(number(meta, 'maxSpeed'), 'km/h'),
						known: Number.isFinite(number(meta, 'maxSpeed'))
					},
					{
						label: 'Energy used',
						value: measure(number(meta, 'energyKwh'), 'kWh', 1),
						known: Number.isFinite(number(meta, 'energyKwh'))
					}
				]
			: share.kind === 'charging'
				? [
						{
							label: 'Delivered',
							value: measure(number(meta, 'kwhDelivered'), 'kWh', 1),
							known: Number.isFinite(number(meta, 'kwhDelivered'))
						},
						{
							label: 'Peak power',
							value: measure(number(meta, 'maxKw'), 'kW', 1),
							known: Number.isFinite(number(meta, 'maxKw'))
						},
						{
							label: 'State of charge',
							value: `${num(number(meta, 'socStart'))} → ${num(number(meta, 'socEnd'))}%`,
							known:
								Number.isFinite(number(meta, 'socStart')) && Number.isFinite(number(meta, 'socEnd'))
						},
						{
							label: 'Duration',
							value: shortDuration(number(meta, 'duration')),
							known: Number.isFinite(number(meta, 'duration'))
						}
					]
				: [];

	return candidates.filter((figure) => figure.known).map(({ label, value }) => ({ label, value }));
}

/**
 * What a card shows, said in words for someone who cannot see it.
 *
 * Read aloud by a screen reader in place of the image, so it describes the
 * picture rather than repeating the heading the page already carries.
 */
export function shareImageAlt(share: SharedThing): string {
	const signal = share.kind === 'charging' ? 'Charging power' : 'Speed';
	return `${signal} across ${shareHeading(share).replace(/^A /, '')}, ${shareSummary(share)
		.replace(/\.$/, '')
		.replace(/^.*?(from an XPeng)/, '$1')}.`;
}
