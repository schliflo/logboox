import { describe, expect, it } from 'vitest';
import { BADGE_HEIGHT, BADGE_WIDTH, MEDALS } from '../../leaderboard/medals';
import { BOARDS } from '../../leaderboard/boards';
import { badgeSvg } from './badge';

const board = BOARDS[0];
const base = { username: 'flo', medal: 'gold', board, value: 212.4, period: '2026-09' } as const;

describe('badgeSvg', () => {
	it('is one badge-sized document with the words on it', () => {
		const svg = badgeSvg(base);
		expect(svg).toContain(`width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}"`);
		expect(svg).toContain('>flo</text>');
		expect(svg).toContain('Gold');
		expect(svg).toContain('Fastest charge');
		expect(svg).toContain('212 kW · September 2026');
		expect(svg).toContain('LogbooX');
	});

	it('names a year as a year', () => {
		expect(badgeSvg({ ...base, period: '2026' })).toContain('212 kW · 2026');
	});

	it('gives each medal its own metal and gradient ids', () => {
		const seen = new Set<string>();
		for (const medal of MEDALS) {
			const svg = badgeSvg({ ...base, medal });
			expect(svg).toContain(`id="badge-${medal}-metal"`);
			seen.add(svg.match(/<stop offset="0" stop-color="(#\w+)"/)![1]);
		}
		expect(seen.size).toBe(3);
	});

	it('draws an icon for every board', () => {
		for (const each of BOARDS) {
			expect(badgeSvg({ ...base, board: each })).toMatch(
				/stroke-linejoin="round">(<path|<circle|<rect)/
			);
		}
	});

	it('escapes a hostile name', () => {
		const svg = badgeSvg({ ...base, username: '<script>"&' });
		expect(svg).not.toContain('<script>');
		expect(svg).toContain('&lt;script&gt;&quot;&amp;');
	});

	it('shrinks a long name rather than cutting it', () => {
		const name = 'WWWWWWWWWWWWWWWWWWWWWWWW';
		const svg = badgeSvg({ ...base, username: name });
		expect(svg).toContain(name);
		const size = Number(/font-size="([\d.]+)"[^>]*>W/.exec(svg)?.[1]);
		expect(size).toBeLessThan(17);
		expect(badgeSvg({ ...base, username: 'flo' })).toContain('font-size="34"');
	});
});
