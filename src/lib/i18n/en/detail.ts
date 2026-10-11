export const detail = {
	chargingPower: 'Charging power',
	stateOfCharge: 'State of charge',
	powerAtPlug: 'Power at the plug',
	speed: 'Speed',
	powerTitle: 'Power drawn from the battery, negative while recovering',
	power: 'Power',
	charge: 'Charge',
	accelerator: 'Accelerator',
	brake: 'Brake',
	pressed: 'pressed',
	released: 'released',
	driverTitle: 'What the driver was doing',
	steeringAngle: 'Steering angle',
	steering: 'Steering'
};

export const exportMenu = {
	failed: 'That file could not be written',
	pdfOffline: 'A PDF needs a connection the first time. The CSV and the spreadsheet do not.',
	download: 'Download',
	rows: (count: number) => `${count} ${count === 1 ? 'row' : 'rows'}, oldest first`,
	csvHint: 'for anything',
	xlsxHint: 'real dates',
	pdfHint: 'to hand over'
};

export const shares = {
	kinds: { trip: 'Trip', charging: 'Charging', export: 'Whole export' },
	revokeFailed: 'The link could not be revoked',
	stillLive: 'It is still live.',
	revoked: 'Link revoked',
	revokedDetail: 'It stops working for everyone within a few minutes.',
	copied: 'Link copied',
	copyFailed: 'Could not copy',
	title: 'Shared links',
	description:
		'Anyone with one of these can see what it shows. None of them carries your vehicle identification number.',
	kindOn: (kind: string, date: string) => `${kind} on ${date}`,
	made: (date: string) => `Made ${date}`,
	views: (count: number) => (count === 1 ? 'opened once' : `opened ${count} times`),
	copy: 'Copy this link',
	revoke: 'Revoke this link'
};

export const share = {
	trip: 'trip',
	session: 'charging session',
	tripSignals: 'speed, battery power and charge, pedals and steering',
	sessionSignals: 'charging power and charge',
	openFirst: 'Open an export first.',
	failed: 'The link could not be made.',
	halfMade: ' A half-made link may be listed under your shared links; revoke it there.',
	uploadFailed: 'Part of the share could not be uploaded.',
	copied: 'Link copied',
	copyFailed: 'Could not copy',
	copyByHand: 'Select the link and copy it by hand.',
	share: 'Share',
	signInTitle: 'Sign in to share',
	signInDetail: 'A link has to belong to an account, so that you can take it down again.',
	liveTitle: 'Anyone with this link can see it',
	liveDetail: (noun: string, signals: string) =>
		`It shows when the ${noun} happened, its totals and the model of the car, with ${signals} second by second. Not the vehicle identification number, the odometer, or the rest of your export. Revoke it any time from your account; it stops working within a few minutes.`,
	copyLink: 'Copy the link',
	shareThis: (noun: string) => `Share this ${noun}`,
	unguessable: 'A copy of these seconds is published at a link nobody can guess.',
	titleLabel: 'Title, if you like',
	titlePlaceholder: 'The long way home',
	publishing: 'Publishing…',
	make: 'Make a link'
};

export const notes = {
	saveFailed: 'That note could not be saved in this browser.',
	saveFailedDetail: 'It is still here, but will be gone when you leave the page.',
	title: 'Where did this one go?',
	description: 'The export has no location data at all. Fill this in and it becomes a logbook.',
	saving: 'Saving',
	from: 'From',
	fromPlaceholder: 'Where it started',
	to: 'To',
	toPlaceholder: 'Where it ended',
	purpose: 'Purpose',
	usually: (purpose: string) => `Trips like this one are usually ${purpose.toLowerCase()}.`,
	notes: 'Notes',
	notesPlaceholder: 'Anything worth remembering about this drive',
	/** Why a place is suggested, keyed by the English the suggester uses. */
	reasons: {
		'where the last trip ended': 'where the last trip ended',
		'where you usually set off at this hour': 'where you usually set off at this hour',
		'somewhere you have set off from': 'somewhere you have set off from',
		'the way back': 'the way back',
		'same start, same distance': 'same start, same distance',
		'a trip you make at this hour': 'a trip you make at this hour',
		'about the same distance': 'about the same distance',
		'where you usually go at this hour': 'where you usually go at this hour',
		'a similar trip': 'a similar trip'
	} as Record<string, string>
};

export const sharedPage = {
	tripHeading: (km: string) => `A ${km} km drive`,
	chargeHeading: (kwh: string) => `A ${kwh} kWh charge`,
	monthHeading: 'A month of driving',
	unreadable: 'The samples could not be read.',
	from: 'Shared from LogbooX',
	distance: 'Distance',
	duration: 'Duration',
	topSpeed: 'Top speed',
	energyUsed: 'Energy used',
	regen: (share: string) => `${share} came back through regeneration`,
	delivered: 'Energy delivered',
	peakPower: 'Peak power',
	rapidDc: 'Rapid DC charging',
	onboardAc: 'Through the onboard AC charger',
	chargeAdded: 'Charge added',
	secondBySecond: 'Second by second',
	secondBySecondHint:
		'One sample a second, as the car recorded it. Hovering any panel reads out that instant in all of them.',
	reading: 'Reading the samples…',
	wholeMonth: 'A whole month',
	wholeMonthHint:
		'This link carries an entire export. Opening it reads the whole thing into your browser, which takes a moment and a few hundred megabytes of memory.',
	readingExport: 'Reading…',
	openDashboard: 'Open the dashboard',
	yoursToo: 'Your car records this too',
	yoursTooHint:
		'Under the EU Data Act you can ask XPeng for the data your own vehicle keeps. LogbooX reads it in your browser — there is nothing to upload, and nothing to sign up for.',
	readOwn: 'Read your own export'
};
