/**
 * Where everything in the dashboard lives.
 *
 * Four areas about the car, one about the community, one about the data
 * itself. Each area may have tabs, which are the old one-page sections it
 * gathered up; a tab keeps its own address, so links and bookmarks into it
 * still work.
 */

import HomeIcon from '@lucide/svelte/icons/house';
import RouteIcon from '@lucide/svelte/icons/route';
import ZapIcon from '@lucide/svelte/icons/zap';
import ChartIcon from '@lucide/svelte/icons/chart-line';
import TrophyIcon from '@lucide/svelte/icons/trophy';
import DatabaseIcon from '@lucide/svelte/icons/database';

export interface Tab {
	href: string;
	label: string;
}

export interface Area {
	id: 'home' | 'trips' | 'energy' | 'insights' | 'leaderboard' | 'data';
	href: string;
	label: string;
	/** What the phone's tab bar calls it, where the full label does not fit. */
	short: string;
	icon: typeof HomeIcon;
	tabs: Tab[];
}

export const CAR_AREAS: Area[] = [
	{ id: 'home', href: '/dash/overview', label: 'Home', short: 'Home', icon: HomeIcon, tabs: [] },
	{
		id: 'trips',
		href: '/dash/trips',
		label: 'Trips & logbook',
		short: 'Trips',
		icon: RouteIcon,
		tabs: [
			{ href: '/dash/trips', label: 'Trips' },
			{ href: '/dash/logbook', label: 'Logbook' }
		]
	},
	{
		id: 'energy',
		href: '/dash/charging',
		label: 'Charging & battery',
		short: 'Energy',
		icon: ZapIcon,
		tabs: [
			{ href: '/dash/charging', label: 'Charging' },
			{ href: '/dash/battery', label: 'Battery' }
		]
	},
	{
		id: 'insights',
		href: '/dash/insights',
		label: 'Insights',
		short: 'Insights',
		icon: ChartIcon,
		tabs: [
			{ href: '/dash/insights', label: 'Overview' },
			{ href: '/dash/driving', label: 'Driving style' },
			{ href: '/dash/doors-tyres', label: 'Doors & tyres' },
			{ href: '/dash/explorer', label: 'Signal explorer' },
			{ href: '/dash/privacy', label: 'What it knows' }
		]
	}
];

export const LEADERBOARD: Area = {
	id: 'leaderboard',
	href: '/leaderboard',
	label: 'Leaderboard',
	short: 'Boards',
	icon: TrophyIcon,
	tabs: []
};

export const DATA: Area = {
	id: 'data',
	href: '/dash/data',
	label: 'Data & account',
	short: 'Data',
	icon: DatabaseIcon,
	tabs: [{ href: '/dash/data', label: 'Data & account' }]
};

const ALL = [...CAR_AREAS, DATA];

/** The area a dashboard address belongs to, by its own href or one of its tabs. */
export function areaFor(pathname: string): Area | null {
	return (
		ALL.find(
			(area) =>
				area.href === pathname ||
				area.tabs.some((tab) => tab.href === pathname || pathname.startsWith(`${tab.href}/`))
		) ?? null
	);
}

/** The tab a dashboard address shows, when its area has more than one. */
export function tabFor(pathname: string): Tab | null {
	return areaFor(pathname)?.tabs.find((tab) => tab.href === pathname) ?? null;
}
