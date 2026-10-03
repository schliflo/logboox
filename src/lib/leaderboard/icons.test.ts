import { describe, expect, it } from 'vitest';
import { BOARD_IDS } from './boards';
import { BOARD_ICONS, iconSvg } from './icons';

describe('board icons', () => {
	it('covers every board, and nothing else', () => {
		expect(Object.keys(BOARD_ICONS).sort()).toEqual([...BOARD_IDS].sort());
	});

	it('draws each one as well-formed shapes', () => {
		for (const id of BOARD_IDS) {
			const markup = iconSvg(id);
			expect(markup).toMatch(/^<(path|circle|rect|line)\b/);
			expect(markup).not.toMatch(/[<>]"|="[^"]*</);
		}
	});
});
