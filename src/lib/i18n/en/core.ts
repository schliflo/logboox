/** Words and formats shared across the app, and the frame around every page. */

export const common = {
	done: 'Done',
	cancel: 'Cancel',
	close: 'Close',
	save: 'Save',
	saving: 'Saving…',
	copy: 'Copy',
	copied: 'Copied',
	delete: 'Delete',
	remove: 'Remove',
	retry: 'Try again',
	loading: 'Loading…',
	back: 'Back',
	next: 'Next',
	previous: 'Previous',
	none: 'None',
	noReading: 'no reading',
	demoData: 'Demo data',
	sharedWithYou: 'Shared with you',
	dashboard: 'Dashboard',
	imprint: 'Imprint',
	privacy: 'Privacy',
	terms: 'Terms',
	language: 'Language',
	/** Joins a short list: "a, b and c". */
	andMore: 'and more',
	andOthers: 'and others'
};

export const format = {
	weekdays: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
	daysHours: (days: number, hours: number) => `${days} d ${hours} h`
};

export const nav = {
	home: 'Home',
	trips: 'Trips & logbook',
	tripsShort: 'Trips',
	tripsTab: 'Trips',
	logbookTab: 'Logbook',
	energy: 'Charging & battery',
	energyShort: 'Energy',
	chargingTab: 'Charging',
	batteryTab: 'Battery',
	insights: 'Insights',
	insightsOverviewTab: 'Overview',
	drivingTab: 'Driving style',
	doorsTyresTab: 'Doors & tyres',
	explorerTab: 'Signal explorer',
	privacyTab: 'What it knows',
	leaderboard: 'Leaderboard',
	leaderboardShort: 'Boards',
	data: 'Data & account',
	dataShort: 'Data',
	sections: 'Sections',
	areaSections: (area: string) => `${area} sections`
};

export const shell = {
	yourCar: 'Your car',
	community: 'Community',
	openExport: 'Open your export',
	replay: 'Replay the highlights',
	backToStart: (site: string) => `${site} — back to the start`,
	tripsWithoutPlace: (count: number) => `${count} trips without a place`,
	madeBy: 'Made by',
	demoCar: 'Demo car',
	since: (label: string, date: string) => `${label} · since ${date}`,
	upTo: (date: string) => `Up to ${date}`,
	addNewer: 'Add newer data',
	dashDescription: 'Trips, charging, battery and driving style, read out of your own XPeng export.'
};

export const progress = {
	gettingStarted: 'Getting started',
	phases: {
		reading: 'Reading files',
		parsing: 'Parsing signals',
		joining: 'Lining up the timeline',
		analyzing: 'Finding patterns',
		generating: 'Building demo data',
		storing: 'Keeping a copy in this browser',
		loading: 'Reading the kept export',
		merging: 'Joining the timelines',
		packing: 'Packing the backup',
		restoring: 'Restoring from the backup',
		uploading: 'Copying to your account',
		downloading: 'Fetching from your account'
	},
	streams: {
		status: 'Doors & tyres',
		operation: 'Driving',
		power: 'Battery & power'
	},
	part: (index: number, count: number) => `Export ${index} of ${count}`,
	bytesOf: (loaded: string, total: string) => `${loaded} of ${total}`,
	local: 'Everything is happening in this browser tab. Nothing is being uploaded.'
};

export const purpose = {
	business: 'Business',
	commute: 'Commute',
	private: 'Private',
	label: 'Label'
};

export const findings = {
	whatStandsOut: 'What stands out'
};
