/**
 * The guides: long-form pages about the export itself, for readers who arrive
 * with a question rather than a file. Links inside the text are written as
 * `[label](href)` and turned into anchors by `RichText`.
 */

export interface GuideSection {
	heading: string;
	body: string[];
	/** A list after the paragraphs, numbered when `ordered` is set. */
	list?: string[];
	ordered?: boolean;
}

export interface Guide {
	/** The URL segment under `/guides`; the same in every language. */
	slug: string;
	/** Short name, for links and the browser tab. */
	title: string;
	/** Meta description: what the page answers, in one or two sentences. */
	description: string;
	headline: string;
	lede: string;
	/** The answer in brief, at the top of the page. */
	summary: string[];
	sections: GuideSection[];
	faq: Array<{ q: string; a: string }>;
}

export const guidesPage = {
	title: 'Guides',
	description:
		'Guides to the XPeng EU Data Act export: how to request your vehicle data, what the files contain, your rights under the Data Act, and keeping a driving logbook.',
	eyebrow: 'Guides',
	headline: 'Your car data, explained.',
	lede: 'What XPeng hands out under the EU Data Act, how to ask for it, and what can be read from it.',
	read: 'Read the guide',
	updated: 'Updated',
	inBrief: 'In brief',
	contents: 'On this page',
	questions: 'Questions',
	more: 'More guides',
	home: 'Home',
	ctaTitle: 'Have your export already?',
	ctaBody:
		'Drop it on the start page and it becomes trips, charging, battery and a logbook — read in your browser, never uploaded.'
};

export const guides: Guide[] = [
	{
		slug: 'request-xpeng-data',
		title: 'How to request your XPeng data',
		description:
			'Step by step: how to download your vehicle data from XPeng under the EU Data Act — log in, pick the data and the period, download the ZIP — and how to build a record longer than thirty days.',
		headline: 'How to request your XPeng vehicle data under the EU Data Act',
		lede: 'Every XPeng sold in the EU records what it does, once a second. The EU Data Act gives you the right to a copy. Here is how to get it.',
		summary: [
			'Log in at [xpeng.com/data-act](https://www.xpeng.com/data-act) with your XPeng account, select all data categories and the last 30 days, and send the request. The ZIP of CSV files is usually ready to download in the same page within minutes, and the link stays valid for seven days. An export never reaches further back than thirty days, so request one at least every month if you want a longer record — [LogbooX](/) joins consecutive exports into one timeline.'
		],
		sections: [
			{
				heading: 'Step by step',
				body: [
					'The whole thing takes a few minutes, in the browser, with the XPeng account your car is linked to.'
				],
				list: [
					'Open [xpeng.com/data-act](https://www.xpeng.com/data-act) and choose “Get my data”. Log in with your XPeng account — by e-mail, phone number or Google — and complete the slider check.',
					'Your data centre lists the car by model with its VIN partly masked. Under “Download my vehicle data”, choose “Go to download”.',
					'Select every data category — “Select all” does it. There are six: motion and driving dynamics, driver inputs, electric drivetrain, battery and charging, vehicle access and security, and vehicle state and telemetry. LogbooX needs all of them; a partial selection gives a partial export.',
					'Choose the period: the last 7, 14 or 30 days. Take 30 days. The newest data is from yesterday.',
					'Send the request. It appears under “Recent activity” as “Processing”, and usually turns into a “Download” button within minutes.',
					'Download the ZIP, named like `DA2026…zip` and around 10 to 20 MB. Do not unpack or rename the files inside — the names tell any reader which stream and which part each file is.',
					'Drop the ZIP on [the LogbooX start page](/). It is read in your browser; nothing is uploaded.'
				],
				ordered: true
			},
			{
				heading: 'What arrives',
				body: [
					'Up to three CSV streams — driving status, driving operation, and power & energy — sampled once a second while the car is awake. A full month comes to roughly 340 MB and 3.6 million rows once unpacked. Each stream is capped at a million rows per file, so longer months spill into files ending in `_part1`, `_part2` and so on.',
					'There is no GPS position in it, and no trip list or charging list either: just raw signals. Everything else has to be worked out from them. The [export format guide](/guides/xpeng-export-format) lists every file and column.'
				]
			},
			{
				heading: 'Only thirty days: request every month',
				body: [
					'Each request covers at most the last thirty days, up to yesterday. A month that has fallen out of that window cannot be requested later, so the only way to a longer history is to ask again before it closes. There is no limit on how often you can ask, and each download link expires seven days after the request, so download it promptly.',
					'A reminder in your calendar on the same day each month works. With a free LogbooX account, you get an e-mail before the window on your last export runs out. Exports from the same car open as one continuous record; where two overlap, the newer one wins.'
				]
			},
			{
				heading: 'If the request takes longer',
				body: [
					'The Data Act expects data to be made available without undue delay, and the download is normally ready within minutes. If a request stays on “Processing” for days, write to XPeng’s data support team at eu.data.support@xpeng.com and quote the date and time of your request. Where the data concerns you as a person, the GDPR gives you a right of access too, with a one-month deadline that can be extended only with a reason. The [EU Data Act guide](/guides/eu-data-act-car-data) sets out what you are entitled to.'
				]
			}
		],
		faq: [
			{
				q: 'How long does an XPeng data request take?',
				a: 'Usually a few minutes. The download appears in your XPeng data centre, not by e-mail, and stays available for seven days.'
			},
			{
				q: 'Does the XPeng data export cost anything?',
				a: 'No. Under the EU Data Act, data generated by your use of a connected product has to be made available to you free of charge.'
			},
			{
				q: 'Can I request data older than thirty days?',
				a: 'No. Each request covers at most the last thirty days. Request at least every month to keep a continuous record.'
			},
			{
				q: 'Which program opens the XPeng export?',
				a: 'The files are plain CSV, so any spreadsheet program opens them, but a month is millions of rows. LogbooX reads the whole ZIP in the browser and turns it into trips, charging sessions, battery figures and a logbook.'
			}
		]
	},
	{
		slug: 'xpeng-export-format',
		title: 'XPeng data export format',
		description:
			'What is inside the XPeng EU Data Act export: the three CSV streams, file naming, sampling rate, size, and every signal — speed, acceleration, pedals, motors, battery, doors, windows and tyre pressures.',
		headline: 'The XPeng data export, file by file and column by column',
		lede: 'A reference to the CSV files XPeng sends under the EU Data Act: how they are named, how they are split, and what each column measures.',
		summary: [
			'The export is up to three CSV streams — `driving_status`, `driving_operation` and `driving_power_energy` — with one row per second while the car is awake, over the last thirty days. Every row carries the VIN, the model, a timestamp and a date. There is no location data. A month is roughly 340 MB and 3.6 million rows.'
		],
		sections: [
			{
				heading: 'File names',
				body: [
					'Every file is named after the request ID, which starts with `DA`, and the stream it holds:',
					'`DA<request-id>_dwd_opp_gdpr_veh_driving_status_di.csv`, `…_driving_operation_di.csv` and `…_driving_power_energy_di.csv`.',
					'Each file holds at most 1,000,000 data rows. A stream that runs longer continues in `_part1`, `_part2` and so on. The file without a suffix is the earliest, and parts must be ordered by number rather than alphabetically, so that `_part10` comes after `_part9`.'
				]
			},
			{
				heading: 'Columns in every stream',
				body: ['Four columns appear in all three streams and tie them together:'],
				list: [
					'`vin` — the vehicle identification number, on every row.',
					'`vmodel` — the model designation.',
					'`timer` — the moment of the sample.',
					'`ds` — the date partition the row was exported from.'
				]
			},
			{
				heading: 'Driving operation',
				body: ['What the car and driver are doing:'],
				list: [
					'`esp_vehspd` — speed, km/h.',
					'`esp_vehlongaccel`, `esp_vehlateralaccel` — longitudinal and lateral acceleration, in g.',
					'`cdcu_totalodometer` — odometer, km.',
					'`eps_steeringangle`, `eps_steeringanglespd` — steering angle in degrees and steering rate in degrees per second.',
					'`ldcu_accpedalsig` — accelerator pedal position, %.',
					'`ldcu_brkpedalst` — brake pedal pressed or not.',
					'`ldcu_currentgearlev` — gear: D, N, R or P.'
				]
			},
			{
				heading: 'Power & energy',
				body: ['The drivetrain and the battery:'],
				list: [
					'`ipuf_actrotspd`, `ipur_actrotspd` — front and rear motor speed, rpm.',
					'`ipuf_acttorq`, `ipur_acttorq` — front and rear motor torque, Nm.',
					'`ipuf_rotoracttemp`, `ipur_rotoracttemp` — front and rear rotor temperature, °C.',
					'`bms_battvolt`, `bms_battcurr` — pack voltage (V) and current (A). Multiplied, they give the power going in or out of the battery.',
					'`ldcu_chrgpwr` — charging power, kW.',
					'`ldcu_bms_soc_disp` — displayed state of charge, %.',
					'`ldcu_dstbatdisp_dynamic` — estimated range, km.',
					'`bms_batttempmax_gb`, `bms_batttempmin_gb` — highest and lowest pack temperature, °C, with the numbers of the sensors that read them.'
				]
			},
			{
				heading: 'Driving status',
				body: ['The body of the car:'],
				list: [
					'Four door signals: driver, passenger, rear left and rear right — open or closed.',
					'Four window positions, % open.',
					'The tailgate opener.',
					'Tyre pressure per wheel: front left, front right, rear left, rear right.'
				]
			},
			{
				heading: 'Pitfalls when reading the files yourself',
				body: [
					'Some columns use fixed codes to mean "signal not available" rather than a measurement — a speed of 255 km/h or a range of 1,638 km are placeholders, not readings. Plotted as they are, they make charts unreadable, so filter them out first.',
					'The car samples only while it is awake. Gaps between rows are the car asleep, not missing data, and charging sessions are often interrupted by short naps that have to be joined back together.',
					'Nothing in the export is a trip or a charging session: both have to be detected from the signals. [LogbooX](/features) does this in the browser, and its signal explorer plots any column — including ones it has never seen before.'
				]
			}
		],
		faq: [
			{
				q: 'Does the XPeng data export contain GPS locations?',
				a: 'No. There is no location data in it at all. Door, charging and driving times still reveal a lot about a daily routine.'
			},
			{
				q: 'How big is the XPeng data export?',
				a: 'Roughly 340 MB and 3.6 million rows for a full month, at one sample per second while the car is awake.'
			},
			{
				q: 'What does _part1 mean in the file name?',
				a: 'Each stream is split every million rows. The file without a suffix is the first part, then _part1, _part2 and so on.'
			}
		]
	},
	{
		slug: 'eu-data-act-car-data',
		title: 'The EU Data Act and your car',
		description:
			'What the EU Data Act means for car owners: your right to the data your connected car generates, free of charge and machine-readable, and the right to share it with a service of your choice.',
		headline: 'The EU Data Act and your car: what you can ask for',
		lede: 'Since September 2025, the people who use a connected car in the EU have a right to the data it generates. A plain-language account of what that means.',
		summary: [
			'The EU Data Act — Regulation (EU) 2023/2854 — has applied since 12 September 2025. It gives the user of a connected product, such as a car, the right to access the data generated by using it, free of charge, in a structured, commonly used and machine-readable format, and to have it shared with a third party of their choice. XPeng meets it with a self-service data centre at [xpeng.com/data-act](https://www.xpeng.com/data-act).'
		],
		sections: [
			{
				heading: 'What the Data Act is',
				body: [
					"The Data Act is an EU regulation about who may use the data that connected devices produce. Before it, the data a car generated was in practice the manufacturer's: it travelled to their servers, and drivers saw only what an app chose to show. The Data Act makes the user of the product a party with rights of their own.",
					'Being a regulation, it applies directly in every member state, without national laws needed to bring it in.'
				]
			},
			{
				heading: 'Your rights as a driver',
				body: ['For data generated by using a connected car, the user can ask for:'],
				list: [
					'Access to the data, easily and securely, without undue delay.',
					'The data free of charge to you.',
					'A comprehensive, structured, commonly used and machine-readable format — the CSV files XPeng sends are an example.',
					'Sharing with a third party of your choice, such as an independent repair shop or an app.',
					'For products placed on the market from 12 September 2026, design that makes the data accessible by default.'
				]
			},
			{
				heading: 'The Data Act and the GDPR',
				body: [
					'Car data is often personal data too: the export carries your VIN on every row, and the times you drive and charge describe your routine. Where it is personal, the GDPR still applies alongside the Data Act, including your right of access and your right to data portability. The two do not replace each other.'
				]
			},
			{
				heading: 'What XPeng provides',
				body: [
					'Owners log in at [xpeng.com/data-act](https://www.xpeng.com/data-act) with their XPeng account and reach a data centre for each car. There they choose data categories and a period of up to thirty days, and download a ZIP of CSV files sampled once a second, usually within minutes. The same page has a section for authorising third parties to receive the data, which is the Data Act’s right to share. The [request guide](/guides/request-xpeng-data) walks through it, and the [export format guide](/guides/xpeng-export-format) lists what is in the files.'
				]
			},
			{
				heading: 'Using the data',
				body: [
					'Raw signals are a right on paper until something reads them. [LogbooX](/) is a free, open-source reader for the XPeng export that runs in the browser: it finds trips and charging sessions, measures battery behaviour and driving style, and drafts a logbook — without sending the data anywhere. It is not affiliated with XPeng.'
				]
			}
		],
		faq: [
			{
				q: 'When did the EU Data Act start to apply?',
				a: 'On 12 September 2025. Some obligations, such as designing products so their data is accessible by default, apply to products placed on the market from 12 September 2026.'
			},
			{
				q: 'Can a car maker charge me for my own data?',
				a: 'No. Data made available to the user of a connected product under the Data Act is free of charge to them.'
			},
			{
				q: 'Does the Data Act apply outside the EU?',
				a: 'It covers connected products placed on the EU market and their users in the EU, wherever the manufacturer is based.'
			}
		]
	},
	{
		slug: 'xpeng-driving-logbook',
		title: 'XPeng driving logbook',
		description:
			'How to draft a driving logbook from your XPeng data export: trips with times and distances detected automatically, places and purposes added by you, downloaded as PDF, spreadsheet or CSV.',
		headline: 'A driving logbook from your XPeng, drafted from its own data',
		lede: 'The export records every trip to the second. What it does not know is where you went and why. Add those, and you have the draft of a logbook.',
		summary: [
			'[LogbooX](/) detects every trip in your XPeng export — start, end, distance and odometer readings — and lets you add an origin, a destination, a purpose and a note to each. The logbook downloads as a PDF, a spreadsheet or a CSV for any range. It is a draft built from raw signals, not a certified logbook.'
		],
		sections: [
			{
				heading: 'What the export provides',
				body: [
					'Each trip is found from speed, gear and odometer signals sampled once a second, so its start and end time, its distance and the odometer at both ends come straight from the car. That is the part of a logbook that is tedious to keep by hand, and it is the part the car got right.'
				]
			},
			{
				heading: 'What you add',
				body: [
					'The export contains no location data, so places and purposes come from you. LogbooX keeps the typing down:'
				],
				list: [
					'Where the last trip ended is offered as where the next one starts.',
					'Places you have used before are suggested from trips that match: the same distance, the same hour, or the way back.',
					'Trips still missing a place are listed on the home screen, so the gaps are easy to close.',
					'The purpose — business, commute or private — is a single choice, with room for a comment.'
				]
			},
			{
				heading: 'Downloading it',
				body: [
					'Narrow the dashboard to the range you need — a month, a quarter, a year, or dates you pick — and download the logbook as a PDF to hand over, a spreadsheet to work on, or a CSV for other software. Months join into one record as long as you request the export every month: see [the request guide](/guides/request-xpeng-data).'
				]
			},
			{
				heading: 'Is it valid for tax purposes?',
				body: [
					'Treat it as a draft. Tax authorities usually set rules for a logbook that a file derived afterwards from raw signals does not meet by itself. In Germany, for example, the Finanzamt expects a Fahrtenbuch to be kept promptly and in a form that cannot be changed later without trace — a spreadsheet is not that. Use the draft to fill in or check the logbook you keep, and ask a tax adviser what your authority accepts.'
				]
			}
		],
		faq: [
			{
				q: 'Can I generate a driving logbook from my XPeng data?',
				a: 'Yes, as a draft. Trips with times, distances and odometer readings are detected automatically; you add places and purposes.'
			},
			{
				q: 'Why does the logbook ask where I drove?',
				a: 'Because the XPeng export contains no location data. Origins and destinations have to come from you, with suggestions from trips you have already labelled.'
			},
			{
				q: 'Is the LogbooX logbook accepted by the tax office?',
				a: 'Not on its own. It is derived from raw signals and can be edited, which most tax rules for logbooks do not allow. Use it as a draft and check with a tax adviser.'
			}
		]
	}
];
