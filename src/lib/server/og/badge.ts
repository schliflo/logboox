/**
 * The badge a winner embeds, written as SVG like the cards beside it.
 *
 * Same ground, brand gradient and trick of cutting text by character count as
 * `card.ts`, drawn small: 560×160, with transparent corners so it sits on a
 * light forum theme as well as a dark one. Everything from a person is
 * escaped. Pure, so it is tested without WebAssembly.
 */

import { BADGE_HEIGHT, BADGE_WIDTH, periodLabel, type Medal } from '../../leaderboard/medals';
import { formatValue, type Board } from '../../leaderboard/boards';
import { iconSvg } from '../../leaderboard/icons';
import { escape, fit } from './card';

export interface Badge {
	username: string;
	medal: Medal;
	board: Board;
	value: number;
	/** `YYYY-MM` or `YYYY`. */
	period: string;
}

interface Metal {
	name: string;
	light: string;
	dark: string;
	/** The ring, a shade past `dark`. */
	rim: string;
	/** The icon, dark enough to read on this metal. */
	ink: string;
}

const METALS: Record<Medal, Metal> = {
	gold: { name: 'Gold', light: '#f5c84c', dark: '#b8860b', rim: '#fbe38e', ink: '#4a3200' },
	silver: { name: 'Silver', light: '#e8e8ea', dark: '#8d9096', rim: '#f6f6f7', ink: '#2c2e33' },
	bronze: { name: 'Bronze', light: '#e0a070', dark: '#8c5a2b', rim: '#f0c4a0', ink: '#3d2210' }
};

const SANS = 'font-family="Inter"';

/**
 * The size a name is set at, so that it always fits.
 *
 * A name is at most twenty-four characters and is somebody's own, so it is
 * shrunk rather than cut. Widths are Inter SemiBold's, rounded up by class.
 */
function nameSize(name: string): number {
	let ems = 0;
	for (const char of name) {
		if (/[WMmw]/.test(char)) ems += 0.98;
		else if (/[A-Z]/.test(char)) ems += 0.74;
		else if (/[0-9]/.test(char)) ems += 0.66;
		else ems += 0.6;
	}
	return Math.min(34, Math.floor((370 / Math.max(ems, 1)) * 10) / 10);
}

export function badgeSvg({ username, medal, board, value, period }: Badge): string {
	const metal = METALS[medal];
	const id = `badge-${medal}`;
	const size = nameSize(username);
	const figure = `${formatValue(board, value)} ${board.unit}`.trim();

	return `<svg xmlns="http://www.w3.org/2000/svg" width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" viewBox="0 0 ${BADGE_WIDTH} ${BADGE_HEIGHT}">
<defs>
<linearGradient id="${id}-metal" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${metal.light}"/><stop offset="1" stop-color="${metal.dark}"/>
</linearGradient>
<linearGradient id="${id}-rim" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${metal.rim}"/><stop offset="1" stop-color="${metal.dark}"/>
</linearGradient>
<linearGradient id="${id}-brand" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
<stop offset="0" stop-color="#3987e5"/><stop offset="1" stop-color="#199e70"/>
</linearGradient>
<radialGradient id="${id}-glow" cx="0.14" cy="0.5" r="0.6">
<stop offset="0" stop-color="${metal.light}" stop-opacity="0.22"/><stop offset="1" stop-color="${metal.light}" stop-opacity="0"/>
</radialGradient>
</defs>
<rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="20" fill="#0e0e0d"/>
<rect width="${BADGE_WIDTH}" height="${BADGE_HEIGHT}" rx="20" fill="url(#${id}-glow)"/>
<rect x="0.5" y="0.5" width="${BADGE_WIDTH - 1}" height="${BADGE_HEIGHT - 1}" rx="19.5" fill="none" stroke="#ffffff" stroke-opacity="0.1"/>
<circle cx="84" cy="80" r="54" fill="url(#${id}-rim)"/>
<circle cx="84" cy="80" r="47" fill="url(#${id}-metal)"/>
<circle cx="84" cy="80" r="47" fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1.5"/>
<g transform="translate(58,54) scale(2.17)" fill="none" stroke="${metal.ink}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${iconSvg(board.id)}</g>
<text x="162" y="68" ${SANS} font-weight="600" font-size="${size}" letter-spacing="${(-size / 34).toFixed(2)}" fill="#f5f5f4">${escape(username)}</text>
<text x="162" y="98" ${SANS} font-weight="600" font-size="20" fill="${metal.light}">${metal.name}<tspan font-weight="400" fill="#a3a29c">&#160;· ${escape(fit(board.label, 340, 20))}</tspan></text>
<text x="162" y="130" ${SANS} font-size="20" fill="#c9c8c3">${escape(fit(`${figure} · ${periodLabel(period)}`, 380, 20))}</text>
<g transform="translate(466,16)">
<rect width="20" height="20" rx="5" fill="url(#${id}-brand)"/>
<path d="M3 13.1 L7.2 13.1 L9.7 5.6 L12.8 13.1 L17 8.1" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
</g>
<text x="492" y="31" ${SANS} font-weight="600" font-size="14" letter-spacing="-0.3" fill="#a3a29c">LogbooX</text>
</svg>`;
}
