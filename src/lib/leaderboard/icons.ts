/**
 * One icon per board, as data rather than components, so the badge (drawn on
 * the server as SVG) and the page (Svelte) can share them.
 *
 * Paths are from Lucide (https://lucide.dev, ISC licence, copyright the Lucide
 * Contributors), on its 24×24 grid and meant to be stroked, not filled.
 */

import type { BoardId } from './boards';

export type IconNode = [tag: string, attrs: Record<string, string>][];

export const BOARD_ICONS: Record<BoardId, IconNode> = {
	// zap
	'peak-charge': [
		[
			'path',
			{
				d: 'M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z'
			}
		]
	],
	// battery-charging
	'biggest-charge': [
		['path', { d: 'm11 7-3 5h4l-3 5' }],
		['path', { d: 'M14.856 6H16a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.935' }],
		['path', { d: 'M22 14v-4' }],
		['path', { d: 'M5.14 18H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2.936' }]
	],
	// route
	'longest-drive': [
		['circle', { cx: '6', cy: '19', r: '3' }],
		['path', { d: 'M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15' }],
		['circle', { cx: '18', cy: '5', r: '3' }]
	],
	// leaf
	'efficient-drive': [
		[
			'path',
			{ d: 'M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z' }
		],
		['path', { d: 'M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12' }]
	],
	// recycle
	'best-regen': [
		['path', { d: 'M7 19H4.815a1.83 1.83 0 0 1-1.57-.881 1.785 1.785 0 0 1-.004-1.784L7.196 9.5' }],
		['path', { d: 'M11 19h8.203a1.83 1.83 0 0 0 1.556-.89 1.784 1.784 0 0 0 0-1.775l-1.226-2.12' }],
		['path', { d: 'm14 16-3 3 3 3' }],
		['path', { d: 'M8.293 13.596 7.196 9.5 3.1 10.598' }],
		[
			'path',
			{
				d: 'm9.344 5.811 1.093-1.892A1.83 1.83 0 0 1 11.985 3a1.784 1.784 0 0 1 1.546.888l3.943 6.843'
			}
		],
		['path', { d: 'm13.378 9.633 4.096 1.098 1.097-4.096' }]
	],
	// rocket
	'hardest-launch': [
		['path', { d: 'M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5' }],
		[
			'path',
			{
				d: 'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09'
			}
		],
		[
			'path',
			{
				d: 'M9 12a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.4 22.4 0 0 1-4 2z'
			}
		],
		['path', { d: 'M9 12H4s.55-3.03 2-4c1.62-1.08 5 .05 5 .05' }]
	],
	// circle-dot
	'most-grip': [
		['circle', { cx: '12', cy: '12', r: '1' }],
		['circle', { cx: '12', cy: '12', r: '10' }]
	],
	// calendar-range
	'monthly-distance': [
		['rect', { x: '3', y: '3', width: '18', height: '18', rx: '2' }],
		['path', { d: 'M16 2v3' }],
		['path', { d: 'M3 9h18' }],
		['path', { d: 'M8 2v3' }],
		['path', { d: 'M17 13h-6' }],
		['path', { d: 'M13 17H7' }],
		['path', { d: 'M7 13h.01' }],
		['path', { d: 'M17 17h.01' }]
	]
};

/** The inner markup of a board's icon; the caller supplies the `<svg>` or `<g>` and the stroke. */
export function iconSvg(board: BoardId): string {
	return BOARD_ICONS[board]
		.map(([tag, attrs]) => {
			const list = Object.entries(attrs)
				.map(([name, value]) => `${name}="${value}"`)
				.join(' ');
			return `<${tag} ${list}/>`;
		})
		.join('');
}
