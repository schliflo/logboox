import type { Messages } from '../en/index';

export const charts: Messages['charts'] = {
	gg: {
		aria: (seconds) => `Querkraft gegen Bremsen und Beschleunigen, ${seconds} Sekunden Fahrt`,
		accelerating: 'beschleunigen',
		braking: 'bremsen',
		left: 'links',
		right: 'rechts',
		ofDriving: (share) => `${share} % der Fahrzeit`,
		never: 'nie erreicht',
		caption: (seconds, extent) =>
			`${seconds} Sekunden Fahrt. Die Ringe markieren Viertel-g-Schritte; der äußere Rand liegt bei ${extent} g.`
	},
	daily: {
		aria: 'Strecke pro Tag',
		notRecorded: 'nicht aufgezeichnet',
		notRecordedTitle: 'Nicht aufgezeichnet'
	},
	histogram: {
		distribution: 'Verteilung',
		aria: (label, bins) => `${label}, ${bins} Klassen`,
		peak: (value) => `Spitze ${value}`,
		samples: (count, one) => `${count} ${one ? 'Messpunkt' : 'Messpunkte'}`
	},
	calendar: {
		distance: 'Strecke',
		perDay: (label) => `${label} pro Tag`,
		months: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'],
		notRecordedDay: (day) => `${day}, nicht aufgezeichnet`,
		noExport: 'kein Export deckt diesen Tag ab',
		busiest: 'der fahrintensivste Tag',
		rank: (place, of) => `Platz ${place} von ${of} Fahrtagen`,
		didNotMove: 'das Auto hat sich nicht bewegt',
		notRecorded: 'nicht aufgezeichnet'
	},
	punchcard: {
		activity: 'Fahraktivität',
		aria: (label) => `${label}, nach Wochentag und Stunde`,
		ofWeek: (share) => `${share} % der Woche`,
		never: 'nie',
		caption: (label) => `${label}, nach Tageszeit`,
		less: 'weniger',
		more: 'mehr'
	},
	uplot: {
		overTime: (labels) => `${labels} im Zeitverlauf`
	}
};
