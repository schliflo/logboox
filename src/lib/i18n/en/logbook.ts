const s = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many);

export const logbookPage = {
	notSaid: 'Not said',
	emptyTitle: 'Nothing written down yet',
	emptyHint:
		'There is no location data anywhere in an XPeng export — not one coordinate. Write where a trip started and ended and this page fills in: the routes you actually drive, when you usually leave, what each purpose costs, and whether the book accounts for every kilometre.',
	labelTrip: 'Label a trip',
	title: 'Logbook (Fahrtenbuch)',
	summary: (labelled: string, trips: string, count: number, km: string) =>
		`${labelled} of ${trips} ${s(count, 'trip')} written down, over ${km} km.`,
	writtenDown: 'Written down',
	ofTrips: (labelled: string, trips: string, count: number) =>
		`${labelled} of ${trips} ${s(count, 'trip')}`,
	routes: 'Routes',
	mostDriven: (route: string) => `Most driven: ${route}`,
	business: 'Business',
	ofDistance: 'of the distance recorded',
	unaccounted: 'Unaccounted for',
	continuous: 'The book is continuous',
	gaps: (count: string, n: number) => `${count} ${s(n, 'gap')} between trips`,
	byPurpose: 'By purpose',
	byPurposeHint: (price: string) =>
		`Distance, time and what the electricity cost at ${price} per kWh.`,
	purpose: 'Purpose',
	trips: 'Trips',
	distance: 'Distance',
	cost: 'Cost',
	whenArrive: 'When you arrive',
	whenArriveHint: 'Arrivals by weekday and hour, from the trips that end there.',
	arrivalsAt: (place: string) => `Arrivals at ${place}`,
	arrivalsUnit: 'arrivals',
	arrivals: (count: string, n: number) => `${count} ${s(n, 'arrival')}`,
	departures: (count: string, n: number) => `${count} ${s(n, 'departure')}`,
	commute: 'The commute',
	commuteHint: 'The one journey you make more than any other, in both directions.',
	out: 'Out',
	outDetail: (time: string, place: string) => `${time} to ${place}`,
	back: 'Back',
	backDetail: (time: string) => `${time} home`,
	wanders: 'Departure wanders by',
	wandersDetail: 'between the earliest and the latest',
	routesHint:
		'The usual drive rather than the average one, so a single crawl through roadworks does not stand for the journey.',
	route: 'Route',
	usually: 'Usually',
	leaves: 'Leaves',
	best: 'Best',
	routeDetail: (km: string, weekday: string, weekend: string, last: string) =>
		`${km} km in all · ${weekday} on weekdays, ${weekend} at weekends · last driven ${last}`,
	trip: (index: number) => `Trip ${index}`,
	completeness: 'Completeness',
	completenessHint: 'A logbook kept for tax has to account for every kilometre the car moved.',
	unwritten: (count: string, n: number) =>
		n === 1
			? `${count} trip has nothing written against it.`
			: `${count} trips have nothing written against them.`,
	labelNext: 'Label the next one',
	gapExplain: (km: string, n: number) =>
		`${km} km ${n === 1 ? 'sits' : 'sit'} between the end of one trip and the start of the next. The car moved without the export recording it — most often because it was driven while the logger was asleep, or across the seam between two exports.`
};

export const labelPage = {
	saveFailed: 'That trip could not be saved in this browser.',
	stop: 'Stop labelling',
	progress: 'Trips labelled',
	sharedNote: 'A shared export has no logbook of yours to fill in.',
	opening: 'Opening the logbook…',
	allLabelled: 'Every trip in view already has a place',
	backToTrips: 'Back to the trips',
	labelled: (count: number) => (count === 1 ? 'One trip labelled' : `${count} trips labelled`),
	skipped: (count: number) => `${count} skipped for later.`,
	download: 'Your logbook can be downloaded from the trip list, ready for the tax office.',
	toLogbook: 'Go to the logbook',
	goSkipped: 'Go through the skipped ones',
	details: 'details',
	from: 'From',
	fromPlaceholder: 'Where it started',
	to: 'To',
	toPlaceholder: 'Where it ended',
	otherPlaces: 'Other places',
	pickPurpose: 'Pick a purpose to save and go to the next trip',
	suggested: 'Suggested',
	back: 'Back',
	skip: 'Skip',
	saveNoPurpose: 'Save, no purpose'
};

export const tripsPage = {
	all: 'All',
	noPlaceYet: 'No place yet',
	saveFailed: 'Those notes could not be saved in this browser.',
	filled: (count: number) => `Filled in ${count} ${count === 1 ? 'trip' : 'trips'}`,
	filledDetail: 'Each one can still be changed on its own.',
	undo: 'Undo',
	undoFailed: 'The fill could not be undone in this browser.',
	started: 'Started',
	distance: 'Distance',
	duration: 'Duration',
	topSpeed: 'Top speed',
	showTrips: 'Show trips',
	trips: 'Trips',
	count: (count: number) => `${count} ${count === 1 ? 'trip' : 'trips'}`,
	labelOneByOne: 'Label one by one',
	allTrips: 'All trips',
	nextPrevious: 'next / previous',
	previousTrip: 'Previous trip in the list',
	nextTrip: 'Next trip in the list',
	nextUnlabelled: 'Next unlabelled trip',
	moving: (time: string) => `${time} actually moving`,
	average: (speed: string) => `Average ${speed} km/h while moving`,
	energyUsed: 'Energy used',
	regen: (share: string) => `${share} came back through regeneration`,
	secondBySecond: 'Second by second',
	secondBySecondHint: 'Drag across any panel to zoom; the cursor is shared between them.',
	forces: 'Forces',
	hardestAcceleration: 'Hardest acceleration',
	hardestBraking: 'Hardest braking',
	hardestCornering: 'Hardest cornering',
	longest: 'Longest',
	median: 'Median trip',
	every: 'Every trip',
	everyHint:
		'Segmented from gear and odometer movement. Select one to see it in detail, and to say where it went.',
	outOfRange: (count: number, range: string) =>
		count === 1
			? `One more trip without a place is outside ${range}.`
			: `${count} more trips without a place are outside ${range}.`,
	showWhole: 'Show the whole record',
	habitsMatch: (count: number) =>
		count === 1 ? 'One trip matches your habits.' : `${count} trips match your habits.`,
	habitsHint: 'Same start, same distance, same time of day as trips you already filled in.',
	fill: (count: number) => (count === 1 ? 'Fill it in' : `Fill all ${count} in`),
	sortBy: 'Sort by',
	newest: 'Newest first',
	oldest: 'Oldest first',
	longestFirst: 'Longest first',
	efficient: 'Most efficient first',
	route: 'Route',
	purpose: 'Purpose',
	charge: 'Charge'
};
