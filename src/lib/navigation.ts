/**
 * Where everything in the dashboard lives.
 *
 * Four areas about the car, one about the community, one about the data
 * itself. Each area may have tabs, which are the old one-page sections it
 * gathered up; a tab keeps its own address, so links and bookmarks into it
 * still work. Labels are getters, so they follow the chosen language.
 */

import HomeIcon from '@lucide/svelte/icons/house';
import RouteIcon from '@lucide/svelte/icons/route';
import ZapIcon from '@lucide/svelte/icons/zap';
import ChartIcon from '@lucide/svelte/icons/chart-line';
import TrophyIcon from '@lucide/svelte/icons/trophy';
import DatabaseIcon from '@lucide/svelte/icons/database';
import { m } from './i18n/index.svelte';

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
	{
		id: 'home',
		href: '/dash/overview',
		get label() {
			return m.nav.home;
		},
		get short() {
			return m.nav.home;
		},
		icon: HomeIcon,
		tabs: []
	},
	{
		id: 'trips',
		href: '/dash/trips',
		get label() {
			return m.nav.trips;
		},
		get short() {
			return m.nav.tripsShort;
		},
		icon: RouteIcon,
		tabs: [
			{
				href: '/dash/trips',
				get label() {
					return m.nav.tripsTab;
				}
			},
			{
				href: '/dash/logbook',
				get label() {
					return m.nav.logbookTab;
				}
			}
		]
	},
	{
		id: 'energy',
		href: '/dash/charging',
		get label() {
			return m.nav.energy;
		},
		get short() {
			return m.nav.energyShort;
		},
		icon: ZapIcon,
		tabs: [
			{
				href: '/dash/charging',
				get label() {
					return m.nav.chargingTab;
				}
			},
			{
				href: '/dash/battery',
				get label() {
					return m.nav.batteryTab;
				}
			}
		]
	},
	{
		id: 'insights',
		href: '/dash/insights',
		get label() {
			return m.nav.insights;
		},
		get short() {
			return m.nav.insights;
		},
		icon: ChartIcon,
		tabs: [
			{
				href: '/dash/insights',
				get label() {
					return m.nav.insightsOverviewTab;
				}
			},
			{
				href: '/dash/driving',
				get label() {
					return m.nav.drivingTab;
				}
			},
			{
				href: '/dash/doors-tyres',
				get label() {
					return m.nav.doorsTyresTab;
				}
			},
			{
				href: '/dash/explorer',
				get label() {
					return m.nav.explorerTab;
				}
			},
			{
				href: '/dash/privacy',
				get label() {
					return m.nav.privacyTab;
				}
			}
		]
	}
];

export const LEADERBOARD: Area = {
	id: 'leaderboard',
	href: '/leaderboard',
	get label() {
		return m.nav.leaderboard;
	},
	get short() {
		return m.nav.leaderboardShort;
	},
	icon: TrophyIcon,
	tabs: []
};

export const DATA: Area = {
	id: 'data',
	href: '/dash/data',
	get label() {
		return m.nav.data;
	},
	get short() {
		return m.nav.dataShort;
	},
	icon: DatabaseIcon,
	tabs: [
		{
			href: '/dash/data',
			get label() {
				return m.nav.data;
			}
		}
	]
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
