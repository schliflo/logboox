import type { Messages } from '../en/index';

export const charging: Messages['charging'] = {
	energyDelivered: 'Geladene Energie',
	allSessions: 'Alle Ladevorgänge',
	duration: 'Dauer',
	peakPower: 'Spitzenleistung',
	rapidDc: 'DC-Schnellladen',
	onboardAc: 'Über das AC-Bordladegerät',
	chargeAdded: 'Geladen',
	estimatedCostIs: (cost) => `Geschätzte Kosten ${cost}`,
	howItWent: 'Wie der Ladevorgang verlief',
	howItWentHint:
		'Die Leistung sinkt, während sich die Batterie füllt; das flache Plateau ist das Limit des Ladegeräts.',
	atAGlance: 'Auf einen Blick',
	energyCharged: 'Geladene Energie',
	sessionsCount: (count) => `${count} Ladevorgänge`,
	cost: 'Kosten',
	perKwh: (price) => `Bei ${price} pro kWh`,
	fast: 'Schnellladen',
	sessionUnit: (count) => (count === 1 ? 'Ladevorgang' : 'Ladevorgänge'),
	onAc: (count) => `${count} an AC`,
	lowest: 'Niedrigster Ladestand',
	lowestBefore: (date) => `Vor dem Ladevorgang am ${date}`,
	noSessions: 'Keine Ladevorgänge in diesem Zeitraum',
	whenPlugIn: 'Wann du einsteckst',
	whenPlugInHint: 'Ladevorgänge nach Startstunde, in deiner eigenen Zeitzone.',
	hourOfDay: 'Tageszeit',
	every: 'Alle Ladevorgänge',
	everyHint:
		'Erkannt am Ladeleistungssignal, verbunden über die Nickerchen, die das Auto mitten im Laden macht.',
	started: 'Beginn',
	energy: 'Energie',
	peak: 'Spitze',
	charge: 'Ladestand',
	rapid: 'Schnell',
	ac: 'AC'
};
