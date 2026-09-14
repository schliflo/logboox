/**
 * The link-preview cards, written as SVG.
 *
 * Hand-written markup rather than a layout engine, because resvg draws SVG and
 * nothing else — no HTML, no flexbox, no `background-clip: text`. Everything is
 * positioned absolutely, which is bearable only because these are two fixed
 * designs rather than a general layout problem. `design/og-card.html` is the
 * static card they follow: the same ground, the same glow, the same brand
 * gradient, the same trace along the foot.
 *
 * Two constraints run through it. There is no way to measure text on a server
 * without a font engine, so long strings are cut by character count against a
 * budget worked out from the font size — generous enough to look deliberate,
 * mean enough never to run off the edge. And every value that came from a
 * person or a vehicle is escaped, because a name with an ampersand in it would
 * otherwise produce a broken document, which renders as no card at all.
 *
 * Pure: the routes hand in strings and numbers and get a string back. That
 * makes the layout testable without going anywhere near WebAssembly.
 */

const WIDTH = 1200;
const HEIGHT = 630;

/** The band along the foot of the card where a curve is drawn. */
const STRIP = 150;

export interface Stat {
	label: string;
	value: string;
}

export interface Series {
	/** Paths from `toPath`, already fitted to 1200×150. */
	line: string;
	area: string;
}

export interface ShareCard {
	/** The large line: what this is. */
	heading: string;
	/** The smaller line beneath it. */
	subtitle: string;
	/** Up to four figures along the foot. */
	stats: Stat[];
	/** The curve behind them, when the share carries signals worth drawing. */
	series?: Series;
}

export interface Tile {
	board: string;
	name: string;
	value: string;
}

export interface BoardCard {
	title: string;
	/** The pill at the top right: the period, and whether it is settled. */
	badge: string;
	tiles: Tile[];
}

/** Characters XML will not carry, in text that came from somebody else. */
const FORBIDDEN = new RegExp('[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f]', 'g');

/** XML has five characters that cannot appear raw, and a card must not break. */
export function escape(text: string): string {
	return text
		.replace(FORBIDDEN, '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/**
 * Cut a string to a width, with no font engine to ask.
 *
 * Inter's mixed-case text averages a little over half the font size per
 * character, so a budget of `width / (size * 0.55)` characters is close enough
 * for text that is allowed to stop short of the edge. It errs towards cutting
 * early: a heading ending in an ellipsis reads as a choice, one running off the
 * card reads as a bug.
 */
export function fit(text: string, width: number, size: number): string {
	const budget = Math.max(1, Math.floor(width / (size * 0.55)));
	const trimmed = text.trim();
	if (trimmed.length <= budget) return trimmed;
	return trimmed.slice(0, Math.max(1, budget - 1)).trimEnd() + '…';
}

/**
 * Break a heading over at most `lines` lines at word boundaries.
 *
 * Whatever will not fit stays on the last line and is cut there, so one budget
 * decides both where the text wraps and where it stops.
 */
export function wrap(text: string, lines: number, width: number, size: number): string[] {
	const budget = Math.max(1, Math.floor(width / (size * 0.55)));
	const words = text.split(/\s+/).filter(Boolean);
	const out: string[] = [];
	let current = '';

	for (const word of words) {
		const next = current ? `${current} ${word}` : word;
		if (next.length <= budget || !current || out.length === lines - 1) {
			current = next;
			continue;
		}
		out.push(current);
		current = word;
	}
	if (current) out.push(current);
	if (out.length === 0) return [''];
	out[out.length - 1] = fit(out[out.length - 1], width, size);
	return out;
}

/** Gradients and the glow, which resvg wants declared before they are used. */
function defs(): string {
	return `<defs>
<linearGradient id="brand" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#3987e5"/><stop offset="1" stop-color="#199e70"/>
</linearGradient>
<linearGradient id="headline" x1="72" y1="0" x2="1000" y2="0" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#5aa0f0"/><stop offset="1" stop-color="#2fc08c"/>
</linearGradient>
<linearGradient id="stroke" x1="0" y1="0" x2="${WIDTH}" y2="0" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#3987e5"/><stop offset="1" stop-color="#199e70"/>
</linearGradient>
<linearGradient id="beneath" x1="0" y1="0" x2="0" y2="${STRIP}" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#3987e5" stop-opacity="0.30"/><stop offset="1" stop-color="#3987e5" stop-opacity="0"/>
</linearGradient>
<radialGradient id="glow" cx="0.46" cy="0" r="0.72" gradientTransform="matrix(1 0 0 1.35 0 0)">
<stop offset="0" stop-color="#3987e5" stop-opacity="0.42"/><stop offset="1" stop-color="#3987e5" stop-opacity="0"/>
</radialGradient>
</defs>`;
}

/** The outlined capsule at the top right, sized from the text it holds. */
function pill(text: string): string {
	const label = fit(text, 440, 20);
	const width = Math.round(label.length * 10.4) + 36;
	const x = WIDTH - 72 - width;
	return `<rect x="${x}" y="70" width="${width}" height="42" rx="21" fill="#ffffff" fill-opacity="0.05" stroke="#ffffff" stroke-opacity="0.14"/>
<text x="${x + width / 2}" y="97" text-anchor="middle" font-family="Inter" font-size="20" fill="#c9c8c3">${escape(label)}</text>`;
}

/** What every card opens with: ground, glow, badge, wordmark and chip. */
function frame(chip: string): string {
	return `<rect width="${WIDTH}" height="${HEIGHT}" fill="#0e0e0d"/>
<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
<g transform="translate(72,58)">
<rect width="64" height="64" rx="15" fill="url(#brand)"/>
<path d="M10 42 L23 42 L31 18 L41 42 L54 26" fill="none" stroke="#fff" stroke-width="6.5" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<text x="156" y="104" font-family="Inter" font-weight="600" font-size="38" letter-spacing="-1.1" fill="#f5f5f4">LogbooX</text>
${pill(chip)}`;
}

/** The curve along the foot, or the quiet rule that stands in for it. */
function trace(series: Series | undefined): string {
	if (!series?.line) {
		return `<rect x="72" y="${HEIGHT - 44}" width="${WIDTH - 144}" height="1" fill="#ffffff" fill-opacity="0.09"/>`;
	}
	return `<g transform="translate(0,${HEIGHT - STRIP})" opacity="0.9">
<path d="${series.area}" fill="url(#beneath)"/>
<path d="${series.line}" fill="none" stroke="url(#stroke)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
</g>`;
}

function document(body: string): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">${defs()}${body}</svg>`;
}

/**
 * The card for a shared trip or charging session.
 *
 * The heading may take a second line, because "A 43.4 kWh charge on a 250 kW
 * charger" is a normal thing for it to say and shrinking the type to fit would
 * leave the card looking apologetic. The block slides up when it does, so the
 * subtitle keeps its distance from the figures.
 */
export function shareCard({ heading, subtitle, stats, series }: ShareCard): string {
	const lines = wrap(heading, 2, 1010, 72);
	const top = 232 - (lines.length - 1) * 42;

	const headline = lines
		.map(
			(line, i) =>
				`<text x="72" y="${top + i * 84}" font-family="Inter" font-weight="600" font-size="72" letter-spacing="-2.4" fill="url(#headline)">${escape(line)}</text>`
		)
		.join('');

	const sub = `<text x="72" y="${top + lines.length * 84 + 4}" font-family="Inter" font-size="28" fill="#a3a29c">${escape(
		fit(subtitle, 1056, 28)
	)}</text>`;

	// Four columns across the usable width, however many figures there are.
	const figures = stats
		.slice(0, 4)
		.map((stat, i) => {
			const x = 72 + i * 264;
			return `<text x="${x}" y="${HEIGHT - 190}" font-family="Inter" font-weight="600" font-size="42" letter-spacing="-1.2" fill="#f5f5f4">${escape(
				fit(stat.value, 252, 42)
			)}</text>
<text x="${x}" y="${HEIGHT - 156}" font-family="Inter" font-size="21" fill="#8b8a84">${escape(fit(stat.label, 252, 21))}</text>`;
		})
		.join('');

	return document(
		`${frame('Read from an XPeng data export')}${trace(series)}${headline}${sub}${figures}`
	);
}

/**
 * The card for a month's boards, or a year's.
 *
 * Up to six tiles in two rows of three — six rather than the seven boards there
 * are, because a seventh leaves a hole in the grid that reads as something
 * having failed to load, and because a card is an invitation to the page rather
 * than a copy of it.
 */
export function boardCard({ title, badge, tiles }: BoardCard): string {
	const heading = `<text x="72" y="224" font-family="Inter" font-weight="600" font-size="66" letter-spacing="-2.2" fill="url(#headline)">${escape(
		fit(title, 1010, 66)
	)}</text>`;

	const shown = tiles.slice(0, 6);
	const cells = shown
		.map((tile, i) => {
			const x = 72 + (i % 3) * 356;
			const y = 280 + Math.floor(i / 3) * 148;
			return `<rect x="${x}" y="${y}" width="330" height="124" rx="18" fill="#ffffff" fill-opacity="0.045" stroke="#ffffff" stroke-opacity="0.09"/>
<text x="${x + 24}" y="${y + 38}" font-family="Inter" font-size="19" letter-spacing="0.6" fill="#8b8a84">${escape(
				fit(tile.board.toUpperCase(), 282, 19)
			)}</text>
<text x="${x + 24}" y="${y + 76}" font-family="Inter" font-weight="600" font-size="34" letter-spacing="-0.9" fill="#f5f5f4">${escape(
				fit(tile.value, 282, 34)
			)}</text>
<text x="${x + 24}" y="${y + 106}" font-family="Inter" font-size="21" fill="#a3a29c">${escape(fit(tile.name, 282, 21))}</text>`;
		})
		.join('');

	const empty = shown.length
		? ''
		: '<text x="72" y="344" font-family="Inter" font-size="30" fill="#a3a29c">Nobody has claimed a place yet.</text>';

	return document(`${frame(badge)}${trace(undefined)}${heading}${cells}${empty}`);
}
