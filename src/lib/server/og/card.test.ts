import { describe, expect, it } from 'vitest';
import { boardCard, escape, fit, shareCard, wrap } from './card';

/**
 * Enough of an XML parser to prove a card is well formed.
 *
 * There is no DOM in the server test project and no parser worth adding a
 * dependency for, but the property that matters is small: tags nest and close,
 * attribute values are quoted, and no unescaped `&` or `<` from somebody's
 * chosen name has leaked into the text. A card that fails any of those renders
 * as nothing at all, which is the failure this file exists to catch.
 */
function parse(svg: string): { tags: string[]; texts: string[] } {
	const stack: string[] = [];
	const tags: string[] = [];
	const texts: string[] = [];
	let text: string | null = null;
	let at = 0;

	while (at < svg.length) {
		const open = svg.indexOf('<', at);
		const between = svg.slice(at, open < 0 ? undefined : open);

		if (/&(?!(amp|lt|gt|quot|apos|#\d+);)/.test(between)) {
			throw new Error(`unescaped ampersand in ${JSON.stringify(between)}`);
		}
		if (text !== null) text += between;
		if (open < 0) break;

		const close = svg.indexOf('>', open);
		if (close < 0) throw new Error('unterminated tag');
		const tag = svg.slice(open + 1, close);
		at = close + 1;

		if (tag.startsWith('/')) {
			const name = tag.slice(1);
			if (stack.pop() !== name) throw new Error(`</${name}> does not close the open element`);
			if (name === 'text' && text !== null) {
				texts.push(text.replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => UNESCAPE[e]));
				text = null;
			}
			continue;
		}

		const name = tag.match(/^[\w:.-]+/)?.[0];
		if (!name) throw new Error(`unnamed element in <${tag}>`);
		tags.push(name);

		// Every attribute must be name="value"; an unquoted one is not XML.
		const attributes = tag.slice(name.length).replace(/\/$/, '');
		if (attributes.trim() && !/^(\s+[\w:.-]+="[^"]*")+\s*$/.test(attributes)) {
			throw new Error(`badly formed attributes in <${tag}>`);
		}

		if (!tag.endsWith('/')) {
			stack.push(name);
			if (name === 'text') text = '';
		}
	}

	if (stack.length) throw new Error(`unclosed ${stack.join(', ')}`);
	return { tags, texts };
}

const UNESCAPE: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'"
};

const texts = (svg: string) => parse(svg).texts;

describe('parse', () => {
	// The checker is load-bearing, so it gets its own two tests.
	it('rejects a document that is not well formed', () => {
		expect(() => parse('<svg><text>a</svg>')).toThrow();
		expect(() => parse('<svg><text>Tom & Jerry</text></svg>')).toThrow();
	});

	it('reads escaped text back', () => {
		expect(texts('<svg><text x="1">Tom &amp; &quot;Jerry&quot;</text></svg>')).toEqual([
			'Tom & "Jerry"'
		]);
	});
});

describe('escape', () => {
	it('escapes the five characters XML reserves', () => {
		expect(escape(`Tom & "Jerry" <it's>`)).toBe('Tom &amp; &quot;Jerry&quot; &lt;it&apos;s&gt;');
	});

	it('drops control characters, which no escape would rescue', () => {
		// Written out of char codes: a literal control character in a source
		// file is invisible in every editor and survives no copy and paste.
		const nul = String.fromCharCode(0);
		const unit = String.fromCharCode(31);
		expect(escape(`one${nul}two${unit}two`)).toBe('onetwotwo');
	});

	it('keeps the whitespace a card actually uses', () => {
		expect(escape('a\tb\nc')).toBe('a\tb\nc');
	});
});

describe('fit', () => {
	it('leaves text that already fits alone', () => {
		expect(fit('A 43.4 kWh charge', 1010, 72)).toBe('A 43.4 kWh charge');
	});

	it('cuts to an ellipsis rather than over the edge', () => {
		const out = fit('x'.repeat(400), 1010, 72);
		expect(out.endsWith('…')).toBe(true);
		expect(out.length).toBeLessThan(400);
	});

	it('never returns nothing, however little room there is', () => {
		expect(fit('something', 1, 72)).toBe('s…');
	});
});

describe('wrap', () => {
	it('breaks at a word boundary', () => {
		const lines = wrap('A 43.4 kWh charge on a 250 kW charger at Ionity', 2, 1010, 72);
		expect(lines).toHaveLength(2);
		expect(lines.join(' ')).toBe('A 43.4 kWh charge on a 250 kW charger at Ionity');
	});

	it('stops at the line limit and cuts what is left', () => {
		const lines = wrap('word '.repeat(60), 2, 1010, 72);
		expect(lines).toHaveLength(2);
		expect(lines[1].endsWith('…')).toBe(true);
	});

	it('keeps a single unbreakable word on one line', () => {
		expect(wrap('Kraftfahrzeughaftpflichtversicherung', 2, 1010, 72)).toHaveLength(1);
	});
});

describe('shareCard', () => {
	const series = { line: 'M0,10L1200,140', area: 'M0,150L0,10L1200,140L1200,150Z' };

	const card = shareCard({
		heading: 'A 43.4 kWh charge',
		subtitle: '35 min on a 250 kW charger, from an XPeng F30b',
		stats: [
			{ label: 'Delivered', value: '43.4 kWh' },
			{ label: 'Peak', value: '181 kW' },
			{ label: 'State of charge', value: '18 to 82%' },
			{ label: 'Duration', value: '35 min' }
		],
		series
	});

	it('is a well-formed 1200×630 document', () => {
		expect(() => parse(card)).not.toThrow();
		expect(card).toContain('width="1200" height="630"');
	});

	it('says the heading, the subtitle and every figure', () => {
		const shown = texts(card);
		expect(shown).toContain('A 43.4 kWh charge');
		expect(shown).toContain('35 min on a 250 kW charger, from an XPeng F30b');
		expect(shown).toContain('181 kW');
		expect(shown).toContain('State of charge');
	});

	it('draws the curve it was handed', () => {
		expect(card).toContain(series.line);
		expect(card).toContain(series.area);
	});

	it('draws a rule instead when there is no curve', () => {
		const bare = shareCard({ heading: 'A drive', subtitle: 'somewhere', stats: [] });
		expect(bare).not.toContain('url(#stroke)');
		expect(() => parse(bare)).not.toThrow();
	});

	it('shows at most four figures', () => {
		const many = shareCard({
			heading: 'A drive',
			subtitle: 'somewhere',
			stats: Array.from({ length: 9 }, (_, i) => ({ label: `L${i}`, value: `V${i}` }))
		});
		expect(texts(many)).toContain('V3');
		expect(texts(many)).not.toContain('V4');
	});

	it('survives a heading full of markup', () => {
		const nasty = shareCard({
			heading: '</svg><script>alert(1)</script>',
			subtitle: 'Tom & Jerry',
			stats: [{ label: '&', value: '<' }]
		});
		expect(parse(nasty).tags).not.toContain('script');
		expect(texts(nasty)).toContain('Tom & Jerry');
	});

	it('keeps the heading to two lines however long it is', () => {
		const long = shareCard({
			heading: 'A '.repeat(200),
			subtitle: 'x'.repeat(400),
			stats: []
		});
		expect(() => parse(long)).not.toThrow();
		// Two headline lines plus subtitle, wordmark and chip; no runaway rows.
		expect(texts(long).length).toBeLessThanOrEqual(5);
	});
});

describe('boardCard', () => {
	const tiles = Array.from({ length: 7 }, (_, i) => ({
		board: `Board ${i}`,
		name: `Driver ${i}`,
		value: `${i} kW`
	}));

	it('is a well-formed document naming the period', () => {
		const card = boardCard({ title: 'September 2026', badge: 'Open · 14 days to go', tiles });
		expect(() => parse(card)).not.toThrow();
		expect(texts(card)).toContain('September 2026');
		expect(texts(card)).toContain('Open · 14 days to go');
	});

	it('shows six tiles and no more', () => {
		const shown = texts(boardCard({ title: 'September 2026', badge: 'Settled', tiles }));
		expect(shown).toContain('Driver 5');
		expect(shown.filter((text) => text.startsWith('Driver '))).toHaveLength(6);
	});

	it('upper-cases the board name and leaves the chosen one alone', () => {
		const shown = texts(
			boardCard({ title: 'September 2026', badge: 'Settled', tiles: [tiles[0]] })
		);
		expect(shown).toContain('BOARD 0');
		expect(shown).toContain('Driver 0');
	});

	it('says so when nobody has claimed anything', () => {
		const card = boardCard({ title: 'September 2026', badge: 'Open', tiles: [] });
		expect(texts(card)).toContain('Nobody has claimed a place yet.');
	});

	it('survives a chosen name full of markup', () => {
		const card = boardCard({
			title: 'September 2026',
			badge: 'Open',
			tiles: [{ board: 'Peak charge', name: '<script>&"', value: '181 kW' }]
		});
		expect(parse(card).tags).not.toContain('script');
		expect(texts(card)).toContain('<script>&"');
	});
});
