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

/**
 * The readings that stand alone, and would otherwise be drawn as nothing.
 *
 * A line needs two adjacent samples. A reading with a gap on either side has
 * no neighbour to join, so it contributes no stroke at all — the one way a
 * chart can quietly lose data while still looking entirely correct. Those
 * indices get a dot instead.
 *
 * Deliberately not solved by joining across the gap. A break means the car
 * recorded nothing, and a line drawn over it would state a value for a night
 * the car spent asleep.
 */
export function isolatedPoints(values: ReadonlyArray<number | null>): number[] {
	const out: number[] = [];
	for (let i = 0; i < values.length; i++) {
		if (values[i] === null) continue;
		// Past either end counts as a gap: a single reading at the very start of
		// a series is just as alone as one in the middle.
		if ((values[i - 1] ?? null) === null && (values[i + 1] ?? null) === null) out.push(i);
	}
	return out;
}
