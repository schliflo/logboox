/**
 * Missing readings, in the form uPlot understands.
 *
 * Columns are decoded into `Float64Array`s, where a second the car reported
 * nothing for can only be NaN — a typed array has no room for null. uPlot
 * marks a gap with null instead, and treats NaN as an ordinary number: one of
 * them anywhere in a series makes the axis range NaN, and the panel then draws
 * nothing at all. That is not a rare shape. A charging session is joined across
 * the naps the car takes mid-charge, so the seconds inside a nap carry no
 * reading and every charging panel would be blank.
 */

/** The same values, with every gap turned into the null uPlot expects. */
export function withGaps(values: ArrayLike<number>): Array<number | null> {
	const out = new Array<number | null>(values.length);
	for (let i = 0; i < values.length; i++) {
		const value = values[i];
		out[i] = Number.isNaN(value) ? null : value;
	}
	return out;
}
