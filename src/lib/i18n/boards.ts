/** Board, group and medal names in the current language. */

import type { BoardId } from '../leaderboard/boards';
import type { Medal } from '../leaderboard/medals';
import { m } from './index.svelte';
import { num } from '../utils/format';

export function boardText(id: BoardId): { label: string; blurb: string } {
	return m.boards.items[id];
}

export function groupLabel(label: string): string {
	return m.boards.groups[label] ?? label;
}

export function medalName(medal: Medal): string {
	return m.boards.medals[medal];
}

/** A board's value as the UI prints it, without its unit. */
export function boardValue(board: { unit: string; digits: number }, value: number): string {
	if (board.unit === '%') return num(Math.round(value * 100));
	return num(value, board.digits);
}
