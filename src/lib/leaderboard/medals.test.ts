import { describe, expect, it } from 'vitest';
import {
	BADGE_HEIGHT,
	BADGE_WIDTH,
	badgeAlt,
	badgeEmbeds,
	badgePath,
	medalFor,
	periodLabel
} from './medals';

describe('medals', () => {
	it('go to the top three, and ties share one', () => {
		expect([1, 2, 3, 4].map(medalFor)).toEqual(['gold', 'silver', 'bronze', null]);
		expect(medalFor(0)).toBeNull();
		expect(medalFor(1.5)).toBeNull();
	});
});

describe('badges', () => {
	it('live at a path that carries the name, escaped', () => {
		expect(badgePath('2026-09', 'peak-charge', 'Flo_S')).toBe(
			'/badge/2026-09/peak-charge/Flo_S.png'
		);
		expect(badgePath('2026', 'peak-charge', 'a b', 2)).toBe('/badge/2026/peak-charge/a%20b@2x.png');
	});

	it('name the period the way a heading does', () => {
		expect(periodLabel('2026-09')).toBe('September 2026');
		expect(periodLabel('2026')).toBe('2026');
		expect(periodLabel('nonsense')).toBe('nonsense');
	});

	it('say what they show, for readers who never see the picture', () => {
		expect(badgeAlt({ period: '2026-09', board: 'peak-charge', medal: 'gold' }, 'flo')).toBe(
			'flo — Gold, Fastest charge, September 2026 · LogbooX'
		);
	});

	it('embed the sharp file only where a display size can be given', () => {
		const embeds = badgeEmbeds(
			'https://logboox.app',
			{ period: '2026-09', board: 'peak-charge', medal: 'silver' },
			'flo'
		);
		expect(embeds.url).toBe('https://logboox.app/badge/2026-09/peak-charge/flo.png');
		expect(embeds.html).toContain('flo@2x.png');
		expect(embeds.html).toContain(`width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}"`);
		expect(embeds.discourse).toContain(`|${BADGE_WIDTH}x${BADGE_HEIGHT}](`);
		expect(embeds.markdown).not.toContain('@2x');
		expect(embeds.bbcode).toBe(
			'[url=https://logboox.app/leaderboard/2026-09][img]https://logboox.app/badge/2026-09/peak-charge/flo.png[/img][/url]'
		);
	});
});
