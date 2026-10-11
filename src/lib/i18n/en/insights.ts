export const insights = {
	privacy: 'Privacy',
	knows: 'What this file knows about you',
	knowsHint: 'Not a single map coordinate, and it still gives away your routine.',
	readAccount: 'Read the full account',
	gripEyebrow: 'Driving style · how much grip you used',
	gentle: 'A narrow cross: you rarely brake and steer hard at the same time',
	combined: 'You often brake or accelerate while cornering',
	combinedShare: (share: string, g: string) =>
		`${share} of your driving combined more than ${g} g of cornering with braking or acceleration.`,
	hardestStop: 'Hardest stop',
	hardestLaunch: 'Hardest launch',
	hardestCorner: 'Hardest corner',
	drivingInFull: 'Driving style in full',
	speeds: 'Speeds you drive',
	topSpeed: (speed: string, above: string) => `Top speed ${speed} km/h, above 100 for ${above}`,
	ofMoving: (time: string) => `Of ${time} spent moving.`,
	speedMoving: 'Speed while moving',
	doorsTyres: 'Doors & tyres',
	doorsBusiest: (hour: string) => `Doors open most around ${hour}`,
	doorsNever: (from: string, to: string) => `, and never between ${from} and ${to}`,
	doorsFallback: 'Door and tyre readings, day by day',
	tyresBetween: (min: string, max: string) =>
		`Tyres between ${min} and ${max} kPa over the period.`,
	seeWeek: 'See the week as the doors saw it',
	asides: 'Things you would not have asked',
	goFurther: 'Go further',
	explorer: 'Signal explorer',
	plotAny: (count: string) => `Plot any of the ${count} raw signals`,
	openExplorer: 'Open the explorer'
};

export const privacyPage = {
	knows: 'What this file knows about you',
	noCoordinate: 'None of the findings below required a single map coordinate.',
	identifier: 'Your identifier',
	identifierHint: 'The vehicle identification number appears on every row of every file.',
	hide: 'Hide it',
	show: 'Show it',
	model: (model: string) => `Model ${model}`,
	vinDetail: (times: string, size: string) =>
		`Repeated ${times} times across your export, it accounts for roughly ${size} of the file on its own. It identifies the car, and through a registration record, its owner. If you share a screenshot of your data, this is the field to remove — which is why it is masked here by default.`,
	curiosities: 'Curiosities in the file itself',
	curiositiesHint: 'What the export reveals about how it was put together.',
	unsorted: 'Files out of order',
	unsortedDetail:
		'One block of an earlier day was written after a later one. The rows are sorted here before anything is measured; read in file order, a day would appear twice.',
	timelines: 'Timelines',
	merged: 'Merged',
	mergedDetail:
		'The three files did not share the same timestamps, so they were joined on time rather than assumed to line up row for row.',
	handling: 'How this app handles it',
	handlingOne:
		"Your files were read by a worker inside this browser tab. There is no server to receive them: the app is a set of static files, and after they load, nothing is sent anywhere. You can confirm it — open your browser's network panel and reload with the data loaded, or disconnect from the network entirely and keep using the page.",
	keptMany: (samples: string) =>
		`Each of the exports behind these ${samples} samples is kept in this browser's own storage, so they can be opened again without the files.`,
	keptOne: (samples: string) =>
		`A copy of the ${samples} samples in front of you is kept in this browser's own storage, so the export can be opened again without the files.`,
	staysHere:
		"It stays on this device — there is nowhere else for it to go. The start page lists everything kept and removes any of it in a click, and your browser's own site-data controls clear the lot.",
	windowMany: (sources: number, days: number) =>
		`These ${sources} exports cover ${days} days between them. Each one XPeng sends covers a rolling thirty days, so keeping them is the only way to hold a record longer than that.`,
	windowOne: (days: number) =>
		`The export covers a rolling ${days} days. Request the next one before this window ages out, then open them together: kept side by side they become one continuous record, which is more than you were ever given at once.`
};
