export const dataPage = {
	record: 'Your record',
	recordHint: 'Everything you add joins one timeline. Overlaps and duplicates are handled for you.',
	addNewer: 'Add newer data',
	recorded: 'Recorded',
	days: (count: string) => `${count} days`,
	trips: 'Trips',
	distance: 'Distance',
	monthsCovered: (list: string) => `Months covered: ${list}`,
	lapsed: (date: string) =>
		`XPeng keeps only thirty days, so what came after ${date} is no longer available. Request a new export to start the next stretch.`,
	requestBefore: (date: string) =>
		`XPeng keeps only thirty days. Request the next export before ${date} and the record stays unbroken.`,
	requestAtXpeng: 'Request at XPeng',
	imported: (count: number) => `Imported files (${count})`,
	preferences: 'Preferences',
	price: 'Electricity price',
	priceHint: 'Used for every cost on the dashboard.',
	perKwh: 'per kWh',
	timeZone: 'Time zone',
	timeZoneHint:
		"Days and hours are shown in your own zone. The export's date column is cut at midnight in Beijing, so it is ignored.",
	language: 'Language',
	languageHint: 'For the app itself. Downloaded files stay in English.',
	showVin: 'Show the full VIN',
	showVinHint: 'Hidden by default, so screenshots are safe to share.',
	account: 'Account',
	accountHint: 'Optional. Everything above works without one.',
	accountDoes: 'Keeps copies, sends reminders, shares trips and serves your data over an API.',
	links: [
		{
			title: 'Copies and reminders',
			body: 'What the account holds, automatic copying, and when to remind you.'
		},
		{ title: 'Your leaderboard places', body: 'Put your name to a place, or take it back down.' },
		{
			title: 'Shared links and API tokens',
			body: 'What is public at its own link, and the keys your scripts use.'
		}
	],
	signInPitch:
		"Sign in with a link by e-mail to keep a copy that outlives this browser, get a reminder before XPeng's thirty days run out, and put a place on the leaderboard. Nothing is copied unless you ask."
};
