import type { Messages } from '../en/index';

const s = (count: number, one: string, many: string) => (count === 1 ? one : many);

export const logbookPage: Messages['logbookPage'] = {
	notSaid: 'Keine Angabe',
	emptyTitle: 'Noch nichts eingetragen',
	emptyHint:
		'In einem XPeng-Export stehen nirgends Standortdaten — keine einzige Koordinate. Trag ein, wo eine Fahrt begann und endete, und diese Seite füllt sich: die Strecken, die du wirklich fährst, wann du meistens losfährst, was jeder Zweck kostet und ob das Buch jeden Kilometer abdeckt.',
	labelTrip: 'Eine Fahrt zuordnen',
	title: 'Fahrtenbuch',
	summary: (labelled, trips, count, km) =>
		`${labelled} von ${trips} ${s(count, 'Fahrt', 'Fahrten')} eingetragen, über ${km}.`,
	writtenDown: 'Eingetragen',
	ofTrips: (labelled, trips, count) => `${labelled} von ${trips} ${s(count, 'Fahrt', 'Fahrten')}`,
	routes: 'Strecken',
	mostDriven: (route) => `Am häufigsten: ${route}`,
	business: 'Geschäftlich',
	ofDistance: 'der aufgezeichneten Strecke',
	unaccounted: 'Nicht erfasst',
	continuous: 'Das Buch ist lückenlos',
	gaps: (count, n) => `${count} ${s(n, 'Lücke', 'Lücken')} zwischen Fahrten`,
	byPurpose: 'Nach Zweck',
	byPurposeHint: (price) => `Strecke, Zeit und Stromkosten bei ${price} pro kWh.`,
	purpose: 'Zweck',
	trips: 'Fahrten',
	distance: 'Strecke',
	cost: 'Kosten',
	whenArrive: 'Wann du ankommst',
	whenArriveHint: 'Ankünfte nach Wochentag und Stunde, aus den Fahrten, die dort enden.',
	arrivalsAt: (place) => `Ankünfte bei ${place}`,
	arrivalsUnit: 'Ankünfte',
	arrivals: (count, n) => `${count} ${s(n, 'Ankunft', 'Ankünfte')}`,
	departures: (count, n) => `${count} ${s(n, 'Abfahrt', 'Abfahrten')}`,
	commute: 'Der Arbeitsweg',
	commuteHint: 'Die eine Strecke, die du öfter fährst als jede andere, in beide Richtungen.',
	out: 'Hin',
	outDetail: (time, place) => `${time} nach ${place}`,
	back: 'Zurück',
	backDetail: (time) => `${time} nach Hause`,
	wanders: 'Abfahrt schwankt um',
	wandersDetail: 'zwischen der frühesten und der spätesten',
	routesHint:
		'Die übliche Fahrt statt der durchschnittlichen, damit ein einzelnes Kriechen durch eine Baustelle nicht für die Strecke steht.',
	route: 'Strecke',
	usually: 'Meistens',
	leaves: 'Abfahrt',
	best: 'Beste',
	routeDetail: (km, weekday, weekend, last) =>
		`${km} insgesamt · ${weekday} unter der Woche, ${weekend} am Wochenende · zuletzt gefahren ${last}`,
	trip: (index) => `Fahrt ${index}`,
	completeness: 'Vollständigkeit',
	completenessHint:
		'Ein Fahrtenbuch für das Finanzamt muss jeden Kilometer erfassen, den das Auto bewegt wurde.',
	unwritten: (count, n) =>
		n === 1
			? `Für ${count} Fahrt ist nichts eingetragen.`
			: `Für ${count} Fahrten ist nichts eingetragen.`,
	labelNext: 'Die nächste zuordnen',
	gapExplain: (km) =>
		`${km} liegen zwischen dem Ende einer Fahrt und dem Beginn der nächsten. Das Auto wurde bewegt, ohne dass der Export es aufgezeichnet hat — meist, weil es gefahren wurde, während der Logger schlief, oder über die Naht zwischen zwei Exporten hinweg.`
};

export const labelPage: Messages['labelPage'] = {
	saveFailed: 'Diese Fahrt konnte in diesem Browser nicht gespeichert werden.',
	stop: 'Zuordnen beenden',
	progress: 'Zugeordnete Fahrten',
	sharedNote: 'Ein geteilter Export hat kein Fahrtenbuch von dir zum Ausfüllen.',
	opening: 'Fahrtenbuch wird geöffnet…',
	allLabelled: 'Jede Fahrt in dieser Ansicht hat schon einen Ort',
	backToTrips: 'Zurück zu den Fahrten',
	labelled: (count) => (count === 1 ? 'Eine Fahrt zugeordnet' : `${count} Fahrten zugeordnet`),
	skipped: (count) => `${count} für später übersprungen.`,
	download:
		'Dein Fahrtenbuch kannst du in der Fahrtenliste herunterladen, fertig für das Finanzamt.',
	toLogbook: 'Zum Fahrtenbuch',
	goSkipped: 'Die übersprungenen durchgehen',
	details: 'Details',
	from: 'Von',
	fromPlaceholder: 'Wo sie begann',
	to: 'Nach',
	toPlaceholder: 'Wo sie endete',
	otherPlaces: 'Andere Orte',
	pickPurpose: 'Wähle einen Zweck, um zu speichern und zur nächsten Fahrt zu gehen',
	suggested: 'Vorschlag',
	back: 'Zurück',
	skip: 'Überspringen',
	saveNoPurpose: 'Ohne Zweck speichern'
};

export const tripsPage: Messages['tripsPage'] = {
	all: 'Alle',
	noPlaceYet: 'Noch kein Ort',
	saveFailed: 'Diese Notizen konnten in diesem Browser nicht gespeichert werden.',
	filled: (count) => `${count} ${count === 1 ? 'Fahrt' : 'Fahrten'} ausgefüllt`,
	filledDetail: 'Jede lässt sich weiterhin einzeln ändern.',
	undo: 'Rückgängig',
	undoFailed: 'Das Ausfüllen konnte in diesem Browser nicht rückgängig gemacht werden.',
	started: 'Beginn',
	distance: 'Strecke',
	duration: 'Dauer',
	topSpeed: 'Höchstgeschw.',
	showTrips: 'Fahrten anzeigen',
	trips: 'Fahrten',
	count: (count) => `${count} ${count === 1 ? 'Fahrt' : 'Fahrten'}`,
	labelOneByOne: 'Einzeln zuordnen',
	allTrips: 'Alle Fahrten',
	nextPrevious: 'nächste / vorherige',
	previousTrip: 'Vorherige Fahrt in der Liste',
	nextTrip: 'Nächste Fahrt in der Liste',
	nextUnlabelled: 'Nächste Fahrt ohne Ort',
	moving: (time) => `davon ${time} in Bewegung`,
	average: (speed) => `Durchschnittlich ${speed} in Bewegung`,
	energyUsed: 'Verbrauchte Energie',
	regen: (share) => `${share} kamen durch Rekuperation zurück`,
	secondBySecond: 'Sekunde für Sekunde',
	secondBySecondHint:
		'Zieh über ein beliebiges Feld, um zu zoomen; der Cursor ist zwischen allen geteilt.',
	forces: 'Kräfte',
	hardestAcceleration: 'Stärkste Beschleunigung',
	hardestBraking: 'Stärkste Bremsung',
	hardestCornering: 'Stärkste Kurve',
	longest: 'Längste',
	median: 'Mittlere Fahrt',
	every: 'Alle Fahrten',
	everyHint:
		'Erkannt an Fahrstufe und Kilometerstand. Wähle eine aus, um sie im Detail zu sehen und einzutragen, wohin sie ging.',
	outOfRange: (count, range) =>
		count === 1
			? `Eine weitere Fahrt ohne Ort liegt außerhalb von ${range}.`
			: `${count} weitere Fahrten ohne Ort liegen außerhalb von ${range}.`,
	showWhole: 'Ganze Aufzeichnung anzeigen',
	habitsMatch: (count) =>
		count === 1
			? 'Eine Fahrt passt zu deinen Gewohnheiten.'
			: `${count} Fahrten passen zu deinen Gewohnheiten.`,
	habitsHint:
		'Gleicher Start, gleiche Strecke, gleiche Tageszeit wie Fahrten, die du schon ausgefüllt hast.',
	fill: (count) => (count === 1 ? 'Ausfüllen' : `Alle ${count} ausfüllen`),
	sortBy: 'Sortieren nach',
	newest: 'Neueste zuerst',
	oldest: 'Älteste zuerst',
	longestFirst: 'Längste zuerst',
	efficient: 'Effizienteste zuerst',
	route: 'Strecke',
	purpose: 'Zweck',
	charge: 'Ladestand'
};
