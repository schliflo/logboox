export const range = {
	lastDays: (count: number) => `Last ${count} days`,
	short: { 'last-7': '7 days', 'last-30': '30 days', 'last-90': '90 days' } as Record<
		string,
		string
	>,
	all: 'All',
	everything: 'Everything',
	timeRange: 'Time range',
	timeRangeIs: (label: string) => `Time range: ${label}`,
	more: 'More',
	moreRanges: 'More time ranges',
	updating: 'Updating',
	showingOnly: (label: string) =>
		`Showing ${label} only. Totals and charts cover this range, not the whole export.`,
	showEverything: 'Show everything',
	recent: 'Recent',
	months: 'Months',
	years: 'Years',
	from: 'From',
	to: 'To',
	apply: 'Apply'
};

export const dropZone = {
	aria: 'Drop your export files here',
	title: 'Drop the ZIP or the CSV files here',
	hint: 'All parts at once is fine. We sort and join them. Backups made here work too.',
	choose: 'Choose files'
};

export const moved = {
	backupFailed: 'The backup could not be written',
	somethingWrong: 'Something went wrong.',
	eyebrow: 'New address',
	/** Followed by the new address, set apart. */
	title: (site: string) => `${site} now lives at`,
	lede: 'This old address only lets you take your exports with you. The dashboard, accounts and the leaderboard are at the new one, and only the new one gets updates.',
	open: (host: string) => `Go to ${host}`,
	carryTitle: 'Bring your exports along',
	carryIntro:
		'Exports are kept per address, so the ones in this browser are invisible from the new one until you move them.',
	steps: (host: string) => [
		{ title: 'Back up', detail: 'Writes every export kept here into one file.' },
		{ title: `Open ${host}`, detail: 'The same app, at its new home.' },
		{
			title: 'Drop the file in',
			detail: 'Onto the start page there. Everything comes back as it was.'
		}
	],
	kept: (count: number, size: string) =>
		count === 1 ? `One export kept here, ${size}.` : `${count} exports kept here, ${size}.`,
	notKept: 'Nothing is kept in this browser, so there is nothing to carry over.',
	unavailable: 'This browser’s storage could not be read, so there is nothing to back up here.',
	backUp: 'Back up everything'
};

export const offline = {
	update: 'A newer version is available',
	updateDetail:
		'Reload to use it. Anything open now can be opened again from the start page afterwards.',
	reload: 'Reload',
	ready: 'Ready to work offline',
	readyDetail:
		'The app is now stored in this browser and opens without a connection. The exports you keep are here too.'
};

/** Notices raised by the stores rather than by a page. */
export const notices = {
	nothingRecorded: 'Nothing was recorded then',
	tooLittle: (label: string) => `${label} holds too little data to show on its own.`,
	rangeFailed: 'That range could not be shown',
	somethingWrong: 'Something went wrong.',
	notKept: 'This export was not kept',
	notKeptDetail: (reason: string) =>
		`${reason} You can still read it now, but it will be gone when the tab closes.`,
	kept: 'Kept in this browser',
	keptDetail:
		'This export is now stored on your device, so you can reopen it without dropping the files in again. Remove it whenever you like from the start page.',
	notCopied: 'This export was not copied to your account',
	restored: (count: number) => (count === 1 ? 'Restored one export' : `Restored ${count} exports`),
	restoredSkipped: (count: number) => `${count} could not be read by this version of the app.`,
	restoredListed: 'They are listed below, ready to open.',
	candidateOne: (board: string | null, rank: number) =>
		`Your ${board ? board.toLowerCase() : 'trip'} would be #${rank} this month`,
	candidateMany: (count: number) => `${count} of your trips would make this month’s boards`,
	candidateDetail:
		'Nothing has been published. Have a look and decide whether to put your name to it.',
	see: 'See',
	logbookUnreadable: 'The logbook could not be read from this browser.'
};

export const errors = {
	unreachable: 'LogbooX could not be reached.',
	checkConnection: 'Check your connection and try again.',
	server: 'Something went wrong on the server.',
	fetch: 'That could not be fetched from your account.',
	localStore: 'The local store could not be read.',
	linkRequest: 'The link could not be requested.',
	saveFailed: 'That could not be saved.',
	noLogbookNote: 'There is no logbook open to keep this note in.',
	noLogbookNotes: 'There is no logbook open to keep these notes in.'
};
