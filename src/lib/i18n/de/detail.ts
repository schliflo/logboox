import type { Messages } from '../en/index';

export const detail: Messages['detail'] = {
	chargingPower: 'Ladeleistung',
	stateOfCharge: 'Ladestand',
	powerAtPlug: 'Leistung am Stecker',
	speed: 'Geschwindigkeit',
	powerTitle: 'Leistung aus der Batterie, negativ bei Rekuperation',
	power: 'Leistung',
	charge: 'Ladung',
	accelerator: 'Fahrpedal',
	brake: 'Bremse',
	pressed: 'getreten',
	released: 'gelöst',
	driverTitle: 'Was der Fahrer gemacht hat',
	steeringAngle: 'Lenkwinkel',
	steering: 'Lenkung'
};

export const exportMenu: Messages['exportMenu'] = {
	failed: 'Diese Datei konnte nicht geschrieben werden',
	pdfOffline:
		'Ein PDF braucht beim ersten Mal eine Verbindung. CSV und Tabelle funktionieren ohne.',
	download: 'Herunterladen',
	rows: (count) => `${count} ${count === 1 ? 'Zeile' : 'Zeilen'}, älteste zuerst`,
	csvHint: 'für alles',
	xlsxHint: 'echte Datumswerte',
	pdfHint: 'zum Weitergeben'
};

export const shares: Messages['shares'] = {
	kinds: { trip: 'Fahrt', charging: 'Ladevorgang', export: 'Ganzer Export' },
	revokeFailed: 'Der Link konnte nicht widerrufen werden',
	stillLive: 'Er ist weiterhin aktiv.',
	revoked: 'Link widerrufen',
	revokedDetail: 'Er funktioniert innerhalb weniger Minuten für niemanden mehr.',
	copied: 'Link kopiert',
	copyFailed: 'Kopieren nicht möglich',
	title: 'Geteilte Links',
	description:
		'Jeder mit einem dieser Links sieht, was er zeigt. Keiner davon enthält deine Fahrzeug-Identifizierungsnummer.',
	kindOn: (kind, date) => `${kind} am ${date}`,
	made: (date) => `Erstellt ${date}`,
	views: (count) => (count === 1 ? 'einmal geöffnet' : `${count}-mal geöffnet`),
	copy: 'Link kopieren',
	revoke: 'Link widerrufen'
};

export const share: Messages['share'] = {
	trip: 'Fahrt',
	session: 'Ladevorgang',
	tripSignals: 'Geschwindigkeit, Batterieleistung und Ladestand, Pedalen und Lenkung',
	sessionSignals: 'Ladeleistung und Ladestand',
	openFirst: 'Öffne zuerst einen Export.',
	failed: 'Der Link konnte nicht erstellt werden.',
	halfMade:
		' Ein halb erstellter Link steht eventuell unter deinen geteilten Links; widerrufe ihn dort.',
	uploadFailed: 'Ein Teil der Freigabe konnte nicht hochgeladen werden.',
	copied: 'Link kopiert',
	copyFailed: 'Kopieren nicht möglich',
	copyByHand: 'Markiere den Link und kopiere ihn von Hand.',
	share: 'Teilen',
	signInTitle: 'Zum Teilen anmelden',
	signInDetail: 'Ein Link muss zu einem Konto gehören, damit du ihn wieder entfernen kannst.',
	liveTitle: 'Jeder mit diesem Link kann es sehen',
	liveDetail: (noun, signals) =>
		`Er zeigt, wann ${noun === 'Fahrt' ? 'die Fahrt' : 'der Ladevorgang'} stattfand, die Summen und das Automodell, dazu ${signals} im Sekundentakt. Nicht die Fahrzeug-Identifizierungsnummer, den Kilometerstand oder den Rest deines Exports. Du kannst ihn jederzeit in deinem Konto widerrufen; er funktioniert dann innerhalb weniger Minuten nicht mehr.`,
	copyLink: 'Link kopieren',
	shareThis: (noun) => (noun === 'Fahrt' ? 'Diese Fahrt teilen' : 'Diesen Ladevorgang teilen'),
	unguessable:
		'Eine Kopie dieser Sekunden wird unter einem Link veröffentlicht, den niemand erraten kann.',
	titleLabel: 'Titel, wenn du magst',
	titlePlaceholder: 'Der lange Weg nach Hause',
	publishing: 'Wird veröffentlicht…',
	make: 'Link erstellen'
};

export const notes: Messages['notes'] = {
	saveFailed: 'Diese Notiz konnte in diesem Browser nicht gespeichert werden.',
	saveFailedDetail: 'Sie ist noch da, aber weg, sobald du die Seite verlässt.',
	title: 'Wohin ging diese Fahrt?',
	description:
		'Der Export enthält keinerlei Standortdaten. Füll das hier aus, und es wird ein Fahrtenbuch.',
	saving: 'Wird gespeichert',
	from: 'Von',
	fromPlaceholder: 'Wo sie begann',
	to: 'Nach',
	toPlaceholder: 'Wo sie endete',
	purpose: 'Zweck',
	usually: (purpose) => `Fahrten wie diese sind meistens: ${purpose}.`,
	notes: 'Notizen',
	notesPlaceholder: 'Alles, was du dir zu dieser Fahrt merken willst',
	reasons: {
		'where the last trip ended': 'wo die letzte Fahrt endete',
		'where you usually set off at this hour': 'wo du um diese Zeit meistens losfährst',
		'somewhere you have set off from': 'ein Ort, von dem du schon losgefahren bist',
		'the way back': 'der Rückweg',
		'same start, same distance': 'gleicher Start, gleiche Strecke',
		'a trip you make at this hour': 'eine Fahrt, die du um diese Zeit machst',
		'about the same distance': 'etwa dieselbe Strecke',
		'where you usually go at this hour': 'wohin du um diese Zeit meistens fährst',
		'a similar trip': 'eine ähnliche Fahrt'
	}
};

export const sharedPage: Messages['sharedPage'] = {
	tripHeading: (km) => `Eine Fahrt über ${km} km`,
	chargeHeading: (kwh) => `Eine Ladung mit ${kwh} kWh`,
	monthHeading: 'Ein Monat Fahren',
	unreadable: 'Die Messpunkte konnten nicht gelesen werden.',
	from: 'Geteilt über LogbooX',
	distance: 'Strecke',
	duration: 'Dauer',
	topSpeed: 'Höchstgeschwindigkeit',
	energyUsed: 'Verbrauchte Energie',
	regen: (share) => `${share} kamen durch Rekuperation zurück`,
	delivered: 'Geladene Energie',
	peakPower: 'Spitzenleistung',
	rapidDc: 'DC-Schnellladen',
	onboardAc: 'Über das AC-Bordladegerät',
	chargeAdded: 'Geladen',
	secondBySecond: 'Sekunde für Sekunde',
	secondBySecondHint:
		'Ein Messpunkt pro Sekunde, so wie das Auto ihn aufgezeichnet hat. Fährst du über ein Feld, zeigen alle diesen Moment.',
	reading: 'Messpunkte werden gelesen…',
	wholeMonth: 'Ein ganzer Monat',
	wholeMonthHint:
		'Dieser Link enthält einen ganzen Export. Beim Öffnen wird alles in deinen Browser gelesen, das dauert einen Moment und braucht einige hundert Megabyte Arbeitsspeicher.',
	readingExport: 'Wird gelesen…',
	openDashboard: 'Dashboard öffnen',
	yoursToo: 'Dein Auto zeichnet das auch auf',
	yoursTooHint:
		'Nach dem EU Data Act kannst du bei XPeng die Daten anfordern, die dein eigenes Fahrzeug speichert. LogbooX liest sie in deinem Browser — nichts hochzuladen, keine Registrierung.',
	readOwn: 'Eigenen Export lesen'
};
