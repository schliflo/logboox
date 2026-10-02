/**
 * A telemetry column reduced to a path a card can draw.
 *
 * Two steps, both pure and neither knowing what a card looks like. A shared
 * drive can carry tens of thousands of samples and the strip they are drawn in
 * is 1200 pixels wide, so the column is first reduced to a few hundred
 * vertices; then those vertices become the two `d` attributes the strip needs,
 * a stroke and the shape filled beneath it.
 *
 * Gaps are `NaN` on the way in, as everywhere else in the decoders, and become
 * breaks between subpaths on the way out — a charger that stopped for ten
 * minutes should leave a hole, not a straight line across it.
 */

/** A break in the line: the same convention the decoders use. */
const BREAK = Number.NaN;

export interface Reduced {
	x: number[];
	y: number[];
}

export interface Paths {
	/** The stroke, one subpath per unbroken run. */
	line: string;
	/** The same runs, closed to the foot of the strip. */
	area: string;
}

export interface StripOptions {
	width?: number;
	height?: number;
	/** Clearance above the highest point and below the lowest. */
	top?: number;
	bottom?: number;
}

/**
 * Reduce a column to roughly `points` vertices, keeping the extremes.
 *
 * Sampling every nth value would drop exactly what makes a charging curve worth
 * looking at, so each bucket contributes its lowest and its highest value, in
 * the order they occurred — the envelope survives even at a hundredth of the
 * resolution. That is two vertices per bucket, which is why the budget is
 * halved to get the bucket count.
 *
 * A bucket with nothing finite in it becomes one break. A bucket holding both
 * readings and gaps keeps its readings: at this scale a dropout of a sample or
 * two is noise, and breaking the line for it would leave the curve looking
 * dashed rather than interrupted.
 */
export function decimate(x: ArrayLike<number>, y: ArrayLike<number>, points = 600): Reduced {
	const length = Math.min(x.length, y.length);
	const outX: number[] = [];
	const outY: number[] = [];
	if (length === 0) return { x: outX, y: outY };

	const buckets = Math.max(1, Math.floor(points / 2));
	const size = Math.max(1, Math.ceil(length / buckets));

	for (let start = 0; start < length; start += size) {
		const end = Math.min(start + size, length);

		let lowAt = -1;
		let highAt = -1;
		for (let i = start; i < end; i++) {
			const value = y[i];
			if (Number.isNaN(value)) continue;
			if (lowAt < 0 || value < y[lowAt]) lowAt = i;
			if (highAt < 0 || value > y[highAt]) highAt = i;
		}

		if (lowAt < 0) {
			// Nothing was recorded across the whole bucket. One break says so;
			// consecutive empty buckets need no more than the first.
			if (outY.length > 0 && !Number.isNaN(outY[outY.length - 1])) {
				outX.push(x[start]);
				outY.push(BREAK);
			}
			continue;
		}

		const [first, second] = lowAt <= highAt ? [lowAt, highAt] : [highAt, lowAt];
		outX.push(x[first]);
		outY.push(y[first]);
		if (second !== first) {
			outX.push(x[second]);
			outY.push(y[second]);
		}
	}

	// A trailing break draws nothing and only lengthens the path.
	while (outY.length > 0 && Number.isNaN(outY[outY.length - 1])) {
		outX.pop();
		outY.pop();
	}

	return { x: outX, y: outY };
}

function round(value: number): string {
	return (Math.round(value * 10) / 10).toString();
}

/**
 * Fit reduced points to the strip and write the two paths.
 *
 * The horizontal scale is the span of `x`, the vertical the span of the finite
 * values — an absolute scale would flatten a gentle drive into a straight line
 * and the card is about shape, not about comparing one drive with another. A
 * column that never changes is drawn down the middle rather than divided by a
 * range of zero.
 */
export function toPath(points: Reduced, options: StripOptions = {}): Paths {
	const { width = 1200, height = 150, top = 22, bottom = 18 } = options;
	const { x, y } = points;

	let min = Infinity;
	let max = -Infinity;
	let finite = 0;
	for (const value of y) {
		if (Number.isNaN(value)) continue;
		finite++;
		if (value < min) min = value;
		if (value > max) max = value;
	}
	if (finite < 2) return { line: '', area: '' };

	const firstX = x[0];
	const lastX = x[x.length - 1];
	const span = lastX - firstX;
	const range = max - min;
	const floor = height - bottom;

	const at = (index: number): [string, string] => [
		round(span > 0 ? ((x[index] - firstX) / span) * width : width / 2),
		round(range > 0 ? floor - ((y[index] - min) / range) * (floor - top) : (floor + top) / 2)
	];

	const line: string[] = [];
	const area: string[] = [];
	let run: string[] = [];
	let runStart = '';

	const close = () => {
		// A single point has no stroke and no area; two make both.
		if (run.length > 1) {
			line.push(`M${run.join('L')}`);
			area.push(
				`M${runStart},${floor}L${run.join('L')}L${run[run.length - 1].split(',')[0]},${floor}Z`
			);
		}
		run = [];
	};

	for (let i = 0; i < y.length; i++) {
		if (Number.isNaN(y[i])) {
			close();
			continue;
		}
		const [px, py] = at(i);
		if (run.length === 0) runStart = px;
		run.push(`${px},${py}`);
	}
	close();

	return { line: line.join(''), area: area.join('') };
}
