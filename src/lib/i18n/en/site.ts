/** The public pages around the app: features and FAQ, and the links between them. */

export const site = {
	features: 'Features',
	faq: 'FAQ',
	guides: 'Guides',
	readExport: 'Read your export'
};

export const featuresPage = {
	title: 'Features',
	description:
		'Everything LogbooX makes of an XPeng EU Data Act export: trips, charging, battery, driving style, a logbook, and an optional account.',
	eyebrow: 'Features',
	headline: 'Everything the export can tell you.',
	lede: 'The file XPeng sends is raw signals and nothing else: no trips, no charging sessions, no summary. All of it is worked out in your browser.',
	groups: [
		{
			title: 'Read the month',
			items: [
				{
					title: 'Every trip, second by second',
					body: 'Speed, power and state of charge for each journey, next to the list so the next trip is a keypress away. Hovering any chart reads out that instant in all of them.'
				},
				{
					title: 'Charging sessions',
					body: "Found from the plug's power signal and joined across the naps the car takes mid-charge. Energy is integrated from pack voltage and current, so regeneration is never mistaken for charging."
				},
				{
					title: 'Battery behaviour',
					body: 'Standby drain while parked, the range a full charge really gives, and your charge limit and charging schedule — reported only when the data shows them.'
				},
				{
					title: 'Driving style',
					body: 'Every second of driving placed by the forces on the car in a g-g diagram, beside speed and pedal histograms and your hardest braking.'
				},
				{
					title: 'Doors and tyres',
					body: 'Door openings by weekday and hour, which redraw your routine without a single location. Tyre pressures per wheel, which follow the weather.'
				},
				{
					title: 'What the file knows about you',
					body: 'A plain account of what the export gives away about your daily life — none of which needs a map coordinate.'
				},
				{
					title: 'Signal explorer',
					body: 'Any column in the export, plotted. Signals the app has never heard of are parsed and plottable too.'
				},
				{
					title: 'Any time range',
					body: 'Narrow everything to the last week, a month, a year or dates you pick. Trip and charging lists download as CSV, spreadsheet or PDF.'
				}
			]
		},
		{
			title: 'Keep a logbook',
			items: [
				{
					title: 'Where, why, and a note',
					body: 'The export has no location data, so each trip takes an origin, a destination, a purpose and a comment from you.'
				},
				{
					title: 'Type a place once',
					body: 'Where the last trip ended is offered as where this one starts. Beyond that, suggestions come from trips you labelled: same distance, same hour, the way back.'
				},
				{
					title: 'Ready to hand over',
					body: 'The logbook downloads as CSV, spreadsheet or PDF for the range on screen. It is a draft built from raw signals, not a certified logbook.'
				}
			]
		},
		{
			title: 'Keep every month',
			items: [
				{
					title: 'Kept in this browser',
					body: 'Every export you open is stored compressed — 5 to 15 MB for a month that arrived as 340 MB — and reopens in a second or two.'
				},
				{
					title: 'One continuous record',
					body: 'Exports from the same car join into a single timeline. Where two overlap the newer wins, and days no export covers are marked unrecorded.'
				},
				{
					title: 'Backup and restore',
					body: 'One ZIP holds everything kept. Drop it back on the start page, in this browser or any other.'
				},
				{
					title: 'Works offline',
					body: 'After the first visit the app opens without a connection, and installs as an app from the browser menu.'
				}
			]
		},
		{
			title: 'Sign in, if you like',
			items: [
				{
					title: 'Exports that outlive the browser',
					body: 'A copy in your account, restored to any browser you sign in on. Nothing is copied unless you ask, or switch automatic copying on.'
				},
				{
					title: 'A reminder before the window closes',
					body: 'XPeng only hands out the last thirty days. You get an e-mail before a month is lost for good.'
				},
				{
					title: 'An API over your own data',
					body: 'Trips, charging and logbook over HTTP, with tokens you make and revoke. Includes a Home Assistant example.'
				},
				{
					title: 'Share a trip',
					body: 'Publish one trip, one charging session or a whole export at a link. Shares never carry the vehicle identification number.'
				},
				{
					title: 'Leaderboards',
					body: 'Monthly boards for the fastest charge, the longest drive and more. Nothing is published unless you say so; the top three get a badge.'
				}
			]
		}
	],
	ctaTitle: 'See it with your own month',
	ctaBody: 'No export yet? The demo month shows every feature on a generated car.'
};

export const faqPage = {
	title: 'FAQ',
	description:
		'Questions about LogbooX: getting your XPeng data export, privacy, combining months, the logbook and the optional account.',
	eyebrow: 'FAQ',
	headline: 'Questions, answered.',
	lede: 'Something missing?',
	contact: 'Write to',
	groups: [
		{
			title: 'Getting your data',
			items: [
				{
					q: 'How do I get my export?',
					a: [
						'Request it at xpeng.com/data-act. XPeng sends an e-mail with a ZIP, usually within about a week. [The request guide](/guides/request-xpeng-data) goes through it step by step.'
					]
				},
				{
					q: 'Which files does LogbooX need?',
					a: [
						'The CSV files in that ZIP — driving status, driving operation and power & energy. Long months spill into extra parts. Drop the ZIP as downloaded, or all the files at once.'
					]
				},
				{
					q: 'What is in the XPeng data export?',
					a: [
						'Raw signals at one sample a second while the car is awake: speed, acceleration, steering, pedals, motors, battery, charging, doors, windows and tyre pressures. There are no locations. [The export format guide](/guides/xpeng-export-format) lists every file and column.'
					]
				},
				{
					q: 'Which XPeng models does it work with?',
					a: [
						'LogbooX reads the export format rather than a list of models: if your files are named like DA…_dwd_opp_gdpr_veh_driving_status_di.csv, it opens them, and it takes the model name from the file itself.'
					]
				},
				{
					q: 'Why does an export only cover thirty days?',
					a: [
						'XPeng hands out a rolling thirty days per request, and an older month cannot be requested later. Ask again every month and LogbooX joins the exports into one record.'
					]
				},
				{
					q: 'Can I try it without an export?',
					a: [
						'Yes. The demo month is generated in your browser, with commutes, a weekend trip and a rapid-charging stop.'
					]
				}
			]
		},
		{
			title: 'Privacy',
			items: [
				{
					q: 'Is my export uploaded anywhere?',
					a: [
						"No. The files are read by a worker inside the page and kept in this browser's own storage. Without an account there is nowhere to upload them to."
					]
				},
				{
					q: 'Does the export contain my locations?',
					a: [
						'No, there is no location data in it at all. That is why the logbook asks you where a trip went. The door and charging signals still reveal a lot about your routine; the app shows you what.'
					]
				},
				{
					q: 'What about the vehicle identification number?',
					a: [
						'It is on every row of the export. The app keeps it masked unless you ask to see it, and shared links never carry it.'
					]
				},
				{
					q: 'How do I remove my data?',
					a: [
						"Each kept export is removed with one click, and the browser's site-data controls clear everything at once. Deleting an account removes every byte it holds, including shared links."
					]
				}
			]
		},
		{
			title: 'Using it',
			items: [
				{
					q: 'Can I combine several months?',
					a: [
						'Yes. Exports from the same car open as one timeline. Where two overlap the newer one wins, and gaps no export covers are marked unrecorded rather than counted as days parked.'
					]
				},
				{
					q: 'Will my exports still be there next time?',
					a: [
						'They are kept in this browser, which is not a safe place for the only copy: storage can be cleared, and Safari discards it after a week without a visit. Make a backup ZIP, or sign in to keep a copy in an account.'
					]
				},
				{
					q: 'Can I use the logbook for my tax return?',
					a: [
						'Treat it as a draft. It is derived from raw signals and is not a certified logbook, so check it before it goes to anyone who relies on it.'
					]
				},
				{
					q: 'Does it work offline?',
					a: [
						'Yes, after the first visit. Kept exports open without a connection too, and the browser can install the app in a window of its own.'
					]
				},
				{
					q: 'Why is my charge limit or charging schedule missing?',
					a: [
						'They are only reported when the data shows them clearly. A car that always charges to full has no limit to report.'
					]
				}
			]
		},
		{
			title: 'Accounts',
			items: [
				{
					q: 'Do I need an account?',
					a: [
						'No. Everything that reads an export works without one. An account adds a copy that outlives the browser, a reminder before the window closes, an API, share links and the leaderboards.'
					]
				},
				{
					q: 'How does signing in work?',
					a: [
						'By e-mail alone: you get a link that works once, for fifteen minutes. There is no password.'
					]
				},
				{
					q: 'Is a leaderboard place public?',
					a: [
						"Only if you publish it. A place shows a name you choose, the car's model and the figures — never the exact time."
					]
				}
			]
		},
		{
			title: 'About',
			items: [
				{
					q: 'What does it cost?',
					a: ['Nothing. LogbooX is free and open source under the MIT licence.']
				},
				{
					q: 'What is the EU Data Act?',
					a: [
						'An EU regulation, applicable since 12 September 2025, that gives the users of connected products such as cars the right to the data those products generate — free of charge and machine-readable. [The Data Act guide](/guides/eu-data-act-car-data) explains what that means for drivers.'
					]
				},
				{
					q: 'Is this an XPeng app?',
					a: [
						'No. LogbooX is an independent project, not affiliated with or endorsed by XPeng. It reads the export XPeng provides under the EU Data Act.'
					]
				}
			]
		}
	]
};
