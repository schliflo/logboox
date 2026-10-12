export const landing = {
	howTo: 'How to get your data',
	leaderboard: 'Leaderboard',
	promise: 'Nothing leaves this browser unless you ask',
	headline: 'Your car has been keeping',
	headlineAccent: 'a very detailed diary.',
	lede: 'Drop in the export XPeng sends under the EU Data Act. You get your trips, charging, battery and a ready-to-file logbook.',
	demo: 'Try it with a demo month',
	noExport: 'No export yet? Requests take about a week.',
	welcome: 'Welcome back',
	daysRecorded: (count: number) => (count === 1 ? 'day recorded' : 'days recorded'),
	demoCar: 'The demonstration car, ',
	open: 'Open my dashboard',
	joinOn: 'Drop newer files in and they join on by themselves.',
	gettingExport: 'Getting your export',
	requestAt: 'Request it at',
	steps: [
		'Download the ZIP when the e-mail arrives. It covers the last 30 days.',
		'Drop it here. Ask again every month to build a longer record.'
	],
	imported: (count: number) => `Imported files (${count})`,
	teasers: {
		eyebrow: "What's inside the file",
		title: 'Thirty days, one sample a second.',
		lede: 'Everything below is the demo month. Yours is already sitting in your export.',
		openDemo: 'Open the demo',
		wrapped: {
			title: 'Your month, told back to you',
			body: 'Reading the files ends in a full-screen run of findings, one per screen: the things you would not have thought to ask for.'
		},
		grip: {
			title: 'How much grip you used',
			body: 'Every second of driving placed by the forces on the car. Careful driving fills a narrow cross; the outer ring is where grip runs out.'
		},
		trip: {
			title: 'Every trip, second by second',
			body: 'Speed, pedal, steering and braking at one sample a second — enough to replay individual manoeuvres, not just journeys.'
		},
		charging: {
			title: 'What charging really costs',
			body: 'Sessions found automatically, energy integrated from pack voltage and current, and the range your car actually believes in.',
			peak: (power: string) => `peak ${power}`
		},
		logbook: {
			title: 'A logbook ready to file',
			body: 'The export has no locations, so you add where each trip went and why, one keypress at a time. Then download it as a PDF, a spreadsheet or a CSV.',
			places: ['Office → Home', 'Home → Client visit', 'Home → The lake']
		},
		routine: {
			title: 'The routine you never told anyone',
			body: 'Door openings alone redraw your week: when you leave, when you return, and the days you never went out.'
		},
		boards: {
			title: 'A board for every bragging right',
			body: 'Fastest charge, longest drive, hardest launch and more. Sign in to claim a place each month; nothing is published until you say so.',
			cta: 'See the boards'
		}
	},
	privacyTitle: 'Nothing leaves this tab unless you ask',
	privacyOne:
		"The files are read by a worker inside this page — no upload, no analytics, nothing that travels. What the app keeps, it keeps here: a copy goes into this browser's own storage so an export can be reopened without dropping the files in again, and one click removes it. Your vehicle identification number appears on every row of the export; here it stays masked unless you ask to see it.",
	privacyTwo:
		'Signing in is the one exception, and it is optional. An account can hold a copy of an export so it outlives this browser, and can publish a single trip if you choose to share one. Nothing is copied to it unless you ask for that, or switch automatic copying on. Deleting the account takes every byte with it.',
	openSource: 'Open source under the',
	licence: 'MIT licence',
	notAffiliated: '. Not affiliated with XPeng.'
};
